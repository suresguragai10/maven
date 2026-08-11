-- Maven Work Desk — client_credentials (encrypted portal logins)
--
-- SECURITY NOTE — READ BEFORE RUNNING:
-- The functions below reference a passphrase placeholder,
-- 'REPLACE_WITH_SECRET_PASSPHRASE'. Before applying this migration,
-- replace every occurrence with the project's real pgcrypto passphrase
-- (or generate a new one — see below) and then DO NOT COMMIT the real
-- value to this repo. Treat this file as a template once the placeholder
-- is filled in locally / in your deploy pipeline, not as something to
-- edit-and-push with a live secret inside it.
--
-- To generate a new passphrase: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
-- If you generate a NEW passphrase, any credentials already encrypted
-- with the old one become unreadable — re-enter them after switching.
--
-- The table has RLS enabled with ZERO policies: direct table access
-- (select/insert/update/delete via PostgREST) is fully denied for every
-- role, including admins. The four SECURITY DEFINER functions below are
-- the only way in, each independently checking the caller is admin or
-- reviewer. This is deliberate defense in depth — even a leaked anon key
-- can't read this table directly, only through a function that decrypts
-- exactly what it's asked for and nothing more.
--
-- reveal_client_credential is called only when a user clicks "Show" in
-- the UI, one credential at a time — list_client_credentials (used for
-- the always-visible list) never returns a password, encrypted or
-- otherwise.

create table if not exists public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  username text,
  password_encrypted bytea not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists client_credentials_client_id_idx
  on public.client_credentials (client_id);

alter table public.client_credentials enable row level security;
-- Intentionally no policies here — direct table access is fully denied.
-- All reads/writes go through the SECURITY DEFINER functions below.

create or replace function public.add_client_credential(
  p_client_id uuid, p_label text, p_username text, p_password text, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Only admins and reviewers can store client credentials.';
  end if;
  insert into public.client_credentials (client_id, label, username, password_encrypted, notes, created_by)
  values (p_client_id, p_label, p_username, pgp_sym_encrypt(p_password, 'REPLACE_WITH_SECRET_PASSPHRASE'), p_notes, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- Metadata only — label/username/notes/created_at, never a password. Safe
-- to call as soon as the Credentials modal opens.
create or replace function public.list_client_credentials(p_client_id uuid)
returns table (id uuid, label text, username text, notes text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return query
    select cc.id, cc.label, cc.username, cc.notes, cc.created_at
    from public.client_credentials cc
    where cc.client_id = p_client_id
    order by cc.created_at;
end;
$$;

-- Decrypts exactly one credential's password. Called only on the first
-- "Show" click for that row; the frontend caches the result client-side
-- so toggling Hide/Show afterward doesn't call this again.
create or replace function public.reveal_client_credential(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result text;
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  select pgp_sym_decrypt(cc.password_encrypted, 'REPLACE_WITH_SECRET_PASSPHRASE') into result
  from public.client_credentials cc
  where cc.id = p_id;
  if result is null then
    raise exception 'Credential not found.';
  end if;
  return result;
end;
$$;

create or replace function public.delete_client_credential(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  delete from public.client_credentials where id = p_id;
end;
$$;
