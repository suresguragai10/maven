const { test, expect } = require('@playwright/test');

test.describe('Industries page — stable master/detail layout', () => {
  test('renders every industry as a compact selector with a matching detail panel', async ({ page }) => {
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

  test('#industry-N deep link selects and displays the matching detail without expanding the list item itself', async ({ page }) => {
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
    await expect(page.locator('.industry-list')).toHaveCount(1);
    expect(await page.locator('.industry-list .industry-card').count()).toBe(await page.locator('.industry-card').count());
  });

  test('desktop shows a compact selector list on the left and detail on the right, sticky while the list scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/industries');
    const listBox = await page.locator('.industry-list').boundingBox();
    const stageBox = await page.locator('#industry-detail-stage').boundingBox();
    expect(listBox.x).toBeLessThan(stageBox.x);

    await page.locator('[data-industry-index="0"]').click();
    const position = await page.locator('#detail-industry-0').evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');

    // Scroll past the point where the panel engages its sticky top offset
    // (its natural in-flow position moves toward that offset as the page
    // scrolls, same as any sticky element — that transition isn't the bug),
    // then compare two further-apart scroll positions: once actually stuck,
    // the panel's viewport position should stop changing. The page has
    // scroll-behavior:smooth, so each jump needs a moment to settle before
    // reading a position, or the read lands mid-animation.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    const stuckAt600 = await page.locator('#detail-industry-0').boundingBox();
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(200);
    const stuckAt800 = await page.locator('#detail-industry-0').boundingBox();
    expect(Math.abs(stuckAt800.y - stuckAt600.y)).toBeLessThan(2);
  });

  test('every industry keeps its full detail content in the page, not only the selected one', async ({ page }) => {
    await page.goto('/industries');
    const count = await page.locator('.industry-card').count();
    for (let i = 0; i < count; i++) {
      const panel = page.locator(`[data-industry-detail="${i}"]`);
      await expect(panel.locator('.industry-detail-intro')).toBeAttached();
      expect(await panel.locator('.industry-detail-grid li').count()).toBeGreaterThan(0);
    }
  });

  test('the selector list is keyboard-operable: Tab reaches a row and Enter selects it', async ({ page }) => {
    await page.goto('/industries');
    await page.locator('[data-industry-index="1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-industry-detail="1"]')).toBeVisible();
    await expect(page.locator('[data-industry-index="1"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('mobile: selecting an industry brings its detail into view immediately, not after the rest of the list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/industries');
    // Select the last industry in the list — the worst case for "detail sits
    // after all other industries in DOM order" if the scroll-into-view
    // behavior were missing or broken.
    const count = await page.locator('.industry-card').count();
    await page.locator(`[data-industry-index="${count - 1}"]`).click();
    await expect(page.locator(`[data-industry-detail="${count - 1}"]`)).toBeVisible();
    const box = await page.locator(`[data-industry-detail="${count - 1}"]`).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeLessThan(812);
  });
});
