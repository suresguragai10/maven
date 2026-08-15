-- Maven Work Desk — Handbook Task 11: normalize periods so the requested
-- work period, not the day generation happens to run, drives the
-- generated work.
--
-- PROBLEM (verified by reading _generate_period_work_core directly, not
-- assumed): due-date computation has always derived its "which month is
-- this filing due in" starting point from `current_date` —
--   month_start := date_trunc('month', current_date)::date;
-- — completely independent of `p_period`, the period label the caller
-- actually requested. Generating "Shrawan 2083" (a backfill for a past
-- period) or a future period ahead of schedule silently computed
-- internal_due_date/external_due_date from TODAY's Gregorian month
-- instead of the period being represented. The period label itself
-- (work_items.period, a free-typed string like "Shrawan 2083") was never
-- wrong — only the derived DATES were, and only for anything generated
-- on a day that isn't itself inside the requested period's own month.
--
-- FIX: p_period_start/p_period_end (Gregorian, explicit, required) are
-- new parameters on both functions. The caller — a human, in the
-- "Generate Period Work" modal or the Auto-Generate Periods settings —
-- now states the actual Gregorian date range the requested period
-- covers, and month_start/month_end for the filing_deadline_day/
-- internal_offset_days calculation derive from p_period_end, never from
-- current_date. This is deliberately NOT a Bikram Sambat→Gregorian
-- conversion formula (this app has no owner-approved BS calendar table,
-- and guessing one for legally significant filing dates is exactly the
-- risk this task exists to close) — it's an explicit period record: the
-- one piece of real-world calendar knowledge (which Gregorian dates a
-- given Nepali period label covers) comes from a person who knows it,
-- typed in once per period, same operational rhythm as the existing
-- "update the period label when it rolls over" pattern.
--
-- NEW STRUCTURED COLUMNS on work_items (period_type, period_start_date,
-- period_end_date) are nullable and ADDITIVE ONLY — no existing row is
-- rewritten. Every work item generated before this migration keeps its
-- free-text `period` label as its only period information; its new
-- period_type/period_start_date/period_end_date are NULL, not backfilled
-- with a guess. Backfilling period_type from the row's CURRENT
-- service_templates.recurrence was considered and rejected: a template's
-- recurrence can be edited after historical work was generated from it,
-- so that join reflects the template's recurrence TODAY, not necessarily
-- what it was at generation time — exactly the kind of silent guess this
-- task's "report ambiguity, don't rewrite history" rule warns against.
-- Historical rows are therefore genuinely ambiguous on these three new
-- columns, by design, and documented as such (see docs/
-- DATABASE_SOURCE_OF_TRUTH.md) rather than quietly resolved either way.
--
-- One-time (ad-hoc, recurrence='none') Client Work is entirely unaffected
-- — it was never part of _generate_period_work_core's query (still
-- filtered by st.recurrence = p_period_type, which never matches 'none')
-- and is still created directly via the New Work modal with a free-typed
-- optional `period` label, no structured date range required. That
-- modal is deliberately NOT touched by this migration or by staff.js's
-- companion change — only the recurring-generation path changes.
--
-- Idempotent uniqueness is untouched: work_items_client_service_period_
-- unique still keys on (client_id, service_template_id, period) — the
-- free-text label — exactly as before, so "duplicate generation" behaves
-- identically to today.

-- ---- 1. New structured columns (additive, nullable, no data rewrite) ----
alter table public.work_items
  add column if not exists period_type text check (period_type in ('monthly', 'quarterly', 'yearly'));
alter table public.work_items
  add column if not exists period_start_date date;
alter table public.work_items
  add column if not exists period_end_date date;

comment on column public.work_items.period_type is
  'Structured recurrence type for this work item''s period, set only by recurring generation as of Handbook Task 11. NULL for one-time work and for every row generated before this migration — that NULL is intentional, not missing data (see docs/DATABASE_SOURCE_OF_TRUTH.md).';
comment on column public.work_items.period_start_date is
  'Gregorian start of the requested period this work item represents, as explicitly provided at generation time (never computed from a Bikram Sambat conversion formula). NULL for one-time work and pre-Task-11 rows.';
comment on column public.work_items.period_end_date is
  'Gregorian end of the requested period this work item represents. Drives filing_deadline_day/internal_offset_days calculation at generation time — see _generate_period_work_core. NULL for one-time work and pre-Task-11 rows.';

alter table public.work_items
  add constraint work_items_period_range_check
  check (
    (period_start_date is null) = (period_end_date is null)
    and (period_start_date is null or period_end_date >= period_start_date)
  );

