-- Maven Work Desk — client_services
--
-- A persistent record of "this client subscribes to VAT + Bookkeeping,
-- assigned to X, reviewed by Y" — shown as the Client Page's Active
-- Services list. "Create This Period's Work" (New Work modal, prefilled)
-- is a manual, one-click bridge from a service to an actual work item;
-- the daily generation sweep (see 20260811091000_recurring_work_generation
-- .sql) is what makes this truly recurring.

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_template_id uuid not null references public.service_templates(id),
  assignee_id uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  is_active boolean not null default true,
  notes text,
  -- Record-keeping only, added 2026-08-13 (Client Service Setup task) --
  -- NOT compared against the period being generated. Nepali period
  -- labels ("Shrawan 2083", "Q1 2083/84") don't sort or compare
  -- chronologically as plain strings, and this app has no verified BS-
  -- calendar table to convert them into something that does -- the same
  -- reason due dates are never computed from a period label anywhere
  -- else in this schema. `is_active` remains the actual, DB-enforced
  -- switch that stops a service from generating new work; start_period/
  -- end_period just document when that happened for a human reading the
  -- Active Services list, e.g. "Since Shrawan 2083" / "Until Ashad 2084".
  start_period text,
  end_period text,
  created_at timestamptz not null default now()
);

create index if not exists client_services_client_id_idx
  on public.client_services (client_id);
-- Speeds up the "which active services need this period generated" scan
-- both generation paths run.
create index if not exists client_services_active_idx
  on public.client_services (is_active) where is_active = true;

-- Prevents the same client from having the same service active twice at
-- once (e.g. two live "VAT Return" subscriptions both feeding
-- generation and silently doubling up work every period). Deliberately
-- a partial index, not a plain unique constraint: a client can still
-- have a DEACTIVATED "VAT Return" service (old engagement, historical
-- record) alongside a fresh ACTIVE one (restarted engagement) -- only
-- two simultaneously-active rows for the same client+service are
-- blocked. Run this first to check for existing duplicates before
-- applying, since a unique index (like a unique constraint) can't skip
-- validating existing rows:
--   select client_id, service_template_id, count(*)
--   from public.client_services
--   where is_active = true
--   group by client_id, service_template_id
--   having count(*) > 1;
-- Resolve any results (deactivate one of the pair) before running this.
create unique index if not exists client_services_active_unique
  on public.client_services (client_id, service_template_id)
  where is_active;

alter table public.client_services enable row level security;

create policy "client_services_read" on public.client_services
  for select using (auth.role() = 'authenticated');
-- Tightened from admin/reviewer to admin-only (Client Compliance Overview
-- task, 2026-08-12, explicit instruction: "Only authorized admin users
-- may change client services"). The earlier role audit flagged this same
-- broader reviewer access as extending past "reviewers review work
-- assigned to them" but left it alone since narrowing it hadn't been
-- asked for yet -- see [[maven_implementation_checklist_2026-08-10]].
-- Reviewers keep read access and keep every other privilege they had
-- (credentials, work review, etc.) -- only client_services write moves
-- to admin-only.
-- Named "_write" not "_insert" to match the live policy name (this table
-- predates SQL being tracked in this repo -- same caveat as profiles/
-- clients/work_checklist_items).
create policy "client_services_write" on public.client_services
  for insert with check (public.current_user_role() = 'admin');
create policy "client_services_update" on public.client_services
  for update using (public.current_user_role() = 'admin');
create policy "client_services_delete" on public.client_services
  for delete using (public.current_user_role() = 'admin');
