// Task 29: real, empirical browser evidence for Global Search's explicit
// All/Client/Firm scope control, the "which filters even apply to Firm
// Work" clarity fix (including the real bug it closed — Assignee alone,
// with no search text, silently returned zero Firm Work results before
// this task even though Assignee was already documented as a shared
// filter), and the Notifications panel's explicit Client-Work-only scope
// note.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

const CLIENT_ITEM = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: '2026-09-01', external_due_date: null, period: null, submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const FIRM_ITEM = {
  id: 'w2', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'normal', internal_due_date: '2026-09-01',
  description: null, project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAndOpenSearch(page, tables) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [CLIENT_ITEM, FIRM_ITEM],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Global Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
}

test.describe('Global Search scope (Task 29)', () => {
  test('offers an explicit All / Client Work only / Firm Work only scope selector', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpenSearch(page);
    const scopeSel = page.locator('select').first();
    const optionLabels = await scopeSel.locator('option').allTextContents();
    expect(optionLabels).toEqual(['All (Client + Firm)', 'Client Work only', 'Firm Work only']);
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('states which filters are Client-only, and disables them under Firm Work only scope', async ({ page }) => {
    await loginAndOpenSearch(page);
    await expect(page.getByText('Status, Client, Service, Reviewer, Period, and "Waiting for Client" apply to Client Work only.')).toBeVisible();

    const scopeSel = page.locator('select').first();
    await scopeSel.selectOption('firm');
    const statusSel = page.locator('select').nth(1);
    await expect(statusSel).toBeDisabled();
  });

  test('Firm Work only scope: text search returns Firm results, no Client Work section at all', async ({ page }) => {
    await loginAndOpenSearch(page);
    const scopeSel = page.locator('select').first();
    await scopeSel.selectOption('firm');
    await page.getByPlaceholder('Search client, service, period, staff, status, reference number, or Firm Work…').fill('office internet');
    await page.waitForTimeout(400);
    await expect(page.getByText('Renew office internet contract')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client Work', level: 2 })).not.toBeVisible();
  });

  test('Client Work only scope: the Firm query never even fires, regardless of search text', async ({ page }) => {
    await loginAndOpenSearch(page);
    const firmRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/work_items') && req.url().includes('work_scope=eq.firm')) firmRequests.push(req.url());
    });
    const scopeSel = page.locator('select').first();
    await scopeSel.selectOption('client');
    await page.getByPlaceholder('Search client, service, period, staff, status, reference number, or Firm Work…').fill('office internet');
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Firm Work', level: 2 })).not.toBeVisible();
    expect(firmRequests, 'a work_scope=firm request was sent despite Client Work only scope being selected').toEqual([]);
  });

  test('bug fix: filtering by Assignee alone (no search text) now also returns matching Firm Work results', async ({ page }) => {
    await loginAndOpenSearch(page);
    // Assignee is the 4th select: scope, status, client, service, assignee.
    const assigneeSel = page.locator('select').nth(4);
    await assigneeSel.selectOption({ label: 'Employee A' });
    await page.waitForTimeout(400);
    await expect(page.getByText('Alpha VAT Return')).toBeVisible();
    await expect(page.getByText('Renew office internet contract')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Firm Work', level: 2 })).toBeVisible();
  });

  test('Client Work results now render under their own "Client Work" heading, unmistakably CLIENT-labeled (symmetric with the existing Firm Work heading)', async ({ page }) => {
    await loginAndOpenSearch(page);
    await page.getByPlaceholder('Search client, service, period, staff, status, reference number, or Firm Work…').fill('Alpha');
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Client Work', level: 2 })).toBeVisible();
    const clientRow = page.locator('.task-row').filter({ hasText: 'Alpha VAT Return' });
    await expect(clientRow.locator('.badge-scope-client')).toHaveText('CLIENT');
  });
});

test.describe('Notifications scope clarity (Task 29)', () => {
  test('the panel explicitly states it is Client Work only and points to the Firm Work Catch-Up feed', async ({ page }) => {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN, EMPLOYEE_A], clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [],
        app_settings: [], projects: [], work_comments: [], work_checklist_items: [], work_activity: [],
        notifications: [], personal_todos: [], work_items: [],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);

    await page.getByRole('button', { name: 'Notifications (Client Work only)' }).click();
    await expect(page.getByText('Client Work only — Firm Work has its own Catch-Up feed.')).toBeVisible();
  });
});

