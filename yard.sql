-- yard.sql — multi-yard, Stage 1 (schema). Run once in the Supabase SQL editor; idempotent.
-- Adds only: fy.yards, a yard_id column + index on every per-group table, fy.my_yard(). Nothing is renamed or dropped. Every existing row ends up in yard 1 (The Farmyard) through the column default.
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

-- 4/5. fy.create_member and fy.issue_claim_link are NOT redefined here any more: their current versions (yard-aware, optional email,
--      7-day reusable links) live in invite-link.sql. Re-running this file must not overwrite them.
