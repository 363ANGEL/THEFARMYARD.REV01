-- old-links-keep-working.sql — RAY, 27 Nov: "all existing links still work as I've sent them all out", and
-- "can we stop with the one time use". A link is a member's permanent door: the first Discord to use it becomes
-- that member; after that the same link only signs them in (claim.html). Members-only holds because claiming
-- stamps fy.member.user_id, and a claimed member can never be claimed again.
-- Idempotent. Run with: node tools/db.mjs supabase/old-links-keep-working.sql
-- Built from the repo copies of the live functions (invite-link.sql, invite-link-restore.sql, schema.sql);
-- diff against pg_get_functiondef before running if those have drifted.

-- 1. What a link is now. state: open (unclaimed member, link not expired, used or not), member (the member is
--    claimed: whatever the link's used or expiry state), expired (unclaimed member, link expired), unknown.
--    The nickname is returned for open and member only. Anyone holding the token may ask (the token is the secret).
create or replace function fy.claim_status(p_token text) returns jsonb
language sql stable security definer set search_path = fy, public as $$
  select coalesce((
    select case
             when m.user_id is not null then jsonb_build_object('state', 'member', 'nickname', m.nickname)
             when c.expires_at is null or c.expires_at > now() then jsonb_build_object('state', 'open', 'nickname', m.nickname)
             else jsonb_build_object('state', 'expired')
           end
      from fy.claim_link c join fy.member m on m.id = c.member_id
     where c.token = p_token), jsonb_build_object('state', 'unknown'));
$$;
revoke all on function fy.claim_status(text) from public;
grant execute on function fy.claim_status(text) to anon, authenticated;

-- 2. Claim: a used link still claims while its member is unclaimed and the link has not expired. Two Discords
--    racing on one link: both may pass the link update, but only one can stamp member.user_id (where user_id is
--    null); the other raises and rolls back.
create or replace function fy.claim_profile(p_token text) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare v_member uuid; v_discord text; v_name text; n int;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from fy.member where user_id = auth.uid()) then
    raise exception 'already claimed a profile' using errcode = '23505';
  end if;
  update fy.claim_link c set used_at = coalesce(c.used_at, now())
   where c.token = p_token and (c.expires_at is null or c.expires_at > now())
     and exists (select 1 from fy.member m where m.id = c.member_id and m.user_id is null)
  returning c.member_id into v_member;
  if v_member is null then
    if exists (select 1 from fy.claim_link c join fy.member m on m.id = c.member_id
                where c.token = p_token and m.user_id is null and c.expires_at <= now()) then
      raise exception 'link expired' using errcode = 'P0002';
    end if;
    raise exception 'link used or unknown' using errcode = 'P0002';
  end if;
  select i.provider_id,
         nullif(lower(coalesce(i.identity_data #>> '{custom_claims,global_name}', i.identity_data ->> 'user_name',
                               i.identity_data ->> 'preferred_username', i.identity_data ->> 'full_name', i.identity_data ->> 'name', '')), '')
    into v_discord, v_name
    from auth.identities i where i.user_id = auth.uid() and i.provider = 'discord' limit 1;
  update fy.member set user_id = auth.uid(), discord_id = v_discord,
         discord_username = coalesce(v_name, discord_username), claimed = true
  where id = v_member and user_id is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'link used or unknown' using errcode = 'P0002'; end if;
  return v_member;
end $$;
grant execute on function fy.claim_profile(text) to authenticated;

-- 3. New link no longer burns the older ones: every link already sent keeps working. Copy (p_new = false) still
--    returns the newest unused, unexpired link.
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
  insert into fy.claim_link (member_id, league_id, yard_id, expires_at)
  select id, league_id, yard_id, now() + make_interval(days => p_days) from fy.member where id = p_member_id
  returning token into v_token;
  return v_token;
end $$;
grant execute on function fy.issue_claim_link(uuid, boolean, int) to authenticated;
