-- Cigar size photos (plan 39, RAY 24 Nov): the Humidor v2.0 chart opens a window with a size's catalogue
-- photo. The photos are retailer product shots, so they live ONLY in this private bucket, never in the
-- site repo (it is public on GitHub). Safe to re-run.
-- Run: node tools/db.mjs supabase/cigar-photos.sql   (from the site folder; LIVE WRITE)
--
-- Storage: private bucket 'cigars', object '<slot id>.<png|jpg>' (the catalogue filenames, e.g.
-- size-photo-parejo-robusto.png; the list is humidor-photos.js). Members read through signed URLs;
-- leaders upload from Humidor > Admin > Cigar photos. Nobody else writes.

insert into storage.buckets (id, name, public) values ('cigars', 'cigars', false)
on conflict (id) do update set public = false;

-- Read: signed-in members only (fy.is_member(): a member row is linked to this login). createSignedUrl
-- and list() both need select; anon has no policy, so the bare object URL is refused.
drop policy if exists cigars_member_read on storage.objects;
create policy cigars_member_read on storage.objects for select to authenticated using (bucket_id = 'cigars' and fy.is_member());

-- Writes: leaders only, the same shape as the icons and headers buckets.
drop policy if exists cigars_leader_insert on storage.objects;
create policy cigars_leader_insert on storage.objects for insert to authenticated with check (bucket_id = 'cigars' and fy.is_leader());
drop policy if exists cigars_leader_update on storage.objects;
create policy cigars_leader_update on storage.objects for update to authenticated using (bucket_id = 'cigars' and fy.is_leader()) with check (bucket_id = 'cigars' and fy.is_leader());
drop policy if exists cigars_leader_delete on storage.objects;
create policy cigars_leader_delete on storage.objects for delete to authenticated using (bucket_id = 'cigars' and fy.is_leader());
