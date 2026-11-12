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
- **Entry points (6 Nov):** About → small teal link "About the yard" at the very bottom of the sidebar, under the profile button, every member. Admin → shield icon button beside the profile button, shown only when `members.is_admin`; opens 0.9. Also linked from the Profile admin banner ("← Back to admin").

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
| `members` | id, discord_id, yard_name, tagline, birthday, is_admin, icon_slot, created_at | `icon_slot` 1–15 = pick from that member's own palette |
| `member_links` | id, member_id, provider, handle, verified_at, enabled | Steam and Chess.com show "Coming soon" (disabled) |
| `invites` | token, member_id, created_by, expires_at, used_at | Single use |
| `rooms` | id, label, path, icon, status | Registry; `stub` mounts 2.0 |
| `icon_palette` | member_id, slot (1–15), yard_id, image_url, updated_by | PK (member_id, slot). Admin uploads per member; Storage `icons/<member_id>/slot-N.png` |
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


## 11. Member view and admin view (added 6 Nov 2026)
Design: `1.5 Member and Admin Views.dc.html`. One site, one login; role decides what shows.

- **Admin entry:** under **Home** in the sidebar (after Calendar and Yard wall), a sub-item **Admin** (shield-check), visible only when `role = 'leader'` or `is_admin`. It opens the existing Admin page; its tabs (Members, Humidor, Poker, League, Tokens & IOUs, Site) stay on that page. No separate Admin section. Remove the shield button beside the Profile button.
- **Beta-testing section is admin-only for now:** Football, The Humidor (with Vote, Results, Archive) and What's Next are hidden from members, in the sidebar and as dashboard room cards. Admins see the section headed "Beta-testing · not visible to users yet". Drive it from a single flag per room in the rooms registry (`visibility = 'admin'` vs `'members'`); flipping a room to `'members'` releases it with no code change. The Humidor "Admin" sub-item moves into the Admin page's Humidor tab. Direct URLs to hidden rooms redirect members to dashboard.html.
- **View as member:** a second Home sub-item for admins, after Admin. It sets `sessionStorage fy.viewAs = 'member'` and hides every admin-only element (Admin item, Needs-you card, admin profile view). While on, a dashed banner reads "Previewing what a member sees. Nothing here is saved or changed." with a "Back to admin" button on the right; the sidebar shows exactly what a member sees. UI only: it never changes the real role.
- **Dashboard (admin):** "Needs you" card above the room cards: unclaimed invites (names), payments awaiting Received. Links to Admin. Hidden from members and in member preview.
- **Profile:** other members open in admin view (editable) for admins; public view for members and in member preview.
- **Security:** pages hide admin UI by role and also check `fy.is_leader()` on load; the database refuses admin RPCs for non-leaders (already in place from the invite-only lockdown). The UI hiding is not the protection.
- Non-admins never see the toggle.
- **About the yard** is the FIRST Home sub-item, visible to everyone (members and admins), above Calendar and Yard wall. Order under Home: About the yard, Calendar, Yard wall, then (admins) Admin, View as member. Remove the standalone link at the bottom of the sidebar. Icon: `ph-question`.
- **Launch scope (7 Nov 2026): members get only Home (the Dashboard) and the Poker room.** Calendar, Yard wall, About the yard, Football, The Humidor (and Vote/Results/Archive) and What's Next are admin-only: hidden from the sidebar and the dashboard room cards, and direct URLs redirect members to dashboard.html. Admins see them, marked "admin" under Home and under the heading "Beta-testing · not visible to users yet". Driven by `rooms.visibility` ('admin' | 'members'); only `home` and `poker` are 'members'. This supersedes the earlier "About the yard visible to everyone" line. Profile, voice and "In the yard" stay for everyone.
- **View as dropdown (supersedes the "View as member" sub-item):** on every page, in the top-right of the page header (before any tags/buttons), admins only: a select labelled "View as" with Admin and Member. Value stored in `sessionStorage fy.viewAs`; Member hides all admin-only UI and shows the dashed preview banner with a Back to admin button; the dropdown stays visible so the admin can switch back from any page. Not rendered for members. Icon `ph-user-circle-gear`. Remove the Home sub-item "View as member".
- **Design pages:** every member-facing design page at the project root (0.3, 1.0, 1.1, 1.2, 1.3, 1.4, 2.0, 2.1, 2.2.x, 3.0) has a `roleView` Tweaks dropdown (Admin / Member) next to the device switch, driven by `view-as.js` (project root). Member hides everything except Home and Poker and shows a pill saying what a member sees. Preview aid only; the build implements it per section 11.
- **Icon palette = 15 slots per member** (3.0 Profile "Your icon", 0.9 Admin Icon palette). Profile shows them as a 5 × 3 grid; Admin uploads one logo per slot. Anything that assumed 8 or 10 slots (admin.js copy "Eight pre-made logos", any `icon_slot` check constraint, `fy.icon.N` keys, profile.html grid) moves to 15.
- **Admin view of Profile, icon slots:** clicking a slot circle opens a small dialog: **Select** (sets that image as the member's icon and closes) or **Replace** (the dialog changes to "Choose file…", which opens the browser's standard file picker; the chosen image replaces the slot and the dialog closes). Cancel / click outside closes. Members and own view: clicking a slot selects it directly, as before.


