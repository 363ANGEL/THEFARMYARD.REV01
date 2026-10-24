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
  nickname text not null check (char_length(btrim(nickname)) between 1 and 24),
  avatar text not null default 'hen',
  user_id uuid unique references auth.users(id) on delete set null,
  discord_id text,
  role text not null default 'member' check (role in ('leader','member')),
  chesscom_username text,
  created_at timestamptz not null default now(),
  revolut_url text,   -- fy.me() builds a fy.member row by position: new columns go after this one, in this order
  avatar_url text,    -- a logo from fy.member_logo (New User Set-up / Profile); null = the avatar key above
  setup_at timestamptz,  -- when the member finished New User Set-up; null sends them there first
  birth_day smallint check (birth_day between 1 and 31),     -- birthday, day of the month; null = not given
  birth_month smallint check (birth_month between 1 and 12), -- birthday, month; null = not given
  unique (league_id, nickname)
);
alter table fy.member add column if not exists revolut_url text;
alter table fy.member add column if not exists avatar_url text;
alter table fy.member add column if not exists setup_at timestamptz;
alter table fy.member add column if not exists birth_day smallint;
alter table fy.member add column if not exists birth_month smallint;
-- Members claimed before New User Set-up existed are not sent through it.
update fy.member set setup_at = coalesce(setup_at, created_at) where user_id is not null and setup_at is null;

