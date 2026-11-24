-- Run once: node tools/db.mjs supabase/menu-poker-school-label.sql  (safe to re-run)
-- Sidebar (RAY, 24 Nov): Poker's sub-page School is renamed Tips & Tutorials.
update fy.room set label = 'Tips & Tutorials' where id = 'poker-school' and label is distinct from 'Tips & Tutorials';
