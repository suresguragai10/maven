// OTP-based account activation and password reset. Password stays the
// day-to-day sign-in method (see the comment above showOtpScreen() in
// staff.js) -- OTP only covers two rare flows: a brand-new hire entering
// the code from their admin-sent invite email, and an existing staffer
// resetting a forgotten password. Both end by setting a real password via
// updateUser() and landing straight in the app, same as a normal login.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const SUPABASE_URL = 'https://moqmgyniwytwmlcdthzy.supabase.co';
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };

async function mockOtpEndpoints(page, { verifyStatus = 200, verifyBody, updateStatus = 200 } = {}) {
  const verifyCalls = [];
  const recoverCalls = [];
  await page.route(`${SUPABASE_URL}/auth/v1/recover**`, async (route) => {
    recoverCalls.push(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route(`${SUPABASE_URL}/auth/v1/verify**`, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    verifyCalls.push(body);
    if (verifyStatus !== 200) {
      await route.fulfill({ status: verifyStatus, contentType: 'application/json', body: JSON.stringify({ error_description: 'Token has expired or is invalid' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(verifyBody || require('../support/mock-supabase').fakeSession(EMPLOYEE_A)),
    });
  });
  await page.route(`${SUPABASE_URL}/auth/v1/user**`, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: EMPLOYEE_A.id, email: EMPLOYEE_A.email }) });
      return;
    }
    if (updateStatus !== 200) {
      await route.fulfill({ status: updateStatus, contentType: 'application/json', body: JSON.stringify({ error_description: 'Could not update user' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: EMPLOYEE_A.id, email: EMPLOYEE_A.email }) });
  });
  return { verifyCalls, recoverCalls };
}

async function baseTables() {
  return {
    profiles: [EMPLOYEE_A],
    clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
    work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
    work_items: [], attendance_entries: [], attendance_corrections: [],
  };
}

test.describe('OTP account activation / password reset', () => {
  test('forgot password: sends a recovery code, verifies it with type=recovery, sets a new password, and lands in the app', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    const { verifyCalls, recoverCalls } = await mockOtpEndpoints(page);
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.locator('#otpScreen')).toBeVisible();
    await expect(page.locator('#otpTitle')).toHaveText('Reset Your Password');

    await page.locator('#otp-email').fill(EMPLOYEE_A.email);
    await page.getByRole('button', { name: 'Send Code' }).click();
    await expect(page.locator('#otpStepCode')).toBeVisible();
    expect(recoverCalls.length).toBe(1);

    // Supabase's actual token length is a project setting, not something
    // this app should assume -- an 8-digit code (observed live) proves the
    // input isn't truncating it (a real bug: it briefly had maxlength=6).
    await page.locator('#otp-code').fill('12345678');
    await page.locator('#otp-newpassword').fill('a-real-new-password');
    await page.locator('#otp-newpassword2').fill('a-real-new-password');
    await page.getByRole('button', { name: 'Verify & Set Password' }).click();

    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    await expect(page.locator('#otpScreen')).toHaveCount(0);
    expect(verifyCalls.length).toBe(1);
    expect(verifyCalls[0].type).toBe('recovery');
    expect(verifyCalls[0].email).toBe(EMPLOYEE_A.email);
    expect(verifyCalls[0].token).toBe('12345678');
  });

  test('activate account: no network call to "send" a code (already emailed by the admin invite), verifies with type=invite', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    const { verifyCalls, recoverCalls } = await mockOtpEndpoints(page);
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Activating a new account?' }).click();
    await expect(page.locator('#otpScreen')).toBeVisible();
    await expect(page.locator('#otpTitle')).toHaveText('Activate Your Account');
    await expect(page.locator('#otpResendBtn')).toBeHidden();

    await page.locator('#otp-email').fill(EMPLOYEE_A.email);
    await page.getByRole('button', { name: 'I Have My Code' }).click();
    await expect(page.locator('#otpStepCode')).toBeVisible();
    expect(recoverCalls.length).toBe(0);

    await page.locator('#otp-code').fill('654321');
    await page.locator('#otp-newpassword').fill('a-real-new-password');
    await page.locator('#otp-newpassword2').fill('a-real-new-password');
    await page.getByRole('button', { name: 'Verify & Set Password' }).click();

    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    expect(verifyCalls[0].type).toBe('invite');
  });

  test('mismatched passwords are rejected client-side before any verify call is made', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    const { verifyCalls } = await mockOtpEndpoints(page);
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.locator('#otp-email').fill(EMPLOYEE_A.email);
    await page.getByRole('button', { name: 'Send Code' }).click();
    await page.locator('#otp-code').fill('123456');
    await page.locator('#otp-newpassword').fill('a-real-new-password');
    await page.locator('#otp-newpassword2').fill('a-different-password');
    await page.getByRole('button', { name: 'Verify & Set Password' }).click();

    await expect(page.locator('#otpMsg')).toContainText(/do not match/i);
    expect(verifyCalls.length).toBe(0);
  });

  test('an invalid/expired code shows an error and does not leave the OTP screen', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    await mockOtpEndpoints(page, { verifyStatus: 400 });
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.locator('#otp-email').fill(EMPLOYEE_A.email);
    await page.getByRole('button', { name: 'Send Code' }).click();
    await page.locator('#otp-code').fill('000000');
    await page.locator('#otp-newpassword').fill('a-real-new-password');
    await page.locator('#otp-newpassword2').fill('a-real-new-password');
    await page.getByRole('button', { name: 'Verify & Set Password' }).click();

    await expect(page.locator('#otpScreen')).toBeVisible();
    await expect(page.locator('#otpMsg')).toContainText(/expired|invalid/i);
    await expect(page.locator('#app')).toHaveClass(/hidden/);
  });

  test('a too-short new password is rejected client-side before any verify call is made', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    const { verifyCalls } = await mockOtpEndpoints(page);
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.locator('#otp-email').fill(EMPLOYEE_A.email);
    await page.getByRole('button', { name: 'Send Code' }).click();
    await page.locator('#otp-code').fill('123456');
    await page.locator('#otp-newpassword').fill('short');
    await page.getByRole('button', { name: 'Verify & Set Password' }).click();

    await expect(page.locator('#otpMsg')).toContainText(/at least 8 characters/i);
    expect(verifyCalls.length).toBe(0);
  });

  test('"Back to sign in" returns to the login screen without side effects', async ({ page }) => {
    await installSupabaseMock(page, { user: EMPLOYEE_A, tables: await baseTables() });
    await mockOtpEndpoints(page);
    await page.goto('/staff/');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.locator('#otpScreen')).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#otpScreen')).toHaveCount(0);
  });
});