-- Re-run safety: "create table if not exists" skips an existing table, so add the nickname check there too.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'member_nickname_check' and conrelid = 'fy.member'::regclass) then
    alter table fy.member add constraint member_nickname_check check (char_length(btrim(nickname)) between 1 and 24);
  end if;
  -- Revolut pay-me link: https only, revolut.me only (it ends up in an href).
  alter table fy.member drop constraint if exists member_revolut_url_check;
  begin
    alter table fy.member add constraint member_revolut_url_check
      check (revolut_url is null or revolut_url ~ '^https://revolut\.me/[A-Za-z0-9._-]+$');
  end;
  -- Logo URL ends up in a CSS url(): https only, no quotes, brackets or spaces.
  alter table fy.member drop constraint if exists member_avatar_url_check;
  alter table fy.member add constraint member_avatar_url_check
    check (avatar_url is null or avatar_url ~ '^https://[^\s"''<>()]+$');
  -- Birthday (day and month only). Named as "create table" names them, so a fresh build skips these.
  if not exists (select 1 from pg_constraint where conname = 'member_birth_day_check' and conrelid = 'fy.member'::regclass) then
    alter table fy.member add constraint member_birth_day_check check (birth_day between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_birth_month_check' and conrelid = 'fy.member'::regclass) then
    alter table fy.member add constraint member_birth_month_check check (birth_month between 1 and 12);
  end if;
end $$;

-- Pre-made logos: RAY sets up to 8 per member (Supabase Storage public URLs); the member picks one.
create table if not exists fy.member_logo (
  member_id uuid not null references fy.member(id) on delete cascade,
  slot int not null check (slot between 1 and 8),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  url text not null check (url ~ '^https://[^\s"''<>()]+$'),
  primary key (member_id, slot)
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
  select id, league_id, nickname, avatar, avatar_url from fy.member;

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
  select id, league_id, nickname, avatar, user_id, null::text, role, chesscom_username, created_at, revolut_url, avatar_url, setup_at,
         birth_day, birth_month
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
  insert into fy.member (league_id, nickname, avatar) values (fy._league(), btrim(p_nickname), coalesce(p_avatar,'hen'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function fy.issue_claim_link(p_member_id uuid) returns text
language plpgsql security definer set search_path = fy, public as $$
declare v_token text;
begin
  perform fy._require_leader();
  -- A new link burns any older unused one for the same member.
  update fy.claim_link set used_at = now() where member_id = p_member_id and used_at is null;
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

-- Invite Door: the name on an unused invite, so the page can say "Welcome, <name>". Anyone holding the
-- token may read it (the token is the secret); a used or unknown token returns null.
create or replace function fy.claim_peek(p_token text) returns text
language sql stable security definer set search_path = fy, public as $$
  select m.nickname from fy.claim_link c join fy.member m on m.id = c.member_id
  where c.token = p_token and c.used_at is null and m.user_id is null;
$$;

-- Leader replaces a member's logo palette. p_logos = [{"slot":1,"name":"Hank","url":"https://..."}, ...] (max 8).
create or replace function fy.set_member_logos(p_member uuid, p_logos jsonb) returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  perform fy._require_leader();
  if not exists (select 1 from fy.member where id = p_member) then raise exception 'unknown member' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_logos) <> 'array' or jsonb_array_length(p_logos) > 8 then raise exception 'up to 8 logos'; end if;
  delete from fy.member_logo where member_id = p_member;
  insert into fy.member_logo (member_id, slot, name, url)
  select p_member, (x->>'slot')::int, btrim(x->>'name'), btrim(x->>'url') from jsonb_array_elements(p_logos) x;
  -- A member whose chosen logo was removed falls back to their avatar key.
  update fy.member set avatar_url = null where id = p_member
    and avatar_url is not null and not exists (select 1 from fy.member_logo l where l.member_id = p_member and l.url = fy.member.avatar_url);
end $$;

-- Internal: no caller check. The public wrappers (void_event, poker_undo_docket) decide who may call it.
create or replace function fy._void_event(p_event uuid, p_note text default null) returns void
language plpgsql security definer set search_path = fy, public as $$
declare e fy.event;
begin
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

create or replace function fy.void_event(p_event uuid, p_note text default null) returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  perform fy._require_leader();
  perform fy._void_event(p_event, p_note);
end $$;

create or replace function fy.netting() returns setof fy.v_netting
language sql stable security definer set search_path = fy, public as $$
  select * from fy.v_netting where fy.is_leader();
$$;

create or replace function fy.recent_events(p_limit int default 10) returns setof fy.event
language sql stable security definer set search_path = fy, public as $$
  select * from fy.event where fy.is_leader() order by played_at desc limit p_limit;
$$;

-- Internal: no caller check; p_actor is recorded as entered_by. Public wrappers: record_poker_result
-- (leader only) and poker_file_docket (table initiator or leader).
create or replace function fy._record_poker_result(
  p_actor uuid, p_players jsonb, p_winner uuid, p_played_at timestamptz default now(), p_note text default null
) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_event uuid; v_total int := 0; p record; v_winner_present boolean := false;
begin
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
  values (fy._league(), 'poker', coalesce(p_played_at, now()), p_actor, p_note) returning id into v_event;

  insert into fy.score_entry (league_id, event_id, member_id, points, reason)
  values (fy._league(), v_event, p_winner, v_total, 'result');

  insert into fy.iou (league_id, event_id, payer_id, payee_id, amount)
  select fy._league(), v_event, (x->>'member_id')::uuid, p_winner, (x->>'buy_ins')::int
  from jsonb_array_elements(p_players) x
  where (x->>'member_id')::uuid <> p_winner;

  return v_event;
end $$;

create or replace function fy.record_poker_result(
  p_players jsonb, p_winner uuid, p_played_at timestamptz default now(), p_note text default null
) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member;
begin
  leader := fy._require_leader();
  return fy._record_poker_result(leader.id, p_players, p_winner, p_played_at, p_note);
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
  if p_payload->>'type' = 'points' and coalesce(p_payload->>'points', '') !~ '^[1-9][0-9]{0,3}$' then raise exception 'points must be a whole number, 1 to 9999'; end if;
  if p_payload->>'type' = 'iou' and coalesce(p_payload->>'amount', '') !~ '^[1-9][0-9]{0,3}$' then raise exception 'amount must be a whole number, 1 to 9999'; end if;
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
grant execute on function fy.me, fy.is_leader, fy.is_member, fy.claim_profile, fy.claim_peek, fy.iou_transition, fy.raise_claim, fy.my_ious to authenticated;
grant execute on function fy.is_leader, fy.is_member, fy.me, fy.claim_peek to anon;
grant execute on function fy.create_member, fy.issue_claim_link, fy.set_member_logos, fy.record_poker_result, fy.void_event, fy.netting, fy.recent_events,
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
grant select (id, league_id, nickname, avatar, user_id, role, chesscom_username, created_at, revolut_url, avatar_url, setup_at,
  birth_day, birth_month) on fy.member to authenticated;
grant update (nickname, avatar, chesscom_username, revolut_url, avatar_url, setup_at, birth_day, birth_month) on fy.member to authenticated;
alter table fy.member_logo enable row level security;
grant select on fy.member_logo to authenticated;
drop policy if exists member_logo_read on fy.member_logo;
create policy member_logo_read on fy.member_logo for select to authenticated using (fy.is_member() or fy.is_leader());

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

-- 5. Poker room ---------------------------------------------------------------
create table if not exists fy.poker_table (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  started_by uuid not null references fy.member(id),
  pokernow_url text,                       -- null until the initiator confirms the game link
  status text not null default 'starting'  -- starting | open | closed
    check (status in ('starting','open','closed')),
  event_id uuid references fy.event(id),   -- set when the docket is filed
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists fy.poker_seat (
  table_id uuid not null references fy.poker_table(id) on delete cascade,
  seat_no int not null check (seat_no between 1 and 10),
  member_id uuid not null references fy.member(id),
  table_name text not null check (char_length(btrim(table_name)) between 1 and 24),
  taken_at timestamptz not null default now(),
  primary key (table_id, seat_no),
  unique (table_id, member_id)             -- one seat per member
);
-- One live table per league.
create unique index if not exists poker_one_live_table on fy.poker_table (league_id) where status <> 'closed';
-- A seat someone has picked but not yet confirmed: "HELD · name" on every screen. Short-lived; one per member.
create table if not exists fy.poker_hold (
  table_id uuid not null references fy.poker_table(id) on delete cascade,
  member_id uuid not null references fy.member(id),
  seat_no int not null check (seat_no between 1 and 10),
  expires_at timestamptz not null,
  primary key (table_id, member_id)
);

alter table fy.poker_table enable row level security;
alter table fy.poker_seat enable row level security;
alter table fy.poker_hold enable row level security;
grant select on fy.poker_table, fy.poker_seat, fy.poker_hold to authenticated;
drop policy if exists poker_hold_read on fy.poker_hold;
create policy poker_hold_read on fy.poker_hold for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists poker_table_read on fy.poker_table;
create policy poker_table_read on fy.poker_table for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists poker_seat_read on fy.poker_seat;
create policy poker_seat_read on fy.poker_seat for select to authenticated using (fy.is_member() or fy.is_leader());
-- No write policies: writes happen only inside the security-definer functions below.

-- Realtime: seats and table status fill in live. Full replica identity so DELETEs (leave seat) carry the row.
alter table fy.poker_table replica identity full;
alter table fy.poker_seat replica identity full;
alter table fy.poker_hold replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'fy' and tablename = 'poker_table') then
      alter publication supabase_realtime add table fy.poker_table;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'fy' and tablename = 'poker_seat') then
      alter publication supabase_realtime add table fy.poker_seat;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'fy' and tablename = 'poker_hold') then
      alter publication supabase_realtime add table fy.poker_hold;
    end if;
  end if;
end $$;

create or replace function fy._require_member() returns fy.member
language plpgsql stable security definer set search_path = fy, public as $$
declare m fy.member;
begin
  select * into m from fy.member where user_id = auth.uid();
  if m.id is null then raise exception 'sign in first' using errcode = '42501'; end if;
  return m;
end $$;

-- Any member opens a table. A table left over from more than 12 hours ago is closed first.
create or replace function fy.poker_start() returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_id uuid;
begin
  me := fy._require_member();
  update fy.poker_table set status = 'closed', closed_at = now()
  where league_id = me.league_id and status <> 'closed' and created_at < now() - interval '12 hours';
  begin
    insert into fy.poker_table (league_id, started_by) values (me.league_id, me.id) returning id into v_id;
  exception when unique_violation then
    raise exception 'a table is already open' using errcode = '23505';
  end;
  return v_id;
end $$;

create or replace function fy.poker_set_link(p_table uuid, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; v_url text := btrim(coalesce(p_url, ''));
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.started_by <> me.id and me.role <> 'leader' then raise exception 'not allowed' using errcode = '42501'; end if;
  if t.status = 'closed' then raise exception 'table is closed'; end if;
  -- The link is opened in members' browsers: only a real PokerNow game address gets through.
  if v_url !~ '^https://(www\.)?pokernow\.(com|club)/games/[A-Za-z0-9_-]+([/?#].*)?$' then
    raise exception 'that is not a PokerNow game link';
  end if;
  update fy.poker_table set pokernow_url = v_url, status = 'open' where id = p_table;
  -- Opening seats nobody: the initiator takes a seat through the TAKE THE SEAT card (poker_take_seat) like every member.
end $$;

-- Reserves the seat at once (so two members cannot take it); the client opens the returned link after its countdown.
create or replace function fy.poker_take_seat(p_table uuid, p_seat int, p_table_name text) returns text
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; v_name text := btrim(coalesce(p_table_name, ''));
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.status <> 'open' then raise exception 'table is not open'; end if;
  if p_seat is null or p_seat not between 1 and 10 then raise exception 'seats run 1 to 10'; end if;
  if char_length(v_name) not between 1 and 24 then raise exception 'table name must be 1 to 24 characters'; end if;
  if exists (select 1 from fy.poker_seat where table_id = p_table and member_id = me.id) then
    raise exception 'you already have a seat';
  end if;
  if exists (select 1 from fy.poker_seat where table_id = p_table and seat_no = p_seat) then
    raise exception 'that seat is taken';
  end if;
  if exists (select 1 from fy.poker_hold where table_id = p_table and seat_no = p_seat and member_id <> me.id and expires_at > now()) then
    raise exception 'that seat is held';
  end if;
  insert into fy.poker_seat (table_id, seat_no, member_id, table_name) values (p_table, p_seat, me.id, v_name);
  delete from fy.poker_hold where table_id = p_table and member_id = me.id;
  return t.pokernow_url;
end $$;

-- Picking a seat (opening the TAKE THE SEAT card) holds it for 45 seconds; picking another seat moves the hold.
create or replace function fy.poker_hold_seat(p_table uuid, p_seat int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table;
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.status <> 'open' then raise exception 'table is not open'; end if;
  if p_seat is null or p_seat not between 1 and 10 then raise exception 'seats run 1 to 10'; end if;
  if exists (select 1 from fy.poker_seat where table_id = p_table and member_id = me.id) then raise exception 'you already have a seat'; end if;
  if exists (select 1 from fy.poker_seat where table_id = p_table and seat_no = p_seat) then raise exception 'that seat is taken'; end if;
  if exists (select 1 from fy.poker_hold where table_id = p_table and seat_no = p_seat and member_id <> me.id and expires_at > now()) then
    raise exception 'that seat is held';
  end if;
  delete from fy.poker_hold where table_id = p_table and expires_at <= now();
  insert into fy.poker_hold (table_id, member_id, seat_no, expires_at) values (p_table, me.id, p_seat, now() + interval '45 seconds')
  on conflict (table_id, member_id) do update set seat_no = excluded.seat_no, expires_at = excluded.expires_at;
end $$;

create or replace function fy.poker_release_hold(p_table uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member;
begin
  me := fy._require_member();
  delete from fy.poker_hold where table_id = p_table and member_id = me.id;
end $$;

create or replace function fy.poker_leave_seat(p_table uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member;
begin
  me := fy._require_member();
  delete from fy.poker_seat where table_id = p_table and member_id = me.id;
end $$;

-- One game at a time, and any member may CLOSE it. If anyone sat down, the docket must be filed first
-- (the leader may still close an unfiled table to unstick a night).
create or replace function fy.poker_close(p_table uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; v_filed boolean;
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.status = 'closed' then return; end if;
  select exists (select 1 from fy.event e where e.id = t.event_id and e.voided_at is null) into v_filed;
  if not v_filed and me.role <> 'leader' and exists (select 1 from fy.poker_seat where table_id = p_table) then
    raise exception 'file the docket before closing the game';
  end if;
  -- Seat rows stay as the night's record; a closed table simply stops being the live one.
  update fy.poker_table set status = 'closed', closed_at = coalesce(closed_at, now()) where id = p_table;
  delete from fy.poker_hold where table_id = p_table;
end $$;

create or replace function fy.poker_file_docket(p_table uuid, p_players jsonb, p_winner uuid) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; v_event uuid; v_live boolean;
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.started_by <> me.id and me.role <> 'leader' then raise exception 'not allowed' using errcode = '42501'; end if;
  if t.status <> 'open' then raise exception 'table is not open'; end if;
  if t.event_id is not null then
    select voided_at is null into v_live from fy.event where id = t.event_id;
    if v_live then raise exception 'docket already filed'; end if;
  end if;
  if jsonb_typeof(p_players) <> 'array' then raise exception 'need at least two players'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) x
    where not exists (select 1 from fy.poker_seat s where s.table_id = p_table and s.member_id::text = x->>'member_id')
  ) then raise exception 'every player must be seated at this table'; end if;
  v_event := fy._record_poker_result(me.id, p_players, p_winner, now(), 'poker night');
  update fy.poker_table set event_id = v_event where id = p_table;
  return v_event;
end $$;

-- Filer or leader, within 15 minutes of filing. Edit = undo + file again.
create or replace function fy.poker_undo_docket(p_table uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; e fy.event;
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.event_id is null then raise exception 'no docket filed'; end if;
  select * into e from fy.event where id = t.event_id;
  if e.entered_by is distinct from me.id and me.role <> 'leader' then raise exception 'not allowed' using errcode = '42501'; end if;
  if e.voided_at is null then
    if e.created_at < now() - interval '15 minutes' then raise exception 'the 15 minutes to change this docket are up'; end if;
    perform fy._void_event(e.id, 'docket undone');
  end if;
  update fy.poker_table set event_id = null where id = p_table;
end $$;

-- The live table and its seats, or null. Joined here so the page needs one call (and one refetch per Realtime ping).
create or replace function fy.poker_current() returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare t fy.poker_table;
begin
  if not (fy.is_member() or fy.is_leader()) then return null; end if;
  select * into t from fy.poker_table
  where league_id = fy._league() and status <> 'closed' and created_at > now() - interval '12 hours'
  order by created_at desc limit 1;
  if t.id is null then return null; end if;
  return jsonb_build_object(
    'id', t.id, 'status', t.status, 'started_by', t.started_by, 'pokernow_url', t.pokernow_url,
    'event_id', t.event_id, 'created_at', t.created_at,
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('seat_no', s.seat_no, 'member_id', s.member_id, 'table_name', s.table_name,
                                          'nickname', m.nickname, 'avatar', m.avatar, 'avatar_url', m.avatar_url) order by s.seat_no)
      from fy.poker_seat s join fy.member m on m.id = s.member_id where s.table_id = t.id), '[]'::jsonb),
    'holds', coalesce((
      select jsonb_agg(jsonb_build_object('seat_no', h.seat_no, 'member_id', h.member_id, 'nickname', m.nickname, 'expires_at', h.expires_at) order by h.seat_no)
      from fy.poker_hold h join fy.member m on m.id = h.member_id where h.table_id = t.id and h.expires_at > now()), '[]'::jsonb));
end $$;

-- League ranking for a season window. p_skip drops one event (to rank "before the latest night").
-- Units are buy-ins; the client multiplies by the £ per buy-in.
create or replace function fy._poker_ranking(p_from timestamptz, p_to timestamptz, p_skip uuid)
returns table (member_id uuid, played int, won int, buyins int, points int, net int, rank int)
language sql stable security definer set search_path = fy, public as $$
  with nights as (
    select e.id, sc.member_id as winner, sc.points as pot,
           coalesce((select sum(i.amount) from fy.iou i where i.event_id = e.id), 0)::int as paid_in
    from fy.event e
    join fy.score_entry sc on sc.event_id = e.id and sc.reason = 'result'
    where e.league_id = fy._league() and e.type_key = 'poker' and e.voided_at is null
      and e.played_at >= p_from and e.played_at < p_to and e.id is distinct from p_skip
  ), lines as (
    select i.payer_id as mid, i.amount as bi, false as w, -i.amount as nt, 0 as pts
    from nights n join fy.iou i on i.event_id = n.id
    union all
    select n.winner, n.pot - n.paid_in, true, n.paid_in, n.pot from nights n
  ), agg as (
    select l.mid, count(*)::int as g_played, (count(*) filter (where l.w))::int as g_won,
           sum(l.bi)::int as g_buyins, sum(l.pts)::int as g_points, sum(l.nt)::int as g_net
    from lines l group by l.mid
  )
  select a.mid, a.g_played, a.g_won, a.g_buyins, a.g_points, a.g_net,
         (row_number() over (order by case when a.g_won > 0 then a.g_buyins::numeric / a.g_won end asc nulls last,
                                      a.g_won desc, a.g_buyins asc, a.g_net desc, m.nickname))::int
  from agg a join fy.member m on m.id = a.mid;
$$;

-- Poker League Board, plus the caller's fileable dockets from the last 15 minutes (for Edit / Undo).
-- The season window defaults to Season 1, Oct to Dec 2026 (hard-coded for now; tests pass their own).
create or replace function fy.poker_board(p_from timestamptz default '2026-10-01', p_to timestamptz default '2027-01-01') returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare me fy.member; v_from timestamptz := p_from; v_to timestamptz := p_to;
        v_latest uuid; v_games int; v_rows jsonb; v_recent jsonb;
begin
  if not (fy.is_member() or fy.is_leader()) then return null; end if;
  select * into me from fy.member where user_id = auth.uid();
  select e.id into v_latest from fy.event e
  join fy.score_entry sc on sc.event_id = e.id and sc.reason = 'result'
  where e.league_id = fy._league() and e.type_key = 'poker' and e.voided_at is null and e.played_at >= v_from and e.played_at < v_to
  order by e.played_at desc, e.created_at desc limit 1;
  select count(*)::int into v_games from fy.event e
  join fy.score_entry sc on sc.event_id = e.id and sc.reason = 'result'
  where e.league_id = fy._league() and e.type_key = 'poker' and e.voided_at is null and e.played_at >= v_from and e.played_at < v_to;

  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', r.member_id, 'nickname', m.nickname, 'avatar', m.avatar, 'played', r.played, 'won', r.won,
           'buyins', r.buyins, 'points', r.points, 'net', r.net, 'rank', r.rank, 'prev_rank', p.rank) order by r.rank), '[]'::jsonb)
  into v_rows
  from fy._poker_ranking(v_from, v_to, null) r
  join fy.member m on m.id = r.member_id
  left join fy._poker_ranking(v_from, v_to, v_latest) p on p.member_id = r.member_id;

  select coalesce(jsonb_agg(q.x order by q.x->>'filed_at' desc), '[]'::jsonb) into v_recent from (
    select jsonb_build_object(
      'event_id', e.id, 'table_id', pt.id, 'filed_at', e.created_at,
      'left_secs', floor(extract(epoch from e.created_at + interval '15 minutes' - now()))::int,
      'winner_id', sc.member_id, 'winner', wm.nickname,
      'others', coalesce((select string_agg(m2.nickname, ', ' order by m2.nickname)
                          from fy.iou i join fy.member m2 on m2.id = i.payer_id where i.event_id = e.id), ''),
      'picks', (select jsonb_object_agg(l.mid, l.bi) from (
                  select i.payer_id as mid, i.amount as bi from fy.iou i where i.event_id = e.id
                  union all
                  select sc.member_id, sc.points - coalesce((select sum(i.amount) from fy.iou i where i.event_id = e.id), 0)::int) l)
    ) as x
    from fy.event e
    join fy.poker_table pt on pt.event_id = e.id
    join fy.score_entry sc on sc.event_id = e.id and sc.reason = 'result'
    join fy.member wm on wm.id = sc.member_id
    where e.voided_at is null and e.created_at > now() - interval '15 minutes'
      and (e.entered_by = me.id or me.role = 'leader')
  ) q;

  return jsonb_build_object('games', v_games,
    'buyins', coalesce((select sum((x->>'buyins')::int) from jsonb_array_elements(v_rows) x), 0),
    'rows', v_rows, 'recent', v_recent);
