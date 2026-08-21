const { test, expect } = require('@playwright/test');

// Handbook Task 26: a focused accessibility regression pass. These tests
// check keyboard/ARIA correctness that isn't already covered by
// nav-dropdown.spec.js, mobile-nav.spec.js, faq.spec.js, documents.spec.js,
// or industries.spec.js (see docs/UI_TESTING.md for what those already
// assert) -- landmarks, heading structure, form error association, and the
// calculator page's controls, which had no dedicated coverage before this.

test.describe('Skip link', () => {
  test('is the first focusable element and jumps to #main', async ({ page, browserName }) => {
    await page.goto('/');
    const skip = page.locator('.skip-link');
    await expect(skip).toHaveAttribute('href', '#main');
    await expect(page.locator('#main')).toHaveCount(1);

    // WebKit's default Tab order excludes plain <a> links (this matches
    // real desktop Safari's own default "Tab moves between form controls
    // only" setting, not something a site's markup can change) -- so a
    // literal keyboard.press('Tab') never reaches an anchor-only skip
    // link there. Chromium/Firefox tab to links by default, same as most
    // desktop screen readers' virtual cursors, so this checks real Tab
    // behavior on the browsers where it's meaningful and still asserts
    // the underlying markup (href/positioning) unconditionally above.
    test.skip(browserName === 'webkit', 'WebKit default Tab order excludes links, matching real Safari — not testable via keyboard.press("Tab")');
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
  });
});

test.describe('Landmarks', () => {
  test('exactly one main, and Primary/Mobile/Footer nav landmarks are labeled distinctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main')).toHaveCount(1);
    const navs = page.locator('nav');
    await expect(navs).toHaveCount(3);
    await expect(page.locator('nav.main-nav')).toHaveAttribute('aria-label', 'Primary');
    await expect(page.locator('nav.mobile-nav')).toHaveAttribute('aria-label', 'Mobile');
    await expect(page.locator('nav.footer-links')).toHaveAttribute('aria-label', 'Footer');
  });

  test('header/footer toggle buttons declare type="button"', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-toggle')).toHaveAttribute('type', 'button');
    await expect(page.locator('.mobile-nav-close')).toHaveAttribute('type', 'button');
    await expect(page.locator('.back-to-top')).toHaveAttribute('type', 'button');
  });
});

