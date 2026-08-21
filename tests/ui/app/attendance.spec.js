// Task 30: real, empirical browser evidence for the Attendance page --
// role-scoped visibility (Employee, Reviewer, Admin), the Nepal midnight
// work-date boundary, correction-reason enforcement, CSV export
// visibility, "No record" staying neutral (never "Absent"), and
// mobile-safe tables. Client Work Detail/Firm Work Detail's own
// zero-to-full-coverage pattern (Tasks 26/27) repeats here -- this page
// had no committed browser test before this task.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const REVIEWER = { id: '55555555-5555-5555-5555-555555555555', email: 'reviewer@test.local', full_name: 'Reviewer One', role: 'reviewer', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const INACTIVE_USER = { id: '77777777-7777-7777-7777-777777777777', email: 'inactive@test.local', full_name: 'Former Staffer', role: 'employee', is_active: false };

async function loginAndOpenAttendance(page, user, tables, fixedUtcTime) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, REVIEWER, EMPLOYEE_A],
      clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [], attendance_entries: [], attendance_corrections: [],
    }, tables || {}),
  });
  if (fixedUtcTime) await page.clock.setFixedTime(new Date(fixedUtcTime));
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
}

test.describe('Attendance (Task 30)', () => {
  test('priority order: punch status, then Nepal time, then own history, then calendar, then corrections, then export', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // Employee, not Admin -- Admin's "Staff view" selector defaults to
    // "All staff" (Team monthly summary), which has no calendar to check
    // an order against. An employee always sees their own calendar.
    await loginAndOpenAttendance(page, EMPLOYEE_A);

    const main = page.locator('#main');
    const punchY = (await main.locator('.attendance-punch-card').boundingBox()).y;
    const nepalY = (await main.locator('.nepal-now-line').boundingBox()).y;
    const metricsY = (await main.locator('.metric-grid').boundingBox()).y;
    const recordsY = (await main.getByRole('heading', { name: 'Attendance records' }).boundingBox()).y;
    const calendarY = (await main.getByRole('heading', { name: 'Monthly calendar' }).boundingBox()).y;
    const exportY = (await main.getByRole('button', { name: 'Export CSV' }).boundingBox()).y;

    expect(punchY).toBeLessThanOrEqual(nepalY);
    expect(nepalY).toBeLessThan(metricsY);
    expect(metricsY).toBeLessThan(recordsY);
    expect(recordsY).toBeLessThan(calendarY);
    expect(calendarY).toBeLessThan(exportY);

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Employee: sees only their own attendance, no admin controls, but can still export their own CSV', async ({ page }) => {
    await loginAndOpenAttendance(page, EMPLOYEE_A);
    await expect(page.getByText('Staff view')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add / Correct Missing Record' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Correct', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });

  test('Reviewer: identical to Employee for attendance purposes -- role alone grants no elevated access', async ({ page }) => {
    await loginAndOpenAttendance(page, REVIEWER);
    await expect(page.getByText('Staff view')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add / Correct Missing Record' })).not.toBeVisible();
    await expect(page.getByText('Team monthly summary')).not.toBeVisible();
  });

  test('Admin: sees the Staff view selector, Add/Correct controls, and the Team monthly summary when All staff is selected', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN);
    await expect(page.getByText('Staff view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add / Correct Missing Record' })).toBeVisible();

    // Task 30: defaults to the admin's OWN monthly view, not "All staff"
    // -- own history outranks the team view in this task's priority order.
    await expect(page.getByText('Monthly calendar')).toBeVisible();
    await expect(page.getByText('Team monthly summary')).not.toBeVisible();

    const staffSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'All staff' }) });
    await staffSel.selectOption('__all__');
    await expect(page.getByText('Team monthly summary')).toBeVisible();
    // Calendar is for a single person -- never shown alongside the team view.
    await expect(page.getByText('Monthly calendar')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });

  test('an inactive user is signed out before ever reaching Attendance, not shown a restricted view of it', async ({ page }) => {
    await installSupabaseMock(page, {
      user: INACTIVE_USER,
      tables: {
        profiles: [ADMIN, REVIEWER, EMPLOYEE_A, INACTIVE_USER],
        clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
        work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
        work_items: [], attendance_entries: [], attendance_corrections: [],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(INACTIVE_USER.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#toast')).toContainText('deactivated');
    // Bounced straight back to the login screen -- never reaches #app/Attendance.
    await expect(page.locator('#loginScreen')).not.toHaveClass(/hidden/);
  });

  test('Nepal midnight boundary: "Today" flips to the next Gregorian date at 00:00 Nepal time (UTC+05:45), not at UTC midnight', async ({ page }) => {
    // 18:14 UTC = 23:59 NPT on the same UTC calendar day -- still "Aug 20".
    await loginAndOpenAttendance(page, EMPLOYEE_A, {}, '2026-08-20T18:14:00Z');
    await expect(page.locator('.attendance-punch-card h2')).toContainText('Aug 20, 2026');
  });

  test('Nepal midnight boundary: one minute later (18:16 UTC = 00:01 NPT) "Today" is already Aug 21, while UTC itself is still Aug 20', async ({ page }) => {
    await loginAndOpenAttendance(page, EMPLOYEE_A, {}, '2026-08-20T18:16:00Z');
    await expect(page.locator('.attendance-punch-card h2')).toContainText('Aug 21, 2026');
  });

  test('a correction requires a real reason (at least 3 characters) before it can be saved', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN);
    await page.getByRole('button', { name: 'Add / Correct Missing Record' }).click();
    const modal = page.locator('#modalCard');
    await modal.locator('.f').filter({ hasText: 'Staff member' }).locator('select').selectOption({ label: 'Employee A' });
    await modal.locator('.f').filter({ hasText: 'Work date' }).locator('input').fill('2026-08-15');
    await modal.locator('.f').filter({ hasText: 'Punch in' }).locator('input').fill('2026-08-15T09:00');
    // No reason entered -- Save must be blocked client-side.
    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/attendance_admin_correct')) rpcCalls.push(req.url()); });
    await page.getByRole('button', { name: 'Save Correction' }).click();
    await expect(page.locator('#toast')).toContainText('reason');
    expect(rpcCalls).toEqual([]);

    // A real reason clears the block.
    await modal.locator('.f').filter({ hasText: 'Correction reason' }).locator('textarea').fill('Forgot to punch in, confirmed with employee.');
    await page.getByRole('button', { name: 'Save Correction' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
  });

  // Task 36: the row-level "Correct" button on an EXISTING record was
  // only ever exercised indirectly -- every prior test used "Add /
  // Correct Missing Record" (entry === null). This proves the other
  // branch: the modal opens pre-filled from the real entry (title says
  // "Correct", not "Add Missing"; every field carries the entry's actual
  // values, converted to Nepal wall-clock time), and an edited punch-out
  // reaches the RPC as the new value while everything else stays intact.
  test('correcting an EXISTING record pre-fills the modal from that entry, and Save sends the right RPC payload', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN, {
      // 2026-08-10, 09:00-17:00 Nepal time (UTC+05:45) == 03:15-11:15 UTC.
      attendance_entries: [{ id: 'ae1', user_id: EMPLOYEE_A.id, work_date: '2026-08-10', punched_in_at: '2026-08-10T03:15:00.000Z', punched_out_at: '2026-08-10T11:15:00.000Z' }],
    });
    const staffSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'All staff' }) });
    await staffSel.selectOption({ label: 'Employee A' });
    await expect(page.getByRole('button', { name: 'Correct', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Correct', exact: true }).click();
    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Correct Attendance' })).toBeVisible();
    await expect(modal.locator('.f').filter({ hasText: 'Work date' }).locator('input')).toHaveValue('2026-08-10');
    await expect(modal.locator('.f').filter({ hasText: 'Punch in' }).locator('input')).toHaveValue('2026-08-10T09:00');
    await expect(modal.locator('.f').filter({ hasText: 'Punch out' }).locator('input')).toHaveValue('2026-08-10T17:00');

    // Push punch-out 30 minutes later (17:30 NPT == 11:45 UTC).
    await modal.locator('.f').filter({ hasText: 'Punch out' }).locator('input').fill('2026-08-10T17:30');
    await modal.locator('.f').filter({ hasText: 'Correction reason' }).locator('textarea').fill('Employee confirmed leaving later than logged.');

    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/attendance_admin_correct')) rpcCalls.push(req.postDataJSON()); });
    await page.getByRole('button', { name: 'Save Correction' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
    expect(rpcCalls[0].p_user_id).toBe(EMPLOYEE_A.id);
    expect(rpcCalls[0].p_work_date).toBe('2026-08-10');
    expect(rpcCalls[0].p_punched_in_at).toBe('2026-08-10T03:15:00.000Z');
    expect(rpcCalls[0].p_punched_out_at).toBe('2026-08-10T11:45:00.000Z');
    expect(rpcCalls[0].p_reason).toBe('Employee confirmed leaving later than logged.');
    // Multiple sessions per day are allowed (2026-08-21) -- correcting an
    // existing row must target it by id, never by user/date alone, or a
    // correction could silently land on the wrong session on a day with
    // more than one.
    expect(rpcCalls[0].p_attendance_entry_id).toBe('ae1');
  });

  // The actual feature: multiple punch-in/punch-out sessions on the same
  // Gregorian work_date, hours cumulative across them (2026-08-21).
  test('two sessions on the same day: both rows show in Attendance records, metrics count 1 day / 2 sessions, calendar shows the combined total', async ({ page }) => {
    await loginAndOpenAttendance(page, EMPLOYEE_A, {
      attendance_entries: [
        // 2026-08-10, 09:00-12:00 and 13:00-17:00 Nepal time (UTC+05:45) -- 7h total.
        { id: 'ae1', user_id: EMPLOYEE_A.id, work_date: '2026-08-10', punched_in_at: '2026-08-10T03:15:00.000Z', punched_out_at: '2026-08-10T06:15:00.000Z' },
        { id: 'ae2', user_id: EMPLOYEE_A.id, work_date: '2026-08-10', punched_in_at: '2026-08-10T07:15:00.000Z', punched_out_at: '2026-08-10T11:15:00.000Z' },
      ],
    }, '2026-08-10T12:00:00.000Z');
    await page.locator('input[type="month"]').fill('2026-08');

    // Both sessions get their own row in the records table.
    const recordRows = page.locator('table').filter({ hasText: 'Punch In' }).locator('tbody tr');
    await expect(recordRows).toHaveCount(2);

    // Metrics: still 1 punch DAY, but 2 sessions, hours summed correctly.
    const metrics = page.locator('.metric-grid');
    await expect(metrics.locator('.metric-card').filter({ hasText: 'Punch days' }).locator('.metric-value')).toHaveText('1');
    await expect(metrics.locator('.metric-card').filter({ hasText: 'Total sessions' }).locator('.metric-value')).toHaveText('2');
    await expect(metrics.locator('.metric-card').filter({ hasText: 'Total time' }).locator('.metric-value')).toHaveText('7h 00m');

    // Calendar cell for the 10th shows the combined duration and the session count.
    const dayCell = page.locator('.cal-day').filter({ has: page.locator('.day-num', { hasText: /^10$/ }) });
    await expect(dayCell).toContainText('7h 00m');
    await expect(dayCell).toContainText('2 sessions');
  });

  // Regression coverage for the same 2026-08-21 change: adding a brand
  // new session (not correcting one) must send a null entry id, so the
  // RPC inserts rather than accidentally updating whatever the admin last
  // had open.
  test('adding a new (missing) record sends a null entry id, an existing session on the same day is untouched', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN, {
      attendance_entries: [{ id: 'ae1', user_id: EMPLOYEE_A.id, work_date: '2026-08-10', punched_in_at: '2026-08-10T03:15:00.000Z', punched_out_at: '2026-08-10T05:15:00.000Z' }],
    });
    await page.getByRole('button', { name: 'Add / Correct Missing Record' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Add Missing Attendance' })).toBeVisible();
    await modal.locator('.f').filter({ hasText: 'Staff member' }).locator('select').selectOption(EMPLOYEE_A.id);
    await modal.locator('.f').filter({ hasText: 'Work date' }).locator('input').fill('2026-08-10');
    await modal.locator('.f').filter({ hasText: 'Punch in' }).locator('input').fill('2026-08-10T13:00');
    await modal.locator('.f').filter({ hasText: 'Correction reason' }).locator('textarea').fill('Second session that day, forgot to punch in.');

    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/attendance_admin_correct')) rpcCalls.push(req.postDataJSON()); });
    await page.getByRole('button', { name: 'Save Correction' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
    expect(rpcCalls[0].p_attendance_entry_id).toBeNull();
    expect(rpcCalls[0].p_user_id).toBe(EMPLOYEE_A.id);
  });

  // Task 36: today.spec.js already covers the Today dashboard's own
  // attendance bar in all three states; this covers the Attendance
  // page's OWN punch card, a separate piece of UI hitting the same RPCs.
  test('Punch In from the Attendance page\'s own punch card fires the RPC and confirms with a toast', async ({ page }) => {
    await loginAndOpenAttendance(page, EMPLOYEE_A);
    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/attendance_punch_in')) rpcCalls.push(req.url()); });
    await page.locator('.attendance-punch-card').getByRole('button', { name: 'Punch In' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
    await expect(page.locator('#toast')).toContainText('Punched in.');
  });

  test('"No record" stays a neutral label on the calendar -- never "Absent"', async ({ page }) => {
    await loginAndOpenAttendance(page, EMPLOYEE_A);
    const bodyText = await page.locator('#main').innerText();
    expect(bodyText).toContain('No record');
    expect(bodyText.toLowerCase()).not.toContain('absent');
  });

  test('no location, IP, device, screenshot, or presence tracking language appears anywhere on the page', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN);
    const bodyText = (await page.locator('#main').innerText()).toLowerCase();
    ['gps', 'ip address', 'device id', 'screenshot', 'presence', 'productivity score'].forEach((term) => {
      expect(bodyText, `found forbidden term "${term}" on the Attendance page`).not.toContain(term);
    });
  });

  test('no horizontal overflow at mobile width, with the records/correction/team tables scrolling within their own cards', async ({ page }) => {
    await loginAndOpenAttendance(page, ADMIN, {
      attendance_corrections: [{
        id: 'ac1', attendance_entry_id: 'ae1', user_id: EMPLOYEE_A.id, work_date: '2026-08-10',
        old_punched_in_at: null, old_punched_out_at: null, new_punched_in_at: '2026-08-10T04:00:00Z', new_punched_out_at: '2026-08-10T10:00:00Z',
        reason: 'Missed punch-in, corrected next day.', corrected_by: ADMIN.id, corrected_at: '2026-08-11T00:00:00Z',
      }],
    });
    const staffSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'All staff' }) });
    await staffSel.selectOption('__all__');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Attendance page overflows horizontally at 375px by ${overflow}px`).toBeLessThanOrEqual(1);
  });
});
