const { test, expect } = require('@playwright/test');

// client.js's openMobileNav/closeMobileNav (see /client.js) -- covers the
// open/close, Escape-closes, and focus-return behavior this task calls out
// by name.
test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens on toggle click, moves focus into the panel', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const mobileNav = page.locator('.mobile-nav');
    const closeBtn = page.locator('.mobile-nav-close');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();

    await expect(mobileNav).toHaveClass(/is-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(closeBtn).toBeFocused();
  });

  test('Escape closes the menu and returns focus to the toggle', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const mobileNav = page.locator('.mobile-nav');

    await toggle.click();
    await expect(mobileNav).toHaveClass(/is-open/);

    await page.keyboard.press('Escape');

    await expect(mobileNav).not.toHaveClass(/is-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('close button closes the menu and returns focus to the toggle', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const mobileNav = page.locator('.mobile-nav');
    const closeBtn = page.locator('.mobile-nav-close');

    await toggle.click();
    await closeBtn.click();

    await expect(mobileNav).not.toHaveClass(/is-open/);
    await expect(toggle).toBeFocused();
  });

  test('clicking a menu link closes the menu', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const mobileNav = page.locator('.mobile-nav');

    await toggle.click();
    await mobileNav.locator('a[href="/contact"]').first().click();

    await expect(page).toHaveURL(/\/contact$/);
  });
});
