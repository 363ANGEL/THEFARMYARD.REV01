-- Run once: node tools/db.mjs supabase/page-headers-humidor-roll.sql  (safe to re-run)
-- The Humidor v2.0 gets a header slot and a Home card (RAY, 26 Nov).
alter table fy.page_header drop constraint if exists page_header_page_id_check;
alter table fy.page_header add constraint page_header_page_id_check check (page_id in ('dashboard', 'poker', 'humidor', 'humidor-roll', 'wall', 'profile'));

create or replace function fy.admin_set_page_header(p_page text, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text;
begin
  leader := fy._require_leader();
  if p_page is null or p_page not in ('dashboard', 'poker', 'humidor', 'humidor-roll', 'wall', 'profile') then
    raise exception 'that page does not take a header';
  end if;
  if p_url is null or p_url !~ ('^https://[^/]+/storage/v1/object/public/headers/' || p_page || '\.jpg(\?v=[0-9]+)?$') then
    raise exception 'that is not the headers bucket file for %', p_page;
  end if;
  select url into v_old from fy.page_header where page_id = p_page;
  insert into fy.page_header (page_id, url, updated_at) values (p_page, p_url, now())
  on conflict (page_id) do update set url = excluded.url, updated_at = now();
  perform fy._admin_log(leader.id, 'page_header', p_page, 'url', v_old, p_url);
end $$;
