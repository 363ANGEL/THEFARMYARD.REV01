-- RAY, 27 Nov: "re instate all links". Every invite link ever sent stays a working door.
-- Claimed members: their link never expires. Unclaimed: at least 4 weeks from issue.
update fy.claim_link c set expires_at = null
  from fy.member m where m.id = c.member_id and m.user_id is not null and c.expires_at is not null;
update fy.claim_link set expires_at = created_at + interval '28 days'
 where expires_at < created_at + interval '28 days';
select m.nickname, c.used_at is not null used, c.expires_at from fy.claim_link c join fy.member m on m.id = c.member_id order by 1;