end $$;

-- Who owes whom across the league, from live poker IOUs (amounts in buy-ins). With badges switched off
-- a member sees only their own debts; the leader always sees all.
create or replace function fy.poker_debts() returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare me fy.member; v_public boolean;
begin
  if not (fy.is_member() or fy.is_leader()) then return null; end if;
  select * into me from fy.member where user_id = auth.uid();
  select public_badges into v_public from fy.league where id = fy._league();
  return coalesce((
    select jsonb_agg(z.d order by (z.d->>'total')::int desc, z.d->>'nickname') from (
      select jsonb_build_object('payer_id', g.payer_id, 'nickname', pm.nickname, 'total', sum(g.amt)::int,
               'to', jsonb_agg(jsonb_build_object('payee_id', g.payee_id, 'nickname', qm.nickname, 'amount', g.amt) order by qm.nickname)) as d
      from (
        select i.payer_id, i.payee_id, sum(i.amount)::int as amt
        from fy.v_live_iou i
        join fy.event e on e.id = i.event_id and e.type_key = 'poker'
        where i.league_id = fy._league() and (v_public or me.role = 'leader' or i.payer_id = me.id)
        group by i.payer_id, i.payee_id
      ) g
      join fy.member pm on pm.id = g.payer_id
      join fy.member qm on qm.id = g.payee_id
      group by g.payer_id, pm.nickname
    ) z), '[]'::jsonb);
