# Slice 1 — the spine · build handoff

Source of truth: this design project (REV C03). Scope and launch criteria: `ROADMAP.md` → Slice 1. Page list: `PAGES.md`.

## 1. Scope

Build in this order:

1. Auth: Discord OAuth via Supabase, claim-link invite flow.
2. App shell: teal frame, 232px sidebar, main nav, sub-nav, responsive (desktop / tablet / phone).
3. Rooms registry drives the sidebar.
4. Online strip: presence-driven list.
5. Pages: 0.0 Coming Soon, 0.3 About (layout only; copy is written during the build), 0.1 Invite Door, 0.2 New User Set-up, 1.0 Dashboard, 1.2 Yard Wall, 1.4 What's Next, 2.0 Room Template (stubs), 3.0 Profile (3 views), 0.9 Admin.

Football stays in slice 3: in slice 1 its nav item (under Beta-Testing) opens the Room Template stub. Out of scope for slice 1: Humidor, Poker, Football, Calendar, Arcade, Movie night, Jukebox, Whisky club, Chess club (stubs only), Discord bot, Spotify, football API.

## 2. Sidebar (same on every page)

- **Home:** Dashboard · Calendar · Yard wall
- **Leagues:** Poker
- **Beta-Testing:** Football (Results · News) · The Humidor (Vote · Results · Archive · Admin)
- **What's Next?** (thought-bubble icon) → 1.4 What's Next. The five holding rooms are cards on that page, not sidebar items.
- Then In the yard (online strip), Voice channel, profile button.

## 3. Auth and claim flow

- **Login:** Discord is the only identity key. Supabase Auth with the Discord provider. No passwords.
- **Invites:** admin creates a member row and an `invites` row with a random single-use token and an expiry. Claim link = `/0.1?claim=<token>`.
- **Claim:** 0.1 validates the token, runs Discord OAuth, then 0.2 collects yard name, icon pick, birthday and linked accounts. On submit `members.discord_id` is set and `invites.used_at` stamped.
- **Session guard:** every page except 0.0 and 0.1 requires a session.
- **Admin flag:** `members.is_admin`, enforced in RLS, not only in the UI.

## 4. Money

One currency: tokens (tk). 1 tk = £1. Never store £.

- Poker: a seat is 5 tk, every re-buy another 5 tk (PokerNow 10,000 chips = 5 tk). The site records buy-ins only.
- **Net, not per game.** Every win or loss writes one `iou` row. A member's position with another member is the sum across all rooms. Profiles show the net with a per-room breakdown on hover.
- Pay opens the payee's revolut.me page (from their Revolut linked account) and copies the amount. Revolut doesn't document a way to pre-fill the amount through a link. The payee confirms receipt ("Received?" → Confirm).

## 5. Tables

| Table | Key columns | Notes |
|---|---|---|
| `members` | id, discord_id, yard_name, tagline, birthday, is_admin, icon_slot, created_at | `icon_slot` 1–10 = palette pick |
| `member_links` | id, member_id, provider, handle, verified_at, enabled | Steam and Chess.com show "Coming soon" (disabled) |
| `invites` | token, member_id, created_by, expires_at, used_at | Single use |
| `rooms` | id, label, path, icon, status | Registry; `stub` mounts 2.0 |
| `icon_palette` | slot (1–10), image_url, updated_by | Admin uploads; Supabase Storage `icons/slot-N.png` |
| `iou` | id, from_member, to_member, tk, room, source_ref, created_at, received_at | One row per win/loss. Net = sum per pair |
| `dockets` | id, no, night_date, winner_id, filed_by, created_at | Poker night |
| `docket_players` | docket_id, member_id, buy_ins | Pot = Σ buy_ins × 5 tk |
| `pools` | id, fixture, kickoff, result (null = open) | Football (table now, UI slice 3) |
| `pool_calls` | pool_id, member_id, call, stake, payout | |
| `admin_edits` | id, admin_id, table, row_id, field, old, new, created_at | Audit log for every admin change |
| `posts` / `post_likes` | as before | Yard Wall |
| `group_events` | id, title, date, cost, pot | Table only; piggy/savings hidden (`PIGGY_ENABLED = false`) |

## 6. Profile — one page, three views (`3.0 Barn Profile`)

| View | URL | Shows | Edits |
|---|---|---|---|
| Own | default | Header, stats row, icon palette, ledger, pools, recent actions, settle, linked accounts | Name, tagline, icon pick, linked accounts, Confirm received, Pay |
| Public | `?user=Name` | Header, stats row, recent actions (with docket/pool roll-downs) | Nothing |
| Admin | `?view=admin&user=Name` | Everything in Own, for that member | Own edits plus −/+ on ledger, stats, pool scores; icon upload; remove actions |

Stats row: poker league position, football league, all-time net, current debt (Σ you owe), pending due (Σ owed to you, not yet received).

## 7. Admin (0.9)

- **Members:** click a row → Profile admin view. Icon palette (upload per slot, set a member's pick). Ledger corrections.
- **Poker:** Filed dockets table: edit buy-ins and winner, delete with confirm.
- **League:** Football pools table: edit full-time result and each payout, delete with confirm.
- **tk & IOUs:** net position per member plus the full IOU entry table (−/+ and delete).
- **Saving:** admin edits save immediately, with no save button. Log each change to `admin_edits`.

## 8. Presence and online strip

- Supabase Realtime presence channel `yard`: `{ member_id, status, in_voice }`.
- Status: `online`, `away` (dimmed), `off`; voice shows LIVE.
- Each row: avatar + IOU dot (red owes · amber owed · green settled), rank chips, all-time tk.
- Clicking any avatar on the Dashboard opens that member's Public profile; your own opens the Own view.

## 9. RLS

Members read public profile fields for everyone; `member_links` owner + admin; `iou` the two parties + admin; `invites`, `admin_edits`, `icon_palette` writes admin only.

## 10. Launch acceptance

- A member claims their link, signs in with Discord, sees who's online, opens their Profile.
- Every nav item works or shows its stub; What's Next lists the holding rooms.
- Admin can create a member, send a claim link, and correct any docket, pool or IOU.

## 11. Notes for the build

- Sample data lives in each page's script and in `localStorage` keys (`fy.ledger`, `fy.dockets`, `fy.pools`, `fy.ious`, `fy.iconPicks`, `fy.icon.N`, `fy.memberEdits`). Replace with queries; don't copy the arrays.
- About 25 glyphs are hand-drawn masks in `farmyard.css`. Swap them for Phosphor or design-system icons.
- The "Under construction" sign and room signs use the `.fy-sign` classes (temporary mirror in `farmyard.css`).
