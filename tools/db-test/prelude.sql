-- Local stand-ins for the Supabase platform, so schema.sql + test.sql run on a plain
-- embedded Postgres. Test harness only — never applied to the live project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz
);
create table if not exists auth.identities (
  user_id uuid, provider text, provider_id text, identity_data jsonb,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
-- Supabase's auth.uid(): the sub claim of the request JWT, or null.
create or replace function auth.uid() returns uuid language sql stable as $f$
  select (nullif(nullif(current_setting('request.jwt.claims', true), ''), 'null')::jsonb->>'sub')::uuid
$f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$
  select nullif(nullif(current_setting('request.jwt.claims', true), ''), 'null')::jsonb
$f$;

-- pg_cron stub: schema.sql's "create extension pg_cron" line is filtered by run.js;
-- cron.schedule just swallows the call.
create schema if not exists cron;
create or replace function cron.schedule(job_name text, schedule text, command text)
  returns bigint language sql as $f$ select 1::bigint $f$;

-- Realtime publication, so the "alter publication supabase_realtime" guards execute.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
