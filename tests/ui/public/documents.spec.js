const { test, expect } = require('@playwright/test');

// Documents Needed accordion -- same shared component/markup as FAQ (see
// faq.spec.js for the Handbook Task 25 root-cause fix explanation).
test.describe('Documents Needed accordion', () => {
  test('renders sections, closed items start collapsed', async ({ page }) => {
    await page.goto('/documents-needed');
    const items = page.locator('.accordion-item');
    await expect(items).not.toHaveCount(0);

    const secondPanel = page.locator('#panel-doc-1');
    await expect(secondPanel).toHaveCSS('max-height', '0px');
  });

  test('a normally-closed section opens fully on the first click', async ({ page }) => {
    await page.goto('/documents-needed');
    const trigger = page.locator('#trigger-doc-1');
    const panel = page.locator('#panel-doc-1');

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(0);
  });

  test('the server-pre-opened first section is already visually open on load, and closes on a single click (Handbook Task 25 fix)', async ({ page }) => {
    await page.goto('/documents-needed');
    const trigger = page.locator('#trigger-doc-0');
    const panel = page.locator('#panel-doc-0');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const openHeight = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(openHeight, 'first section should already be visibly open on page load').toBeGreaterThan(0);

    await trigger.click(); // should CLOSE it, not silently no-op
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCSS('max-height', '0px');
  });
});
