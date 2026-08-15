-- Maven Work Desk — Handbook Task 12: deadline governance instead of
-- believable guesses.
--
-- PROBLEM (verified by reading, not assumed): service_templates.
-- filing_deadline_day has always been a bare integer an admin types into
-- the Edit Template modal, with zero record of WHERE that day-of-month
-- came from, whether anyone actually checked it against a real IRD
-- notice/Finance Act, or whether it's gone stale since the law last
-- changed. _generate_period_work_core then used it to compute a
-- confident-looking external_due_date every single period, forever, with
-- nothing distinguishing "verified against a primary source" from "an
-- admin's best guess typed in once." For an accounting firm this is
-- exactly backwards: a believable-but-wrong filing deadline is worse
-- than a blank field that visibly asks someone to verify it.
--
-- THIS MIGRATION DOES NOT SET, GUESS, OR UPDATE ANY NEPAL TAX DEADLINE.
-- No deadline_rules row is inserted here — every existing service's
-- filing_deadline_day (if it has one) simply stops being read by
-- generation, and its computed external_due_date goes back to unset
-- until an owner-approved rule is entered live, with a real source
-- citation, through add_deadline_rule() below. That is the intended,
-- immediate effect of this migration, not a bug: continuing to trust an
-- unsourced integer would be exactly the "believable guess" this task
-- exists to close off. service_templates.filing_deadline_day itself is
-- left in place (harmless, not dropped) — it's what backfills the new
-- requires_external_deadline flag below (a categorization signal: "this
-- service type has a real filing deadline," not a date value), then
-- becomes inert; staff.js no longer reads or writes it after this task.
--
-- GOVERNED MODEL: deadline_rules holds, per service_template, at most
-- one 'active' row at a time (partial unique index below) plus a full
-- history of 'superseded' ones — the FY label/effective window is
-- informational (a human's record of which period a rule was FOR), not
-- used for automatic date-range matching; when the real deadline changes,
-- an admin explicitly supersedes the old rule and adds a new one via
-- add_deadline_rule(), same "explicit period record, never guessed"
-- principle Task 11 established for periods. Every rule requires a
-- source_title and verified_date — add_deadline_rule() rejects a call
-- missing either, so a rule can't enter the system without SOME
-- citation and someone's name attached (verified_by := auth.uid(),
-- never trusted from client input, matching this session's established
-- provenance pattern).
--
-- Like client_credentials, deadline_rules has NO insert/update policy at
-- all — every write goes through add_deadline_rule() (admin-only,
-- SECURITY DEFINER), which is what makes "supersede the old rule, then
-- insert the new one" atomic and guarantees verified_by/verified_date/
-- source_title can never be skipped by a raw table write.

-- ---- 1. requires_external_deadline: an explicit, admin-set flag on the
-- template ("this service type has a statutory filing deadline"),
-- deliberately NOT inferred at read time from whether external_due_date
-- happens to be set on any given work item (a template with a governed
-- rule that simply hasn't fired yet, or a template that genuinely has no
-- filing deadline, must be distinguishable). Backfilled from the
-- existing filing_deadline_day presence ONLY as a category signal ("an
-- admin previously thought this needed a filing date") — this backfills
-- WHETHER a deadline concept applies, never WHAT the date is, so it does
-- not guess any legal date.
alter table public.service_templates
  add column if not exists requires_external_deadline boolean not null default false;
update public.service_templates set requires_external_deadline = true where filing_deadline_day is not null;

comment on column public.service_templates.filing_deadline_day is
  'Legacy, no longer read by generation as of Handbook Task 12 — kept only as the historical basis for requires_external_deadline''s one-time backfill. The governed replacement is deadline_rules (see docs/FINANCE_RULE_GOVERNANCE.md).';

-- ---- 2. The governed rule table ----
create table public.deadline_rules (
  id uuid primary key default gen_random_uuid(),
  service_template_id uuid not null references public.service_templates(id),
  financial_year_label text not null,
  effective_from date,
  effective_to date,
  filing_deadline_day int not null check (filing_deadline_day between 1 and 31),
  source_title text not null,
  source_url text,
  source_reference text,
  source_page_section text,
  verified_date date not null,
  verified_by uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'superseded')),
  superseded_by uuid references public.deadline_rules(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

-- At most one ACTIVE rule per service template at any time -- this is
-- what makes "which rule governs this template right now" an
-- unambiguous lookup with no date-range matching logic to get wrong.
create unique index deadline_rules_one_active_per_template
  on public.deadline_rules (service_template_id) where status = 'active';

create index deadline_rules_service_template_id_idx on public.deadline_rules (service_template_id);

alter table public.deadline_rules enable row level security;
create policy "deadline_rules_read" on public.deadline_rules
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy, deliberately -- see header. Every
-- write goes through add_deadline_rule() below.

-- ---- 3. add_deadline_rule(): the only way to add or change a rule.
-- Supersedes whatever rule is currently active for this template (if
-- any), then inserts the new one as active, in one transaction -- a
-- template can never end up with two simultaneously-active rules, and
-- verified_by/verified_date/source_title can never be skipped by
-- bypassing this function.
create or replace function public.add_deadline_rule(
  p_service_template_id uuid,
  p_financial_year_label text,
  p_effective_from date,
  p_effective_to date,
  p_filing_deadline_day int,
  p_source_title text,
  p_source_url text,
  p_source_reference text,
  p_source_page_section text,
  p_verified_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Only an admin can add or update a deadline rule.';
  end if;
  if p_financial_year_label is null or trim(p_financial_year_label) = '' then
    raise exception 'A financial year / effective period label is required.';
  end if;
  if p_filing_deadline_day is null or p_filing_deadline_day < 1 or p_filing_deadline_day > 31 then
    raise exception 'filing_deadline_day must be between 1 and 31.';
  end if;
  if p_source_title is null or trim(p_source_title) = '' then
    raise exception 'A source title is required — a deadline rule cannot be added without a citation.';
  end if;
  if p_verified_date is null then
    raise exception 'A verified date is required.';
  end if;
  if not exists (select 1 from public.service_templates where id = p_service_template_id) then
    raise exception 'Unknown service template.';
  end if;

  update public.deadline_rules
    set status = 'superseded'
    where service_template_id = p_service_template_id and status = 'active';

  insert into public.deadline_rules (
    service_template_id, financial_year_label, effective_from, effective_to,
    filing_deadline_day, source_title, source_url, source_reference, source_page_section,
    verified_date, verified_by, status
  ) values (
    p_service_template_id, p_financial_year_label, p_effective_from, p_effective_to,
    p_filing_deadline_day, p_source_title, p_source_url, p_source_reference, p_source_page_section,
    p_verified_date, auth.uid(), 'active'
  ) returning id into new_id;

  update public.deadline_rules set superseded_by = new_id
    where service_template_id = p_service_template_id and status = 'superseded' and superseded_by is null and id <> new_id;

  return new_id;
end;
$$;

revoke execute on function public.add_deadline_rule(uuid, text, date, date, int, text, text, text, text, date) from public, anon;
grant execute on function public.add_deadline_rule(uuid, text, date, date, int, text, text, text, text, date) to authenticated;

-- ---- 4. Generation: external_due_date now derives ONLY from the
-- active deadline_rules row, never from service_templates.
-- filing_deadline_day directly. Full current body (Handbook Task 11's
-- p_period_start/p_period_end signature) reproduced, with the join
-- changed from st.filing_deadline_day to a left join against the active
-- rule -- a template with no active rule (never configured, or
-- superseded with nothing yet to replace it) generates work with
-- external_due_date left null, exactly like a template that never had a
-- filing_deadline_day at all always has.
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
  if p_period_start is null or p_period_end is null then
    raise exception 'p_period_start and p_period_end are required: the requested period''s Gregorian date range must be provided explicitly, never assumed from today''s date.';
  end if;
  if p_period_end < p_period_start then
    raise exception 'p_period_end cannot be before p_period_start.';
  end if;

  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true limit 1;

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
-- Signature unchanged from Task 11, so no drop/re-grant needed -- CREATE
-- OR REPLACE keeps the existing anon-revoked/authenticated-granted shape.
