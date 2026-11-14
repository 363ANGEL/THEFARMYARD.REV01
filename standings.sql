-- standings.sql — idempotent. Run after yard.sql (uses fy.yards) and any time after; safe to run twice.
-- The data behind the dashboard's "Farmyard current standings" table:
--   1. fy.standing_snapshot: league positions as they stood just BEFORE each event was filed, so the
--      table can say whether someone moved up, down or stayed put "since the last docket".
--   2. A BEFORE INSERT trigger on fy.event takes that snapshot. Every route that files an event
--      (_record_poker_result, decide_claim) goes through an insert, so no RPC body is touched.
--   3. fy.yard_standings(): one jsonb for the whole table, read by any member.
-- Positions are a rank() over fy.v_standings, so tied members share a number (1, 1, 3).
-- A league with no live (unvoided) event yet has no positions at all: nobody has played, so nobody is "1st".

create table if not exists fy.standing_snapshot (
  id bigserial primary key,
  yard_id int not null default 1 references fy.yards(id),
  type_key text not null,
  member_id uuid not null references fy.member(id) on delete cascade,
  pos int not null,
  taken_at timestamptz not null default clock_timestamp()
);
create index if not exists standing_snapshot_type_taken_idx on fy.standing_snapshot (type_key, taken_at desc);
create index if not exists standing_snapshot_yard_id_idx on fy.standing_snapshot (yard_id);

-- Read through the function below; the table itself is for leaders only (same as fy.admin_edit).
alter table fy.standing_snapshot enable row level security;
drop policy if exists standing_snapshot_leader on fy.standing_snapshot;
create policy standing_snapshot_leader on fy.standing_snapshot for select to authenticated using (fy.is_leader());
grant select on fy.standing_snapshot to authenticated;

-- Current position of every member in one league type. No rows until that type has a live event.
create or replace function fy._standing_positions(p_league uuid, p_type text)
returns table (member_id uuid, pos int)
language sql stable security definer set search_path = fy, public as $$
  select s.member_id, (rank() over (order by s.points desc))::int
    from fy.v_standings s
   where s.league_id = p_league and s.type_key = p_type
     and exists (select 1 from fy.event e
                  where e.league_id = p_league and e.type_key = p_type and e.voided_at is null);
$$;

-- Writes the snapshot for one league type; returns how many rows. Called by the trigger, not by the page.
create or replace function fy.take_standing_snapshot(p_league uuid, p_type text, p_yard int default 1)
returns int
language plpgsql security definer set search_path = fy, public as $$
declare n int; at timestamptz := clock_timestamp();  -- one timestamp per snapshot, so "latest" picks the whole set
begin
  insert into fy.standing_snapshot (yard_id, type_key, member_id, pos, taken_at)
  select p_yard, p_type, p.member_id, p.pos, at
    from fy._standing_positions(p_league, p_type) p;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function fy.take_standing_snapshot(uuid, text, int) from public, anon, authenticated;

create or replace function fy._event_snapshot() returns trigger
language plpgsql security definer set search_path = fy, public as $$
begin
  perform fy.take_standing_snapshot(new.league_id, new.type_key, new.yard_id);
  return new;
end $$;
revoke all on function fy._event_snapshot() from public, anon, authenticated;

drop trigger if exists event_snapshot on fy.event;
create trigger event_snapshot before insert on fy.event
  for each row execute function fy._event_snapshot();

-- Everything the standings table needs, in one call:
--   { leagues: [{key, label}],                      -- one column each, poker first, then by weight and name
--     members: [{ id, nickname, avatar, avatar_url,
--                 net,                              -- live IOU standing in tk: + owed to them, - they owe (poker x5)
--                 change,                           -- net of IOUs created in the last 7 days
--                 pos: { <key>: { pos, move } } }] } -- move: up | down | flat against the latest snapshot
-- When the league hides badges (fy.league.public_badges false), net and change are null for non-leaders.
create or replace function fy.yard_standings() returns jsonb
language plpgsql stable security definer set search_path = fy, public as $$
declare me fy.member; lg uuid; show_money boolean;
begin
  me := fy._require_member();
  lg := me.league_id;
  select (l.public_badges or me.role = 'leader') into show_money from fy.league l where l.id = lg;
  return (
    with mem as (
      select id, nickname, avatar, avatar_url from fy.member where league_id = lg
    ), cur as (
      select t.key as tk, p.member_id, p.pos
        from fy.event_type t cross join lateral fy._standing_positions(lg, t.key) p
       where t.league_id = lg
    ), snap as (
      select ss.type_key as tk, ss.member_id, ss.pos
        from fy.standing_snapshot ss
       where ss.taken_at = (select max(x.taken_at) from fy.standing_snapshot x where x.type_key = ss.type_key)
    ), ious as (
      select i.payer_id, i.payee_id, i.state, i.created_at,
             i.amount * case when e.type_key = 'poker' then 5 else 1 end as tk
        from fy.iou i left join fy.event e on e.id = i.event_id
       where i.league_id = lg
    )
    select jsonb_build_object(
      'leagues', coalesce((
        select jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label)
                         order by t.overall_weight desc, (t.key <> 'poker'), t.label)
          from fy.event_type t where t.league_id = lg), '[]'::jsonb),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'nickname', m.nickname, 'avatar', m.avatar, 'avatar_url', m.avatar_url,
                 'net', case when show_money then (
                          select coalesce(sum(case when v.payee_id = m.id then v.tk else -v.tk end), 0)
                            from ious v where v.state in ('open', 'marked_paid', 'disputed')
                             and (v.payee_id = m.id or v.payer_id = m.id)) end,
                 'change', case when show_money then (
                          select coalesce(sum(case when v.payee_id = m.id then v.tk else -v.tk end), 0)
                            from ious v where v.created_at > now() - interval '7 days'
                             and (v.payee_id = m.id or v.payer_id = m.id)) end,
                 'pos', coalesce((
                          select jsonb_object_agg(c.tk, jsonb_build_object('pos', c.pos, 'move',
                                   case when s.pos is null then 'flat'
                                        when c.pos < s.pos then 'up'
                                        when c.pos > s.pos then 'down' else 'flat' end))
                            from cur c left join snap s on s.tk = c.tk and s.member_id = c.member_id
                           where c.member_id = m.id), '{}'::jsonb)
               ) order by m.nickname)
          from mem m), '[]'::jsonb)
    )
  );
end $$;
grant execute on function fy.yard_standings() to authenticated;

notify pgrst, 'reload schema';
