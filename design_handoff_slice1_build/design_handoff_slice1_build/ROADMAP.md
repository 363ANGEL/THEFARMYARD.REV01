# Farmyard — Launch Roadmap (REV C03, 31 Oct 2026)

Domain: **the-farmyard.com**, registered at GoDaddy (domain only). The business site (green-tower.uk) is Squarespace and stays untouched.

**Format:** a website, desktop browser first; mobile browsers get the same layout scaled by type tokens. A Windows wrapper app comes later (Phase 4). No native phone app.

## Hosting (confirmed)
- **Frontend:** GitHub Pages, auto-deploys on push. Repo `C:\Users\PinkyC\THEFARMYARD.REV01`. (Vercel is the fallback for per-change preview links.)
- **Backend:** Supabase free tier — Discord OAuth, Postgres, realtime presence, storage. Secrets (Spotify, football API) live in Supabase Edge Functions, never in the site.
- **Bots/jobs (slice 3+):** small Node worker on Railway or Fly.io (~£5/mo) for the Discord bot, football settlement, Spotify refresh.
- **Go-live DNS:** GoDaddy → the-farmyard.com → four A records (185.199.108.153 / .109.153 / .110.153 / .111.153) + `www` CNAME → `<github-username>.github.io`; set the custom domain in the repo's Pages settings; tick Enforce HTTPS. Already done for the Coming Soon page and the static Humidor.
- Ignore GoDaddy's Managed WordPress trial.

---

## Build order — slices, not forks
One repo, one design source (this project + the Farmyard design system). Each room is a route + folder. A **rooms registry** (`{ id, label, path, icon, status: 'ship'|'stub'|'later'|'live' }`) drives the sidebar; `stub` rooms mount the Room Template with the matching `room` copy. Design stays one slice ahead of code. Per-page statuses live in `PAGES.md`.

### Slice 1 — the spine (build now) · SHIP
- Discord login (Supabase OAuth) → claim-link invite flow (0.1 Invite Door → 0.2 New User Set-up).
- App shell: teal frame, 232px sidebar, main nav (`fy-nav-item`), sub-nav (`fy-nav-sub`), neon signs (`NeonSign`), responsive (desktop / tablet / phone via the `view` logic).
- **Online strip** in the sidebar: presence-driven list, 36px avatar + IOU dot (red owes · amber owed · green settled), rank chips (♣ poker · ⚽ football, ordinal), all-time tokens (won minus paid).
- 1.0 Dashboard, 2.0 Room Template (+ stubs for Poker, Football, Humidor, Calendar), 3.0 Profile, 0.9 Admin (Members · Humidor · Poker · League · Tokens & IOUs · Site), 0.0 Coming Soon.
- **1.2 Yard Wall** (added 4 Nov) — basic only: post text (≤280), feed newest-first, one reaction, delete own, admin pin/delete. No images, replies, notifications or search. Realtime via Supabase.
- Tables: `members`, `member_links`, `invites`, `rooms`, `iou`, `yard_points`, `group_events`, `posts`, `post_likes`.
- **Launch criteria:** a member claims their link, signs in with Discord, sees who's online, opens their Profile, and every room in the nav either works or shows its stub. Admin can create a member and send a claim link.

### Slice 2 — Humidor then Poker
- Mount the static Humidor (LIVE) under the shell (4.0–4.4). Then 2.1 Poker: PokerNow lobby, checklist, docket, league board; IOUs post to Profile. Backend spec in `HANDOFF-POKER.md`.

### Slice 3 — Football
- Mobile layout needs a redesign before launch (fixtures table and roll-downs don't fit phone width). Parked until slice 3 (noted 6 Nov).
- 2.2 Dashboard + 2.2.1 Results + 2.2.2 News. One pool per match (lean spec in BUILD-PLAN). Football data API via Edge Function, cached; settlement job at full time. Flag `FOOTBALL_ENABLED`.

### Later slices
- 1.1 Calendar (core + money events + savings goals), Arcade (Neon Snake, boards, Worms/Steam lobbies), Horseplay, News, Movie night, Jukebox, Discord bot presence, Chess.com sync. Each plugs into the yard points table below.

---

## Yard points — earning table (participation, only ever goes up)
| Room | Action | Points |
|---|---|---|
| Humidor / whisky | Round joined | +1 |
| Poker | Night played | +1 |
| Poker | Night won | +2 |
| Football | Call locked | +1 |
| Football | Exact score | +2 |
| Arcade | Personal best | +1 |
| Arcade | Top of a cabinet | +3 |
| Horseplay | TBD | — |

One currency: tokens. The online strip shows each member's all-time position (tokens won minus tokens paid). Yard points are retired from the strip; the table below is kept only if the participation counter is revived. Leagues keep rank chips (competition); points are participation. New rooms add rows here, nothing else changes.

---

## Phase 4 — Windows app (after the site is stable)
Wrap the same site in **Tauri** (preferred, ~10 MB) or Electron. Adds: tray icon + start with Windows + notifications, launch local games (Steam/Doom/Worms), show what each member is playing, global hotkeys, maybe an overlay (last).

## Aspirational / parked
Doodle board (parked 11 Oct) · Super 6 auto-sync (manual only) · in-app voice (LiveKit) · multiple farms per member · native phone app · Mac/Linux builds.

## Decided (no longer open)
- Poker buy-in: 5 tk per seat, 5 tk per re-buy (PokerNow 10,000 chips = 5 tk). Site records buy-ins only.
- Football stays slice 3; shown under Beta-Testing in the nav as a stub until then.
- Who codes: Claude Code, from this project's hand-off.
- Sign-up: invite-only, admin-created profiles + claim links.
- Login: Discord is the only key (see BUILD-PLAN for the earlier "Farmyard login" note, superseded).
- Hosting: GitHub Pages + Supabase; no GoDaddy server.

## Open
- Expected members at launch (10? 100?) — affects presence polling only.
- League Manager admin (Group events form: title, date, time, cost each, pot) — slice 2 or later; feeds Profile → My piggy and Calendar savings goals.
- UK private-gaming legal check on the savings skim before poker/football go live.
