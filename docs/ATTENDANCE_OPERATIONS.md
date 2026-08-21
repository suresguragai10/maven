# Maven Attendance Operations

## Scope

Attendance V1 is intentionally simple: Punch In / Punch Out sessions on a Gregorian work date, with multiple sessions per day allowed (2026-08-21 — e.g. a break) and hours cumulative across all of a day's sessions. It is an attendance record, not a monitoring system.

Not collected: GPS/location, IP address, device fingerprint, screenshots, online presence or productivity metrics.

## Visibility

- Employee: own attendance only.
- Reviewer: own attendance only.
- Admin: all staff attendance, team monthly summary, CSV export and corrections.
- Inactive user: no attendance access or punch action.

Database RLS/RPC rules must be treated as authoritative. Hiding an admin control in the browser is not sufficient authorization.

## Live punch rules

- `attendance_punch_in()` derives the business date on the server in `Asia/Kathmandu` and creates a new session row for that day.
- A second punch-in is only rejected while a session is still open (no punch-out yet) — once that session is closed, a new punch-in starts another session on the same work date, and total hours for the day accumulate across all of that day's sessions.
- `attendance_punch_out()` closes whichever session for today is currently open (there is never more than one open at a time, since punch-in refuses a new session while one is already open).
- Punch-out before punch-in is prohibited.

## Admin corrections

Admins use `attendance_admin_correct(p_attendance_entry_id, p_user_id, p_work_date, p_punched_in_at, p_punched_out_at, p_reason)` for both correcting an existing session and adding an explicitly missing one. `p_attendance_entry_id` is the session's own id when correcting a specific existing row (never derived from user/date alone, since a day can now hold more than one session); `NULL` means "add a new session" for that user/date instead.

Every correction requires a reason of at least three characters and writes an `attendance_corrections` audit record containing old/new timestamps, affected staff, work date, correcting admin and correction time.

Do not add a silent delete/edit path around this RPC.

## Monthly calendar semantics

A day with no row is shown as **No record**. The system does not infer Absence/Late/Early because no working-day schedule, leave system or holiday calendar has been approved yet.

This avoids presenting unsupported HR conclusions as fact.

## CSV export

CSV is generated from the attendance rows currently available to the signed-in user. Because RLS limits non-admin users to their own records, a client-side CSV export cannot legitimately expose another staff member's attendance.

## Future features requiring a new owner decision

- scheduled work hours;
- leave/holiday integration;
- late/early rules;
- absence inference;
- payroll linkage;
- biometric/device verification;
- location/IP monitoring.
