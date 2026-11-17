-- A table with one player or none closes without a filed docket (RAY, 17 Nov). Run: node tools/db.mjs poker-close-solo.sql
create or replace function fy.poker_close(p_table uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; t fy.poker_table; v_filed boolean;
begin
  me := fy._require_member();
  select * into t from fy.poker_table where id = p_table for update;
  if t.id is null then raise exception 'no such table' using errcode = 'P0002'; end if;
  if t.status = 'closed' then return; end if;
  select exists (select 1 from fy.event e where e.id = t.event_id and e.voided_at is null) into v_filed;
  if not v_filed and me.role <> 'leader' and (select count(*) from fy.poker_seat where table_id = p_table) > 1 then
    raise exception 'file the docket before closing the game';
  end if;
  -- Seat rows stay as the night's record; a closed table simply stops being the live one.
  update fy.poker_table set status = 'closed', closed_at = coalesce(closed_at, now()) where id = p_table;
  delete from fy.poker_hold where table_id = p_table;
end $$;
