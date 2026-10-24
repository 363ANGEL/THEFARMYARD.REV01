# Handoff: The Humidor (page 4.0, The Farmyard)

For Claude Code on `363ANGEL/THEFARMYARD.REV01` (main). Design source: `design/` in this folder (P15.009 + P15.003 `.dc.html` files). Brand: FARMYARD DS REV P01 tokens, already mirrored in the repo's `farmyard.css` / `barn.css`.

## Overview
The Humidor is a members' cigar club inside the Barn. Each **round**: members submit their taste → Hank (the leader) posts three cigars → members rank them 3/2/1 → the top score wins → members pay their share on Revolut → Hank orders → the round lands in the archive with a photo.

## About the design files
The `.dc.html` files are **design references built in HTML**, not production code. Recreate them in the repo's existing environment: plain HTML pages that `Barn.open(page)` draws into, `app.js` (`FY`) for Supabase, `barn.css` / `farmyard.css` / `app.css` for style, Phosphor icons from unpkg. Do not ship the `.dc.html` files or `support.js`.

`humidor-club.js` is the **prototype store** (localStorage, single browser). Its function list is the contract for the RPCs below; its data shapes are the contract for the tables. The design files also read `../assets/hank-oink.png`; in this bundle it is at `design/assets/`.

## Fidelity
**High-fidelity.** Colours, type, spacing and states are final and use the Farmyard tokens. Recreate pixel-close with the repo's classes (`.barn`, `.side`, `.nav`, `.voice`, `.me-btn`, `.main`, `.tab`, `.btn-primary`, `.tag-neutral`, `.box-teal`, `.kicker`, `.hd2`).

## Repo state (23 Oct) and where this fits
The repo has built the **11 Oct** handoff only (`dashboard`, `poker`, `profile`, `setup`, `claim`, `tables`, `admin`). The **12 Oct** handoff (LANDING PAGE REV C01.04: 1.1 Calendar, 2.2 Football : League, 3.0 Profile updates, 4.0 Cigars) is not built yet.

**This pack replaces the 4.0 section of the 12 Oct handoff.** "4.0 Cigars" (static guide: The basics, Videos, Pairings, Get together, Reviews with Amazon kit cards) is superseded by The Humidor club described here. The old chapters (Videos, Pairings, Get together, Reviews, Amazon kit cards) are **parked, not built** in this round; they may return later as extra Humidor tabs. Page number stays **4.0 The Humidor**; sidebar heading **Cigars**, icon `ph ph-cigarette`.

Sidebar order (C01.04, all Barn pages): Dashboard · **Sections** Poker, Football : League · **Core** Calendar · **Cigars** The Humidor · Voice channel · profile. If Calendar/Football aren't built yet, leave their links out until they are.

## Build order for a same-night prototype
1. `supabase/schema.sql`: the four tables + RPCs below, RLS like `poker_*`; run against the live project.
2. `barn.js`: sidebar link + `PAGES.humidor`.
3. `humidor.html` (Home) + `humidor-vote.html` (taste), wired to `humidor_current()` / `humidor_submit_prefs()`.
4. `humidor-admin.html` (open round, post three, close ranking, mark paid, place order).
5. `humidor-results.html` (rank + pay), then `humidor-archive.html`.
Ship after step 3 if time is short: members can submit taste; the rest can land next day.

## Where it sits
- **Barn sidebar** (`barn.js` → `sidebar()`): add a `<div class="label">Cigars</div>` then `link('humidor', 'ph ph-cigarette', 'The Humidor')`; add `humidor: 'humidor.html'` to `PAGES`. The design draws a custom cigar glyph (`img/icons/cigar.svg`); use the stock `ph-cigarette` as C01.04 does.
- **Pages** (one HTML each, `Barn.open('humidor')` → `{ me, main }`): `humidor.html` (home), `humidor-vote.html` (taste), `humidor-results.html` (rank + pay), `humidor-archive.html`, `humidor-admin.html` (leader only, `FY.requireLeader()`).
- **Humidor header** on every page, inside `.main`: `<h2 class="hd2">` title · `<span class="tag tag-neutral">` round chip · tab row (`.switcher > .tab`): Home · Vote · Results · Archive · Admin (Admin only when `me.role === 'leader'`, label "Admin · leader"). Current tab `aria-selected="true"` (pink).

## Screens

