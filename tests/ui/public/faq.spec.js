const { test, expect } = require('@playwright/test');

test.describe('FAQ accordion', () => {
  test('all questions start collapsed and out of the keyboard tab order', async ({ page }) => {
    await page.goto('/faq');
    const items = page.locator('.accordion-item');
    expect(await items.count()).toBeGreaterThan(0);

    const triggers = page.locator('.accordion-trigger');
    for (let i = 0; i < await triggers.count(); i++) {
      await expect(triggers.nth(i)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('#panel-faq-0')).toHaveCSS('max-height', '0px');
    await expect(page.locator('#panel-faq-0')).toHaveJSProperty('inert', true);
  });

  test('the first question opens on one click and closes on the next', async ({ page }) => {
    await page.goto('/faq');
    const trigger = page.locator('#trigger-faq-0');
    const panel = page.locator('#panel-faq-0');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveJSProperty('inert', false);
    expect(await panel.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCSS('max-height', '0px');
    await expect(panel).toHaveJSProperty('inert', true);
  });

  test('another question also opens fully on its first interaction', async ({ page }) => {
    await page.goto('/faq');
    const trigger = page.locator('#trigger-faq-1');
    const panel = page.locator('#panel-faq-1');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await panel.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
  });
});
