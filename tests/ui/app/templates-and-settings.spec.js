// Task 34: real, empirical browser evidence for Templates, the governed
// Deadline Rule system, Auto-Generate Periods, and Workflow Settings --
// that the page clearly distinguishes the three systems, that a
// statutory deadline can never be entered as a bare guessed number (only
// via the sourced/verified add_deadline_rule() RPC), that a rule/setting/
// template edit is client-side reassured as never rewriting already-
// generated work, and that Settings' own save only ever touches
// app_settings, never work_items.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };

const TEMPLATE_NO_RULE = {
  id: 't1', title: 'VAT Return', category: 'Tax', description: null, recurrence: 'monthly',
  is_active: true, requires_submission: true, requires_review: true,
  default_assignee_id: null, default_reviewer_id: null,
  requires_external_deadline: true, internal_offset_days: 3,
};
const TEMPLATE_WITH_RULE = {
  id: 't2', title: 'TDS Filing', category: 'Tax', description: null, recurrence: 'monthly',
  is_active: true, requires_submission: true, requires_review: true,
  default_assignee_id: null, default_reviewer_id: null,
  requires_external_deadline: true, internal_offset_days: 3,
};
const ACTIVE_RULE = {
  id: 'r1', service_template_id: TEMPLATE_WITH_RULE.id, financial_year_label: 'FY 2082/83 onwards',
  effective_from: null, effective_to: null, filing_deadline_day: 25,
  source_title: 'Income Tax Act 2058, Finance Act 2082 amendment', source_url: null, source_reference: null, source_page_section: null,
  verified_date: '2026-08-01', verified_by: ADMIN.id, status: 'active', superseded_by: null, created_at: '2026-08-01T00:00:00Z',
};
const SUPERSEDED_RULE = {
  id: 'r0', service_template_id: TEMPLATE_WITH_RULE.id, financial_year_label: 'FY 2081/82',
  effective_from: null, effective_to: null, filing_deadline_day: 20,
  source_title: 'Old Finance Act notice', source_url: null, source_reference: null, source_page_section: null,
  verified_date: '2025-08-01', verified_by: ADMIN.id, status: 'superseded', superseded_by: ACTIVE_RULE.id, created_at: '2025-08-01T00:00:00Z',
};

async function loginAndOpenTemplates(page, tables) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: Object.assign({
      profiles: [ADMIN],
      clients: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [], service_templates: [], service_template_items: [],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
}

test.describe('Templates + Deadline Rules (Task 34)', () => {
  test('the intro clearly distinguishes Templates, governed Deadline Rules, and Workflow Settings as three separate systems', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_NO_RULE] });
    await expect(page.getByText('governed separately, per service, via "Manage Deadline Rule"')).toBeVisible();
    await expect(page.getByText('Workflow Settings')).toBeVisible();
    await expect(page.getByText('never rewrites work already generated')).toBeVisible();
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a service requiring a statutory deadline with no rule yet shows an explicit warning, never a guessed date', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_NO_RULE] });
    const card = page.locator('.card').filter({ hasText: 'VAT Return' });
    await expect(card.getByText('No verified deadline rule yet')).toBeVisible();
  });

  test('a service with an active rule shows its source citation and verifier, plus superseded history', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_WITH_RULE], deadline_rules: [SUPERSEDED_RULE, ACTIVE_RULE] });
    const card = page.locator('.card').filter({ hasText: 'TDS Filing' });
    await expect(card).toContainText('Income Tax Act 2058, Finance Act 2082 amendment');
    await expect(card).toContainText('Admin User');

    await card.getByRole('button', { name: 'Manage Deadline Rule' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal).toContainText('Superseded');
    await expect(modal).toContainText('Old Finance Act notice');
    await expect(modal).toContainText('Active');
  });

  test('saving a new deadline rule requires a source title and a verified date -- neither can be skipped', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_NO_RULE] });
    const card = page.locator('.card').filter({ hasText: 'VAT Return' });
    await card.getByRole('button', { name: 'Manage Deadline Rule' }).click();
    const modal = page.locator('#modalCard');

    await modal.locator('.f').filter({ hasText: 'Financial Year' }).locator('input').fill('FY 2082/83 onwards');
    await modal.locator('.f').filter({ hasText: 'Filing Deadline' }).locator('input').fill('25');
    // Source Title left blank on purpose.

    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/add_deadline_rule')) rpcCalls.push(req.postDataJSON()); });
    await modal.getByRole('button', { name: 'Save Rule' }).click();
    await expect(page.locator('#toast')).toContainText('source title is required');
    expect(rpcCalls).toEqual([]);

    await modal.locator('.f').filter({ hasText: 'Source Title' }).locator('input').fill('Income Tax Act 2058');
    await modal.getByRole('button', { name: 'Save Rule' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
    expect(rpcCalls[0].p_source_title).toBe('Income Tax Act 2058');
    expect(rpcCalls[0].p_service_template_id).toBe(TEMPLATE_NO_RULE.id);
    expect(rpcCalls[0].p_verified_date).toBeTruthy();
  });

  test('the deadline rule form explicitly warns never to guess, and reassures generated work is not rewritten', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_NO_RULE] });
    const card = page.locator('.card').filter({ hasText: 'VAT Return' });
    await card.getByRole('button', { name: 'Manage Deadline Rule' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal).toContainText('DO NOT guess this from memory');
    await expect(modal).toContainText('work items already generated keep the filing deadline they were created with');
  });

  test('DO NOT: a template\'s Edit form has no bare "day of month" input -- the statutory day is only ever set via the governed rule form', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [TEMPLATE_NO_RULE] });
    const card = page.locator('.card').filter({ hasText: 'VAT Return' });
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    const modal = page.locator('#modalCard');
    // The deadline rule form's own "day of month" field is the ONLY place
    // that phrase appears anywhere in this app -- confirming it's absent
    // here confirms Edit Template has no bare-number deadline entry.
    await expect(modal.getByText('day of month')).toHaveCount(0);
    await expect(modal.getByText('govern it separately via "Manage Deadline Rule"')).toBeVisible();
  });

  test('Auto-Generate Periods reassures that changing a period never rewrites already-generated work, and rejects a partial (label without both dates) entry', async ({ page }) => {
    await loginAndOpenTemplates(page);
    await expect(page.getByText('never duplicated or overwritten')).toBeVisible();

    const periodCard = page.locator('div').filter({ hasText: 'Current Monthly Period' }).first();
    const labelInput = periodCard.locator('.f').filter({ hasText: 'Current Monthly Period' }).locator('input');
    await labelInput.fill('Shrawan 2083');
    // Both date fields left blank -- should be rejected client-side.
    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/app_settings')) patches.push(req.postDataJSON()); });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('#toast')).toContainText('Set a label and both dates');
    expect(patches).toEqual([]);
  });
});