end $$;

-- Poker Room feeds. Rows are written by the poker-feeds Edge Function (service role, daily); members read them.
-- Scandal Sheet: five controversy / bad-behaviour stories, each with the article's own og:image (hotlinked).
create table if not exists fy.poker_news (
  league_id uuid not null references fy.league(id),
  rank int not null check (rank between 1 and 5),
  title text not null,
  note text,
  about text,
  source text not null,
  url text not null check (url ~ '^https://[^\s"''<>()]+$'),
  image_url text check (image_url is null or image_url ~ '^https://[^\s"''<>()]+$'),
  published_on date,
  fetched_at timestamptz not null default now(),
  primary key (league_id, rank)
);
-- Poker School: five YouTube videos of five minutes or less, ranked by views.
create table if not exists fy.poker_video (
  league_id uuid not null references fy.league(id),
  rank int not null check (rank between 1 and 5),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel text,
  tag text,
  duration_secs int check (duration_secs is null or duration_secs between 1 and 300),
  views bigint,
  fetched_at timestamptz not null default now(),
  primary key (league_id, rank)
);
alter table fy.poker_news enable row level security;
alter table fy.poker_video enable row level security;
grant select on fy.poker_news, fy.poker_video to authenticated;
drop policy if exists poker_news_read on fy.poker_news;
create policy poker_news_read on fy.poker_news for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists poker_video_read on fy.poker_video;
create policy poker_video_read on fy.poker_video for select to authenticated using (fy.is_member() or fy.is_leader());

