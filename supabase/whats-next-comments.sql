-- What's Next room cards: each card rolls down to show members' comments (RAY, 27 Nov).
-- Comments ride on fy.suggestion with room_key 'c:<room id>'. Those rows are readable by every
-- member; everything else in the table stays own-rows-only (leader reads the lot) as before.
drop policy if exists suggestion_comments on fy.suggestion;
create policy suggestion_comments on fy.suggestion for select to authenticated using (
  room_key like 'c:%' and exists (select 1 from fy.member m where m.user_id = auth.uid()));
