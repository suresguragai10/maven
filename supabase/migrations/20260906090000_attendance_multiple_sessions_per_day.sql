-- Maven Work Desk — attendance: multiple punch-in/punch-out sessions per
-- day, cumulative hours (owner request, 2026-08-21)
--
-- V1 was deliberately one punch-in/punch-out pair per Gregorian work date
-- (attendance_entries_one_day). Real usage needs more than one session a
-- day (e.g. a lunch break, stepping out and back). This migration allows
-- multiple attendance_entries rows per (user_id, work_date) -- each row
-- is one session -- and total time for a day becomes the sum across all
-- of that day's rows, computed client-side exactly the way it already
-- was for a single row (attendanceSeconds() summed, nothing new to add
-- server-side for this since a plain sum over more rows is already
-- correct). Still no location/IP/device/presence tracking of any kind --
-- unaffected by this change.

alter table public.attendance_entries
  drop constraint if exists attendance_entries_one_day;

-- attendance_punch_in() already only ever looked at "is there an OPEN
-- entry for today," never "does ANY entry exist for today" -- removing
-- the unique constraint and its old completed-day rejection branch is
-- the only functional change needed here; the shape of what counts as
-- "already punched in" is unchanged.
create or replace function public.attendance_punch_in()
returns public.attendance_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today_nepal date := public.attendance_nepal_work_date(now());
  open_entry public.attendance_entries;
  result public.attendance_entries;
begin
  if not public.current_user_active() then
    raise exception 'Inactive accounts cannot punch attendance.';
  end if;

  select * into open_entry
  from public.attendance_entries
  where user_id = auth.uid() and work_date = today_nepal and punched_out_at is null;

  if open_entry.id is not null then
    raise exception 'You are already punched in for today.';
  end if;

  insert into public.attendance_entries (user_id, work_date, punched_in_at)
  values (auth.uid(), today_nepal, now())
  returning * into result;

  return result;
end;
$$;

-- attendance_punch_out() is unchanged: it already targets "the open entry
-- for today" (punched_out_at is null), which still means exactly one row
-- at a time even with multiple sessions allowed, since punch_in() above
-- refuses a new session while one is already open.

-- attendance_admin_correct() gains an explicit p_attendance_entry_id so
-- it can target ONE SPECIFIC session to correct, instead of the old
-- upsert-by-(user_id, work_date) which assumed exactly one row existed
-- per day. NULL means "add a new session" (the same "add missing
-- attendance" path as before); a real id means "correct this exact
-- session." old_row is now looked up by id directly, not by
-- user_id/work_date, so a correction can never accidentally target the
-- wrong session on a day with more than one.
drop function if exists public.attendance_admin_correct(uuid, date, timestamptz, timestamptz, text);

create or replace function public.attendance_admin_correct(
  p_attendance_entry_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_punched_in_at timestamptz,
  p_punched_out_at timestamptz,
  p_reason text
)
returns public.attendance_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row public.attendance_entries;
  result public.attendance_entries;
begin
  if not public.current_user_active() or public.current_user_role() <> 'admin' then
    raise exception 'Only an active admin can correct attendance.';
  end if;
  if p_punched_in_at is null then
    raise exception 'Punch-in time is required.';
  end if;
  if p_punched_out_at is not null and p_punched_out_at < p_punched_in_at then
    raise exception 'Punch-out cannot be earlier than punch-in.';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A correction reason of at least 3 characters is required.';
  end if;

  if p_attendance_entry_id is not null then
    select * into old_row from public.attendance_entries where id = p_attendance_entry_id;
    if old_row.id is null then
      raise exception 'Attendance record not found.';
    end if;

    update public.attendance_entries
    set punched_in_at = p_punched_in_at,
        punched_out_at = p_punched_out_at,
        updated_at = now()
    where id = old_row.id
    returning * into result;
  else
    if p_user_id is null or p_work_date is null then
      raise exception 'Staff member and work date are required.';
    end if;
    if not exists (select 1 from public.profiles p where p.id = p_user_id) then
      raise exception 'Staff profile not found.';
    end if;

    insert into public.attendance_entries
      (user_id, work_date, punched_in_at, punched_out_at, updated_at)
    values
      (p_user_id, p_work_date, p_punched_in_at, p_punched_out_at, now())
    returning * into result;
  end if;

  insert into public.attendance_corrections (
    attendance_entry_id, user_id, work_date,
    old_punched_in_at, old_punched_out_at,
    new_punched_in_at, new_punched_out_at,
    reason, corrected_by
  ) values (
    result.id, result.user_id, result.work_date,
    old_row.punched_in_at, old_row.punched_out_at,
    result.punched_in_at, result.punched_out_at,
    trim(p_reason), auth.uid()
  );

  return result;
end;
$$;

revoke all on function public.attendance_admin_correct(uuid, uuid, date, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.attendance_admin_correct(uuid, uuid, date, timestamptz, timestamptz, text) to authenticated;