-- Day-one content (from the 11 Oct design) so the modules are never empty. The function overwrites it.
insert into fy.poker_news (league_id, rank, title, note, about, source, url, image_url, published_on)
select fy._league(), v.* from (values
  (1, 'Superuser scandal: hacked poker tools let a cheat see high-stakes hole cards', 'Jurojin, one of two compromised apps, apologises and explains how its updates were tampered with.', 'Jurojin & IntuitiveTables · high-stakes online', 'PokerNews', 'https://www.pokernews.com/news/2026/10/jurojin-speaks-after-superuser-scandal-52575.htm', null::text, date '2026-10-09'),
  (2, 'Paul Gregg accused of using malware to read opponents'' cards', 'CoinPoker says it banned the account and confiscated over $100k. Nothing has been proven.', 'Paul Gregg · CoinPoker', 'Card Player', 'https://www.cardplayer.com/poker-news/1755297-canadian-high-stakes-online-poker-player-accused-of-cheating', null, date '2026-10-04'),
  (3, 'Poker sites were warned about the suspect account, reports say', 'Two sites had been alerted before the scandal went public, according to new reporting.', 'Superuser scandal · online sites', 'PokerNews', 'https://www.pokernews.com/news/2026/10/poker-sites-warned-about-superuser-account-52532.htm', null, date '2026-10-02'),
  (4, 'ACR boss Phil Nagy responds, launches "Screen Shield"', 'New feature hides tables from screen-capture tools like those used in the attack.', 'Phil Nagy · ACR Poker / WPN', 'Poker.org', 'https://www.poker.org/latest-news/acr-poker-ceo-issues-statement-on-cheating-scandal-unveils-screen-shield-a83tR4U7T3p2/', null, date '2026-10-02'),
  (5, 'Ren Lin made WPT Global ambassador after RTA ghosting case', 'Chip Race hosts Dara O''Kearney and David Lappin quit their WPT Global roles in protest.', 'Ren Lin · WPT Global', 'VIP Grinders', 'https://www.vip-grinders.com/news/top-poker-cheating-scandals/', null, date '2026-01-15')
) as v(rank, title, note, about, source, url, image_url, published_on)
on conflict (league_id, rank) do nothing;
insert into fy.poker_video (league_id, rank, youtube_id, title, channel, tag)
select fy._league(), v.* from (values
  (1, '8Tj7jJyOiU0', 'The Most Controversial Poker Hand I''ve Ever Seen!', 'APT High Roller · dealer mistake', 'Controversial'),
  (2, 'LcSksyrTQzU', '6 Intermediate Poker Leaks (+ Fixes!)', '', 'Intermediate'),
  (3, 'GMGwQMQCAu0', 'The Craziest Poker Hand Ever????', 'Rob Yong vs Ryan Feldman', 'Crazy hand'),
  (4, '3JfDDf3hOK8', '8 Advanced Poker Tips for Preflop', '', 'Intermediate'),
  (5, 'hs8xW-c0bgA', 'Most Hilarious Poker Hands · EPT Monte Carlo 2019', 'PokerStars', 'Funny')
) as v(rank, youtube_id, title, channel, tag)
on conflict (league_id, rank) do nothing;

