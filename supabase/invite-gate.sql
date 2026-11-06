-- ============================================================================
-- THE FARMYARD · invite-only gate (one block, idempotent, safe to re-run)
-- Run in the Supabase SQL editor. Mirrors supabase/schema.sql section 9 plus
-- the member columns, fy.me(), fy.create_member and fy.admin_set_member edits.
-- NOTE: the live table is fy.member (singular), not fy.members.
-- ============================================================================
begin;

-- 1. Member columns (lower-cased by the trigger below; mobile is contact only).
alter table fy.member add column if not exists invite_email text;
alter table fy.member add column if not exists discord_username text;
alter table fy.member add column if not exists mobile text;
alter table fy.member add column if not exists claimed boolean not null default false;

-- fy.me() builds a fy.member row by position, so it must list the new columns
-- or every page's session check breaks.
create or replace function fy.me() returns fy.member
language sql stable security definer set search_path = fy, public as $$
  select id, league_id, nickname, avatar, user_id, null::text, role, chesscom_username, created_at, revolut_url, avatar_url, setup_at,
         birth_day, birth_month, tagline, invite_email, discord_username, mobile, claimed
  from fy.member where user_id = auth.uid() limit 1;
$$;

-- Lower-case the contact columns on every write; a linked row is always claimed.
create or replace function fy.member_contact_norm() returns trigger
language plpgsql as $$
begin
  new.invite_email     := nullif(lower(btrim(coalesce(new.invite_email, ''))), '');
  new.discord_username := nullif(lower(btrim(coalesce(new.discord_username, ''))), '');
  new.mobile           := nullif(btrim(coalesce(new.mobile, '')), '');
  if new.user_id is not null then new.claimed := true; end if;
  return new;
end $$;
drop trigger if exists member_contact_norm on fy.member;
create trigger member_contact_norm before insert or update on fy.member
  for each row execute function fy.member_contact_norm();

-- 2a. Backfill BEFORE the gate goes up: every already-claimed member (the admin
-- included) keeps working, and their row carries the email their sign-in uses.
update fy.member set claimed = true where user_id is not null and not claimed;
update fy.member m set invite_email = lower(u.email)
from auth.users u
where m.user_id = u.id and m.invite_email is null and u.email is not null;

-- One member per invite address / username (per league), or the match is ambiguous.
create unique index if not exists member_invite_email_uq
  on fy.member (league_id, invite_email) where invite_email is not null;
create unique index if not exists member_discord_username_uq
  on fy.member (league_id, discord_username) where discord_username is not null;

-- 2b. The gate. BEFORE INSERT on auth.users: no matching unclaimed member row,
-- no account. Existing auth users are never inserts, so they are untouched.
-- An email match outranks a username match when both hit. On match the member
-- row is linked (user_id) and claimed.
create or replace function fy.gate_signup() returns trigger
language plpgsql security definer set search_path = fy, public as $$
declare
  v_email  text;
  v_name   text;
  v_member uuid;
begin
  v_email := nullif(lower(coalesce(new.email, '')), '');
  v_name  := nullif(lower(coalesce(
               new.raw_user_meta_data #>> '{custom_claims,global_name}',
               new.raw_user_meta_data ->> 'user_name',
               new.raw_user_meta_data ->> 'preferred_username',
               new.raw_user_meta_data ->> 'full_name',
               new.raw_user_meta_data ->> 'name', '')), '');
  select id into v_member from fy.member
  where user_id is null
    and ((invite_email is not null and invite_email = v_email)
      or (discord_username is not null and discord_username = v_name))
  order by (invite_email = v_email) desc nulls last
  limit 1;
  if v_member is null then
    raise exception 'Members only. Hank checks the door.' using errcode = 'P0001';
  end if;
  update fy.member set user_id = new.id, claimed = true where id = v_member;
  return new;
end $$;
drop trigger if exists fy_gate_signup on auth.users;
create trigger fy_gate_signup before insert on auth.users
  for each row execute function fy.gate_signup();

