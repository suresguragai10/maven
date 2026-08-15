const { test, expect } = require('@playwright/test');

// FAQ accordion (client.js "Accordions (FAQ + Documents Needed)" block).
// Handbook Task 25 fixed the "server-pre-opened first item is NOT
// visually open on load" bug documented here previously: pages*.js
// server-renders the FIRST item pre-expanded (class="is-open",
// aria-expanded="true"); ui.js's accordionItem() now also sends that
// panel style="max-height:none" so it's genuinely visible before
// client.js even runs (previously it sent no inline style at all,
// leaving the panel at styles.css's max-height:0 default despite
// declaring itself open). client.js converts max-height:none to a real
// pixel value on load so the panel can still animate closed on the
// first click. Every OTHER item starts correctly closed with an
// explicit inline style="max-height:0" (and `inert`, so its content is
// out of Tab order while collapsed) matching its aria-expanded="false".
test.describe('FAQ accordion', () => {
  test('renders at least one question, closed items start collapsed', async ({ page }) => {
    await page.goto('/faq');
    const items = page.locator('.accordion-item');
    await expect(items).not.toHaveCount(0);

    const secondPanel = page.locator('#panel-faq-1');
    await expect(secondPanel).toHaveCSS('max-height', '0px');
  });

  test('a normally-closed item opens fully on the first click', async ({ page }) => {
    await page.goto('/faq');
    const trigger = page.locator('#trigger-faq-1');
    const panel = page.locator('#panel-faq-1');

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, 'panel should be visibly open after one click').toBeGreaterThan(0);
  });

  test('the server-pre-opened first item is already visually open on load (Handbook Task 25 fix)', async ({ page }) => {
    await page.goto('/faq');
    const firstPanel = page.locator('#panel-faq-0');
    await expect(page.locator('#trigger-faq-0')).toHaveAttribute('aria-expanded', 'true');

    const height = await firstPanel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, 'first item should already be visibly open on page load').toBeGreaterThan(0);
  });

  test('the first item closes fully on a single click (no two-click regression)', async ({ page }) => {
    await page.goto('/faq');
    const trigger = page.locator('#trigger-faq-0');
    const panel = page.locator('#panel-faq-0');

    await trigger.click(); // first interaction — it starts open, so this should CLOSE it
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCSS('max-height', '0px');

    await trigger.click(); // second interaction — reopens
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, 'should be visibly open again after a second click').toBeGreaterThan(0);
  });

  test('collapsed panel content is inert (not keyboard-focusable)', async ({ page }) => {
    await page.goto('/faq');
    const secondPanel = page.locator('#panel-faq-1');
    await expect(secondPanel).toHaveJSProperty('inert', true);
  });
});
