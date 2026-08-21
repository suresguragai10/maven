-- Minimal stand-in for Supabase Storage's platform schema, for local
-- testing only. `storage.buckets`/`storage.objects` and
-- storage.foldername() are platform-managed tables/functions a plain
-- Postgres install doesn't have, needed so
-- 20260903090000_staff_photo_upload.sql's bucket insert and RLS policies
-- run completely unmodified against this stub -- the same statements
-- tested here are what run against the real Storage schema in
-- production. This does NOT reimplement the Storage HTTP API (no actual
-- file bytes are ever stored, no upload/download endpoint) -- only the
-- metadata tables and RLS surface the app's own migration touches.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
