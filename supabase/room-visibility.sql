-- Run once: node tools/db.mjs supabase/room-visibility.sql  (safe to re-run)

-- Page visibility (RAY, 17 Nov): each room is 'admin' (leaders only) or 'members'. Set from Admin > Pages.
-- Adds the column if missing, seeds the three Home sub-pages that were synthesised in barn.js,
-- and moves Football, The Humidor and What's Next under Home. Safe to re-run.
do $$
declare fresh boolean := not exists (select 1 from information_schema.columns where table_schema = 'fy' and table_name = 'room' and column_name = 'visibility');
begin
  -- The column may already exist (the older rooms-visibility.sql adds it); everything below is safe either way.
  alter table fy.room add column if not exists visibility text not null default 'admin';
  if not exists (select 1 from pg_constraint where conname = 'room_visibility_check' and conrelid = 'fy.room'::regclass) then
    alter table fy.room add constraint room_visibility_check check (visibility in ('admin','members'));
  end if;
  insert into fy.room (id, label, path, icon, status, grp, parent_id, sort) values
    ('about',      'About the yard', 'about.html',      'ph ph-question',       'ship', 'home', 'dashboard', 13),
    ('admin',      'Admin',          'admin.html',      'ph ph-gear-six',       'ship', 'home', 'dashboard', 14),
    ('whats-next', 'What''s Next?',  'whats-next.html', 'ph ph-thought-bubble', 'ship', 'home', 'dashboard', 17)
  on conflict (id) do nothing;
  if fresh then update fy.room set visibility = 'members' where id in ('dashboard', 'poker'); end if;
  update fy.room set grp = 'home', parent_id = 'dashboard', sort = 15 where id = 'football' and parent_id is distinct from 'dashboard';
  update fy.room set grp = 'home', parent_id = 'dashboard', sort = 16 where id = 'humidor' and parent_id is distinct from 'dashboard';
  update fy.room set grp = 'home' where parent_id in ('football', 'humidor') and grp is distinct from 'home';
end $$;

-- Admin > Pages: the leader sets a page to admin-only or members. A page's own sub-pages follow it.
-- Home, Admin, Profile and Set-up are never switchable.
create or replace function fy.admin_set_room_visibility(p_room text, p_visibility text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text;
begin
  leader := fy._require_leader();
  if p_visibility not in ('admin', 'members') then raise exception 'visibility must be admin or members' using errcode = '22023'; end if;
  if p_room in ('dashboard', 'admin', 'profile', 'setup') then raise exception 'that page cannot be switched' using errcode = '22023'; end if;
  select visibility into v_old from fy.room where id = p_room for update;
  if v_old is null then raise exception 'no such room' using errcode = 'P0002'; end if;
  update fy.room set visibility = p_visibility where id = p_room or parent_id = p_room;
  perform fy._admin_log(leader.id, 'room', p_room, 'visibility', v_old, p_visibility);
end $$;
grant execute on function fy.admin_set_room_visibility to authenticated;

