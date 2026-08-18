const { test, expect } = require('@playwright/test');

const FLOAT_WIDTHS = [320, 390, 768, 1440];
const INTERACTION_WIDTHS = [320, 390];
const CRITICAL_PAGES = [
  '/',
  '/services',
  '/industries',
  '/faq',
  '/about',
  '/international-accounting',
  '/contact',
];

async function expectNoDocumentOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    geometry.scrollWidth,
    `${label} overflowed horizontally (scrollWidth=${geometry.scrollWidth}, clientWidth=${geometry.clientWidth})`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectFloatingControlsInsideViewport(page, label) {
  const geometry = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const footer = document.querySelector('.site-footer').getBoundingClientRect();
    const whatsapp = document.querySelector('.whatsapp-float').getBoundingClientRect();
    const back = document.querySelector('.back-to-top').getBoundingClientRect();

    return {
      viewportWidth,
      footerTop: footer.top,
      whatsapp: {
        left: whatsapp.left,
        right: whatsapp.right,
        bottom: whatsapp.bottom,
        width: whatsapp.width,
        height: whatsapp.height,
      },
      back: {
        left: back.left,
        right: back.right,
        bottom: back.bottom,
        width: back.width,
        height: back.height,
      },
    };
  });

  for (const [name, rect] of Object.entries({
    WhatsApp: geometry.whatsapp,
    BackToTop: geometry.back,
  })) {
    expect(
      rect.left,
      `${label}: ${name} escaped the left viewport edge`
    ).toBeGreaterThanOrEqual(-1);

    expect(
      rect.right,
      `${label}: ${name} escaped the right viewport edge`
    ).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    expect(
      rect.width,
      `${label}: ${name} touch target became too small`
    ).toBeGreaterThanOrEqual(40);

    expect(
      rect.height,
      `${label}: ${name} touch target became too small`
    ).toBeGreaterThanOrEqual(40);

    if (geometry.footerTop >= 0) {
      expect(
        rect.bottom,
        `${label}: ${name} overlaps footer content`
      ).toBeLessThanOrEqual(geometry.footerTop + 1);
    }
  }
}

test.describe('Batch 2C responsive verification gate', () => {
  for (const width of FLOAT_WIDTHS) {
    test(`floating controls behave deliberately at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const back = page.locator('.back-to-top');
      await expect(back).not.toHaveClass(/is-visible/);

      await page.evaluate(() =>
        window.scrollTo(0, Math.max(700, window.innerHeight))
      );

      await expect(back).toHaveClass(/is-visible/);

      await page.locator('footer.site-footer').scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);

      await expectFloatingControlsInsideViewport(
        page,
        `home @ ${width}px`
      );

      await expectNoDocumentOverflow(
        page,
        `home footer state @ ${width}px`
      );
    });
  }

  for (const width of INTERACTION_WIDTHS) {
    test(`mobile nav + submenu do not introduce overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      await page.locator('.nav-toggle').click();
      await page
        .locator('.mobile-sub-toggle[aria-controls="mobile-sub-services"]')
        .click();

      await expectNoDocumentOverflow(
        page,
        `mobile nav @ ${width}px`
      );
    });

    test(`Industries detail stays inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/industries');

      await page.locator('[data-industry-index="0"]').click();

      await expect(
        page.locator('[data-industry-detail="0"]')
      ).toBeVisible();

      await expectNoDocumentOverflow(
        page,
        `Industries detail @ ${width}px`
      );
    });

    test(`FAQ open state stays inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/faq');

      await page.locator('#trigger-faq-0').click();

      await expect(
        page.locator('#panel-faq-0')
      ).toBeVisible();

      await expectNoDocumentOverflow(
        page,
        `FAQ open state @ ${width}px`
      );
    });

    test(`Contact validation state stays inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/contact');

      await page
        .locator('#inquiryForm button[type="submit"]')
        .click();

      await expect(
        page.locator('#formError')
      ).toBeVisible();

      await expectNoDocumentOverflow(
        page,
        `Contact validation @ ${width}px`
      );
    });

    test(`EMI schedule remains contained in its own scroller at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/calculators');

      await page
        .locator('.calc-tab[data-target="calc-tab-emi"]')
        .click();

      await page.locator('#emi-amount').fill('2000000');
      await page.locator('#emi-rate').fill('10.5');
      await page.locator('#emi-years').fill('10');
      await page.locator('#emi-toggle-sched').click();

      await expect(
        page.locator('#emi-sched-wrap')
      ).toBeVisible();

      await expectNoDocumentOverflow(
        page,
        `EMI schedule @ ${width}px`
      );

      const scroller = await page
        .locator('.emi-sched-scroll')
        .evaluate((el) => ({
          overflowX: getComputedStyle(el).overflowX,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
        }));

      expect(['auto', 'scroll']).toContain(scroller.overflowX);
      expect(scroller.scrollWidth).toBeGreaterThanOrEqual(
        scroller.clientWidth
      );
    });
  }

  for (const path of CRITICAL_PAGES) {
    test(`${path} has no uncaught runtime error or broken local asset at mobile review width`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      const pageErrors = [];
      const localFailures = [];

      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      page.on('response', (response) => {
        const url = new URL(response.url());

        if (
          (url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1') &&
          response.status() >= 400
        ) {
          localFailures.push(
            `${response.status()} ${url.pathname}`
          );
        }
      });

      await page.goto(path);
      await page.waitForTimeout(80);

      expect(
        pageErrors,
        `${path} emitted runtime errors`
      ).toEqual([]);

      expect(
        localFailures,
        `${path} requested broken local assets/routes`
      ).toEqual([]);
    });
  }
});