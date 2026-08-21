// Task 32: real, empirical browser evidence for Staff & Access --
// explicit Active/Inactive status pills, self-action guards, Edit
// Profile, the existing open-work reassignment warning on deactivation,
// and the new reviewer-reassignment warning on a Reviewer/Admin ->
// Employee role downgrade. Also confirms account creation never touches
// the Auth Admin API from the browser directly -- Create New Staff calls
// the server-side create-staff-account Edge Function instead (see
// supabase/functions/create-staff-account/index.ts), and the page still
// documents the Supabase Dashboard as a fallback if that function isn't
// deployed yet.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true, designation: 'Managing Partner' };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true, designation: 'Associate' };
const REVIEWER_B = { id: '33333333-3333-3333-3333-333333333333', email: 'reviewer.b@test.local', full_name: 'Reviewer B', role: 'reviewer', is_active: true, designation: 'Senior Associate' };
const INACTIVE_C = { id: '44444444-4444-4444-4444-444444444444', email: 'former.c@test.local', full_name: 'Former C', role: 'employee', is_active: false, designation: 'Associate' };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };

async function loginAndOpenStaff(page, tables) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: Object.assign({
      profiles: [ADMIN, EMPLOYEE_A, REVIEWER_B, INACTIVE_C],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [], attendance_entries: [], attendance_corrections: [],
    }, tables || {}),
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.getByRole('tab', { name: 'Staff & Access' }).click();
  await expect(page.getByRole('heading', { name: 'Staff & Access' })).toBeVisible();
}

function rowFor(page, name) {
  return page.locator('table tbody tr').filter({ hasText: name });
}

