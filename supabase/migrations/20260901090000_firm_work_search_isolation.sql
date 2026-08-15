-- Maven Work Desk — Handbook Task 23: finish Firm Work search, permanent
-- history, and compliance isolation.
--
-- VERIFIED FIRST (a full read of every page/function that could plausibly
-- touch Client Work compliance metrics, not assumed): Today, Deadlines,
-- Manager Dashboard, Period Summary, and Reports all route through
-- loadWork()/their own query, which already filters .eq('work_scope',
-- 'client') explicitly. Client Detail's work list filters by client_id,
-- which work_items_scope_fields_check structurally guarantees is NULL on
-- every Firm Work row -- a Firm item can never match `client_id = <a
-- real client's id>`, so that isolation is enforced by the CHECK
-- constraint itself, not by a query author remembering to add a filter.
-- Firm Work's search/filters (title/description/category/project/owner/
-- next_action, status including Completed, owner/category/project/date-
-- range filters) already existed as of Task 17/19/20. Completed Firm
-- Work staying searchable, activity/updates staying available, and
-- archiving a project not erasing history were all already true and
-- already covered by this session's own tests (Task 17/18/19).
--
-- Two real gaps closed:
--
-- 1. Global Search (staff.js's Search page) previously excluded Firm
-- Work entirely. This task explicitly asks for the opposite: "If a
-- global Work Desk search exists, include Firm Work with a clear FIRM
-- label." Done in staff.js only (see the accompanying commit) -- no
-- schema change needed, since work_items_read RLS already scopes what a
-- Firm Work query can return correctly for any caller.
--
-- 2. _generate_period_work_core's INSERT never listed `work_scope` in
-- its column list -- it relied on the table's `default 'client'` to stay
-- correct. That default has always produced the right result (confirmed
-- by this task's own isolation test), but "prove it cannot pollute
-- Client Work reporting" is a stronger claim than "an implicit default
-- has never been wrong yet" -- if a future edit to this function ever
-- added an explicit work_scope value for some new branch, the column
-- default would stop being the only thing keeping recurring generation
-- Client-only, and nothing would flag that. Making it explicit here
-- costs nothing and removes that one implicit dependency. Every other
-- line reproduced byte-for-byte from Task 13's version -- this is a
-- clarity change, not a behavior change.
--
-- PERFORMANCE: no new indexes. work_items already has indexes on
-- assignee_id/client_id/status/internal_due_date/reviewer_id (Task 0-era
-- + Task 6), which are what every actual filter (owner, status, due
-- date) already uses. work_scope itself has exactly two values -- a
-- plain index on it would have terrible selectivity and, at this
-- org's data volume (a handful of staff, the "5-6 people, capable of
-- more" scale this app is built for), a sequential scan is almost
-- certainly cheaper than an index scan regardless. Free-text search
-- (ilike '%term%') can't use a plain btree index either way; a trigram
-- (pg_trgm/GIN) index would help at a much larger data volume than this
-- deployment has or is likely to reach soon. Not added speculatively --
-- add later if a real EXPLAIN ANALYZE on live data ever justifies it.

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
  caller uuid;
  chosen_assignee uuid;
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
  if p_period_start is null or p_period_end is null then
    raise exception 'p_period_start and p_period_end are required: the requested period''s Gregorian date range must be provided explicitly, never assumed from today''s date.';
  end if;
  if p_period_end < p_period_start then
    raise exception 'p_period_end cannot be before p_period_start.';
  end if;

  caller := auth.uid();

  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true order by id asc limit 1;

  month_start := date_trunc('month', p_period_end)::date;
  month_end := (month_start + interval '1 month - 1 day')::date;

  for svc in
    select cs.*, st.title as template_title, st.internal_offset_days,
           st.requires_submission, st.requires_review,
           dr.filing_deadline_day
    from public.client_services cs
    join public.service_templates st on st.id = cs.service_template_id
    left join public.deadline_rules dr on dr.service_template_id = st.id and dr.status = 'active'
    where cs.is_active = true and st.is_active = true and st.recurrence = p_period_type
      and (cs.start_date is null or cs.start_date <= p_period_end)
      and (cs.end_date is null or cs.end_date >= p_period_start)
  loop
    new_work_id := null;

    chosen_assignee := coalesce(svc.assignee_id, fallback_admin);
    if chosen_assignee is null then
      continue;
    end if;

    calc_filing_due := case when svc.filing_deadline_day is not null
      then least(month_start + (svc.filing_deadline_day - 1), month_end)
      else null end;
    calc_internal_due := case when calc_filing_due is not null and svc.internal_offset_days is not null
      then calc_filing_due - svc.internal_offset_days
      else null end;

    -- Handbook Task 23: work_scope now explicit ('client'), not left to
    -- the column default -- see this migration's header for why.
    insert into public.work_items (
      work_scope, client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status,
      internal_due_date, external_due_date, created_by, submission_required, review_required,
      period_type, period_start_date, period_end_date
    )
    values (
      'client', svc.client_id, svc.service_template_id, svc.template_title, p_period,
      chosen_assignee,
      svc.reviewer_id, 'normal', 'to_do', calc_internal_due, calc_filing_due, caller,
      coalesce(svc.requires_submission, false), coalesce(svc.requires_review, true),
      p_period_type, p_period_start, p_period_end
    )
    on conflict (client_id, service_template_id, period) do nothing
    returning id into new_work_id;

    if new_work_id is null then
      continue;
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
-- Signature unchanged from Task 11/12/13 — CREATE OR REPLACE keeps the
-- existing anon-revoked/authenticated-granted shape, no drop/re-grant needed.
