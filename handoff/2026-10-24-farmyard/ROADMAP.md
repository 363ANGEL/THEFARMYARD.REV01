# Farmyard — Launch Roadmap

Domain: **the-farmyard.com**, registered at GoDaddy (domain only, no hosting). The business site (green-tower.uk) is hosted on Squarespace and stays untouched.

**Format:** a website, used in a desktop browser first. Mobile browsers get a usable responsive layout. A Windows desktop app comes later as a wrapper around the same site (see Phase 4). A native phone app is out of scope.

## Hosting (confirmed)

GoDaddy only holds the domain names; there's no GoDaddy server. That makes this simple:

- **Frontend**: the Farmyard website, hosted free on **GitHub Pages**. The code lives on GitHub anyway, and every push auto-deploys. (Vercel is the fallback if we ever need preview links per change.)
- **Backend**: **Supabase** (free tier) for logins, database, realtime and file storage. Secret keys (e.g. Spotify) go in **Supabase Edge Functions**, never in the website code, because GitHub Pages can't hide secrets.
- **Bots/jobs** (Phase 2+): a small Node worker on Railway or Fly.io (~£5/mo) for the Discord bot and Spotify token refresh.
- **Go-live**: in GoDaddy → the-farmyard.com → DNS, add four A records (185.199.108.153, .109.153, .110.153, .111.153) and a `www` CNAME → `<your-github-username>.github.io`. Then set the custom domain in the repo's Pages settings and tick "Enforce HTTPS". This takes about 10 minutes.
- **Ignore** GoDaddy's "Managed WordPress" free trial; it isn't needed.

---

## Phase 0 — Foundations (week 1)
- [ ] Move design → real website codebase (Vite + React or plain TS), repo on GitHub
- [ ] Supabase project; tables: `members`, `farms`, `rooms`, `posts`, `scores`
- [ ] DNS: the-farmyard.com → GitHub Pages
- [ ] Neon theme ported as CSS variables

## Phase 1 — MVP launch (weeks 2–4) · low-hanging fruit
| Feature | Why it's easy |
|---|---|
| **Login with Discord** | Supabase built-in OAuth; everyone already has Discord |
| **Members list + online status** | Supabase presence |
| **Message board** | One table + realtime subscription |
| **Voice = Discord deep links** | "Join Lounge" opens the Discord channel. No bot needed yet |
| **Neon Snake + yard leaderboard** | Already written; just save scores to `scores` |
| **Doom / Super 6 / Chess boards — manual entry** | Admin form fills the tables; no APIs |

**Launch criteria:** a member can log in, see who's around, post, jump into Discord voice, play Snake, and see the leaderboards.

## Phase 2 — Live connections (weeks 5–8)
- [ ] Discord bot: live voice-channel presence ("Lounge · 5 in")
- [ ] Chess.com club API (public, no key) → auto-update the chess table
- [ ] Worms lobbies as a board: host/join/ladder, launches Steam

## Phase 3 — Media (weeks 9–12)
- [ ] Jukebox: shared queue in DB + Spotify OAuth + Web Playback SDK sync (Premium listeners)
- [ ] Movie night: votes + schedule; Plex link-out
- [ ] Instagram: members link accounts (Basic Display is retired, so this means Graph API or manual post links). **Highest friction, so it goes last.**

## Phase 4 — Windows app (after the website is stable)
Wrap the same website in **Tauri** (small, ~10 MB installer) or **Electron** (what Discord uses; bigger but simpler). One codebase serves both, so nothing gets rebuilt.

What the Windows app adds that a browser can't do:
- [ ] System tray icon, start with Windows, desktop notifications ("Dmitri opened a Worms lobby")
- [ ] Launch local games directly (Steam URLs, Doom source ports, Worms)
- [ ] Detect what each member is playing and show it in the yard
- [ ] Global hotkeys (push-to-talk, skip track)
- [ ] Possibly an in-game overlay (hard, so it goes last)

Distribute as a download from the-farmyard.com with auto-updates.

## Aspirational / later
- Doodle board (solo, multiplayer, AI doodle). Parked 11 Oct 2026
- Super 6 auto-sync (no public API; would need scraping, so it stays manual)
- In-app voice (LiveKit) instead of Discord
- Multiple farms (servers) per member
- Native phone app (only if the website takes off; until then, mobile browsers use the responsive site)
- Mac/Linux builds of the desktop app (Tauri supports them from the same code)

## Open questions
1. GoDaddy plan type: shared cPanel or VPS?
2. Who's coding: you, a dev, or Claude Code?
3. Expected members at launch (10? 100?)
4. Invite-only or open sign-up?
