-- Maven Work Desk — Firm Work: Data Model (Firm Work Task 1)
--
-- Firm Work is a second SCOPE inside the existing work_items table, not a
-- separate task system: work_scope discriminates 'client' (everything
-- that exists today, completely unchanged) from 'firm' (new — internal
-- team work with no client, no compliance template, no reviewer, no
-- filing/submission machinery). This is deliberately additive: every
-- existing row defaults to work_scope='client', client_id stays required
-- for that scope, and every existing RLS/trigger branch that already
-- governed Client Work is left untouched — only new work_scope='firm'
-- branches are added alongside them.
--
-- Design choice worth flagging: Firm Work's "Review" status is a NEW
-- value ('review'), not a reuse of the existing 'ready_for_review' —
-- deliberately, so it never touches the reviewer-required trigger check
-- or the work_items_review_needs_reviewer constraint, both of which are
-- specifically about the compliance review workflow this task says Firm
-- Work must not require. Reusing the same string would have meant
-- special-casing both of those for work_scope, which is exactly the kind
-- of "reinterpreting existing Client Work" the task says not to do — a
-- distinct value sidesteps that entirely, at the cost of one extra enum
-- value.

-- ---- 1. New columns ----
alter table public.work_items add column if not exists work_scope text not null default 'client'
  check (work_scope in ('client', 'firm'));
alter table public.work_items add column if not exists firm_category text
  check (firm_category is null or firm_category in (
    'Business Development', 'Marketing', 'Website / Digital', 'Administration', 'Firm Setup', 'Research', 'Other'
  ));

-- ---- 2. client_id becomes optional — Firm Work has no client ----
alter table public.work_items alter column client_id drop not null;

-- ---- 3. Replace the status CHECK to add Firm Work's two new states ----
-- Looked up and dropped by querying pg_constraint directly rather than
-- assuming the auto-generated name (work_items_status_check) — this
-- table's own SQL is fully tracked in this repo, unlike some earlier
-- ones, but there's no reason to take the risk when the lookup is cheap.
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where t.relname = 'work_items' and c.contype = 'c' and a.attname = 'status'
  loop
    execute format('alter table public.work_items drop constraint %I', con.conname);
  end loop;
end $$;
alter table public.work_items add constraint work_items_status_check
  check (status in (
    'to_do', 'in_progress', 'waiting_for_client', 'ready_for_review',
    'changes_required', 'approved', 'ready_to_submit', 'completed',
    'blocked', 'review'
  ));

-- ---- 4. The actual "clean separation" — scope-conditional constraints ----
-- A client-scope row must keep behaving exactly as before (still needs a
-- client, still limited to the original 8 statuses). A firm-scope row
-- can never carry client_id, a compliance template, a reviewer, a tax
-- period, a filing due date, waiting-for-client fields, or anything
-- submission-related — and can only ever be in one of its own 5 states.
alter table public.work_items add constraint work_items_status_scope_check
  check (
    (work_scope = 'client' and status in (
      'to_do', 'in_progress', 'waiting_for_client', 'ready_for_review',
      'changes_required', 'approved', 'ready_to_submit', 'completed'
    ))
    or
    (work_scope = 'firm' and status in ('to_do', 'in_progress', 'blocked', 'review', 'completed'))
  );

alter table public.work_items add constraint work_items_scope_fields_check
  check (
    (work_scope = 'client' and client_id is not null)
    or
    (work_scope = 'firm'
      and client_id is null
      and service_template_id is null
      and reviewer_id is null
      and period is null
      and external_due_date is null
      and waiting_since is null
      and follow_up_date is null
      and waiting_requested_by is null
      and submission_required = false
      and submission_reference is null
      and submission_note is null
      and submission_status = 'not_ready'
    )
  );

-- ---- 5. Trigger: the reviewer/admin-only status gate is a Client Work
-- rule (it exists so nobody can self-approve their own compliance work)
-- — Firm Work has no reviewer concept at all, so this must not apply to
-- it, or "Completed" would be permanently unreachable for a plain team
-- member's own Firm Work (nobody could ever satisfy "reviewer" for it).
-- This is the ONLY line changed in this function; everything else,
-- including every other Client Work rule, is reproduced byte-for-byte.
create or replace function public.guard_work_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
begin
  if new.status = 'ready_for_review' and new.reviewer_id is null then
    raise exception 'Assign a reviewer before sending this work for review.';
  end if;

  role := public.current_user_role();
  if role = 'admin' then
    null;
  elsif role = 'reviewer' and (old.reviewer_id = auth.uid() or new.reviewer_id = auth.uid()) then
    null;
  else
    if old.assignee_id <> auth.uid() then
      raise exception 'You can only update work assigned to you.';
    end if;
    if new.assignee_id <> old.assignee_id or new.reviewer_id is distinct from old.reviewer_id
       or new.client_id is distinct from old.client_id or new.service_template_id is distinct from old.service_template_id then
      raise exception 'Only a reviewer or admin can reassign or rescope work.';
    end if;
    if new.work_scope = 'client' and new.status in ('approved', 'changes_required', 'ready_to_submit', 'completed') and new.status <> old.status then
      raise exception 'Only a reviewer or admin can set that status.';
    end if;
    if (new.submission_status is distinct from old.submission_status
        or new.submitted_at is distinct from old.submitted_at
        or new.submitted_by is distinct from old.submitted_by
        or new.submission_reference is distinct from old.submission_reference
        or new.submission_note is distinct from old.submission_note)
       and old.status not in ('ready_to_submit', 'completed') then
      raise exception 'Submission can only be recorded once the work is ready to submit.';
    end if;
  end if;

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

-- Note: new.client_id <> old.client_id was changed to IS DISTINCT FROM
-- above — the original used <>, which is NULL (falsy, no exception)
-- when both sides are NULL, so this was already effectively safe for a
-- firm-work row (NULL <> NULL never raises) purely by accident of SQL's
-- NULL semantics. IS DISTINCT FROM is the explicit, intended version of
-- that same behavior — a firm-work row's client_id never changing (NULL
-- to NULL) is correctly not flagged as a rescope attempt either way,
-- this just makes the intent readable instead of relying on a NULL
-- comparison quirk.

-- ---- 6. RLS — read/insert/update, updated to also cover Firm Work ----
-- work_items_delete (admin-only) is untouched; Firm Work deletion isn't
-- part of this task's scope, and admin-only is a safe default either way.
drop policy if exists "work_items_read" on public.work_items;
create policy "work_items_read" on public.work_items
  for select using (
    public.current_user_active() and (
      work_scope = 'firm'
      or public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
      or status <> 'ready_for_review'
    )
  );

drop policy if exists "work_items_insert" on public.work_items;
create policy "work_items_insert" on public.work_items
  for insert with check (
    public.current_user_active()
    and status = 'to_do'
    and (
      work_scope = 'firm'
      or public.current_user_role() in ('admin', 'reviewer')
      or assignee_id = auth.uid()
    )
  );

drop policy if exists "work_items_update" on public.work_items;
create policy "work_items_update" on public.work_items
  for update using (
    public.current_user_active() and (
      work_scope = 'firm'
      or public.current_user_role() = 'admin'
      or assignee_id = auth.uid()
      or reviewer_id = auth.uid()
      or status <> 'ready_for_review'
    )
  );
