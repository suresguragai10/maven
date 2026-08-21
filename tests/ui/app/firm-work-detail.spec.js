// Handbook Task 18: real, empirical browser evidence for the Firm Work
// detail page (top summary, next action, blocker context, checklist,
// typed updates, activity history). This task's own TEST requirement is
// specific: "Two different teammates sequentially update the same Firm
// Work; verify current summary and history remain understandable" — the
// second test below does exactly that against the mocked Supabase layer,
// re-logging in as a different user between steps the same way two real
// teammates would be on two different sessions.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const EMPLOYEE_B = { id: '33333333-3333-3333-3333-333333333333', email: 'employee.b@test.local', full_name: 'Employee B', role: 'employee', is_active: true };

const PROJECT = { id: 'p1', name: 'Office Search', description: 'Find a new office', status: 'active', created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' };

function firmItem(overrides) {
  return Object.assign({
    id: 'w1', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
    assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'high', internal_due_date: '2026-09-01',
    description: 'Current contract expires end of month.', project_id: PROJECT.id,
    next_action: 'Call ISP for renewal quote', blocker_reason: null, follow_up_date: null,
    client_id: null, created_by: ADMIN.id, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z',
  }, overrides || {});
}

async function loginAndOpenDetail(page, user, item, extraTables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B],
      clients: [],
      service_templates: [],
      deadline_rules: [],
      projects: [PROJECT],
      app_settings: [],
      work_items: [item],
      work_comments: [],
      work_checklist_items: [],
      work_activity: [],
      notifications: [],
      personal_todos: [],
    }, extraTables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  // Same-document hash navigation (what gotoFirmWork() itself does) --
  // NOT page.goto(), which re-requests the page and can race the
  // in-flight initial render against a second one.
  await page.evaluate((id) => { location.hash = 'firmwork/' + id; }, item.id);
  await expect(page.getByRole('heading', { name: item.title })).toBeVisible();
}

