-- Maven Work Desk — Handbook Task 17: Firm Work create/edit/list
-- experience — the two VALIDATION rules that need real database
-- enforcement, not just a frontend convention.
--
-- VERIFIED FIRST: the create/edit form, list, and filters this task
-- asks for were already substantially built (Task 15/16) — title/
-- category/owner/project/target date/priority/status/description/
-- next_action/blocker_reason/checklist all already exist and are wired
-- into openFirmWorkModal; the list already shows title/category/
-- project/owner/status/due date/priority; filters already cover owner/
-- category/project/status/priority/due date and search already uses a
-- server-side ilike query, not a client-side download-then-filter. Two
-- concrete gaps remained, both closed here:
--
-- 1. Category was optional ("— No category —"). This task's own
-- CREATE/EDIT FORM section lists Category as Required, alongside Title
-- and Owner. Added as a NOT VALID check (category was already
-- constrained to a fixed list when set; this only adds "and must be
-- set" for Firm Work specifically -- Client Work is untouched).
--
-- 2. Nothing required blocker_reason when a Firm Work item's status
-- becomes Blocked. Added as a TRIGGER check (not a plain CHECK
-- constraint), and specifically only when status is TRANSITIONING into
-- 'blocked' (new.status = 'blocked' and old.status is distinct from
-- 'blocked') -- not whenever a row simply happens to already be
-- Blocked. A plain CHECK constraint can't see OLD, so it would also
-- re-validate every future unrelated edit (renaming, reprioritizing) on
-- any item that predates this rule and was already Blocked without
-- context -- silently locking historical records out of routine
-- editing, exactly the "do not corrupt existing records" mistake this
-- project's migrations consistently avoid. Scoped to the transition
-- moment only: marking something Blocked now requires saying why; an
-- already-Blocked historical item stays editable regardless. This is a
-- data-quality rule, not an approval flow — no second person's sign-off
-- is required, it's the same caller providing the context in the same
-- request.
--
-- Insert-time note: work_items_insert's own RLS policy already requires
-- status = 'to_do' for every new row of either scope, so a brand-new
-- Firm Work item can never be created already-Blocked — this rule is
-- reachable only via a later UPDATE, which is where it's enforced.

-- ---- 1. Category required for Firm Work ----
alter table public.work_items
  add constraint work_items_firm_category_required_check
  check (work_scope <> 'firm' or firm_category is not null) not valid;

-- ---- 2. guard_work_item_update(): add the Blocked-context check to the
-- existing firm branch. Every other line reproduced byte-for-byte from
-- Task 16's version. ----
create or replace function public.guard_work_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
  caller uuid;
  transition_ok boolean;
  blocking_reason text;
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

  if new.work_scope is distinct from old.work_scope then
    raise exception 'work_scope cannot be changed after creation.';
  end if;

  if new.status = 'ready_for_review' and new.reviewer_id is null then
    raise exception 'Assign a reviewer before sending this work for review.';
  end if;

  if new.work_scope = 'client'
     and (new.submission_status is distinct from old.submission_status
       or new.submitted_at is distinct from old.submitted_at
       or new.submitted_by is distinct from old.submitted_by
       or new.submission_reference is distinct from old.submission_reference
       or new.submission_note is distinct from old.submission_note)
     and old.status not in ('ready_to_submit', 'completed') then
    raise exception 'Submission can only be recorded once the work is ready to submit.';
  end if;

  if new.work_scope = 'client' and new.submission_status is distinct from old.submission_status
     and new.submission_status in ('submitted', 'acknowledged') and old.submitted_at is null then
    new.submitted_by := caller;
  end if;

  -- ==========================================================
  -- Role/scope-specific rules
  -- ==========================================================

  if role = 'admin' then
    null;

  elsif new.work_scope = 'firm' then
    if not public.current_user_active() then
      raise exception 'Your account is inactive.';
    end if;
    -- Handbook Task 16: only when assignee_id is actually changing —
    -- an already-assigned person who is later deactivated does not
    -- retroactively lock this item from all further edits.
    if new.assignee_id is distinct from old.assignee_id and not exists (
      select 1 from public.profiles where id = new.assignee_id and is_active = true
    ) then
      raise exception 'Firm Work can only be assigned to an active teammate.';
    end if;
    -- Handbook Task 17: only at the moment of TRANSITIONING into
    -- Blocked — see this migration's header for why old.status is
    -- checked, not just new.status.
    if new.status = 'blocked' and old.status is distinct from 'blocked'
       and (new.blocker_reason is null or length(trim(new.blocker_reason)) < 10) then
      raise exception 'Explain what''s blocking this (at least a short sentence) before marking it Blocked.';
    end if;

  elsif role = 'reviewer' and (old.reviewer_id = caller or new.reviewer_id = caller) then
    if new.assignee_id <> old.assignee_id
       or new.reviewer_id is distinct from old.reviewer_id
       or new.client_id is distinct from old.client_id
       or new.service_template_id is distinct from old.service_template_id then
      raise exception 'Only an admin can reassign or rescope work.';
    end if;

  else
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
  -- NEW (Task 8): Client Work transition map + required-checklist
  -- gates. Firm Work is entirely exempt (its own status set/rules are
  -- unaffected). Applies regardless of role, including admin — an
  -- override is available (see below) but is opt-in and reasoned, not a
  -- silent admin bypass.
  -- ==========================================================
  if new.work_scope = 'client' and new.status is distinct from old.status then
    blocking_reason := null;

    case old.status
      when 'to_do' then
        transition_ok := new.status in ('in_progress', 'waiting_for_client');
      when 'in_progress' then
        transition_ok := new.status = 'waiting_for_client'
          or new.status = 'ready_for_review'
          or (new.status = 'ready_to_submit' and not new.review_required and new.submission_required)
          or (new.status = 'completed' and not new.review_required and not new.submission_required);
      when 'waiting_for_client' then
        transition_ok := new.status = 'in_progress';
      when 'ready_for_review' then
        transition_ok := new.status in ('changes_required', 'approved', 'waiting_for_client');
      when 'changes_required' then
        transition_ok := new.status in ('in_progress', 'waiting_for_client');
      when 'approved' then
        transition_ok := (new.status = 'ready_to_submit' and new.submission_required)
          or (new.status = 'completed' and not new.submission_required)
          or new.status = 'waiting_for_client';
      when 'ready_to_submit' then
        transition_ok := new.status = 'completed' or new.status = 'waiting_for_client';
      else
        transition_ok := false;
    end case;

    if not transition_ok then
      blocking_reason := 'Invalid status change: ' || public.work_item_status_label(old.status)
        || ' → ' || public.work_item_status_label(new.status) || ' is not a normal transition.';
    elsif new.status = 'ready_for_review' and exists (
      select 1 from public.work_checklist_items
      where work_item_id = new.id and stage = 'preparation' and is_required and not is_done
    ) then
      blocking_reason := 'Complete all required preparation checklist items before sending for review.';
    elsif new.status = 'approved' and exists (
      select 1 from public.work_checklist_items
      where work_item_id = new.id and stage = 'review' and is_required and not is_done
    ) then
      blocking_reason := 'Complete all required review checklist items before approving.';
    elsif new.status = 'completed' and new.submission_required and (
      new.submission_status not in ('submitted', 'acknowledged')
      or exists (
        select 1 from public.work_checklist_items
        where work_item_id = new.id and stage = 'submission' and is_required and not is_done
      )
    ) then
      blocking_reason := 'Record the submission and complete all required submission checklist items before marking completed.';
    end if;

    if blocking_reason is not null then
      if role = 'admin' and new.status_override_reason is not null and length(trim(new.status_override_reason)) > 0 then
        insert into public.work_activity (work_item_id, actor_id, action, detail) values (
          new.id, caller, 'status_override',
          blocking_reason || ' OVERRIDDEN (' || public.work_item_status_label(old.status) || ' → '
          || public.work_item_status_label(new.status) || '). Reason: ' || trim(new.status_override_reason)
        );
      else
        raise exception '%', blocking_reason;
      end if;
    end if;
  end if;

  -- Transient override signal never persists, regardless of scope/path.
  new.status_override_reason := null;

  -- ==========================================================
  -- Activity logging — unconditional, applies to both scopes.
  -- ==========================================================
  if new.assignee_id <> old.assignee_id or new.reviewer_id is distinct from old.reviewer_id then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'reassigned',
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
      new.id, caller, 'due_date_changed',
      'Internal: ' || coalesce(old.internal_due_date::text, '—') || ' → ' || coalesce(new.internal_due_date::text, '—')
      || '. Filing: ' || coalesce(old.external_due_date::text, '—') || ' → ' || coalesce(new.external_due_date::text, '—')
    );
  end if;

  if new.status is distinct from old.status then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'status_changed',
      public.work_item_status_label(old.status) || ' → ' || public.work_item_status_label(new.status)
    );
  end if;

  if new.work_scope = 'client' and new.submission_status is distinct from old.submission_status then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'submission_status_changed',
      coalesce(old.submission_status, 'not_ready') || ' → ' || coalesce(new.submission_status, 'not_ready')
      || (case when new.submission_reference is not null then '. Reference: ' || new.submission_reference else '' end)
    );
  end if;

  return new;
end;
$$;