create or replace function fy.poker_feeds() returns jsonb
language sql stable security definer set search_path = fy, public as $$
  select case when fy.is_member() or fy.is_leader() then jsonb_build_object(
    'news', coalesce((select jsonb_agg(to_jsonb(n) - 'league_id' order by n.rank) from fy.poker_news n where n.league_id = fy._league()), '[]'::jsonb),
    'videos', coalesce((select jsonb_agg(to_jsonb(v) - 'league_id' order by v.rank) from fy.poker_video v where v.league_id = fy._league()), '[]'::jsonb))
  end;
$$;

grant execute on function fy.poker_start, fy.poker_set_link, fy.poker_take_seat, fy.poker_hold_seat, fy.poker_release_hold, fy.poker_leave_seat, fy.poker_close,
  fy.poker_file_docket, fy.poker_undo_docket, fy.poker_current, fy.poker_board, fy.poker_debts, fy.poker_feeds to authenticated;
-- Internals: callable only from the security-definer wrappers above.
revoke all on function fy._record_poker_result, fy._void_event, fy._poker_ranking, fy._require_member from public;

-- 6. The Humidor -------------------------------------------------------------
-- The members' cigar club. A round: members send their taste (collecting) -> the leader posts three
-- options (ranking) -> members rank them 3/2/1 -> the leader closes the ranking (paying) -> members pay
-- their share -> the leader places the order (closed, and the round moves to the archive).
-- Contract: handoff/2026-10-24-humidor (README + design/humidor-club.js). Pages poll humidor_current()
-- every 5 s, so there is no Realtime publication and no table grants: reads go through the two read RPCs.

-- Landing-page stage pin, league-wide: null follows the round, otherwise card 0-4. Survives new rounds.
alter table fy.league add column if not exists humidor_stage smallint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_humidor_stage_check' and conrelid = 'fy.league'::regclass) then
    alter table fy.league add constraint league_humidor_stage_check check (humidor_stage between 0 and 4);
  end if;
end $$;

