-- Maven Work Desk — extensions
--
-- pgcrypto: symmetric encryption for client_credentials.password_encrypted
-- (pgp_sym_encrypt / pgp_sym_decrypt). Supabase installs extensions into the
-- "extensions" schema, not "public" — every SECURITY DEFINER function that
-- calls a pgcrypto function must include "extensions" in its search_path,
-- or the call fails with "function pgp_sym_encrypt(text, unknown) does not
-- exist" (hit this exact error once when the schema was first stood up).
create extension if not exists pgcrypto with schema extensions;

-- pg_cron: schedules the daily "generate work for the current period" sweep
-- (see 20260811091000_recurring_work_generation.sql). Confirmed available
-- on this project's Supabase plan before this was built.
create extension if not exists pg_cron;
