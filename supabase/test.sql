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
        tbl uuid; tbl2 uuid; pj jsonb; ev2 uuid; hr uuid; hw int; hn numeric;
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
  -- Invite Door reads the name on an unused link, signed in or not; nothing else about it.
  perform pg_temp.as_anon();
  assert fy.claim_peek(tok) = 'The Sock', 'anon peeks the invite name';
  assert fy.claim_peek('nope') is null, 'unknown token peeks nothing';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  cp := fy.claim_profile(tok);
  assert cp = sock, 'Sock claims Sock';
  assert fy.claim_peek(tok) is null, 'a used link peeks nothing';
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
  -- Pants, a second member who did not start it, gets the same starting table back (not null), by RPC and by RLS.
  pj := fy.poker_current();
  assert pj->>'id' = tbl::text and pj->>'status' = 'starting' and pj->>'started_by' = sock::text, 'second member sees the starting table';
  select count(*) into n from fy.poker_table where id = tbl; assert n = 1, 'RLS: second member reads the starting table';
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
  -- Nobody holds a seat before the table is open either.
  begin perform fy.poker_hold_seat(tbl, 2); raise exception 'should have failed: hold before open';
  exception when others then if sqlerrm not like '%not open%' then raise; end if; end;
  perform fy.poker_set_link(tbl, 'https://www.pokernow.com/games/pglabc123');
  pj := fy.poker_current(); assert pj->>'status' = 'open', 'link opens the table';
  -- Opening the table seats the initiator (lowest free seat, yard name as table name).
  assert jsonb_array_length(pj->'seats') = 1 and (pj->'seats'->0->>'seat_no')::int = 1
     and pj->'seats'->0->>'member_id' = sock::text and pj->'seats'->0->>'table_name' = 'The Sock', 'initiator is seated when the table opens';
  begin perform fy.poker_set_link(tbl, 'https://www.pokernow.com/games/pglabc123'); exception when others then raise; end;
  pj := fy.poker_current(); assert jsonb_array_length(pj->'seats') = 1, 'setting the link again does not seat the initiator twice';

  -- Seats: one each, no double-booking, 1 to 10, name 1 to 24.
  begin perform fy.poker_take_seat(tbl, 4, 'Again'); raise exception 'should have failed: second seat';
  exception when others then if sqlerrm not like '%already have a seat%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  -- The second member, not seated and not the initiator, sees the open table, its link and Sock's seat:
  -- through poker_current (what the page reads) and through RLS on the tables (what Realtime checks before a ping).
  pj := fy.poker_current();
  assert pj->>'id' = tbl::text and pj->>'status' = 'open', 'second member sees the open table';
  assert pj->>'started_by' = sock::text, 'and it is Sock''s table, not theirs';
  assert pj->>'pokernow_url' = 'https://www.pokernow.com/games/pglabc123', 'second member gets the link';
  assert jsonb_array_length(pj->'seats') = 1 and pj->'seats'->0->>'member_id' = sock::text and (pj->'seats'->0->>'seat_no')::int = 1, 'second member sees the taken seat';
  select count(*) into n from fy.poker_table where id = tbl and status = 'open'; assert n = 1, 'RLS: second member reads the open table';
  select count(*) into n from fy.poker_seat where table_id = tbl and member_id = sock; assert n = 1, 'RLS: second member reads the seats';
  -- A signed-in account with no profile reads neither table.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  select count(*) into n from fy.poker_table; assert n = 0, 'RLS: no-profile account reads no tables';
  select count(*) into n from fy.poker_seat; assert n = 0, 'RLS: no-profile account reads no seats';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  begin perform fy.poker_take_seat(tbl, 1, 'Pants'); raise exception 'should have failed: seat taken';
  exception when others then if sqlerrm not like '%seat is taken%' then raise; end if; end;
  begin perform fy.poker_take_seat(tbl, 11, 'Pants'); raise exception 'should have failed: seat 11';
  exception when others then if sqlerrm not like '%1 to 10%' then raise; end if; end;
  begin perform fy.poker_take_seat(tbl, 5, '   '); raise exception 'should have failed: blank name';
  exception when others then if sqlerrm not like '%table name%' then raise; end if; end;
  -- Holds: picking a seat reserves it for everyone else; picking another moves the hold; taking the seat clears it.
  perform fy.poker_hold_seat(tbl, 3);
  perform fy.poker_hold_seat(tbl, 4);
  pj := fy.poker_current(); assert jsonb_array_length(pj->'holds') = 1 and (pj->'holds'->0->>'seat_no')::int = 4
     and pj->'holds'->0->>'nickname' = 'Pants', 'one hold per member, on the last seat picked';
  begin perform fy.poker_hold_seat(tbl, 1); raise exception 'should have failed: hold a taken seat';
  exception when others then if sqlerrm not like '%seat is taken%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  begin perform fy.poker_take_seat(tbl, 4, 'Spare'); raise exception 'should have failed: seat held by Pants';
  exception when others then if sqlerrm not like '%seat is held%' then raise; end if; end;
  begin perform fy.poker_hold_seat(tbl, 4); raise exception 'should have failed: hold a held seat';
  exception when others then if sqlerrm not like '%seat is held%' then raise; end if; end;
  perform fy.poker_hold_seat(tbl, 5);
  perform fy.poker_release_hold(tbl);
  pj := fy.poker_current(); assert jsonb_array_length(pj->'holds') = 1, 'releasing drops only my hold';
  -- An expired hold no longer blocks anyone.
  perform pg_temp.as_owner();
  update fy.poker_hold set expires_at = now() - interval '1 second' where table_id = tbl and member_id = pants;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  pj := fy.poker_current(); assert jsonb_array_length(pj->'holds') = 0, 'expired holds are not shown';
  perform fy.poker_hold_seat(tbl, 4);
  perform fy.poker_release_hold(tbl);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.poker_hold_seat(tbl, 4);
  d := fy.poker_take_seat(tbl, 4, 'Pantsy');
  assert d = 'https://www.pokernow.com/games/pglabc123', 'take_seat returns the link';
  pj := fy.poker_current(); assert jsonb_array_length(pj->'seats') = 2, 'two seats show';
  assert jsonb_array_length(pj->'holds') = 0, 'taking the seat clears the hold';
  assert pj->'seats'->0->>'nickname' = 'The Sock' and pj->'seats'->1->>'table_name' = 'Pantsy', 'seat roster carries names';
  -- Leaving frees the seat; the member can sit again.
  perform fy.poker_leave_seat(tbl);
  pj := fy.poker_current(); assert jsonb_array_length(pj->'seats') = 1, 'leaving frees the seat';
  perform fy.poker_take_seat(tbl, 4, 'Pantsy');
  -- Seats and holds cannot be written around the RPCs.
  begin insert into fy.poker_seat (table_id, seat_no, member_id, table_name) values (tbl, 9, pants, 'x'); raise exception 'should have failed: direct seat insert';
  exception when insufficient_privilege then null; end;
  begin insert into fy.poker_hold (table_id, member_id, seat_no, expires_at) values (tbl, pants, 9, now() + interval '1 minute'); raise exception 'should have failed: direct hold insert';
  exception when insufficient_privilege then null; end;
  -- A seated game cannot be closed until the docket is filed (by anyone but the leader).
  begin perform fy.poker_close(tbl); raise exception 'should have failed: close before the docket';
  exception when others then if sqlerrm not like '%file the docket%' then raise; end if; end;

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

  -- Close: once the docket is filed, any member closes; a new table can then start.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.poker_close(tbl);
  assert fy.poker_current() is null, 'closed table is gone';
  perform fy.poker_close(tbl);   -- closing twice is a no-op
  tbl2 := fy.poker_start();
  assert tbl2 <> tbl, 'a new table starts after close';
  -- The leader may set the link on someone else's table; that seats the initiator (Pants), not the leader.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.poker_set_link(tbl2, 'https://www.pokernow.club/games/pgl-xyz_9');
  pj := fy.poker_current(); assert pj->'seats'->0->>'member_id' = pants::text, 'the initiator gets the seat, not the leader';
  -- Seated, no docket: a member cannot close it, the leader can (to unstick a night).
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  begin perform fy.poker_close(tbl2); raise exception 'should have failed: seated game, no docket';
  exception when others then if sqlerrm not like '%file the docket%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.poker_close(tbl2);
  assert fy.poker_current() is null, 'leader closed the unfiled table';
  -- Nobody sat: any member closes straight away.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  tbl2 := fy.poker_start();
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.poker_close(tbl2);
  assert fy.poker_current() is null, 'empty table closes for anyone';
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
  -- New User Set-up: the member picks a logo and finishes; bad logo URLs are refused.
  update fy.member set avatar_url = 'https://example.supabase.co/storage/v1/object/public/logos/sock.png', setup_at = now() where id = sock;
  begin update fy.member set avatar_url = 'javascript:alert(1)' where id = sock; raise exception 'should have failed: bad logo url';
  exception when check_violation then null; end;
  begin update fy.member set avatar_url = 'https://x.y/a"b.png' where id = sock; raise exception 'should have failed: quote in logo url';
  exception when check_violation then null; end;
  assert (fy.me()).avatar_url like 'https://example.supabase.co/%' and (fy.me()).setup_at is not null, 'me() carries the logo and set-up time';
  select avatar_url into d from fy.v_members_public where id = sock; assert d like 'https://example.supabase.co/%', 'public view carries the logo';
  -- Logos: leader only, up to 8, replaces the set; a removed chosen logo falls back to the avatar key.
  begin perform fy.set_member_logos(sock, '[{"slot":1,"name":"Hank","url":"https://example.supabase.co/l1.png"}]'); raise exception 'should have failed: member sets logos';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.set_member_logos(sock, '[{"slot":1,"name":"Hank","url":"https://example.supabase.co/storage/v1/object/public/logos/sock.png"},{"slot":2,"name":"The Chick","url":"https://example.supabase.co/l2.png"}]');
  select count(*) into n from fy.member_logo where member_id = sock; assert n = 2, 'two logos set';
  perform fy.set_member_logos(sock, '[{"slot":1,"name":"Only","url":"https://example.supabase.co/l9.png"}]');
  select count(*) into n from fy.member_logo where member_id = sock; assert n = 1, 'logos replaced';
  perform pg_temp.as_owner();
  select avatar_url into d from fy.member where id = sock; assert d is null, 'removed logo falls back to the avatar key';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  select count(*) into n from fy.member_logo where member_id = sock; assert n = 1, 'members read each other''s palettes';
  begin insert into fy.member_logo (member_id, slot, name, url) values (pants, 1, 'x', 'https://x.y/a.png'); raise exception 'should have failed: direct logo insert';
  exception when insufficient_privilege then null; end;
  -- Poker feeds: members read the five stories and five videos; a signed-in stranger reads nothing.
  pj := fy.poker_feeds();
  assert jsonb_array_length(pj->'news') = 5 and jsonb_array_length(pj->'videos') = 5, 'feeds carry 5 + 5';
  assert pj->'videos'->0->>'youtube_id' ~ '^[A-Za-z0-9_-]{11}$', 'video ids are YouTube ids';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  assert fy.poker_feeds() is null, 'no profile reads no feeds';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  select revolut_url into d from fy.member where id = sock; assert d = 'https://revolut.me/thesock', 'members read pay-me links';
  update fy.member set revolut_url = 'https://revolut.me/pants' where id = sock;
  perform pg_temp.as_owner();
  select revolut_url into d from fy.member where id = sock; assert d = 'https://revolut.me/thesock', 'cannot set another member''s link';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  select count(*) into n from fy.member; assert n = 0, 'no-profile account still reads no members';

  -- ===== The Humidor =====
  -- Users: 1 RAY (leader), 2 Sock, 3 Pants, 4 Spare (never sends a taste), 5 a signed-in account with no profile.
  -- Errors are checked by SQLSTATE: 42501 not allowed, 23505 duplicate, 55000 not now, 22023 bad input.

  -- A signed-in account with no profile reads nothing and cannot send a taste.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000005');
  assert fy.humidor_current() is null, 'no profile reads no humidor';
  begin perform fy.humidor_submit_prefs('{"size":"Robusto"}'); raise exception 'should have failed: no profile sends a taste';
  exception when others then if sqlstate <> '42501' then raise; end if; end;

  -- A member cannot run the leader's buttons, or read the tables around the RPCs.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.humidor_open_round(); raise exception 'should have failed: member opens a round';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin perform fy.humidor_set_stage(1); raise exception 'should have failed: member pins the stage';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin perform fy.humidor_place_order(); raise exception 'should have failed: member places the order';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  begin select count(*) into n from fy.humidor_round; raise exception 'should have failed: member reads humidor_round directly';
  exception when insufficient_privilege then null; end;

  -- Stage pin: league-wide, works with no round open, 0 to 4 or null.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.humidor_set_stage(3);
  pj := fy.humidor_current();
  assert pj->>'stage' = '3', 'stage pinned to 3, got ' || coalesce(pj->>'stage', 'null');
  assert jsonb_typeof(pj->'round') = 'null', 'no round open yet';
  begin perform fy.humidor_set_stage(5); raise exception 'should have failed: stage 5';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  perform fy.humidor_set_stage(null);
  assert fy.humidor_current()->>'stage' is null, 'stage pin cleared';

  -- Opening: one open round per league.
  hr := fy.humidor_open_round();
  begin perform fy.humidor_open_round(); raise exception 'should have failed: a second open round';
  exception when others then if sqlstate <> '23505' then raise; end if; end;
  pj := fy.humidor_current();
  assert pj->'round'->>'id' = hr::text and pj->'round'->>'status' = 'collecting' and (pj->'round'->>'n')::int = 1, 'round 1 is collecting';

  -- Prefs: a member submits twice and keeps one row; ranking is not open yet.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.humidor_submit_prefs('{"size":"Robusto","budget":"Under £15"}');
  perform fy.humidor_submit_prefs('{"size":"Corona","budget":"Under £15"}');
  begin perform fy.humidor_cast_ranking('{0,1,2}'); raise exception 'should have failed: ranking while collecting';
  exception when others then if sqlstate <> '55000' then raise; end if; end;
  begin perform fy.humidor_submit_prefs('[1,2,3]'); raise exception 'should have failed: prefs not an object';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_submit_prefs(jsonb_build_object('notes', repeat('a', 5000))); raise exception 'should have failed: prefs over 4 KB';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.humidor_submit_prefs('{"size":"Robusto"}');
  perform pg_temp.as_owner();
  select count(*) into n from fy.humidor_pref where round_id = hr and member_id = sock; assert n = 1, 'two submits leave one row, got ' || n;
  select prefs->>'size' into d from fy.humidor_pref where round_id = hr and member_id = sock; assert d = 'Corona', 'the second submit wins';

  -- Posting options: hostile input is refused server side; names are text and stored unchanged.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin perform fy.humidor_post_options('[{"name":"A"},{"name":"B"}]'); raise exception 'should have failed: two options';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_post_options('[{"name":"A","img":"javascript:alert(1)"},{"name":"B"},{"name":"C"}]'); raise exception 'should have failed: javascript img';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_post_options('[{"name":"A","url":"https://shop.example/a\"b"},{"name":"B"},{"name":"C"}]'); raise exception 'should have failed: quote in url';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_post_options('[{"name":"  "},{"name":"B"},{"name":"C"}]'); raise exception 'should have failed: blank name';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_post_options(jsonb_build_array(jsonb_build_object('name', 'A', 'notes', repeat('a', 17000)),
                                                           jsonb_build_object('name', 'B'), jsonb_build_object('name', 'C')));
    raise exception 'should have failed: options over 16 KB';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  perform fy.humidor_post_options('[{"name":"<img src=x onerror=alert(1)>","price":"£9","url":"https://shop.example/a"},{"name":"Option B","price":"10-15","img":""},{"name":"Option C","price":"£12.50","img":"https://shop.example/c.jpg"}]');
  pj := fy.humidor_current();
  assert pj->'round'->>'status' = 'ranking', 'three options move the round to ranking';
  assert pj->'round'->'options'->0->>'name' = '<img src=x onerror=alert(1)>', 'names are stored unchanged';
  -- Reopen: back to collecting, then the same three are posted again (no ballots exist yet, so nothing is lost).
  perform fy.humidor_reopen_collect();
  assert fy.humidor_current()->'round'->>'status' = 'collecting', 'reopen goes back to collecting';
  begin perform fy.humidor_reopen_collect(); raise exception 'should have failed: reopen while collecting';
  exception when others then if sqlstate <> '55000' then raise; end if; end;
  perform fy.humidor_post_options(pj->'round'->'options');
  pj := fy.humidor_current();
  assert pj->'round'->>'status' = 'ranking' and pj->'round'->'options'->2->>'price' = '£12.50', 'reposting returns to ranking with the same options';

  -- Ranking: only members who sent a taste; a permutation of 0..2.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000004');
  begin perform fy.humidor_cast_ranking('{0,1,2}'); raise exception 'should have failed: ranking with no taste sent';
  exception when others then if sqlstate <> '42501' then raise; end if; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy.humidor_cast_ranking('{0,0,1}'); raise exception 'should have failed: option ranked twice';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  perform fy.humidor_cast_ranking('{2,0,1}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.humidor_cast_ranking('{0,2,1}');

  -- Tie-break A: options 0 and 2 have 5 points and one first each, so the lowest index wins.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  hw := fy.humidor_close_ranking();
  assert hw = 0, 'tie on points and firsts goes to option 0, got ' || hw;

  -- Tie-break on firsts: {1,0,2} and {2,0,1} give every option 4 points; options 1 and 2 have a first, 0 has none.
  perform pg_temp.as_owner();
  update fy.humidor_round set status = 'ranking', winner = null where id = hr;
  delete from fy.humidor_ballot where round_id = hr;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.humidor_cast_ranking('{1,0,2}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.humidor_cast_ranking('{2,0,1}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  hw := fy.humidor_close_ranking();
  assert hw = 1, 'most firsts beats the lower index, got ' || hw;

  -- Tie-break B, same round: {2,0,1} and {2,1,0} make option 2 the winner.
  perform pg_temp.as_owner();
  update fy.humidor_round set status = 'ranking', winner = null where id = hr;
  delete from fy.humidor_ballot where round_id = hr;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.humidor_cast_ranking('{2,0,1}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  perform fy.humidor_cast_ranking('{2,1,0}');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  hw := fy.humidor_close_ranking();
  assert hw = 2, 'option 2 wins round B, got ' || hw;

  -- Price: the share is the winner's price; _gbp reads the first number and is internal only.
  perform pg_temp.as_owner();
  select share_gbp into hn from fy.humidor_round where id = hr;
  assert hn = 12.50, 'share is the winner''s price, got ' || coalesce(hn::text, 'null');
  assert (select fy._gbp('10-15')) = 10, '_gbp(10-15) = 10';
  assert (select fy._gbp('£ 9')) = 9, '_gbp(£ 9) = 9';
  assert (select fy._gbp('ask')) is null, '_gbp(ask) is null';
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  begin perform fy._gbp('£5'); raise exception 'should have failed: internal _gbp';
  exception when insufficient_privilege then null; end;

  -- Payments: options are frozen; mark paid is pending, the leader confirms, and a second mark never downgrades.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin perform fy.humidor_post_options('[{"name":"A"},{"name":"B"},{"name":"C"}]'); raise exception 'should have failed: posting while paying';
  exception when others then if sqlstate <> '55000' then raise; end if; end;
  begin perform fy.humidor_set_pay(12.50, 'javascript:alert(1)'); raise exception 'should have failed: bad pay link';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_set_pay(10000, null); raise exception 'should have failed: share over £9999.99';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  begin perform fy.humidor_set_pay(-1, null); raise exception 'should have failed: negative share';
  exception when others then if sqlstate <> '22023' then raise; end if; end;
  perform fy.humidor_set_pay(12.50, 'https://revolut.me/ray');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.humidor_mark_paid();
  perform pg_temp.as_owner();
  select state into st from fy.humidor_pay where round_id = hr and member_id = sock; assert st = 'pending', 'mark paid is pending, got ' || coalesce(st, 'null');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.humidor_confirm_paid(sock, true);
  perform pg_temp.as_owner();
  select state into st from fy.humidor_pay where round_id = hr and member_id = sock; assert st = 'confirmed', 'leader confirms, got ' || coalesce(st, 'null');
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  perform fy.humidor_mark_paid();
  perform pg_temp.as_owner();
  select state into st from fy.humidor_pay where round_id = hr and member_id = sock; assert st = 'confirmed', 'a second mark paid leaves it confirmed, got ' || coalesce(st, 'null');
  -- Unconfirm deletes the row (back to not paid); confirm again so the read and archive below see one confirmed payer.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.humidor_confirm_paid(sock, false);
  perform pg_temp.as_owner();
  select count(*) into n from fy.humidor_pay where round_id = hr and member_id = sock; assert n = 0, 'unconfirm deletes the pay row, got ' || n;
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  begin perform fy.humidor_confirm_paid(gen_random_uuid(), true); raise exception 'should have failed: confirm an unknown member';
  exception when others then if sqlstate <> 'P0002' then raise; end if; end;
  perform fy.humidor_confirm_paid(sock, true);
  perform pg_temp.as_owner();
  select state into st from fy.humidor_pay where round_id = hr and member_id = sock; assert st = 'confirmed', 'confirmed again, got ' || coalesce(st, 'null');
  -- The read carries every list with names.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  pj := fy.humidor_current();
  assert jsonb_array_length(pj->'round'->'prefs') = 2 and jsonb_array_length(pj->'round'->'ballots') = 2
     and jsonb_array_length(pj->'round'->'pays') = 1, 'current carries prefs, ballots and pays';
  assert pj->'round'->'pays'->0->>'nickname' = 'The Sock' and pj->'round'->'pays'->0->>'state' = 'confirmed', 'pays carry the nickname and state';
  assert pj->'round'->>'revolut_url' = 'https://revolut.me/ray' and (pj->'round'->>'share_gbp')::numeric = 12.50, 'current carries the pay link and share';

  -- Closing: the order closes the round into the archive.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  perform fy.humidor_place_order();
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000003');
  pj := fy.humidor_archive();
  assert jsonb_array_length(pj) = 1 and (pj->0->>'winner')::int = 2, 'archive holds 1 round, winner 2';
  assert (pj->0->>'voters')::int = 2 and pj->0->'points' = '[3, 3, 6]'::jsonb, 'archive carries voters and points, got ' || (pj->0->'points')::text;
  assert fy.humidor_current()->>'round' is null, 'no open round after the order';
  -- The next round is number 2.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000001');
  hr := fy.humidor_open_round();
  assert (fy.humidor_current()->'round'->>'n')::int = 2, 'the next round is number 2';

  -- Birthday: a member sets their own day and month; fy.me() carries them; month 13 is refused.
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000002');
  update fy.member set birth_day = 14, birth_month = 2 where id = sock;
  assert (fy.me()).birth_month = 2 and (fy.me()).birth_day = 14, 'me() carries the birthday';
  begin update fy.member set birth_month = 13 where id = sock; raise exception 'should have failed: month 13';
  exception when check_violation then null; end;

  raise notice 'ALL TESTS PASSED';
end $$;
