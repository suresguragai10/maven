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
  -- Deadline rule, added 2026-08-12, revised same day to derive the
  -- internal date FROM the filing date instead of two independent
  -- generation-relative offsets (the original version): filing_deadline_
  -- day is a day-of-month (1-31) -- "the 25th of the month" -- applied to
  -- whatever month the work item is actually generated in (the English/
  -- Gregorian calendar is enough per the user; this app still has no BS-
  -- calendar table, so it still can't derive a date from a Nepali period
  -- LABEL like "Shrawan 2083", only from the real calendar date generation
  -- happens on). internal_offset_days is "days before the filing date" --
  -- e.g. filing_deadline_day=25, internal_offset_days=3 on a work item
  -- generated in August gives external_due_date=Aug 25, internal_due_date
  -- =Aug 22. Either or both may be left null: null filing_deadline_day
  -- means no external date gets computed (stays a manual fill-in);
  -- internal_offset_days is only meaningful once a filing date exists, so
  -- it's a no-op without one. A day-of-month past the end of a shorter
  -- month (e.g. 31 in a 30-day month) clamps to that month's last day —
  -- see the clamping logic in 20260811091000_recurring_work_generation.sql.
  filing_deadline_day int check (filing_deadline_day between 1 and 31),
  internal_offset_days int check (internal_offset_days >= 0),
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
