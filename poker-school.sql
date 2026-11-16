-- Poker School as a sub-page of Poker (RAY, 15 Nov 2026).
--
-- The video feed used to sit at the foot of the Poker Room. The room page is for running a
-- game; the school is for watching one later, so it gets its own page. The page and its
-- script are already in the repo (poker-school.html, poker-school.js) and work the moment
-- this row exists -- the sidebar is built from fy.room, so without the row there is no way in.
--
-- The icon must be one the site actually has. Glyph names are inlined as CSS masks in
-- farmyard.css, and a name that is not there draws as a solid black square -- which is
-- exactly what ph-graduation-cap did on the first run. ph-spade is in the set and sits
-- with the club above it in the nav.
--
-- Idempotent: safe to run twice. Nothing else is touched.

-- visibility matters: the column defaults to 'admin', and barn.js bounces a non-leader off
-- any page that is not 'members'. Poker itself is 'members', so the school must be too, or
-- the crew would see nothing and the row would be a leader-only door.

insert into fy.room (id, parent_id, label, icon, path, status, grp, sort, visibility)
values ('poker-school', 'poker', 'School', 'ph ph-spade', 'poker-school.html', 'live', 'leagues', 21, 'members')
on conflict (id) do update
  set parent_id  = excluded.parent_id,
      label      = excluded.label,
      icon       = excluded.icon,
      path       = excluded.path,
      status     = excluded.status,
      grp        = excluded.grp,
      sort       = excluded.sort,
      visibility = excluded.visibility;

-- Check: the Leagues group should read Poker, then School under it.
-- select id, parent_id, label, path, status, sort from fy.room where grp = 'leagues' order by sort;
