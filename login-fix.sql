-- login-fix.sql — NOT run, NOT committed. Run once in the Supabase SQL editor; idempotent.
-- Cause: fy.me() built a fy.member row by position (19 columns). icons.sql (icon_slot) and yard.sql (yard_id) appended columns to
-- fy.member, so fy.me() now errors ("returns too few columns"), the page reads that as "no member row" and sends everyone to claim.html.
-- Fix: fy.me() no longer depends on column order or count. discord_id stays hidden (null), as before.
-- Match order: user_id = auth.uid() first, then discord_id, then invite_email (fallbacks only for rows not linked to anyone).

create or replace function fy.me() returns fy.member
language sql stable security definer set search_path = fy, public as $$
  select (jsonb_populate_record(null::fy.member, to_jsonb(m) - 'discord_id')).*
  from fy.member m
  where m.user_id = auth.uid()
     or (m.user_id is null and (
          (m.discord_id is not null and m.discord_id in
             (select i.provider_id from auth.identities i where i.user_id = auth.uid() and i.provider = 'discord'))
       or (m.invite_email is not null and m.invite_email =
             (select lower(u.email) from auth.users u where u.id = auth.uid()))))
  order by (m.user_id = auth.uid()) desc nulls last,
           (m.discord_id is not null) desc
  limit 1;
$$;
grant execute on function fy.me() to authenticated;
