-- Maven Work Desk — service templates (the "engine" of the system)
--
-- A service template defines a repeatable unit of work (e.g. "VAT Return"),
-- its checklist (grouped into preparation/review/submission stages), and
-- whether work created from it needs a submission step (Ready to Submit)
-- before Completed. Categories are a fixed set enforced at the app layer
-- (staff.js TEMPLATE_CATEGORIES) rather than a DB check constraint, so a
-- future category can be added without a migration — templates with an
-- unrecognized category still render, grouped under "Other".

create table if not exists public.service_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly', 'quarterly', 'yearly')),
  requires_submission boolean not null default false,
  default_assignee_id uuid references public.profiles(id),
  default_reviewer_id uuid references public.profiles(id),
  -- Optional deadline rule, added 2026-08-12: days after the WORK ITEM'S
  -- OWN generation date (not the period's calendar start/end, which this
  -- app has no verified BS-conversion table to compute -- see the header
  -- note in 20260811091000_recurring_work_generation.sql). Null means no
  -- rule -- due dates land blank and stay a manual fill-in, same as
  -- before this column existed. When set, both bulk generation and the
  -- New Work modal's "apply template" prefill use it as a same-day
  -- offset from whenever the work item is actually created, which is a
  -- reasonable proxy for "days after period start" as long as generation
  -- happens promptly at the start of the new period (the expected usage
  -- pattern), but won't be exactly right if generation is run late.
  internal_deadline_days int,
  filing_deadline_days int,
  created_at timestamptz not null default now()
);

create table if not exists public.service_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.service_templates(id) on delete cascade,
  stage text not null default 'preparation' check (stage in ('preparation', 'review', 'submission')),
  title text not null,
  sort_order int not null default 0
);

create index if not exists service_template_items_template_id_idx
  on public.service_template_items (template_id);

alter table public.service_templates enable row level security;
alter table public.service_template_items enable row level security;

-- Everyone authenticated can read templates (needed to pick one in the New
-- Work modal); only admins define/manage them, matching the Templates
-- page's admin-only nav gate.
create policy "service_templates_read" on public.service_templates
  for select using (auth.role() = 'authenticated');
create policy "service_templates_insert_admin" on public.service_templates
  for insert with check (public.current_user_role() = 'admin');
create policy "service_templates_update_admin" on public.service_templates
  for update using (public.current_user_role() = 'admin');

create policy "service_template_items_read" on public.service_template_items
  for select using (auth.role() = 'authenticated');
create policy "service_template_items_insert_admin" on public.service_template_items
  for insert with check (public.current_user_role() = 'admin');
