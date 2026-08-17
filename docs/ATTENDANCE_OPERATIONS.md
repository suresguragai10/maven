# Maven Attendance Operations

## Scope

Attendance V1 is intentionally simple: one Punch In and one Punch Out per Gregorian work date. It is an attendance record, not a monitoring system.

Not collected: GPS/location, IP address, device fingerprint, screenshots, online presence or productivity metrics.

## Visibility

- Employee: own attendance only.
- Reviewer: own attendance only.
- Admin: all staff attendance, team monthly summary, CSV export and corrections.
- Inactive user: no attendance access or punch action.

Database RLS/RPC rules must be treated as authoritative. Hiding an admin control in the browser is not sufficient authorization.

## Live punch rules

- `attendance_punch_in()` derives the business date on the server in `Asia/Kathmandu` and creates the day's row.
- A second punch-in for the same work date is rejected.
- `attendance_punch_out()` closes the current Nepal business-date row.
- Punch-out before punch-in is prohibited.

## Admin corrections

Admins use `attendance_admin_correct(...)` for both corrections and an explicitly missing attendance row.

Every correction requires a reason of at least three characters and writes an `attendance_corrections` audit record containing old/new timestamps, affected staff, work date, correcting admin and correction time.

Do not add a silent delete/edit path around this RPC.

## Monthly calendar semantics

A day with no row is shown as **No record**. The system does not infer Absence/Late/Early because no working-day schedule, leave system or holiday calendar has been approved yet.

This avoids presenting unsupported HR conclusions as fact.

## CSV export

CSV is generated from the attendance rows currently available to the signed-in user. Because RLS limits non-admin users to their own records, a client-side CSV export cannot legitimately expose another staff member's attendance.

## Future features requiring a new owner decision

- breaks;
- scheduled work hours;
- leave/holiday integration;
- late/early rules;
- absence inference;
- payroll linkage;
- biometric/device verification;
- location/IP monitoring.
