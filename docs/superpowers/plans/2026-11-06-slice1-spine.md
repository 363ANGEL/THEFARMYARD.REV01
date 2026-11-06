# Slice 1 — The Spine · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 1 of The Farmyard (auth + claim flow, app shell + registry-driven sidebar, presence, and the ten slice-1 pages) on the existing live Supabase `fy.*` schema.

**Architecture:** Static multi-page site (GitHub Pages) + Supabase (`fy` schema, Discord OAuth, Realtime, Storage). **Strategy decided with RAY: extend the live `fy.*` schema — never rename or migrate tables the LIVE Humidor/Poker use; the handoff §5 table names are concepts, mapped as:** `members`→`fy.member` (admin = `role='leader'`), `invites`→`fy.claim_link`, `iou`→`fy.iou` (received ≈ state `confirmed`; netting via `fy.netting()`), `icon_palette`→`fy.member_logo` (per-member slots 1–8, kept), `dockets`/`docket_players`→`fy.event`+`fy.iou` via `fy.poker_file_docket`. Slice-1 pages are rebuilt in place from the REV C03 designs, replacing the root files at the same URLs; Humidor/Poker pages untouched.

**Tech Stack:** Plain HTML/CSS/JS (no framework, no bundler, matching repo convention), supabase-js v2 UMD from CDN, `farmyard-design-system/styles.css` + handoff `farmyard.css`, Phosphor icons.

**Spec:** `design_handoff_slice1_build/design_handoff_slice1_build/HANDOFF-SLICE1.md` (+ `README.md`, `PAGES.md`, `ROADMAP.md` in the same folder). Designs: `design/` beside them — the `_ds/farmyard-design-system-f1e07c7c-…/` path in those files maps to `farmyard-design-system/`.

## Global Constraints

- One currency: tokens (tk). 1 tk = £1. Never store £. No `yard_points` table (decided 6 Nov).
- Poker: seat = 5 tk, re-buy = 5 tk. Site records buy-ins only.
- IOUs net across all rooms: one row per win/loss; a pair's position = sum.
- Session guard: every page except 0.0 (`index.html`), 0.1 (`claim.html`) and 0.3 (`about.html`) requires a session.
- Admin = `fy.member.role = 'leader'`, enforced in RLS/RPC (`fy._require_leader()`), never only in UI.
- Admin edits save instantly (no save button) and every change writes one `fy.admin_edit` row.
- High fidelity: colours, type, spacing, glow, radii and copy in the `.dc.html` designs are final. Use DS tokens (`--neon-*`, `--fy-*`, `--fs-*`, `--ic-*`); pink text is `--neon-pink-text` #ffc4e1; elevation is glow, not drop shadow. No emoji.
- Posts: text ≤ 280 chars, enforced at the DB, one reaction per member per post.
- `schema.sql` must stay safe to re-run on live (bundle re-applies it twice); every new statement uses `if not exists` / idempotent `do $$` blocks, matching the file's existing style.
- Don't ship `design/support.js` (prototype runtime). Don't copy prototype sample arrays or `fy.*` localStorage data — replace with queries.
- Each page's Tweaks props (`view`, `viewAs`, `device`) are preview-only, not app settings.

## Review Focus

1. **Double-claim race:** two browsers finish Discord OAuth with the same token at once — exactly one claim must win (`fy.claim_profile` row-locks). Test pinned in Task 1.
2. **Post body abuse:** 281-char, empty, or whitespace-only body inserted via the API (not the UI) must be rejected by the DB check. Test pinned in Task 2.
3. **Non-admin calling admin RPCs:** a plain member calling any `fy.admin_*` function or writing `fy.admin_edit`/`fy.room` directly must get an error, not a silent no-op. Tests pinned in Tasks 1–3.
4. **Missing `revolut_url`:** Pay on a profile whose payee has no Revolut link must render a disabled control with explanatory copy, never `href="null"`. Pinned in Task 14's checklist.
5. **Unknown URL params:** `profile.html?user=<nonexistent>` and `room.html?room=<unknown>` must show a sensible fallback (not-found copy / "New room" default), not a blank page or JS error. Pinned in Tasks 9 and 14 checklists.

