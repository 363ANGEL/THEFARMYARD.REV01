-- Run once: node tools/db.mjs supabase/humidor-roll-members.sql  (safe to re-run)
-- RAY, 26 Nov: The Humidor v2.0 page (and so its Home card) is open to members.
update fy.room set visibility = 'members' where id = 'humidor-roll' and visibility is distinct from 'members';
