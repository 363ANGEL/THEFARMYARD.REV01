-- roles.sql — run once in the Supabase SQL editor. Idempotent. NOT committed.
-- Role stays a plain text column on fy.member (the table is fy.member, singular). The old two-value CHECK is replaced by a
-- format check, so a new role later is just a new value: no schema change. Leaders only (fy._require_leader() inside both RPCs).

-- 1. Replace the ('leader','member') check with a format check.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'fy.member'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%role%' and conname <> 'member_role_format'
  loop
    execute format('alter table fy.member drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'fy.member'::regclass and conname = 'member_role_format') then
    alter table fy.member add constraint member_role_format check (role ~ '^[a-z][a-z_]{1,23}$');
  end if;
end $$;

-- 2. Changing a role: leaders only, and the last remaining leader cannot be demoted.
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
  if not exists (select 1 from fy.member where id = p_member) then raise exception 'unknown member' using errcode = 'P0002'; end if;
  if p_field = 'role' then
    v_new := lower(btrim(coalesce(p_value, '')));
    if v_new !~ '^[a-z][a-z_]{1,23}$' then raise exception 'that is not a valid role'; end if;
    perform 1 from fy.member where role = 'leader' for update;   -- serialise concurrent demotions
    if v_new <> 'leader' and exists (select 1 from fy.member where id = p_member and role = 'leader')
       and not exists (select 1 from fy.member where role = 'leader' and id <> p_member) then
      raise exception 'the last leader cannot be demoted' using errcode = 'P0001';
    end if;
  end if;
  execute format('select %I::text from fy.member where id = $1', p_field) into v_old using p_member;
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

-- 3. Add member takes a role (default member). The old five-argument version is dropped so the call is unambiguous.
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
  insert into fy.member (league_id, nickname, avatar, invite_email, discord_username, mobile, role)
  values (fy._league(), btrim(p_nickname), coalesce(p_avatar,'hen'), p_invite_email, p_discord_username, p_mobile, v_role)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function fy.create_member(text, text, text, text, text, text) to authenticated;
