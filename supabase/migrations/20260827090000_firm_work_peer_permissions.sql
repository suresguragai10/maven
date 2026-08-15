-- Maven Work Desk — Handbook Task 16: enforce the approved all-active-
-- team peer model for Firm Work in the database, and stop the UI from
-- hiding edit controls based on ownership.
--
-- VERIFIED FIRST (read every relevant policy/trigger directly, not
-- assumed): guard_work_item_update() already implements most of the
-- peer model correctly, since Handbook Task 6
-- (20260818090000_work_item_update_authorization.sql) branched it on
-- work_scope='firm' before any Client-Work ownership check — an active
-- caller of ANY role can already update ANY field on ANY Firm Work item
-- at the trigger level, with only an is_active check. work_scope itself
-- is already universally immutable (line "work_scope cannot be changed
-- after creation" applies to every role, including admin, unconditionally
-- — checked first, before the role dispatch). Reassignment and status
-- changes are already logged to work_activity unconditionally, for both
-- scopes. None of that needed fixing here.
--
-- TWO REAL GAPS FOUND BY READING, closed below:
--
-- 1. work_checklist_items' INSERT/UPDATE policies (still exactly as
-- written in 20260815090000_v2_permission_audit.sql — a migration that
-- PREDATES Firm Work existing at all, 20260816090000) only ever allowed
-- admin, the item's CURRENT assignee, or its reviewer to add/toggle a
-- checklist item. Task 5 (20260817090000) added a work_scope='firm'
-- read-branch to the READ policy, but never touched WRITE — so today, a
-- teammate who is neither admin nor the current assignee of a Firm Work
-- item cannot add or check off a checklist item on it, directly
-- contradicting this task's "manage its checklist" peer requirement.
-- Fixed by adding the same work_scope='firm' branch WRITE already has on
-- READ.
--
-- 2. Nothing prevented assigning Firm Work to a DEACTIVATED profile —
-- the UI's owner picker only ever listed active profiles, but that's a
-- convention, not a boundary (this project's own standing principle:
-- "a hidden/filtered dropdown is never authorization"). A CHECK
-- constraint can't reference another table, so this needs a trigger:
-- added to set_work_item_created_by() (fires on every INSERT, so it
-- covers creation) and to guard_work_item_update()'s existing firm
-- branch (fires on every UPDATE, checked only when assignee_id is
-- actually changing — an already-assigned person who is deactivated
-- LATER does not retroactively lock the item from all further edits,
-- only NEW assignment attempts targeting an inactive profile are
-- rejected).
--
-- NOT changed, because already correct (re-verified with new direct
-- tests in this task's matrix, not re-implemented): work_scope
-- immutability, inactive-caller denial, reassignment/status-change
-- activity logging, work_activity's immutability (no update/delete
-- policy at all, unchanged).

-- ---- 1. work_checklist_items: open INSERT/UPDATE to any active
-- teammate for Firm Work, exactly matching the read policy's existing
-- work_scope='firm' branch. Client Work's checklist permissions
-- (admin/assignee/reviewer only) are completely unchanged. ----
drop policy if exists "work_checklist_items_write" on public.work_checklist_items;
create policy "work_checklist_items_write" on public.work_checklist_items
  for insert with check (
    public.current_user_active() and (
      exists (select 1 from public.work_items w where w.id = work_item_id and w.work_scope = 'firm')
      or public.current_user_role() in ('admin', 'reviewer')
      or exists (select 1 from public.work_items w where w.id = work_item_id and w.assignee_id = auth.uid())
    )
  );

drop policy if exists "work_checklist_items_update" on public.work_checklist_items;
create policy "work_checklist_items_update" on public.work_checklist_items
  for update using (
    public.current_user_active() and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          w.work_scope = 'firm'
          or public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

-- ---- 2. Assignment target must be an active teammate — creation time ----
create or replace function public.set_work_item_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  if new.work_scope = 'firm' and not exists (
    select 1 from public.profiles where id = new.assignee_id and is_active = true
  ) then
    raise exception 'Firm Work can only be assigned to an active teammate.';
  end if;
  return new;
end;
$$;

-- ---- 3. guard_work_item_update(): same active-assignee check on
-- reassignment, added inside the existing firm-scope branch. Every
-- other line in this function is reproduced byte-for-byte from Task 8's
-- version — the only new lines are the four just after the existing
-- "Your account is inactive" check. ----
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
