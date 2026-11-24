-- Run once: node tools/db.mjs supabase/menu-football-page.sql  (safe to re-run)

-- Sidebar (RAY, 24 Nov): Football opens the built League page (football.html), not the room.html holding page.
-- The registry column is `path`. Status must leave 'stub' too: Barn.stubPath sends every stub row to
-- room.html?room=<id> whatever its path, so the rows go to 'live', as Poker and The Humidor are.
-- Results and News are sub-items of the same page. Labels (plan 33) and visibility (admin only) are untouched.
update fy.room set path = 'football.html', status = 'live'
where id in ('football', 'football-results', 'football-news')
  and (path is distinct from 'football.html' or status is distinct from 'live');
