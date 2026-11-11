-- icons-per-member.sql — idempotent. Run after icons.sql and yard.sql; supersedes the shared palette in icons.sql (do not re-run icons.sql after this).
-- Icon palette is per member: each member has their own 15 slots. fy.icon_palette is keyed by (member_id, slot) and carries yard_id.
-- Storage path: icons/<member_id>/slot-N.png. Admin (leader) uploads, sets and removes; a member only picks one of their own filled slots.

-- 1. Table: add member_id (existing shared rows move to the first leader, RAY), re-key on (member_id, slot).
do $$
declare v_owner uuid;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'fy' and table_name = 'icon_palette' and column_name = 'member_id') then
    alter table fy.icon_palette add column member_id uuid references fy.member(id) on delete cascade;
    select id into v_owner from fy.member where role = 'leader' order by created_at limit 1;
    update fy.icon_palette set member_id = v_owner where member_id is null;
    delete from fy.icon_palette where member_id is null;          -- only if there was no leader to take them
    alter table fy.icon_palette alter column member_id set not null;
    alter table fy.icon_palette drop constraint if exists icon_palette_pkey;
    alter table fy.icon_palette add primary key (member_id, slot);
  end if;
end $$;
create index if not exists icon_palette_yard_id_idx on fy.icon_palette (yard_id);

-- 2. Read policy: a member sees their own slots, a leader sees everyone's.
drop policy if exists icon_palette_read on fy.icon_palette;
create policy icon_palette_read on fy.icon_palette for select to authenticated
  using (fy.is_leader() or exists (select 1 from fy.member m where m.id = icon_palette.member_id and m.user_id = auth.uid()));

-- 3. RPCs. Old shared signatures are dropped.
drop function if exists fy.admin_icon_next();
drop function if exists fy.admin_icon_add(int, text);
drop function if exists fy.admin_icon_remove(int);

-- Lowest free number (1 to 15) in that member's set. Raises when their set is full.
create or replace function fy.admin_icon_next(p_member uuid) returns int
language plpgsql security definer set search_path = fy, public as $$
declare v int;
begin
  perform fy._require_leader();
  if not exists (select 1 from fy.member where id = p_member) then raise exception 'unknown member' using errcode = 'P0002'; end if;
  select g into v from generate_series(1, 15) g
   where not exists (select 1 from fy.icon_palette p where p.member_id = p_member and p.slot = g) order by g limit 1;
  if v is null then raise exception 'this member''s icon palette is full' using errcode = 'P0001'; end if;
  return v;
end $$;

-- Record an upload. The URL must be that member's own file for that slot in the public icons bucket.
create or replace function fy.admin_icon_add(p_member uuid, p_slot int, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member;
begin
  leader := fy._require_leader();
  if not exists (select 1 from fy.member where id = p_member) then raise exception 'unknown member' using errcode = 'P0002'; end if;
  if p_slot is null or p_slot not between 1 and 15 then raise exception 'slots run 1 to 15'; end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/icons/' || p_member || '/slot-' || p_slot || '\.png(\?v=[0-9]+)?$') then
    raise exception 'that is not the icons bucket file for slot %', p_slot;
  end if;
  if exists (select 1 from fy.icon_palette where member_id = p_member and slot = p_slot) then raise exception 'slot % is already filled', p_slot; end if;
  insert into fy.icon_palette (member_id, slot, url, yard_id) select p_member, p_slot, p_url, m.yard_id from fy.member m where m.id = p_member;
  perform fy._admin_log(leader.id, 'icon_palette', p_member || ':' || p_slot, 'add', null, p_url);
end $$;

-- Remove a picture: frees the slot and clears the member's icon if it pointed there (the page then deletes the file).
create or replace function fy.admin_icon_remove(p_member uuid, p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_url text;
begin
  leader := fy._require_leader();
  select url into v_url from fy.icon_palette where member_id = p_member and slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  update fy.member set icon_slot = null, avatar_url = null where id = p_member and (icon_slot = p_slot or avatar_url = v_url);
  delete from fy.icon_palette where member_id = p_member and slot = p_slot;
  perform fy._admin_log(leader.id, 'icon_palette', p_member || ':' || p_slot, 'remove', v_url, null);
end $$;

-- Admin sets a member's icon from that member's own filled slots.
create or replace function fy.admin_icon_set(p_member uuid, p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_url text; v_old text;
begin
  leader := fy._require_leader();
  select url into v_url from fy.icon_palette where member_id = p_member and slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  select avatar_url into v_old from fy.member where id = p_member;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = p_member;
  perform fy._admin_log(leader.id, 'member', p_member::text, 'icon_slot', v_old, v_url);
end $$;

-- A member picks their own icon, only from their own filled slots.
create or replace function fy.set_my_icon(p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_url text;
begin
  me := fy._require_member();
  select url into v_url from fy.icon_palette where member_id = me.id and slot = p_slot;
  if v_url is null then raise exception 'that icon is not in your palette'; end if;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = me.id;
end $$;

grant execute on function fy.admin_icon_next(uuid), fy.admin_icon_add(uuid, int, text), fy.admin_icon_remove(uuid, int),
  fy.admin_icon_set(uuid, int), fy.set_my_icon(int) to authenticated;

notify pgrst, 'reload schema';
