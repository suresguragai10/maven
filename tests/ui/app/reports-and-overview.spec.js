// Task 33: real, empirical browser evidence that Operations Overview,
// Reports and Period Summary are now clearly scoped/labeled and no
// longer duplicate each other where one already serves the need --
// specifically, Reports' old "Overdue Work Items" report (a genuine
// duplicate of Operations Overview's own real-time overdue list) is
// gone, the nav-vs-heading mismatch on Operations Overview is fixed,
// and every surface states its Client-Work-only scope instead of
// leaving it implicit. Also confirms none of the three ever ranks staff.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

const OVERDUE_ITEM = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'high',
  internal_due_date: '2020-01-01', external_due_date: null, period: 'Shrawan 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAs(page, user, tables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [OVERDUE_ITEM],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

test.describe('Operations Overview (Task 33)', () => {
  test('heading matches the sidebar/tab label ("Operations Overview", not "Manager Dashboard")', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('tab', { name: 'Operations Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Operations Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Manager Dashboard' })).toHaveCount(0);
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('states Client Work only, and that it is not a staff ranking', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('tab', { name: 'Operations Overview' }).click();
    await expect(page.getByText('Client Work only')).toBeVisible();
    await expect(page.getByText('never a staff performance ranking').or(page.getByText('not a staff performance ranking'))).toBeVisible();
  });

  test('Team Workload preserves the team\'s existing load order, never re-sorted by who has the most work', async ({ page }) => {
    // Fixture order is [Employee A, Admin User] -- reverse of alphabetical
    // -- and Admin is given far more overdue work than Employee A. If
    // this table were ever sorted by workload (a ranking), Admin (busiest)
    // would jump to the top; the actual rule is "never re-sort by count,"
    // so the rendered order must still match the load order regardless.
    const busyItems = ['w2', 'w3', 'w4'].map((id) => Object.assign({}, OVERDUE_ITEM, { id, assignee_id: ADMIN.id }));
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [EMPLOYEE_A, ADMIN],
        clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
        work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
        work_items: [OVERDUE_ITEM].concat(busyItems),
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('tab', { name: 'Operations Overview' }).click();
    const names = await page.locator('table tbody tr td:first-child').allTextContents();
    expect(names).toEqual(['Employee A', 'Admin User']);
  });
});

test.describe('Reports (Task 33)', () => {
  test('the old "Overdue Work Items" report is gone -- Operations Overview already serves that need', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overdue Work Items' })).toHaveCount(0);
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('states Client Work only, and cross-references Operations Overview for real-time triage', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByText('Client Work only')).toBeVisible();
    await expect(page.getByText('see Operations Overview instead')).toBeVisible();
  });

  test('the remaining Waiting/Review-wait reports explain how they differ from Operations Overview\'s exception lists', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Waiting for Client' })).toBeVisible();
    await expect(page.getByText(/Needs Attention.*Waiting for Client Too Long/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Average Review Waiting Time' })).toBeVisible();
    await expect(page.getByText(/Needs Attention.*Review Pending Too Long/)).toBeVisible();
  });

  test('no employee ranking, hours leaderboard, or productivity score language anywhere on Reports', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    // Note: the intro copy legitimately says "never a staff performance
    // leaderboard" -- a correct negation, not a violation -- so
    // "leaderboard" itself isn't in this list; these are terms that
    // would only appear if an actual ranking/scoring feature existed.
    const bodyText = (await page.locator('#main').innerText()).toLowerCase();
    ['ranking', 'ranked', 'productivity score', 'hours worked', 'busiest'].forEach((term) => {
      expect(bodyText, `found forbidden term "${term}" on Reports`).not.toContain(term);
    });
  });
});

test.describe('Period Summary (Task 33)', () => {
  test('states Client Work only, and the audience-scoped description matches the viewer\'s role', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('tab', { name: 'Period Summary' }).click();
    await expect(page.getByText('Client Work only. A filterable snapshot across the whole team')).toBeVisible();
  });

  test('a plain employee sees the "your own work" scope description, not the team-wide one', async ({ page }) => {
    await loginAs(page, EMPLOYEE_A);
    // Employees don't have the Reports/Operations Overview tabs -- Period
    // Summary is reached directly from the Reports group, which for a
    // non-reviewer/admin only ever has Period Summary in it.
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Period Summary', exact: true })).toBeVisible();
    await expect(page.getByText('Client Work only. A filterable snapshot of your own work')).toBeVisible();
  });
});
