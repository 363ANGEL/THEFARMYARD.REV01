-- Run once: node tools/db.mjs supabase/menu-about-humidor-beta.sql  (safe to re-run)
-- Live write: run only after RAY says yes.

-- Sidebar (RAY, 23 Nov): the Home item "About the yard" reads "About", and The Humidor leaves Home
-- for the BETA TESTING section. The beta group lists only top-level rooms, so the Humidor's parent
-- is cleared; its own sub-pages (Vote, Results, Archive, Admin) keep parent_id = 'humidor' and follow it.
-- Visibility (Admin > Pages) is untouched: the Humidor stays admin only until RAY flips it.
update fy.room set label = 'About' where id = 'about' and label is distinct from 'About';
update fy.room set grp = 'beta', parent_id = null where id = 'humidor' and (grp is distinct from 'beta' or parent_id is not null);
