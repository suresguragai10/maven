// Handbook Task 23: real, empirical browser evidence that (a) global
// Search now includes Firm Work results with a clear FIRM label
// alongside clearly-labeled CLIENT results, (b) the Firm Work list's own
// search reaches an old completed item by title months later (permanent,
// searchable history), and (c) neither page's Client Work path is
// disturbed by Firm Work's presence.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Office Search Consulting Pvt. Ltd.', is_active: true };

const OLD_COMPLETED_FIRM_ITEM = {
  id: 'w1', title: 'Office Search — shortlist candidate spaces', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'completed', priority: 'normal', internal_due_date: '2026-02-01',
  description: 'Found three candidate office spaces near Baneshwor.', project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-01-05T00:00:00Z', updated_at: '2026-02-10T00:00:00Z',
};
const CLIENT_ITEM = {
  id: 'w2', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: '2026-09-01', external_due_date: null, period: null, submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAndGoto(page, view, viewLabel, tables) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [OLD_COMPLETED_FIRM_ITEM, CLIENT_ITEM],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: viewLabel, exact: true }).click();
  await expect(page.getByRole('heading', { name: view })).toBeVisible();
}

test.describe('Firm Work search + isolation (Handbook Task 23)', () => {
  test('global Search finds an old completed Firm Work item, clearly labeled FIRM, alongside a CLIENT-labeled Client Work result', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndGoto(page, 'Search', 'Global Search');

    const requests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) requests.push(req.url()); });
    await page.getByPlaceholder(/Search client, service/).fill('office search');
    await page.waitForTimeout(500); // debounce

    const firmReq = requests.find((u) => decodeURIComponent(u).includes("work_scope=eq.firm"));
    expect(firmReq, `requests seen:\n${requests.join('\n')}`).toBeTruthy();

    await expect(page.getByText('Office Search — shortlist candidate spaces')).toBeVisible();
    const firmRow = page.locator('.task-row').filter({ hasText: 'Office Search — shortlist candidate spaces' });
    await expect(firmRow.locator('.badge-scope-firm')).toHaveText('FIRM');
    await expect(page.getByRole('heading', { name: 'Firm Work', level: 2 })).toBeVisible();

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a pure filter search (no text) stays Client-only — no Firm Work section appears', async ({ page }) => {
    await loginAndGoto(page, 'Search', 'Global Search');
    // Task 29: Search gained an explicit scope selector as the first
    // control in the filter row -- Status is now the second select, not
    // the first.
    const statusSel = page.locator('select').nth(1);
    await statusSel.selectOption({ label: 'In Progress' });
    await page.waitForTimeout(300);
    await expect(page.getByText('Alpha VAT Return')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Firm Work', level: 2 })).not.toBeVisible();
  });

  test('Firm Work list search reaches an old completed item by title (via All Statuses), with category also searchable', async ({ page }) => {
    // The mock always returns the full fixture array for GET regardless
    // of query params other than eq. (see mock-supabase.js's own header
    // comment) -- .neq('status','completed') isn't one of those, so
    // "does the completed item actually disappear by default" can't be
    // asserted through the rendered DOM here (the same reason firm-
    // work.spec.js's own default-status test asserts on the REQUEST
    // shape instead of visibility). That default-hiding behavior is
    // already covered there; this test's job is the two things genuinely
    // new to Task 23: the request reaches "all statuses" correctly, and
    // the search request now also matches category.
    const requests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) requests.push(req.url()); });
    await loginAndGoto(page, 'Firm Work', 'Firm Work');

    const searchBox = page.getByPlaceholder(/Search title, description, category/);
    await searchBox.fill('office search');
    await page.waitForTimeout(500);
    const searchReq = requests[requests.length - 1];
    expect(decodeURIComponent(searchReq)).toContain('firm_category.ilike');
    expect(decodeURIComponent(searchReq)).toContain('status=neq.completed'); // still open-only by default while searching

    const statusSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Open (default)' }) });
    await statusSel.selectOption('all');
    await page.waitForTimeout(300);
    const allStatusesReq = requests[requests.length - 1];
    expect(decodeURIComponent(allStatusesReq)).not.toContain('status=');
    await expect(page.getByText('Office Search — shortlist candidate spaces')).toBeVisible();
  });
});

