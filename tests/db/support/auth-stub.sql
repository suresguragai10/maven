-- Minimal stand-in for the parts of Supabase's platform schema that the
-- app's own migrations assume already exist: an `auth.users` table (for
-- the profiles.id foreign key and handle_new_user()'s trigger), and
-- auth.uid()/auth.role() (called throughout RLS policies and SECURITY
-- DEFINER functions). This is NOT a reimplementation of Supabase Auth
-- (no signup/login/JWT issuance/session handling) -- it only reproduces
-- the exact request-time READS the schema depends on, driven by setting
-- the same Postgres GUC (request.jwt.claims) PostgREST itself sets from
-- a verified JWT before running a query. tests/db/support/harness.js's
-- asRole() sets this GUC directly per test, which is the same technique
-- used earlier in this project (V2 Task 19) to verify RLS by hand in the
-- Supabase SQL editor -- this just automates and repeats it.
--
-- Also creates the anon/authenticated/service_role roles the real
-- migrations' GRANT/REVOKE statements reference by name.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::json->>'role'
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists extensions;

-- Real Supabase projects grant broad table/sequence privileges to
-- anon/authenticated/service_role at the platform level (outside any
-- app migration) -- RLS is the actual restrictive layer on top of that,
-- not a substitute for it. Without this, every query below would fail
-- with a Postgres-level "permission denied for table X" regardless of
-- RLS, which would test nothing. Mirrors Supabase's own default grants.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
