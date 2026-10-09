-- Farmyard schema tests: the assertion body. Never run on its own. bundle_tests.py wraps it as
--   begin; drop schema if exists fy cascade; <schema.sql>; <this file>; rollback;
-- so it always runs on a fresh schema inside one transaction and leaves live data untouched.
-- Runs as postgres in the Supabase SQL editor, impersonating users via request.jwt.claims.
-- Any failed assertion raises, which aborts the transaction: the SQL editor shows the error.

-- Three fake auth users and their Discord identities, so claim_profile can read provider_id.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ray@test.local', '', '{"provider":"discord"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sock@test.local', '', '{"provider":"discord"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@test.local', '', '{"provider":"discord"}', '{}', now(), now());
insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'discord', '111', '{"sub":"111"}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'discord', '222', '{"sub":"222"}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'discord', '333', '{"sub":"333"}', now(), now(), now());

-- Leader profile is made directly (bootstrap; in prod RAY runs this one insert in the SQL editor).
insert into fy.member (league_id, nickname, avatar, user_id, role)
values (fy._league(), 'RAY', 'cock', '00000000-0000-0000-0000-000000000001', 'leader');

create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
create or replace function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true), set_config('role', 'anon', true);
$$;
create or replace function pg_temp.as_owner() returns void language sql as $$
  select set_config('request.jwt.claims', '', true), set_config('role', 'postgres', true);
$$;

do $$
declare ray uuid; sock uuid; pants uuid; tok text; tok2 text; ev uuid; n int; i fy.iou; d text;
        cp uuid; iou1 uuid; iou2 uuid; st text; r int; spare uuid; ta text; tb text;
        tbl uuid; tbl2 uuid; pj jsonb; ev2 uuid;
