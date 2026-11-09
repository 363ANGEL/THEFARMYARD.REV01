-- yard.sql — multi-yard, Stage 1 (schema). NOT run, NOT committed. Run once in the Supabase SQL editor; idempotent.
-- Run roles.sql FIRST (this file redefines fy.create_member with the p_role argument roles.sql introduced).
-- Adds only: fy.yards, a yard_id column + index on every per-group table, fy.my_yard(), and yard-aware Add member / claim-link
-- RPCs. Nothing is renamed or dropped. Every existing row ends up in yard 1 (The Farmyard) through the column default.
-- Note: fy.league (uuid, one row 'farmyard') already exists and is untouched; fy.yards is the new int-keyed tenant table.

-- 1. The yards table.
create table if not exists fy.yards (
  id int primary key,
  name text not null,
  created_at timestamptz default now()
);
insert into fy.yards (id, name) values (1, 'The Farmyard') on conflict (id) do nothing;
alter table fy.yards enable row level security;
grant select on fy.yards to authenticated;
drop policy if exists yards_read on fy.yards;
create policy yards_read on fy.yards for select to authenticated using (true);

-- 2. yard_id on every table that holds per-group data (skips any table not present in this database).
--    `add column ... not null default 1` fills every existing row with 1 (the backfill) and every new row until Stage 2.
do $$
declare t text; k "char";
begin
  foreach t in array array[
    'league', 'member', 'member_logo', 'member_link', 'claim_link', 'claim',
    'event_type', 'event', 'score_entry', 'settlement', 'iou', 'group_event', 'admin_edit',
    'poker_table', 'poker_seat', 'poker_hold', 'poker_news', 'poker_video',
    'humidor_round', 'humidor_option', 'humidor_pref', 'humidor_ballot', 'humidor_pay',
    'room', 'post', 'post_like', 'suggestion', 'pool', 'pool_call', 'icon_palette'
  ] loop
    select c.relkind into k from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'fy' and c.relname = t;
    if k is null then
      raise notice 'yard.sql: fy.% not found, skipped', t;
      continue;
    elsif k not in ('r', 'p') then          -- views (e.g. humidor_pay) take yard_id from their base table, see step 2b
      raise notice 'yard.sql: fy.% is a view (relkind %), skipped', t, k;
      continue;
    end if;
    execute format('alter table fy.%I add column if not exists yard_id int not null default 1', t);
    if not exists (select 1 from pg_constraint where conrelid = ('fy.' || t)::regclass and conname = t || '_yard_id_fkey') then
      execute format('alter table fy.%I add constraint %I foreign key (yard_id) references fy.yards(id)', t, t || '_yard_id_fkey');
    end if;
    execute format('create index if not exists %I on fy.%I (yard_id)', t || '_yard_id_idx', t);
    raise notice 'yard.sql: fy.% done', t;
  end loop;
end $$;

-- 2b. fy.humidor_pay is a view over the round's iou rows (humidor.sql). The rows already carry yard_id through fy.iou (step 2);
--     expose it as the view's last column (create or replace view may only append columns). Same body as humidor.sql.
do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'fy' and c.relname = 'humidor_pay' and c.relkind = 'v')
     and exists (select 1 from information_schema.columns where table_schema = 'fy' and table_name = 'iou' and column_name = 'yard_id')
     and not exists (select 1 from information_schema.columns where table_schema = 'fy' and table_name = 'humidor_pay' and column_name = 'yard_id') then
    create or replace view fy.humidor_pay as
      select i.source_ref::uuid as round_id, i.payer_id as member_id,
             case i.state when 'open' then 'due' when 'disputed' then 'due'
                          when 'marked_paid' then 'pending' else 'confirmed' end as status,
             i.state_changed_at as sent_at,
             case i.state when 'marked_paid' then 'pending' when 'confirmed' then 'confirmed'
                          when 'settled' then 'confirmed' else 'due' end as state,
             i.state_changed_at as at,
             i.yard_id
      from fy.iou i where i.room = 'humidor';
    grant select on fy.humidor_pay to authenticated;
    raise notice 'yard.sql: fy.humidor_pay now exposes yard_id';
  end if;
end $$;

-- 3. The signed-in member's yard.
create or replace function fy.my_yard() returns int
language sql stable security definer set search_path = fy, public as $$
  select yard_id from fy.member where user_id = auth.uid();
$$;
grant execute on function fy.my_yard() to authenticated;

-- 4. Add member: the new row takes the creator's yard (and keeps the p_role argument from roles.sql).
drop function if exists fy.create_member(text, text, text, text, text);
create or replace function fy.create_member(p_nickname text, p_avatar text,
                                            p_invite_email text default null,
                                            p_discord_username text default null,
                                            p_mobile text default null,
                                            p_role text default 'member') returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_id uuid; v_role text := lower(btrim(coalesce(nullif(p_role, ''), 'member')));
begin
  perform fy._require_leader();
  if v_role !~ '^[a-z][a-z_]{1,23}$' then raise exception 'that is not a valid role'; end if;
  if nullif(btrim(coalesce(p_invite_email, '')), '') is null
     and nullif(btrim(coalesce(p_discord_username, '')), '') is null then
    raise exception 'give an invite email or a Discord username (at least one)' using errcode = '23514';
  end if;
  insert into fy.member (league_id, yard_id, nickname, avatar, invite_email, discord_username, mobile, role)
  values (fy._league(), fy.my_yard(), btrim(p_nickname), coalesce(p_avatar,'hen'), p_invite_email, p_discord_username, p_mobile, v_role)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function fy.create_member(text, text, text, text, text, text) to authenticated;

-- 5. Invite (claim link): only for a member of the leader's own yard, and the link carries that yard.
create or replace function fy.issue_claim_link(p_member_id uuid, p_days int default 14) returns text
language plpgsql security definer set search_path = fy, public as $$
declare v_token text;
begin
  perform fy._require_leader();
  -- A new link burns any older unused one for the same member.
  update fy.claim_link set used_at = now() where member_id = p_member_id and used_at is null and yard_id = fy.my_yard();
  insert into fy.claim_link (member_id, league_id, yard_id, expires_at)
  select id, league_id, yard_id, now() + make_interval(days => p_days) from fy.member
   where id = p_member_id and yard_id = fy.my_yard()
  returning token into v_token;
  if v_token is null then raise exception 'unknown member' using errcode = 'P0002'; end if;
  return v_token;
end $$;
