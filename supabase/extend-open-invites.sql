-- Unused invite links issued before the 4-week rule (RAY, 27 Nov) get the same 4 weeks from issue.
update fy.claim_link set expires_at = created_at + interval '28 days'
 where used_at is null and expires_at < created_at + interval '28 days'
returning (select nickname from fy.member m where m.id = member_id) who, expires_at;
