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

  // Handbook Task 25: a collapsed submenu's links must not be reachable
  // by Tab — previously they were fully focusable at max-height:0 (only
  // clipped visually), so a keyboard user tabbing through a closed menu
  // would stop on invisible links.
  test('a collapsed submenu is inert, and its links are excluded from the Tab trap', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-toggle').click();

    const sub = page.locator('#mobile-sub-services');
    await expect(sub).toHaveJSProperty('inert', true);

    const subToggle = page.locator('.mobile-sub-toggle[aria-controls="mobile-sub-services"]');
    await expect(subToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening a submenu removes inert; closing it restores inert', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-toggle').click();

    const sub = page.locator('#mobile-sub-services');
    const subToggle = page.locator('.mobile-sub-toggle[aria-controls="mobile-sub-services"]');

    await subToggle.click();
    await expect(subToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sub).toHaveJSProperty('inert', false);

    await subToggle.click();
    await expect(subToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sub).toHaveJSProperty('inert', true);
  });
});