## Testing conventions

- **DB:** every schema/RPC task adds assertions to `supabase/test.sql` (existing style: `pg_temp.as_user/as_anon/as_owner`, raise on failure), then regenerates the bundle: `python supabase/bundle_tests.py`. **Applying + running = RAY pastes `supabase/test.bundle.sql` into the Supabase SQL editor** and reports `ALL TESTS PASSED`; then pastes `schema.sql` alone to apply for real. Batch pastes at the end of each schema task.
- **Frontend:** no JS test framework exists; don't add one. Each page task ends with a browser checklist run against `npx serve .` from the repo root (pages live at root; DS at `farmyard-design-system/`), compared side-by-side with the served design file.

---

### Task 1: Schema — rooms registry, member links, claim expiry

**Files:**
- Modify: `supabase/schema.sql` (tables section after `fy.claim_link`, ~line 75; RLS section; seed section)
- Modify: `supabase/test.sql`

**Interfaces:**
- Produces: `fy.room(id text pk, label text, path text, icon text, status text check in ('ship','stub','later','live','hidden'), grp text check in ('home','leagues','beta','next'), parent_id text references fy.room, sort int)` — readable by `authenticated`; writes leader-only.
- Produces: `fy.member_link(id uuid pk, member_id → fy.member, provider text check in ('discord','revolut','steam','chesscom','spotify'), handle text, verified_at timestamptz, enabled boolean default true)` — owner+leader read/write per §9.
- Produces: `fy.claim_link.expires_at timestamptz` (null = never, for existing rows); `fy.claim_profile` and `fy.claim_peek` reject expired tokens; `fy.issue_claim_link(p_member_id uuid, p_days int default 14)`.
- Produces: `fy.member.tagline text` (≤ 80 chars check), self+leader writable.

- [ ] **Step 1: Write failing assertions in `supabase/test.sql`**: rooms seeded (`select count(*) from fy.room where status='stub'` ≥ 4); member can read rooms but `insert into fy.room` raises; member writes own `member_link`, cannot write another's, leader can; `claim_peek` on an expired token returns null/raises; `claim_profile` on expired token raises; double-claim: claim the same token as two users — second raises (keep/extend the existing single-use test); member sets own `tagline`, not another's.
- [ ] **Step 2: Regenerate and run** — `python supabase/bundle_tests.py`, RAY pastes bundle. Expected: FAIL (relation fy.room does not exist).
- [ ] **Step 3: Implement in `schema.sql`**: the three DDL changes above, RLS policies in the file's existing policy style, expiry checks inside `claim_profile`/`claim_peek`, and an idempotent seed block upserting the registry rows: home — dashboard/calendar(stub)/wall; leagues — poker(stub); beta — football(stub, children results+news), humidor(**live**, path `humidor.html`, children vote/results/archive/admin pointing at the existing humidor-*.html pages); next — the five holding rooms (arcade, movies, jukebox, whisky, chess) with `grp='next'`, `status='stub'`.
- [ ] **Step 4: Re-run bundle** → `ALL TESTS PASSED`; RAY applies `schema.sql` live.
- [ ] **Step 5: Commit** `feat(db): rooms registry, member links, claim expiry` (all commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).

### Task 2: Schema — Yard Wall (posts, likes, suggestions)

**Files:**
- Modify: `supabase/schema.sql`, `supabase/test.sql`

**Interfaces:**
- Produces: `fy.post(id uuid pk, member_id → fy.member, body text check (char_length(btrim(body)) between 1 and 280), pinned_at timestamptz, created_at)`; `fy.post_like(post_id, member_id, primary key (post_id, member_id))`; `fy.suggestion(id uuid pk, member_id, room_key text, body text ≤280, created_at)` — *not in §5; added for 1.4's suggestion box, leader-readable*.
- Produces: RLS — members read all posts/likes; insert own post/like; delete own post; leader deletes any; `fy.pin_post(p_post uuid, p_on boolean)` leader-only. Realtime: `alter publication supabase_realtime add table fy.post, fy.post_like` (idempotent guard; follow how schema.sql already publishes poker tables).

