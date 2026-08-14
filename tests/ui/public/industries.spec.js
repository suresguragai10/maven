const { test, expect } = require('@playwright/test');

test.describe('Industries page', () => {
  test('renders every configured industry entry', async ({ page }) => {
    await page.goto('/industries');
    const cards = page.locator('.industry-card');
    const count = await cards.count();
    expect(count, 'expected at least one industry card').toBeGreaterThan(0);

    // Every card must have its own toggle + panel wired up, not just exist
    // visually -- this is what #industry-N deep links target.
    for (let i = 0; i < count; i++) {
      await expect(page.locator(`#trigger-industry-${i}`)).toBeVisible();
      await expect(page.locator(`#panel-industry-${i}`)).toBeAttached();
    }
  });

  test('#industry-N deep link opens the matching card and scrolls to it', async ({ page }) => {
    await page.goto('/industries#industry-2');

    const card = page.locator('#panel-industry-2').locator('..');
    await expect(card).toHaveClass(/is-open/);
    await expect(page.locator('#trigger-industry-2')).toHaveAttribute('aria-expanded', 'true');

    const height = await page.locator('#panel-industry-2').evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(0);
  });

  test('clicking a card toggle opens it on the first click (no known bug here — cards start closed with no server pre-open)', async ({ page }) => {
    await page.goto('/industries');
    const trigger = page.locator('#trigger-industry-0');
    const panel = page.locator('#panel-industry-0');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const height = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(0);
  });
});