## Role label (9 Nov 2026)
The on-screen label for the `leader` role is **Admin** (tags, dropdowns, copy). The stored value stays `leader` and `fy.is_leader()` keeps its name, so no schema change. Member stays Member.

## Icon palette, simplified (9 Nov 2026)
- **Per member (10 Nov 2026, replaces the shared palette):** every member has their **own** 15 slots. Admin (0.9 Icon palette): pick the member in the card's Member dropdown, and the 15 slots below refresh to that member's set. **Upload image** fills that member's lowest free number (1 to 15). Click a filled picture to set it as their current icon. Each filled picture has a remove button; removing frees its number. No Select/Replace dialog.
- **Profile order (11 Nov 2026):** on 3.0 Profile the Your icon box sits directly under the header card, and the stats row (Poker league position, Football league, All time net, Current debt, Pending due) moves below it.
- **Icons belong to the character (11 Nov 2026, REPLACES per member):** each animal has its own 15 slots. 0.9 Icon palette dropdown is labelled **Character** and lists animal names only (no member names), all selectable, including free ones. Admin assigns animals to members in the Members table. A member's profile shows the 15 slots of the animal they hold; if they change animal, they get that animal's set. Data: `icon_palette` keyed by (character_id, slot) with yard_id; Storage `icons/<character_id>/slot-N.png`. `members.icon_slot` points into their current animal's set (clear it when the animal changes).
- **Members table (11 Nov 2026):** columns fit the page width (no fixed min-width). New **Character** column between Online and Last login: a per-row dropdown of None plus every animal; animals held by others show "· holder" and are disabled. Changing it frees the old animal, assigns the new one and saves instantly. Clicking it doesn't open the profile.
- Members (3.0 Profile, Your icon) see a **5 × 3 box of all 15 of their slots** (11 Nov 2026, replaces "only filled slots"). Filled slots show the admin-uploaded image; click one to select it (`set_my_icon`). The current pick has a green tube border and glow. Empty slots show as a dim numbered teal ring and can't be picked. Never show characters in this box.
- Storage: Supabase Storage `icons/<character_id>/slot-N.png`; `icon_palette` rows keyed by (character_id, slot), only for filled slots. `member.icon_slot` stays 1 to 15 and must point at a filled slot of the animal that member holds (clear it when that slot is removed, or when their animal changes). *(Superseded the per-member line on 11 Nov 2026; built in `icons-per-character.sql`.)*

## Invite by link (9 Nov 2026)
No email service. Admin, Add member: email optional; no email invite button. Each unclaimed member has **Copy invite link**: creates or reuses a `fy.claim_link` token (single use, 7-day expiry, admin's yard) and copies `https://the-farmyard.com/claim.html?claim=<token>` for WhatsApp or Messenger, with "Link copied" for 2s and a **New link** option that voids the old token. Claiming binds the Discord login to the member (`user_id`, `discord_id`, `discord_username`, `claimed`), stamps `used_at`, then goes to setup. Expired or used link: "This link has expired. Ask Hank for a new one." Invite-only gate admits a known member or a valid claim token; nothing else.

## Characters admin (9 Nov 2026)
0.9 Admin, Characters: one row per animal with an editable name (saves on leave; names unique within the yard; slug never changes), a Free/Taken-by status (live), Free it (admin, with confirm), Delete (blocked while held: 'Held by <name>'), and Add animal. Animals are per yard (`fy.characters.yard_id`), one member per animal (unique `(yard_id, character_id)`). Dropdowns elsewhere grey out taken animals with the holder's name.