- [ ] **Step 1: Failing assertions**: 281-char and whitespace-only body raise; member deletes own post, cannot delete another's, leader can; second like by same member raises (pk); non-leader `pin_post` raises; member inserts a suggestion, reads only their own, leader reads all.
- [ ] **Step 2: Run bundle** → FAIL (fy.post missing).
- [ ] **Step 3: Implement** tables, RLS, `fy.pin_post`, publication.
- [ ] **Step 4: Run bundle** → `ALL TESTS PASSED`; RAY applies live.
- [ ] **Step 5: Commit** `feat(db): yard wall posts, likes, suggestions`.

### Task 3: Schema — pools, group events, admin audit + correction RPCs

**Files:**
- Modify: `supabase/schema.sql`, `supabase/test.sql`

**Interfaces:**
- Produces: `fy.pool(id uuid pk, fixture text, kickoff timestamptz, result text)` + `fy.pool_call(pool_id, member_id, call text, stake int, payout int)` + `fy.group_event(id uuid pk, title text, date date, cost int, pot int)` — tables only (UI slice 3 / hidden, `PIGGY_ENABLED=false`); leader-writable, member-readable.
- Produces: `fy.admin_edit(id uuid pk, admin_id → fy.member, tbl text, row_id text, field text, old text, new text, created_at)`; leader-only read and write.
- Produces: leader-gated RPCs, each calling `fy._require_leader()` and inserting one `fy.admin_edit` row per changed field:
  - `fy.admin_set_member(p_member uuid, p_field text, p_value text)` — whitelist: nickname, tagline, revolut_url, avatar_url, role.
  - `fy.admin_add_iou(p_payer uuid, p_payee uuid, p_tk int, p_note text) returns uuid` / `fy.admin_set_iou(p_iou uuid, p_tk int)` / `fy.admin_delete_iou(p_iou uuid)`.
  - `fy.admin_edit_docket(p_event uuid, p_players jsonb, p_winner uuid)` — void + re-record via the existing `fy._void_event` + `fy._record_poker_result` (schema.sql:313/347); `fy.admin_delete_docket(p_event uuid)` wraps `_void_event`.
  - `fy.admin_set_pool(p_pool uuid, p_result text)` / `fy.admin_set_payout(p_pool uuid, p_member uuid, p_payout int)` / `fy.admin_delete_pool(p_pool uuid)`.

- [ ] **Step 1: Failing assertions**: each RPC raises for a non-leader; a leader edit lands AND writes a matching `fy.admin_edit` row; `admin_edit_docket` changes the winner and the netting (`fy.netting()`) reflects it; member cannot select from `fy.admin_edit`.
- [ ] **Step 2: Run bundle** → FAIL.
- [ ] **Step 3: Implement** tables, RLS, RPCs.
- [ ] **Step 4: Run bundle** → `ALL TESTS PASSED`; RAY applies live.
- [ ] **Step 5: Commit** `feat(db): pools, group events, admin audit log and correction RPCs`.

### Task 4: CSS and design-system wiring

**Files:**
- Modify: `farmyard.css` (root — replace with the handoff layer, merging anything live pages still need)
- Reference: `design_handoff_slice1_build/…/design/farmyard.css` (266 lines, the REV C03 local layer), `farmyard-design-system/styles.css`, `farmyard-design-system/readme.md`
- Copy: `design/assets/hank-oink.png`, `hank-oink-sm.png`, `lot-yfronts.webp` → `assets/`

**Interfaces:**
- Produces: every slice-1 page uses exactly two stylesheet links: `farmyard-design-system/styles.css` then `farmyard.css` (plus Inter + Phosphor CDN links as in the designs). `.fy-phone` overrides stay at the end of `farmyard.css`.

