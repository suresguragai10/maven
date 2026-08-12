-- Maven Work Desk — recurring work generation
--
-- Two entry points share one core: a manual button (Templates page →
-- "Generate Period Work", calls generate_period_work_for_period via RPC)
-- and a check that runs when an admin opens Work Desk (staff.js calls the
-- same RPC once per configured period-type on login — see enterApp() in
-- staff.js). Both ultimately call _generate_period_work_core, so the
-- generation logic exists in exactly one place.
--
-- _generate_period_work_core is deliberately NOT exposed to the client:
-- it's revoked from anon/authenticated below, so it can only be reached
-- through generate_period_work_for_period, which checks the caller is
-- admin/reviewer.
--
-- RECURRENCE-TYPE-AWARE, 2026-08-12 (was a single blind period string
-- applied to every active service regardless of cadence): a period label
-- like "Shrawan 2083" only makes sense for monthly services, "Q1
-- 2083/84" only for quarterly, "FY 2083/84" only for yearly -- applying
-- one typed-in label to every active client_service used to silently
-- generate wrongly-labeled work for services on a different cadence.
-- p_period_type pins generation to exactly the client_services whose
-- service_templates.recurrence matches, so a monthly period can never
-- land on a quarterly/yearly service or vice versa. One-time (ad-hoc,
-- recurrence = 'none') work isn't part of bulk generation at all --
-- "one-time" has no period to advance, so it's created directly via the
-- New Work modal, same as always.
--
-- The period name itself is still never computed from a date -- this app
-- has no verified Nepali BS-calendar (Bikram Sambat) conversion table,
-- and silently mislabeling a real filing period is a bad failure mode. A
-- person sets the relevant app_settings.auto_generate_period_* value; the
-- open-Work-Desk check just applies whatever is currently set for each
-- type, or does nothing for a type left null/blank.
--
-- Due dates are computed only when a template opts in via
-- internal_deadline_days / filing_deadline_days (added 2026-08-12, see
-- 20260811090300_service_templates.sql) -- both are a same-day offset
-- from the work item's own generation date, the only calendar-safe
-- anchor available without BS-conversion. A template that leaves both
-- null keeps the original behavior: due dates land blank for a human to
-- fill in per item afterward (Work Details → Edit).
--
-- Duplicate prevention for "same client + service + period" is enforced
-- by a real unique constraint (see 20260811090400_work_items.sql,
-- work_items_client_service_period_unique), not application logic --
-- _generate_period_work_core uses INSERT ... ON CONFLICT DO NOTHING, so
-- it's genuinely idempotent even under concurrent execution, not just
-- "correct as long as nothing runs at the same time." Because it's
-- idempotent, calling it opportunistically (every admin login) is safe:
-- a login where nothing new is due is a same-cost no-op, not a risk of
-- creating duplicates.
--
-- NO SCHEDULER: this app previously used pg_cron for a daily sweep, but
-- that required an admin to keep a single "current period" setting
-- perpetually up to date with no visibility into whether it was actually
-- current -- and with three recurrence types now needing their own
-- setting, that gap would triple. Replaced with the "safely run when an
-- admin opens Work Desk" pattern requested directly: no paid or external
-- scheduler, no blind background job, and an admin who hasn't opened
-- Work Desk in a while simply catches up the moment they next do,
-- instead of silently drifting. pg_cron itself is left installed (see
-- 20260811090000_extensions.sql) since other things may use it later;
-- this feature just no longer depends on it.

drop function if exists public._generate_period_work_core(text);
drop function if exists public.generate_period_work_for_period(text);
drop function if exists public.generate_period_work_scheduled();
do $$
begin
  perform cron.unschedule('generate-period-work-daily');
exception when others then null;
end $$;

create or replace function public._generate_period_work_core(p_period text, p_period_type text)
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
  calc_internal_due date;
  calc_filing_due date;
begin
  if p_period is null or trim(p_period) = '' then
    return 0;
  end if;
  if p_period_type not in ('monthly', 'quarterly', 'yearly') then
    raise exception 'p_period_type must be monthly, quarterly, or yearly.';
  end if;

  -- Client services aren't required to have their own assignee set; fall
  -- back to any active admin so work_items.assignee_id (not null) is
  -- always satisfiable.
  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true limit 1;

  for svc in
    select cs.*, st.title as template_title, st.internal_deadline_days, st.filing_deadline_days
    from public.client_services cs
    join public.service_templates st on st.id = cs.service_template_id
    where cs.is_active = true and st.recurrence = p_period_type
  loop
    new_work_id := null;
    calc_internal_due := case when svc.internal_deadline_days is not null then current_date + svc.internal_deadline_days else null end;
    calc_filing_due := case when svc.filing_deadline_days is not null then current_date + svc.filing_deadline_days else null end;

    -- True idempotency: relies on the work_items_client_service_period_
    -- unique constraint, not a check-then-insert. A plain "select exists,
    -- then insert if not" has a race window between the check and the
    -- insert -- fine for a single call, not safe if the manual button and
    -- an admin-open check ever land at the same moment. ON CONFLICT DO
    -- NOTHING is atomic: the database itself guarantees no duplicate can
    -- be created no matter how many callers try at once.
    insert into public.work_items (client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status, internal_due_date, external_due_date, created_by)
    values (
      svc.client_id, svc.service_template_id, svc.template_title, p_period,
      coalesce(svc.assignee_id, fallback_admin),
      svc.reviewer_id, 'normal', 'to_do', calc_internal_due, calc_filing_due, fallback_admin
    )
    on conflict (client_id, service_template_id, period) do nothing
    returning id into new_work_id;

    if new_work_id is null then
      continue; -- already exists for this client + service + period
    end if;

    insert into public.work_checklist_items (work_item_id, stage, title, sort_order)
    select new_work_id, sti.stage, sti.title, sti.sort_order
    from public.service_template_items sti
    where sti.template_id = svc.service_template_id;

    created_count := created_count + 1;
  end loop;

  return created_count;
end;
$$;

revoke execute on function public._generate_period_work_core(text, text) from public, anon, authenticated;

-- Client-facing wrapper — this is what the manual "Generate Period Work"
-- button AND the open-Work-Desk check (enterApp() in staff.js) call via
-- sb.rpc(...).
create or replace function public.generate_period_work_for_period(p_period text, p_period_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return public._generate_period_work_core(p_period, p_period_type);
end;
$$;
