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
        cp uuid; iou1 uuid; iou2 uuid; st text; r int;
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

  raise notice 'ALL TESTS PASSED';
end $$;
