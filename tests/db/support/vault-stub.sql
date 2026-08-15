-- Minimal stand-in for Supabase Vault, for local testing only. Supabase
-- Vault (the `supabase_vault` extension — confirmed already installed on
-- the real project via Task 3's live extension-list capture) is a
-- platform extension, not a standard Postgres contrib module, and isn't
-- bundled in the generic `embedded-postgres` npm package this harness
-- uses. This reproduces exactly the interface Handbook Task 10's
-- migration actually calls (`vault.create_secret()` at setup time,
-- `vault.decrypted_secrets` at read time) so that migration's own SQL
-- runs completely unmodified against this stub — the same code path
-- tested here is what runs against the real Vault in production. The
-- one thing this stub does NOT do is actually encrypt the stored secret
-- (real Vault encrypts via pg_sodium) — fine for a local, throwaway,
-- always-destroyed-after-the-test-run database with no real secrets in
-- it, never acceptable anywhere else.

create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function vault.create_secret(p_secret text, p_name text default null, p_description text default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into vault.secrets (name, description, secret) values (p_name, p_description, p_secret)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, created_at, updated_at
  from vault.secrets;
