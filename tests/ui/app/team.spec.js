// Handbook Task 21: real, empirical browser evidence for the Team
// screen — multiple users' Client + Firm Work shown side by side, empty
// sections rendering as an explicit message (not disappearing), many
// items, completed-work filtering, mobile/tablet layout, and no
// productivity/ranking/presence content anywhere on the page.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const EMPLOYEE_B = { id: '33333333-3333-3333-3333-333333333333', email: 'employee.b@test.local', full_name: 'Employee B', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

function clientItem(id, title, assigneeId, status) {
  return {
    id: id, title: title, work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
    assignee_id: assigneeId, reviewer_id: null, status: status || 'in_progress', priority: 'normal',
    internal_due_date: '2026-09-01', external_due_date: null, period: null,
    submission_required: false, review_required: true,
    created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  };
}
function firmItem(id, title, assigneeId, status) {
  return {
    id: id, title: title, work_scope: 'firm', firm_category: 'Administration',
    assignee_id: assigneeId, status: status || 'in_progress', priority: 'normal', internal_due_date: '2026-09-01',
    description: null, project_id: null, next_action: null, blocker_reason: null,
    client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  };
}

async function loginToTeam(page, tables) {
  await installSupabaseMock(page, {
    user: ADMIN, // admin so RLS never limits what this test asserts is present
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Team Work', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
}

test.describe('Team screen (Handbook Task 21)', () => {
  test('shows multiple users, each with their own Client and Firm Work, unmistakably labelled', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToTeam(page, {
      work_items: [
        clientItem('w1', "Employee A's client item", EMPLOYEE_A.id),
        firmItem('w2', "Employee A's firm item", EMPLOYEE_A.id),
        clientItem('w3', "Employee B's client item", EMPLOYEE_B.id),
        firmItem('w4', "Employee B's firm item", EMPLOYEE_B.id),
      ],
    });

    const aCard = page.locator('.card').filter({ hasText: 'Employee A' });
    await expect(aCard.getByText("Employee A's client item")).toBeVisible();
    await expect(aCard.getByText("Employee A's firm item")).toBeVisible();
    await expect(aCard.locator('.badge-scope-client')).toHaveCount(1);
    await expect(aCard.locator('.badge-scope-firm')).toHaveCount(1);

    const bCard = page.locator('.card').filter({ hasText: 'Employee B' });
    await expect(bCard.getByText("Employee B's client item")).toBeVisible();
    await expect(bCard.getByText("Employee B's firm item")).toBeVisible();

    // Clicking a work item opens its details.
    await aCard.getByText("Employee A's firm item").click();
    await expect(page.getByRole('heading', { name: "Employee A's firm item" })).toBeVisible();

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a person with no work in a scope shows an explicit empty message, not a hidden section', async ({ page }) => {
    await loginToTeam(page, {
      work_items: [firmItem('w1', 'Only firm work exists', EMPLOYEE_A.id)],
    });
    const aCard = page.locator('.card').filter({ hasText: 'Employee A' });
    await expect(aCard.getByText('No open Client Work.')).toBeVisible();
    await expect(aCard.getByText('Only firm work exists')).toBeVisible();

    const bCard = page.locator('.card').filter({ hasText: 'Employee B' });
    await expect(bCard.getByText('No open Client Work.')).toBeVisible();
    await expect(bCard.getByText('No open Firm Work.')).toBeVisible();
  });

  test('many items per person render without error', async ({ page }) => {
    const many = [];
    for (let i = 0; i < 20; i++) many.push(firmItem('w' + i, 'Firm task #' + i, EMPLOYEE_A.id));
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToTeam(page, { work_items: many });
    const aCard = page.locator('.card').filter({ hasText: 'Employee A' });
    await expect(aCard.getByText('Firm Work (20)')).toBeVisible();
    await expect(aCard.getByText('Firm task #19')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('completed work is hidden by default and reachable via "Show completed"', async ({ page }) => {
    await loginToTeam(page, {
      work_items: [
        firmItem('w1', 'Open firm task', EMPLOYEE_A.id, 'in_progress'),
        firmItem('w2', 'Finished firm task', EMPLOYEE_A.id, 'completed'),
      ],
    });
    const aCard = page.locator('.card').filter({ hasText: 'Employee A' });
    await expect(aCard.getByText('Open firm task')).toBeVisible();
    await expect(aCard.getByText('Finished firm task')).not.toBeVisible();

    await page.getByLabel('Show completed').check();
    await expect(aCard.getByText('Finished firm task')).toBeVisible();
  });

  test('person and scope filters narrow the view', async ({ page }) => {
    await loginToTeam(page, {
      work_items: [
        clientItem('w1', "A's client item", EMPLOYEE_A.id),
        firmItem('w2', "A's firm item", EMPLOYEE_A.id),
        firmItem('w3', "B's firm item", EMPLOYEE_B.id),
      ],
    });
    const selects = page.locator('select');
    const personSel = selects.nth(0);
    const scopeSel = selects.nth(1);

    await personSel.selectOption({ label: 'Employee A' });
    await expect(page.getByText("B's firm item")).not.toBeVisible();
    await expect(page.getByText("A's firm item")).toBeVisible();

    await scopeSel.selectOption('firm');
    await expect(page.getByText("A's client item")).not.toBeVisible();
    await expect(page.getByText("A's firm item")).toBeVisible();
  });

  test('no horizontal overflow at mobile and tablet widths', async ({ page }) => {
    await loginToTeam(page, {
      work_items: [
        clientItem('w1', 'Alpha VAT Return with a fairly long descriptive title', EMPLOYEE_A.id),
        firmItem('w2', 'Renew office internet contract', EMPLOYEE_A.id),
      ],
    });
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `Team page overflows horizontally at ${width}px by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('no productivity score, ranking, hours-worked, or presence content anywhere on the page', async ({ page }) => {
    await loginToTeam(page, {
      work_items: [firmItem('w1', 'Firm task', EMPLOYEE_A.id)],
    });
    const bodyText = (await page.locator('#main').innerText()).toLowerCase();
    ['productivity', 'score', 'ranking', 'ranked', 'hours worked', 'online', 'offline', 'utilization', 'time zone', 'timezone'].forEach((term) => {
      expect(bodyText, `found forbidden term "${term}" on the Team page`).not.toContain(term);
    });
  });
});
