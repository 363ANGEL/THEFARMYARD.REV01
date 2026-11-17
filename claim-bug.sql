-- Adds 'Site bug' to the profile claim form (RAY, 17 Nov). Run: node tools/db.mjs claim-bug.sql
create or replace function fy.raise_claim(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_id uuid;
begin
  select * into me from fy.member where user_id = auth.uid();
  if me.id is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if coalesce(p_payload->>'type', '') not in ('points','iou','bug') then raise exception 'claim type must be points, iou or bug'; end if;
  if p_payload->>'type' = 'bug' and length(btrim(coalesce(p_payload->>'note', ''))) = 0 then raise exception 'say what went wrong'; end if;
  if p_payload->>'type' = 'points' and coalesce(p_payload->>'points', '') !~ '^[1-9][0-9]{0,3}$' then raise exception 'points must be a whole number, 1 to 9999'; end if;
  if p_payload->>'type' = 'iou' and coalesce(p_payload->>'amount', '') !~ '^[1-9][0-9]{0,3}$' then raise exception 'amount must be a whole number, 1 to 9999'; end if;
  insert into fy.claim (league_id, member_id, payload) values (fy._league(), me.id, p_payload) returning id into v_id;
  return v_id;
end $$;

create or replace function fy.decide_claim(p_claim uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = fy, public as $$
declare leader fy.member; c fy.claim; v_event uuid;
begin
  leader := fy._require_leader();
  select * into c from fy.claim where id = p_claim and state = 'pending' for update;
  if c.id is null then raise exception 'no pending claim' using errcode = 'P0002'; end if;
  if p_approve then
    if c.payload->>'type' = 'points' then
      insert into fy.event (league_id, type_key, entered_by, note)
      values (fy._league(), c.payload->>'type_key', leader.id, 'claim ' || c.id) returning id into v_event;
      insert into fy.score_entry (league_id, event_id, member_id, points, reason)
      values (fy._league(), v_event, c.member_id, (c.payload->>'points')::int, 'claim');
    elsif c.payload->>'type' = 'iou' then
      insert into fy.iou (league_id, payer_id, payee_id, amount)
      values (fy._league(), (c.payload->>'payer_id')::uuid, (c.payload->>'payee_id')::uuid, (c.payload->>'amount')::int);
    end if;   -- a site bug report scores nothing: approving it just marks it done
  end if;
  update fy.claim set state = case when p_approve then 'approved' else 'rejected' end,
                      decided_by = leader.id, decided_at = now() where id = p_claim;
end $$;
