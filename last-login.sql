-- last-login.sql — idempotent. Adds the Last login column the Admin Members table shows.
-- Stamped by fy.touch_login(), which the page calls once when Discord signs someone in.

alter table fy.member add column if not exists last_login timestamptz;

-- fy.member is read through column grants, so the new column needs its own.
grant select (last_login) on fy.member to authenticated;

create or replace function fy.touch_login() returns void
language plpgsql security definer set search_path = fy, public as $$
begin
  update fy.member set last_login = now() where user_id = auth.uid();
end $$;

grant execute on function fy.touch_login() to authenticated;

notify pgrst, 'reload schema';
