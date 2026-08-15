-- Maven Work Desk — Handbook Task 13: enforce client-service effective
-- periods and fix creator-vs-assignee conflation in generation.
--
-- VERIFIED FIRST (read, not assumed): client_services.start_period/
-- end_period have existed since the Client Service Setup task, but per
-- that migration's own comment, they were explicitly "record-keeping
-- only, NOT compared against the period being generated" — Nepali
-- period labels don't sort/compare chronologically as plain strings, and
-- this app has no owner-approved BS-calendar table to convert them. So a
-- service configured "Since Shrawan 2083, Until Ashad 2084" would still
-- generate work for ANY period, before its start or after its end,
-- because nothing ever checked. is_active already correctly gated
-- generation (unchanged here); the period WINDOW never did.
--
-- FIX: adds start_date/end_date (Gregorian, explicit, optional) to
-- client_services, alongside the existing free-text start_period/
-- end_period labels (which stay exactly as before — still just the
-- human-readable record). This is the same "keep the label, add an
-- explicit Gregorian value a human provides" principle Task 11 used for
-- work periods and Task 12 used for deadline rules — never a BS→
-- Gregorian formula. Generation now skips a service whose configured
-- window doesn't overlap the requested period's own Gregorian range
-- (already explicit as of Task 11's p_period_start/p_period_end) — a
-- service left with no start_date/end_date behaves exactly as before
-- (unrestricted), so this is purely additive for anyone who sets them.
--
-- SEPARATELY, VERIFIED: _generate_period_work_core's `created_by` was
-- always `fallback_admin` — an arbitrary, non-deterministic ("limit 1",
-- no ordering) active admin selected ONLY because work_items.assignee_id
-- is NOT NULL and a service might have no assignee configured. That
-- fallback is legitimate for assignee_id (the work must go to someone);
-- reusing the SAME value for created_by is not — it records whichever
-- admin the query planner happened to pick as having "created" work they
-- may never have heard of, for every service missing an assignee. Fixed
-- to auth.uid(), the real caller — always non-null here, since
-- generate_period_work_for_period's own admin/reviewer check already
-- requires it to resolve a role. A service with NEITHER its own
-- assignee_id NOR any active admin to fall back to now safely SKIPS that
-- one service (no work item, no crash, no other service in the same
-- generation call affected) rather than hitting work_items.assignee_id's
-- NOT NULL constraint mid-loop and aborting the whole batch.
--
-- NOT changed: work_items_client_service_period_unique + ON CONFLICT DO
-- NOTHING (already DB-enforced, already correctly idempotent under
-- concurrent execution — verified by reading, re-confirmed by a real
-- concurrent test in this task's matrix, not re-implemented here).
-- Editing a service_template or client_services row was already
-- structurally incapable of rewriting existing work_items (generation
-- only ever INSERTs; verified no UPDATE path touches historical rows) —
-- also unchanged, just now covered by an explicit test.

alter table public.client_services add column if not exists start_date date;
alter table public.client_services add column if not exists end_date date;

comment on column public.client_services.start_date is
  'Explicit Gregorian start of this service''s effective window (Handbook Task 13) — generation skips this service for any requested period ending before this date. NULL means no lower bound (matches pre-Task-13 behavior). Never derived from start_period; a human provides it directly.';
comment on column public.client_services.end_date is
  'Explicit Gregorian end of this service''s effective window. Generation skips this service for any requested period starting after this date. NULL means still ongoing (matches pre-Task-13 behavior).';

alter table public.client_services
  add constraint client_services_date_range_check
  check (end_date is null or start_date is null or end_date >= start_date);

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

  -- The real caller, not a stand-in — generate_period_work_for_period's
  -- own admin/reviewer check already guarantees this resolves to a real
  -- active profile before this function is ever reached.
  caller := auth.uid();

  -- Deterministic (ordered by id — profiles has no created_at column to
  -- order by), used ONLY as an assignee fallback when a service has none
  -- configured — never as created_by. Falling back to NULL when no
  -- active admin exists at all is handled explicitly per-service below,
  -- not by letting a NOT NULL constraint violation abort the whole call.
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
      -- Handbook Task 13: the service's own effective window must
      -- overlap the requested period — a service that hasn't started
      -- yet, or has already ended, as of this period's range, is
      -- skipped. NULL on either bound means "no restriction on that
      -- side," matching every service that predates this column.
      and (cs.start_date is null or cs.start_date <= p_period_end)
      and (cs.end_date is null or cs.end_date >= p_period_start)
  loop
    new_work_id := null;

    -- Handbook Task 13: a service with no assignee_id AND no active
    -- admin to fall back to safely skips generation for THIS service
    -- only — every other eligible service in the same call is
    -- unaffected, and nothing crashes the batch on a NOT NULL violation.
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

    insert into public.work_items (
      client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status,
      internal_due_date, external_due_date, created_by, submission_required, review_required,
      period_type, period_start_date, period_end_date
    )
    values (
      svc.client_id, svc.service_template_id, svc.template_title, p_period,
      chosen_assignee,
      svc.reviewer_id, 'normal', 'to_do', calc_internal_due, calc_filing_due, caller,
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
-- Signature unchanged from Task 11/12 — CREATE OR REPLACE keeps the
-- existing anon-revoked/authenticated-granted shape, no drop/re-grant
-- needed.
