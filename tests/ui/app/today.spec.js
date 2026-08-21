// Task 23: real, empirical browser evidence for the Today dashboard —
// Client Work compliance urgency (overdue/waiting/changes required) still
// renders with its existing red-accented attention styling; a new,
// clearly-separated Firm Work "Next Actions" section (blocked + targets
// due this week) renders with the gold FIRM badge and never borrows that
// red/urgent styling; and a compact attendance punch in/out status/action
// sits at the top.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

function nepalTodayStr() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = {}; parts.forEach((x) => { if (x.type !== 'literal') map[x.type] = x.value; });
  return `${map.year}-${map.month}-${map.day}`;
}

const OVERDUE_CLIENT_ITEM = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'high',
  internal_due_date: '2020-01-01', external_due_date: null, period: 'Shrawan 2083',
  submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const FIRM_BLOCKED_ITEM = {
  id: 'w2', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'blocked', priority: 'normal', internal_due_date: null,
  description: null, project_id: null, next_action: null, blocker_reason: 'Waiting on ISP callback',
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-02T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
};
const FIRM_APPROACHING_ITEM = {
  id: 'w3', title: 'Prepare team offsite agenda', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: EMPLOYEE_A.id, status: 'in_progress', priority: 'normal', internal_due_date: '2020-01-01',
  description: null, project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-03T00:00:00Z', updated_at: '2026-08-03T00:00:00Z',
};

async function loginToToday(page, tables) {
  await installSupabaseMock(page, {
    user: EMPLOYEE_A,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      attendance_entries: [], work_items: [],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(EMPLOYEE_A.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

test.describe('Today dashboard (Task 23)', () => {
  test('Client compliance urgency (overdue) still renders in Needs Your Attention with its existing red styling', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginToToday(page, { work_items: [OVERDUE_CLIENT_ITEM] });

    await expect(page.getByText('Needs Your Attention')).toBeVisible();
    const row = page.locator('.attention-row').filter({ hasText: 'Alpha VAT Return' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('OVERDUE');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Firm Work Next Actions is clearly separated, tagged FIRM, and never uses the compliance red/attention-row styling', async ({ page }) => {
    await loginToToday(page, { work_items: [FIRM_BLOCKED_ITEM, FIRM_APPROACHING_ITEM] });

    const heading = page.locator('.section-h-firm');
    await expect(heading).toContainText('Firm Work — Next Actions');
    await expect(heading.locator('.badge')).toHaveText('FIRM');

    await expect(page.getByText('Blocked', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Approaching Targets')).toBeVisible();

    const blockedRow = page.locator('.task-row').filter({ hasText: 'Renew office internet contract' });
    const approachingRow = page.locator('.task-row').filter({ hasText: 'Prepare team offsite agenda' });
    await expect(blockedRow).toBeVisible();
    await expect(approachingRow).toBeVisible();

    // The key product rule: a missed/blocked Firm target is never styled
    // as a statutory breach the way an overdue Client item is.
    await expect(blockedRow).not.toHaveClass(/attention-row/);
    await expect(approachingRow).not.toHaveClass(/attention-row/);
    await expect(page.locator('.attention-row')).toHaveCount(0);
  });

  test('attendance bar: not punched in yet shows a working Punch In action', async ({ page }) => {
    await loginToToday(page);
    const bar = page.locator('.today-attendance-bar');
    await expect(bar).toContainText('Not punched in yet');
    const punchInBtn = bar.getByRole('button', { name: 'Punch In' });
    await expect(punchInBtn).toBeVisible();

    const rpcReq = page.waitForRequest((req) => req.url().includes('/rest/v1/rpc/attendance_punch_in') && req.method() === 'POST');
    await punchInBtn.click();
    await rpcReq;
    await expect(page.getByText('Punched in.')).toBeVisible();
  });

  test('attendance bar: already punched in today shows the open state with a Punch Out action', async ({ page }) => {
    const today = nepalTodayStr();
    await loginToToday(page, {
      attendance_entries: [{ id: 'a1', user_id: EMPLOYEE_A.id, work_date: today, punched_in_at: new Date().toISOString(), punched_out_at: null }],
    });
    const bar = page.locator('.today-attendance-bar');
    await expect(bar).toContainText('currently open');
    await expect(bar.getByRole('button', { name: 'Punch Out' })).toBeVisible();
  });

  test('attendance bar: a completed day shows a Completed pill, no punch button', async ({ page }) => {
    const today = nepalTodayStr();
    const inAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const outAt = new Date().toISOString();
    await loginToToday(page, {
      attendance_entries: [{ id: 'a1', user_id: EMPLOYEE_A.id, work_date: today, punched_in_at: inAt, punched_out_at: outAt }],
    });
    const bar = page.locator('.today-attendance-bar');
    await expect(bar.locator('.attendance-status-pill.complete')).toHaveText('Completed');
    await expect(bar.getByRole('button')).toHaveCount(0);
  });

  test('the empty-state message only shows when Client and Firm sections are both empty', async ({ page }) => {
    await loginToToday(page, { work_items: [] });
    await expect(page.getByText('Nothing needs your attention right now.')).toBeVisible();
  });

  test('no decorative Firm metric is added to the top stat strip — it stays Client-compliance-only', async ({ page }) => {
    await loginToToday(page, { work_items: [OVERDUE_CLIENT_ITEM, FIRM_BLOCKED_ITEM] });
    const strip = page.locator('.today-strip');
    for (const label of ['Overdue', 'Due Today', 'Waiting']) {
      await expect(strip.getByText(label)).toBeVisible();
    }
    await expect(strip).not.toContainText('Firm');
    await expect(strip).not.toContainText('Blocked');
  });
});
