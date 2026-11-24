-- Run once: node tools/db.mjs supabase/menu-humidor-roll-own-item.sql  (safe to re-run)

-- Sidebar (RAY, 24 Nov): "The Humidor v2.0" is its own BETA TESTING item, not a sub-item of The Humidor v1.1,
-- so v1.1 can be removed later without untangling the two. Visibility stays admin (column default).
update fy.room set label = 'The Humidor v2.0', parent_id = null, sort = 50
where id = 'humidor-roll'
  and (label is distinct from 'The Humidor v2.0' or parent_id is not null or sort is distinct from 50);
