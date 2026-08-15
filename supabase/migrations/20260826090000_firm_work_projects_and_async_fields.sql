-- Maven Work Desk — Handbook Task 15: evolve the Firm Work data model for
-- projects and asynchronous coordination.
--
-- VERIFIED FIRST (read, not assumed): of the approved model's "required"
-- fields, all four already exist and are already wired into the Firm
-- Work UI — title, firm_category, assignee_id (the "owner"), status.
-- Of the "optional where sensible" list, several ALSO already exist and
-- already work for Firm Work with no schema change needed: internal_
-- due_date (Firm Work's single "Due Date," never called "Internal
-- Target" in that UI — see staff.js's own comment on why), priority,
-- description, work_checklist_items/work_comments/work_activity (all
-- three already have a work_scope='firm' branch in their read policies,
-- added by 20260817090000 -- confirmed by reading, not assumed).
-- Genuinely missing: project/initiative grouping, next_action, and
-- blocker_reason. This migration adds exactly those three, plus the
-- lightweight projects table the first one needs.
--
-- BOUNDARY, enforced at the database level, not just by convention: the
-- new fields are added to work_items_scope_fields_check's FIRM branch
-- only where relevant, and explicitly forbidden on the CLIENT branch —
-- a Client Work row can never carry a project_id/next_action/
-- blocker_reason, symmetric with how a Firm Work row has never been able
-- to carry client_id/period/reviewer_id/etc. While touching this same
-- constraint, also closes a latent gap: period_type/period_start_date/
-- period_end_date (Handbook Task 11) were added to work_items without
-- ever being added to this constraint's client-only list — no live code
-- path sets them on a firm-scope row today (_generate_period_work_core
-- only ever inserts work_scope='client'), but the constraint itself
-- didn't actually prevent it. Closed here since this is exactly the
-- "Firm Work must not use or modify client compliance rules" boundary
-- this task is about, and this is the one place that boundary lives.
--
-- NO BACKFILL: every new column is nullable and genuinely new -- nothing
-- in the existing schema safely implies a value for project_id/
-- next_action/blocker_reason on any existing row, so none is guessed.
-- Historical Firm Work (including already-completed items) is untouched
-- by this migration beyond gaining three new, NULL-by-default columns.

-- ---- 1. Lightweight projects/initiatives table ----
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Same openness as Firm Work itself ("any active team member may create
-- Firm Work" -- Firm Work Task 2's own stated decision, unchanged since):
-- projects are a lightweight shared label, not a governed resource like
-- deadline_rules or client_credentials, so any active teammate may
-- create or rename one. No delete policy -- archiving (status=
-- 'archived') is the intended "retire a project" action, matching the
-- table's own active/archived design; deleting one out from under
-- historical Firm Work rows that still reference it is not offered.
create policy "projects_read" on public.projects
  for select using (public.current_user_active());
create policy "projects_insert" on public.projects
  for insert with check (public.current_user_active());
create policy "projects_update" on public.projects
  for update using (public.current_user_active());

-- ---- 2. New work_items columns (all nullable, additive) ----
alter table public.work_items add column if not exists project_id uuid references public.projects(id);
alter table public.work_items add column if not exists next_action text;
alter table public.work_items add column if not exists blocker_reason text;

comment on column public.work_items.project_id is 'Optional grouping under a projects/initiatives row (Handbook Task 15). Firm Work only -- see work_items_scope_fields_check.';
comment on column public.work_items.next_action is 'Optional short "what happens next" note for async coordination (Handbook Task 15). Firm Work only.';
comment on column public.work_items.blocker_reason is 'Optional context for why a Firm Work item is in the blocked status (Handbook Task 15). Firm Work only -- not required even when status=blocked, matching this task''s "optional where sensible" instruction.';

-- ---- 3. Scope-conditional constraint, extended (full replacement,
-- reproducing every existing clause byte-for-byte plus the new ones).
-- project_id/next_action/blocker_reason are brand-new columns with no
-- default, so every existing row (client or firm) already satisfies
-- "IS NULL" on them trivially -- zero risk there. period_type/period_
-- start_date/period_end_date being NULL for every existing firm-scope
-- row is also believed safe (no code path has ever written them for
-- work_scope='firm' -- _generate_period_work_core hardcodes 'client',
-- and no edit UI exposes these fields at all) -- but per this project's
-- standing caution about drift this environment can't directly inspect
-- (see docs/DATABASE_SOURCE_OF_TRUTH.md's live-drift sections), this is
-- added NOT VALID rather than assumed clean. It still fully applies to
-- every write from this point forward; only the retroactive check of
-- existing rows is deferred. Optional, run this once afterward to
-- confirm (and only then run `validate constraint`, separately, if it
-- returns nothing):
--   select id, work_scope, period_type, period_start_date, period_end_date
--   from public.work_items
--   where work_scope = 'firm'
--     and (period_type is not null or period_start_date is not null or period_end_date is not null);
alter table public.work_items drop constraint if exists work_items_scope_fields_check;
alter table public.work_items add constraint work_items_scope_fields_check
  check (
    (work_scope = 'client' and client_id is not null
      and project_id is null and next_action is null and blocker_reason is null)
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
      and period_type is null
      and period_start_date is null
      and period_end_date is null
    )
  ) not valid;
