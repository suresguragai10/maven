-- Maven Work Desk — Handbook Task 9: is_active=false must consistently
-- block business-data access
--
-- VERIFIED FIRST (via the Task 3 harness against a seeded 'inactive'
-- identity — a real authenticated session, is_active=false — matching
-- exactly the "previously valid session/token" scenario this task
-- describes): most tables were already correctly gated by
-- current_user_active() (Client Work, Firm Work, clients,
-- service_templates, app_settings — all fixed by the V2 Permission
-- Audit and Tasks 5/6). Two real, confirmed gaps remained:
--
-- 1. notifications and personal_todos never got the is_active gate at
--    all — pure `auth.uid() = user_id` ownership, deliberately left
--    alone by the V2 audit as "moot" (an already-more-restrictive
--    per-row check). That reasoning missed that OWNERSHIP and ACTIVE
--    STATUS are orthogonal — a deactivated user still owns their old
--    rows, so ownership alone doesn't stop them reading/writing their
--    own notifications/to-dos with a still-valid session.
--
-- 2. Six SECURITY DEFINER functions (add_client_credential,
--    list_client_credentials, reveal_client_credential,
--    delete_client_credential, generate_period_work_for_period,
--    set_client_attention) authorize with
--    `if current_user_role() not in ('admin', 'reviewer') then raise`.
--    current_user_role() returns NULL for a deactivated profile (same
--    as for a genuinely anonymous caller — see Task 1's original
--    finding). `NULL NOT IN (...)` evaluates to NULL, and PL/pgSQL
--    treats a NULL IF-condition as FALSE — the RAISE never fires, so a
--    deactivated user's still-valid session sails through. This was
--    already documented as the "residual risk" left after Task 1's
--    live grant-mitigation (which only closed the ANONYMOUS path, not
--    this one) — fixed here at the root, for real, across all six
--    functions at once, not just the ones literally named
--    "credential RPCs" in this task's text, since they all share the
--    identical bug.
--
-- NOT touched, because they were already correct: work_items/child-
-- table RLS, clients, service_templates, app_settings (all already
-- current_user_active()-gated); profiles_read_authenticated (already
-- current_user_active()-gated since the V2 audit); admin-only policies
-- keyed on current_user_role() = 'admin' (a direct equality check is
-- already NULL-safe/fail-closed — NULL = 'admin' is NULL, and RLS
-- treats a NULL USING/WITH CHECK as excluding the row, same as FALSE;
-- only the inverted NOT IN idiom inside plain PL/pgSQL IF statements
-- has this bug, not RLS policies generally).
--
-- NOT deleted, NOT silently reassigned: deactivating someone only ever
-- flips profiles.is_active — nothing here touches work_items.assignee_
-- id/reviewer_id, and no foreign key from historical data down to
-- profiles(id) has ON DELETE CASCADE (verified directly against every
-- migration: only auth.users->profiles, profiles->personal_todos, and
-- profiles->notifications cascade; work_items/work_comments/
-- work_activity/work_waiting_items/client_services/client_credentials/
-- clients.attention_set_by do NOT, so Postgres would refuse to delete a
-- profiles row with any real history rather than silently orphan or
-- cascade-destroy it). Historical actor references stay fully readable
-- — profiles_read_authenticated only requires the READER be active, it
-- never filtered out inactive profiles as SUBJECTS.

-- ---- 1. notifications: add the is_active gate ----
drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid() and public.current_user_active());

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert
  to authenticated
  with check (user_id = auth.uid() and public.current_user_active());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid() and public.current_user_active());

-- ---- 2. personal_todos: add the is_active gate to all four commands ----
drop policy if exists "personal_todos_select_own" on public.personal_todos;
create policy "personal_todos_select_own" on public.personal_todos
  for select
  to authenticated
  using (auth.uid() = user_id and public.current_user_active());

drop policy if exists "personal_todos_insert_own" on public.personal_todos;
create policy "personal_todos_insert_own" on public.personal_todos
  for insert
  to authenticated
  with check (auth.uid() = user_id and public.current_user_active());

drop policy if exists "personal_todos_update_own" on public.personal_todos;
create policy "personal_todos_update_own" on public.personal_todos
  for update
  to authenticated
  using (auth.uid() = user_id and public.current_user_active())
  with check (auth.uid() = user_id and public.current_user_active());

drop policy if exists "personal_todos_delete_own" on public.personal_todos;
create policy "personal_todos_delete_own" on public.personal_todos
  for delete
  to authenticated
  using (auth.uid() = user_id and public.current_user_active());

-- ---- 3. Root-cause fix for the six NULL-unsafe SECURITY DEFINER
-- functions — coalesce() forces the NOT IN check to actually evaluate
-- to TRUE/FALSE instead of silently-passing NULL for a deactivated (or
-- anonymous) caller. Every other line reproduced exactly as committed.

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
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Only admins and reviewers can store client credentials.';
  end if;
  insert into public.client_credentials (client_id, label, username, password_encrypted, notes, created_by)
  values (p_client_id, p_label, p_username, pgp_sym_encrypt(p_password, 'REPLACE_WITH_SECRET_PASSPHRASE'), p_notes, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.list_client_credentials(p_client_id uuid)
returns table (id uuid, label text, username text, notes text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return query
    select cc.id, cc.label, cc.username, cc.notes, cc.created_at
    from public.client_credentials cc
    where cc.client_id = p_client_id
    order by cc.created_at;
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
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
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
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  delete from public.client_credentials where id = p_id;
end;
$$;

create or replace function public.generate_period_work_for_period(p_period text, p_period_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return public._generate_period_work_core(p_period, p_period_type);
end;
$$;

-- ---- 4. Adjacent, low-risk cleanup while these five functions are
-- already being touched: commit the anon EXECUTE revoke the owner
-- already applied live, by hand, during Handbook Task 1 (see
-- maven_critical_finding_anon_execute_bypass.md) but that was never
-- captured as a migration — a fresh environment built from this repo
-- alone would still have been anon-reachable until now. This does not
-- replace the coalesce() fix above (that closes the underlying NULL-
-- bypass logic bug for every caller, deactivated included); this closes
-- the separate anonymous-caller grant path specifically, matching what
-- set_client_attention already had from its own original migration.
revoke execute on function public.add_client_credential(uuid, text, text, text, text) from public, anon;
revoke execute on function public.list_client_credentials(uuid) from public, anon;
revoke execute on function public.reveal_client_credential(uuid) from public, anon;
revoke execute on function public.delete_client_credential(uuid) from public, anon;
revoke execute on function public.generate_period_work_for_period(text, text) from public, anon;
grant execute on function public.add_client_credential(uuid, text, text, text, text) to authenticated;
grant execute on function public.list_client_credentials(uuid) to authenticated;
grant execute on function public.reveal_client_credential(uuid) to authenticated;
grant execute on function public.delete_client_credential(uuid) to authenticated;
grant execute on function public.generate_period_work_for_period(text, text) to authenticated;

create or replace function public.set_client_attention(p_client_id uuid, p_level text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  if p_level not in ('normal', 'needs_attention', 'high_attention') then
    raise exception 'Invalid attention level.';
  end if;
  if p_level <> 'normal' and (p_reason is null or trim(p_reason) = '') then
    raise exception 'A short reason is required when flagging a client.';
  end if;
  update public.clients set
    attention_level = p_level,
    attention_reason = case when p_level = 'normal' then null else trim(p_reason) end,
    attention_set_by = auth.uid(),
    attention_set_at = now()
  where id = p_client_id;
end;
$$;
