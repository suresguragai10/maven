const { test, expect } = require('@playwright/test');

// FAQ accordion (client.js "Accordions (FAQ + Documents Needed)" block).
// pages*.js server-renders the FIRST item pre-expanded (class="is-open",
// aria-expanded="true", no inline max-height). styles.css's only rule for
// the panel is ".accordion-panel { max-height: 0; ... }" -- there is no
// ".is-open .accordion-panel" override, so that first panel has nothing
// giving it height on load despite declaring itself open. Every OTHER
// item starts correctly closed with an explicit inline
// style="max-height:0" that matches its aria-expanded="false".
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

  // KNOWN BUG, not fixed by this task (Task 2 = tests only). Repair is a
  // separate, later task; this stays marked as an expected failure until
  // then so it can't silently regress further, but also can't be ignored.
  test('known bug: the server-pre-opened first item is NOT visually open on load', async ({ page }) => {
    test.fail(true, 'First FAQ item declares aria-expanded="true" on load but styles.css has no .is-open override, so it renders visually collapsed until clicked twice. See docs/UI_TESTING.md "Known/expected failures".');

    await page.goto('/faq');
    const firstPanel = page.locator('#panel-faq-0');
    await expect(page.locator('#trigger-faq-0')).toHaveAttribute('aria-expanded', 'true');

    const height = await firstPanel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, 'first item should already be visibly open on page load').toBeGreaterThan(0);
  });

  // KNOWN BUG, same root cause: because the first item's declared state
  // (open) doesn't match its visual state (collapsed), the FIRST click on
  // it is interpreted as "close an open item" -- no visible change -- and
  // a SECOND click is required before it visually opens. This is the
  // "two-click first-interaction" regression the task description names.
  test('known bug: the first item needs two clicks to visibly open', async ({ page }) => {
    test.fail(true, 'First click on the pre-opened item just formally closes it (no visible change, since it was already visually collapsed); a second click is needed to actually open it. See docs/UI_TESTING.md.');

    await page.goto('/faq');
    const trigger = page.locator('#trigger-faq-0');
    const panel = page.locator('#panel-faq-0');

    await trigger.click(); // first interaction
    const heightAfterOneClick = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(heightAfterOneClick, 'should be visibly open after a single click').toBeGreaterThan(0);
  });
});
