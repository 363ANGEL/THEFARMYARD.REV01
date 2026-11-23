-- Page headers (RAY, 23 Nov): Admin > Pages uploads one header picture per page; a page shows it only
-- when one exists (no placeholder, no gap). Safe to re-run.
-- Run: node tools/db.mjs supabase/page-headers.sql   (from the site folder; LIVE WRITE, only after RAY's yes)
--
-- Five pages take a header: dashboard (Home), poker, humidor (its home tab only), wall, profile.
-- Storage: public bucket 'headers', object '<page_id>.jpg', overwritten on re-upload.
-- The row stores the public URL with ?v=<timestamp> so a re-upload busts caches.

-- 1. Storage: public read, leader-only writes (same shape as the icons bucket in icons.sql).
insert into storage.buckets (id, name, public) values ('headers', 'headers', true)
on conflict (id) do update set public = true;
drop policy if exists headers_public_read on storage.objects;
create policy headers_public_read on storage.objects for select using (bucket_id = 'headers');
drop policy if exists headers_leader_insert on storage.objects;
create policy headers_leader_insert on storage.objects for insert to authenticated with check (bucket_id = 'headers' and fy.is_leader());
drop policy if exists headers_leader_update on storage.objects;
create policy headers_leader_update on storage.objects for update to authenticated using (bucket_id = 'headers' and fy.is_leader()) with check (bucket_id = 'headers' and fy.is_leader());
drop policy if exists headers_leader_delete on storage.objects;
create policy headers_leader_delete on storage.objects for delete to authenticated using (bucket_id = 'headers' and fy.is_leader());

-- 2. The record: one row per page that has a header.
create table if not exists fy.page_header (
  page_id text primary key check (page_id in ('dashboard', 'poker', 'humidor', 'wall', 'profile')),
  url text not null,
  updated_at timestamptz not null default now()
);
alter table fy.page_header enable row level security;
drop policy if exists page_header_read on fy.page_header;
create policy page_header_read on fy.page_header for select to authenticated using (true);
revoke all on fy.page_header from anon, authenticated;
grant select on fy.page_header to authenticated;      -- writes only through the two RPCs below

-- 3. Set (or replace) a page's header. Leader only; the URL must be that page's own file in the headers bucket.
create or replace function fy.admin_set_page_header(p_page text, p_url text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text;
begin
  leader := fy._require_leader();
  if p_page is null or p_page not in ('dashboard', 'poker', 'humidor', 'wall', 'profile') then
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

-- 4. Clear a page's header. Leader only. The page then shows none; the admin page deletes the file after.
create or replace function fy.admin_clear_page_header(p_page text) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; v_old text;
begin
  leader := fy._require_leader();
  select url into v_old from fy.page_header where page_id = p_page;
  if v_old is null then raise exception 'that page has no header'; end if;
  delete from fy.page_header where page_id = p_page;
  perform fy._admin_log(leader.id, 'page_header', p_page, 'url', v_old, null);
end $$;

revoke all on function fy.admin_set_page_header(text, text), fy.admin_clear_page_header(text) from public;
grant execute on function fy.admin_set_page_header(text, text), fy.admin_clear_page_header(text) to authenticated;

notify pgrst, 'reload schema';
