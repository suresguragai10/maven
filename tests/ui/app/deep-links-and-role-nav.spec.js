// Task 36: real, empirical browser evidence for two areas that had no
// dedicated coverage despite being load-bearing across the whole app --
// direct/shared links (routeFromHash's #work/, #client/, #search? and
// unknown-hash handling) and role-based navigation (what each of
// Employee/Reviewer/Admin actually sees in the sidebar and its
// page-level tabs, per NAV_GROUPS' own guard functions in staff.js).
// Individual screens' own specs already prove each destination works
// once you're on it; this file proves you can actually GET there by a
// direct link, and that the nav itself never over- or under-shows a
// destination for a given role.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const REVIEWER = { id: '55555555-5555-5555-5555-555555555555', email: 'reviewer@test.local', full_name: 'Reviewer One', role: 'reviewer', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
const CLIENT_ITEM = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: ADMIN.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: '2026-09-01', external_due_date: null, period: 'Bhadra 2083', submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAs(page, user, tables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, REVIEWER, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [CLIENT_ITEM],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

test.describe('Deep links (Task 36)', () => {
  test('#client/<id> lands directly on that client\'s own detail page', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.evaluate((id) => { location.hash = 'client/' + id; }, CLIENT_ALPHA.id);
    await expect(page.getByRole('heading', { name: CLIENT_ALPHA.name, level: 1 })).toBeVisible();
  });

  test('an unknown hash falls back to Today, not a blank or broken page', async ({ page }) => {
    const errors = [];
    await loginAs(page, ADMIN);
    page.on('pageerror', (err) => errors.push(err.message));
    await page.evaluate(() => { location.hash = 'this-view-does-not-exist'; });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('#work/<id-that-does-not-exist> shows a graceful not-found message with a working Back to Today link', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.evaluate(() => { location.hash = 'work/does-not-exist'; });
    await expect(page.getByText("That work item doesn't exist, or you don't have access to it.")).toBeVisible();
    await page.getByRole('button', { name: '← Back to Today' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  });

  test('#client/<id-that-does-not-exist> shows a graceful not-found message with a working Back to Clients link', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.evaluate(() => { location.hash = 'client/does-not-exist'; });
    await expect(page.getByText("That client doesn't exist, or you don't have access to it.")).toBeVisible();
    await page.getByRole('button', { name: '← Back to Clients' }).click();
    await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible();
  });

  test('#search?q=...&status=...&scope=... restores every filter into the Search form on direct navigation, not just the query text', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.evaluate(() => { location.hash = 'search?q=VAT&status=in_progress&scope=firm&waiting=1'; });
    await expect(page.getByRole('heading', { name: 'Search', level: 1 })).toBeVisible();
    await expect(page.getByPlaceholder('Search client, service, period, staff, status, reference number, or Firm Work…')).toHaveValue('VAT');
    // scope, status, client, service, assignee, reviewer selects in that
    // DOM order (see renderSearchPage) -- scope is first, status second.
    const selects = page.locator('.card select');
    await expect(selects.nth(0)).toHaveValue('firm');
    await expect(selects.nth(1)).toHaveValue('in_progress');
    await expect(page.getByRole('checkbox')).toBeChecked();
  });
});

test.describe('Role-based navigation (Task 36)', () => {
  test('Employee: no Admin destination at all, and Client Work only offers the tabs they can actually use', async ({ page }) => {
    await loginAs(page, EMPLOYEE_A);
    await expect(page.getByRole('button', { name: 'Admin', exact: true })).not.toBeVisible();
    await expect(page.locator('#sidebar')).not.toContainText('Website Content Admin');

    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    // Employees can't see All Work/Review Queue -- first visible tab
    // (and therefore the landing screen) is Deadlines instead.
    await expect(page.getByRole('heading', { name: 'Deadlines', level: 1 })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Client Work sections' });
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await expect(tabs.getByRole('tab', { name: 'Deadlines' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Clients' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'All Work' })).toHaveCount(0);
    await expect(tabs.getByRole('tab', { name: 'Review Queue' })).toHaveCount(0);
  });

  test('Employee: Reports collapses to Period Summary alone, with no tab bar at all for a single-tab group', async ({ page }) => {
    await loginAs(page, EMPLOYEE_A);
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Period Summary', level: 1 })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('Reviewer: gains All Work, Review Queue, Reports and Operations Overview over Employee, but still no Admin destination', async ({ page }) => {
    await loginAs(page, REVIEWER);
    await expect(page.getByRole('button', { name: 'Admin', exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    const clientTabs = page.getByRole('tablist', { name: 'Client Work sections' });
    await expect(clientTabs.getByRole('tab')).toHaveCount(4);
    for (const label of ['All Work', 'Review Queue', 'Deadlines', 'Clients']) {
      await expect(clientTabs.getByRole('tab', { name: label })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    const reportsTabs = page.getByRole('tablist', { name: 'Reports sections' });
    await expect(reportsTabs.getByRole('tab')).toHaveCount(3);
    for (const label of ['Reports', 'Operations Overview', 'Period Summary']) {
      await expect(reportsTabs.getByRole('tab', { name: label })).toBeVisible();
    }
  });

  test('Admin: Admin destination is present with Staff & Access / Templates / Settings, plus the external CMS link', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    const tabs = page.getByRole('tablist', { name: 'Admin sections' });
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    for (const label of ['Staff & Access', 'Templates', 'Settings']) {
      await expect(tabs.getByRole('tab', { name: label })).toBeVisible();
    }
    const cmsLink = page.getByRole('link', { name: 'Website Content Admin' });
    await expect(cmsLink).toBeVisible();
    await expect(cmsLink).toHaveAttribute('href', '/admin/');
  });
});