- [ ] **Step 1: Audit consumers** — `grep -l "farmyard.css" *.html`; list which live (Humidor/Poker) pages load the root file and which old rules they use.
- [ ] **Step 2: Replace root `farmyard.css`** with the handoff version; append any old rules the Humidor/Poker pages still reference (clearly sectioned `/* legacy: humidor/poker */`).
- [ ] **Step 3: Verify** — `npx serve .`, open `humidor.html` and `poker.html`: visually unchanged. Open a design file with `_ds/…` rewritten to `../../../farmyard-design-system/` to confirm the DS path mapping renders.
- [ ] **Step 4: Commit** `feat(css): REV C03 farmyard.css layer over the design system`.

### Task 5: Barn shell + registry-driven sidebar

**Files:**
- Modify: `barn.js` (rebuild), `app.js` (keep; extend only if a helper is missing)
- Create: root copy of `sidebar-subs.js` (from the design folder, as-is)
- Reference: `design/1.0 BARN DASHBOard.dc.html` sidebar markup, HANDOFF §2

**Interfaces:**
- Consumes: `fy.room` rows (Task 1), `FY.me()/FY.session()` (app.js), `Barn.door/noProfile` (kept).
- Produces: `Barn.open(pageId, opts) → { me, session, main, root }` — same contract as today (session guard → door; no profile → noProfile; `!me.setup_at` → setup.html), but the frame is the REV C03 shell: teal `.fy-frame`, 232px sidebar, responsive desktop/tablet/phone. Sidebar built from `fy.room` ordered by grp/sort: **Home** (Dashboard · Calendar · Yard wall), **Leagues** (Poker), **Beta-Testing** (Football + Results/News subs, The Humidor + Vote/Results/Archive/Admin subs), **What's Next?** header (thought-bubble icon → whats-next.html; the five `grp='next'` rooms are NOT sidebar items), then online-strip slot (`<div id="fy-online">`), voice pills, profile button. `status='stub'` rooms link `room.html?room=<id>`; `live` rooms link their real path.
- Produces: `Barn.rooms()` — cached fetch of the registry, reused by whats-next and admin pages.

- [ ] **Step 1: Rebuild `barn.js`** per the design markup (`fy-nav-item`, `fy-nav-sub` classes, sub-roll behaviour via `sidebar-subs.js`); keep voice-pill and flicker logic.
- [ ] **Step 2: Temporary harness check** — point `dashboard.html` (still old content) at the new shell; serve and verify: signed out → door; signed in → sidebar matches §2 exactly at desktop/tablet/phone widths; every nav item resolves (stub → room.html).
- [ ] **Step 3: Commit** `feat(shell): REV C03 barn shell, sidebar from rooms registry`.

### Task 6: Presence + online strip

**Files:**
- Create: `presence.js`
- Reference: HANDOFF §8, online strip markup in `design/1.0 BARN DASHBOARD.dc.html`

