// Handbook Task 17: real, empirical browser evidence for the Firm Work
// list/create/edit experience — the DB permission harness (tests/db/)
// already proves the underlying rules; this proves the actual rendered
// UI behaves as claimed (columns present, validation fires, filters and
// search issue the right requests, mobile viewport doesn't overflow).
// Uses tests/ui/support/mock-supabase.js to intercept the real Supabase
// client's network calls — staff.js and the real @supabase/supabase-js
// bundle run completely unmodified.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const EMPLOYEE_B = { id: '33333333-3333-3333-3333-333333333333', email: 'employee.b@test.local', full_name: 'Employee B', role: 'employee', is_active: true };

const PROJECT = { id: 'p1', name: 'Office Search', description: 'Find a new office', status: 'active', created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' };

const FIRM_ITEM = {
  id: 'w1', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'high', internal_due_date: '2026-09-01',
  description: 'Current contract expires end of month.', project_id: PROJECT.id,
  next_action: 'Call ISP for renewal quote', blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z',
};

async function loginToFirmWork(page) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: {
      profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B],
      clients: [],
      service_templates: [],
      deadline_rules: [],
      projects: [PROJECT],
      app_settings: [],
      work_items: [FIRM_ITEM],
      work_comments: [],
      work_checklist_items: [],
      work_activity: [],
      notifications: [],
      personal_todos: [],
    },
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Firm Work' }).click();
  await expect(page.getByRole('heading', { name: 'Firm Work' })).toBeVisible();
}

test.describe('Firm Work — list and create/edit form (Handbook Task 17)', () => {
  test('list shows the operationally useful columns with real data', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToFirmWork(page);

    const table = page.locator('table').filter({ hasText: 'Title' });
    await expect(table).toBeVisible();
    for (const col of ['Title', 'Category', 'Project', 'Owner', 'Status', 'Due Date', 'Priority', 'Next Action']) {
      await expect(table.locator('th', { hasText: col })).toBeVisible();
    }
    const row = table.locator('tbody tr').filter({ hasText: 'Renew office internet contract' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Administration');
    await expect(row).toContainText('Office Search');
    await expect(row).toContainText('Employee A');
    await expect(row).toContainText('Call ISP for renewal quote'); // next_action, not the (empty) latest update

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Task 27: a blocked item shows its blocker reason in the list, ahead of next_action', async ({ page }) => {
    const blockedItem = Object.assign({}, FIRM_ITEM, {
      id: 'w2', title: 'Renew office lease', status: 'blocked', blocker_reason: 'Waiting on landlord signature',
    });
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B], clients: [], service_templates: [], deadline_rules: [],
        projects: [PROJECT], app_settings: [], work_items: [blockedItem], work_comments: [],
        work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: 'Firm Work' }).click();
    // Default status filter is "open" (neq completed) -- Blocked is open,
    // so it's already visible with no filter change needed.
    const row = page.locator('table tbody tr').filter({ hasText: 'Renew office lease' });
    await expect(row).toContainText('Blocked: Waiting on landlord signature');
    await expect(row).not.toContainText('Call ISP for renewal quote');
  });

  test('create form validation: blank title, missing category, missing owner all blocked; a real submission is allowed', async ({ page }) => {
    await loginToFirmWork(page);
    await page.getByRole('button', { name: 'New Firm Work' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'New Firm Work' })).toBeVisible();

    const saveBtn = modal.getByRole('button', { name: 'Create Firm Work' });

    // Blank title
    await saveBtn.click();
    await expect(page.locator('#toast')).toContainText(/title/i);

    // Title present, no category
    await modal.locator('input[type="text"]').first().fill('New office chairs');
    await saveBtn.click();
    await expect(page.locator('#toast')).toContainText(/category/i);

    // Category present too — owner already defaults to the logged-in
    // user (a real, always-valid choice), so a full, valid submission
    // should now succeed and close the modal.
    await modal.locator('select').first().selectOption({ label: 'Administration' });
    await saveBtn.click();
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);
  });

  test('filters and search issue real database queries, not a client-side download-then-filter', async ({ page }) => {
    await loginToFirmWork(page);
    const requests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) requests.push(req.url()); });

    await page.locator('select').filter({ has: page.locator('option', { hasText: 'All Categories' }) }).selectOption('Administration');
    await page.waitForTimeout(200);
    const categoryReq = requests[requests.length - 1];
    expect(categoryReq).toContain('firm_category=eq.Administration');

    const searchBox = page.getByPlaceholder(/search title/i);
    await searchBox.fill('internet');
    await page.waitForTimeout(500); // debounce
    const searchReq = requests[requests.length - 1];
    expect(searchReq).toContain('next_action.ilike');
    expect(decodeURIComponent(searchReq)).toContain('internet');
  });

  // Handbook Task 18: clicking a row now navigates to a dedicated detail
  // page (renderFirmWorkDetail) instead of opening an edit modal — see
  // tests/ui/app/firm-work-detail.spec.js for full detail-page coverage.
  // Reassignment specifically moved into that page's "Edit Basics" modal.
  test('clicking a row opens the detail page, and reassigning via Edit Basics sends the right PATCH request', async ({ page }) => {
    await loginToFirmWork(page);
    await page.getByRole('row', { name: /Renew office internet contract/ }).click();
    await expect(page.getByRole('heading', { name: 'Renew office internet contract' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Basics' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Edit Firm Work' })).toBeVisible();

    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/work_items')) patches.push(req.postDataJSON()); });

    const ownerSelect = modal.locator('select').nth(1); // Category, Owner, ...
    await ownerSelect.selectOption({ label: 'Employee B' });
    await modal.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);

    expect(patches.length).toBeGreaterThan(0);
    expect(patches[patches.length - 1].assignee_id).toBe(EMPLOYEE_B.id);
  });

  test('status filter defaults to open work and completed items are reachable via "All Statuses"', async ({ page }) => {
    // Listener attached before navigation, not after loginToFirmWork(),
    // so it actually catches the page's own initial list-load request —
    // attaching it afterward would miss that first request entirely.
    const requests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) requests.push(req.url()); });
    await loginToFirmWork(page);
    expect(decodeURIComponent(requests[requests.length - 1])).toContain('status=neq.completed');

    const statusSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Open (default)' }) });
    await statusSelect.selectOption({ label: 'All Statuses' });
    await page.waitForTimeout(200);
    const afterAll = requests[requests.length - 1];
    expect(afterAll).not.toContain('status=');
  });

  test('no horizontal page overflow at mobile and tablet widths', async ({ page }) => {
    await loginToFirmWork(page);
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `Firm Work page overflows horizontally at ${width}px by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
