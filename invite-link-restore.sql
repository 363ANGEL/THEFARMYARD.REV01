-- invite-link-restore.sql — idempotent. Re-applies the invite-link versions of fy.create_member (email optional) and fy.issue_claim_link
-- (7-day, reusable) after yard.sql had overwritten them, and drops the old issue_claim_link(uuid, int) overload.

drop function if exists fy.issue_claim_link(uuid, int);

-- 1. Add member: no contact required (the invite link is the way in).
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
  insert into fy.member (league_id, yard_id, nickname, avatar, invite_email, discord_username, mobile, role)
  values (fy._league(), fy.my_yard(), btrim(p_nickname), coalesce(p_avatar,'hen'), p_invite_email, p_discord_username, p_mobile, v_role)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function fy.create_member(text, text, text, text, text, text) to authenticated;

-- 2. Copy invite link / New link. p_new = false reuses an unused, unexpired link; true voids old ones and issues a fresh token.
create or replace function fy.issue_claim_link(p_member_id uuid, p_new boolean default false, p_days int default 7) returns text
language plpgsql security definer set search_path = fy, public as $$
declare v_token text;
begin
  perform fy._require_leader();
  if not exists (select 1 from fy.member where id = p_member_id and yard_id = fy.my_yard()) then
    raise exception 'unknown member' using errcode = 'P0002';
  end if;
  if exists (select 1 from fy.member where id = p_member_id and user_id is not null) then
    raise exception 'already claimed' using errcode = '23505';
  end if;
  if not p_new then
    select token into v_token from fy.claim_link
     where member_id = p_member_id and used_at is null and yard_id = fy.my_yard()
       and expires_at > now() order by created_at desc limit 1;
    if v_token is not null then return v_token; end if;
  end if;
  update fy.claim_link set used_at = now() where member_id = p_member_id and used_at is null and yard_id = fy.my_yard();
  insert into fy.claim_link (member_id, league_id, yard_id, expires_at)
  select id, league_id, yard_id, now() + make_interval(days => p_days) from fy.member where id = p_member_id
  returning token into v_token;
  return v_token;
end $$;
grant execute on function fy.issue_claim_link(uuid, boolean, int) to authenticated;

