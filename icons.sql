-- icons.sql — SUPERSEDED by icons-per-member.sql (per-member palette). Already applied; do NOT re-run it, it would restore the shared functions.
-- Icon palette, simplified: ONE global palette of up to 15 pictures (replaces the per-member logo lists in the page).
-- Storage bucket 'icons' (public read), file icons/slot-N.png; fy.icon_palette has one row per filled slot;
-- fy.member.icon_slot is the slot a member picked (the page keeps reading member.avatar_url, which the RPCs set to the slot's URL).
-- Admin only is enforced here: every write is a leader-only RPC (fy._require_leader) or a leader-only Storage policy.
-- Run this BEFORE yard.sql (yard.sql adds yard_id to fy.icon_palette).

create table if not exists fy.icon_palette (
  slot int primary key check (slot between 1 and 15),
  url text not null check (url ~ '^https://[^\s"''<>()]+$'),
  created_at timestamptz not null default now()
);
alter table fy.icon_palette enable row level security;
grant select on fy.icon_palette to authenticated;
drop policy if exists icon_palette_read on fy.icon_palette;
create policy icon_palette_read on fy.icon_palette for select to authenticated using (fy.is_member() or fy.is_leader());
-- No write policies: writes happen only inside the security-definer functions below.

alter table fy.member add column if not exists icon_slot int;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'fy.member'::regclass and conname = 'member_icon_slot_check') then
    alter table fy.member add constraint member_icon_slot_check check (icon_slot is null or icon_slot between 1 and 15);
  end if;
end $$;
grant select (icon_slot) on fy.member to authenticated;

-- Lowest free number, 1 to 15. Raises when the palette is full.
create or replace function fy.admin_icon_next() returns int
language plpgsql security definer set search_path = fy, public as $$
declare v int;
begin
  perform fy._require_leader();
  select g into v from generate_series(1, 15) g where not exists (select 1 from fy.icon_palette p where p.slot = g) order by g limit 1;
  if v is null then raise exception 'the icon palette is full' using errcode = 'P0001'; end if;
  return v;
end $$;

-- Record an upload. The URL must be that slot's own file in the public icons bucket.
create or replace function fy.admin_icon_add(p_slot int, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member;
begin
  leader := fy._require_leader();
  if p_slot is null or p_slot not between 1 and 15 then raise exception 'slots run 1 to 15'; end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/icons/slot-' || p_slot || '\.png(\?v=[0-9]+)?$') then
    raise exception 'that is not the icons bucket file for slot %', p_slot;
  end if;
  if exists (select 1 from fy.icon_palette where slot = p_slot) then raise exception 'slot % is already filled', p_slot; end if;
  insert into fy.icon_palette (slot, url) values (p_slot, p_url);
  perform fy._admin_log(leader.id, 'icon_palette', p_slot::text, 'add', null, p_url);
end $$;

-- Remove a picture: deletes the row and clears the icon of every member using it (the page then deletes the file).
create or replace function fy.admin_icon_remove(p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_url text;
begin
  leader := fy._require_leader();
  select url into v_url from fy.icon_palette where slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  update fy.member set icon_slot = null, avatar_url = null where icon_slot = p_slot or avatar_url = v_url;
  delete from fy.icon_palette where slot = p_slot;
  perform fy._admin_log(leader.id, 'icon_palette', p_slot::text, 'remove', v_url, null);
end $$;

-- Admin sets a member's icon.
create or replace function fy.admin_icon_set(p_member uuid, p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_url text; v_old text;
begin
  leader := fy._require_leader();
  select url into v_url from fy.icon_palette where slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  select avatar_url into v_old from fy.member where id = p_member;
  if not found then raise exception 'unknown member' using errcode = 'P0002'; end if;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = p_member;
  perform fy._admin_log(leader.id, 'member', p_member::text, 'icon_slot', v_old, v_url);
end $$;

-- A member picks their own icon (Profile, New User Set-up).
create or replace function fy.set_my_icon(p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_url text;
begin
  me := fy._require_member();
  select url into v_url from fy.icon_palette where slot = p_slot;
  if v_url is null then raise exception 'that icon is not in the palette'; end if;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = me.id;
end $$;
grant execute on function fy.admin_icon_next(), fy.admin_icon_add(int, text), fy.admin_icon_remove(int),
  fy.admin_icon_set(uuid, int), fy.set_my_icon(int) to authenticated;

-- Storage: public bucket, leader-only writes.
insert into storage.buckets (id, name, public) values ('icons', 'icons', true)
on conflict (id) do update set public = true;
drop policy if exists icons_public_read on storage.objects;
create policy icons_public_read on storage.objects for select using (bucket_id = 'icons');
drop policy if exists icons_leader_insert on storage.objects;
create policy icons_leader_insert on storage.objects for insert to authenticated with check (bucket_id = 'icons' and fy.is_leader());
drop policy if exists icons_leader_update on storage.objects;
create policy icons_leader_update on storage.objects for update to authenticated using (bucket_id = 'icons' and fy.is_leader()) with check (bucket_id = 'icons' and fy.is_leader());
drop policy if exists icons_leader_delete on storage.objects;
create policy icons_leader_delete on storage.objects for delete to authenticated using (bucket_id = 'icons' and fy.is_leader());
