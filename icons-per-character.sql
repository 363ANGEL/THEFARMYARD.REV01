-- icons-per-character.sql — idempotent. Run after icons-per-member.sql and characters.sql.
-- Supersedes the per-member palette: the 15 slots belong to the ANIMAL, not the member.
-- fy.icon_palette is keyed by (character_id, slot) and keeps yard_id. Storage: icons/<character_id>/slot-N.png.
-- A member shows the slots of the animal they hold; changing animal clears their pick.

-- 1. Table: add character_id, move each row to the character its member holds now, re-key.
--    Rows whose member holds no animal are NOT deleted: they are parked in fy.icon_palette_unmoved.
create table if not exists fy.icon_palette_unmoved (
  member_id uuid,
  slot int,
  url text,
  yard_id int,
  moved_at timestamptz not null default now()
);

-- The read policy names member_id, so it has to go before the column can be dropped. It is recreated at step 2.
drop policy if exists icon_palette_read on fy.icon_palette;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'fy' and table_name = 'icon_palette' and column_name = 'character_id') then

    alter table fy.icon_palette add column character_id int references fy.character(id) on delete cascade;

    -- Each member's rows move to the animal they hold.
    update fy.icon_palette p set character_id = m.character_id
      from fy.member m where m.id = p.member_id and m.character_id is not null;

    -- Two members holding rows for the same animal cannot both keep slot N. Park the later ones.
    insert into fy.icon_palette_unmoved (member_id, slot, url, yard_id)
    select p.member_id, p.slot, p.url, p.yard_id from fy.icon_palette p
     where p.character_id is null
        or exists (select 1 from fy.icon_palette q
                    where q.character_id = p.character_id and q.slot = p.slot and q.member_id < p.member_id);
    delete from fy.icon_palette p
     where p.character_id is null
        or exists (select 1 from fy.icon_palette q
                    where q.character_id = p.character_id and q.slot = p.slot and q.member_id < p.member_id);

    alter table fy.icon_palette alter column character_id set not null;
    alter table fy.icon_palette drop constraint if exists icon_palette_pkey;
    alter table fy.icon_palette add primary key (character_id, slot);
    alter table fy.icon_palette drop column member_id;
  end if;
end $$;
create index if not exists icon_palette_yard_id_idx on fy.icon_palette (yard_id);

-- 2. Read policy: a member sees the slots of the animal they hold, a leader sees every animal's.
drop policy if exists icon_palette_read on fy.icon_palette;
create policy icon_palette_read on fy.icon_palette for select to authenticated
  using (fy.is_leader() or exists (select 1 from fy.member m
                                    where m.user_id = auth.uid() and m.character_id = icon_palette.character_id));

-- 3. RPCs. The per-member signatures are dropped.
drop function if exists fy.admin_icon_next(uuid);
drop function if exists fy.admin_icon_add(uuid, int, text);
drop function if exists fy.admin_icon_remove(uuid, int);

-- Lowest free number (1 to 15) in that animal's set. Raises when the set is full.
create or replace function fy.admin_icon_next(p_character int) returns int
language plpgsql security definer set search_path = fy, public as $$
declare v int;
begin
  perform fy._require_leader();
  if not exists (select 1 from fy.character where id = p_character) then raise exception 'unknown animal' using errcode = 'P0002'; end if;
  select g into v from generate_series(1, 15) g
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
  if p_slot is null or p_slot not between 1 and 15 then raise exception 'slots run 1 to 15'; end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/icons/' || p_character || '/slot-' || p_slot || '\.png(\?v=[0-9]+)?$') then
    raise exception 'that is not the icons bucket file for slot %', p_slot;
  end if;
  if exists (select 1 from fy.icon_palette where character_id = p_character and slot = p_slot) then raise exception 'slot % is already filled', p_slot; end if;
  insert into fy.icon_palette (character_id, slot, url, yard_id) values (p_character, p_slot, p_url, v_yard);
  perform fy._admin_log(leader.id, 'icon_palette', p_character || ':' || p_slot, 'add', null, p_url);
end $$;

-- Remove a picture: frees the number and clears the pick of whoever holds that animal (the page then deletes the file).
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
end $$;

-- Admin sets a member's icon from the filled slots of the animal that member holds.
create or replace function fy.admin_icon_set(p_member uuid, p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_char int; v_url text; v_old text;
begin
  leader := fy._require_leader();
  select character_id, avatar_url into v_char, v_old from fy.member where id = p_member;
  if not found then raise exception 'unknown member' using errcode = 'P0002'; end if;
  if v_char is null then raise exception 'that member has no animal yet'; end if;
  select url into v_url from fy.icon_palette where character_id = v_char and slot = p_slot;
  if v_url is null then raise exception 'slot % is empty', p_slot; end if;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = p_member;
  perform fy._admin_log(leader.id, 'member', p_member::text, 'icon_slot', v_old, v_url);
end $$;

-- A member picks their own icon, only from a filled slot of their own animal.
create or replace function fy.set_my_icon(p_slot int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_url text;
begin
  me := fy._require_member();
  if me.character_id is null then raise exception 'you have no animal yet'; end if;
  select url into v_url from fy.icon_palette where character_id = me.character_id and slot = p_slot;
  if v_url is null then raise exception 'that icon is not in your animal''s palette'; end if;
  update fy.member set icon_slot = p_slot, avatar_url = v_url where id = me.id;
end $$;

-- 4. Changing, freeing or removing an animal clears that member's pick: the next animal has its own set.
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
end $$;

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
end $$;

create or replace function fy.admin_character_free(p_id int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old uuid;
begin
  leader := fy._require_leader();
  if not exists (select 1 from fy.character where id = p_id and yard_id = leader.yard_id) then
    raise exception 'unknown animal' using errcode = 'P0002';
  end if;
  select id into v_old from fy.member where character_id = p_id;
  update fy.member set character_id = null, icon_slot = null, avatar_url = null where character_id = p_id;
  perform fy._admin_log(leader.id, 'character', p_id::text, 'free', v_old::text, null);
end $$;

create or replace function fy.admin_character_remove(p_id int) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text;
begin
  leader := fy._require_leader();
  select name into v_old from fy.character where id = p_id and yard_id = leader.yard_id;
  if not found then raise exception 'unknown animal' using errcode = 'P0002'; end if;
  update fy.member set character_id = null, icon_slot = null, avatar_url = null where character_id = p_id;
  delete from fy.character where id = p_id;      -- icon_palette rows cascade with the animal
  perform fy._admin_log(leader.id, 'character', p_id::text, 'remove', v_old, null);
end $$;

grant execute on function fy.admin_icon_next(int), fy.admin_icon_add(int, int, text), fy.admin_icon_remove(int, int),
  fy.admin_icon_set(uuid, int), fy.set_my_icon(int), fy.set_my_character(int), fy.admin_character_assign(uuid, int),
  fy.admin_character_free(int), fy.admin_character_remove(int) to authenticated;

notify pgrst, 'reload schema';
