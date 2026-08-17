-- Maven Work Desk — Staff profiles + attendance (Gregorian dates only)
--
-- Product rules approved by owner (August 2026):
-- - Attendance is Punch In / Punch Out only in V1. No GPS, IP, device,
--   screenshot, presence or productivity surveillance is stored.
-- - Employees/reviewers can see only their own attendance. Admins can see
--   all staff attendance, export it, and correct a record with a mandatory
--   reason. Every correction is preserved in an audit table.
-- - Work dates are Gregorian/English dates. The business-day date for a
--   live punch is derived server-side in Asia/Kathmandu so a browser clock
--   or UTC date conversion cannot put an early-morning Nepal punch on the
--   previous date.
-- - The internal Staff Directory is operational and is NOT linked to the
--   public website Team page.

alter table public.profiles
  add column if not exists designation text,
  add column if not exists work_email text,
  add column if not exists phone text,
  add column if not exists join_date date,
  add column if not exists photo_url text;

-- A staff member may maintain only their own non-privileged contact/avatar
-- fields through this RPC. Role, active status, designation, work email,
-- join date and identity/access remain admin-controlled.
create or replace function public.update_my_profile(
  p_phone text,
  p_photo_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if not public.current_user_active() then
    raise exception 'Inactive accounts cannot update a profile.';
  end if;

  update public.profiles
  set phone = nullif(trim(p_phone), ''),
      photo_url = nullif(trim(p_photo_url), '')
  where id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'Profile not found.';
  end if;
  return result;
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;

create table if not exists public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  work_date date not null,
  punched_in_at timestamptz not null,
  punched_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_entries_one_day unique (user_id, work_date),
  constraint attendance_entries_valid_times check (
    punched_out_at is null or punched_out_at >= punched_in_at
  )
);

create index if not exists attendance_entries_user_date_idx
  on public.attendance_entries (user_id, work_date desc);

alter table public.attendance_entries enable row level security;

drop policy if exists "attendance_entries_select" on public.attendance_entries;
create policy "attendance_entries_select" on public.attendance_entries
  for select
  to authenticated
  using (
    public.current_user_active()
    and (user_id = auth.uid() or public.current_user_role() = 'admin')
  );

-- No direct INSERT/UPDATE/DELETE policies on attendance_entries. Live punches
-- and admin corrections go through the controlled RPCs below so timestamps,
-- ownership and correction history cannot be bypassed by browser API calls.

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_entry_id uuid not null references public.attendance_entries(id) on delete restrict,
  user_id uuid not null references public.profiles(id),
  work_date date not null,
  old_punched_in_at timestamptz,
  old_punched_out_at timestamptz,
  new_punched_in_at timestamptz not null,
  new_punched_out_at timestamptz,
  reason text not null check (length(trim(reason)) >= 3),
  corrected_by uuid not null references public.profiles(id),
  corrected_at timestamptz not null default now()
);

create index if not exists attendance_corrections_entry_idx
  on public.attendance_corrections (attendance_entry_id, corrected_at desc);

alter table public.attendance_corrections enable row level security;

drop policy if exists "attendance_corrections_select" on public.attendance_corrections;
create policy "attendance_corrections_select" on public.attendance_corrections
  for select
  to authenticated
  using (
    public.current_user_active()
    and (user_id = auth.uid() or public.current_user_role() = 'admin')
  );

create or replace function public.attendance_punch_in()
returns public.attendance_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  today_nepal date := (now() at time zone 'Asia/Kathmandu')::date;
  existing public.attendance_entries;
  result public.attendance_entries;
begin
  if not public.current_user_active() then
    raise exception 'Inactive accounts cannot punch attendance.';
  end if;

  select * into existing
  from public.attendance_entries
  where user_id = auth.uid() and work_date = today_nepal;

  if existing.id is not null then
    if existing.punched_out_at is null then
      raise exception 'You are already punched in for today.';
    end if;
    raise exception 'Today''s attendance is already completed.';
  end if;

  insert into public.attendance_entries (user_id, work_date, punched_in_at)
  values (auth.uid(), today_nepal, now())
  returning * into result;

  return result;
end;
$$;

create or replace function public.attendance_punch_out()
returns public.attendance_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  today_nepal date := (now() at time zone 'Asia/Kathmandu')::date;
  result public.attendance_entries;
begin
  if not public.current_user_active() then
    raise exception 'Inactive accounts cannot punch attendance.';
  end if;

  update public.attendance_entries
  set punched_out_at = now(), updated_at = now()
  where user_id = auth.uid()
    and work_date = today_nepal
    and punched_out_at is null
  returning * into result;

  if result.id is null then
    raise exception 'No open punch-in was found for today.';
  end if;

  return result;
end;
$$;

-- Admin correction also acts as the explicit "add missing attendance" path.
-- p_punched_in_at / p_punched_out_at are real timestamps; work_date is kept
-- separate so the monthly calendar remains a clear Gregorian business date.
create or replace function public.attendance_admin_correct(
  p_user_id uuid,
  p_work_date date,
  p_punched_in_at timestamptz,
  p_punched_out_at timestamptz,
  p_reason text
)
returns public.attendance_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row public.attendance_entries;
  result public.attendance_entries;
begin
  if not public.current_user_active() or public.current_user_role() <> 'admin' then
    raise exception 'Only an active admin can correct attendance.';
  end if;
  if p_user_id is null or p_work_date is null or p_punched_in_at is null then
    raise exception 'Staff member, work date and punch-in time are required.';
  end if;
  if p_punched_out_at is not null and p_punched_out_at < p_punched_in_at then
    raise exception 'Punch-out cannot be earlier than punch-in.';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A correction reason of at least 3 characters is required.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Staff profile not found.';
  end if;

  select * into old_row
  from public.attendance_entries
  where user_id = p_user_id and work_date = p_work_date;

  if old_row.id is null then
    insert into public.attendance_entries
      (user_id, work_date, punched_in_at, punched_out_at, updated_at)
    values
      (p_user_id, p_work_date, p_punched_in_at, p_punched_out_at, now())
    returning * into result;
  else
    update public.attendance_entries
    set punched_in_at = p_punched_in_at,
        punched_out_at = p_punched_out_at,
        updated_at = now()
    where id = old_row.id
    returning * into result;
  end if;

  insert into public.attendance_corrections (
    attendance_entry_id, user_id, work_date,
    old_punched_in_at, old_punched_out_at,
    new_punched_in_at, new_punched_out_at,
    reason, corrected_by
  ) values (
    result.id, p_user_id, p_work_date,
    old_row.punched_in_at, old_row.punched_out_at,
    result.punched_in_at, result.punched_out_at,
    trim(p_reason), auth.uid()
  );

  return result;
end;
$$;

revoke all on function public.attendance_punch_in() from public, anon;
revoke all on function public.attendance_punch_out() from public, anon;
revoke all on function public.attendance_admin_correct(uuid, date, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.attendance_punch_in() to authenticated;
grant execute on function public.attendance_punch_out() to authenticated;
grant execute on function public.attendance_admin_correct(uuid, date, timestamptz, timestamptz, text) to authenticated;
