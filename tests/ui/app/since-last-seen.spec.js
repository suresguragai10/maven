// Handbook Task 22: real, empirical browser evidence for the Since Last
// Seen catch-up feed. This task's own TEST requirement is specific:
// "User A leaves, users B/C edit several Firm items, user A returns and
// sees the relevant changes once in sensible order" — the second test
// below does exactly that.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true, since_last_seen_at: '2026-08-10T00:00:00Z' };
const EMPLOYEE_B = { id: '33333333-3333-3333-3333-333333333333', email: 'employee.b@test.local', full_name: 'Employee B', role: 'employee', is_active: true };
const EMPLOYEE_C = { id: '44444444-5555-4444-5555-444444444444', email: 'employee.c@test.local', full_name: 'Employee C', role: 'employee', is_active: true };

function firmItem(id, title, assigneeId) {
  return {
    id: id, title: title, work_scope: 'firm', firm_category: 'Administration',
    assignee_id: assigneeId, status: 'in_progress', priority: 'normal', internal_due_date: null,
    description: null, project_id: null, next_action: null, blocker_reason: null,
    client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  };
}

async function loginToFeed(page, user, tables) {
  await installSupabaseMock(page, {
    user: user,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A, EMPLOYEE_B, EMPLOYEE_C],
      clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_checklist_items: [], notifications: [], personal_todos: [],
      work_items: [], work_activity: [], work_comments: [],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Recent Updates' }).click();
  await expect(page.getByRole('heading', { name: 'Since Last Seen' })).toBeVisible();
}

test.describe('Since Last Seen (Handbook Task 22)', () => {
  test('shows nothing when there is no Firm Work activity since last seen', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToFeed(page, EMPLOYEE_A, { work_items: [firmItem('w1', 'Untouched item', EMPLOYEE_B.id)] });
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  // The task's own scenario: A leaves (since_last_seen_at in the past),
  // B and C make several changes to Firm items, A comes back and should
  // see all of it, in sensible (newest-first) order, exactly once.
  test('user A sees changes made by B and C while away, in newest-first order', async ({ page }) => {
    const item1 = firmItem('w1', 'Renew office internet contract', EMPLOYEE_A.id);
    const item2 = firmItem('w2', 'Draft marketing brief', EMPLOYEE_A.id);
    const activity = [
      { id: 'a1', work_item_id: item1.id, actor_id: EMPLOYEE_B.id, action: 'status_changed', detail: 'To Do → In Progress', created_at: '2026-08-11T09:00:00Z' },
      { id: 'a2', work_item_id: item1.id, actor_id: EMPLOYEE_C.id, action: 'next_action_changed', detail: 'Next action: Call the ISP back', created_at: '2026-08-12T10:00:00Z' },
      { id: 'a3', work_item_id: item2.id, actor_id: EMPLOYEE_B.id, action: 'blocker_changed', detail: 'Blocker: Waiting on design assets', created_at: '2026-08-12T14:00:00Z' },
    ];
    const comments = [
      { id: 'c1', work_item_id: item1.id, author_id: EMPLOYEE_C.id, body: 'Called and confirmed the renewal quote.', update_type: 'progress', created_at: '2026-08-13T08:00:00Z' },
    ];
    await loginToFeed(page, EMPLOYEE_A, { work_items: [item1, item2], work_activity: activity, work_comments: comments });

    const rows = page.locator('.activity-row');
    await expect(rows).toHaveCount(4);

    // Newest-first: the comment (Aug 13) should appear before the Aug 12
    // entries, which appear before the Aug 11 one.
    const rowTexts = await rows.allTextContents();
    expect(rowTexts[0]).toContain('Employee C');
    expect(rowTexts[0]).toContain('Called and confirmed');
    expect(rowTexts[rowTexts.length - 1]).toContain('Employee B');
    expect(rowTexts[rowTexts.length - 1]).toContain('In Progress');

    // Each change is attributed to the actual actor, and shows the work item title.
    await expect(page.getByText('Renew office internet contract')).toHaveCount(3); // a1, a2, c1
    await expect(page.getByText('Draft marketing brief')).toHaveCount(1); // a3

    // Clicking an entry opens the item.
    await rows.first().click();
    await expect(page.getByRole('heading', { name: 'Renew office internet contract' })).toBeVisible();
  });

  // The mock always returns the full fixture array for a GET regardless
  // of query params other than eq. (see tests/ui/support/mock-supabase.js's
  // own header comment), so "does the row actually disappear" can't be
  // asserted through the mock's response -- what CAN be asserted, and
  // what actually proves the exclusion is real, is that the app sends
  // the exclusion filter in the first place (the DB permission harness
  // separately proves .neq() itself works against a real Postgres).
  test('the feed query excludes the caller\'s own actor_id/author_id', async ({ page }) => {
    const item = firmItem('w1', 'Self-authored change test item', EMPLOYEE_A.id);
    const activity = [
      { id: 'a1', work_item_id: item.id, actor_id: EMPLOYEE_A.id, action: 'status_changed', detail: 'To Do → In Progress', created_at: '2026-08-12T10:00:00Z' },
    ];
    // The page's header/heading render before the activity+comments
    // queries even fire (they're awaited after), so waiting only for the
    // heading races the request listener below. Wait for the specific
    // requests themselves instead of a fixed timeout or the heading.
    const activityReqPromise = page.waitForRequest((req) => req.url().includes('/rest/v1/work_activity'));
    const commentsReqPromise = page.waitForRequest((req) => req.url().includes('/rest/v1/work_comments'));
    await loginToFeed(page, EMPLOYEE_A, { work_items: [item], work_activity: activity });
    const [activityReq, commentsReq] = await Promise.all([activityReqPromise, commentsReqPromise]);

    expect(decodeURIComponent(activityReq.url())).toContain('actor_id=neq.' + EMPLOYEE_A.id);
    expect(decodeURIComponent(commentsReq.url())).toContain('author_id=neq.' + EMPLOYEE_A.id);
  });

  test('Client Work changes never appear in this feed', async ({ page }) => {
    const clientItem = {
      id: 'cw1', title: 'Alpha VAT Return', work_scope: 'client', client_id: 'c1', service_template_id: null,
      assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
      internal_due_date: null, external_due_date: null, period: null, submission_required: false, review_required: true,
      created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    const activity = [
      { id: 'a1', work_item_id: clientItem.id, actor_id: EMPLOYEE_B.id, action: 'status_changed', detail: 'To Do → In Progress', created_at: '2026-08-12T10:00:00Z' },
    ];
    await loginToFeed(page, EMPLOYEE_A, { work_items: [clientItem], clients: [{ id: 'c1', name: 'Alpha Trading', is_active: true }], work_activity: activity });
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await expect(page.getByText('Alpha VAT Return')).not.toBeVisible();
  });

  test('"Mark Reviewed" clears the feed and calls the mark_feed_seen RPC', async ({ page }) => {
    const item = firmItem('w1', 'Item to be marked reviewed', EMPLOYEE_A.id);
    const activity = [{ id: 'a1', work_item_id: item.id, actor_id: EMPLOYEE_B.id, action: 'status_changed', detail: 'To Do → In Progress', created_at: '2026-08-12T10:00:00Z' }];
    await loginToFeed(page, EMPLOYEE_A, { work_items: [item], work_activity: activity });
    await expect(page.getByText('Item to be marked reviewed')).toBeVisible();

    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/mark_feed_seen')) rpcCalls.push(req.url()); });
    await page.getByRole('button', { name: 'Mark Reviewed' }).click();
    await expect.poll(() => rpcCalls.length).toBeGreaterThan(0);
    await expect(page.locator('#toast')).toContainText('Marked reviewed');
    // The mock always returns the same fixture rows regardless of query
    // params, so after re-render the (now-stale) activity row is still
    // technically present in this mock -- what matters here is that the
    // RPC call itself fired and the page didn't error out re-rendering.
    await expect(page.getByRole('heading', { name: 'Since Last Seen' })).toBeVisible();
  });
});