create table if not exists fy.humidor_round (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  n int not null,                                   -- round number, per league
  status text not null default 'collecting' check (status in ('collecting','ranking','paying','closed')),
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
                                                    -- [{name,size,price,shop,url,note,img,origin,wrapper,strength,notes}] x3
  winner int,                                       -- index into options
  share_gbp numeric(6,2),
  revolut_url text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
-- One open round per league.
create unique index if not exists humidor_round_one_open on fy.humidor_round (league_id) where status <> 'closed';
-- A member's taste for the round ("votes" in the prototype).
create table if not exists fy.humidor_pref (
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  prefs jsonb not null,   -- {size,time,strength,wr:[from,to],flavour:[],origin,budget,sizePrefs:{minR,maxR,maxT,shape}}
  at timestamptz not null default now(),
  primary key (round_id, member_id)
);
create table if not exists fy.humidor_ballot (
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  rank int[] not null,    -- option indexes, best first
  at timestamptz not null default now(),
  primary key (round_id, member_id)
);
-- Member says sent (pending), leader confirms. No row = not paid, so not in the order.
create table if not exists fy.humidor_pay (
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  state text not null check (state in ('pending','confirmed')),
  at timestamptz not null default now(),
  primary key (round_id, member_id)
);

alter table fy.humidor_round enable row level security;
alter table fy.humidor_pref enable row level security;
alter table fy.humidor_ballot enable row level security;
alter table fy.humidor_pay enable row level security;
-- No grants and no policies: nobody reads or writes these tables directly.
revoke all on fy.humidor_round, fy.humidor_pref, fy.humidor_ballot, fy.humidor_pay from anon, authenticated;

-- Internal: the first price in a free-text price ("£12.50", "10-15", "£ 9"), or null ("ask").
create or replace function fy._gbp(p text) returns numeric
language sql immutable set search_path = fy, public as $$
  select substring(btrim(p) from '^£?\s*(\d+(?:\.\d{1,2})?)')::numeric;
$$;

-- Internal: the league's open round, locked, if its status is one the caller allows; otherwise "not now".
create or replace function fy._humidor_round(p_league uuid, p_need text[]) returns fy.humidor_round
language plpgsql security definer set search_path = fy, public as $$
declare r fy.humidor_round;
begin
  select * into r from fy.humidor_round where league_id = p_league and status <> 'closed' for update;
  if r.id is null or not (r.status = any (p_need)) then
    raise exception 'not now' using errcode = '55000';
  end if;
  return r;
end $$;

-- Internal: points per option for a round. 1st = 3, 2nd = 2, 3rd = 1; firsts counts the 1st places.
-- Every option index appears, with 0 when nobody ranked it.
create or replace function fy._humidor_points(p_round uuid)
returns table (opt int, pts int, firsts int)
language sql stable security definer set search_path = fy, public as $$
  select g.i, coalesce(s.p, 0), coalesce(s.f, 0)
  from fy.humidor_round r
  cross join lateral generate_series(0, jsonb_array_length(r.options) - 1) g(i)
  left join (
    select e.o, sum(4 - e.pos)::int as p, (count(*) filter (where e.pos = 1))::int as f
    from fy.humidor_ballot b
    cross join lateral unnest(b.rank) with ordinality e(o, pos)
    where b.round_id = p_round
    group by e.o
  ) s on s.o = g.i
  where r.id = p_round;
$$;

-- Leader: open the next round. Its number is the league's highest so far plus one.
create or replace function fy.humidor_open_round() returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_id uuid;
begin
  me := fy._require_leader();
  begin
    insert into fy.humidor_round (league_id, n)
    select me.league_id, coalesce(max(n), 0) + 1 from fy.humidor_round where league_id = me.league_id
    returning id into v_id;
  exception when unique_violation then
    raise exception 'a round is already open' using errcode = '23505';
  end;
  return v_id;
end $$;

-- Member: send or replace my taste for the round. Only while collecting.
create or replace function fy.humidor_submit_prefs(p_prefs jsonb) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_member();
  r := fy._humidor_round(me.league_id, array['collecting']);
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' or octet_length(p_prefs::text) >= 4096 then
    raise exception 'your taste must be a JSON object under 4 KB' using errcode = '22023';
  end if;
  insert into fy.humidor_pref (round_id, member_id, prefs) values (r.id, me.id, p_prefs)
  on conflict (round_id, member_id) do update set prefs = excluded.prefs, at = now();
end $$;

-- Leader: post the three options. Moves the round to ranking and clears its ballots (they ranked other options).
-- Names and notes are stored as given (the pages escape them); url and img end up in href / src, so they
-- must be empty or https with no quotes, brackets or spaces.
create or replace function fy.humidor_post_options(p_options jsonb) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['collecting', 'ranking']);
  if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) <> 3 then
    raise exception 'post exactly three options' using errcode = '22023';
  end if;
  if octet_length(p_options::text) >= 16384 then
    raise exception 'the three options must be under 16 KB' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_options) x
             where jsonb_typeof(x) <> 'object' or coalesce(btrim(x->>'name'), '') = '') then
    raise exception 'every option needs a name' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_options) x
             where coalesce(x->>'url', '') !~ '^(https://[^\s"''<>()]+)?$'
                or coalesce(x->>'img', '') !~ '^(https://[^\s"''<>()]+)?$') then
    raise exception 'links and photos must be https addresses' using errcode = '22023';
  end if;
  update fy.humidor_round set options = p_options, status = 'ranking', winner = null where id = r.id;
  delete from fy.humidor_ballot where round_id = r.id;
end $$;

-- Leader: back from ranking to collecting (to take more tastes before posting again).
create or replace function fy.humidor_reopen_collect() returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['ranking']);
  update fy.humidor_round set status = 'collecting' where id = r.id;
end $$;

-- Member who sent a taste this round: rank the options, best first, as a permutation of 0..n-1. Editable until closed.
create or replace function fy.humidor_cast_ranking(p_rank int[]) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round; v_n int;
begin
  me := fy._require_member();
  r := fy._humidor_round(me.league_id, array['ranking']);
  if not exists (select 1 from fy.humidor_pref where round_id = r.id and member_id = me.id) then
    raise exception 'only members who sent their taste this round can rank' using errcode = '42501';
  end if;
  v_n := jsonb_array_length(r.options);
  if p_rank is null or array_ndims(p_rank) is distinct from 1 or cardinality(p_rank) <> v_n
     or (select array_agg(x order by x) from unnest(p_rank) x)
        is distinct from (select array_agg(i order by i) from generate_series(0, v_n - 1) i) then
    raise exception 'rank each option exactly once' using errcode = '22023';
  end if;
  insert into fy.humidor_ballot (round_id, member_id, rank) values (r.id, me.id, p_rank)
  on conflict (round_id, member_id) do update set rank = excluded.rank, at = now();
end $$;

-- Leader: close the ranking. Winner = most points, then most firsts, then the lowest option index
-- (as leader() in humidor-club.js). The share defaults to the winner's price. Returns the winner.
create or replace function fy.humidor_close_ranking() returns int
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round; v_win int; v_share numeric;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['ranking']);
  select p.opt into v_win from fy._humidor_points(r.id) p order by p.pts desc, p.firsts desc, p.opt asc limit 1;
  v_share := fy._gbp(r.options -> v_win ->> 'price');
  if v_share >= 10000 then v_share := null; end if;   -- does not fit numeric(6,2): the leader sets it by hand
  update fy.humidor_round set winner = v_win, share_gbp = v_share, status = 'paying' where id = r.id;
  return v_win;
end $$;

