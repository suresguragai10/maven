-- Maven Work Desk — Handbook Task 10: credential/secret hardening
--
-- PROBLEM: add_client_credential/reveal_client_credential encrypted and
-- decrypted client portal passwords with a literal placeholder string,
-- 'REPLACE_WITH_SECRET_PASSPHRASE', committed directly in migration SQL.
-- The original migration's own header warned this had to be manually
-- replaced with a real value before running, and never committed back —
-- but every later task that had any other reason to touch these two
-- functions (Task 9's NULL-bypass fix, most recently) had to reproduce
-- the function body byte-for-byte, silently re-committing the same
-- placeholder each time. Nothing verified the placeholder was ever
-- actually replaced live, and a fresh environment built from this repo
-- alone — exactly the scenario this task's acceptance criterion asks
-- about — would silently "encrypt" every credential with a publicly
-- known string sitting in Git history.
--
-- FIX: the passphrase now lives in Supabase Vault (`vault.secrets` /
-- `vault.decrypted_secrets`), a Postgres-extension-backed encrypted
-- secret store built into every Supabase project (confirmed already
-- installed on this project — `supabase_vault` appeared in the live
-- extension list captured during Handbook Task 3's harness runs) — this
-- is the "supported Vault/secret approach" this task asks for, not a
-- custom scheme. Both functions now look the passphrase up at call time
-- and RAISE a clear, specific exception if it isn't configured, instead
-- of falling back to any default or placeholder. A fresh deployment that
-- hasn't completed the one-time Vault setup step (see docs/
-- SECURITY_MODEL.md "Secret setup") fails closed: nobody can store or
-- reveal a credential until an admin actually configures the secret,
-- which is the correct failure mode for a feature that exists
-- specifically to protect client portal passwords.
--
-- NOT changed here: everything else about these functions (the
-- admin/reviewer authorization check, now NULL-safe since Task 9; the
-- EXECUTE grants, anon-revoked/authenticated-granted since Task 9;
-- list_client_credentials/delete_client_credential, which never touched
-- the passphrase at all). This migration is scoped to the two functions
-- that actually call pgp_sym_encrypt/pgp_sym_decrypt.
--
-- ONE-TIME MANUAL SETUP REQUIRED, NOT PART OF THIS FILE (by design — the
-- real secret value must never be committed): after running this
-- migration, an admin must run, once, in the Supabase SQL editor:
--
--   select vault.create_secret(
--     '<a long, randomly generated passphrase — see docs/SECURITY_MODEL.md
--       "Secret setup" for how to generate one>',
--     'client_credentials_passphrase',
--     'Symmetric passphrase for encrypting/decrypting client portal
--       credentials (client_credentials.password_encrypted). Rotating
--       this makes every ALREADY-encrypted credential unreadable with
--       the new value — see docs/SECURITY_MODEL.md before rotating.'
--   );
--
-- Until that runs, add_client_credential/reveal_client_credential raise
-- 'Client credential encryption is not configured...' for every caller,
-- including admin — this is the intended fail-closed behavior, not a
-- bug to work around by falling back to anything.

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
  v_passphrase text;
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Only admins and reviewers can store client credentials.';
  end if;

  select decrypted_secret into v_passphrase
    from vault.decrypted_secrets
    where name = 'client_credentials_passphrase'
    limit 1;
  if v_passphrase is null or trim(v_passphrase) = '' then
    raise exception 'Client credential encryption is not configured. An admin must set up the client_credentials_passphrase secret in Supabase Vault before credentials can be stored — see docs/SECURITY_MODEL.md.';
  end if;

  insert into public.client_credentials (client_id, label, username, password_encrypted, notes, created_by)
  values (p_client_id, p_label, p_username, pgp_sym_encrypt(p_password, v_passphrase), p_notes, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.reveal_client_credential(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result text;
  v_passphrase text;
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;

  select decrypted_secret into v_passphrase
    from vault.decrypted_secrets
    where name = 'client_credentials_passphrase'
    limit 1;
  if v_passphrase is null or trim(v_passphrase) = '' then
    raise exception 'Client credential encryption is not configured. An admin must set up the client_credentials_passphrase secret in Supabase Vault before credentials can be revealed — see docs/SECURITY_MODEL.md.';
  end if;

  select pgp_sym_decrypt(cc.password_encrypted, v_passphrase) into result
  from public.client_credentials cc
  where cc.id = p_id;
  if result is null then
    raise exception 'Credential not found.';
  end if;
  return result;
end;
$$;