-- ---- 2. Recurring generation: requested period drives everything,
-- current_date drives nothing. Full current body (Task 8's requires_
-- submission/review_required propagation) reproduced, extended with the
-- new required p_period_start/p_period_end parameters and their
-- validation, and the current_date-based month_start/month_end replaced.
drop function if exists public._generate_period_work_core(text, text);
drop function if exists public.generate_period_work_for_period(text, text);

create or replace function public._generate_period_work_core(
  p_period text, p_period_type text, p_period_start date, p_period_end date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  new_work_id uuid;
  created_count integer := 0;
  fallback_admin uuid;
  month_start date;
  month_end date;
  calc_internal_due date;
  calc_filing_due date;
begin
  if p_period is null or trim(p_period) = '' then
    return 0;
  end if;
  if p_period_type not in ('monthly', 'quarterly', 'yearly') then
    raise exception 'p_period_type must be monthly, quarterly, or yearly.';
  end if;
  -- The requested period's own Gregorian range, not current_date, is
  -- what makes this call unambiguous — reject anything that can't
  -- determine that range rather than silently falling back to "today."
  if p_period_start is null or p_period_end is null then
    raise exception 'p_period_start and p_period_end are required: the requested period''s Gregorian date range must be provided explicitly, never assumed from today''s date.';
  end if;
  if p_period_end < p_period_start then
    raise exception 'p_period_end cannot be before p_period_start.';
  end if;

  -- Client services aren't required to have their own assignee set; fall
  -- back to any active admin so work_items.assignee_id (not null) is
  -- always satisfiable.
  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true limit 1;

  -- Was date_trunc('month', current_date) before Handbook Task 11 — the
  -- exact bug this task exists to fix. filing_deadline_day/internal_
  -- offset_days now land on the requested period's OWN ending month,
  -- never on whatever month generation happens to run in.
  month_start := date_trunc('month', p_period_end)::date;
  month_end := (month_start + interval '1 month - 1 day')::date;

  for svc in
    select cs.*, st.title as template_title, st.filing_deadline_day, st.internal_offset_days,
           st.requires_submission, st.requires_review
    from public.client_services cs
    join public.service_templates st on st.id = cs.service_template_id
    where cs.is_active = true and st.is_active = true and st.recurrence = p_period_type
  loop
    new_work_id := null;
    calc_filing_due := case when svc.filing_deadline_day is not null
      then least(month_start + (svc.filing_deadline_day - 1), month_end)
      else null end;
    calc_internal_due := case when calc_filing_due is not null and svc.internal_offset_days is not null
      then calc_filing_due - svc.internal_offset_days
      else null end;

    insert into public.work_items (
      client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status,
      internal_due_date, external_due_date, created_by, submission_required, review_required,
      period_type, period_start_date, period_end_date
    )
    values (
      svc.client_id, svc.service_template_id, svc.template_title, p_period,
      coalesce(svc.assignee_id, fallback_admin),
      svc.reviewer_id, 'normal', 'to_do', calc_internal_due, calc_filing_due, fallback_admin,
      coalesce(svc.requires_submission, false), coalesce(svc.requires_review, true),
      p_period_type, p_period_start, p_period_end
    )
    on conflict (client_id, service_template_id, period) do nothing
    returning id into new_work_id;

    if new_work_id is null then
      continue; -- already exists for this client + service + period
    end if;

    insert into public.work_checklist_items (work_item_id, stage, title, sort_order, is_required)
    select new_work_id, sti.stage, sti.title, sti.sort_order, sti.is_required
    from public.service_template_items sti
    where sti.template_id = svc.service_template_id;

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

-- Client-facing wrapper — same admin/reviewer check as before (Task 9's
-- NULL-safe coalesce), now just passing the two new required params
-- through to core.
create or replace function public.generate_period_work_for_period(
  p_period text, p_period_type text, p_period_start date, p_period_end date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return public._generate_period_work_core(p_period, p_period_type, p_period_start, p_period_end);
end;
$$;

-- Dropping and recreating with a new signature does not carry over the
-- previous grants — reapply the same anon-revoked/authenticated-granted
-- shape Task 9 established, so this doesn't regress back to whatever
-- Postgres' default grant behavior would otherwise leave it at.
revoke execute on function public._generate_period_work_core(text, text, date, date) from public, anon, authenticated;
revoke execute on function public.generate_period_work_for_period(text, text, date, date) from public, anon;
grant execute on function public.generate_period_work_for_period(text, text, date, date) to authenticated;
