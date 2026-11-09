# Multi-yard: what changes when a second yard goes live

Stage 1 (`yard.sql`, run by hand) adds `fy.yards`, `yard_id int not null default 1` on every per-group table, an index on each,
and `fy.my_yard()`. Stage 2 (this repo) needs no page change: the pages never insert rows directly (all inserts go through RPCs),
and every RPC and Edge Function insert takes the column default (1). The only direct writes are `update`s on `member` (profile and
set-up), which do not touch `yard_id`.

**Nothing is scoped by yard yet.** Existing policies and RPCs are unchanged. Before a second yard has any members, every item below
needs `yard_id = fy.my_yard()` (or the stated equivalent). Until then they all behave as one yard.

`yard.sql` only alters base tables (`pg_class.relkind` `r` or `p`); anything that is a view is skipped with a notice. The one
view in the list is `fy.humidor_pay` (a view over the round's `iou` rows since `humidor.sql`): it gets its yard from `fy.iou.yard_id`,
and `yard.sql` re-creates it with `yard_id` appended as its last column. Add `fy.humidor_pay` to the views that need a
`yard_id = fy.my_yard()` filter (section 2). Re-running `humidor.sql` after `yard.sql` would drop that column again; re-run `yard.sql`
afterwards (it is idempotent).

Base tables with `yard_id`: `league`, `member`, `member_logo`, `member_link`, `claim_link`, `claim`, `event_type`, `event`, `score_entry`,
`settlement`, `iou`, `group_event`, `admin_edit`, `poker_table`, `poker_seat`, `poker_hold`, `poker_news`, `poker_video`,
`humidor_round`, `humidor_option`, `humidor_pref`, `humidor_ballot`, `icon_palette`, `room`, `post`, `post_like`, `suggestion`, `pool`,
`pool_call`.

## 1. Helpers (change first, the rest build on them)

| Function | Change |
|---|---|
| `fy.is_member()` | `exists (… where user_id = auth.uid())` already per-person; keep, but policies must add the yard test below. |
| `fy.is_leader()` | Leader of **their own** yard only. Add a yard-aware variant `fy.is_leader_of(p_yard int)` = `role = 'leader' and yard_id = p_yard`, and use it wherever a row's yard is known. |
| `fy._require_leader()` | Returns the leader row; callers must compare the target row's `yard_id` with `leader.yard_id`. |
| `fy._require_member()` | Same: callers compare yard. |
| `fy._league()` | Hard-coded to slug `'farmyard'`. Replace with `fy.my_yard()` (or the caller's `league_id`) in every RPC that uses it (list in section 3). |
| `fy.me()` | Add `yard_id` to the returned row so the page can show the yard later. |

## 2. RLS policies (add `yard_id = fy.my_yard()` to each `using`)

Open read (`using (true)` today, so a second yard would see everything):
`league_read`, `event_type_read`, `event_read`, `score_read`.

Member/leader read (`fy.is_member() or fy.is_leader()` today):
`member_read`, `member_logo_read`, `poker_table_read`, `poker_seat_read`, `poker_hold_read`, `poker_news_read`, `poker_video_read`,
`humidor_round_read`, `humidor_option_read`, `humidor_ballot_read`, `humidor_pref_read`, `pool_read`, `pool_call_read`, `post_read`,
`post_like_read`, `group_event_read`, `room_read`.

Party/own-row policies (add the yard test next to the existing party test; leaders only within their yard):
`iou_read_party`, `settlement_read_party`, `claim_read_own`, `member_link_own`, `suggestion_own`, `admin_edit_leader`.

Insert/update policies (also add to `with check`): `member_update_self`, `humidor_ballot_ins`, `humidor_ballot_upd`,
`humidor_pref_ins`, `humidor_pref_upd`.

Views to rebuild with a `yard_id = fy.my_yard()` filter (they read across members and events): `v_members_public`, `v_standings`,
`v_overall`, `v_badges`, `v_live_iou`, `v_netting`, `humidor_pay`.

Column grants: `yard_id` is not in the `fy.member` column grant, so the page cannot read or change it. Keep it that way.

## 3. RPCs

### Reads that must filter by yard
`me`, `my_ious`, `recent_events`, `netting`, `poker_current`, `poker_board`, `poker_debts`, `poker_feeds`, `humidor_current`,
`humidor_archive`, `claim_peek`.

### Writes that must stamp and check yard
Stamp the caller's `fy.my_yard()` on new rows, and refuse a target row from another yard:

- Members and invites: `create_member` (**already stamps `fy.my_yard()` in `yard.sql`**), `issue_claim_link` (**already yard-checked in
  `yard.sql`**), `gate_signup`, `claim_profile`, `decide_claim`, `raise_claim`, `set_member_logos`, `set_my_links`,
  `member_contact_norm`.
- Admin (leader-only): `admin_set_member`, `admin_delete_member`, `admin_add_iou`, `admin_set_iou`, `admin_delete_iou`,
  `admin_edit_docket`, `admin_delete_docket`, `admin_set_pool`, `admin_set_payout`, `admin_delete_pool`, `admin_set_room`,
  `set_league`, `set_weight`.
  `admin_set_member` also needs the last-leader rule scoped per yard (`role = 'leader' and yard_id = target.yard_id`).
- Money: `iou_transition`, `settle_pair`, `auto_confirm_ious` (cron: loop per yard), `record_poker_result`, `_record_poker_result`,
  `void_event`, `_void_event`, `_poker_ranking`.
- Poker: `poker_start` (one live table **per yard**: change `poker_one_live_table` to `unique (yard_id) where status <> 'closed'`),
  `poker_set_link`, `poker_take_seat`, `poker_join`, `poker_hold_seat`, `poker_release_hold`, `poker_leave_seat`, `poker_close`,
  `poker_file_docket`, `poker_undo_docket`.
- Humidor: `humidor_open_round`, `humidor_post_options`, `humidor_submit_prefs`, `humidor_cast_ranking`, `humidor_close_ranking`,
  `humidor_reopen_collect`, `humidor_pay`, `humidor_mark_paid`, `humidor_confirm_paid`, `humidor_place_order`, `humidor_set_pay`,
  `humidor_set_stage`, `_humidor_round`.
- Wall: `wall_post`, `wall_like`, `wall_delete`, `pin_post`, `suggest`.

### Edge Function
`supabase/functions/poker-feeds` writes `poker_news` and `poker_video` with the service role. Today the rows take yard 1. Decide
whether news and videos stay global (then exempt them from `poker_news_read` / `poker_video_read` scoping) or are written per yard.

## 4. Other things a second yard trips over

- **Unique constraints that are league-wide**: `poker_one_live_table (league_id)`, any `unique` on nickname or invite contact; make
  them `(yard_id, …)`.
- **Realtime**: `poker_table`, `poker_seat`, `poker_hold` pings reach every yard; the page re-fetches through `poker_current`, which
  will be yard-scoped, but filter the channel (or rely on RLS) so other yards' pings are not delivered.
- **Rooms registry (`fy.room`)**: decide whether rooms and `visibility` are per yard (then scope `room_read`, `admin_set_room`) or
  global.
- **`fy.league`** (uuid, one row `farmyard`) overlaps with `fy.yards`. Pick one tenant key before building on either.
