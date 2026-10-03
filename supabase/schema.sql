-- ===== Farmyard Hub schema. Idempotent: safe to re-run. =====
-- pg_cron is enabled by RAY in the dashboard (Database → Extensions) before this runs.
create schema if not exists fy;
grant usage on schema fy to anon, authenticated;

-- 1. Tables ----------------------------------------------------------------
create table if not exists fy.league (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  public_badges boolean not null default true,
  auto_confirm_days int not null default 14,
  created_at timestamptz not null default now()
);

create table if not exists fy.member (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  nickname text not null,
  avatar text not null default 'hen',
  user_id uuid unique references auth.users(id),
  discord_id text,
  role text not null default 'member' check (role in ('leader','member')),
  chesscom_username text,
  created_at timestamptz not null default now(),
  unique (league_id, nickname)
);

-- Claim tokens live apart from member so no page can ever read them.
create table if not exists fy.claim_link (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  member_id uuid not null references fy.member(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists fy.event_type (
  key text not null,
  league_id uuid not null references fy.league(id),
  label text not null,
  points_rule jsonb not null default '{"rule":"winner_takes_all"}',
  overall_weight numeric not null default 1,
  primary key (league_id, key)
);

create table if not exists fy.event (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  type_key text not null,
  played_at timestamptz not null default now(),
  entered_by uuid references fy.member(id),
  note text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (league_id, type_key) references fy.event_type(league_id, key)
);

create table if not exists fy.score_entry (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  event_id uuid references fy.event(id),
  member_id uuid not null references fy.member(id),
  points int not null,
  reason text not null check (reason in ('result','correction','claim')),
  created_at timestamptz not null default now()
);

create table if not exists fy.settlement (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  member_a uuid not null references fy.member(id),
  member_b uuid not null references fy.member(id),
  settled_at timestamptz not null default now(),
  recorded_by uuid references fy.member(id)
);

create table if not exists fy.iou (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  event_id uuid references fy.event(id),
  payer_id uuid not null references fy.member(id),
  payee_id uuid not null references fy.member(id),
  amount int not null check (amount > 0),
  state text not null default 'open'
    check (state in ('open','marked_paid','confirmed','disputed','settled')),
  state_changed_at timestamptz not null default now(),
  settlement_id uuid references fy.settlement(id),
  created_at timestamptz not null default now(),
  check (payer_id <> payee_id)
);

create table if not exists fy.claim (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references fy.league(id),
  member_id uuid not null references fy.member(id),
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','approved','rejected')),
  decided_by uuid references fy.member(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Seed: one league, three event types. Re-runnable.
insert into fy.league (slug, name) values ('farmyard', 'The Farmyard')
  on conflict (slug) do nothing;
insert into fy.event_type (league_id, key, label, overall_weight)
select l.id, v.key, v.label, v.w from fy.league l,
  (values ('poker','Poker',1), ('chess','Chess',1), ('super6','Super 6',0)) as v(key,label,w)
where l.slug = 'farmyard'
on conflict do nothing;
