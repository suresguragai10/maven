const { test, expect } = require('@playwright/test');

const INDEXABLE_PAGES = [
  '/', '/about', '/services', '/outsourced-accounting', '/global-outsourcing',
  '/international-accounting', '/virtual-cfo', '/nfrs-ifrs', '/packages',
  '/documents-needed', '/industries', '/resources', '/useful-links',
  '/calculators', '/faq', '/contact', '/team', '/privacy', '/terms',
];

test.describe('Professional public-site quality pass', () => {
  test('Home leads with core finance capability, then establishes standards before international delivery', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toContainText('Kathmandu-based');
    await expect(page.locator('.hero')).toContainText('Remote international support');

    const order = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('main section'));
      const indexForEyebrow = (text) => sections.findIndex((s) => {
        const eyebrow = s.querySelector('.eyebrow');
        return eyebrow && eyebrow.textContent.trim() === text;
      });
      return {
        capabilities: indexForEyebrow('Core Capabilities'),
        standards: indexForEyebrow('How We Work'),
        international: indexForEyebrow('Global Outsourced Finance'),
        reporting: indexForEyebrow('Management Information'),
        knowledge: indexForEyebrow('Knowledge & Tools'),
      };
    });

    expect(order.capabilities).toBeGreaterThan(-1);
    expect(order.standards).toBeGreaterThan(order.capabilities);
    expect(order.international).toBeGreaterThan(order.standards);
    expect(order.reporting).toBeGreaterThan(order.international);
    expect(order.knowledge).toBeGreaterThan(order.reporting);
  });

  test('Services groups the 7 real services into 3 chapters, each with one local editorial image', async ({ page }) => {
    await page.goto('/services');
    const chapters = page.locator('.capability-chapter');
    await expect(chapters).toHaveCount(3);
    const images = chapters.locator('.capability-chapter-photo img');
    await expect(images).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(images.nth(i)).toHaveAttribute('src', /^\/images\/card-[a-z-]+\.jpg$/);
      const alt = await images.nth(i).getAttribute('alt');
      expect((alt || '').trim().length).toBeGreaterThan(10);
    }
  });

  test('Services keeps all 7 individual services deep-linkable, without a forced photo per service', async ({ page }) => {
    await page.goto('/services');
    const keys = ['registration', 'bookkeeping', 'tax', 'payroll', 'reporting', 'advisory', 'nfrs-ifrs'];
    for (const key of keys) {
      const entry = page.locator(`#${key}`);
      await expect(entry).toBeVisible();
      await expect(entry).toHaveClass(/service-card/);
      await expect(entry.locator('.service-card-photo, .service-editorial-photo')).toHaveCount(0);
    }
  });

  test('hero finance panel uses restrained interaction instead of permanent floating animation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-finance-panel')).toBeVisible();
    await expect(page.locator('.home-finance-panel')).toHaveCSS('animation-name', 'none');
  });


  test('footer keeps four navigation groups and a wider company column', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer.site-footer')).toBeVisible();
    await expect(page.locator('.footer-links .footer-col')).toHaveCount(4);

    const widths = await page.evaluate(() => {
      const brand = document.querySelector('.footer-brand').getBoundingClientRect().width;
      const firstLink = document.querySelector('.footer-links .footer-col').getBoundingClientRect().width;
      return { brand, firstLink };
    });
    expect(widths.brand).toBeGreaterThan(widths.firstLink);
  });

  test('floating actions clear the footer instead of covering footer content', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer.site-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    const geometry = await page.evaluate(() => {
      const footer = document.querySelector('.site-footer').getBoundingClientRect();
      const back = document.querySelector('.back-to-top').getBoundingClientRect();
      const clearance = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--floating-footer-clearance')) || 0;
      return { footerTop: footer.top, backBottom: back.bottom, clearance };
    });

    expect(geometry.clearance).toBeGreaterThan(0);
    expect(geometry.backBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
  });

  test('reduced-motion preference leaves reveal content immediately visible', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.hero .reveal-stagger').first()).toBeVisible();
    const revealEnabled = await page.locator('html').evaluate((el) => el.classList.contains('reveal-enabled'));
    expect(revealEnabled).toBe(false);
    await context.close();
  });
  test('important reveal content remains visible when JavaScript is disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.hero .reveal-stagger').first()).toBeVisible();
    await expect(page.locator('.home-standard-section .reveal').first()).toBeVisible();
    await context.close();
  });

  test('home stat numbers count up once when scrolled into view, then settle on the exact real value', async ({ page }) => {
    await page.goto('/');
    const firstStat = page.locator('.stat-value').first();
    // Off-screen until scrolled to -- the real, server-rendered final value
    // is already correct without JS (progressive enhancement), so this
    // only proves the animation itself runs and lands correctly, not that
    // the value is present at all.
    await firstStat.scrollIntoViewIfNeeded();
    const finalText = await firstStat.getAttribute('data-count-final');
    expect(finalText).toBeTruthy();
    // Sampled mid-animation: expect at least one intermediate frame that
    // isn't already the final text -- proves this is a real count-up, not
    // just the value appearing instantly.
    let sawIntermediate = false;
    for (let i = 0; i < 15; i++) {
      const current = await firstStat.textContent();
      if (current !== finalText) { sawIntermediate = true; break; }
      await page.waitForTimeout(20);
    }
    expect(sawIntermediate, 'expected to observe a mid-animation frame before the number reached its final value').toBe(true);
    await expect(firstStat).toHaveText(finalText, { timeout: 2000 });
  });

  test('reduced-motion: home stat numbers show their final value immediately, no count-up', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const firstStat = page.locator('.stat-value').first();
    const finalText = await firstStat.getAttribute('data-count-final');
    await firstStat.scrollIntoViewIfNeeded();
    await expect(firstStat).toHaveText(finalText);
    await context.close();
  });

  test('Home no longer repeats the About-page proof-panel composition', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.about-snapshot-copy')).toHaveCount(0);
    await expect(page.locator('.home-standard-section')).toBeVisible();
    await page.goto('/about');
    await expect(page.locator('.about-snapshot-copy')).toHaveCount(1);
  });

  for (const path of ['/international-accounting', '/virtual-cfo', '/nfrs-ifrs']) {
    test(`${path} informational disclosures start collapsed`, async ({ page }) => {
      await page.goto(path);
      const triggers = page.locator('.accordion-trigger');
      expect(await triggers.count()).toBeGreaterThan(0);
      for (let i = 0; i < await triggers.count(); i++) {
        await expect(triggers.nth(i)).toHaveAttribute('aria-expanded', 'false');
      }
    });
  }

  for (const path of INDEXABLE_PAGES) {
    test(`${path} has one H1 and no forward heading-level skip`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body h1')).toHaveCount(1);
      const levels = await page.locator('body h1, body h2, body h3, body h4, body h5, body h6').evaluateAll(
        (els) => els.map((el) => Number(el.tagName.slice(1)))
      );
      expect(levels[0], `first heading level on ${path}`).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1], `heading order on ${path}: ${levels.join(',')}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
