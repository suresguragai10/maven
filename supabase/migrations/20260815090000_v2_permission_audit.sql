-- Maven Work Desk — V2 Permission Audit (Task 19)
--
-- FINDING: a deactivated profile (profiles.is_active = false) retains
-- FULL role-appropriate access via direct API/database calls, forever,
-- until someone separately revokes their Supabase Auth session. Every
-- RLS policy in this schema checks `auth.role() = 'authenticated'` or
-- an ownership predicate (assignee_id/reviewer_id/user_id = auth.uid())
-- — none of them checked `profiles.is_active`. The app's own login flow
-- (enterApp() in staff.js) already blocks and logs out a deactivated
-- user, but that is a CLIENT-SIDE check only: it does nothing to stop a
-- direct PostgREST/RPC call made with that person's still-valid access
-- token, and deactivating someone via the Staff page only flips
-- profiles.is_active — it does not ban their Supabase Auth account or
-- revoke their session. Confirmed by reading every policy in this
-- schema; there was no is_active check anywhere at the database layer.
--
-- FIX: current_user_role() (already the single choke point every
-- admin/reviewer-gated policy and RPC in this schema calls) now returns
-- NULL for an inactive profile, which alone closes every admin/reviewer
-- capability in the system for a deactivated account. A new
-- current_user_active() closes the remaining ownership-based policies
-- (a deactivated employee's own previously-assigned work, their own
-- comments/checklist toggles/waiting-item updates) and the blanket
-- "any authenticated user" read policies. Every changed policy below
-- keeps its EXISTING logic unchanged for an active user — this migration
-- only removes access for accounts where is_active = false, which no
-- legitimate app flow ever depends on (enterApp() already refuses to
-- even show the app to such a user).
--
-- Also folds in a second, smaller finding: work_items_update's RLS
-- USING clause was a blanket `auth.role() = 'authenticated'`, wider
-- than work_items_read's own visibility predicate — meaning an update
-- attempt against a row invisible to the caller (e.g. a colleague's
-- active ready_for_review item) reached the guard_work_item_update()
-- trigger and got an explicit rejection there, rather than the row
-- being invisible to the query in the first place. The trigger already
-- prevents any actual data change either way, so this was never an
-- exploitable write — just a minor existence-probing/information gap.
-- Tightened to match work_items_read exactly; no legitimate update path
-- is affected, since the app never loads a row it can't see in order to
-- build an edit call for it.
--
-- SAFETY NOTE on how policies are replaced below: several of the tables
-- touched here (profiles, clients, work_checklist_items, work_comments,
-- work_waiting_items, work_activity, client_services) predate SQL being
-- tracked in this repo — their own migration files already carry a
-- warning that the reconstructed policy NAMES are a best-effort match,
-- not a guaranteed one (this already bit a prior task: client_services'
-- real insert policy turned out to be named "_write", not "_insert", as
-- reconstructed). A plain `drop policy if exists "<guessed-name>"`
-- would silently do nothing if the live name differs, and the following
-- `create policy` would then ADD a second, stricter policy ALONGSIDE
-- the still-live permissive one — since Postgres combines multiple
-- policies for the same command with OR, the old permissive policy
-- would keep working and this entire migration would silently do
-- nothing. drop_policies_for() below sidesteps the naming risk
-- entirely: it drops EVERY existing policy for a given (table, command)
-- pair by querying pg_policies directly, regardless of what it's named.
create or replace function pg_temp.drop_policies_for(p_table text, p_cmd text)
returns void
language plpgsql
as $$
declare
  pol record;
begin
  -- Matches cmd = 'ALL' too, in case a pre-repo table used a single
  -- "for all" policy instead of one per command — every original
  -- migration in this repo declares them split by command, but that
  -- can't be fully confirmed for the pre-repo tables (see note above).
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = p_table and cmd in (p_cmd, 'ALL')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, p_table);
  end loop;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_user_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

-- ---- profiles ----
select pg_temp.drop_policies_for('profiles', 'SELECT');
create policy "profiles_read_authenticated" on public.profiles
  for select using (public.current_user_active());

-- ---- clients ----
select pg_temp.drop_policies_for('clients', 'SELECT');
create policy "clients_read_authenticated" on public.clients
  for select using (public.current_user_active());

-- ---- service_templates / service_template_items ----
select pg_temp.drop_policies_for('service_templates', 'SELECT');
create policy "service_templates_read" on public.service_templates
  for select using (public.current_user_active());

select pg_temp.drop_policies_for('service_template_items', 'SELECT');
create policy "service_template_items_read" on public.service_template_items
  for select using (public.current_user_active());

