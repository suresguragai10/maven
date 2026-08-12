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
  created_at timestamptz not null default now()
);

create index if not exists client_services_client_id_idx
  on public.client_services (client_id);
-- Speeds up the "which active services need this period generated" scan
-- both generation paths run.
create index if not exists client_services_active_idx
  on public.client_services (is_active) where is_active = true;

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
create policy "client_services_insert" on public.client_services
  for insert with check (public.current_user_role() = 'admin');
create policy "client_services_update" on public.client_services
  for update using (public.current_user_role() = 'admin');
create policy "client_services_delete" on public.client_services
  for delete using (public.current_user_role() = 'admin');
