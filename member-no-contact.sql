-- member-no-contact.sql — idempotent. Drops the "give an invite email or a Discord username"
-- rule from fy.create_member. That rule predates invite-by-link (9 Nov: no email service, email
-- optional), and it blocks a member row made only to test pages with. Nothing else changes:
-- same signature, same league and yard, same insert.

create or replace function fy.create_member(p_nickname text, p_avatar text, p_invite_email text default null,
  p_discord_username text default null, p_mobile text default null, p_role text default 'member')
returns uuid language plpgsql security definer set search_path = fy, public as $$
declare v_id uuid; v_role text := lower(btrim(coalesce(nullif(p_role, ''), 'member')));
begin
  perform fy._require_leader();
  if v_role !~ '^[a-z][a-z_]{1,23}$' then raise exception 'that is not a valid role'; end if;
  -- No contact needed: the member is reached by a claim link, or is only ever previewed.
  insert into fy.member (league_id, yard_id, nickname, avatar, invite_email, discord_username, mobile, role)
  values (fy._league(), fy.my_yard(), btrim(p_nickname), coalesce(p_avatar, 'hen'),
          nullif(btrim(coalesce(p_invite_email, '')), ''), nullif(btrim(coalesce(p_discord_username, '')), ''),
          nullif(btrim(coalesce(p_mobile, '')), ''), v_role)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function fy.create_member(text, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
