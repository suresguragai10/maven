// Task 26: real, empirical browser evidence for the Client Work Detail
// page. Client Work Detail had zero committed browser coverage before
// this task (unlike its Firm Work counterpart) — this file both proves
// Task 26's own additions (primary next action, checklist/waiting/
// submission state chips, and the Internal-vs-Statutory deadline tags)
// and gives this page a first real regression net.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const REVIEWER = { id: '55555555-5555-5555-5555-555555555555', email: 'reviewer@test.local', full_name: 'Reviewer One', role: 'reviewer', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
const TEMPLATE_VAT = { id: 't1', title: 'VAT Return', category: 'Tax', requires_review: true, requires_submission: true, requires_external_deadline: true, is_active: true };

function clientItem(overrides) {
  return Object.assign({
    id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: TEMPLATE_VAT.id,
    assignee_id: EMPLOYEE_A.id, reviewer_id: REVIEWER.id, status: 'in_progress', priority: 'high',
    internal_due_date: '2026-09-01', external_due_date: '2026-09-10', period: 'Bhadra 2083',
    submission_required: true, review_required: true, submission_status: 'not_ready',
    submission_reference: null, submission_note: null, submitted_at: null, submitted_by: null,
    waiting_reason: null, waiting_since: null, follow_up_date: null, waiting_requested_by: null,
    description: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  }, overrides || {});
}

async function loginAndOpenDetail(page, user, item, extraTables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, REVIEWER, EMPLOYEE_A],
      clients: [CLIENT_ALPHA],
      service_templates: [TEMPLATE_VAT],
      deadline_rules: [], app_settings: [], projects: [],
      work_items: [item],
      work_comments: [], work_checklist_items: [], work_waiting_items: [], work_activity: [],
      notifications: [], personal_todos: [],
    }, extraTables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  // Same-document hash navigation (what gotoWork() itself does), not
  // page.goto(), so it can't race the in-flight initial render.
  await page.evaluate((id) => { location.hash = 'work/' + id; }, item.id);
  await expect(page.getByRole('heading', { name: item.title })).toBeVisible();
}