### 1. Home — `P15.009 HUMIDOR IN THE BARN REV.01.dc.html`
- **Head:** "The Humidor" + chip ("No round open" / "Round N · collecting | ranking | paying up") + tagline "A cigar club with a vote to suit your budget."
- **How a round works:** 5 cards in `repeat(auto-fit,minmax(160px,1fr))`, 10px gap. Each: number `01`–`05` (13px/600 teal), title (17px/500), body (13px secondary). The **current stage** card gets a 2px teal border + `--glow-teal` + a green "NOW" kicker. Stage = `humidor_round.stage_override` if set, else from status: collecting→1, ranking→3, paying→5. Copy in `S[]` in the file.
- **This round** (`.box-teal`): kicker with live dot (green pulse when a round is open), title, one pink button (`.btn.btn-primary`): "SUBMIT YOUR TASTE" → vote page · "RANK THE THREE" / "PAY YOUR SHARE" → results page · "SET YOUR TASTE" when no round. Below a rule: count ("4 of 6 in" / "2 of 5 ranked" / "3 of 5 paid") and a row of 44px member avatars (`FY.face(m)`) with a green ✓ badge once done; ring teal → green.
- **Paid counter** (stage 5 only): full-width SVG of the Salomón cigar as a teal outline (filter chain in the file; `img/salomon-outline-crop.png` as the mask source) with a pink fill that grows left→right to `paid ÷ voters` and a "N / M" counter over it. Captions: "Pay to fill it" → "Full cigar · Hank's ordering".

### 2. Vote (taste) — `P15.003 HUMIDOR CHOOSE REV.05.dc.html`
Four collapsible sections, gated: **1 Shape & size** → submit preferences unlocks **2 About the plant** and **3 Wrapper & flavour**; picking a wrapper + flavour unlocks **4 Price range**. The next open section's header breathes green (`rollBreath`). Closed headers: 1px border, "Open ▾"; locked: 45% opacity, "Locked · submit 1 first" / "Locked · finish 3 first".
- **My preferences** panel (top of content, 360px on desktop): Ring gauge (select), Max smoke time (30/45/60/90/120 min, 2 h+), Shape (Any/Parejo/Torpedo/Pyramid/Belicoso/Perfecto/Chisel/Culebra), SUBMIT button (white tube). Filters the vitola poster live.
- **Section 1:** rotating shape poster (7 shapes, 41 vitolas in `VIT[]`, drawn to proportion), size info card, "MORE INFORMATION →" pill (teal breath, brighter on hover), size photos from `img/cigars/` and brand logos from `img/logos/`.
- **Section 2:** four origin cards (pick up to 2, optional; helper line "Tap to select 2 preferences (optional)" under the title, explainer paragraph below the cards), plant primings diagram, strength picker (Mild / Medium / Full).
- **Section 3:** seven wrapper swatches (range pick), eight flavour families, pairing chips.
- **Section 4:** budget radios: Under £15 · £10–20 · £15–30 · Under £50 · Over £50.
- **Your vote** box (pink tube): "ROUND N · COLLECTING VOTES", list of selections with count ("6 of 9 set"); **Shape, Max time and Budget are required** (label "*", missing → red "Required · go to it", tap jumps to the section). Member = signed-in `me` (replace the "Who are you?" select). SUBMIT MY VOTE disabled until the three required are set; status line in red lists what is missing.
- **Already voted** state: all four sections closed, status "Submitted ✓", not hoverable/clickable; a teal box shows "ROUND N - YOUR VOTE :" + summary (20px pink) + flashing pink **EDIT MY TASTE** (`editFlash` 1.4s). Edit re-opens with the saved picks; resubmit returns here. Edit hidden once status ≠ collecting.
- Text scales ×0.73 (tablet) / ×0.77 (mobile) via `--ts`; min 10px. Title 32/26px, tagline 16/15px on tablet/mobile.