-- 3. Data lock: RLS on every fy.* table, present and future.
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'fy' loop
    execute format('alter table fy.%I enable row level security', r.tablename);
  end loop;
end $$;

-- Reads are members-only everywhere: tighten the four old "using (true)" read
-- policies and drop the anon grants (tables and the public views).
drop policy if exists league_read on fy.league;
create policy league_read on fy.league for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists event_type_read on fy.event_type;
create policy event_type_read on fy.event_type for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists event_read on fy.event;
create policy event_read on fy.event for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists score_read on fy.score_entry;
create policy score_read on fy.score_entry for select to authenticated using (fy.is_member() or fy.is_leader());
revoke select on fy.league, fy.event_type from anon;
revoke select on fy.v_members_public, fy.v_standings, fy.v_overall, fy.v_badges from anon;
-- Writes were already leader-only: every write path is a security-definer RPC
-- that calls fy._require_leader() (admin tables) or checks the caller, and the
-- only direct grant is the member's column-limited self-update. The Humidor
-- tables keep all privileges revoked and are reached only through their RPCs.

-- 4. Admin member form: create takes the invite contacts (at least one of
-- email / Discord username), and admin_set_member may edit all three later.
drop function if exists fy.create_member(text, text);
create or replace function fy.create_member(p_nickname text, p_avatar text,
                                            p_invite_email text default null,
                                            p_discord_username text default null,
                                            p_mobile text default null) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_id uuid;
begin
  perform fy._require_leader();
  if nullif(btrim(coalesce(p_invite_email, '')), '') is null
     and nullif(btrim(coalesce(p_discord_username, '')), '') is null then
    raise exception 'give an invite email or a Discord username (at least one)' using errcode = '23514';
  end if;
  insert into fy.member (league_id, nickname, avatar, invite_email, discord_username, mobile)
  values (fy._league(), btrim(p_nickname), coalesce(p_avatar,'hen'), p_invite_email, p_discord_username, p_mobile)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function fy.create_member(text, text, text, text, text) to authenticated;

create or replace function fy.admin_set_member(p_member uuid, p_field text, p_value text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text; v_new text;
begin
  leader := fy._require_leader();
  if p_field not in ('nickname','tagline','revolut_url','avatar_url','avatar','role','invite_email','discord_username','mobile') then
    raise exception 'field not allowed: %', p_field;
  end if;
  -- The nullable fields clear on an empty string (their checks accept null, never '').
  v_new := case when p_field in ('tagline','revolut_url','avatar_url','invite_email','discord_username','mobile') then nullif(p_value, '') else p_value end;
  execute format('select %I::text from fy.member where id = $1', p_field) into v_old using p_member;
  if not exists (select 1 from fy.member where id = p_member) then raise exception 'unknown member' using errcode = 'P0002'; end if;
  update fy.member set
    nickname    = case when p_field = 'nickname'    then btrim(v_new) else nickname end,
    tagline     = case when p_field = 'tagline'     then v_new else tagline end,
    revolut_url = case when p_field = 'revolut_url' then v_new else revolut_url end,
    avatar      = case when p_field = 'avatar'      then v_new else avatar end,
    -- A stock-animal pick replaces any logo override, matching the member's own flow.
    avatar_url  = case when p_field = 'avatar_url' then v_new when p_field = 'avatar' then null else avatar_url end,
    role        = case when p_field = 'role'        then v_new else role end,
    invite_email     = case when p_field = 'invite_email'     then v_new else invite_email end,
    discord_username = case when p_field = 'discord_username' then v_new else discord_username end,
    mobile           = case when p_field = 'mobile'           then v_new else mobile end
  where id = p_member;
  perform fy._admin_log(leader.id, 'member', p_member::text, p_field, v_old, v_new);
end $$;

-- Members can read the contact columns (rows are already member-gated).
grant select (invite_email, discord_username, mobile, claimed) on fy.member to authenticated;

commit;
