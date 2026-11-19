-- Calendar events: any member creates, edits and deletes their own (admins any), everyone sees all, and every other
-- member gets a notice when one is created, changed or cancelled. A notice clears 5 days after its event date.
-- RAY, 18 Nov. Run: node tools/db.mjs calendar-events.sql   (safe to run twice)
create table if not exists fy.cal_event (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  created_by uuid not null references fy.member(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  event_date date not null,
  event_time time,
  note text check (note is null or char_length(note) <= 280),
  icon text not null default 'other' check (icon in ('poker','birthday','football','party','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cal_event_date_idx on fy.cal_event (event_date);

-- A notice carries its own copy of the title and date, so a cancelled event can still be announced.
create table if not exists fy.cal_notice (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references fy.member(id) on delete cascade,
  event_id uuid,
  kind text not null check (kind in ('new','changed','cancelled')),
  title text not null,
  event_date date not null,
  event_time time,
  by_nickname text,
  created_at timestamptz not null default now()
);
create index if not exists cal_notice_member_idx on fy.cal_notice (member_id, event_date);

alter table fy.cal_event enable row level security;
alter table fy.cal_notice enable row level security;
grant select on fy.cal_event, fy.cal_notice to authenticated;
drop policy if exists cal_event_read on fy.cal_event;
create policy cal_event_read on fy.cal_event for select to authenticated using (fy.is_member() or fy.is_leader());
drop policy if exists cal_notice_read on fy.cal_notice;
create policy cal_notice_read on fy.cal_notice for select to authenticated
  using (member_id in (select id from fy.member where user_id = auth.uid()));

-- Internal: tell every other claimed member.
create or replace function fy._cal_notify(p_actor fy.member, p_kind text, p_event_id uuid, p_title text, p_date date, p_time time) returns void
language sql security definer set search_path = fy, public as $$
  insert into fy.cal_notice (member_id, event_id, kind, title, event_date, event_time, by_nickname)
  select m.id, p_event_id, p_kind, p_title, p_date, p_time, p_actor.nickname
  from fy.member m where m.league_id = p_actor.league_id and m.user_id is not null and m.id <> p_actor.id;
$$;

create or replace function fy.cal_create(p_title text, p_date date, p_time time default null, p_note text default null, p_icon text default 'other') returns uuid
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; v_id uuid; v_title text := btrim(coalesce(p_title, ''));
begin
  me := fy._require_member();
  if char_length(v_title) not between 1 and 80 then raise exception 'give the event a title (up to 80 characters)'; end if;
  if p_date is null then raise exception 'pick a date'; end if;
  insert into fy.cal_event (league_id, created_by, title, event_date, event_time, note, icon)
  values (me.league_id, me.id, v_title, p_date, p_time, nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_icon, 'other')) returning id into v_id;
  perform fy._cal_notify(me, 'new', v_id, v_title, p_date, p_time);
  return v_id;
end $$;

create or replace function fy.cal_update(p_id uuid, p_title text, p_date date, p_time time default null, p_note text default null, p_icon text default 'other') returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; e fy.cal_event; v_title text := btrim(coalesce(p_title, ''));
begin
  me := fy._require_member();
  select * into e from fy.cal_event where id = p_id for update;
  if e.id is null then raise exception 'no such event' using errcode = 'P0002'; end if;
  if e.created_by <> me.id and me.role <> 'leader' then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 80 then raise exception 'give the event a title (up to 80 characters)'; end if;
  if p_date is null then raise exception 'pick a date'; end if;
  update fy.cal_event set title = v_title, event_date = p_date, event_time = p_time,
    note = nullif(btrim(coalesce(p_note, '')), ''), icon = coalesce(p_icon, 'other'), updated_at = now() where id = p_id;
  perform fy._cal_notify(me, 'changed', p_id, v_title, p_date, p_time);
end $$;

create or replace function fy.cal_delete(p_id uuid) returns void
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member; e fy.cal_event;
begin
  me := fy._require_member();
  select * into e from fy.cal_event where id = p_id for update;
  if e.id is null then return; end if;
  if e.created_by <> me.id and me.role <> 'leader' then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from fy.cal_event where id = p_id;
  perform fy._cal_notify(me, 'cancelled', p_id, e.title, e.event_date, e.event_time);
end $$;

-- My notices. Clears every notice more than 5 days past its event first, so the list wipes itself.
create or replace function fy.cal_notices() returns setof fy.cal_notice
language plpgsql security definer set search_path = fy, public as $$
declare me fy.member;
begin
  me := fy._require_member();
  delete from fy.cal_notice where member_id = me.id and event_date < current_date - 5;
  return query select * from fy.cal_notice where member_id = me.id order by created_at desc;
end $$;

grant execute on function fy.cal_create, fy.cal_update, fy.cal_delete, fy.cal_notices to authenticated;
revoke all on function fy._cal_notify from public;
