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

    // .industry-card-panel's max-height is CSS-transitioned (0.28s ease),
    // so getBoundingClientRect().height read immediately after the class/
    // aria assertions above resolve can still be mid-animation (this was
    // a genuinely flaky assertion pre-dating Handbook Task 25, not
    // something this task introduced — confirmed by reproducing it
    // against the pre-Task-25 code too). The INLINE style value (the
    // target height client.js just set) is synchronous and
    // transition-independent, so assert on that instead of the animated
    // rendered box.
    const panel = page.locator('#panel-industry-2');
    await expect.poll(() => panel.evaluate((el) => el.style.maxHeight)).not.toBe('0px');
    const targetHeight = await panel.evaluate((el) => parseFloat(el.style.maxHeight));
    expect(targetHeight).toBeGreaterThan(0);
  });

  test('clicking a card toggle opens it on the first click (no known bug here — cards start closed with no server pre-open)', async ({ page }) => {
    await page.goto('/industries');
    const trigger = page.locator('#trigger-industry-0');
    const panel = page.locator('#panel-industry-0');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Inline style.maxHeight (the synchronous target client.js just set),
    // not the CSS-transitioned rendered height — WebKit in particular can
    // paint the very first animation frame before Playwright's next read,
    // making getBoundingClientRect().height here a timing-dependent flake
    // (see this file's own "an open card panel recalculates..." test and
    // docs/UI_TESTING.md's "pre-existing flaky test" note for the same
    // issue found and fixed elsewhere in this file).
    await expect.poll(() => panel.evaluate((el) => el.style.maxHeight)).not.toBe('0px');
    const targetHeight = await panel.evaluate((el) => parseFloat(el.style.maxHeight));
    expect(targetHeight).toBeGreaterThan(0);
  });

  // Handbook Task 25
  test('a collapsed card panel is inert (not keyboard-focusable)', async ({ page }) => {
    await page.goto('/industries');
    await expect(page.locator('#panel-industry-0')).toHaveJSProperty('inert', true);
    await page.locator('#trigger-industry-0').click();
    await expect(page.locator('#panel-industry-0')).toHaveJSProperty('inert', false);
  });

  test('the type=button toggle button never submits/navigates', async ({ page }) => {
    await page.goto('/industries');
    await expect(page.locator('#trigger-industry-0')).toHaveAttribute('type', 'button');
  });

  // "Separate compact badges from full card grid. Do not globally alter
  // unrelated grid breakpoints." -- the homepage's compact badges
  // (industryBadge) and the Industries page's full cards (industryCard)
  // are, and remain, entirely separate components/classes/grids; the
  // fix for the confirmed home/contact overflow (minmax(0,1fr) on the
  // shared .grid-* helper — see styles.css) changed shrink behavior
  // only, not any breakpoint or column count, so this stays true.
  test('badges (homepage) and full cards (Industries page) are genuinely separate components', async ({ page }) => {
    await page.goto('/');
    const badges = page.locator('.industry-badge');
    await expect(badges.first()).toBeVisible();
    expect(await page.locator('.industry-card').count(), 'homepage must not render full industry cards').toBe(0);
    // Badges use the 4-column grid helper, unaffected by the 3-column grid the full page uses.
    await expect(badges.first().locator('..')).toHaveClass(/grid-4/);

    await page.goto('/industries');
    const cards = page.locator('.industry-card');
    await expect(cards.first()).toBeVisible();
    expect(await page.locator('.industry-badge').count(), 'Industries page must not render compact badges').toBe(0);
    await expect(cards.first().locator('..')).toHaveClass(/grid-3/);
  });

  // This site currently has an ODD number of industries (13) — exactly
  // the case that can visually orphan the last card in a 3-column grid.
  // No special-case code is needed (CSS Grid auto-flows a short last row
  // natively), but this proves it renders completely, without overflow,
  // rather than assuming an odd count "just works."
  test('an odd number of industries renders completely with no horizontal overflow', async ({ page }) => {
    await page.goto('/industries');
    const count = await page.locator('.industry-card').count();
    expect(count % 2, 'this test is only meaningful while the industry count is odd — update the worked example above if this ever changes').toBe(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  // Open panel heights recalculate on resize — a stale inline max-height
  // (captured at open time) would otherwise clip content or leave dead
  // space once the viewport (and therefore the panel's wrapped line
  // count) changes.
  test('an open card panel recalculates its height after a viewport resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/industries');
    const trigger = page.locator('#trigger-industry-0');
    const panel = page.locator('#panel-industry-0');
    await trigger.click();
    const wideHeight = await panel.evaluate((el) => parseFloat(el.style.maxHeight));

    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(300); // debounced resize handler
    const narrowMaxHeight = await panel.evaluate((el) => parseFloat(el.style.maxHeight));
    const narrowScrollHeight = await panel.evaluate((el) => el.scrollHeight);

    expect(narrowMaxHeight, 'max-height should track the panel\'s current scrollHeight after resize, not the value captured when it was opened').toBe(narrowScrollHeight);
    expect(narrowMaxHeight, 'narrower viewport should wrap this text onto more lines, increasing its height').toBeGreaterThan(wideHeight);
  });
});
