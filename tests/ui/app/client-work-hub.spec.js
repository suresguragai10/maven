// Task 25: real, empirical browser evidence that Client Work, Review
// Queue, Deadlines and Clients feel like one coherent compliance
// workflow — a shared "hub strip" surfaces action-required items, the
// review queue, upcoming statutory deadlines and client context, with
// every stat a real link into another one of the four screens; a
// "View Deadlines" link on a client card carries a real client filter
// across the route boundary; and a "Statutory deadlines only" toggle on
// Deadlines never lets an internal-only target masquerade as a
// statutory one.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
const CLIENT_BETA = { id: 'c2', name: 'Beta Traders Pvt. Ltd.', is_active: true };

function inDays(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

const ITEM_OVERDUE = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'high',
  internal_due_date: '2020-01-01', external_due_date: null, period: 'Shrawan 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const ITEM_READY_FOR_REVIEW = {
  id: 'w2', title: 'Alpha Bookkeeping', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: ADMIN.id, status: 'ready_for_review', priority: 'normal',
  internal_due_date: inDays(20), external_due_date: null, period: 'Bhadra 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const ITEM_STATUTORY_SOON = {
  id: 'w3', title: 'Beta TDS Filing', work_scope: 'client', client_id: CLIENT_BETA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: inDays(1), external_due_date: inDays(3), period: 'Bhadra 2083',
  submission_required: true, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const ITEM_INTERNAL_ONLY_SOON = {
  id: 'w4', title: 'Beta Internal Working Papers', work_scope: 'client', client_id: CLIENT_BETA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: inDays(2), external_due_date: null, period: 'Bhadra 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAs(page, user, tables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA, CLIENT_BETA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [ITEM_OVERDUE, ITEM_READY_FOR_REVIEW, ITEM_STATUTORY_SOON, ITEM_INTERNAL_ONLY_SOON],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

test.describe('Client Work Hub (Task 25)', () => {
  test('admin/reviewer: the hub strip on All Work shows Action Required, Review Queue, Statutory Deadlines and Active Clients, each a real link', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'All Work' })).toBeVisible();

    const strip = page.locator('.hub-strip');
    await expect(strip).toBeVisible();
    await expect(strip.getByText('Action Required')).toBeVisible();
    await expect(strip.getByText('Review Queue')).toBeVisible();
    await expect(strip.getByText('Statutory Deadlines (7d)')).toBeVisible();
    await expect(strip.getByText('Active Clients')).toBeVisible();

    // Action Required = overdue + waiting + changes_required -> just the
    // one overdue item here.
    const actionStat = strip.locator('.hub-stat').filter({ hasText: 'Action Required' });
    await expect(actionStat.locator('.n')).toHaveText('1');
    // Review Queue = ready_for_review -> the one item.
    const reviewStat = strip.locator('.hub-stat').filter({ hasText: 'Review Queue' });
    await expect(reviewStat.locator('.n')).toHaveText('1');
    // Statutory Deadlines (7d) = external_due_date set and within 7 days
    // -> only the TDS filing (the internal-only item must NOT count).
    const statutoryStat = strip.locator('.hub-stat').filter({ hasText: 'Statutory Deadlines' });
    await expect(statutoryStat.locator('.n')).toHaveText('1');
    await expect(strip.locator('.hub-stat').filter({ hasText: 'Active Clients' }).locator('.n')).toHaveText('2');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('clicking a hub stat navigates into the matching tab within the Client Work group', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();

    await page.locator('.hub-stat').filter({ hasText: 'Review Queue' }).click();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Review Queue' })).toHaveAttribute('aria-selected', 'true');

    await page.locator('.hub-stat').filter({ hasText: 'Active Clients' }).click();
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('employee: the hub strip only shows the tabs they actually have (no Action Required / Review Queue)', async ({ page }) => {
    await loginAs(page, EMPLOYEE_A);
    // Employees don't get an All Work/Review Queue tab at all (Task 22
    // guard), so the Client Work group lands on Deadlines instead.
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    const strip = page.locator('.hub-strip');
    await expect(strip).toBeVisible();
    await expect(strip.getByText('Statutory Deadlines (7d)')).toBeVisible();
    await expect(strip.getByText('Active Clients')).toBeVisible();
    await expect(strip.getByText('Action Required')).not.toBeVisible();
    await expect(strip.getByText('Review Queue')).not.toBeVisible();
  });

  test('"View Deadlines" on a client card carries a real client filter into the Deadlines tab', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    await page.getByRole('tab', { name: 'Clients' }).click();
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

    const betaCard = page.locator('.client-card').filter({ hasText: CLIENT_BETA.name });
    await betaCard.getByRole('button', { name: 'View Deadlines' }).click();

    await expect(page.getByRole('heading', { name: 'Deadlines' })).toBeVisible();
    await expect(page.getByText('Beta TDS Filing')).toBeVisible();
    await expect(page.getByText('Beta Internal Working Papers')).toBeVisible();
    // The pre-filter is client-specific -- Alpha's work must not appear.
    await expect(page.getByText('Alpha VAT Return')).not.toBeVisible();
    await expect(page.getByText('Alpha Bookkeeping')).not.toBeVisible();
  });

  test('"Statutory deadlines only" hides internal-only targets and never bucket-mixes them with external dates', async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    await page.getByRole('tab', { name: 'Deadlines' }).click();
    await page.getByRole('combobox').first().selectOption('all');

    // Before the toggle: both the statutory and the internal-only item show.
    await expect(page.getByText('Beta TDS Filing')).toBeVisible();
    await expect(page.getByText('Beta Internal Working Papers')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Statutory deadlines only' }).check();

    await expect(page.getByText('Beta TDS Filing')).toBeVisible();
    await expect(page.getByText('Beta Internal Working Papers')).not.toBeVisible();
  });

  test('no Firm Work ever appears on any of the four Client Work hub screens', async ({ page }) => {
    const firmItem = {
      id: 'wf1', title: 'Firm-only item, must never appear here', work_scope: 'firm', firm_category: 'Administration',
      assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'normal', internal_due_date: inDays(1),
      description: null, project_id: null, next_action: null, blocker_reason: null,
      client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    await loginAs(page, ADMIN, { work_items: [ITEM_OVERDUE, ITEM_STATUTORY_SOON, firmItem] });
    for (const tabName of ['All Work', 'Review Queue', 'Deadlines', 'Clients']) {
      await page.getByRole('button', { name: 'Client Work', exact: true }).click();
      if (tabName !== 'All Work') await page.getByRole('tab', { name: tabName }).click();
      await expect(page.getByText('Firm-only item, must never appear here')).not.toBeVisible();
    }
  });
});
