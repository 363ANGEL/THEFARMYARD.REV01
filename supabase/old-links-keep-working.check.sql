-- Checks for old-links-keep-working.sql. Read-only: everything runs in a transaction that is rolled back.
-- Prints states and nicknames, never a token. Run after the migration: node tools/db.mjs supabase/old-links-keep-working.check.sql
begin;
-- A crafted expired link for an unclaimed member (rolled back below).
insert into fy.claim_link (member_id, league_id, yard_id, token, expires_at)
select id, league_id, yard_id, 'ffffffffffffffffffffffffffffffff', now() - interval '1 day'
  from fy.member where user_id is null order by nickname limit 1;
select m.nickname, m.user_id is not null as claimed, c.used_at is not null as used, c.expires_at,
       fy.claim_status(c.token) as status
  from fy.claim_link c join fy.member m on m.id = c.member_id
 order by m.nickname, c.created_at;
select fy.claim_status('00000000000000000000000000000000') as unknown_token;
-- Expect: Ben and Dan -> member; Craig and Jamie -> open; the crafted row -> expired; unknown_token -> unknown.
rollback;
