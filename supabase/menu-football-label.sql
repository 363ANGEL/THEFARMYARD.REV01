-- Run once: node tools/db.mjs supabase/menu-football-label.sql  (safe to re-run)

-- Sidebar (RAY, 24 Nov): the Football menu item reads "Football v1.0" and The Humidor reads "The Humidor v1.1".
-- Labels only: grp, parent_id and visibility are untouched. The seed in schema.sql is "do nothing"
-- on conflict and room-visibility.sql never sets a label, so neither re-run reverts this.
update fy.room set label = 'Football v1.0' where id = 'football' and label is distinct from 'Football v1.0';
update fy.room set label = 'The Humidor v1.1' where id = 'humidor' and label is distinct from 'The Humidor v1.1';
