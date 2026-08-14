const { test, expect } = require('@playwright/test');

// content/site.yaml currently has pages.testimonials.hidden=true and
// pages.blog.hidden=true (real content not written yet — see
// maven_hero_photo_rollout / backend worklist memory). layout.js's
// data.isVisible() excludes hidden pages from navStructure entirely.
// This asserts that exclusion actually holds in the rendered output, on
// both the desktop dropdown and the mobile panel — a page merely existing
// in dist/ (noindex'd, directly linkable) is fine; it appearing in nav
// while hidden would not be.
test.describe('Hidden pages stay out of navigation while visibility flags are hidden', () => {
  test('no Blog or Testimonials link in desktop nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const desktopLinks = page.locator('nav.main-nav a');
    await expect(desktopLinks.filter({ hasText: 'Blog' })).toHaveCount(0);
    await expect(desktopLinks.filter({ hasText: 'Testimonials' })).toHaveCount(0);

    const hrefs = await desktopLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs.some((h) => h && h.includes('blog'))).toBe(false);
    expect(hrefs.some((h) => h && h.includes('testimonials'))).toBe(false);
  });

  test('no Blog or Testimonials link in mobile nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('.nav-toggle').click();

    const mobileLinks = page.locator('.mobile-nav a');
    const hrefs = await mobileLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs.some((h) => h && h.includes('blog'))).toBe(false);
    expect(hrefs.some((h) => h && h.includes('testimonials'))).toBe(false);
  });

  test('the pages still exist directly (noindex, not deleted) — confirms this is a nav-visibility flag, not a missing page', async ({ page }) => {
    const blogResponse = await page.goto('/blog');
    expect(blogResponse.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const testimonialsResponse = await page.goto('/testimonials');
    expect(testimonialsResponse.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
