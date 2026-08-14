const { test, expect } = require('@playwright/test');

// Documents Needed accordion -- same component/markup pattern as FAQ
// (see faq.spec.js for the root-cause explanation of the known bug).
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

  // KNOWN BUG -- same root cause as faq.spec.js's equivalent test.
  test('known bug: the server-pre-opened first section needs two clicks to visibly open', async ({ page }) => {
    test.fail(true, 'Same root cause as the FAQ page: styles.css has no .is-open override for .accordion-panel. See docs/UI_TESTING.md.');

    await page.goto('/documents-needed');
    const trigger = page.locator('#trigger-doc-0');
    const panel = page.locator('#panel-doc-0');

    await trigger.click();
    const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(0);
  });
});
