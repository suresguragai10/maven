const { test, expect } = require('@playwright/test');
const { OVERFLOW_PAGES, OVERFLOW_WIDTHS } = require('../support/pages');

// Regression protection for V2 Task 20's finding (a ~45px horizontal
// overflow on a 375px viewport, on the Staff app's Today list -- see
// docs/UI_TESTING.md). This suite covers the PUBLIC site only, per this
// task's own "PUBLIC SMOKE COVERAGE" scope; the app-side overflow bug
// itself needs an authenticated session to reproduce and stays out of
// scope here (see app/staff.spec.js for what IS covered without login).
for (const path of OVERFLOW_PAGES) {
  test.describe(`No horizontal overflow — ${path}`, () => {
    for (const width of OVERFLOW_WIDTHS) {
      test(`at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        // 1px tolerance for subpixel rounding across engines.
        expect(scrollWidth, `${path} overflows horizontally at ${width}px (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`)
          .toBeLessThanOrEqual(clientWidth + 1);
      });
    }
  });
}