**Interfaces:**
- Consumes: `FY.sb` realtime, `fy.netting()`, `fy.poker_board()` (rank chips), `Barn.open` (mounts into `#fy-online`).
- Produces: `Presence.join(me)` — tracks `{ member_id, status: 'online'|'away'|'off', in_voice: boolean }` on channel `yard` (away on `visibilitychange`, in_voice from `Barn.voice`); `Presence.render(el, members)` — rows of 36px avatar + IOU dot (red = I owe them context-free? **No**: dot is that member's overall position — red owes, amber owed, green settled, from `fy.netting()`), ♣/⚽ ordinal rank chips, all-time tk; LIVE tag when in_voice; avatar links `profile.html?user=<nickname>` (own avatar → `profile.html`).

- [ ] **Step 1: Implement `presence.js`**; unknown/stale `member_id`s in presence state are skipped silently.
- [ ] **Step 2: Verify with two browsers** (two test members): both appear within 5s; closing one tab drops the row; backgrounding dims to away; voice click shows LIVE.
- [ ] **Step 3: Commit** `feat(presence): yard channel and online strip`.

### Task 7: 0.1 Invite Door rebuild

**Files:**
- Modify: `claim.html`
- Reference: `design/0.1 Invite Door.dc.html`, HANDOFF §3

**Interfaces:**
- Consumes: `fy.claim_peek/claim_profile` (now expiry-aware, Task 1), existing token-in-URL-through-OAuth pattern (keep it — Discord in-app browser handoff), `FY.signIn`.
- Produces: `claim.html?t=<token>` with the REV C03 states: valid invite → sign in with Discord → claim → redirect `setup.html`; used/unknown/expired → the design's dead-token state; signed in with an already-claimed Discord → wrongAccount state.

- [ ] **Step 1: Rebuild the page** to the design (Hank + INVITE sign, final copy), keeping the existing state machine and adding the expired branch.
- [ ] **Step 2: Verify** — RAY issues a real test link (`fy.issue_claim_link`); walk valid, reused, and expired tokens.
- [ ] **Step 3: Commit** `feat(auth): REV C03 invite door`.

### Task 8: 0.2 New User Set-up rebuild

**Files:**
- Modify: `setup.html`
- Reference: `design/0.2 New User Set-up.dc.html`

**Interfaces:**
- Consumes: `fy.member` (yard name = nickname, birthday day/month, tagline), `fy.member_logo` (icon pick → `avatar_url`), `fy.member_link` (Task 1), `Barn.open('setup', {bare:true})`.
- Produces: on submit: update own member row, insert/update `member_link` rows (provider `revolut` writes `member.revolut_url` too; `steam`/`chesscom` rendered disabled "Coming soon"), set `setup_at`, redirect `dashboard.html`.

- [ ] **Step 1: Rebuild to the design**: yard name, icon palette pick (member's `fy.member_logo` slots), birthday, linked accounts.
- [ ] **Step 2: Verify** — fresh claimed member lands here, completes, lands on Dashboard; revisiting `setup.html` after setup shows edit state not blank; skipping setup and typing `dashboard.html` redirects back here.
- [ ] **Step 3: Commit** `feat(auth): REV C03 new user set-up with linked accounts`.

### Task 9: 2.0 Room Template + 0.3 About

**Files:**
- Create: `room.html`, `about.html`
- Reference: `design/2.0 Room Template.dc.html`, `design/0.3 About.dc.html`, PAGES.md rows 2.0/0.3

**Interfaces:**
- Consumes: `Barn.open`, `Barn.rooms()`, Presence; the design's per-room copy map (`?room=` → New room / Poker / Football / Humidor / Calendar / the five holding rooms).
- Produces: `room.html?room=<id>` — shell + online strip + Coming Soon block with that room's copy; unknown or missing `room` falls back to "New room". `about.html` — public (no session guard), Room Template layout with `room=About`, placeholder copy marked `<!-- COPY TBD -->` (copy is written during the build, per spec).

- [ ] **Step 1: Build `room.html`** with the copy map from the design file (don't invent copy).
- [ ] **Step 2: Build `about.html`** (public; no sidebar presence join when signed out).
- [ ] **Step 3: Verify** — every stub sidebar item opens its copy; `?room=garbage` shows New room; about.html loads signed out.
- [ ] **Step 4: Commit** `feat(pages): room template and about`.

### Task 10: 1.4 What's Next

**Files:**
- Create: `whats-next.html`
- Reference: `design/1.4 Whats Next.dc.html`

**Interfaces:**
- Consumes: `Barn.rooms()` (`grp='next'` rooms → cards), `fy.suggestion` (Task 2), room.html (cards link `room.html?room=<id>`).
- Produces: cards for Arcade, Movie night, Jukebox, Whisky club, Chess club + suggestion box writing `fy.suggestion(member_id, room_key, body)`.

- [ ] **Step 1: Build the page**; suggestion submit gives the design's confirmation state, then clears.
- [ ] **Step 2: Verify** — five cards open holding pages; suggestion row lands in `fy.suggestion` (check via admin SQL); sidebar "What's Next?" header highlights here.
- [ ] **Step 3: Commit** `feat(pages): what's next`.

### Task 11: 0.0 Coming Soon rebuild

**Files:**
- Modify: `index.html` (LIVE at the-farmyard.com — this ships the moment it's pushed)
- Reference: `design/0.0 Coming Soon.dc.html` (props `embed`, `section` drive the holding-room embed variant)

**Interfaces:**
- Produces: public page, no session; also the embeddable block Room Template uses (export the embed variant as markup room.html can include, or duplicate per the design's `embed` prop — follow whichever the design file's structure makes natural).

- [ ] **Step 1: Rebuild to the design**, keeping any live waitlist behaviour `index.html` currently has (audit first; port, don't drop).
- [ ] **Step 2: Verify locally signed-out**, then diff old vs new for lost functionality before pushing.
- [ ] **Step 3: Commit** `feat(pages): REV C03 coming soon`.

### Task 12: 1.0 Barn Dashboard

**Files:**
- Modify: `dashboard.html`
- Reference: `design/1.0 BARN DASHBOARD.dc.html`

**Interfaces:**
- Consumes: `Barn.open('yard')`, Presence, `fy.post` (wall widget, latest few + pinned), `fy.netting()`/`fy.my_ious()` (IOU module), `Barn.rooms()` (room modules), `fy.recent_events`.
- Produces: the home page per design: wall widget (→ wall.html), IOUs module (your net position, settle link → profile), room modules, online strip; every avatar opens that member's public profile, own avatar opens Own view.

- [ ] **Step 1: Rebuild to the design**, replacing all sample arrays with queries.
- [ ] **Step 2: Verify checklist** — widgets live-update (post from second browser appears), IOU numbers match `fy.netting()`, avatar routing rule holds.
- [ ] **Step 3: Commit** `feat(pages): REV C03 barn dashboard`.

### Task 13: 1.2 Yard Wall

**Files:**
- Create: `wall.html`
- Reference: `design/1.2 Yard Wall.dc.html`, ROADMAP slice-1 Yard Wall scope

**Interfaces:**
- Consumes: `fy.post`/`fy.post_like` + realtime subscription (Task 2), `fy.pin_post`, `Barn.open('wall')`.
- Produces: composer (counter to 280, disabled past limit), feed newest-first with pinned ("Pinned by Hank") on top, one heart toggle per member, delete own (confirm), admin pin/delete on every post. No images, replies, notifications or search.

- [ ] **Step 1: Build the page**; realtime insert/delete/like updates without refresh.
- [ ] **Step 2: Verify two-browser checklist** — post appears live in the other browser; like toggles once; non-admin sees no pin/delete on others' posts; API-level 281-char insert fails (console test).
- [ ] **Step 3: Commit** `feat(pages): yard wall`.

### Task 14: 3.0 Profile — three views

**Files:**
- Modify: `profile.html`
- Reference: `design/3.0 Barn Profile.dc.html`, HANDOFF §6

**Interfaces:**
- Consumes: `fy.member`, `fy.member_link`, `fy.member_logo`, `fy.netting()`, `fy.my_ious()`, `fy.iou_transition` (Received? → Confirm maps to state `confirmed`), `fy.poker_board()` (league position), `fy.recent_events`, admin RPCs (Task 3), `fy.set_member_logos` + Storage upload (admin icon upload).
- Produces: one page, three views — **Own** (default): header, stats row, icon palette, net ledger with per-room hover breakdown, pools, recent actions, settle, linked accounts; edits: name, tagline, icon, links, Confirm received, Pay. **Public** (`?user=<nickname>`): header, stats row, recent actions with docket/pool roll-downs; nothing editable; private modules hidden. **Admin** (`?view=admin&user=<nickname>`, leader only): everything in Own for that member plus −/+ on ledger/stats/pool scores, icon upload, remove actions — instant saves through the `fy.admin_*` RPCs. Stats row: poker league position · football league (— until slice 3) · all-time net · current debt (Σ you owe) · pending due (Σ owed to you, not yet confirmed). **Pay** opens the payee's `revolut_url` in a new tab and copies the amount to the clipboard; payee without a link → disabled control with copy explaining why (Review Focus 4). `?user=` nobody → not-found state (Review Focus 5). `?view=admin` as non-leader → falls back to Public.

- [ ] **Step 1: Rebuild Own view** (largest; land it before the other two).
- [ ] **Step 2: Add Public and Admin views** switched by URL params.
- [ ] **Step 3: Verify checklist** — all three views against the design's `viewAs` previews; ledger math vs `fy.netting()`; Received? → Confirm moves pending due; admin edit writes `fy.admin_edit`; the two Review Focus cases above.
- [ ] **Step 4: Commit** `feat(pages): REV C03 profile, three views`.

### Task 15: 0.9 Admin Dashboard

**Files:**
- Modify: `admin.html`, `admin.js`
- Reference: `design/0.9 Admin Dashboard.dc.html`, HANDOFF §7, PAGES.md row 0.9 (tabs: Members · Humidor · Poker · League · Tokens & IOUs · Site)

**Interfaces:**
- Consumes: `FY.requireLeader`-equivalent via `Barn.open` + role check, `fy.create_member`, `fy.issue_claim_link`, admin RPCs (Task 3), `fy.room` (Site tab), `fy.set_member_logos` + Storage.
- Produces: **Members** — table; row click → `profile.html?view=admin&user=…`; create member + copy claim link; icon palette management. **Humidor** — link through to the existing `humidor-admin.html` (live page, untouched). **Poker** — filed dockets table (from `fy.event` poker rows): edit buy-ins/winner (`fy.admin_edit_docket`), delete with confirm. **League** — pools table: edit result (`fy.admin_set_pool`) and payouts, delete with confirm. **Tokens & IOUs** — net position per member + full IOU table with −/+ and delete. **Site** — rooms registry with status editing. All edits instant, all logged.

- [ ] **Step 1: Rebuild tab shell + Members tab** (create member → claim link flow is launch-critical).
- [ ] **Step 2: Poker, League, Tokens & IOUs, Site tabs.**
- [ ] **Step 3: Verify checklist** — non-leader gets the leader-only door; create member → claim link → claimable; a docket edit changes profile netting; every edit visible in `fy.admin_edit`.
- [ ] **Step 4: Commit** `feat(pages): REV C03 admin dashboard`.

### Task 16: Launch acceptance + deploy

**Files:**
- Modify: none expected (fixes only)

- [ ] **Step 1: Walk HANDOFF §10 end-to-end on the served site, as a fresh member**: admin creates member → claim link → Discord sign-in → setup → sees who's online → opens Profile. Every nav item works or stubs; What's Next lists the holding rooms. Admin corrects a docket, a pool and an IOU.
- [ ] **Step 2: Check the three public pages signed out** (index, about, claim with a dead token) and phone width on dashboard, wall, profile.
- [ ] **Step 3: Push to main** (GitHub Pages auto-deploys); re-run the §10 walk on the-farmyard.com.
- [ ] **Step 4: Commit/tag** `chore: slice 1 acceptance` — slice 1 shipped.

---

## Self-review notes

- §5 tables all mapped or created; deviations recorded: no `yard_points` (RAY, 6 Nov); `icon_palette` stays `fy.member_logo` per-member 1–8; `invites.expires_at` added to `fy.claim_link`; `received_at` ≈ `fy.iou` state `confirmed`; `fy.suggestion` added for 1.4 (not in §5).
- 1.3 Contribute is not in HANDOFF §1 scope or ROADMAP slice 1 — excluded (PAGES.md lists it hidden; build on request).
- Pools/group_events get tables + admin editing only; member-facing UI is slice 3 / hidden — matches spec.