-- Leader: the share per member and the Revolut link members pay to. Null clears either.
create or replace function fy.humidor_set_pay(p_share numeric, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['paying']);
  if p_share is not null and round(p_share, 2) not between 0 and 9999.99 then
    raise exception 'the share must be £0 to £9999.99' using errcode = '22023';
  end if;
  if p_url is not null and p_url !~ '^https://revolut\.me/[A-Za-z0-9._-]+$' then
    raise exception 'that is not a revolut.me link' using errcode = '22023';
  end if;
  update fy.humidor_round set share_gbp = round(p_share, 2), revolut_url = p_url where id = r.id;
end $$;

-- Member who sent a taste this round: "I've paid". Pending until the leader confirms; never undoes a confirmation.
create or replace function fy.humidor_mark_paid() returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_member();
  r := fy._humidor_round(me.league_id, array['paying']);
  if not exists (select 1 from fy.humidor_pref where round_id = r.id and member_id = me.id) then
    raise exception 'only members who sent their taste this round can pay in' using errcode = '42501';
  end if;
  insert into fy.humidor_pay (round_id, member_id, state) values (r.id, me.id, 'pending')
  on conflict (round_id, member_id) do nothing;
end $$;

-- Leader: the money landed (true) or it did not (false: the member is back to not paid).
create or replace function fy.humidor_confirm_paid(p_member uuid, p_on boolean) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['paying']);
  if p_on is null then raise exception 'say true or false' using errcode = '22023'; end if;
  if p_on then
    if not exists (select 1 from fy.member where id = p_member and league_id = me.league_id) then
      raise exception 'unknown member' using errcode = 'P0002';
    end if;
    insert into fy.humidor_pay (round_id, member_id, state) values (r.id, p_member, 'confirmed')
    on conflict (round_id, member_id) do update set state = 'confirmed', at = now();
  else
    delete from fy.humidor_pay where round_id = r.id and member_id = p_member;
  end if;
end $$;

-- Leader: order placed. The round closes and moves to the archive; unpaid voters are simply not in it.
create or replace function fy.humidor_place_order() returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  me := fy._require_leader();
  r := fy._humidor_round(me.league_id, array['paying']);
  update fy.humidor_round set status = 'closed', closed_at = now() where id = r.id;
end $$;

-- Leader: pin the landing page's "How a round works" card (0-4), or null to follow the round. Any time.
create or replace function fy.humidor_set_stage(p_stage int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member;
begin
  me := fy._require_leader();
  if p_stage is not null and p_stage not between 0 and 4 then
    raise exception 'the stage runs 0 to 4' using errcode = '22023';
  end if;
  update fy.league set humidor_stage = p_stage where id = me.league_id;
end $$;

-- Members: { stage, round }. stage = the league pin (null = follow the round); round = the open round
-- with everyone's prefs, ballots and pays, or null. Null for anyone without a profile.
create or replace function fy.humidor_current() returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare me fy.member; r fy.humidor_round;
begin
  select * into me from fy.member where user_id = auth.uid();
  if me.id is null then return null; end if;
  select * into r from fy.humidor_round where league_id = me.league_id and status <> 'closed' limit 1;
  return jsonb_build_object(
    'stage', (select l.humidor_stage from fy.league l where l.id = me.league_id),
    'round', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'n', r.n, 'status', r.status, 'options', r.options, 'winner', r.winner,
      'share_gbp', r.share_gbp, 'revolut_url', r.revolut_url, 'opened_at', r.opened_at,
      'prefs', coalesce((
        select jsonb_agg(jsonb_build_object('member_id', p.member_id, 'nickname', m.nickname, 'avatar', m.avatar,
                                            'avatar_url', m.avatar_url, 'prefs', p.prefs, 'at', p.at) order by p.at)
        from fy.humidor_pref p join fy.member m on m.id = p.member_id where p.round_id = r.id), '[]'::jsonb),
      'ballots', coalesce((
        select jsonb_agg(jsonb_build_object('member_id', b.member_id, 'nickname', m.nickname, 'avatar', m.avatar,
                                            'avatar_url', m.avatar_url, 'rank', to_jsonb(b.rank), 'at', b.at) order by b.at)
        from fy.humidor_ballot b join fy.member m on m.id = b.member_id where b.round_id = r.id), '[]'::jsonb),
      'pays', coalesce((
        select jsonb_agg(jsonb_build_object('member_id', y.member_id, 'nickname', m.nickname, 'avatar', m.avatar,
                                            'avatar_url', m.avatar_url, 'state', y.state, 'at', y.at) order by y.at)
        from fy.humidor_pay y join fy.member m on m.id = y.member_id where y.round_id = r.id), '[]'::jsonb)
    ) end);
end $$;

-- Members: closed rounds, newest first, with the final points per option. Null for anyone without a profile.
create or replace function fy.humidor_archive() returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare me fy.member;
begin
  select * into me from fy.member where user_id = auth.uid();
  if me.id is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'n', r.n, 'closed_at', r.closed_at, 'options', r.options, 'winner', r.winner,
             'voters', (select count(*) from fy.humidor_pref p where p.round_id = r.id),
             'points', (select coalesce(jsonb_agg(x.pts order by x.opt), '[]'::jsonb) from fy._humidor_points(r.id) x)
           ) order by r.closed_at desc, r.n desc)
    from fy.humidor_round r where r.league_id = me.league_id and r.status = 'closed'), '[]'::jsonb);
end $$;

grant execute on function fy.humidor_open_round, fy.humidor_submit_prefs, fy.humidor_post_options, fy.humidor_reopen_collect,
  fy.humidor_cast_ranking, fy.humidor_close_ranking, fy.humidor_set_pay, fy.humidor_mark_paid, fy.humidor_confirm_paid,
  fy.humidor_place_order, fy.humidor_set_stage, fy.humidor_current, fy.humidor_archive to authenticated;
-- Internals: callable only from the security-definer functions above.
revoke all on function fy._gbp, fy._humidor_round, fy._humidor_points from public;
