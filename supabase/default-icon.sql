-- Default icon (RAY, 23 Nov): a member who holds an animal and has no icon gets that animal's
-- lowest-numbered palette picture. Safe to re-run.
-- Run: node tools/db.mjs supabase/default-icon.sql   (from the site folder; LIVE WRITE, only after RAY's yes)
--
-- An explicit pick (admin_icon_set, set_my_icon) still wins: the default only fills an EMPTY avatar_url.
-- Function bodies below are copied unchanged from their latest source, with one added call each:
--   set_my_character, admin_character_assign, admin_icon_remove  <- icons-per-character.sql (12 Nov)
--   admin_icon_add                                               <- icon-slots-20.sql (17 Nov, slots 1 to 20)

-- 1. The helper. Internal only, like fy._admin_log.
create or replace function fy._default_icon(p_member uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  update fy.member m set icon_slot = p.slot, avatar_url = p.url
    from (select ip.slot, ip.url from fy.icon_palette ip
           where ip.character_id = (select character_id from fy.member where id = p_member)
           order by ip.slot limit 1) p
   where m.id = p_member and m.character_id is not null and m.avatar_url is null;
end $$;
revoke all on function fy._default_icon(uuid) from public;

-- 2. A member changes their own animal: clear the old pick, then default to the new animal's first picture.
create or replace function fy.set_my_character(p_id int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member;
begin
  me := fy._require_member();
  if p_id is not null then
    if not exists (select 1 from fy.character where id = p_id and yard_id = me.yard_id) then
      raise exception 'unknown animal' using errcode = 'P0002';
    end if;
    if exists (select 1 from fy.member where character_id = p_id and id <> me.id) then
      raise exception 'that animal is taken' using errcode = '23505';
    end if;
  end if;
  if me.character_id is distinct from p_id then
    update fy.member set character_id = p_id, icon_slot = null, avatar_url = null where id = me.id;
  end if;
  perform fy._default_icon(me.id);
end $$;

-- 3. The admin gives a member an animal: same, logged as before.
create or replace function fy.admin_character_assign(p_member uuid, p_id int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old int; v_oldname text; v_newname text;
begin
  leader := fy._require_leader();
  select character_id into v_old from fy.member where id = p_member;
  if not found then raise exception 'unknown member' using errcode = 'P0002'; end if;
  if p_id is not null then
    select name into v_newname from fy.character where id = p_id and yard_id = leader.yard_id;
    if v_newname is null then raise exception 'unknown animal' using errcode = 'P0002'; end if;
    if exists (select 1 from fy.member where character_id = p_id and id <> p_member) then
      raise exception 'that animal is taken' using errcode = '23505';
    end if;
  end if;
  select name into v_oldname from fy.character where id = v_old;
  if v_old is distinct from p_id then
    update fy.member set character_id = p_id, icon_slot = null, avatar_url = null where id = p_member;
    perform fy._admin_log(leader.id, 'member', p_member::text, 'character_id', v_oldname, v_newname);
  end if;
  perform fy._default_icon(p_member);
end $$;

-- 4. First picture uploaded for an animal reaches its holder at once.
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
  perform fy._default_icon(m.id) from fy.member m where m.character_id = p_character;
end $$;

-- 5. Removing the picture in use falls back to the animal's next lowest picture.
create or replace function fy.admin_icon_remove(p_character int, p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_url text;
begin
  leader := fy._require_leader();
  select url into v_url from fy.icon_palette where character_id = p_character and slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  update fy.member set icon_slot = null, avatar_url = null
   where character_id = p_character and (icon_slot = p_slot or avatar_url = v_url);
  delete from fy.icon_palette where character_id = p_character and slot = p_slot;
  perform fy._admin_log(leader.id, 'icon_palette', p_character || ':' || p_slot, 'remove', v_url, null);
  perform fy._default_icon(m.id) from fy.member m where m.character_id = p_character;
end $$;

grant execute on function fy.set_my_character(int), fy.admin_character_assign(uuid, int),
  fy.admin_icon_add(int, int, text), fy.admin_icon_remove(int, int) to authenticated;

-- 6. Backfill: everyone who already holds an animal with no icon (on 23 Nov: Dan on COW, perhaps Jamie).
select count(*) as backfill_candidates from fy.member where character_id is not null and avatar_url is null;
select fy._default_icon(id) from fy.member where character_id is not null and avatar_url is null;
select count(*) as still_without_icon from fy.member where character_id is not null and avatar_url is null;

notify pgrst, 'reload schema';
