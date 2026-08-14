const { test, expect } = require('@playwright/test');
const { DESKTOP_TOP_LEVEL_NAV } = require('../support/pages');

test.describe('Home — page shell', () => {
  test('header, main and footer render with no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');

    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('footer.site-footer')).toBeVisible();
    expect(errors, `console/page errors on home:\n${errors.join('\n')}`).toEqual([]);
  });

  test('expected top-level desktop navigation appears, in order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const links = page.locator('nav.main-nav > ul > li.nav-item > a.nav-link');
    await expect(links).toHaveCount(DESKTOP_TOP_LEVEL_NAV.length);

    for (let i = 0; i < DESKTOP_TOP_LEVEL_NAV.length; i++) {
      const link = links.nth(i);
      await expect(link).toContainText(DESKTOP_TOP_LEVEL_NAV[i].label);
      await expect(link).toHaveAttribute('href', DESKTOP_TOP_LEVEL_NAV[i].href);
    }
  });

  test('primary CTA is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header-cta a.btn-primary')).toBeVisible();
  });
});
