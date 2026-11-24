-- Run once: node tools/db.mjs supabase/menu-humidor-roll-icon.sql  (safe to re-run)
-- The Humidor v2.0 used ph-cube, which is not inlined in farmyard.css and drew as a solid square. Use the Humidor's cigarette glyph.
update fy.room set icon = 'ph ph-cigarette' where id = 'humidor-roll' and icon is distinct from 'ph ph-cigarette';
