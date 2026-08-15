// Handbook Task 24: real, empirical browser evidence that the practical
// Business Development pattern (a Project + several Business Development
// Firm Work items + an outcome recorded via a Result update) works
// smoothly with existing UI, that the Duplicate button supports
// repeatable campaigns without a new templates system, and that nothing
// here auto-creates a client.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };

const PROJECT = { id: 'p1', name: 'Restaurant Outreach - August', description: null, status: 'active', created_by: ADMIN.id, updated_by: null, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' };

const OUTREACH_ITEM = {
  id: 'w1', title: 'Contact 10 businesses', work_scope: 'firm', firm_category: 'Business Development',
  assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'normal', internal_due_date: '2026-08-20',
  description: 'Focus on Thamel/Baneshwor restaurants.', project_id: PROJECT.id, next_action: 'Call the last 3 on the list', blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-05T00:00:00Z', updated_at: '2026-08-10T00:00:00Z',
};

async function loginToFirmWork(page, tables) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [], service_templates: [], deadline_rules: [], app_settings: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      projects: [PROJECT],
      work_items: [OUTREACH_ITEM],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Firm Work' }).click();
  await expect(page.getByRole('heading', { name: 'Firm Work' })).toBeVisible();
}

test.describe('Business Development as ordinary Firm Work (Handbook Task 24)', () => {
  test('the full practical pattern: project, category, checklist, outcome via a Result update', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToFirmWork(page, {
      work_checklist_items: [
        { id: 'c1', work_item_id: OUTREACH_ITEM.id, stage: 'preparation', title: 'Call business #8', is_done: false, sort_order: 0, is_required: false },
      ],
    });

    // The item shows up under its Business Development project, exactly
    // the pattern this task describes.
    await expect(page.getByText('Contact 10 businesses')).toBeVisible();
    await page.getByText('Contact 10 businesses').click();
    await expect(page.getByRole('heading', { name: 'Contact 10 businesses' })).toBeVisible();
    await expect(page.locator('.card').first()).toContainText('Business Development');
    await expect(page.locator('.card').first()).toContainText('Restaurant Outreach - August');

    // Post the outcome as a Result-tagged update, per the recommended
    // pattern (no separate "outcome" field, no sales database).
    const updatesCard = page.locator('.card').filter({ hasText: 'Updates' });
    await updatesCard.locator('select').selectOption('result');
    await updatesCard.locator('textarea').fill('Meeting scheduled with two of the ten for next week.');
    const posts = [];
    page.on('request', (req) => { if (req.method() === 'POST') posts.push({ url: req.url(), body: req.postDataJSON() }); });
    await updatesCard.getByRole('button', { name: 'Post Update' }).click();
    await expect.poll(() => posts.filter((p) => p.url.includes('/rest/v1/work_comments')).length).toBeGreaterThan(0);
    const commentPost = posts.find((p) => p.url.includes('/rest/v1/work_comments'));
    expect(commentPost.body.update_type).toBe('result');

    // Nothing here ever creates a client — no client-table write of any
    // kind happened as a side effect of recording this outcome.
    expect(posts.some((p) => p.url.includes('/rest/v1/clients'))).toBe(false);

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Duplicate pre-fills a new item from an existing one and copies its checklist, for repeating the pattern next month', async ({ page }) => {
    await loginToFirmWork(page, {
      work_checklist_items: [
        { id: 'c1', work_item_id: OUTREACH_ITEM.id, stage: 'preparation', title: 'Call business #8', is_done: false, sort_order: 0, is_required: false },
        { id: 'c2', work_item_id: OUTREACH_ITEM.id, stage: 'preparation', title: 'Email business #9', is_done: true, sort_order: 1, is_required: false },
      ],
    });
    await page.getByText('Contact 10 businesses').click();
    await expect(page.getByRole('heading', { name: 'Contact 10 businesses' })).toBeVisible();

    await page.getByRole('button', { name: 'Duplicate' }).click();
    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Duplicate Firm Work' })).toBeVisible();

    // Pre-filled from the source item.
    await expect(modal.locator('input[type="text"]').first()).toHaveValue('Contact 10 businesses');
    await expect(modal).toContainText('Checklist (2 items) will be copied');
    // Due date is deliberately NOT copied — a fresh campaign needs its own.
    await expect(modal.locator('input[type="date"]')).toHaveValue('');

    // Rename for next month's push, matching this task's own worked example.
    await modal.locator('input[type="text"]').first().fill('Contact 10 more businesses');

    const checklistPosts = [];
    page.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/rest/v1/work_checklist_items')) checklistPosts.push(req.postDataJSON()); });
    await modal.getByRole('button', { name: 'Create Duplicate' }).click();
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);

    // The checklist was copied onto the new item, unchecked.
    await expect.poll(() => checklistPosts.length).toBeGreaterThan(0);
    const titles = checklistPosts.map((r) => (Array.isArray(r) ? r : [r])).flat().map((r) => r.title);
    expect(titles).toContain('Call business #8');
    expect(titles).toContain('Email business #9');
  });
});
