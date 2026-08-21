// Task 31: real, empirical browser evidence for the Staff Directory and
// My Profile pages -- active-only directory listing with clickable work
// contact links, initials fallback, explicit separation from the public
// Team page; My Profile's clear "Managed by Admin" vs "You Can Edit"
// split; and photo handling, which accepts either a plain URL or a real
// file upload to Supabase Storage (see 20260903090000_staff_photo_upload.sql),
// still with no crop/editor UI.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true, designation: 'Managing Partner', work_email: 'admin@maven.example', phone: '+977-98-1111-1111', join_date: '2022-01-10' };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true, designation: 'Associate', work_email: 'employee.a@maven.example', phone: '+977-98-2222-2222', join_date: '2024-06-01', photo_url: null };
const INACTIVE_FORMER_STAFF = { id: '77777777-7777-7777-7777-777777777777', email: 'former@test.local', full_name: 'Former Staffer', role: 'employee', is_active: false, designation: 'Associate', work_email: 'former@maven.example', phone: '', join_date: '2021-01-01' };

async function loginAndOpen(page, user, tabName) {
  await installSupabaseMock(page, {
    user: user,
    tables: {
      profiles: [ADMIN, EMPLOYEE_A, INACTIVE_FORMER_STAFF],
      clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [], attendance_entries: [], attendance_corrections: [],
    },
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await page.getByRole('button', { name: tabName === 'Directory' ? 'Team' : 'Personal', exact: true }).click();
  await page.getByRole('tab', { name: tabName }).click();
  if (tabName === 'Directory') {
    await expect(page.getByRole('heading', { name: 'Staff Directory', exact: true })).toBeVisible();
  } else {
    // The My Profile page's own <h1> shows the person's real name (see
    // renderProfilePage), not a literal "My Profile" string -- the
    // .profile-hero card is the stable thing to wait on instead.
    await expect(page.locator('.profile-hero')).toBeVisible();
  }
}

test.describe('Staff Directory (Task 31)', () => {
  test('shows only active staff, with name, designation, and clickable work contact links', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpen(page, ADMIN, 'Directory');

    const card = page.locator('.directory-card').filter({ hasText: 'Employee A' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Associate')).toBeVisible();
    await expect(card.locator('a[href="mailto:employee.a@maven.example"]')).toHaveText('employee.a@maven.example');
    const expectedTelHref = 'tel:' + EMPLOYEE_A.phone.replace(/[^\d+]/g, '');
    await expect(card.locator('a[href="' + expectedTelHref + '"]')).toHaveText(EMPLOYEE_A.phone);

    // Inactive staff never appear here at all.
    await expect(page.getByText('Former Staffer')).not.toBeVisible();

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('states explicitly that this directory is separate from the public Team page', async ({ page }) => {
    await loginAndOpen(page, ADMIN, 'Directory');
    await expect(page.getByText('separate from the public Team page')).toBeVisible();
  });

  test('a staff member with no photo shows initials, not a broken image', async ({ page }) => {
    await loginAndOpen(page, ADMIN, 'Directory');
    const card = page.locator('.directory-card').filter({ hasText: 'Employee A' });
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card.locator('.profile-photo-fallback')).toHaveText('EA');
  });
});

test.describe('My Profile (Task 31)', () => {
  test('clearly separates admin-managed fields from self-editable ones, in two distinct sections', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');

    const adminCard = page.locator('.card').filter({ hasText: 'Managed by Admin' });
    await expect(adminCard).toBeVisible();
    for (const label of ['Full name', 'Designation', 'Role', 'Work email', 'Join date']) {
      const input = adminCard.locator('.f').filter({ hasText: label }).locator('input');
      await expect(input).toBeDisabled();
    }

    const editCard = page.locator('.card').filter({ hasText: 'You Can Edit' });
    await expect(editCard).toBeVisible();
    const phoneInput = editCard.locator('.f').filter({ hasText: 'Phone' }).locator('input');
    await expect(phoneInput).toBeEnabled();
    const photoInput = editCard.locator('.f').filter({ hasText: 'Profile photo' }).locator('input');
    await expect(photoInput).toBeEnabled();

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('saving updates phone and photo via the narrow self-update RPC, never a direct profiles table write', async ({ page }) => {
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');
    const editCard = page.locator('.card').filter({ hasText: 'You Can Edit' });
    const phoneInput = editCard.locator('.f').filter({ hasText: 'Phone' }).locator('input');
    await phoneInput.fill('+977-98-9999-9999');

    const rpcCalls = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/rpc/update_my_profile')) rpcCalls.push(req.postDataJSON());
      if (req.method() === 'PATCH' && req.url().includes('/rest/v1/profiles')) rpcCalls.push('DIRECT_TABLE_WRITE');
    });
    await page.getByRole('button', { name: 'Save My Profile' }).click();
    await expect(page.locator('#toast')).toContainText('Profile updated');
    expect(rpcCalls.some((c) => c === 'DIRECT_TABLE_WRITE')).toBe(false);
    expect(rpcCalls.find((c) => c && c.p_phone)).toMatchObject({ p_phone: '+977-98-9999-9999' });
  });

  test('an invalid photo URL (not local /images/ or Maven Supabase Storage) is rejected before any save call', async ({ page }) => {
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');
    const editCard = page.locator('.card').filter({ hasText: 'You Can Edit' });
    const photoInput = editCard.locator('.f').filter({ hasText: 'Profile photo' }).locator('input');
    await photoInput.fill('https://random-photo-host.example/me.jpg');

    const rpcCalls = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/rpc/update_my_profile')) rpcCalls.push(req.url()); });
    await page.getByRole('button', { name: 'Save My Profile' }).click();
    await expect(page.locator('#toast')).toContainText('local /images/ path or a public Maven Supabase Storage URL');
    expect(rpcCalls).toEqual([]);
  });

  // A real file-upload button was added deliberately (uploads to the
  // "staff-photos" Supabase Storage bucket) -- this DO-NOT now only
  // covers what's still genuinely out of scope: no crop/editor tool, no
  // social-import integration.
  test('DO NOT: no crop/editor UI or social-import integration, even though a real photo upload button now exists', async ({ page }) => {
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    const bodyText = (await page.locator('#main').innerText()).toLowerCase();
    ['crop tool', 'facial', 'face id', 'connect instagram', 'connect facebook', 'import from'].forEach((term) => {
      expect(bodyText, `found forbidden term "${term}" on My Profile`).not.toContain(term);
    });
  });

  test('uploading a photo file goes to Supabase Storage and fills the URL field, ready to save', async ({ page }) => {
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');
    const editCard = page.locator('.card').filter({ hasText: 'You Can Edit' });
    const fileInput = editCard.locator('input[type="file"]');

    let uploadedPath = null;
    await page.route('**/storage/v1/object/staff-photos/**', async (route) => {
      uploadedPath = new URL(route.request().url()).pathname.split('/staff-photos/')[1];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'staff-photos/' + uploadedPath }) });
    });

    await fileInput.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
    const uploadField = editCard.locator('.f').filter({ hasText: 'Or upload a photo' });
    await expect(uploadField).toContainText('Uploaded', { timeout: 5000 });

    const photoInput = editCard.locator('.f').filter({ hasText: 'Profile photo' }).locator('input[type="text"]');
    await expect(photoInput).toHaveValue(new RegExp('/storage/v1/object/public/staff-photos/' + EMPLOYEE_A.id));
    expect(uploadedPath.startsWith(EMPLOYEE_A.id + '/')).toBe(true);
  });

  test('an oversized or wrong-type photo file is rejected client-side before any upload request', async ({ page }) => {
    await loginAndOpen(page, EMPLOYEE_A, 'My Profile');
    const editCard = page.locator('.card').filter({ hasText: 'You Can Edit' });
    const fileInput = editCard.locator('input[type="file"]');

    let uploadRequested = false;
    await page.route('**/storage/v1/object/staff-photos/**', async (route) => { uploadRequested = true; await route.abort(); });

    await fileInput.setInputFiles({ name: 'me.gif', mimeType: 'image/gif', buffer: Buffer.from([1, 2, 3]) });
    await expect(page.locator('#toast')).toContainText('JPG, PNG or WEBP');
    expect(uploadRequested).toBe(false);
  });
});
