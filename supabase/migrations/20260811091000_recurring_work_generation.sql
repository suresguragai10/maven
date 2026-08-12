-- Maven Work Desk — recurring work generation
--
-- Two entry points share one core: a manual button (Templates page →
-- "Generate Period Work", calls generate_period_work_for_period via RPC)
-- and a daily pg_cron sweep (generate_period_work_scheduled, reads the
-- period from app_settings). Both ultimately call
-- _generate_period_work_core, so the generation logic exists in exactly
-- one place.
--
-- _generate_period_work_core is deliberately NOT exposed to the client:
-- it's revoked from anon/authenticated below, so it can only be reached
-- through the two gated wrappers. generate_period_work_for_period checks
-- the caller is admin/reviewer; generate_period_work_scheduled has no such
-- check because pg_cron runs with no authenticated user context
-- (auth.uid() is null there, so current_user_role() would always fail) —
-- it's also revoked from client roles so it can't be called as a
-- workaround for the auth check on the other wrapper.
--
-- The period name is never computed from a date — this app has no
-- verified Nepali BS-calendar (Bikram Sambat) conversion table, and
-- silently mislabeling a real filing period is a bad failure mode. A
-- person sets app_settings.auto_generate_period; the sweep just applies
-- whatever is currently set, or does nothing if it's null/blank.
--
-- Due dates are intentionally left blank on generated work items for the
-- same reason — they need a human to fill in per item afterward (Work
-- Details → Edit).
--
-- Duplicate prevention for "same client + service + period" is enforced
-- by a real unique constraint (see 20260811090400_work_items.sql,
-- work_items_client_service_period_unique), not application logic —
-- _generate_period_work_core uses INSERT ... ON CONFLICT DO NOTHING, so
-- it's genuinely idempotent even under concurrent execution, not just
-- "correct as long as nothing runs at the same time."

create or replace function public._generate_period_work_core(p_period text)
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
begin
  if p_period is null or trim(p_period) = '' then
    return 0;
  end if;

  -- Client services aren't required to have their own assignee set; fall
  -- back to any active admin so work_items.assignee_id (not null) is
  -- always satisfiable.
  select id into fallback_admin from public.profiles where role = 'admin' and is_active = true limit 1;

  for svc in
    select cs.*, st.title as template_title
    from public.client_services cs
    join public.service_templates st on st.id = cs.service_template_id
    where cs.is_active = true
  loop
    new_work_id := null;

    -- True idempotency: relies on the work_items_client_service_period_
    -- unique constraint, not a check-then-insert. A plain "select exists,
    -- then insert if not" has a race window between the check and the
    -- insert -- fine for a single call, not safe if the manual button and
    -- the daily cron sweep ever land at the same moment. ON CONFLICT DO
    -- NOTHING is atomic: the database itself guarantees no duplicate can
    -- be created no matter how many callers try at once.
    insert into public.work_items (client_id, service_template_id, title, period, assignee_id, reviewer_id, priority, status, created_by)
    values (
      svc.client_id, svc.service_template_id, svc.template_title, p_period,
      coalesce(svc.assignee_id, fallback_admin),
      svc.reviewer_id, 'normal', 'to_do', fallback_admin
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

revoke execute on function public._generate_period_work_core(text) from public, anon, authenticated;

-- Client-facing wrapper — this is what the manual "Generate Period Work"
-- button calls via sb.rpc(...).
create or replace function public.generate_period_work_for_period(p_period text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  return public._generate_period_work_core(p_period);
end;
$$;

-- Scheduled wrapper — this is what pg_cron calls. Not client-callable.
create or replace function public.generate_period_work_scheduled()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  period_val text;
begin
  select value into period_val from public.app_settings where key = 'auto_generate_period';
  perform public._generate_period_work_core(period_val);
end;
$$;

revoke execute on function public.generate_period_work_scheduled() from public, anon, authenticated;

-- Daily at 03:00 UTC (~08:45 Nepal time). cron.schedule() with a named job
-- upserts the schedule for that name on pg_cron >= 1.4 (this project runs
-- 1.6.4), so re-running this migration updates the existing job rather
-- than erroring or duplicating it.
select cron.schedule(
  'generate-period-work-daily',
  '0 3 * * *',
  $$ select public.generate_period_work_scheduled(); $$
);
