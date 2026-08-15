-- Maven Work Desk — Handbook Task 6: work-item UPDATE authorization fix
--
-- FINDINGS FIXED (confirmed via the Task 3 test harness, see
-- docs/PERMISSION_BASELINE.md — both were "current behavior does not
-- match the intended model" entries before this migration):
--
-- 1. A reviewer could rescope/reassign/change-client on ANY work item
--    they review, not just record review decisions. guard_work_item_
--    update()'s reviewer branch was a blanket `null;` (skip every
--    check) once role='reviewer' and old/new.reviewer_id matched them —
--    identical in shape to the admin branch, when the intended model
--    (docs/ROLE_CAPABILITIES.md) is "Reviewer = review work and record
--    review decisions; Admin = configure clients/services/assignment."
-- 2. The submission-timing rule ("submission fields can only be
--    recorded once status is ready_to_submit/completed") lived INSIDE
--    that same blanket-skipped branch, so both a matching reviewer AND
--    admin could backfill submission fields on an item that was never
--    actually marked ready. This is a workflow-integrity rule, not a
--    permission rule — it now applies to every role, admin included.
--
-- ALSO FIXED, not previously a named Task 3 finding but the same root
-- pattern: work_scope itself had no explicit immutability guard — an
-- admin or matching reviewer could silently flip an existing item
-- between Client Work and Firm Work (a client-scope item's own
-- rescope-trigger only blocked this indirectly, via the client_id-
-- change check, and only for a plain employee). Per this task's own
-- instruction ("work_scope must not be casually changed to escape
-- Client Work controls"), work_scope is now immutable after creation
-- for every role, no exception — the correct way to move something
-- between Client Work and Firm Work is to create a new item, not
-- reclassify an existing one.
--
-- ALSO FIXED: created_at/created_by/id had no protection at all —
-- anyone with UPDATE access to a row (which now correctly includes
-- Firm Work peers, see below) could have silently rewritten who
-- created something and when. Immutable for every role, admin
-- included, matching this task's "protect immutable system/audit
-- fields" instruction and the same philosophy already applied to
-- work_activity (immutable audit trail).
--
-- FIRM WORK PEER-EDITING GAP CLOSED (this was tracked as its own future
-- item, "Handbook Task 16" in the roadmap, before this task's own text
-- explicitly folded it in): the OLD trigger's employee/reviewer-fallback
-- branch applied "you can only update work assigned to you" to BOTH
-- scopes, since nothing distinguished them once role wasn't admin (or a
-- matching reviewer, which never applies to Firm Work — Firm Work has
-- no reviewer concept). That's exactly why a non-assignee peer couldn't
-- touch someone else's Firm Work at the database level even though
-- docs/PRODUCT_BOUNDARIES.md's peer model says they should be able to.
-- This migration branches on work_scope FIRST, before any Client-Work-
-- specific role logic, so Firm Work gets its own, genuinely peer-based
-- rule: any ACTIVE teammate, any role, full edit/reassign power, no
-- ownership check at all. Category/status are already validated by
-- existing CHECK constraints (firm_category, work_items_status_scope_
-- check) — nothing further to add there. "Project" grouping isn't built
-- yet (approved but not shipped, per PRODUCT_BOUNDARIES.md), so there is
-- nothing to validate for it in this migration.
--
-- NOT changed here, deliberately: RLS policies. work_items_update's
-- USING clause (tightened in Task 5) already correctly gates WHICH rows
-- an update attempt can target at all; this migration is entirely about
-- the TRIGGER — what's allowed to actually change once a row is
-- targetable. The two layers stay complementary, not duplicated.
--
-- Enhanced activity-history logging for these new denial/allow paths is
-- explicitly deferred — this task's own instruction says to record
-- material changes in history "once Task 7 is complete" (Task 7 =
-- "Audit history integrity," not yet done). The existing unconditional
-- reassigned/due_date_changed logging at the bottom of this function is
-- untouched and still fires for both scopes, Firm Work included.

create or replace function public.guard_work_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
  caller uuid;
begin
  role := public.current_user_role();
  caller := auth.uid();

  -- ==========================================================
  -- Universal rules — apply to every role, including admin.
  -- ==========================================================

  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'id/created_at/created_by cannot be changed.';
  end if;

  -- A foundational classification set once at creation, not a field to
  -- toggle later — see the migration header for why.
  if new.work_scope is distinct from old.work_scope then
    raise exception 'work_scope cannot be changed after creation.';
  end if;

  if new.status = 'ready_for_review' and new.reviewer_id is null then
    raise exception 'Assign a reviewer before sending this work for review.';
  end if;

  -- Workflow-state integrity, not a permission rule: recording a
  -- submission before the work was ever actually marked ready would
  -- misrepresent what was filed and when, regardless of who does it.
  if new.work_scope = 'client'
     and (new.submission_status is distinct from old.submission_status
       or new.submitted_at is distinct from old.submitted_at
       or new.submitted_by is distinct from old.submitted_by
       or new.submission_reference is distinct from old.submission_reference
       or new.submission_note is distinct from old.submission_note)
     and old.status not in ('ready_to_submit', 'completed') then
    raise exception 'Submission can only be recorded once the work is ready to submit.';
  end if;

  -- ==========================================================
  -- Role/scope-specific rules
  -- ==========================================================

  if role = 'admin' then
    -- Full management power, exactly as docs/ROLE_CAPABILITIES.md
    -- describes — bounded by the universal rules above, not unlimited.
    null;

  elsif new.work_scope = 'firm' then
    -- ---- Firm Work: intentionally collaborative peer model ----
    -- Any active teammate, any Client-Work role, full edit/reassign
    -- power on ANY Firm Work item — not scoped to the current assignee.
    -- This is the approved rule (docs/PRODUCT_BOUNDARIES.md), not a
    -- gap: Client Work's ownership/reassignment restrictions below
    -- must never leak onto Firm Work.
    if not public.current_user_active() then
      raise exception 'Your account is inactive.';
    end if;

  elsif role = 'reviewer' and (old.reviewer_id = caller or new.reviewer_id = caller) then
    -- ---- Client Work, reviewer on this specific item ----
    -- Review decisions only — approving, requesting changes, marking
    -- ready-to-submit, adjusting dates/notes on the item they review.
    -- NOT a blanket bypass: reassigning, rescoping, or changing who
    -- reviews is admin's job, same as for a plain employee below.
    if new.assignee_id <> old.assignee_id
       or new.reviewer_id is distinct from old.reviewer_id
       or new.client_id is distinct from old.client_id
       or new.service_template_id is distinct from old.service_template_id then
      raise exception 'Only an admin can reassign or rescope work.';
    end if;

  else
    -- ---- Client Work, plain employee (or a reviewer not on this item) ----
    if old.assignee_id <> caller then
      raise exception 'You can only update work assigned to you.';
    end if;
    if new.assignee_id <> old.assignee_id
       or new.reviewer_id is distinct from old.reviewer_id
       or new.client_id is distinct from old.client_id
       or new.service_template_id is distinct from old.service_template_id then
      raise exception 'Only an admin can reassign or rescope work.';
    end if;
    if new.status in ('approved', 'changes_required', 'ready_to_submit', 'completed') and new.status <> old.status then
      raise exception 'Only a reviewer or admin can set that status.';
    end if;
  end if;

  -- ==========================================================
  -- Activity logging — unconditional, unchanged from before this
  -- migration, applies to both scopes (Firm Work reassignment by a
  -- peer is logged here exactly like a Client Work reassignment is).
  -- ==========================================================
  if new.assignee_id <> old.assignee_id or new.reviewer_id is distinct from old.reviewer_id then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, auth.uid(), 'reassigned',
      trim(
        (case when new.assignee_id <> old.assignee_id then
          'Assignee: ' || coalesce((select full_name from public.profiles where id = old.assignee_id), '—')
          || ' → ' || coalesce((select full_name from public.profiles where id = new.assignee_id), '—') || '. '
        else '' end)
        ||
        (case when new.reviewer_id is distinct from old.reviewer_id then
          'Reviewer: ' || coalesce((select full_name from public.profiles where id = old.reviewer_id), '—')
          || ' → ' || coalesce((select full_name from public.profiles where id = new.reviewer_id), '—')
        else '' end)
      )
    );
  end if;

  if new.internal_due_date is distinct from old.internal_due_date or new.external_due_date is distinct from old.external_due_date then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, auth.uid(), 'due_date_changed',
      'Internal: ' || coalesce(old.internal_due_date::text, '—') || ' → ' || coalesce(new.internal_due_date::text, '—')
      || '. Filing: ' || coalesce(old.external_due_date::text, '—') || ' → ' || coalesce(new.external_due_date::text, '—')
    );
  end if;

  return new;
end;
$$;
-- (trigger `work_items_guard` already points at this function by name —
-- no need to re-create it.)
