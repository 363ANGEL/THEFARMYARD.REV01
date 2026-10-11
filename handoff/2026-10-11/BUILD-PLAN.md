# Farmyard — Build Plan

Per-page intent for the real build (Phase 0+). Each room has **Built in mock** (what the design shows today), **Intent** (what it should do for real), and a **Consider this** log of planning notes from review comments. Tags: ADD / AMEND / REPLACE.

Source design: `The Barn.dc.html`. Brand: `farmyard.css`.

---

## Sign-in
- **Built in mock:** Hank, "Sign in with Discord" button, waitlist link.
- **Intent:** Supabase Discord OAuth. Discord is only the key; no profile data is used. Invite/allow-list TBD (roadmap open question 4).
- **Consider this:**
  - **REPLACE** (overrides the Discord-as-key intent above) — on *Sign in with Discord* button: "We make every player create a farmyard login and use a link accounts area on their profile pages for using 3rd party services like discord, spoitfy, chess.com, varius poker services and arcarde stores. We need to keep in mind user friction, aiming for as friction less as possible to use the web site."
    - Implication: native Farmyard account (email magic link or passkey — no password — keeps friction lowest); Discord moves to Linked accounts alongside Spotify, Chess.com, poker services, arcade stores. Lounge deep-links and Discord presence still work without login linkage.
    - Conflict: ROADMAP Phase 1 lists "Login with Discord" as the MVP login. Would become "Farmyard login (Supabase email/passkey)" with Discord as an optional link.

## New User Set-up (`0.2 New User Set-up.dc.html`)
- **Built in mock:** auto-generated yard name (≤16 chars), palette of 8 pre-made logos (pre-populated per member by RAY), linked accounts (Discord, Revolut).
- **Intent:**
  - Logos: admin uploads 8 per member → Supabase storage; page reads them via the `logos` prop (name + img).
- **Hidden for now:** Chess.com username field (kept in the file behind `showChess`). Turn back on once the Chess page/league is built.
- **Decided:** Discord is the only sign-in, so every member is reachable in the voice channel. No Gmail/Google login and no reminder emails. Revisit a Google link later only if specific arcade games need it.
- **Consider this:** —

## Onboarding — "What does Hank call you?"
- **Built in mock:** yard name (≤16 chars) + pick one of 7 characters.
- **Intent:** writes `members` row (discord_id, yard_name, character_id). Shown once; editable later in Profile.
- **Consider this:** —

## Dashboard
- **Built in mock:** greeting line, Hank, "Tonight in the yard" cards (Lounge, Arcade, Poker, Jukebox, Movie night).
- **Intent:** live counts from presence + Discord widget; cards deep-link to rooms. Content of the dashboard still to be defined.
- **Consider this:** —

## Members column
- **Built in mock:** In the yard (online, teal dot) / Offline (dimmed, last seen); 184px, names ellipsised.
- **Intent:** Supabase presence; "doing" line from current room; later Discord voice presence via bot (Phase 2).
- **Consider this:** —

## Profile & linked accounts
- **Built in mock:** edit name/character; Linked accounts list (Discord locked; Spotify, Steam, itch, Revolut connect/unlink) with what each unlocks.
- **Intent:** OAuth per provider stored in `member_links`; rooms gate on links ("Link Steam to join") instead of failing.
- **Consider this:**
  - **AMEND** (from the Sign-in note) — Discord becomes a linkable account here, not the locked key. Provider list grows: Discord, Spotify, Chess.com, poker services (Discord Poker Night / PokerNow), arcade stores (Steam, itch).

## Arcade
- **Built in mock:** game cards (source tag, players, note), Add a game / Open a table.
- **Intent:** Phase 1: Neon Snake + leaderboard, manual boards. Phase 2: Worms/Steam lobbies. Steam link required for lobbies.
- **Consider this:** —

## Poker
- **Built in mock (`2.1 Poker Room.dc.html`):** Game checklist (Start a New Table → Confirm PokerNow Game ID → Take a Seat and Play → Initiator Files the Docket → Settle Up), 10-seat neon table with TAKE THE SEAT card + 10s countdown that opens the PokerNow link, Table Docket (players / buy-ins / winner, 15-min edit window), Poker League Board (ranked by buy-ins per win), Poker debts + SETTLE UP → Profile Settle up (Revolut pay-me links).
- **Intent:** PokerNow runs the game; the Farmyard is the lobby + scorekeeper. Backend spec in `HANDOFF-POKER.md` (poker_table / poker_seat, RPCs, realtime). Own table engine deferred to Phase 2+.
- **Decided:** 1 buy-in = 1 pt = £5. Initiator (not just leader) may file the docket. Revolut pay-me link lives on Profile → Linked accounts.
- **Decided (11 Oct):** one game at a time. Every member (host included) sees the same idle checklist with START until any member presses START. From then on every member sees START greyed and CLOSE available. Any member can CLOSE, but only after FILE DOCKET has been pressed for that game; otherwise CLOSE shows a reminder tip. Backend: one open `poker_table` row max; `close_table` RPC rejects if no result filed.
- **Consider this:** —

### Poker Room feeds (11 Oct)
- **Poker Scandal Sheet:** top 5 controversy / bad-behaviour stories from poker news feeds (PokerNews, Card Player, Poker.org), refreshed daily via a Supabase function. Each row shows the article's own preview image (og:image, hotlinked, not copied); if a story has none, show the newspaper icon. Word accusations as accusations.
- **Poker School:** 5 YouTube videos (intermediate tips + funny/controversial hands), via YouTube Data API: short videos only (≤5 min), sorted by view count, top one in the main player. Pick a fresh 5 daily.

## High scores
- **Built in mock:** placeholder.
- **Intent:** `scores` table; per-game boards; manual-entry admin form for Doom / Super 6 / Chess.
- **Consider this:** —

## Movie night
- **Built in mock:** placeholder.
- **Intent:** Phase 3 — votes + schedule, Plex link-out.
- **Consider this:** —

## Jukebox
- **Built in mock:** placeholder.
- **Intent:** Phase 3 — shared queue in DB, Spotify OAuth, Web Playback sync for Premium listeners.
- **Consider this:** —

## Voice — Lounge / Parked
- **Built in mock:** sidebar items with counts, "In Lounge via Discord" box.
- **Intent:** Phase 1 deep links `discord.com/channels/<server>/<channel>`; counts from Discord Server Widget JSON (poll ~30s); Phase 2 bot for richer presence.
- **Consider this:** —

---

## Open decisions
- Dashboard content beyond "Tonight in the yard".
- Invite-only vs open sign-up.
- Poker: link-out first, or wait for own table.
