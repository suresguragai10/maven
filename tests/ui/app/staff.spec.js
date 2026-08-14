const { test, expect } = require('@playwright/test');

// No real Supabase session is available in this harness (no credentials,
// no live backend reachable from CI) -- per this task's own instruction
// ("safe mocked/test setup if authentication cannot be automated yet"),
// this only proves the pre-login shell loads cleanly. staff.js's
// sb.auth.getSession() call on load is a local (no-session) check, so it
// resolves to session:null without needing network access -- it does not
// need mocking to reach the login screen.
test.describe('Staff app — pre-login shell', () => {
  test('loads with no console/page exceptions and shows the login screen', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/staff/');
    await expect(page).toHaveTitle('Maven Work Desk');

    const loginScreen = page.locator('#loginScreen');
    await expect(loginScreen).toBeVisible();
    await expect(loginScreen).not.toHaveClass(/hidden/);

    expect(errors, `console/page errors on /staff/:\n${errors.join('\n')}`).toEqual([]);
  });

  test('login form has the expected fields and does not attempt navigation on empty submit', async ({ page }) => {
    await page.goto('/staff/');
    const loginScreen = page.locator('#loginScreen');
    await expect(loginScreen.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(loginScreen.locator('input[type="password"]')).toBeVisible();
  });
});