test.describe('Staff & Access (Task 32)', () => {
  test('shows an explicit Active/Inactive status pill for every row, not just the action button', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpenStaff(page);

    await expect(rowFor(page, 'Employee A').locator('.status-pill.active')).toHaveText('Active');
    await expect(rowFor(page, 'Former C').locator('.status-pill.inactive')).toHaveText('Inactive');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('self-row: role dropdown and Deactivate button are both disabled', async ({ page }) => {
    await loginAndOpenStaff(page);
    const selfRow = rowFor(page, 'Admin User');
    await expect(selfRow.locator('select.role-select')).toBeDisabled();
    await expect(selfRow.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  test('the page documents the Supabase Dashboard account-creation workflow, with no field ever asking an admin to enter a service-role key', async ({ page }) => {
    await loginAndOpenStaff(page);
    await expect(page.getByText('Supabase Dashboard')).toBeVisible();
    // The page's own copy correctly SAYS "never asks for or stores a
    // service-role key" (a legitimate negation) -- what actually matters
    // is that there is no such input anywhere for an admin to type one
    // into, which no text scan can prove either way.
    const serviceRoleInputs = await page.locator('input, textarea').evaluateAll((els) =>
      els.filter((el) => /service.?role/i.test(el.placeholder || '') || /service.?role/i.test(el.name || '')).length
    );
    expect(serviceRoleInputs).toBe(0);
  });

  test('Edit Profile: saves designation/work email/phone/join date via a direct admin-authorized profiles update', async ({ page }) => {
    await loginAndOpenStaff(page);
    await rowFor(page, 'Employee A').getByRole('button', { name: 'Edit' }).click();
    const modal = page.locator('#modalCard');
    await modal.locator('.f').filter({ hasText: 'Designation' }).locator('input').fill('Lead Associate');

    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH' && req.url().includes('/rest/v1/profiles')) patches.push(req.postDataJSON()); });
    await modal.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.locator('#toast')).toContainText('Staff profile updated');
    expect(patches.find((p) => p && p.designation === 'Lead Associate')).toBeTruthy();
  });

  test('deactivating someone with open work opens the reassignment warning instead of deactivating directly', async ({ page }) => {
    const openItem = {
      id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
      assignee_id: EMPLOYEE_A.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
      internal_due_date: '2026-09-01', external_due_date: null, period: null, submission_required: false, review_required: true,
      created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    await loginAndOpenStaff(page, { work_items: [openItem] });
    await rowFor(page, 'Employee A').getByRole('button', { name: 'Deactivate' }).click();

    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Reassign Before Deactivating' })).toBeVisible();
    await expect(modal.getByText('Alpha VAT Return')).toBeVisible();

    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH') patches.push(req.url()); });
    await modal.locator('.f').filter({ hasText: 'Reassign all of the above to' }).locator('select').selectOption({ label: 'Reviewer B' });
    await modal.getByRole('button', { name: 'Reassign & Deactivate' }).click();
    await expect(page.locator('#toast')).toContainText('deactivated');
    expect(patches.some((u) => u.includes('/rest/v1/work_items') && u.includes('assignee_id=eq.' + EMPLOYEE_A.id))).toBe(true);
    expect(patches.some((u) => u.includes('/rest/v1/profiles?id=eq.' + EMPLOYEE_A.id))).toBe(true);
  });

  test('demoting a Reviewer who is still the reviewer on open Client Work opens a reassignment warning', async ({ page }) => {
    const reviewedItem = {
      id: 'w2', title: 'Alpha Bookkeeping', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
      assignee_id: EMPLOYEE_A.id, reviewer_id: REVIEWER_B.id, status: 'ready_for_review', priority: 'normal',
      internal_due_date: '2026-09-15', external_due_date: null, period: 'Bhadra 2083', submission_required: false, review_required: true,
      created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    await loginAndOpenStaff(page, { work_items: [reviewedItem] });
    await rowFor(page, 'Reviewer B').locator('select.role-select').selectOption('employee');

    const modal = page.locator('#modalCard');
    await expect(modal.getByRole('heading', { name: 'Reassign Reviewer Before Changing Role' })).toBeVisible();
    await expect(modal.getByText('Alpha Bookkeeping')).toBeVisible();

    const patches = [];
    page.on('request', (req) => { if (req.method() === 'PATCH') patches.push({ url: req.url(), body: req.postDataJSON() }); });
    await modal.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#toast')).toContainText('is now employee');
    expect(patches.some((p) => p.url.includes('/rest/v1/profiles?id=eq.' + REVIEWER_B.id) && p.body && p.body.role === 'employee')).toBe(true);
  });

  test('demoting a Reviewer with NO open reviewed items applies the role change immediately, no warning modal', async ({ page }) => {
    await loginAndOpenStaff(page, { work_items: [] });
    await rowFor(page, 'Reviewer B').locator('select.role-select').selectOption('employee');
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);
    await expect(page.locator('#toast')).toContainText('is now employee');
  });

  test('promoting an Employee to Reviewer applies immediately -- no stranding risk, no warning modal', async ({ page }) => {
    const reviewedItem = {
      id: 'w2', title: 'Alpha Bookkeeping', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
      assignee_id: EMPLOYEE_A.id, reviewer_id: REVIEWER_B.id, status: 'ready_for_review', priority: 'normal',
      internal_due_date: '2026-09-15', external_due_date: null, period: 'Bhadra 2083', submission_required: false, review_required: true,
      created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    await loginAndOpenStaff(page, { work_items: [reviewedItem] });
    await rowFor(page, 'Employee A').locator('select.role-select').selectOption('reviewer');
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);
    await expect(page.locator('#toast')).toContainText('is now reviewer');
  });

  test('no horizontal overflow at mobile width', async ({ page }) => {
    await loginAndOpenStaff(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff & Access overflows horizontally at 375px by ${overflow}px`).toBeLessThanOrEqual(1);
  });

  // Create New Staff calls the server-side create-staff-account Edge
  // Function (see supabase/functions/create-staff-account/index.ts) --
  // never the Auth Admin API directly, since that needs the service-role
  // key, which this page (like all of Work Desk) never holds.
  test.describe('Create New Staff', () => {
    test('sends the invite request to the create-staff-account function with the caller\'s bearer token, then refreshes the roster', async ({ page }) => {
      await loginAndOpenStaff(page);
      let requestBody = null;
      let authHeader = null;
      await page.route('**/functions/v1/create-staff-account', async (route) => {
        requestBody = route.request().postDataJSON();
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, user_id: 'new-user-1' }) });
      });

      await page.getByRole('button', { name: 'Create New Staff' }).click();
      await expect(page.getByRole('heading', { name: 'Create New Staff' })).toBeVisible();
      await page.locator('.f').filter({ hasText: 'Work email' }).locator('input').fill('new.hire@maven.example');
      await page.locator('.f').filter({ hasText: 'Full name' }).locator('input').fill('New Hire');
      await page.locator('.f').filter({ hasText: 'Designation' }).locator('input').fill('Associate');
      await page.locator('.f').filter({ hasText: 'Role' }).locator('select').selectOption('reviewer');
      await page.getByRole('button', { name: 'Send Invite' }).click();

      await expect(page.locator('#toast')).toContainText('Invite sent to new.hire@maven.example');
      await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);
      expect(requestBody).toMatchObject({ email: 'new.hire@maven.example', full_name: 'New Hire', designation: 'Associate', role: 'reviewer' });
      expect(authHeader).toMatch(/^Bearer /);
    });

    test('requires email and full name before sending', async ({ page }) => {
      await loginAndOpenStaff(page);
      let called = false;
      await page.route('**/functions/v1/create-staff-account', async (route) => { called = true; await route.fulfill({ status: 200, body: '{}' }); });
      await page.getByRole('button', { name: 'Create New Staff' }).click();
      await page.getByRole('button', { name: 'Send Invite' }).click();
      await expect(page.locator('#toast')).toContainText('Work email and full name are required');
      expect(called).toBe(false);
    });

    test('shows the server error and keeps the modal open when the function rejects the request', async ({ page }) => {
      await loginAndOpenStaff(page);
      await page.route('**/functions/v1/create-staff-account', async (route) => {
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Only an active admin can create staff accounts.' }) });
      });
      await page.getByRole('button', { name: 'Create New Staff' }).click();
      await page.locator('.f').filter({ hasText: 'Work email' }).locator('input').fill('new.hire@maven.example');
      await page.locator('.f').filter({ hasText: 'Full name' }).locator('input').fill('New Hire');
      await page.getByRole('button', { name: 'Send Invite' }).click();
      await expect(page.locator('#toast')).toContainText('Only an active admin can create staff accounts');
      await expect(page.getByRole('heading', { name: 'Create New Staff' })).toBeVisible();
    });
  });
});
