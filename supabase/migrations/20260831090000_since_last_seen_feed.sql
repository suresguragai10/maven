-- Maven Work Desk — Handbook Task 22: a simple "Since you were last
-- here" asynchronous handoff feed, derived from existing Firm Work
-- activity/updates -- explicitly a catch-up feed, not chat, presence, or
-- push infrastructure.
--
-- VERIFIED FIRST: work_activity already exists, is DB-guaranteed/
-- unforgeable (Handbook Task 7), and already logs 'created' (Task 0-era),
-- 'reassigned'/'due_date_changed'/'status_changed' (Task 7/8), and
-- 'project_changed' (Task 18) -- most of this task's example list is
-- already captured. work_comments already carries an optional
-- update_type (Task 18), covering "progress update posted." Two real
-- gaps against this task's own example list: "next action updated" and
-- "blocker added/removed" were never logged. Closed here as two more
-- unconditional blocks in guard_work_item_update(), same convention as
-- Task 18's project_changed addition.
--
-- CLIENT WORK: deliberately NOT included in this feed. Client Work's
-- status/due-date/reassignment changes are already surfaced by the
-- existing Notifications system (due_today_summary/review_summary/
-- overdue_item/followup_item) -- duplicating them here would make this
-- "a second compliance notification system," which this task explicitly
-- warns against. The feed is scoped to Firm Work only at the query level
-- (staff.js filters to work_scope='firm' item ids before querying
-- work_activity/work_comments), not by a new RLS restriction -- the
-- existing work_activity_read/work_comments_read policies are already
-- correctly scoped per caller for whichever rows the query does ask for.
--
-- LAST-SEEN TIMESTAMP: profiles.since_last_seen_at is set ONLY via the
-- mark_feed_seen() RPC below, itself only ever called when a user
-- explicitly clicks "Mark Reviewed" -- never auto-updated on login or
-- page view. This is a deliberate design choice, not an oversight: an
-- auto-updated-on-every-visit timestamp would start to look like session/
-- presence tracking, which this task explicitly forbids. A dedicated RPC
-- (SECURITY DEFINER) is used instead of a new self-UPDATE RLS policy on
-- profiles, so the existing admin-only profiles_update_admin policy
-- (role/is_active/full_name) is untouched -- this grants exactly one
-- narrow capability (set your own since_last_seen_at to now()), nothing
-- broader.

-- ---- 1. Per-user last-seen timestamp for this feed only ----
alter table public.profiles add column if not exists since_last_seen_at timestamptz;
comment on column public.profiles.since_last_seen_at is 'Set ONLY via mark_feed_seen() when a user explicitly marks the Since Last Seen feed reviewed (Handbook Task 22). Never auto-updated on login/page view -- not a presence/session-tracking timestamp.';

create or replace function public.mark_feed_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_active() then
    raise exception 'Your account is inactive.';
  end if;
  update public.profiles set since_last_seen_at = now() where id = auth.uid();
end;
$$;
grant execute on function public.mark_feed_seen() to authenticated;
-- Must revoke from PUBLIC, not just anon -- Postgres grants EXECUTE on a
-- new function to PUBLIC by default, and REVOKE...FROM a specific role
-- has no effect while PUBLIC still holds the privilege (every other
-- privileged RPC in this schema follows this same "from public, anon"
-- pattern, e.g. add_deadline_rule() from Handbook Task 12).
revoke execute on function public.mark_feed_seen() from public, anon;

-- ---- 2. guard_work_item_update(): log next_action and blocker_reason
-- changes to work_activity. Every other line reproduced byte-for-byte
-- from Task 18's version. ----
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

  if new.project_id is distinct from old.project_id then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'project_changed',
      coalesce((select name from public.projects where id = old.project_id), '—')
      || ' → ' || coalesce((select name from public.projects where id = new.project_id), '—')
    );
  end if;

  -- Handbook Task 22: "next action updated" and "blocker added/removed"
  -- were on this task's own example list of Firm Work changes the feed
  -- should show, but neither was ever logged. Both are Firm-Work-only
  -- fields (work_items_scope_fields_check keeps them NULL for Client
  -- Work), so this never fires for a client-scope row.
  if new.next_action is distinct from old.next_action then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'next_action_changed',
      case when new.next_action is null then 'Next action cleared' else 'Next action: ' || new.next_action end
    );
  end if;

  if new.blocker_reason is distinct from old.blocker_reason then
    insert into public.work_activity (work_item_id, actor_id, action, detail) values (
      new.id, caller, 'blocker_changed',
      case when new.blocker_reason is null then 'Blocker cleared' else 'Blocker: ' || new.blocker_reason end
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
