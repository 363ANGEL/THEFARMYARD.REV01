# Handoff: Poker room (live table + docket)

For Claude Code on `363ANGEL/THEFARMYARD.REV01` (main). Design source: `Barn Poker backup.dc.html` in this project. Brand: `farmyard.css`, `FARMYARD-STYLE.md`, `NEON-REFS.md`.

Goal: let real members test poker night. The mock-up is single-browser; everything below is what the backend must add so the initiator's link and seats are shared across every member's screen.

## The flow (as designed)

1. **Start a New Table** (any member = the *initiator*). START opens `https://www.pokernow.com/start-game` in a new tab and swaps to a red CLOSE button. The 10-seat table appears.
2. **Confirm PokerNow Game ID.** Initiator pastes the PokerNow game link into the box, presses ENTER. Saves the link on the table record. Table status = `open`.
3. **Take a Seat and Play.** Every member who opens the Poker room while a table is `open` sees the same table and the taken seats. Empty seats glow on hover. Clicking a seat shows the TAKE THE SEAT card: FARMYARD NAME (locked), TABLE NAME (defaults to Farmyard name, editable, "Try an Alt Tag On?"), TAKE THE SEAT button. On click: table name copied to clipboard, 10s clock countdown, then the **table's PokerNow link** opens in a new tab with text "TAKE SEAT XX ON POKERNOW." The seat is now that member's: circle avatar, pink ring, table name under it.
4. **Initiator Files the Docket.** Table Docket (right of the table on desktop, below on phone; appears 2s after the initiator takes their seat). Lists only members seated at this table. Per row: tick played, buy-ins (−/+), W circle for the winner. FILE DOCKET is enabled once ≥2 players ticked and a winner picked. On file: "FILED" stamp, 15-minute window with Edit / Undo in Games played.
5. **Settle Up.** Poker debts module lists payers → payees + total. SETTLE UP goes to Profile → Settle up (per-payee amounts with "Pay on Revolut" using the payee's revolut.me link, then "Mark paid").

CLOSE (initiator or leader) sets table status `closed`; seats are released.

## Data (additions to `supabase/schema.sql`)

```sql
create table fy.poker_table (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  started_by uuid not null references fy.member(id),
  pokernow_url text,                       -- null until step 2
  status text not null default 'starting'  -- starting | open | closed
    check (status in ('starting','open','closed')),
  event_id uuid references fy.event(id),   -- set when the docket is filed
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table fy.poker_seat (
  table_id uuid not null references fy.poker_table(id) on delete cascade,
  seat_no int not null check (seat_no between 1 and 10),
  member_id uuid not null references fy.member(id),
  table_name text not null check (char_length(btrim(table_name)) between 1 and 24),
  taken_at timestamptz not null default now(),
  primary key (table_id, seat_no),
  unique (table_id, member_id)             -- one seat per member
);
alter table fy.member add column if not exists revolut_url text;  -- Profile → Linked accounts → Revolut pay-me link
```

Only one table may be `starting`/`open` per league at a time (partial unique index on `league_id where status <> 'closed'`).

## RPCs (security definer, same pattern as the existing ones)

- `fy.poker_start()` → table id. Caller = member. Fails if an open table exists.
- `fy.poker_set_link(p_table uuid, p_url text)`. Caller = `started_by` or leader. Sets url + `status = 'open'`.
- `fy.poker_take_seat(p_table uuid, p_seat int, p_table_name text)`. Caller = member; table must be `open`; seat free; member not already seated. Returns `pokernow_url` so the client can open it after the countdown.
- `fy.poker_leave_seat(p_table uuid)`.
- `fy.poker_close(p_table uuid)`. Caller = `started_by` or leader.
- `fy.poker_file_docket(p_table uuid, p_players jsonb, p_winner uuid)` → event id. Caller = `started_by` **or leader** (today `record_poker_result` is leader-only; the initiator needs it too). Players must be a subset of `poker_seat.member_id` for that table. Calls `fy.record_poker_result` then sets `poker_table.event_id`.
- `fy.poker_undo_docket(p_table uuid)`: allowed for 15 min after filing by the filer or leader; calls `fy.void_event`. Edit = undo + re-file.
- Reads: `fy.poker_current()` returns the open table + its seats (members' nickname, avatar, table_name); grant to authenticated.

Realtime: enable Supabase Realtime on `fy.poker_table` and `fy.poker_seat` so seats fill in live on every screen. Fallback: poll every 5s.

## League board & debts (read-only from existing data)

- **Poker League Board**: per member over poker events this season: played, won, buy-ins, points (`v_standings` type `poker`), £ net (sum over `iou` × £5 for payer/payee). Rank by **buy-ins ÷ wins ascending** (no wins → bottom, fewest buy-ins first). Position arrows compare with the standing before the latest event. Only members with ≥1 played game are listed. Header: "Season 1 (Oct - Dec) · Total games = N · Total buy-ins = N" (season dates hard-coded for now).
- **Poker debts**: from `fy.my_ious()` / `v_badges`: payer → payees, total £. £5 per buy-in is the league constant (add `fy.league.buyin_gbp int default 5` if you want it editable).
- **Profile → Settle up**: `my_ious()` where I'm payer, grouped by payee, with the payee's `revolut_url` + amount → `https://revolut.me/<name>/<amount>`; "Mark paid" = `iou_transition(id, 'marked_paid')`.

## UI notes

- 10 seats fixed (PokerNow max). Seat positions in `SEAT_XY` in the design file.
- Members see the table only when a table is `open`; before that the Poker room shows the checklist alone.
- Copy of the clipboard write (table name) must happen on the click (user gesture), not after the timer.
- Voice: LIVE / MUTED buttons deep-link to Discord channels `1527009971999608902` / `1490100901464248321` on server `1490100899920740483`.
