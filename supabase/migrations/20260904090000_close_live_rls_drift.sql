-- Maven Work Desk — close two real live-database RLS drift findings
--
-- Both were flagged as "unresolved facts" in
-- docs/WORK_DESK_BASELINE_SECURITY_MAP.md (owner decision items 1 and 2)
-- that needed a live-schema check, not a repo read, to answer. Both were
-- confirmed live and fixed 2026-08-21.
--
-- PART 1 (profiles): the live database still carried
-- a policy named "profiles_update_own_or_admin"
-- (auth.uid() = id OR current_user_role() = 'admin') that predates this
-- repo's structured migrations. It was never created by any migration
-- in supabase/migrations/ -- it was manually-run, legacy SQL.
--
-- This was a real, exploitable gap, not just a documentation mismatch:
-- it let ANY authenticated user directly UPDATE their own entire
-- profiles row (every column, not just phone/photo_url the way
-- update_my_profile() correctly scopes it), and critically had NO
-- current_user_active() check at all -- a deactivated (offboarded)
-- staff member could set their own is_active back to true directly via
-- the REST API, fully restoring their own access and defeating the
-- entire offboarding guarantee Handbook Task 9 built and
-- PERMISSION_BASELINE.md claims is airtight.
--
-- Dropping this policy also revealed a second, related drift: the
-- correctly-scoped admin policy from 20260811090100_profiles.sql
-- ("profiles_update_admin") did not actually exist live either -- the
-- broad policy above was apparently the ONLY update policy the live
-- database ever had, under a different name. Without it, Staff & Access
-- admin edits (role changes, activate/deactivate, designation/email/
-- join date) would have silently stopped working the moment the broad
-- policy was removed. This migration restores the correct, narrow
-- admin-only policy at the same time, so both live and repo now agree
-- and this fix is reproducible from a clean database going forward.
--
-- Self-service (phone/photo_url only) continues to work exactly as
-- before through update_my_profile() (SECURITY DEFINER, no separate
-- RLS UPDATE policy needed for it to function).

drop policy if exists "profiles_update_own_or_admin" on public.profiles;

drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.current_user_role() = 'admin');

-- A second, related live-drift finding from the same check (see
-- docs/WORK_DESK_BASELINE_SECURITY_MAP.md owner decision item 2, also
-- "unresolved... never re-checked" for a while): 20260811090200_clients.sql
-- defines clients_insert_admin and clients_update_admin, but the live
-- database only ever had clients_read_authenticated. Nobody -- not even
-- admin -- could add or edit a client through Work Desk. Restoring both,
-- exactly as originally designed.

drop policy if exists "clients_insert_admin" on public.clients;
drop policy if exists "clients_update_admin" on public.clients;

create policy "clients_insert_admin" on public.clients
  for insert with check (public.current_user_role() = 'admin');

create policy "clients_update_admin" on public.clients
  for update using (public.current_user_role() = 'admin');
