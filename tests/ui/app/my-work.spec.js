// Handbook Task 20: real, empirical browser evidence that My Work
// combines Client + Firm Work assigned to the logged-in user, labels
// every row unmistakably CLIENT/FIRM, offers the exact All/Client/Firm
// scope filter, keeps Client compliance urgency semantics untouched, and
// never lets an unassigned Firm Work item or a Personal To-Do leak in.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const EMPLOYEE_B = { id: '33333333-3333-3333-3333-333333333333', email: 'employee.b@test.local', full_name: 'Employee B', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

const CLIENT_ITEM_OVERDUE = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'high',
  internal_due_date: '2020-01-01', external_due_date: null, period: 'Shrawan 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const FIRM_ITEM_MINE = {
  id: 'w2', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'normal', internal_due_date: '2020-02-01',
  description: null, project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-02T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
};
const FIRM_ITEM_UNASSIGNED_TO_ME = {
  id: 'w3', title: "Colleague's Firm Work, not mine", work_scope: 'firm', firm_category: 'Marketing',
  assignee_id: EMPLOYEE_B.id, status: 'to_do', priority: 'normal', internal_due_date: null,
  description: null, project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-03T00:00:00Z', updated_at: '2026-08-03T00:00:00Z',
};

async function loginToMyWork(page, tables) {
  await installSupabaseMock(page, {
    user: EMPLOYEE_A,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [CLIENT_ITEM_OVERDUE, FIRM_ITEM_MINE, FIRM_ITEM_UNASSIGNED_TO_ME],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(EMPLOYEE_A.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'My Tasks' }).click();
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible();
}

test.describe('My Work — combined Client + Firm (Handbook Task 20)', () => {
  test('shows both Client and Firm Work assigned to me, each unmistakably labelled', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToMyWork(page);

    await expect(page.getByText('Alpha VAT Return')).toBeVisible();
    await expect(page.getByText('Renew office internet contract')).toBeVisible();

    const clientRow = page.locator('.task-row').filter({ hasText: 'Alpha VAT Return' });
    await expect(clientRow.locator('.badge-scope-client')).toHaveText('CLIENT');
    const firmRow = page.locator('.task-row').filter({ hasText: 'Renew office internet contract' });
    await expect(firmRow.locator('.badge-scope-firm')).toHaveText('FIRM');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the exact All/Client/Firm scope filter is offered and filters the list', async ({ page }) => {
    await loginToMyWork(page);

    const scopeGroup = page.getByRole('group', {
      name: 'Filter My Tasks by scope',
    });

    await expect(scopeGroup).toBeVisible();

    const scopeButtons = scopeGroup.getByRole('button');
    await expect(scopeButtons).toHaveCount(3);

    const allButton = scopeGroup.getByRole('button', {
      name: /^All \(\d+\)$/,
    });

    const clientButton = scopeGroup.getByRole('button', {
      name: /^Client \(\d+\)$/,
    });

    const firmButton = scopeGroup.getByRole('button', {
      name: /^Firm \(\d+\)$/,
    });

    await expect(allButton).toBeVisible();
    await expect(clientButton).toBeVisible();
    await expect(firmButton).toBeVisible();

    await expect(allButton).toHaveAttribute('aria-pressed', 'true');
    await expect(clientButton).toHaveAttribute('aria-pressed', 'false');
    await expect(firmButton).toHaveAttribute('aria-pressed', 'false');

    await clientButton.click();

    await expect(clientButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Alpha VAT Return')).toBeVisible();
    await expect(page.getByText('Renew office internet contract')).not.toBeVisible();

    await firmButton.click();

    await expect(firmButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Alpha VAT Return')).not.toBeVisible();
    await expect(page.getByText('Renew office internet contract')).toBeVisible();

    await allButton.click();

    await expect(allButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Alpha VAT Return')).toBeVisible();
    await expect(page.getByText('Renew office internet contract')).toBeVisible();
  });

  test('Firm Work assigned to someone else never appears in my My Work, and the request itself is scoped server-side', async ({ page }) => {
    const requests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) requests.push(req.url()); });
    await loginToMyWork(page);

    await expect(page.getByText("Colleague's Firm Work, not mine")).not.toBeVisible();
    // loadMyFirmWork() filters server-side (assignee_id=eq.<caller>), not
    // a client-side download of every Firm Work row — confirmed by
    // inspecting the actual outgoing request, not just the rendered DOM.
    const firmReq = requests.find((u) => decodeURIComponent(u).includes("work_scope=eq.firm"));
    expect(firmReq, `requests seen:\n${requests.join('\n')}`).toBeTruthy();
    expect(decodeURIComponent(firmReq)).toContain('assignee_id=eq.' + EMPLOYEE_A.id);
  });

  test('Client Work keeps its existing overdue/compliance styling; a missed Firm target is never styled the same way', async ({ page }) => {
    await loginToMyWork(page);
    const clientDue = page.locator('.task-row').filter({ hasText: 'Alpha VAT Return' }).locator('.due');
    await expect(clientDue).toHaveClass(/overdue/);

    // The Firm item's own due date (also in the past, 2020-02-01) must
    // NOT get the same red/overdue treatment -- Task 20's explicit "do
    // not style a missed Firm target as if it were a statutory filing
    // breach" instruction.
    const firmDue = page.locator('.task-row').filter({ hasText: 'Renew office internet contract' }).locator('.due');
    await expect(firmDue).not.toHaveClass(/overdue/);
  });

  test('Client Work groups (e.g. Overdue) render before the Firm Work section, in scope=All', async ({ page }) => {
    await loginToMyWork(page);
    const clientGroupHeading = page.locator('.task-group h3').filter({ hasText: 'Overdue' });
    const firmSectionHeading = page.getByRole('heading', { name: 'Firm Work', level: 2 });
    await expect(clientGroupHeading).toBeVisible();
    await expect(firmSectionHeading).toBeVisible();
    const clientBox = await clientGroupHeading.boundingBox();
    const firmBox = await firmSectionHeading.boundingBox();
    expect(clientBox.y).toBeLessThan(firmBox.y);
  });

  test('Personal To-Do items never appear in My Work', async ({ page }) => {
    await loginToMyWork(page, {
      personal_todos: [{ id: 't1', user_id: EMPLOYEE_A.id, text: 'Buy office snacks (private todo)', is_done: false, created_at: '2026-08-01T00:00:00Z' }],
    });
    await expect(page.getByText('Buy office snacks')).not.toBeVisible();

    // And the reverse: My To-Do stays a private, separate page unaffected by this task.
    await page.getByRole('button', { name: 'My To-Do' }).click();
    await expect(page.getByText('Buy office snacks (private todo)')).toBeVisible();
  });
});

