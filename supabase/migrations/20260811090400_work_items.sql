-- Maven Work Desk — work_items (the core object)
--
-- A work item connects client → service template → period → assignee/
-- reviewer → deadlines → status workflow. Two due dates are tracked
-- deliberately: internal_due_date (when Maven expects the work finished)
-- and external_due_date (the actual statutory/client deadline) — the
-- internal one wins for urgency display since it's meant to land before
-- the real deadline (see effectiveDue() in staff.js).

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  service_template_id uuid references public.service_templates(id),
  title text not null,
  period text,
  assignee_id uuid not null references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  internal_due_date date,
  external_due_date date,
  status text not null default 'to_do' check (status in (
    'to_do', 'in_progress', 'waiting_for_client', 'ready_for_review',
    'changes_required', 'approved', 'ready_to_submit', 'completed'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  -- Legacy: superseded by the work_waiting_items checklist (see
  -- 20260811090500_work_item_children.sql). Kept because it's already a
  -- live column; the app no longer reads or writes it.
  waiting_reason text,
  waiting_since date,
  follow_up_date date,
  waiting_requested_by uuid references public.profiles(id),
  -- Set when status transitions to ready_for_review, cleared on any other
  -- transition — used by the Manager Dashboard to flag reviews sitting
  -- longer than 2 days. Deliberately separate from updated_at, which any
  -- field edit would bump and so can't answer "how long in review."
  ready_for_review_at timestamptz,
  description text,
  -- Reserved for a future submission-tracking UI; not yet surfaced by the
  -- frontend, but already part of the live schema.
  submission_reference text,
  completed_at timestamptz,
  submitted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_items_assignee_id_idx on public.work_items (assignee_id);
create index if not exists work_items_client_id_idx on public.work_items (client_id);
create index if not exists work_items_status_idx on public.work_items (status);
create index if not exists work_items_internal_due_date_idx on public.work_items (internal_due_date);

-- The real duplicate-prevention boundary for recurring/template-generated
-- work: the same client + service + period can exist at most once. This
-- is what _generate_period_work_core's `on conflict ... do nothing` relies
-- on for true idempotency (safe even if the manual button and the daily
-- cron sweep ever ran concurrently — a plain "check then insert" isn't).
-- NULLs never conflict with each other in a unique constraint, so ad-hoc
-- work (service_template_id null) and work with no period set are
-- correctly left unconstrained — this only applies to real recurring
-- service + period combinations.
--
-- IMPORTANT: unlike a CHECK constraint, a UNIQUE constraint can't be added
-- NOT VALID -- it must validate every existing row up front, so this will
-- fail outright if a duplicate already exists in the live table. Run this
-- first to check before applying:
--   select client_id, service_template_id, period, count(*)
--   from public.work_items
--   where service_template_id is not null and period is not null
--   group by client_id, service_template_id, period
--   having count(*) > 1;
-- If that returns any rows, resolve them (delete/merge) before adding
-- this constraint.
alter table public.work_items
  add constraint work_items_client_service_period_unique
  unique (client_id, service_template_id, period);

-- A work item can't be sitting in the review queue with nobody assigned
-- to review it — added NOT VALID since this table already has live data
-- and we can't guarantee no existing row already violates it; NOT VALID
-- still fully enforces the rule for every new insert/update starting
-- now, it just skips checking historical rows at creation time. Run
-- `select id, title from work_items where status = 'ready_for_review'
-- and reviewer_id is null;` first if you want to confirm there's nothing
-- to clean up, then optionally `alter table work_items validate
-- constraint work_items_review_needs_reviewer;` (purely cosmetic —
-- enforcement is identical either way).
alter table public.work_items
  add constraint work_items_review_needs_reviewer
  check (status <> 'ready_for_review' or reviewer_id is not null) not valid;

alter table public.work_items enable row level security;

-- Read access is scoped, not blanket-authenticated: everyone can see any
-- work item that ISN'T sitting in the review queue (unchanged from
-- before), can always see their own assigned work regardless of status,
-- and can see anything they're the designated reviewer for. The one thing
-- this withholds is *other people's* ready_for_review items where the
-- caller is neither assignee nor reviewer — e.g. Reviewer B cannot see
-- Reviewer A's pending review queue via All Work, Manager Dashboard, or
-- any other query, not just the Review page. Admins bypass all of this.
create policy "work_items_read" on public.work_items
  for select using (
    public.current_user_role() = 'admin'
    or assignee_id = auth.uid()
    or reviewer_id = auth.uid()
    or status <> 'ready_for_review'
  );
create policy "work_items_insert" on public.work_items
  for insert with check (auth.role() = 'authenticated');
create policy "work_items_update" on public.work_items
  for update using (auth.role() = 'authenticated');
create policy "work_items_delete" on public.work_items
  for delete using (public.current_user_role() = 'admin');

-- The real business rules live here, not in RLS: an employee may only
-- touch their own assigned work item, can't reassign or rescope it
-- (change assignee/reviewer/client/service), and can't self-set a
-- reviewer-gated status (approved/changes_required/ready_to_submit/
-- completed). Reviewers and admins bypass all of this.
create or replace function public.guard_work_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role text;
begin
  -- Applies to everyone, admins included: sending work to Ready for
  -- Review with no reviewer assigned is a data-integrity problem, not a
  -- role-escalation risk, so it isn't part of the admin/reviewer bypass
  -- below (see also the work_items_review_needs_reviewer check
  -- constraint above, which catches the same thing on INSERT too).
  if new.status = 'ready_for_review' and new.reviewer_id is null then
    raise exception 'Assign a reviewer before sending this work for review.';
  end if;

  role := public.current_user_role();
  if role in ('admin', 'reviewer') then
    return new;
  end if;
  if old.assignee_id <> auth.uid() then
    raise exception 'You can only update work assigned to you.';
  end if;
  if new.assignee_id <> old.assignee_id or new.reviewer_id is distinct from old.reviewer_id
     or new.client_id <> old.client_id or new.service_template_id is distinct from old.service_template_id then
    raise exception 'Only a reviewer or admin can reassign or rescope work.';
  end if;
  if new.status in ('approved', 'changes_required', 'ready_to_submit', 'completed') and new.status <> old.status then
    raise exception 'Only a reviewer or admin can set that status.';
  end if;
  return new;
end;
$$;

create trigger work_items_guard
  before update on public.work_items
  for each row execute function public.guard_work_item_update();
