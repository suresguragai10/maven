-- Maven Work Desk — Handbook Task 5: Client Work SELECT visibility fix
--
-- FINDING (confirmed via the Task 3 direct-database test harness, see
-- docs/PERMISSION_BASELINE.md "work_items (client scope)"): work_items_read
-- and its four child tables' read policies all carry an unconditional
-- `OR status <> 'ready_for_review'` branch. In practice this means ANY
-- active teammate — not just the assignee, the reviewer, or an admin —
-- can read ANY client-scope work item (and its checklist, comments,
-- activity, waiting items) as long as it isn't currently in the one
-- status ('ready_for_review') where visibility was believed to narrow.
-- That is not an intentional business rule; it is a blanket-read
-- fallback that happens to look scoped because ready_for_review is the
-- one state most testing exercised.
--
-- EVIDENCE FOR THE INTENDED MODEL: staff.js's own loadWork() function,
-- for its 'review' mode, already narrows explicitly for a non-admin
-- reviewer (`if (!isAdmin()) q = q.eq('reviewer_id', state.user.id);`)
-- with a comment stating plainly: "A plain reviewer only sees work where
-- they're the assigned reviewer; admins see the whole review queue...
-- the filter here is for a tidy query, not the actual security boundary,
-- since RLS enforces the same rule even if this line were removed." That
-- belief was wrong — RLS did NOT already enforce it — but it is direct,
-- pre-existing evidence of the intended design: employee scoped to their
-- own assigned work, reviewer scoped to work they review, admin sees
-- everything. This migration makes RLS actually match that belief,
-- rather than redefining the rule to match RLS's accidental behavor.
--
-- BEHAVIOR CHANGE, FLAGGED FOR THE OWNER: Manager Dashboard and Reports
-- (both gated to reviewer-or-admin in the UI) call loadWork('all') /
-- run their own unscoped queries with no reviewer-specific narrowing —
-- they relied on the same broad RLS fallback to show a REVIEWER
-- firm-wide data. After this fix, a REVIEWER (not admin) using those two
-- screens will only see items where they are the assignee or reviewer,
-- not the whole firm's client work. Admin is unaffected (already had,
-- and keeps, full access). This is believed correct per the evidence
-- above, but it is a real, visible behavior change for the reviewer
-- role specifically — if Reports/Manager Dashboard are meant to give
-- reviewers a genuine firm-wide view, that needs a dedicated, narrowly-
-- scoped SECURITY DEFINER reporting function (least-privilege: an
-- aggregate/report-shaped grant, not a broadening of general table
-- read access) as a follow-up task, not a reversion of this fix.
--
-- SCOPE: this migration only touches SELECT policies (work_items_read
-- plus the four child tables' *_read policies), matching this task's
-- stated objective ("Make Client Work SELECT visibility explicit").
-- work_items_update's identical broad clause is ALSO tightened here for
-- consistency (same pattern, same fix) — this does not change any actual
-- write outcome: guard_work_item_update() already independently blocks
-- a non-owner's write regardless of what the USING clause matches
-- (confirmed in Task 3's evidence: "blocked by guard_work_item_update()
-- ... not by RLS"), so this is defense-in-depth, not new behavior.
--
-- Firm Work (work_scope = 'firm') is completely unaffected — every
-- policy below keeps its `work_scope = 'firm' OR ...` branch exactly as
-- it was; only the client-scope fallback is removed.
--
-- No views exist anywhere in this schema (checked directly — zero
-- `create view` statements across all 16 prior migrations) and no RPC
-- returns raw work_items rows to a caller, so there is no separate
-- bypass path to fix alongside these policies.

-- ---- work_items ----
drop policy if exists "work_items_read" on public.work_items;
create policy "work_items_read" on public.work_items
  for select
  to authenticated
  using (
    public.current_user_active() and (
      work_scope = 'firm'
      or public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
    )
  );

drop policy if exists "work_items_update" on public.work_items;
create policy "work_items_update" on public.work_items
  for update
  to authenticated
  using (
    public.current_user_active() and (
      work_scope = 'firm'
      or public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
    )
  );

-- ---- work_checklist_items ----
drop policy if exists "work_checklist_items_read" on public.work_checklist_items;
create policy "work_checklist_items_read" on public.work_checklist_items
  for select
  to authenticated
  using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_checklist_items.work_item_id
        and (
          w.work_scope = 'firm'
          or public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- work_comments ----
drop policy if exists "work_comments_read" on public.work_comments;
create policy "work_comments_read" on public.work_comments
  for select
  to authenticated
  using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_comments.work_item_id
        and (
          w.work_scope = 'firm'
          or public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- work_activity ----
drop policy if exists "work_activity_read" on public.work_activity;
create policy "work_activity_read" on public.work_activity
  for select
  to authenticated
  using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_activity.work_item_id
        and (
          w.work_scope = 'firm'
          or public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- work_waiting_items ----
drop policy if exists "work_waiting_items_read" on public.work_waiting_items;
create policy "work_waiting_items_read" on public.work_waiting_items
  for select
  to authenticated
  using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_waiting_items.work_item_id
        and (
          w.work_scope = 'firm'
          or public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- index: reviewer_id was never indexed, unlike assignee_id, despite
-- both now being used identically in every policy above (and already
-- identically in work_items_insert/loadWork('review')). Matches the
-- existing work_items_assignee_id_idx for symmetry.
create index if not exists work_items_reviewer_id_idx on public.work_items (reviewer_id);
