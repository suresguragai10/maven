const { test, expect } = require('@playwright/test');

test.describe('Documents Needed accordion', () => {
  test('all document groups start collapsed', async ({ page }) => {
    await page.goto('/documents-needed');
    const items = page.locator('.accordion-item');
    expect(await items.count()).toBeGreaterThan(0);
    const triggers = page.locator('.accordion-trigger');
    for (let i = 0; i < await triggers.count(); i++) {
      await expect(triggers.nth(i)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('#panel-doc-0')).toHaveCSS('max-height', '0px');
    await expect(page.locator('#panel-doc-0')).toHaveJSProperty('inert', true);
  });

  test('a section opens on the first click and closes on one click', async ({ page }) => {
    await page.goto('/documents-needed');
    const trigger = page.locator('#trigger-doc-0');
    const panel = page.locator('#panel-doc-0');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await panel.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCSS('max-height', '0px');
  });
});
