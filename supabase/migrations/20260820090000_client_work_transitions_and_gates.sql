-- Maven Work Desk — Handbook Task 8: enforced Client Work transitions +
-- meaningful required-checklist gates
--
-- VERIFIED FIRST (read, not assumed): no valid-transition model exists
-- today at all — guard_work_item_update() only checks WHO may set a
-- status, never whether the FROM/TO pair makes sense. The Staff app's
-- status <select> (staff.js ~line 2436) offers every status the caller's
-- role can set, unfiltered by the item's current status — a reviewer
-- looking at a brand-new 'to_do' item already sees 'Completed' as a
-- selectable option today. work_checklist_items.is_required is, per its
-- own 2026-08-13 comment, "purely a display signal, nothing in this app
-- blocks a status transition on an unchecked required item." No
-- `requires_review` flag exists on service_templates (only
-- `requires_submission`) — added below, mirroring that exact pattern.
--
-- HISTORICAL RECORDS: this only gates the MOMENT a status changes (a
-- BEFORE UPDATE trigger) — an already-`completed` row sitting in the
-- table is never re-validated against these rules unless something
-- tries to change ITS status again, so no historical data is touched or
-- invalidated by this migration.
--
-- FIRM WORK: entirely unaffected — every check below is wrapped in
-- `new.work_scope = 'client'`. Firm Work keeps its existing 5-status
-- model (to_do/in_progress/blocked/review/completed), already validated
-- by work_items_status_scope_check, untouched here.

-- ---- 1. New configuration columns, mirroring the existing requires_
-- submission pattern exactly ----
alter table public.service_templates add column if not exists requires_review boolean not null default true;
alter table public.work_items add column if not exists review_required boolean not null default true;

-- Transient signal column: set (non-null, non-empty) in the SAME update
-- call as a status change to request an admin override of the normal
-- transition/checklist rules below. Always cleared back to NULL by the
-- trigger before the row is stored — it is never itself a durable
-- record; the durable, immutable record of an override lives in
-- work_activity (see the 'status_override' action below), matching this
-- task's "record immutable audit history" requirement.
alter table public.work_items add column if not exists status_override_reason text;

comment on column public.work_items.status_override_reason is
  'Write-only: provide a reason alongside a status change to request an admin override of the normal transition/checklist gates. Always reset to NULL after being read by guard_work_item_update() — never holds a stored value.';

-- ---- 2. Recurring generation: fix a pre-existing gap while extending
-- this same function for the new column — _generate_period_work_core's
-- INSERT never actually copied requires_submission from the template
-- onto generated work items at all (they silently got the column
-- default, false, regardless of the template's real setting). Since
-- review_required needs the same propagation and this is the one place
-- that creates work items outside the Staff app UI, both are fixed here
-- together rather than leaving submission_required's copy broken next
-- to a freshly-correct review_required.
create or replace function public._generate_period_work_core(p_period text, p_period_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  new_work_id uuid;
  created_count integer := 0;
  fallback_admin uuid;
  month_start date;
  month_end date;
  calc_internal_due date;
  calc_filing_due date;
begin
  if p_period is null or trim(p_period) = '' then
    return 0;
  end if;
  if p_period_type not in ('monthly', 'quarterly', 'yearly') then
    raise exception 'p_period_type must be monthly, quarterly, or yearly.';
  end if;

  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true limit 1;

  month_start := date_trunc('month', current_date)::date;
  month_end := (month_start + interval '1 month - 1 day')::date;

  for svc in
    select cs.*, st.title as template_title, st.filing_deadline_day, st.internal_offset_days,
           st.requires_submission, st.requires_review
    from public.client_services cs
    join public.service_templates st on st.id = cs.service_template_id
    where cs.is_active = true and st.is_active = true and st.recurrence = p_period_type
  loop
    new_work_id := null;
    calc_filing_due := case when svc.filing_deadline_day is not null
      then least(month_start + (svc.filing_deadline_day - 1), month_end)
      else null end;
    calc_internal_due := case when calc_filing_due is not null and svc.internal_offset_days is not null
      then calc_filing_due - svc.internal_offset_days
      else null end;

    insert into public.work_items (
      client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status,
      internal_due_date, external_due_date, created_by, submission_required, review_required
    )
    values (
      svc.client_id, svc.service_template_id, svc.template_title, p_period,
      coalesce(svc.assignee_id, fallback_admin),
      svc.reviewer_id, 'normal', 'to_do', calc_internal_due, calc_filing_due, fallback_admin,
      coalesce(svc.requires_submission, false), coalesce(svc.requires_review, true)
    )
    on conflict (client_id, service_template_id, period) do nothing
    returning id into new_work_id;

    if new_work_id is null then
      continue;
    end if;

    insert into public.work_checklist_items (work_item_id, stage, title, sort_order, is_required)
    select new_work_id, sti.stage, sti.title, sti.sort_order, sti.is_required
    from public.service_template_items sti
    where sti.template_id = svc.service_template_id;

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

-- ---- 3. guard_work_item_update(): add the transition map + checklist
-- gates + admin override, on top of everything Task 6/7 already added.
-- Every prior check is reproduced unchanged; only the new block (marked)
-- is added, positioned after the existing role-dispatch section so it
-- runs for whichever caller already passed the "are you even allowed to
-- set this status" checks Task 6 established — this task is about
-- WHETHER the transition itself makes sense, not who may attempt it.
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
        -- 'completed' -> anything (reopening) has no normal path at all;
        -- deliberately override-only, since reopening compliance work
        -- that was already marked done is itself an exceptional action.
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
-- (trigger `work_items_guard` already points at this function by name —
-- no need to re-create it.)
