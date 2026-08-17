const { test, expect } = require('@playwright/test');

test.describe('Industries page — stable master/detail layout', () => {
  test('renders every industry as a compact selector with a matching full-width detail panel', async ({ page }) => {
    await page.goto('/industries');
    const cards = page.locator('.industry-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(page.locator(`[data-industry-index="${i}"]`)).toBeVisible();
      await expect(page.locator(`[data-industry-detail="${i}"]`)).toBeAttached();
      await expect(page.locator(`[data-industry-index="${i}"]`)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('#industry-detail-placeholder')).toBeVisible();
  });

  test('#industry-N deep link selects and displays the matching detail without expanding a grid card', async ({ page }) => {
    await page.goto('/industries#industry-2');
    await expect(page.locator('#industry-2')).toHaveClass(/is-selected/);
    await expect(page.locator('[data-industry-index="2"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-industry-detail="2"]')).toBeVisible();
    await expect(page.locator('#industry-detail-placeholder')).toBeHidden();
  });

  test('selecting one industry does not stretch neighbouring cards', async ({ page }) => {
    await page.goto('/industries');
    const sibling = page.locator('#industry-1');
    const before = await sibling.evaluate((el) => el.getBoundingClientRect().height);

    await page.locator('[data-industry-index="0"]').click();
    await expect(page.locator('[data-industry-detail="0"]')).toBeVisible();
    const after = await sibling.evaluate((el) => el.getBoundingClientRect().height);

    expect(Math.abs(after - before), 'neighbouring card height should not change when detail opens outside the grid').toBeLessThanOrEqual(1);
  });

  test('selecting a second industry swaps the detail panel and selection state', async ({ page }) => {
    await page.goto('/industries');
    await page.locator('[data-industry-index="0"]').click();
    await page.locator('[data-industry-index="1"]').click();

    await expect(page.locator('[data-industry-detail="0"]')).toBeHidden();
    await expect(page.locator('[data-industry-detail="1"]')).toBeVisible();
    await expect(page.locator('[data-industry-index="0"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-industry-index="1"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('selector controls are real buttons and the full layout has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/industries');
    await expect(page.locator('[data-industry-index="0"]')).toHaveAttribute('type', 'button');
    await page.locator('[data-industry-index="0"]').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('homepage badges and full Industries selectors remain separate components', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.industry-badge').first()).toBeVisible();
    expect(await page.locator('.industry-card').count()).toBe(0);

    await page.goto('/industries');
    await expect(page.locator('.industry-card').first()).toBeVisible();
    expect(await page.locator('.industry-badge').count()).toBe(0);
    await expect(page.locator('.industry-card').first().locator('..')).toHaveClass(/industry-picker-grid/);
  });
});