test.describe('Settings (Task 34)', () => {
  async function loginAndOpenSettings(page, tables) {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: Object.assign({
        profiles: [ADMIN],
        clients: [], deadline_rules: [], app_settings: [], projects: [],
        work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
        work_items: [], service_templates: [], service_template_items: [],
      }, tables || {}),
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  }

  test('distinguishes itself from the governed deadline rule system, and states it never rewrites existing work', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpenSettings(page);
    await expect(page.getByText('never rewrites existing work')).toBeVisible();
    await expect(page.getByText('never a statutory deadline')).toBeVisible();
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('saving Settings only ever touches app_settings -- never a PATCH to work_items', async ({ page }) => {
    await loginAndOpenSettings(page);
    const requests = [];
    page.on('request', (req) => { if (req.method() !== 'GET') requests.push({ method: req.method(), url: req.url() }); });
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.locator('#toast')).toContainText('Settings saved');
    expect(requests.some((r) => r.url.includes('/rest/v1/app_settings'))).toBe(true);
    expect(requests.some((r) => r.url.includes('/rest/v1/work_items'))).toBe(false);
  });

  test('rejects a non-integer or negative threshold before saving anything', async ({ page }) => {
    await loginAndOpenSettings(page);
    const numberInput = page.locator('.card input[type="number"]').first();
    await numberInput.fill('-5');
    const requests = [];
    page.on('request', (req) => { if (req.method() !== 'GET') requests.push(req.url()); });
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.locator('#toast')).toContainText('whole number, 0 or greater');
    expect(requests.some((u) => u.includes('/rest/v1/app_settings'))).toBe(false);
  });

  // Real bug found during a Work Desk audit: Create Template never
  // disabled itself during the save, unlike every sibling create/save
  // flow in the app (including this exact modal's own Edit Template
  // counterpart) -- a fast double-click could create two duplicate
  // templates, each with its own copy of the checklist.
  test('New Template: Create Template disables itself during save, so a double-click can never create two templates', async ({ page }) => {
    await loginAndOpenTemplates(page, { service_templates: [] });
    await page.getByRole('button', { name: 'New Template' }).click();
    await expect(page.getByRole('heading', { name: 'New Template' })).toBeVisible();
    await page.locator('.f').filter({ hasText: 'Title' }).locator('input').fill('Bookkeeping Monthly');

    let insertCount = 0;
    await page.route('**/rest/v1/service_templates*', async (route) => {
      if (route.request().method() === 'POST') {
        insertCount++;
        await new Promise((resolve) => setTimeout(resolve, 300)); // simulate a slow save
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'new-t1', title: 'Bookkeeping Monthly' }) });
      } else {
        await route.continue();
      }
    });

    const createBtn = page.getByRole('button', { name: 'Create Template' });
    await createBtn.click();
    await expect(createBtn).toBeDisabled();
    // A second click while the first save is still in flight must be a no-op.
    await createBtn.click({ force: true });
    await expect(page.getByText('Template created.')).toBeVisible();
    expect(insertCount).toBe(1);
  });
});
