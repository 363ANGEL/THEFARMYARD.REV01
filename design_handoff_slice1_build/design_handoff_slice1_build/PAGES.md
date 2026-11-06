# Page numbering & build status

**Revision: REV C03** (31 Oct 2026). REV C02 frozen in `_BACKUP 2026-10-27 REV C01 milestone/` and the archive folders. This project is the master for every page, Humidor included.

**Status key:** **SHIP** = slice 1, built now · **STUB** = in the nav, renders the Room Template holding view (`room` prop picks the copy) · **LATER** = designed, built in its own slice · **LIVE** = already on the web. Code reads these statuses from the rooms registry; nothing is forked.

Number = where the page sits on the member's path. One live version per page; older versions go to the archive.

## Slice 1 — SHIP
| # | Page | File | Notes |
|---|---|---|---|
| 0.0 | Coming Soon | `0.0 Coming Soon.dc.html` → `deploy/index.html` | Public holding page. Already LIVE at the-farmyard.com |
| 0.1 | Invite Door | `0.1 Invite Door.dc.html` | Discord sign-in via Supabase OAuth; claim-link entry |
| 0.3 | About | `0.3 About.dc.html` | Public About page. Copy of 2.0 Room Template (`room` = About). Placeholder copy until written · **SHIP in slice 1**; copy added during the build |
| 0.2 | New User Set-up | `0.2 New User Set-up.dc.html` | Yard name, logo pick, birthday, linked accounts |
| 1.0 | Barn Dashboard | `1.0 BARN DASHBOARD.dc.html` | Shell + sidebar + online strip |
| 2.0 | Room Template | `2.0 Room Template.dc.html` | Shell + online strip + Coming Soon block. `room` prop: New room / Poker / Football / Humidor / Calendar |
| 1.2 | Yard Wall | `1.2 Yard Wall.dc.html` | Basic post wall: composer, feed, heart, delete own, Hank pin. Under Home in the nav |
| 1.3 | Contribute | `1.3 Contribute.dc.html` | Buy Hank a coffee + lot auction, moved out of the holding rooms. Room Template shell embedding Coming Soon `section=contribute`. **Hidden** — not in the nav; reach by URL |
| 1.4 | What's next | `1.4 Whats Next.dc.html` | Room Template (`room` = What's next): cards for Arcade, Movie night, Jukebox, Whisky club, Chess club → their holding pages, plus the suggestion box. Sidebar "What's next?" header links here |
| 3.0 | Profile | `3.0 Barn Profile.dc.html` | One page, three views. **Own** (default): edit your profile, icon, ledger confirm/pay. **Public** (`?user=Name`): another member's outward view, private modules hidden. **Admin** (`?view=admin&user=Name`): everything editable, ledger/stat/pool −/+, icon upload, remove actions. Tweak `viewAs` to preview |
| 0.9 | Admin Dashboard | `0.9 Admin Dashboard.dc.html` | Tabs: Members · Humidor · Poker · League · Tokens & IOUs · Site. Members table with action icons |

Shared: `farmyard.css` (local layer over the Farmyard design system; carries the sign + sub-nav mirrors until the DS link refreshes), `humidor-club.js`, `assets/`.

## STUB in slice 1 (Room Template with `room` set)
- 2.1 Poker — `room="Poker"` (built in slice 2)
- 2.2 Football — `room="Football"` (built in slice 3; flag `FOOTBALL_ENABLED`)
- 4.0 The Humidor — `room="Humidor"` only if the static Humidor is not yet mounted under the shell; otherwise link out to the LIVE page
- 1.1 Calendar — `room="Calendar"`

## LATER
- **1.1 Calendar (Core)** — `1.1 Calendar.dc.html`. Next 4 weeks, poker nights, fixtures, birthdays, money events / savings goals.
- **2.1 Poker Room** — `2.1 Poker Room.dc.html`. Slice 2. PokerNow lobby + docket + league board + debts.
- **2.2 Football - Dashboard** — `2.2 Football - Dashboard.dc.html`. Slice 3. Landing: how it works, next 7 days, results.
  - 2.2.1 Football - Results — league tables, token standings, settle-up.
  - 2.2.2 Football - News — Football Scandal Sheet (needs a news feed).
- **4.x The Humidor** — 4.0 Humidor · 4.1 Vote · 4.2 Results · 4.3 Archive · 4.4 Admin. **LIVE** as a static page at https://the-farmyard.com/humidor.html (26 Oct 2026). Slice 2 brings it under the shell. Old `4.0 Cigars.dc.html` in `_ARCHIVE 2026-10-26 old humidor/`. Nothing flows back to P15.
- Arcade, Horseplay, News, Movie night, Jukebox, Whisky club, Chess club — not designed (holding rooms via 2.0 Room Template); see ROADMAP later slices.

## 9.x Reference (not member-facing, never built)
9.1 Colour Template · 9.2 Member Template · 9.3 Poker Logo Options · 9.4 Screen Sizes.

Old copies and sketches: `_ARCHIVE 2026-10-11/`.
