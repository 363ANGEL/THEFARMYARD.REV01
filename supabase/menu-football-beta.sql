-- Run once: node tools/db.mjs supabase/menu-football-beta.sql  (safe to re-run)
-- Live write: run only after RAY says yes.

-- Sidebar (RAY, 23 Nov): Football leaves Home for the BETA TESTING section, as The Humidor did
-- (menu-about-humidor-beta.sql). The beta group lists only top-level rooms, so its parent is cleared;
-- its own sub-pages (Results, News) keep parent_id = 'football' and follow it.
-- Visibility (Admin > Pages) is untouched: Football stays admin only until RAY flips it.
update fy.room set grp = 'beta', parent_id = null where id = 'football' and (grp is distinct from 'beta' or parent_id is not null);
