const { test, expect } = require('@playwright/test');

const INDEXABLE_PAGES = [
  '/', '/about', '/services', '/outsourced-accounting', '/global-outsourcing',
  '/international-accounting', '/virtual-cfo', '/nfrs-ifrs', '/packages',
  '/documents-needed', '/industries', '/resources', '/useful-links',
  '/calculators', '/faq', '/contact', '/team', '/privacy',
];

test.describe('Professional public-site quality pass', () => {
  test('Home keeps Nepal-first sections ahead of the secondary International showcase', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toContainText('Kathmandu, Nepal');

    const order = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('main section'));
      const indexForEyebrow = (text) => sections.findIndex((s) => {
        const eyebrow = s.querySelector('.eyebrow');
        return eyebrow && eyebrow.textContent.trim() === text;
      });
      return {
        services: indexForEyebrow('What We Do'),
        packages: indexForEyebrow('Packages'),
        industries: indexForEyebrow('Industries We Serve'),
        international: indexForEyebrow('International Services'),
      };
    });

    expect(order.services).toBeGreaterThan(-1);
    expect(order.packages).toBeGreaterThan(order.services);
    expect(order.industries).toBeGreaterThan(order.packages);
    expect(order.international).toBeGreaterThan(order.industries);
  });

  test('Services uses local editorial images instead of hot-linked production photos', async ({ page }) => {
    await page.goto('/services');
    const rows = page.locator('.service-editorial');
    expect(await rows.count()).toBeGreaterThan(0);
    const images = rows.locator('.service-editorial-photo img');
    await expect(images).toHaveCount(await rows.count());
    for (let i = 0; i < await images.count(); i++) {
      await expect(images.nth(i)).toHaveAttribute('src', /^\/images\/card-[a-z-]+\.jpg$/);
      const alt = await images.nth(i).getAttribute('alt');
      expect((alt || '').trim().length).toBeGreaterThan(10);
    }
  });

  test('hero accents do not run permanent floating animations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-float-badge')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.doc-card-stamp')).toHaveCSS('animation-name', 'none');
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
      const whatsapp = document.querySelector('.whatsapp-float').getBoundingClientRect();
      const back = document.querySelector('.back-to-top').getBoundingClientRect();
      const clearance = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--floating-footer-clearance')) || 0;
      return { footerTop: footer.top, whatsappBottom: whatsapp.bottom, backBottom: back.bottom, clearance };
    });

    expect(geometry.clearance).toBeGreaterThan(0);
    expect(geometry.whatsappBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
    expect(geometry.backBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
  });

  test('reduced-motion preference leaves reveal content immediately visible', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.hero .reveal').first()).toBeVisible();
    const revealEnabled = await page.locator('html').evaluate((el) => el.classList.contains('reveal-enabled'));
    expect(revealEnabled).toBe(false);
    await context.close();
  });
  test('important reveal content remains visible when JavaScript is disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.hero .reveal').first()).toBeVisible();
    await expect(page.locator('.home-about-section .reveal').first()).toBeVisible();
    await context.close();
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
    test(`${path} has no forward heading-level skip`, async ({ page }) => {
      await page.goto(path);
      const levels = await page.locator('#main h1, #main h2, #main h3, #main h4, #main h5, #main h6').evaluateAll(
        (els) => els.map((el) => Number(el.tagName.slice(1)))
      );
      expect(levels[0], `first heading level on ${path}`).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1], `heading order on ${path}: ${levels.join(',')}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
