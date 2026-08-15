const { test, expect } = require('@playwright/test');

// Desktop nav dropdowns (Handbook Task 25). Previously the parent
// .nav-link was both a real navigable <a href> AND the only way to
// reveal the dropdown (CSS :hover/:focus-within) -- ambiguous on a touch
// device, where a tap just navigates away immediately. Now each dropdown
// item also has a dedicated .nav-dropdown-toggle button (real
// aria-expanded/aria-controls) that opens/closes it explicitly via
// client.js, independent of the link's own navigation. Only relevant at
// desktop widths (.main-nav is display:none below 1051px, per
// styles.css), so these tests run at a wide viewport explicitly rather
// than relying on the project default.
test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Desktop nav dropdowns', () => {
  test('clicking the toggle opens the dropdown with aria-expanded=true, closes on a second click', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-dropdown-toggle[aria-controls="dropdown-services"]');
    const dropdown = page.locator('#dropdown-services');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(dropdown).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('the parent link still navigates to its own page — clicking it does not just toggle the dropdown', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-link', { hasText: 'Services' }).click();
    await expect(page).toHaveURL(/\/services\/?$/);
  });

  test('Escape closes the open dropdown and returns focus to its toggle', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-dropdown-toggle[aria-controls="dropdown-services"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('clicking outside the open dropdown closes it', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-dropdown-toggle[aria-controls="dropdown-services"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening a second dropdown closes the first — only one open at a time', async ({ page }) => {
    await page.goto('/');
    const servicesToggle = page.locator('.nav-dropdown-toggle[aria-controls="dropdown-services"]');
    const resourcesToggle = page.locator('.nav-dropdown-toggle[aria-controls="dropdown-resources"]');

    await servicesToggle.click();
    await expect(servicesToggle).toHaveAttribute('aria-expanded', 'true');

    await resourcesToggle.click();
    await expect(resourcesToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(servicesToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('the current page\'s top-level nav link gets aria-current="page"', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('.main-nav .nav-link', { hasText: 'Services' })).toHaveAttribute('aria-current', 'page');
    // A different, non-active top-level link must not also claim it.
    await expect(page.locator('.main-nav .nav-link', { hasText: 'Resources' })).not.toHaveAttribute('aria-current', 'page');
  });
});