test.describe('Heading structure (Handbook Task 26)', () => {
  test('FAQ questions are real h2 headings, not just button text', async ({ page }) => {
    await page.goto('/faq');
    const firstQuestionHeading = page.locator('h2.accordion-heading').first();
    await expect(firstQuestionHeading).toBeVisible();
    await expect(firstQuestionHeading.locator('button.accordion-trigger')).toHaveCount(1);
  });

  test('Documents Needed groups are real h2 headings', async ({ page }) => {
    await page.goto('/documents-needed');
    await expect(page.locator('h2.accordion-heading').first()).toBeVisible();
  });

  test('a support-area accordion nested under a sectionHead uses h3, not h2', async ({ page }) => {
    await page.goto('/nfrs-ifrs');
    await expect(page.locator('h3.accordion-heading').first()).toBeVisible();
  });

  test('Industries detail stage uses h2 (no heading-level skip from the page h1)', async ({ page }) => {
    // Task 06: the compact selector list is real <button> rows (no per-row
    // heading — screen readers navigate it as a list, via .industry-list's
    // aria-label, not via heading shortcuts). The heading-level guarantee
    // now comes from the detail stage instead: the placeholder's h2 before
    // any selection, and each industry's own h2 (industryDetail()) once
    // selected -- never a jump straight to h3 anywhere on this page.
    await page.goto('/industries');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
    await expect(page.locator('.industry-detail-placeholder h2')).toBeVisible();

    await page.locator('[data-industry-index="0"]').click();
    await expect(page.locator('[data-industry-detail="0"] h2')).toBeVisible();
  });

  test('Team cards are h3, nested under the page\'s own "Our Team" h2 (no heading-level skip)', async ({ page }) => {
    // Task 08: team() now renders a real sectionHead() (h2, "Our Team")
    // above the card grid, so each member's name correctly nests one
    // level under it as h3 -- not h2 as before Task 08, when no such h2
    // existed yet on this page.
    await page.goto('/team');
    await expect(page.locator('h2', { hasText: 'Our Team' })).toBeVisible();
    await expect(page.locator('.team-card-name').first()).toHaveJSProperty('tagName', 'H3');
  });

  test('Contact info items use h3, matching the page h2 -> h3 -> h3 order (no skip to h4)', async ({ page }) => {
    await page.goto('/contact');
    const headingLevels = await page.locator('#main h1, #main h2, #main h3, #main h4, #main h5, #main h6').evaluateAll(
      (els) => els.map((el) => Number(el.tagName.slice(1)))
    );
    for (let i = 1; i < headingLevels.length; i++) {
      expect(headingLevels[i] - headingLevels[i - 1], `heading order was ${headingLevels.join(',')}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Contact form errors (Handbook Task 26)', () => {
  test('a blocked submission is announced via role=alert, focused, and associates aria-invalid fields', async ({ page }) => {
    await page.goto('/contact');
    const errorEl = page.locator('#formError');
    await expect(errorEl).toHaveAttribute('role', 'alert');

    await page.locator('#inquiryForm button[type="submit"]').click();

    await expect(errorEl).toBeVisible();
    await expect(errorEl).toBeFocused();
    await expect(page.locator('#f-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-name')).toHaveAttribute('aria-describedby', 'formError');
    await expect(page.locator('#f-phone')).toHaveAttribute('aria-invalid', 'true');
  });

  test('a valid submission with only a bad email marks just the email field invalid', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('#f-name').fill('Test User');
    await page.locator('#f-phone').fill('9800000000');
    await page.locator('#f-service').selectOption({ index: 1 });
    await page.locator('#f-message').fill('Test message body.');
    await page.locator('#f-email').fill('not-an-email');

    await page.locator('#inquiryForm button[type="submit"]').click();

    await expect(page.locator('#formError')).toBeFocused();
    await expect(page.locator('#f-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#f-name')).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('Calculators page (Handbook Task 26)', () => {
  test('the tab bar is a complete WAI-ARIA tabs pattern with working arrow-key navigation', async ({ page }) => {
    await page.goto('/calculators');
    const tabs = page.locator('.calc-tab');
    await expect(tabs).toHaveCount(4);

    const firstTab = tabs.nth(0);
    await expect(firstTab).toHaveAttribute('role', 'tab');
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await expect(firstTab).toHaveAttribute('tabindex', '0');
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');

    await expect(page.locator('#calc-tab-tax')).toHaveAttribute('role', 'tabpanel');
    await expect(page.locator('#calc-tab-tax')).toHaveAttribute('aria-labelledby', 'tab-calc-tab-tax');

    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#calc-tab-vat')).toBeVisible();
    await expect(page.locator('#calc-tab-tax')).toBeHidden();

    await page.keyboard.press('End');
    await expect(tabs.nth(3)).toBeFocused();
    await expect(page.locator('#calc-tab-emi')).toBeVisible();

    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toBeFocused();
    await expect(page.locator('#calc-tab-tax')).toBeVisible();
  });

  test('the Income Tax headline result is an aria-live region that updates as you type', async ({ page }) => {
    await page.goto('/calculators');
    const out = page.locator('#tax-out-annual');
    await expect(out).toHaveAttribute('aria-live', 'polite');
    const before = await out.textContent();
    await page.locator('#tax-monthly-salary').fill('150000');
    await expect(out).not.toHaveText(before);
  });

  test('EMI schedule toggle has correct aria-expanded/aria-controls and stays in sync', async ({ page }) => {
    await page.goto('/calculators');
    await page.locator('.calc-tab[data-target="calc-tab-emi"]').click();
    const toggle = page.locator('#emi-toggle-sched');
    await expect(toggle).toHaveAttribute('aria-controls', 'emi-sched-wrap');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.locator('#emi-amount').fill('2000000');
    await page.locator('#emi-rate').fill('10.5');
    await page.locator('#emi-years').fill('10');
    await expect(toggle).toBeEnabled();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#emi-sched-wrap')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#emi-sched-wrap')).toBeHidden();
  });
});
