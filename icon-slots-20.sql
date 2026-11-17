-- Twenty icon slots per animal, up from fifteen (RAY, 17 Nov). Safe to re-run.
-- Run: node tools/db.mjs icon-slots-20.sql   (from the site folder)

-- 1. Widen the slot checks: the palette's own, and the member's pick.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'fy.icon_palette'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%slot%' loop
    execute format('alter table fy.icon_palette drop constraint %I', c.conname);
  end loop;
  alter table fy.icon_palette add constraint icon_palette_slot_check check (slot between 1 and 20);
  alter table fy.member drop constraint if exists member_icon_slot_check;
  alter table fy.member add constraint member_icon_slot_check check (icon_slot is null or icon_slot between 1 and 20);
end $$;

-- 2. Next free number and upload now run 1 to 20.
-- Lowest free number (1 to 20) in that animal's set. Raises when the set is full.
create or replace function fy.admin_icon_next(p_character int) returns int
language plpgsql security definer set search_path = fy, public as $$
declare v int;
begin
  perform fy._require_leader();
  if not exists (select 1 from fy.character where id = p_character) then raise exception 'unknown animal' using errcode = 'P0002'; end if;
  select g into v from generate_series(1, 20) g
   where not exists (select 1 from fy.icon_palette p where p.character_id = p_character and p.slot = g) order by g limit 1;
  if v is null then raise exception 'this animal''s icon palette is full' using errcode = 'P0001'; end if;
  return v;
end $$;

-- Record an upload. The URL must be that animal's own file for that slot in the public icons bucket.
create or replace function fy.admin_icon_add(p_character int, p_slot int, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_yard int;
begin
  leader := fy._require_leader();
  select yard_id into v_yard from fy.character where id = p_character;
  if not found then raise exception 'unknown animal' using errcode = 'P0002'; end if;
  if p_slot is null or p_slot not between 1 and 20 then raise exception 'slots run 1 to 20'; end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/icons/' || p_character || '/slot-' || p_slot || '\.png(\?v=[0-9]+)?$') then
    raise exception 'that is not the icons bucket file for slot %', p_slot;
  end if;
  if exists (select 1 from fy.icon_palette where character_id = p_character and slot = p_slot) then raise exception 'slot % is already filled', p_slot; end if;
  insert into fy.icon_palette (character_id, slot, url, yard_id) values (p_character, p_slot, p_url, v_yard);
  perform fy._admin_log(leader.id, 'icon_palette', p_character || ':' || p_slot, 'add', null, p_url);
end $$;

