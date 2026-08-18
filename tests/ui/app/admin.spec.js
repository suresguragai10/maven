const { test, expect } = require('@playwright/test');

test.describe('Admin CMS — entry screen', () => {
  test('renders the connect screen with no console/page exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/admin/');

    const connectScreen = page.locator('#connectScreen');
    await expect(connectScreen).toBeVisible();
    await expect(connectScreen.locator('#in-owner')).toBeVisible();
    await expect(connectScreen.locator('#in-repo')).toBeVisible();
    await expect(connectScreen.locator('#in-token')).toBeVisible();
    await expect(connectScreen.locator('#in-token')).toHaveAttribute('type', 'password');

    expect(errors, `console/page errors on /admin/:\n${errors.join('\n')}`).toEqual([]);
  });

  test('requires an explicit branch instead of silently defaulting to main', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page.locator('#in-branch')).toHaveValue('');
    await page.locator('#in-owner').fill('testuser');
    await page.locator('#in-repo').fill('testrepo');
    await page.locator('#in-token').fill('ghp_fake');
    await page.locator('#connectBtn').click();
    await expect(page.locator('#connectMsg')).toContainText('branch');
    await expect(page.locator('#connectScreen')).toBeVisible();
  });

  test('no token/secret is persisted to storage merely by opening the page', async ({ page }) => {
    await page.goto('/admin/');

    const storageSnapshot = await page.evaluate(() => ({
      localStorage: { ...window.localStorage },
      sessionStorage: { ...window.sessionStorage },
    }));

    // admin.js's own design: owner/repo (non-sensitive) may be remembered
    // in localStorage from a PRIOR session. Branch and token are session-only;
    // a fresh browser context here has none saved yet, and the token must never
    // appear anywhere just from loading the page — it's only written on
    // an explicit Connect click (see admin.js connect/boot storage notes).
    expect(storageSnapshot.sessionStorage.maven_admin_token).toBeUndefined();
    const allValues = [
      ...Object.values(storageSnapshot.localStorage),
      ...Object.values(storageSnapshot.sessionStorage),
    ];
    expect(allValues.some((v) => /ghp_|github_pat_/.test(v))).toBe(false);
  });
});