// Task 36: behavioural coverage for the notifications panel itself --
// the badge count, clicking through to the linked work item, dismissing
// one notification, and marking all read -- rather than only the one
// scope-copy assertion above. work_items is seeded empty here (same as
// the test above) so generateNotifications()'s own overdue/due-today/
// review logic never fires and silently adds extra rows on top of the
// ones each test seeds directly.
test.describe('Notifications behavior (Task 36)', () => {
  async function loginWithNotifications(page, notifications) {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN, EMPLOYEE_A], clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [],
        app_settings: [], projects: [], work_comments: [], work_checklist_items: [], work_activity: [],
        notifications: notifications, personal_todos: [], work_items: [CLIENT_ITEM],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  }

  test('the bell badge shows the unread count and stays hidden at zero', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'overdue_item', work_item_id: CLIENT_ITEM.id, title: 'Alpha VAT Return is overdue', is_read: false, created_at: '2026-08-19T00:00:00Z' },
      { id: 'n2', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: '1 work item is due today', is_read: false, created_at: '2026-08-20T00:00:00Z' },
      { id: 'n3', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: 'Already-read notification', is_read: true, created_at: '2026-08-18T00:00:00Z' },
    ]);
    await expect(page.locator('#notifBadge')).toHaveText('2');
    await expect(page.locator('#notifBadge')).toBeVisible();
  });

  test('with no unread notifications the badge is hidden entirely', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: 'Already read', is_read: true, created_at: '2026-08-18T00:00:00Z' },
    ]);
    await expect(page.locator('#notifBadge')).toBeHidden();
  });

  test('clicking a notification with a linked work item navigates there and closes the panel', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'overdue_item', work_item_id: CLIENT_ITEM.id, title: 'Alpha VAT Return is overdue', is_read: false, created_at: '2026-08-19T00:00:00Z' },
    ]);
    await page.getByRole('button', { name: 'Notifications (Client Work only)' }).click();
    await page.locator('.notif-row').filter({ hasText: 'Alpha VAT Return is overdue' }).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#work/' + CLIENT_ITEM.id);
    await expect(page.locator('#notifPanel')).toBeHidden();
  });

  test('a summary notification (no linked work item) is inert to click -- it never navigates anywhere', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: '1 work item is due today', is_read: false, created_at: '2026-08-19T00:00:00Z' },
    ]);
    await page.getByRole('button', { name: 'Notifications (Client Work only)' }).click();
    await page.locator('.notif-row').filter({ hasText: '1 work item is due today' }).click();
    expect(await page.evaluate(() => location.hash)).toBe('');
    await expect(page.locator('#notifPanel')).toBeVisible();
  });

  test('dismissing one notification marks only that one read, without navigating', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'overdue_item', work_item_id: CLIENT_ITEM.id, title: 'Alpha VAT Return is overdue', is_read: false, created_at: '2026-08-19T00:00:00Z' },
      { id: 'n2', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: '1 work item is due today', is_read: false, created_at: '2026-08-18T00:00:00Z' },
    ]);
    await page.getByRole('button', { name: 'Notifications (Client Work only)' }).click();
    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/notifications')) patches.push({ url: req.url(), body: req.postDataJSON() }); });
    await page.locator('.notif-row').filter({ hasText: 'Alpha VAT Return is overdue' }).getByTitle('Mark read').click();
    await expect.poll(() => patches.length).toBeGreaterThan(0);
    expect(patches[0].url).toContain('id=eq.n1');
    expect(patches[0].body).toEqual({ is_read: true });
    // Dismissing never routes anywhere -- it's a same-panel state change.
    expect(await page.evaluate(() => location.hash)).toBe('');
    await expect(page.locator('#notifPanel')).toBeVisible();
    await expect(page.locator('.notif-row').filter({ hasText: 'Alpha VAT Return is overdue' })).toHaveClass(/is-read/);
  });

  test('"Mark all read" issues one bulk update scoped to this user\'s unread notifications, not a single id', async ({ page }) => {
    await loginWithNotifications(page, [
      { id: 'n1', user_id: ADMIN.id, kind: 'overdue_item', work_item_id: CLIENT_ITEM.id, title: 'Alpha VAT Return is overdue', is_read: false, created_at: '2026-08-19T00:00:00Z' },
      { id: 'n2', user_id: ADMIN.id, kind: 'due_today_summary', work_item_id: null, title: '1 work item is due today', is_read: false, created_at: '2026-08-18T00:00:00Z' },
    ]);
    await page.getByRole('button', { name: 'Notifications (Client Work only)' }).click();
    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/notifications')) patches.push({ url: req.url(), body: req.postDataJSON() }); });
    await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect.poll(() => patches.length).toBeGreaterThan(0);
    expect(patches[0].url).toContain('user_id=eq.' + ADMIN.id);
    expect(patches[0].url).toContain('is_read=eq.false');
    // Not a single-id filter (?id=eq....) -- "user_id=eq." above legitimately
    // contains the substring "id=eq.", so this checks for a bare/leading
    // "id=eq." param specifically, not just the substring anywhere in the URL.
    expect(patches[0].url).not.toMatch(/[?&]id=eq\./);
    expect(patches[0].body).toEqual({ is_read: true });
  });
});