-- ---- client_services ----
select pg_temp.drop_policies_for('client_services', 'SELECT');
create policy "client_services_read" on public.client_services
  for select using (public.current_user_active());

-- ---- app_settings ----
select pg_temp.drop_policies_for('app_settings', 'SELECT');
create policy "app_settings_read" on public.app_settings
  for select using (public.current_user_active());

-- ---- work_items ----
select pg_temp.drop_policies_for('work_items', 'SELECT');
create policy "work_items_read" on public.work_items
  for select using (
    public.current_user_active() and (
      public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
      or status <> 'ready_for_review'
    )
  );

select pg_temp.drop_policies_for('work_items', 'INSERT');
create policy "work_items_insert" on public.work_items
  for insert with check (
    public.current_user_active()
    and status = 'to_do'
    and (
      public.current_user_role() in ('admin', 'reviewer')
      or assignee_id = auth.uid()
    )
  );

-- Tightened to mirror work_items_read exactly (see finding above) and
-- gated on current_user_active() — was a blanket "any authenticated
-- user," relying entirely on the guard_work_item_update() trigger below
-- to reject unauthorized writes rather than the row being unreachable.
select pg_temp.drop_policies_for('work_items', 'UPDATE');
create policy "work_items_update" on public.work_items
  for update using (
    public.current_user_active() and (
      public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
      or status <> 'ready_for_review'
    )
  );

-- ---- work_checklist_items ----
select pg_temp.drop_policies_for('work_checklist_items', 'SELECT');
create policy "work_checklist_items_read" on public.work_checklist_items
  for select using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

select pg_temp.drop_policies_for('work_checklist_items', 'INSERT');
create policy "work_checklist_items_write" on public.work_checklist_items
  for insert with check (
    public.current_user_active() and (
      public.current_user_role() in ('admin', 'reviewer')
      or exists (select 1 from public.work_items w where w.id = work_item_id and w.assignee_id = auth.uid())
    )
  );

select pg_temp.drop_policies_for('work_checklist_items', 'UPDATE');
create policy "work_checklist_items_update" on public.work_checklist_items
  for update using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- work_comments ----
select pg_temp.drop_policies_for('work_comments', 'SELECT');
create policy "work_comments_read" on public.work_comments
  for select using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

select pg_temp.drop_policies_for('work_comments', 'INSERT');
create policy "work_comments_insert" on public.work_comments
  for insert with check (
    public.current_user_active()
    and auth.uid() = author_id
    and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

-- ---- work_waiting_items ----
select pg_temp.drop_policies_for('work_waiting_items', 'SELECT');
create policy "work_waiting_items_read" on public.work_waiting_items
  for select using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

select pg_temp.drop_policies_for('work_waiting_items', 'INSERT');
create policy "work_waiting_items_insert" on public.work_waiting_items
  for insert with check (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

select pg_temp.drop_policies_for('work_waiting_items', 'UPDATE');
create policy "work_waiting_items_update" on public.work_waiting_items
  for update using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- work_activity ----
select pg_temp.drop_policies_for('work_activity', 'SELECT');
create policy "work_activity_read" on public.work_activity
  for select using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

select pg_temp.drop_policies_for('work_activity', 'INSERT');
create policy "work_activity_insert" on public.work_activity
  for insert with check (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

drop function pg_temp.drop_policies_for(text, text);

-- NOT changed, and why:
--   • personal_todos (auth.uid() = user_id, all 4 ops) — a deactivated
--     person editing their own private scratchpad has zero effect on
--     firm operations; not worth the churn.
--   • notifications (auth.uid() = user_id, all ops) — same reasoning,
--     purely personal and inert.
--   • client_credentials — already the strictest table in the schema
--     (RLS enabled with ZERO policies; every access path is one of 4
--     SECURITY DEFINER functions that call current_user_role()), so
--     it's already fully covered by that function's fix above.
--   • set_client_attention() / generate_period_work_for_period() — both
--     already gate on current_user_role() internally, covered above.
--   • admin-only write policies (profiles_update_admin, clients_insert/
--     update_admin, service_templates_*_admin, client_services_write/
--     update/delete, app_settings_update/insert_admin,
--     work_items_delete) — all already keyed on current_user_role() =
--     'admin', covered transitively by that function's fix; no separate
--     policy text needed.
--   • client_credentials RPCs granting BOTH admin and reviewer access —
--     flagged during this audit as a mismatch against the stated role
--     matrix (Reviewer = review work / record review activity; Admin/
--     Manager = configure clients), but confirmed with the user to keep
--     as-is: reviewers often need a client's portal login to actually
--     perform a review. Not a bug, a deliberate scope decision.