test.describe('Firm Work detail page — async handoff (Handbook Task 18)', () => {
  test('top summary shows every field this task requires, and Last Updated reflects updated_at', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const item = firmItem();
    await loginAndOpenDetail(page, ADMIN, item);

    const card = page.locator('.card').first();
    await expect(card).toContainText('Administration'); // category
    await expect(card).toContainText('Office Search'); // project
    await expect(card).toContainText('Employee A'); // owner
    await expect(card).toContainText('High'); // priority
    await expect(card.getByText('Target Date')).toBeVisible();
    await expect(card.getByText('Last Updated')).toBeVisible();
    await expect(page.locator('.badge').first()).toContainText('In Progress');

    // Next Action is inline and prominent, not buried in a modal.
    const naInput = page.getByPlaceholder('e.g. Send follow-up email to landlord');
    await expect(naInput).toHaveValue('Call ISP for renewal quote');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('marking Blocked requires a reason, and blocker context + follow-up date save together', async ({ page }) => {
    const item = firmItem({ status: 'in_progress', blocker_reason: null });
    await loginAndOpenDetail(page, ADMIN, item);

    const statusSel = page.locator('select').first();
    await statusSel.selectOption('blocked');

    const blockerBox = page.locator('.action-box').filter({ hasText: 'Blocker Context' });
    await expect(blockerBox).toBeVisible();

    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/work_items')) patches.push(req.postDataJSON()); });

    // Too short — blocked internally, no PATCH.
    const saveBtn = blockerBox.getByRole('button', { name: /Save Blocker Context/ });
    await blockerBox.locator('textarea').fill('short');
    await saveBtn.click();
    await expect(page.locator('#toast')).toContainText(/short sentence/i);
    expect(patches.length).toBe(0);

    // Real reason + a follow-up date — should send status + blocker_reason + follow_up_date together.
    await blockerBox.locator('textarea').fill('Waiting on the landlord to confirm a viewing date.');
    await blockerBox.locator('input[type="date"]').fill('2026-09-10');
    await saveBtn.click();
    await expect.poll(() => patches.length).toBeGreaterThan(0);
    const last = patches[patches.length - 1];
    expect(last.status).toBe('blocked');
    expect(last.blocker_reason).toContain('landlord');
    expect(last.follow_up_date).toBe('2026-09-10');
  });

  test('posting a typed update and toggling a checklist item both work from the detail page', async ({ page }) => {
    const item = firmItem();
    await loginAndOpenDetail(page, ADMIN, item, {
      work_checklist_items: [{ id: 'c1', work_item_id: item.id, stage: 'preparation', title: 'Confirm final quote', is_done: false, sort_order: 0, is_required: true }],
    });

    const cb = page.locator('.checklist-item input[type="checkbox"]');
    await expect(cb).toBeVisible();
    const patchesChecklist = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/work_checklist_items')) patchesChecklist.push(req.postDataJSON()); });
    await cb.check();
    await expect.poll(() => patchesChecklist.length).toBeGreaterThan(0);
    expect(patchesChecklist[0].is_done).toBe(true);

    const updatesCard = page.locator('.card').filter({ hasText: 'Updates' });
    await updatesCard.locator('select').selectOption('handoff');
    await updatesCard.locator('textarea').fill('Handing this off to the evening shift.');

    const posts = [];
    page.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/rest/v1/work_comments')) posts.push(req.postDataJSON()); });
    await updatesCard.getByRole('button', { name: 'Post Update' }).click();
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    expect(posts[0].update_type).toBe('handoff');
    expect(posts[0].body).toContain('evening shift');
  });

  // Task 18's own TEST requirement: two different teammates sequentially
  // update the same Firm Work; verify current summary and history remain
  // understandable. Simulated as two genuinely SEPARATE sessions — each
  // teammate gets their own browser context (own storage/cookies, like
  // two different logged-in devices), not just a second login on the
  // same page (which could auto-restore the first session from
  // localStorage and silently not test what it claims to). State only
  // passes between them via the evolving fixture data, exactly like a
  // real asynchronous handoff — no shared in-memory state, no live call.
  test('two teammates update the same Firm Work sequentially — summary and history stay understandable', async ({ browser }) => {
    const item = firmItem({ next_action: 'Call ISP for renewal quote', status: 'in_progress' });

    // ---- Teammate 1 (Employee A), own session: posts a Progress update
    // and changes next_action. ----
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAndOpenDetail(pageA, EMPLOYEE_A, item);
    const naInput1 = pageA.getByPlaceholder('e.g. Send follow-up email to landlord');
    await naInput1.fill('Waiting on ISP call-back, expected tomorrow');
    await pageA.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(pageA.locator('#toast')).toContainText('Next action updated');

    const updatesCard1 = pageA.locator('.card').filter({ hasText: 'Updates' });
    await updatesCard1.locator('select').selectOption('progress');
    await updatesCard1.locator('textarea').fill('Called the ISP, they will call back tomorrow with a renewal quote.');
    await updatesCard1.getByRole('button', { name: 'Post Update' }).click();
    await expect(pageA.locator('.card').filter({ hasText: 'Updates' })).toContainText('Called the ISP');
    await contextA.close();

    // ---- Teammate 2 (Employee B), a completely separate session: opens
    // the SAME item cold and must be able to tell what happened and
    // what's next without having talked to Employee A. The evolving
    // `item` object (mutated above via next_action) plus the comment
    // Employee A posted are the only things carried forward — exactly
    // what a real handoff has to work from. ----
    item.next_action = 'Waiting on ISP call-back, expected tomorrow';
    const employeeAComment = {
      id: 'c-a1', work_item_id: item.id, author_id: EMPLOYEE_A.id,
      body: 'Called the ISP, they will call back tomorrow with a renewal quote.',
      update_type: 'progress', created_at: '2026-08-14T09:00:00Z',
    };
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAndOpenDetail(pageB, EMPLOYEE_B, item, { work_comments: [employeeAComment] });

    // Employee B can see exactly what happened and what's next, cold.
    const naInput2 = pageB.getByPlaceholder('e.g. Send follow-up email to landlord');
    await expect(naInput2).toHaveValue('Waiting on ISP call-back, expected tomorrow');
    const updatesCard2 = pageB.locator('.card').filter({ hasText: 'Updates' });
    await expect(updatesCard2).toContainText('Called the ISP');
    await expect(updatesCard2).toContainText('Progress');
    await expect(updatesCard2).toContainText('Employee A');

    // Employee B takes over: posts a Result update and closes the loop
    // by updating next_action again.
    await updatesCard2.locator('select').selectOption('result');
    await updatesCard2.locator('textarea').fill('ISP called back — renewal confirmed at the same rate.');
    const posts = [];
    pageB.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/rest/v1/work_comments')) posts.push(req.postDataJSON()); });
    await updatesCard2.getByRole('button', { name: 'Post Update' }).click();
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    expect(posts[0].author_id).toBe(EMPLOYEE_B.id);
    expect(posts[0].update_type).toBe('result');

    const naInput3 = pageB.getByPlaceholder('e.g. Send follow-up email to landlord');
    await naInput3.fill('Nothing further — renewal confirmed, close out.');
    await pageB.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(pageB.locator('#toast')).toContainText('Next action updated');
    await contextB.close();
  });

  test('Task 27: Status appears in the top-summary meta grid alongside the other at-a-glance fields', async ({ page }) => {
    const item = firmItem({ status: 'blocked', blocker_reason: 'Waiting on ISP callback' });
    await loginAndOpenDetail(page, ADMIN, item);
    const card = page.locator('.card').first();
    const statusMeta = card.locator('.meta-item').filter({ hasText: 'Status' });
    await expect(statusMeta).toContainText('Blocked');
  });

  test('Task 27: the top summary shows a "Latest Update" preview before the long Checklist/Activity history', async ({ page }) => {
    const item = firmItem();
    const comment = { id: 'cm1', work_item_id: item.id, author_id: EMPLOYEE_A.id, body: 'Called the ISP, waiting on a callback tomorrow.', update_type: 'progress', created_at: '2026-08-12T09:00:00Z' };
    await loginAndOpenDetail(page, ADMIN, item, { work_comments: [comment] });

    const topCard = page.locator('.card').first();
    const latestUpdateBox = topCard.locator('.action-box').filter({ hasText: 'Latest Update' });
    await expect(latestUpdateBox).toContainText('Called the ISP, waiting on a callback tomorrow.');
    await expect(latestUpdateBox).toContainText('Employee A');

    // It's positioned in the TOP summary card, i.e. before the Checklist
    // card further down the page -- the actual "next action before long
    // history" ordering this task asks for.
    const checklistCard = page.locator('.card').filter({ hasText: 'Checklist' });
    const latestBox = await latestUpdateBox.boundingBox();
    const checklistBox = await checklistCard.boundingBox();
    expect(latestBox.y).toBeLessThan(checklistBox.y);
  });

  test('Task 27: no Latest Update preview appears when there are no updates yet', async ({ page }) => {
    const item = firmItem();
    await loginAndOpenDetail(page, ADMIN, item);
    await expect(page.locator('.action-box').filter({ hasText: 'Latest Update' })).toHaveCount(0);
  });
});