begin
  select id into ray from fy.member where nickname = 'RAY';

  -- Leader creates two unclaimed members and a claim link for Sock.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  sock := fy.create_member('The Sock', 'sheep');
  pants := fy.create_member('Pants', 'pig');
  tok := fy.issue_claim_link(sock);

  -- Review focus 1: a night with an unclaimed loser still produces the IOU.
  ev := fy.record_poker_result(
    jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 2),
                      jsonb_build_object('member_id', sock, 'buy_ins', 1),
                      jsonb_build_object('member_id', pants, 'buy_ins', 3)),
    ray, now(), 'first night');
  perform pg_temp.as_owner();
  select points into n from fy.v_standings where member_id = ray and type_key = 'poker';
  assert n = 6, 'winner points should be 6, got ' || n;
  select count(*) into n from fy.iou where event_id = ev;
  assert n = 2, 'two IOU rows expected';
  select owes into n from fy.v_badges where member_id = pants;
  assert n = 3, 'Pants owes 3';
  select owed into n from fy.v_badges where member_id = ray;
  assert n = 4, 'RAY owed 4';

  -- Review focus 2: bad nights write nothing.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 1),
                                                     jsonb_build_object('member_id', sock, 'buy_ins', 1)), pants);
    raise exception 'should have failed: winner not a player';
  exception when others then
    if sqlerrm not like 'winner must be%' then raise; end if;
  end;
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 0),
                                                     jsonb_build_object('member_id', sock, 'buy_ins', 1)), ray);
    raise exception 'should have failed: zero buy-in';
  exception when others then
    if sqlerrm not like 'buy-ins must be%' then raise; end if;
  end;
  perform pg_temp.as_owner();
  select count(*) into n from fy.event; assert n = 1, 'failed nights must not create events';

  -- Review focus 3: claim link works once, then never, for anyone.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  cp := fy.claim_profile(tok);
  assert cp = sock, 'Sock claims Sock';
  perform pg_temp.as_owner();
  select discord_id into d from fy.member where id = sock; assert d = '222', 'Discord id from auth.identities, got ' || coalesce(d, 'null');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');  -- a stranger with the same link
  begin
    perform fy.claim_profile(tok);
    raise exception 'should have failed: second use by another account';
  exception when others then
    if sqlerrm not like 'link used%' then raise; end if;
  end;
  -- Stranger with no profile sees no member rows and no IOUs.
  select count(*) into n from fy.member; assert n = 0, 'stranger must not read members';
  select count(*) into n from fy.my_ious(); assert n = 0, 'stranger has no IOUs';
  select count(*) into n from fy.netting(); assert n = 0, 'stranger gets no netting';
  -- A second link for Pants, used by the stranger, works: that is the latecomer route.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  tok2 := fy.issue_claim_link(pants);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  cp := fy.claim_profile(tok2);
  assert cp = pants, 'stranger becomes Pants via a fresh link';

  -- Review focus 4: wrong actor on an IOU.
  perform pg_temp.as_owner();
  select * into i from fy.iou where payer_id = sock and event_id = ev;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');  -- Sock is the payer
  begin
    perform fy.iou_transition(i.id, 'confirmed');
    raise exception 'should have failed: payer cannot confirm';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  perform fy.iou_transition(i.id, 'marked_paid');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');  -- RAY is the payee
  perform fy.iou_transition(i.id, 'confirmed');
  perform pg_temp.as_owner();
  select state into i.state from fy.iou where id = i.id; assert i.state = 'confirmed';
  select owed into n from fy.v_badges where member_id = ray; assert n = 3, 'RAY now owed 3 (Pants only)';

  -- RLS: Sock cannot read the Pants→RAY IOU; RAY (leader) can; anon reads standings only.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select count(*) into n from fy.iou where payer_id = pants; assert n = 0, 'Sock must not see Pants IOU';
  select count(*) into n from fy.my_ious(); assert n = 1, 'Sock sees exactly their own IOU';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  select count(*) into n from fy.iou; assert n = 2, 'leader sees all';
  perform pg_temp.as_anon();
  select count(*) into n from fy.v_standings where type_key = 'poker'; assert n = 3, 'anon reads standings';
  begin
    select count(*) into n from fy.iou;
    raise exception 'anon must not read iou';
  exception when insufficient_privilege then null; end;

  -- Review focus 5: badges switch off hides v_badges but my_ious still works.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.set_league(false, null);
  perform pg_temp.as_anon();
  select count(*) into n from fy.v_badges; assert n = 0, 'no badges when switched off';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select count(*) into n from fy.my_ious(); assert n = 1, 'own IOUs still visible';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.set_league(true, null);

  -- Settlement closes the pair's live rows.
  perform fy.settle_pair(pants, ray);
  perform pg_temp.as_owner();
  select count(*) into n from fy.iou where state = 'settled'; assert n = 1, 'Pants row settled';

  -- Auto-confirm: back-date a marked_paid row.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  ev := fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 1),
                                                 jsonb_build_object('member_id', sock, 'buy_ins', 1)), ray);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select id into i.id from fy.my_ious() where event_id = ev;
  perform fy.iou_transition(i.id, 'marked_paid');
  perform pg_temp.as_owner();
  update fy.iou set state_changed_at = now() - interval '15 days' where id = i.id;
  n := fy.auto_confirm_ious();
  assert n = 1, 'one row auto-confirmed, got ' || n;

  -- Claims: points claim lands as a score entry on approval.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  i.id := fy.raise_claim('{"type":"points","type_key":"poker","points":2,"note":"side pot"}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.decide_claim(i.id, true);
  perform pg_temp.as_owner();
  select points into n from fy.v_standings where member_id = sock and type_key = 'poker';
  assert n = 2, 'Sock has 2 points from the claim';

  -- Review focus 6: voiding a night reverses it.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  select points into n from fy.v_standings where member_id = ray and type_key = 'poker';  -- before
  ev := fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 5),
                                                 jsonb_build_object('member_id', pants, 'buy_ins', 5)), pants);
  perform fy.void_event(ev, 'typo');
  perform pg_temp.as_owner();
  select points into d from fy.v_standings where member_id = ray and type_key = 'poker';
  assert d::int = n, 'RAY points back to ' || n;
  select points into d from fy.v_standings where member_id = pants and type_key = 'poker';
  assert d::int = 0, 'Pants back to 0 after void';
  select count(*) into n from fy.iou where event_id = ev and state = 'settled'; assert n = 1, 'voided night IOU closed';
  select count(*) into n from fy.event where id = ev and voided_at is not null; assert n = 1, 'event stamped voided';

  -- ===== Fix round 1 additions =====

  -- Payee path by a NON-leader: Pants (user 3, claimed) wins, Sock (user 2) loses and pays.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  ev := fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', pants, 'buy_ins', 1),
                                                 jsonb_build_object('member_id', sock, 'buy_ins', 2)), pants);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select id into iou1 from fy.my_ious() where event_id = ev;
  perform fy.iou_transition(iou1, 'marked_paid');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');  -- Pants, the payee, not a leader
  perform fy.iou_transition(iou1, 'confirmed');
  perform pg_temp.as_owner();
  select state into st from fy.iou where id = iou1; assert st = 'confirmed', 'payee confirms, got ' || st;

  -- Dispute path: payee disputes, then the leader rules it back to open.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  ev := fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', pants, 'buy_ins', 1),
                                                 jsonb_build_object('member_id', sock, 'buy_ins', 1)), pants);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  select id into iou2 from fy.my_ious() where event_id = ev;
  perform fy.iou_transition(iou2, 'marked_paid');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.iou_transition(iou2, 'disputed');
  perform pg_temp.as_owner();
  select state into st from fy.iou where id = iou2; assert st = 'disputed', 'payee disputes, got ' || st;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.iou_transition(iou2, 'open');
  perform pg_temp.as_owner();
  select state into st from fy.iou where id = iou2; assert st = 'open', 'leader rules open, got ' || st;

  -- A non-leader (Sock) cannot use any leader function.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1),
                                                     jsonb_build_object('member_id', pants, 'buy_ins', 1)), sock);
    raise exception 'should have failed: non-leader record_poker_result';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  begin
    perform fy.void_event(ev, 'nope');
    raise exception 'should have failed: non-leader void_event';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  begin
    perform fy.settle_pair(sock, pants);
    raise exception 'should have failed: non-leader settle_pair';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  cp := fy.raise_claim('{"type":"points","type_key":"poker","points":1,"note":"try"}');
  begin
    perform fy.decide_claim(cp, true);
    raise exception 'should have failed: non-leader decide_claim';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  begin
    perform fy.raise_claim('{"points":1}');
    raise exception 'should have failed: claim with no type';
  exception when others then
    if sqlerrm not like 'claim type must be%' then raise; end if;
  end;

  -- Sock cannot promote themselves (role is not in the column-level update grant).
  begin
    update fy.member set role = 'leader' where id = sock;
    raise exception 'should have failed: self-promotion';
  exception when insufficient_privilege then null; end;

  -- discord_id is hidden from members; other columns still read fine.
  begin
    select discord_id into d from fy.member limit 1;
    raise exception 'should have failed: discord_id readable';
  exception when insufficient_privilege then null; end;
  select nickname into d from fy.member where id = sock; assert d = 'The Sock', 'members can read nicknames';

  -- Anon cannot read raw scores or events; the standings view still works.
  perform pg_temp.as_anon();
  begin
    select count(*) into n from fy.score_entry;
    raise exception 'should have failed: anon reads score_entry';
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into n from fy.event;
    raise exception 'should have failed: anon reads event';
  exception when insufficient_privilege then null; end;
  select count(*) into n from fy.v_standings where type_key = 'poker'; assert n = 3, 'anon still reads standings';

  -- Leader-side guards: duplicate player, unknown member for a claim link, bad settle_pair.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  select count(*) into r from fy.event;
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 1),
                                                     jsonb_build_object('member_id', ray, 'buy_ins', 1)), ray);
    raise exception 'should have failed: duplicate player';
  exception when others then
    if sqlerrm not like 'a player is listed twice%' then raise; end if;
  end;
  select count(*) into n from fy.event; assert n = r, 'duplicate-player night must not create an event';
  begin
    perform fy.issue_claim_link(gen_random_uuid());
    raise exception 'should have failed: unknown member link';
  exception when others then
    if sqlerrm not like 'unknown member%' then raise; end if;
  end;
  begin
    perform fy.settle_pair(ray, ray);
    raise exception 'should have failed: settle a member with themselves';
  exception when others then
    if sqlerrm not like 'pick two different%' then raise; end if;
  end;
  begin
    perform fy.settle_pair(pants, ray);  -- already settled earlier, nothing live left
    raise exception 'should have failed: nothing to square';
  exception when others then
    if sqlerrm not like 'nothing to square%' then raise; end if;
  end;

  -- ===== Task 18 hardening =====

  -- A player entry with no member_id or no buy_ins is rejected with its own message (not "listed twice").
  select count(*) into r from fy.event;
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 1),
                                                     jsonb_build_object('buy_ins', 1)), ray);
    raise exception 'should have failed: player without member_id';
  exception when others then
    if sqlerrm <> 'each player needs member_id and buy_ins' then raise; end if;
  end;
  begin
    perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', ray, 'buy_ins', 1),
                                                     jsonb_build_object('member_id', sock)), ray);
    raise exception 'should have failed: player without buy_ins';
  exception when others then
    if sqlerrm <> 'each player needs member_id and buy_ins' then raise; end if;
  end;
  select count(*) into n from fy.event; assert n = r, 'malformed-player nights must not create an event';

  -- Members cannot write tables directly, create members, or read claim tokens.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin
    insert into fy.score_entry (league_id, member_id, points, reason) values (fy._league(), sock, 99, 'result');
    raise exception 'member must not insert score_entry';
  exception when insufficient_privilege then null; end;
  begin
    update fy.iou set state = 'confirmed';
    raise exception 'member must not update iou directly';
  exception when insufficient_privilege then null; end;
  begin
    perform fy.create_member('Hacker', 'goat');
    raise exception 'member must not create members';
  exception when others then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  begin
    select count(*) into n from fy.claim_link;
    raise exception 'claim_link must be unreadable by members';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_anon();
  begin
    select count(*) into n from fy.claim_link;
    raise exception 'claim_link must be unreadable by anon';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_owner();
  select count(*) into n from fy.member where nickname = 'Hacker'; assert n = 0, 'no Hacker member may exist';
  select count(*) into n from fy.score_entry where points = 99; assert n = 0, 'no 99-point score may exist';

  -- ===== Final fix wave =====

  -- A new claim link burns the old one. A fourth account with no profile tries both.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'latecomer@test.local', '', '{"provider":"discord"}', '{}', now(), now());
  insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000004', 'discord', '444', '{"sub":"444"}', now(), now(), now());
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  spare := fy.create_member('Spare', 'cow');
  ta := fy.issue_claim_link(spare);
  tb := fy.issue_claim_link(spare);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  begin
    perform fy.claim_profile(ta);
    raise exception 'should have failed: old link after a new one was issued';
  exception when others then
    if sqlerrm not like 'link used%' then raise; end if;
  end;
  cp := fy.claim_profile(tb);
  assert cp = spare, 'the newest link still works';

  -- Claims refuse zero, for points and for IOU amounts.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin
    perform fy.raise_claim('{"type":"points","type_key":"poker","points":0,"note":"nothing"}');
    raise exception 'should have failed: zero-point claim';
  exception when others then
    if sqlerrm not like '%1 to 9999%' then raise; end if;
  end;
  begin
    perform fy.raise_claim('{"type":"iou","payer_id":"00000000-0000-0000-0000-000000000002","payee_id":"00000000-0000-0000-0000-000000000003","amount":0,"note":"nothing"}');
    raise exception 'should have failed: zero-amount claim';
  exception when others then
    if sqlerrm not like '%1 to 9999%' then raise; end if;
  end;

  -- A blank or whitespace nickname is refused by the database (check_violation, 23514); real ones are trimmed.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin
    perform fy.create_member('   ', 'hen');
    raise exception 'should have failed: blank nickname';
  exception when check_violation then null; end;
  perform fy.create_member('  Trimmed  ', 'goat');
  perform pg_temp.as_owner();
  select count(*) into n from fy.member where nickname = 'Trimmed'; assert n = 1, 'nickname stored trimmed';

  -- ===== Poker room =====
  -- Users: 1 RAY (leader), 2 Sock, 3 Pants, 4 Spare. User 5 is a signed-in account with no profile.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nobody@test.local', '', '{"provider":"discord"}', '{}', now(), now());
  perform pg_temp.as_owner();
  select id into sock from fy.member where nickname = 'The Sock';
  select id into pants from fy.member where nickname = 'Pants';
  select id into spare from fy.member where nickname = 'Spare';

  -- A signed-in account with no profile cannot start, read or sit.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  begin perform fy.poker_start(); raise exception 'should have failed: no profile starts a table';
  exception when others then if sqlerrm not like '%sign in first%' then raise; end if; end;
  assert fy.poker_current() is null, 'no profile reads no table';
  assert fy.poker_board() is null, 'no profile reads no board';
  assert fy.poker_debts() is null, 'no profile reads no debts';

  -- Sock starts a table; Pants cannot start a second one.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  tbl := fy.poker_start();
  pj := fy.poker_current(); assert pj->>'status' = 'starting', 'new table is starting';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  begin perform fy.poker_start(); raise exception 'should have failed: second live table';
  exception when others then if sqlerrm not like '%already open%' then raise; end if; end;
  -- Nobody sits before the link is in; only the initiator or the leader sets it; the link must be a PokerNow game.
  begin perform fy.poker_take_seat(tbl, 1, 'Pants'); raise exception 'should have failed: table not open';
  exception when others then if sqlerrm not like '%not open%' then raise; end if; end;
  begin perform fy.poker_set_link(tbl, 'https://www.pokernow.com/games/pglabc123'); raise exception 'should have failed: not initiator';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.poker_set_link(tbl, 'javascript:alert(1)'); raise exception 'should have failed: bad link';
  exception when others then if sqlerrm not like '%not a PokerNow%' then raise; end if; end;
  begin perform fy.poker_set_link(tbl, 'https://evil.example/games/abc'); raise exception 'should have failed: wrong host';
  exception when others then if sqlerrm not like '%not a PokerNow%' then raise; end if; end;
  perform fy.poker_set_link(tbl, 'https://www.pokernow.com/games/pglabc123');
  pj := fy.poker_current(); assert pj->>'status' = 'open', 'link opens the table';

  -- Seats: one each, no double-booking, 1 to 10, name 1 to 24.
  d := fy.poker_take_seat(tbl, 3, 'Sockie');
  assert d = 'https://www.pokernow.com/games/pglabc123', 'take_seat returns the link';
  begin perform fy.poker_take_seat(tbl, 4, 'Again'); raise exception 'should have failed: second seat';
  exception when others then if sqlerrm not like '%already have a seat%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  begin perform fy.poker_take_seat(tbl, 3, 'Pants'); raise exception 'should have failed: seat taken';
  exception when others then if sqlerrm not like '%seat is taken%' then raise; end if; end;
  begin perform fy.poker_take_seat(tbl, 11, 'Pants'); raise exception 'should have failed: seat 11';
  exception when others then if sqlerrm not like '%1 to 10%' then raise; end if; end;
  begin perform fy.poker_take_seat(tbl, 5, '   '); raise exception 'should have failed: blank name';
  exception when others then if sqlerrm not like '%table name%' then raise; end if; end;
  perform fy.poker_take_seat(tbl, 4, 'Pantsy');
  pj := fy.poker_current(); assert jsonb_array_length(pj->'seats') = 2, 'two seats show';
  assert pj->'seats'->0->>'nickname' = 'The Sock' and pj->'seats'->1->>'table_name' = 'Pantsy', 'seat roster carries names';
  -- Leaving frees the seat; the member can sit again.
  perform fy.poker_leave_seat(tbl);
  pj := fy.poker_current(); assert jsonb_array_length(pj->'seats') = 1, 'leaving frees the seat';
  perform fy.poker_take_seat(tbl, 4, 'Pantsy');
  -- Seats cannot be written around the RPCs.
  begin insert into fy.poker_seat (table_id, seat_no, member_id, table_name) values (tbl, 9, pants, 'x'); raise exception 'should have failed: direct seat insert';
  exception when insufficient_privilege then null; end;

  -- Docket: only the initiator or the leader; only seated players; needs a winner among them.
  begin perform fy.poker_file_docket(tbl, jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1), jsonb_build_object('member_id', pants, 'buy_ins', 2)), sock);
    raise exception 'should have failed: Pants is not the initiator';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.poker_file_docket(tbl, jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1), jsonb_build_object('member_id', spare, 'buy_ins', 2)), sock);
    raise exception 'should have failed: Spare is not seated';
  exception when others then if sqlerrm not like '%seated%' then raise; end if; end;
  ev := fy.poker_file_docket(tbl, jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1), jsonb_build_object('member_id', pants, 'buy_ins', 2)), sock);
  perform pg_temp.as_owner();
  select amount into n from fy.iou where event_id = ev and payer_id = pants and payee_id = sock; assert n = 2, 'Pants owes Sock 2';
  select entered_by::text into d from fy.event where id = ev; assert d = sock::text, 'filed by the initiator, not the leader';
  select points into n from fy.score_entry where event_id = ev and member_id = sock; assert n = 3, 'Sock gets the pot of 3';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.poker_file_docket(tbl, jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1), jsonb_build_object('member_id', pants, 'buy_ins', 2)), sock);
    raise exception 'should have failed: filed twice';
  exception when others then if sqlerrm not like '%already filed%' then raise; end if; end;

  -- Board and debts see the night; the undo list is for the filer and the leader only, with the buy-ins to edit.
  pj := fy.poker_board(now() - interval '1 day', now() + interval '1 day');
  assert (pj->>'games')::int >= 1, 'board counts the game';
  assert exists (select 1 from jsonb_array_elements(pj->'rows') x where x->>'nickname' = 'The Sock' and (x->>'won')::int >= 1), 'winner is on the board';
  assert jsonb_array_length(pj->'recent') = 1, 'filer sees the fresh docket';
  assert (pj->'recent'->0->'picks'->>(sock::text))::int = 1 and (pj->'recent'->0->'picks'->>(pants::text))::int = 2, 'picks come back for Edit';
  assert (pj->'recent'->0->>'left_secs')::int between 1 and 900, 'window counts down';
  pj := fy.poker_debts();
  assert exists (select 1 from jsonb_array_elements(pj) x where x->>'nickname' = 'Pants' and (x->>'total')::int >= 2), 'Pants shows as owing';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  assert jsonb_array_length(fy.poker_board(now() - interval '1 day', now() + interval '1 day')->'recent') = 0, 'other members do not see the undo list';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  assert jsonb_array_length(fy.poker_board(now() - interval '1 day', now() + interval '1 day')->'recent') = 1, 'leader sees it';

  -- Undo: not by a bystander; the filer can; then the docket can be filed again (Edit).
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  begin perform fy.poker_undo_docket(tbl); raise exception 'should have failed: bystander undo';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.poker_undo_docket(tbl);
  perform pg_temp.as_owner();
  select count(*) into n from fy.event where id = ev and voided_at is not null; assert n = 1, 'undo voids the event';
  select count(*) into n from fy.iou where event_id = ev and state = 'settled'; assert n = 1, 'undo closes its IOU';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  ev2 := fy.poker_file_docket(tbl, jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 2), jsonb_build_object('member_id', pants, 'buy_ins', 2)), pants);
  -- Back-date the filing: past 15 minutes nobody can undo it.
  perform pg_temp.as_owner();
  update fy.event set created_at = now() - interval '16 minutes' where id = ev2;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.poker_undo_docket(tbl); raise exception 'should have failed: window shut';
  exception when others then if sqlerrm not like '%15 minutes%' then raise; end if; end;
  assert jsonb_array_length(fy.poker_board(now() - interval '1 day', now() + interval '1 day')->'recent') = 0, 'window shut, no Edit / Undo';

  -- Close: not a bystander; the initiator can; a new table can then start.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  begin perform fy.poker_close(tbl); raise exception 'should have failed: bystander close';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.poker_close(tbl);
  assert fy.poker_current() is null, 'closed table is gone';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  tbl2 := fy.poker_start();
  assert tbl2 <> tbl, 'a new table starts after close';
  -- The leader may set the link and close someone else's table.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.poker_set_link(tbl2, 'https://www.pokernow.club/games/pgl-xyz_9');
  perform fy.poker_close(tbl2);
  -- A table left over from yesterday neither shows nor blocks a new one.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  tbl := fy.poker_start();
  perform pg_temp.as_owner();
  update fy.poker_table set created_at = now() - interval '13 hours' where id = tbl;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  assert fy.poker_current() is null, 'stale table is not shown';
  tbl2 := fy.poker_start();
  perform pg_temp.as_owner();
  select status into st from fy.poker_table where id = tbl; assert st = 'closed', 'stale table auto-closed';

  -- record_poker_result and void_event are still leader-only; the internals are not callable at all.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.record_poker_result(jsonb_build_array(jsonb_build_object('member_id', sock, 'buy_ins', 1), jsonb_build_object('member_id', pants, 'buy_ins', 1)), sock);
    raise exception 'should have failed: member records a night directly';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  begin perform fy.void_event(ev2); raise exception 'should have failed: member voids directly';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  begin perform fy._record_poker_result(sock, '[]'::jsonb, sock); raise exception 'should have failed: internal function';
  exception when insufficient_privilege then null; end;

  -- Revolut link: the owner sets it, bad ones are refused, other members can read it.
  update fy.member set revolut_url = 'https://revolut.me/thesock' where id = sock;
  begin update fy.member set revolut_url = 'javascript:alert(1)' where id = sock; raise exception 'should have failed: bad revolut link';
  exception when check_violation then null; end;
  begin update fy.member set revolut_url = 'http://revolut.me/thesock' where id = sock; raise exception 'should have failed: http revolut link';
  exception when check_violation then null; end;
  begin update fy.member set revolut_url = 'https://revolut.me/thesock?x=1' where id = sock; raise exception 'should have failed: extra path or query';
  exception when check_violation then null; end;
  begin update fy.member set revolut_url = 'https://revolut.me/thesock/' where id = sock; raise exception 'should have failed: trailing slash';
  exception when check_violation then null; end;
  assert (fy.me()).revolut_url = 'https://revolut.me/thesock', 'me() carries the link';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  select revolut_url into d from fy.member where id = sock; assert d = 'https://revolut.me/thesock', 'members read pay-me links';
  update fy.member set revolut_url = 'https://revolut.me/pants' where id = sock;
  perform pg_temp.as_owner();
  select revolut_url into d from fy.member where id = sock; assert d = 'https://revolut.me/thesock', 'cannot set another member''s link';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  select count(*) into n from fy.member; assert n = 0, 'no-profile account still reads no members';

  raise notice 'ALL TESTS PASSED';
end $$;