### 3. Results — `P15.003 HUMIDOR VOTE.dc.html`
- **Ranking:** three cards (`repeat(auto-fit,minmax(270px,1fr))`): 150px photo (`img` field, else size photo by name match, drop-zone), "Option N", name 20px, price "£12 a cigar", details `<dl>` (Size, Origin, Wrapper, Strength, Shop), Tasting notes, "Why Hank picked it", "Buy from SHOP →", and a **select** "Your rank for this cigar": 1st · 3 points / 2nd · 2 / 3rd · 1. Choosing a rank already used on another card swaps them. Card + select go pink when 1st. Points bar under each card once the member's ballot is in. Only this round's voters may rank. SUBMIT / UPDATE MY RANKING.
- **Paying up:** winner box (pink tube) with name, meta, "Your share £N", a cigar-shaped progress bar (confirmed = brown fill, pending = pink wash, ember at the edge), avatars with ✓/✕ and Paid / Sent / Not paid, "PAY £N ON REVOLUT →" (member's `revolut_url`), SUBMIT PAYMENT → `pending`; leader confirms. **No opt-out step:** voting is for fun; a member is in when the money lands and out if it hasn't when the leader closes. The counter and "In or out" copy count confirmed/pending payers against voters.
- Empty/collecting: lede + "ADD MY PREFERENCES →".

### 4. Archive — `P15.003 HUMIDOR ARCHIVE.dc.html`
Last round as a large module (photo left, details right: round · date, winner, size · price · members, "Asked for: …", final standings with bars) and earlier rounds as a grid of small modules (130px photo, round, winner, "Beat X and Y"). Photo = option `img` → size photo → user drop. Chip "N rounds smoked". Sample rounds show while the archive is empty (`sample` prop); drop them in production.

### 5. Admin (leader) — `P15.003 HUMIDOR ADMIN.dc.html`
- Notices: pending payments with "✓ MARK AS PAID".
- **Landing page stage:** radio cards AUTO (follow the round) / 01–05 → `stage_override`.
- **1 · Round:** OPEN ROUND / CLOSE PREFERENCES / REOPEN / CLOSE RANKING / PLACE ORDER buttons; **Who's voted** table (members × Size, Ring, Max time, Shape, Strength, Wrapper, Flavour, Origin, Budget; empty columns hidden; first column sticky).
- **2 · What the yard asked for:** **Tally board** (top 4 vitolas × voters: ✓/✕ + points/max; totals "fits / N" + pts) and **Likely selection** card. Scoring per voter: +2 size picked, +2 shape, +1 min ring, +1 max ring, +1 max time, +1 smoke time (soft); a hard-limit miss = ✕. Sort: most ✓, then points, then the brief's modal size, then ring nearest 50. Logic in `lk` in the file.
- **3 · Prompt sheet:** brief box (mode per field with counts) + vote summary stats (Votes in, Agreement, Filled in, Last vote) + per-question bars + a generated search prompt (`HumidorClub.prompt(brief)` with the member count and likely size spliced in). COPY button.
- **4 · The three options:** 3 forms: name, size, price, shop, url, note, img, origin, wrapper, strength, notes. POST THE THREE.
- **5 · Paying up:** share per member + Revolut link, list of who's paid, PLACE ORDER.
- **Members:** add / remove (use `v_members_public` instead).

## Data (additions to `supabase/schema.sql`, schema `fy`)
```sql
create table fy.humidor_round (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  n int not null,                                   -- round number, per league
  status text not null default 'collecting' check (status in ('collecting','ranking','paying','closed')),
  stage_override int check (stage_override between 0 and 4),   -- null = follow status
  options jsonb not null default '[]',              -- [{name,size,price,shop,url,note,img,origin,wrapper,strength,notes}] (3)
  winner int,                                       -- index into options
  share_gbp numeric(6,2), revolut_url text,
  opened_at timestamptz not null default now(), closed_at timestamptz
);
create unique index on fy.humidor_round (league_id) where status <> 'closed';   -- one open round
create table fy.humidor_pref (                       -- "votes" in the prototype
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  prefs jsonb not null,   -- {size,time,strength,wr:[from,to],flavour:[],origin,budget,sizePrefs:{minR,maxR,maxT(0-5),shape}}
  at timestamptz not null default now(), primary key (round_id, member_id));
create table fy.humidor_ballot (
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  rank int[] not null,    -- option indexes, best first, length 3
  at timestamptz not null default now(), primary key (round_id, member_id));
create table fy.humidor_pay (
  round_id uuid references fy.humidor_round(id) on delete cascade,
  member_id uuid references fy.member(id),
  state text not null check (state in ('pending','confirmed')),   -- member says sent / leader confirms. No row = not paid (out).
  at timestamptz not null default now(), primary key (round_id, member_id));
```
Archive = rounds with `status = 'closed'`, newest first.

## RPCs (security definer; member = `fy._require_member()`, leader = `fy._require_leader()`)
Mirror of `window.HumidorClub` in `humidor-club.js`:
- Leader: `humidor_open_round()`, `humidor_set_stage(p_stage int)`, `humidor_post_options(p_options jsonb)` → status ranking, `humidor_reopen_collect()`, `humidor_close_ranking()` → computes winner (points 3/2/1, tie → most firsts) and sets status paying, `humidor_set_pay(p_share, p_url)`, `humidor_confirm_paid(p_member, p_on)`, `humidor_place_order()` → closed.
- Member: `humidor_submit_prefs(p_prefs jsonb)` (status must be collecting; upsert), `humidor_cast_ranking(p_rank int[])` (must have prefs in this round), `humidor_mark_paid()` → pending (no opt-in/out; paying is opting in).
- Reads: `humidor_current()` → round + prefs + ballots + pays (with member nickname/avatar); `humidor_archive()`; `humidor_brief()` (mode per field; port `brief()` + `prompt()` from the prototype, or keep them client-side).
Realtime on the four tables (or poll 5s) so the home page avatars and the counter move live.

## Behaviour notes
- Member identity is the signed-in `me`; drop the name picker and `p15-voter` localStorage.
- Points: 1st 3, 2nd 2, 3rd 1. Only members with prefs in the round can rank. Rankings editable until the leader closes.
- Share: default = winner's price; paid list = members with a `humidor_pay` row. `humidor_place_order()` can run whenever the leader decides; unpaid voters are simply not in the order.
- Motion (all respect `prefers-reduced-motion`): `charBreath` 6s on Hank, `rollBreath` 2.6s green on the next section, `infoBreath` 2.8s teal on MORE INFORMATION, `editFlash` 1.4s pink on EDIT MY TASTE, `liveDot` 1.6s, `popIn` .5s on reveals, `prefIn` .5s on the preferences panel.
- Min hit target 44px. Tables scroll horizontally under 640px with the first column sticky.

## Tokens
All from `farmyard.css` (FARMYARD DS REV P01): `--fy-bg #161826`, `--fy-surface #232532`, `--neon-pink #e0157f` (glow only), `--neon-pink-tube #ff7fbf`, `--neon-pink-text #ffc4e1`, `--neon-teal #5fd3cf`, `--hint-text #c8f4f2`, `--neon-green-tube #3fe07f`, `--neon-green-text #9ff5bf`, `--neon-red-text #ff9aa5`, `--neon-amber-tube #ffc45c`, text `#e9e9ed / #e4e7f5 / #cfd3e5 / #b2b6ca`; glows `--glow-pink`, `--glow-teal`, `--text-glow-pink`. Type: Inter; 28 page title · 20 brand · 17 card title · 15 body · 14 ui · 13 small · 12 meta · 11 kicker (.08em caps). Radii: 6 row · 8 input · 10 module · 19 pill · 999 tab. Tints in the design are `color-mix(in srgb, var(--token) N%, transparent)`.

## Assets (in `design/`)
- `img/cigars/size-photo-*.{png,jpg}` — 38 vitola photos (keyed by shape-vitola slug; see `P15.003 HUMIDOR cigar sizes.csv`). Conchita, Lonsdale and Pyramid 6×52 still have no photo.
- `img/logos/` — 19 brand logos (`P15.003 HUMIDOR brand logos.csv`); Rocky Patel is inverted for dark tiles.
- `img/salomon-outline-crop.png` — mask source for the paid counter.
- `img/avatars/*.svg` — from the repo; `img/icons/cigar.svg` — sidebar glyph (optional).
- `img/plant-primings.jpg` — section 2 diagram.
- `assets/hank-oink.png` — Hank (same file as the repo's).

## Screenshots
`screenshots/01-home.jpg`, `02-vote-taste.png`, `03-results.jpg`, `04-archive.jpg`, `05-admin.jpg` — desktop captures of each screen in its default state (Results shows the ranking sample; Archive shows sample rounds).

## Files
- `design/P15.009 HUMIDOR IN THE BARN REV.01.dc.html` — Home in the Barn shell.
- `design/P15.003 HUMIDOR CHOOSE REV.05.dc.html` — Vote (taste).
- `design/P15.003 HUMIDOR VOTE.dc.html` — Results (rank + pay).
- `design/P15.003 HUMIDOR ARCHIVE.dc.html` — Archive.
- `design/P15.003 HUMIDOR ADMIN.dc.html` — Admin.
- `design/humidor-club.js` — prototype store = RPC/data contract.
- `design/image-slot.js`, `design/support.js` — prototype runtime only; do not port.