test.describe('Client Work Detail (Task 26)', () => {
  test('the meta grid surfaces client, service, period, status, assignee, reviewer and both deadlines', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpenDetail(page, ADMIN, clientItem());

    const grid = page.locator('.meta-grid');
    await expect(grid).toContainText('Alpha Trading Pvt. Ltd.');
    await expect(grid).toContainText('VAT Return');
    await expect(grid).toContainText('Bhadra 2083');
    await expect(grid).toContainText('In Progress');
    await expect(grid).toContainText('Employee A');
    await expect(grid).toContainText('Reviewer One');
    await expect(grid).toContainText('Internal Target');
    await expect(grid).toContainText('External / Filing Deadline');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Internal vs External/Statutory deadlines are visually tagged, not just differently labeled', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem());
    const internalItem = page.locator('.meta-item').filter({ hasText: 'Internal Target' });
    const externalItem = page.locator('.meta-item').filter({ hasText: 'External / Filing Deadline' });
    await expect(internalItem.locator('.badge-internal')).toHaveText('INTERNAL');
    await expect(externalItem.locator('.badge-statutory')).toHaveText('STATUTORY');
    // The two tags must be visually distinct classes, never the same one.
    await expect(internalItem.locator('.badge-statutory')).toHaveCount(0);
    await expect(externalItem.locator('.badge-internal')).toHaveCount(0);
  });

  test('a work item with no external deadline set gets no STATUTORY tag at all', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem({ external_due_date: null, service_template_id: null }));
    const externalItem = page.locator('.meta-item').filter({ hasText: 'External / Filing Deadline' });
    await expect(externalItem).toContainText('—');
    await expect(externalItem.locator('.badge-statutory')).toHaveCount(0);
  });

  test('the primary next action callout reflects the item\'s actual status', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem({ status: 'changes_required' }));
    await expect(page.locator('.next-action-callout')).toHaveText('Fix');
  });

  test('an overdue item shows "Open" as the next action regardless of its underlying status', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem({ status: 'in_progress', internal_due_date: '2020-01-01' }));
    await expect(page.locator('.next-action-callout')).toHaveText('Open');
  });

  test('checklist and submission state chips appear with the right counts', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem(), {
      work_checklist_items: [
        { id: 'i1', work_item_id: 'w1', stage: 'preparation', title: 'Gather invoices', is_required: true, is_done: true, sort_order: 0 },
        { id: 'i2', work_item_id: 'w1', stage: 'preparation', title: 'Reconcile ledger', is_required: true, is_done: false, sort_order: 1 },
      ],
    });
    const chips = page.locator('.detail-chips');
    await expect(chips.locator('.detail-chip').filter({ hasText: 'Checklist' })).toContainText('1 / 2 done');
    await expect(chips.locator('.detail-chip').filter({ hasText: 'Submission' })).toContainText('Not Ready');
    // Not currently waiting on the client -- no waiting chip at all.
    await expect(chips.locator('.detail-chip').filter({ hasText: 'Waiting on Client' })).toHaveCount(0);
  });

  test('waiting-on-client state chip appears only while the item is actually waiting, with a real received count', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem({ status: 'waiting_for_client', waiting_since: '2026-08-15' }), {
      work_waiting_items: [
        { id: 'wi1', work_item_id: 'w1', title: 'Bank statement', is_received: true, sort_order: 0, requested_date: '2026-08-15', follow_up_date: null },
        { id: 'wi2', work_item_id: 'w1', title: 'Purchase invoices', is_received: false, sort_order: 1, requested_date: '2026-08-15', follow_up_date: null },
      ],
    });
    const waitChip = page.locator('.detail-chips .detail-chip').filter({ hasText: 'Waiting on Client' });
    await expect(waitChip).toBeVisible();
    await expect(waitChip).toContainText('1 / 2 received');
    // Same neutral-but-attention amber tone used elsewhere for "waiting,"
    // never the red compliance-breach color.
    await expect(waitChip).toHaveClass(/chip-amber/);
  });

  // Real bug found during a Work Desk audit: Mark Documents Received
  // discarded the result of its FIRST update (work_waiting_items) and
  // only checked the second (work_items) before showing success -- a
  // failure marking items received would silently report success while
  // the waiting items stayed unreceived.
  test('Mark Documents Received: a failure marking items received shows an error and never reports false success', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem({ status: 'waiting_for_client', waiting_since: '2026-08-15' }), {
      work_waiting_items: [
        { id: 'wi1', work_item_id: 'w1', title: 'Bank statement', is_received: false, sort_order: 0, requested_date: '2026-08-15', follow_up_date: null },
      ],
    });
    let workItemsPatchCalled = false;
    await page.route('**/rest/v1/work_waiting_items*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated database error' }) });
      } else {
        await route.continue();
      }
    });
    await page.route('**/rest/v1/work_items*', async (route) => {
      if (route.request().method() === 'PATCH') workItemsPatchCalled = true;
      await route.continue();
    });

    await page.getByRole('button', { name: 'Mark Documents Received' }).click();
    await expect(page.locator('#toast')).toContainText('Could not mark items received');
    await expect(page.locator('#toast')).not.toContainText('back in progress');
    expect(workItemsPatchCalled).toBe(false);
  });

  test('Activity stays a separate tab and Comments stay visible on Overview -- audit history is never removed, just kept out of the primary view', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem(), {
      work_comments: [{ id: 'cm1', work_item_id: 'w1', author_id: ADMIN.id, body: 'Please double-check the input VAT figure.', created_at: '2026-08-05T00:00:00Z' }],
      work_activity: [{ id: 'a1', work_item_id: 'w1', actor_id: ADMIN.id, action: 'status_changed', detail: 'To Do → In Progress', created_at: '2026-08-02T00:00:00Z', source: 'system' }],
    });
    // Comments are part of the primary Overview view (below the
    // high-value context, but not hidden behind another tab).
    await expect(page.getByText('Please double-check the input VAT figure.')).toBeVisible();
    // Activity is NOT visible until its own tab is opened.
    await expect(page.getByText('To Do → In Progress')).not.toBeVisible();
    await page.getByRole('button', { name: 'Activity' }).click();
    await expect(page.getByText('To Do → In Progress')).toBeVisible();
  });

  test('workflow gates stay DB-enforced: a plain employee on their own work cannot self-approve', async ({ page }) => {
    await loginAndOpenDetail(page, EMPLOYEE_A, clientItem({ status: 'ready_for_review' }));
    const statusSel = page.locator('.f').filter({ hasText: 'Status' }).locator('select');
    const optionValues = await statusSel.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    expect(optionValues).not.toContain('approved');
    expect(optionValues).not.toContain('completed');
  });

  // Real bug found during a full architecture audit: Edit Work showed
  // Assignee/Reviewer reassignment fields to a reviewer on their own
  // reviewed item, even though guard_work_item_update() explicitly
  // denies that exact action ("Only an admin can reassign or rescope
  // work") -- fails safe (the DB always blocked it) but showed a
  // control that would silently do nothing on save.
  test('Edit Work: reassignment fields are admin-only, even for the item\'s own reviewer', async ({ page }) => {
    await loginAndOpenDetail(page, REVIEWER, clientItem());
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Work' })).toBeVisible();
    await expect(page.getByLabel('Assignee', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Reviewer', { exact: true })).toHaveCount(0);
  });

  test('Edit Work: an admin does see the reassignment fields', async ({ page }) => {
    await loginAndOpenDetail(page, ADMIN, clientItem());
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Work' })).toBeVisible();
    await expect(page.getByLabel('Assignee', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Reviewer', { exact: true })).toBeVisible();
  });
});
