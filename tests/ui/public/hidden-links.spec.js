const { test, expect } = require('@playwright/test');

// content/site.yaml has pages.blog.hidden=true (real content not written
// yet). Testimonials was deliberately switched to hidden=false once real
// client quotes were added (see maven_hero_photo_rollout memory). layout.js's
// data.isVisible() excludes hidden pages from navStructure entirely.
// This asserts that exclusion holds for Blog, on both the desktop dropdown
// and the mobile panel, and that Testimonials -- now enabled -- appears in
// both and is indexable.
test.describe('Hidden pages stay out of navigation while visibility flags are hidden', () => {
  test('no Blog link in desktop nav; Testimonials link present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const desktopLinks = page.locator('nav.main-nav a');
    await expect(desktopLinks.filter({ hasText: 'Blog' })).toHaveCount(0);
    await expect(desktopLinks.filter({ hasText: 'Testimonials' })).toHaveCount(1);

    const hrefs = await desktopLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs.some((h) => h && h.includes('blog'))).toBe(false);
    expect(hrefs.some((h) => h && h.includes('testimonials'))).toBe(true);
  });

  test('no Blog link in mobile nav; Testimonials link present', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('.nav-toggle').click();

    const mobileLinks = page.locator('.mobile-nav a');
    const hrefs = await mobileLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs.some((h) => h && h.includes('blog'))).toBe(false);
    expect(hrefs.some((h) => h && h.includes('testimonials'))).toBe(true);
  });

  test('blog still exists directly (noindex, not deleted); testimonials is indexable now', async ({ page }) => {
    const blogResponse = await page.goto('/blog');
    expect(blogResponse.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const testimonialsResponse = await page.goto('/testimonials');
    expect(testimonialsResponse.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});
