const { test, expect } = require('@playwright/test');

test.describe('404 and internal navigation smoke', () => {
  test('an unknown path serves the 404 page with a way back home', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText(/page not found/i);

    const homeLink = page.locator('a', { hasText: 'Go to Homepage' });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('header.site-header')).toBeVisible();
  });

  test('a top-level nav link actually navigates to a working page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.locator('nav.main-nav a.nav-link', { hasText: 'Industries' }).click();
    await expect(page).toHaveURL(/\/industries$/);
    await expect(page.locator('main#main')).toBeVisible();
  });
});
