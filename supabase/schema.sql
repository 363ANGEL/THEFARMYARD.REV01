-- ===== Farmyard Hub schema. Idempotent: safe to re-run. =====
-- pg_cron: enabled here so the paste is self-contained (Supabase docs: create extension pg_cron with schema pg_catalog).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
create schema if not exists fy;
grant usage on schema fy to anon, authenticated;

-- 1. Tables ----------------------------------------------------------------
create table if not exists fy.league (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  public_badges boolean not null default true,
  auto_confirm_days int not null default 14,
  created_at timestamptz not null default now()
);

create table if not exists fy.member (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  nickname text not null,
  avatar text not null default 'hen',
  user_id uuid unique references auth.users(id) on delete set null,
  discord_id text,
  role text not null default 'member' check (role in ('leader','member')),
  chesscom_username text,
  created_at timestamptz not null default now(),
  unique (league_id, nickname)
);

-- Claim tokens live apart from member so no page can ever read them.
create table if not exists fy.claim_link (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  league_id uuid not null references fy.league(id),
  member_id uuid not null references fy.member(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists fy.event_type (
  key text not null,
  league_id uuid not null references fy.league(id),
  label text not null,
  points_rule jsonb not null default '{"rule":"winner_takes_all"}',
  overall_weight numeric not null default 1,
  primary key (league_id, key)
);

create table if not exists fy.event (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  type_key text not null,
  played_at timestamptz not null default now(),
  entered_by uuid references fy.member(id),
  note text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (league_id, type_key) references fy.event_type(league_id, key)
);

create table if not exists fy.score_entry (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  event_id uuid references fy.event(id),
  member_id uuid not null references fy.member(id),
  points int not null,
  reason text not null check (reason in ('result','correction','claim')),
  created_at timestamptz not null default now()
);

create table if not exists fy.settlement (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  member_a uuid not null references fy.member(id),
  member_b uuid not null references fy.member(id),
  settled_at timestamptz not null default now(),
  recorded_by uuid references fy.member(id)
);

create table if not exists fy.iou (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  event_id uuid references fy.event(id),
  payer_id uuid not null references fy.member(id),
  payee_id uuid not null references fy.member(id),
  amount int not null check (amount > 0),
  state text not null default 'open'
    check (state in ('open','marked_paid','confirmed','disputed','settled')),
  state_changed_at timestamptz not null default now(),
  settlement_id uuid references fy.settlement(id),
  created_at timestamptz not null default now(),
  check (payer_id <> payee_id)
);

create table if not exists fy.claim (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  member_id uuid not null references fy.member(id),
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','approved','rejected')),
  decided_by uuid references fy.member(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Seed: one league, three event types. Re-runnable.
insert into fy.league (slug, name) values ('farmyard', 'The Farmyard')
  on conflict (slug) do nothing;
insert into fy.event_type (league_id, key, label, overall_weight)
select l.id, v.key, v.label, v.w from fy.league l,
  (values ('poker','Poker',1), ('chess','Chess',1), ('super6','Super 6',0)) as v(key,label,w)
where l.slug = 'farmyard'
on conflict do nothing;

-- 2. Views -----------------------------------------------------------------
create or replace view fy.v_members_public as
  select id, league_id, nickname, avatar from fy.member;

-- Every score_entry has an event (decide_claim creates one for approved points claims),
-- so standings are a sum over events of each type.
create or replace view fy.v_standings as
  select m.league_id, t.key as type_key, m.id as member_id, m.nickname, m.avatar,
         coalesce((
           select sum(s.points) from fy.score_entry s
           join fy.event e on e.id = s.event_id
           where s.member_id = m.id and e.type_key = t.key and e.league_id = m.league_id
         ), 0)::int as points
  from fy.member m
  join fy.event_type t on t.league_id = m.league_id;

create or replace view fy.v_overall as
  select s.league_id, s.member_id, s.nickname, s.avatar,
         sum(s.points * t.overall_weight)::numeric(10,2) as points
  from fy.v_standings s
  join fy.event_type t on t.league_id = s.league_id and t.key = s.type_key
  group by s.league_id, s.member_id, s.nickname, s.avatar;

-- Live IOU = still counts against the payer.
create or replace view fy.v_live_iou as
  select * from fy.iou where state in ('open','marked_paid','disputed');

create or replace view fy.v_badges as
  select m.league_id, m.id as member_id,
         coalesce((select sum(amount) from fy.v_live_iou i where i.payer_id = m.id), 0)::int as owes,
         coalesce((select sum(amount) from fy.v_live_iou i where i.payee_id = m.id), 0)::int as owed
  from fy.member m
  join fy.league l on l.id = m.league_id
  where l.public_badges;

create or replace view fy.v_netting as
  select league_id,
         least(payer_id, payee_id) as member_a,
         greatest(payer_id, payee_id) as member_b,
         sum(case when payer_id < payee_id then amount else -amount end)::int as net
  from fy.v_live_iou
  group by league_id, least(payer_id, payee_id), greatest(payer_id, payee_id);
-- net > 0 means member_a owes member_b that many buy-ins; net < 0 the other way.

grant select on fy.v_members_public, fy.v_standings, fy.v_overall, fy.v_badges to anon, authenticated;
-- v_netting and v_live_iou are deliberately NOT granted: views run as their owner and would
-- bypass the iou row-level security. The leader reads netting through fy.netting() (Task 4).

-- 3. Functions ---------------------------------------------------------------
-- Every write goes through here. All are security definer and check the caller.

create or replace function fy.me() returns fy.member
language sql stable security definer set search_path = fy, public as $$
  select id, league_id, nickname, avatar, user_id, null::text, role, chesscom_username, created_at
  from fy.member where user_id = auth.uid() limit 1;
$$;

create or replace function fy.is_leader() returns boolean
language sql stable security definer set search_path = fy, public as $$
  select exists (select 1 from fy.member where user_id = auth.uid() and role = 'leader');
$$;

-- Used by the member read policy: a policy on fy.member cannot query fy.member itself
-- (infinite recursion), so the check lives in a security-definer function.
create or replace function fy.is_member() returns boolean
language sql stable security definer set search_path = fy, public as $$
  select exists (select 1 from fy.member where user_id = auth.uid());
$$;

create or replace function fy._league() returns uuid
language sql stable set search_path = fy, public as $$
  select id from fy.league where slug = 'farmyard';
$$;

create or replace function fy._require_leader() returns fy.member
language plpgsql stable security definer set search_path = fy, public as $$
declare m fy.member;
begin
  select * into m from fy.member where user_id = auth.uid() and role = 'leader';
  if m.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return m;
end $$;

create or replace function fy.create_member(p_nickname text, p_avatar text) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_id uuid;
begin
  perform fy._require_leader();
  insert into fy.member (league_id, nickname, avatar) values (fy._league(), p_nickname, coalesce(p_avatar,'hen'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function fy.issue_claim_link(p_member_id uuid) returns text
language plpgsql security definer set search_path = fy, public as $$
declare v_token text;
begin
  perform fy._require_leader();
  insert into fy.claim_link (member_id, league_id)
  select id, league_id from fy.member where id = p_member_id
  returning token into v_token;
  if v_token is null then raise exception 'unknown member' using errcode = 'P0002'; end if;
  return v_token;
end $$;

create or replace function fy.claim_profile(p_token text) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_member uuid; v_discord text; n int;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from fy.member where user_id = auth.uid()) then
    raise exception 'already claimed a profile' using errcode = '23505';
  end if;
  -- Burn the token first, in one statement: two accounts racing on the same link cannot both pass.
  update fy.claim_link set used_at = now()
  where token = p_token and used_at is null
  returning member_id into v_member;
  if v_member is null then raise exception 'link used or unknown' using errcode = 'P0002'; end if;
  -- The Discord user id lives in auth.identities, not in the JWT.
  select provider_id into v_discord from auth.identities
  where user_id = auth.uid() and provider = 'discord' limit 1;
  update fy.member set user_id = auth.uid(), discord_id = v_discord
  where id = v_member and user_id is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'link used or unknown' using errcode = 'P0002'; end if;
  return v_member;
end $$;

create or replace function fy.void_event(p_event uuid, p_note text default null) returns void
language plpgsql security definer set search_path = fy, public as $$
declare e fy.event;
begin
  perform fy._require_leader();
  select * into e from fy.event where id = p_event for update;
  if e.id is null then raise exception 'no such event' using errcode = 'P0002'; end if;
  if e.voided_at is not null then raise exception 'already voided'; end if;
  insert into fy.score_entry (league_id, event_id, member_id, points, reason)
  select league_id, event_id, member_id, -points, 'correction' from fy.score_entry where event_id = p_event;
  update fy.iou set state = 'settled', state_changed_at = now()
  where event_id = p_event and state in ('open','marked_paid','disputed');
  update fy.event set voided_at = now(), note = coalesce(note || ' · ', '') || 'voided' || coalesce(': ' || p_note, '')
  where id = p_event;
end $$;

create or replace function fy.netting() returns setof fy.v_netting
language sql stable security definer set search_path = fy, public as $$
  select * from fy.v_netting where fy.is_leader();
$$;

create or replace function fy.recent_events(p_limit int default 10) returns setof fy.event
language sql stable security definer set search_path = fy, public as $$
  select * from fy.event where fy.is_leader() order by played_at desc limit p_limit;
$$;

create or replace function fy.record_poker_result(
  p_players jsonb, p_winner uuid, p_played_at timestamptz default now(), p_note text default null
) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_event uuid; v_total int := 0; p record; v_winner_present boolean := false;
begin
  leader := fy._require_leader();
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 2 then
    raise exception 'need at least two players';
  end if;
  -- Checked before the duplicate count: count(distinct) skips nulls, so a missing member_id would be miscounted.
  if exists (select 1 from jsonb_array_elements(p_players) x
             where x->>'member_id' is null or x->>'buy_ins' is null) then
    raise exception 'each player needs member_id and buy_ins';
  end if;
  if (select count(distinct x->>'member_id') from jsonb_array_elements(p_players) x) <> jsonb_array_length(p_players) then
    raise exception 'a player is listed twice';
  end if;
  for p in select (x->>'member_id')::uuid as member_id, (x->>'buy_ins')::int as buy_ins
           from jsonb_array_elements(p_players) x loop
    if p.buy_ins is null or p.buy_ins <= 0 then raise exception 'buy-ins must be at least 1'; end if;
    if not exists (select 1 from fy.member where id = p.member_id and league_id = fy._league()) then
      raise exception 'unknown player %', p.member_id;
    end if;
    if p.member_id = p_winner then v_winner_present := true; end if;
    v_total := v_total + p.buy_ins;
  end loop;
  if not v_winner_present then raise exception 'winner must be one of the players'; end if;

  insert into fy.event (league_id, type_key, played_at, entered_by, note)
  values (fy._league(), 'poker', coalesce(p_played_at, now()), leader.id, p_note) returning id into v_event;

  insert into fy.score_entry (league_id, event_id, member_id, points, reason)
  values (fy._league(), v_event, p_winner, v_total, 'result');

  insert into fy.iou (league_id, event_id, payer_id, payee_id, amount)
  select fy._league(), v_event, (x->>'member_id')::uuid, p_winner, (x->>'buy_ins')::int
  from jsonb_array_elements(p_players) x
  where (x->>'member_id')::uuid <> p_winner;

  return v_event;
end $$;

create or replace function fy.iou_transition(p_iou uuid, p_to text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; i fy.iou; ok boolean := false;
begin
  select * into me from fy.member where user_id = auth.uid();
  if me.id is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into i from fy.iou where id = p_iou for update;
  if i.id is null then raise exception 'no such IOU' using errcode = 'P0002'; end if;
  if i.state in ('confirmed','settled') then raise exception 'already closed'; end if;

  if me.role = 'leader' then
    ok := p_to in ('open','marked_paid','confirmed','disputed');
  elsif me.id = i.payer_id then
    ok := (i.state = 'open' and p_to = 'marked_paid');
  elsif me.id = i.payee_id then
    ok := (i.state = 'marked_paid' and p_to in ('confirmed','disputed'));
  end if;
  if not ok then raise exception 'not allowed' using errcode = '42501'; end if;

  update fy.iou set state = p_to, state_changed_at = now() where id = p_iou;
end $$;

create or replace function fy.settle_pair(p_a uuid, p_b uuid) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_id uuid; n int;
begin
  leader := fy._require_leader();
  if p_a = p_b then raise exception 'pick two different members'; end if;
  select count(*) into n from fy.iou
  where state in ('open','marked_paid','disputed')
    and ((payer_id = p_a and payee_id = p_b) or (payer_id = p_b and payee_id = p_a));
  if n = 0 then raise exception 'nothing to square'; end if;
  insert into fy.settlement (league_id, member_a, member_b, recorded_by)
  values (fy._league(), p_a, p_b, leader.id) returning id into v_id;
  update fy.iou set state = 'settled', settlement_id = v_id, state_changed_at = now()
  where state in ('open','marked_paid','disputed')
    and ((payer_id = p_a and payee_id = p_b) or (payer_id = p_b and payee_id = p_a));
  return v_id;
end $$;

create or replace function fy.raise_claim(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_id uuid;
begin
  select * into me from fy.member where user_id = auth.uid();
  if me.id is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if coalesce(p_payload->>'type', '') not in ('points','iou') then raise exception 'claim type must be points or iou'; end if;
  if p_payload->>'type' = 'points' and coalesce(p_payload->>'points', '') !~ '^[0-9]{1,4}$' then raise exception 'points must be a whole number'; end if;
  if p_payload->>'type' = 'iou' and coalesce(p_payload->>'amount', '') !~ '^[0-9]{1,4}$' then raise exception 'amount must be a whole number'; end if;
  insert into fy.claim (league_id, member_id, payload) values (fy._league(), me.id, p_payload) returning id into v_id;
  return v_id;
end $$;

create or replace function fy.decide_claim(p_claim uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; c fy.claim; v_event uuid;
begin
  leader := fy._require_leader();
  select * into c from fy.claim where id = p_claim and state = 'pending' for update;
  if c.id is null then raise exception 'no pending claim' using errcode = 'P0002'; end if;
  if p_approve then
    if c.payload->>'type' = 'points' then
      insert into fy.event (league_id, type_key, entered_by, note)
      values (fy._league(), c.payload->>'type_key', leader.id, 'claim ' || c.id) returning id into v_event;
      insert into fy.score_entry (league_id, event_id, member_id, points, reason)
      values (fy._league(), v_event, c.member_id, (c.payload->>'points')::int, 'claim');
    else
      insert into fy.iou (league_id, payer_id, payee_id, amount)
      values (fy._league(), (c.payload->>'payer_id')::uuid, (c.payload->>'payee_id')::uuid, (c.payload->>'amount')::int);
    end if;
  end if;
  update fy.claim set state = case when p_approve then 'approved' else 'rejected' end,
                      decided_by = leader.id, decided_at = now() where id = p_claim;
end $$;

create or replace function fy.set_league(p_public_badges boolean, p_auto_confirm_days int) returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  perform fy._require_leader();
  update fy.league set public_badges = coalesce(p_public_badges, public_badges),
                      auto_confirm_days = coalesce(p_auto_confirm_days, auto_confirm_days)
  where id = fy._league();
end $$;

create or replace function fy.set_weight(p_key text, p_weight numeric) returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  perform fy._require_leader();
  update fy.event_type set overall_weight = p_weight where league_id = fy._league() and key = p_key;
end $$;

create or replace function fy.auto_confirm_ious() returns int
language plpgsql security definer set search_path = fy, public as $$
declare n int;
begin
  update fy.iou i set state = 'confirmed', state_changed_at = now()
  from fy.league l
  where i.league_id = l.id and i.state = 'marked_paid'
    and i.state_changed_at < now() - make_interval(days => l.auto_confirm_days);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function fy.my_ious() returns setof fy.iou
language sql stable security definer set search_path = fy, public as $$
  select i.* from fy.iou i join fy.member m on m.user_id = auth.uid()
  where i.payer_id = m.id or i.payee_id = m.id or m.role = 'leader'
  order by i.created_at desc;
$$;

-- Expose RPCs. PostgREST only sees functions in exposed schemas; RAY adds fy to
-- API → Exposed schemas in the dashboard (Task 6).
grant execute on function fy.me, fy.is_leader, fy.is_member, fy.claim_profile, fy.iou_transition, fy.raise_claim, fy.my_ious to authenticated;
grant execute on function fy.is_leader, fy.is_member, fy.me to anon;
grant execute on function fy.create_member, fy.issue_claim_link, fy.record_poker_result, fy.void_event, fy.netting, fy.recent_events,
  fy.settle_pair, fy.decide_claim, fy.set_league, fy.set_weight to authenticated;
revoke all on function fy.auto_confirm_ious from public;

-- Nightly auto-confirm at 00:10 UTC. pg_cron upserts by job name, so this is re-runnable.
select cron.schedule('fy_auto_confirm', '10 0 * * *', $$select fy.auto_confirm_ious()$$);

-- 4. Row-level security -------------------------------------------------------
alter table fy.league enable row level security;
alter table fy.member enable row level security;
alter table fy.claim_link enable row level security;   -- no policies: nobody reads it directly
alter table fy.event_type enable row level security;
alter table fy.event enable row level security;
alter table fy.score_entry enable row level security;
alter table fy.iou enable row level security;
alter table fy.settlement enable row level security;
alter table fy.claim enable row level security;

-- Anon reads the league, event types and the views only; raw events and scores are for members.
grant select on fy.league, fy.event_type to anon, authenticated;
revoke select on fy.event, fy.score_entry from anon;
grant select on fy.event, fy.score_entry to authenticated;
grant select on fy.iou, fy.settlement, fy.claim to authenticated;
-- Column-level: every member column except discord_id, which only the leader's SQL editor sees.
-- Revoke first: a re-run over an old table-wide grant must end with the column grant only.
revoke select on fy.member from authenticated;
grant select (id, league_id, nickname, avatar, user_id, role, chesscom_username, created_at) on fy.member to authenticated;
grant update (nickname, avatar, chesscom_username) on fy.member to authenticated;

drop policy if exists league_read on fy.league;
create policy league_read on fy.league for select using (true);
drop policy if exists event_type_read on fy.event_type;
create policy event_type_read on fy.event_type for select using (true);
drop policy if exists event_read on fy.event;
create policy event_read on fy.event for select using (true);
drop policy if exists score_read on fy.score_entry;
create policy score_read on fy.score_entry for select using (true);

-- Only people with a claimed profile (or the leader) see member rows. "authenticated" alone is
-- any Discord account on the internet, not the crew.
drop policy if exists member_read on fy.member;
create policy member_read on fy.member for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists member_update_self on fy.member;
create policy member_update_self on fy.member for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists iou_read_party on fy.iou;
create policy iou_read_party on fy.iou for select to authenticated using (
  fy.is_leader() or exists (
    select 1 from fy.member m where m.user_id = auth.uid() and (m.id = payer_id or m.id = payee_id)));

drop policy if exists settlement_read_party on fy.settlement;
create policy settlement_read_party on fy.settlement for select to authenticated using (
  fy.is_leader() or exists (
    select 1 from fy.member m where m.user_id = auth.uid() and (m.id = member_a or m.id = member_b)));

drop policy if exists claim_read_own on fy.claim;
create policy claim_read_own on fy.claim for select to authenticated using (
  fy.is_leader() or exists (select 1 from fy.member m where m.user_id = auth.uid() and m.id = member_id));
-- No insert/update/delete policies anywhere: writes happen only inside security-definer functions.
