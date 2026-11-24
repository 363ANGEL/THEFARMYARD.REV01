-- Run once: node tools/db.mjs supabase/menu-humidor-roll.sql  (safe to re-run)

-- Sidebar (RAY, 24 Nov): "Roll your own v2.0", the Claude Design Humidor taste picker with the 3D cigar,
-- sits under The Humidor beside Vote. Visibility is left to the column default ('admin'), like its
-- siblings. Note: Admin > Pages cascades a parent's visibility to its children, so flipping The Humidor
-- to members exposes this preview too; set it back to admin there if that is not wanted.
insert into fy.room (id, label, path, icon, status, grp, parent_id, sort) values
  ('humidor-roll', 'Roll your own v2.0', 'humidor-roll.html', 'ph ph-cube', 'live', 'beta', 'humidor', 45)
on conflict (id) do nothing;
