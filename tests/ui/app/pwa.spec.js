// PWA V1 (see docs/PRODUCT_BOUNDARIES.md "PWA V1 scope"): install-first
// and online-first only, never offline mutation or blind caching of
// authenticated Supabase/client/attendance/Work Desk data. This proves
// the actual browser-observable behavior, not just that the manifest/
// service-worker files exist and read correctly.
const { test, expect, devices } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
const CLIENT_ITEM = {
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: ADMIN.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: '2026-09-01', external_due_date: null, period: null, submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

test.describe('PWA V1 (install-first, online-first only)', () => {
  test('serves a valid, linked web app manifest naming the app and a standalone display mode', async ({ page }) => {
    await page.goto('/staff/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/staff/manifest.webmanifest');
    const manifest = await page.evaluate(async (href) => {
      const res = await fetch(href);
      return res.json();
    }, manifestHref);
    expect(manifest.name).toBe('Maven Work Desk');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/staff/');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('the service worker registers successfully, scoped to /staff/', async ({ page }) => {
    await page.goto('/staff/');
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { active: !!reg.active, scope: reg.scope };
    });
    expect(registered.active).toBe(true);
    expect(registered.scope).toContain('/staff/');
  });

  test('after real app use (login, load work items), zero Cache Storage entries exist -- nothing is cached, authenticated or otherwise', async ({ page }) => {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN], clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [],
        app_settings: [], projects: [], work_comments: [], work_checklist_items: [], work_activity: [],
        notifications: [], personal_todos: [], work_items: [CLIENT_ITEM], attendance_entries: [], attendance_corrections: [],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    await page.getByRole('button', { name: 'My Work', exact: true }).click();
    await expect(page.locator('.task-row').first()).toBeVisible();
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/staff/');
      return !!(reg && reg.active);
    });

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames, `expected zero Cache Storage entries, found: ${JSON.stringify(cacheNames)}`).toEqual([]);
  });

  test('a Supabase API request during real use is never intercepted from a service-worker cache -- it always reaches the mocked network layer', async ({ page }) => {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN], clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
        work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
        work_items: [CLIENT_ITEM], attendance_entries: [], attendance_corrections: [],
      },
    });
    const apiRequests = [];
    page.on('request', (req) => { if (req.url().includes('/rest/v1/work_items')) apiRequests.push(req.url()); });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    // work_items is re-fetched fresh on every navigation into a list view
    // (unlike profiles/clients, which load once at app-init and stay
    // cached in memory) -- if the service worker were serving a cached
    // response instead of reaching the mocked network layer, this count
    // would stop growing after the first navigation.
    await page.getByRole('button', { name: 'My Work', exact: true }).click();
    await expect.poll(() => apiRequests.length).toBeGreaterThan(0);
    const afterFirst = apiRequests.length;
    await page.getByRole('button', { name: 'Firm Work', exact: true }).click();
    await expect.poll(() => apiRequests.length).toBeGreaterThan(afterFirst);
  });
});

// Android Chrome reads the Web App Manifest directly and can prompt to
// install automatically. iOS Safari does not support the install prompt
// at all (a real, permanent Apple platform limitation, not something any
// web app can change) -- it relies on the apple-mobile-web-app-* meta
// tags instead, and installation only ever happens manually via the Share
// sheet's "Add to Home Screen." Both paths are checked on their own
// terms below rather than assuming one implies the other.
test.describe('PWA on mobile', () => {
  // Spread minus defaultBrowserType -- that field forces a specific
  // browser engine, which Playwright refuses inside a describe block
  // (this whole file already runs under a single --project browser).
  const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
  test.use({ ...pixel7 });

  test('Android: installability requirements are met at a real mobile viewport/UA -- manifest, service worker, and no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/staff/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/staff/manifest.webmanifest');
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(registered).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `login screen overflows horizontally on mobile by ${overflow}px`).toBeLessThanOrEqual(1);
    expect(errors, `console/page errors on mobile load:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Android: a full login + navigation session at mobile viewport still reaches the mocked network, not a cache', async ({ page }) => {
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN], clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [],
        projects: [], work_comments: [], work_checklist_items: [], work_activity: [], notifications: [],
        personal_todos: [], work_items: [CLIENT_ITEM], attendance_entries: [], attendance_corrections: [],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    // Mobile uses the off-canvas drawer for nav (Task 22) -- confirms the
    // installed-app experience isn't just the desktop layout scaled down,
    // it's the same real mobile nav this app already has, working
    // correctly alongside the service worker.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'My Work', exact: true }).click();
    await expect(page.locator('.task-row').first()).toBeVisible();
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toEqual([]);
  });

  test('iOS: the apple-mobile-web-app meta tags Safari actually reads for "Add to Home Screen" are present', async ({ page }) => {
    await page.goto('/staff/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/images/logo-icon.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Work Desk');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0A1F3A');
  });
});
