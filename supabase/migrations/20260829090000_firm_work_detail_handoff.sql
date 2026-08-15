-- Maven Work Desk — Handbook Task 18: make Firm Work details useful for
-- asynchronous handoff.
--
-- VERIFIED FIRST: title/category/project/owner/status/priority/target
-- date/next_action/blocker_reason/description/checklist/updates/activity
-- already exist and are already stored (Task 15/16/17) -- the gap this
-- task closes is entirely about SURFACING them (a dedicated detail page,
-- built in staff.js, no schema needed for that part) plus three real,
-- narrow schema gaps:
--
-- 1. Reassignment/status/due-date changes are already logged into
-- work_activity unconditionally by guard_work_item_update() (Task 7), but
-- project_id changes are not -- this task's own "HISTORY" section
-- explicitly requires "Reassignment/status/project/target changes must
-- show old -> new." Added as one more unconditional logging block,
-- reproducing every existing line of the function byte-for-byte.
--
-- 2. work_comments has no way to tag an update's kind. This task asks for
-- an OPTIONAL type -- Progress/Result/Blocker/Handoff/Note -- and
-- explicitly NOT a Decision Needed/Owner Approval hierarchy (the owner
-- rejected that in an earlier task). Added as a single nullable column
-- with a check constraint, not a new table -- it's a tag on an existing
-- update, not a new kind of object.
--
-- 3. work_items.follow_up_date already exists but is constrained to
-- client-scope only (work_items_scope_fields_check's firm branch requires
-- it NULL) -- built for Client Work's "waiting for client" callback date.
-- This task asks for "an optional review/follow-up date... for Blocked
-- [Firm Work], framed as an operational target, not a statutory deadline"
-- -- the same shape of value, just for a different scope. Reused rather
-- than adding a fourth near-duplicate date column. waiting_since/
-- waiting_requested_by stay firm-null -- those are specifically "Client
-- Work is waiting on someone outside the firm" semantics that don't apply
-- to Firm Work's peer model.
--
-- This is a pure RELAXATION of one existing NULL requirement (nothing
-- that previously satisfied the constraint can ever violate the new one),
-- so no NOT VALID / follow-up validate step is needed here, unlike this
-- project's usual caution around brand-new restrictions on live data.

-- ---- 1. Optional update type on work_comments ----
alter table public.work_comments add column if not exists update_type text
  check (update_type is null or update_type in ('progress', 'result', 'blocker', 'handoff', 'note'));
comment on column public.work_comments.update_type is 'Optional tag for what kind of update this is (Handbook Task 18). Deliberately NOT a Decision Needed / Owner Approval hierarchy -- the owner rejected that shape in an earlier task.';

-- ---- 2. Allow follow_up_date on Firm Work rows too (full replacement,
-- reproducing every existing clause from 20260826090000 byte-for-byte
-- except removing "and follow_up_date is null" from the firm branch). ----
alter table public.work_items drop constraint if exists work_items_scope_fields_check;
alter table public.work_items add constraint work_items_scope_fields_check
  check (
    (work_scope = 'client' and client_id is not null
      and project_id is null and next_action is null and blocker_reason is null)
    or
    (work_scope = 'firm'
      and client_id is null
      and service_template_id is null
      and reviewer_id is null
      and period is null
      and external_due_date is null
      and waiting_since is null
      and waiting_requested_by is null
      and submission_required = false
      and submission_reference is null
      and submission_note is null
      and submission_status = 'not_ready'
      and period_type is null
      and period_start_date is null
      and period_end_date is null
    )
  );

-- ---- 3. guard_work_item_update(): add project_id-change logging to the
-- existing unconditional activity-logging section. Every other line
-- reproduced byte-for-byte from Task 17's version. ----
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
    -- Blocked — see 20260828090000's header for why old.status is
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

  -- Handbook Task 18: Firm Work's project/initiative grouping (Task 15)
  -- never got its changes logged -- this task's own "HISTORY" section
  -- explicitly names project changes alongside reassignment/status/target.
  if new.project_id is distinct from old.project_id then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'project_changed',
      coalesce((select name from public.projects where id = old.project_id), '—')
      || ' → ' || coalesce((select name from public.projects where id = new.project_id), '—')
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
