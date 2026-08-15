-- Maven Work Desk — Handbook Task 7: trustworthy work_activity audit trail
--
-- PROBLEM (confirmed by reading every staff.js call site, not assumed):
-- logActivity() (staff.js ~line 185) is a fire-and-forget INSERT --
-- `sb.from('work_activity').insert(...)`, never awaited, no error
-- handling -- called AFTER a separate work_items.update() has already
-- succeeded. If that second call fails for any reason (closed tab,
-- network blip, ad-blocker, a JS exception earlier in the same handler),
-- the work item's state change is real but no history record exists.
-- Worse: logActivity() also sends `actor_id: state.user.id` as plain
-- client data -- combined with work_activity_insert's existing WITH
-- CHECK (which never verified actor_id = auth.uid()), this is the exact
-- actor-spoofing gap Task 3 already found and flagged as unfixed.
--
-- FIX: every MATERIAL work_items state transition this task names
-- (status change -- covering sent-for-review/changes-requested/approved/
-- completion, since those are just specific status values; due-date
-- change; submission/ready-to-submit; assignment/reassignment, already
-- covered since Task 6; work creation, already covered by
-- log_work_item_created()) is now logged INSIDE guard_work_item_update()
-- itself -- the trigger fires on every UPDATE regardless of who or what
-- issued it (the Staff app, a future integration, a direct API call),
-- so the audit trail exists because the transition happened at the
-- database, not because the browser remembered to log it. actor_id is
-- always auth.uid() (from the verified JWT), never client-supplied.
--
-- DISTINGUISHING system vs. client activity: a new `source` column
-- ('system' | 'client', default 'system') plus a rewritten
-- work_activity_insert policy. Direct client inserts are now allowed
-- ONLY for the three lower-stakes, non-material actions this app
-- actually still needs from the client (checklist item toggled, waiting
-- item toggled, follow-up recorded -- none of which are in this task's
-- named "system events" list, and none of which have a natural trigger
-- to hang off since they're on work_checklist_items/work_waiting_items,
-- not work_items) -- and only with source='client' and actor_id =
-- auth.uid() enforced by the policy itself, not trusted from the
-- client. A forged 'status_changed'/'reassigned'/etc. row, or any row
-- with a spoofed actor_id, is now rejected outright by RLS.
--
-- DUPLICATE AVOIDANCE: staff.js's own status-change and submission
-- handlers called logActivity() with action='status_changed' /
-- 'submission_status_changed' immediately after their update() calls --
-- now redundant (and no longer permitted by the tightened INSERT
-- policy, since those two action values aren't in the client allowlist
-- below). Two 'waiting_resolved' call sites are ALSO redundant: leaving
-- waiting_for_client status is itself a status change, already covered
-- generically. All four call sites are removed from staff.js in this
-- same task (see the accompanying staff.js diff) -- left in place they
-- would simply fail with a permission error now, not silently duplicate.
--
-- FIRM WORK: guard_work_item_update()'s status/due-date/reassignment
-- logging already runs unconditionally for both scopes (unchanged from
-- Task 6) -- Firm Work gets identical, trustworthy history for who
-- changed owner/status/target and when. "Project" isn't built yet, so
-- there's nothing to log for it. This is per-item history only, exactly
-- like Client Work's -- no aggregate/cross-item view is added here, so
-- this does not become a staff surveillance metric (matches the
-- existing Reports page's own explicit "not a performance leaderboard"
-- principle).

-- ---- 1. New column, with an honest backfill for existing rows ----
alter table public.work_activity add column if not exists source text not null default 'system'
  check (source in ('system', 'client'));

-- Rows that were only ever reachable via the (now-removed) permissive
-- client insert path really were client-sourced, historically --
-- correcting the default's blanket 'system' backfill for exactly those.
update public.work_activity
  set source = 'client'
  where action in ('checklist_toggled', 'waiting_item_toggled', 'follow_up_recorded',
                    'waiting_resolved', 'status_changed', 'submission_status_changed');

-- ---- 2. Small reusable label helper, client.js's STATUS_LABELS mirrored
-- in SQL so audit detail text reads naturally ("In Progress" not
-- "in_progress") wherever this migration builds a transition description.
create or replace function public.work_item_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'to_do' then 'To Do'
    when 'in_progress' then 'In Progress'
    when 'waiting_for_client' then 'Waiting for Client'
    when 'ready_for_review' then 'Ready for Review'
    when 'changes_required' then 'Changes Required'
    when 'approved' then 'Approved'
    when 'ready_to_submit' then 'Ready to Submit'
    when 'completed' then 'Completed'
    when 'blocked' then 'Blocked'
    when 'review' then 'Review'
    else coalesce(p_status, '—')
  end;
$$;

-- ---- 3. created_by is now forced from the authenticated caller at
-- creation time too, not just immutable after (Task 6) -- closes the
-- same class of gap for the very first activity entry
-- (log_work_item_created() reads new.created_by to say who created it).
create or replace function public.set_work_item_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists work_items_set_created_by on public.work_items;
create trigger work_items_set_created_by
  before insert on public.work_items
  for each row execute function public.set_work_item_created_by();

-- ---- 4. guard_work_item_update(): add trustworthy system-event logging
-- for status/submission transitions, and force submitted_by from the
-- authenticated caller rather than trusting client-sent data. Every
-- other check below is reproduced byte-for-byte from Task 6's version --
-- only the new logging blocks (marked) and the submitted_by line are
-- added.
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

  -- NEW (Task 7): the actor behind a submission is whoever is actually
  -- making this request right now, not whatever the client happened to
  -- send — mirrors auth.uid() already being used directly for every
  -- activity log entry's actor_id below, applied to this stored column
  -- too.
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
  -- Activity logging — unconditional, applies to both scopes, and to
  -- every write path (UI, direct API, anything else), since this is a
  -- BEFORE UPDATE trigger on the table itself.
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

  -- NEW (Task 7): status change — covers sent-for-review/changes-
  -- required/approved/completion/blocked/etc. generically, since those
  -- are all just specific status values, not separate mechanisms.
  if new.status is distinct from old.status then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'status_changed',
      public.work_item_status_label(old.status) || ' → ' || public.work_item_status_label(new.status)
    );
  end if;

  -- NEW (Task 7): submission tracking, client scope only (submission_
  -- status is forced to 'not_ready' for firm-scope rows by the existing
  -- scope_fields_check constraint, so this is naturally a no-op there).
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

-- ---- 5. work_activity INSERT policy — actor cannot be spoofed, and a
-- client can only insert the three specific, non-material action types
-- this app still needs from the client. Everything else (created,
-- reassigned, due_date_changed, status_changed, submission_status_
-- changed) can now ONLY be inserted by the SECURITY DEFINER trigger
-- functions above, which bypass RLS as table-owner actions — a direct
-- client attempt to insert any of those action values, or to set
-- source='system', or to set actor_id to anyone but themselves, is
-- rejected by this WITH CHECK.
drop policy if exists "work_activity_insert" on public.work_activity;
create policy "work_activity_insert" on public.work_activity
  for insert
  to authenticated
  with check (
    public.current_user_active()
    and source = 'client'
    and actor_id = auth.uid()
    and action = any (array['checklist_toggled', 'waiting_item_toggled', 'follow_up_recorded'])
    and exists (
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
