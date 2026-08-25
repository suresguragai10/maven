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

  test('manifest icons cover the sizes installability actually needs, including a maskable variant', async ({ page }) => {
    await page.goto('/staff/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await page.evaluate(async (href) => {
      const res = await fetch(href);
      return res.json();
    }, manifestHref);

    const anyIcons = manifest.icons.filter((i) => (i.purpose || 'any') === 'any');
    expect(anyIcons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(anyIcons.some((i) => i.sizes === '512x512')).toBe(true);
    const maskable = manifest.icons.find((i) => i.purpose === 'maskable');
    expect(maskable).toBeTruthy();
    expect(maskable.sizes).toBe('512x512');

    // Every icon the manifest points at must actually exist and load.
    for (const icon of manifest.icons) {
      const res = await page.request.get(icon.src);
      expect(res.status(), `${icon.src} should exist`).toBe(200);
    }
  });

  test('the custom "Install App" button appears only after the browser signals installability, and triggers the real prompt', async ({ page }) => {
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

    const installBtn = page.locator('#installAppBtn');
    await expect(installBtn).toBeHidden();

    // Simulate the browser deciding the app is installable -- real Chrome
    // fires this natively; there's no way to force that heuristic in a
    // test, so this dispatches the same event shape staff.js listens for.
    await page.evaluate(() => {
      const evt = new Event('beforeinstallprompt', { cancelable: true });
      window.__installPromptCalled = false;
      evt.prompt = () => { window.__installPromptCalled = true; return Promise.resolve(); };
      evt.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(evt);
    });
    await expect(installBtn).toBeVisible();

    await installBtn.click();
    await expect(installBtn).toBeHidden();
    expect(await page.evaluate(() => window.__installPromptCalled)).toBe(true);
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

  test('after real app use (login, load work items), the only Cache Storage entry is the static offline fallback page -- nothing authenticated or dynamic is ever cached', async ({ page }) => {
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
    expect(cacheNames).toEqual(['maven-work-desk-offline-v1']);
    const cachedUrls = await page.evaluate(async () => {
      const cache = await caches.open('maven-work-desk-offline-v1');
      const reqs = await cache.keys();
      return reqs.map((r) => new URL(r.url).pathname);
    });
    expect(cachedUrls).toEqual(['/staff/offline.html']);
  });

  test('losing the connection shows the friendly offline page, not a browser error, and reconnecting recovers normally', async ({ page, context, browserName }) => {
    // Playwright's context.setOffline() combined with a service-worker-
    // intercepted navigation is only reliable in Chromium -- Firefox's
    // offline simulation never reaches the SW fetch handler at all (the
    // navigation just fails with no offline.html shown), and WebKit's
    // automation layer throws its own internal error mid-navigation. Both
    // are limitations of each browser's Playwright driver, not of the
    // feature itself -- real Safari/Firefox users hitting a genuine
    // network failure go through the actual OS network stack, which does
    // invoke the service worker normally. Chromium is also the one engine
    // that matters most here in practice, since beforeinstallprompt (the
    // custom install button above) is Chromium-only too.
    test.skip(browserName !== 'chromium', 'context.setOffline() + SW-intercepted navigation is only reliably testable in Chromium — see comment above');
    // First visit online so the service worker installs and caches
    // offline.html -- the fallback can only exist once that has happened.
    await page.goto('/staff/');
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/staff/');
      return !!(reg && reg.active);
    });
    await page.waitForFunction(async () => {
      const cache = await caches.open('maven-work-desk-offline-v1');
      return !!(await cache.match('/staff/offline.html'));
    });

    await context.setOffline(true);
    await page.goto('/staff/');
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();

    // Reconnecting and retrying reaches the real app again, not a stuck
    // offline page -- confirms this is a fallback for one failed
    // navigation, not a trap.
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page.locator('#loginScreen')).toBeVisible();
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
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/staff/');
      return !!(reg && reg.active);
    });
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toEqual(['maven-work-desk-offline-v1']);
  });

  test('iOS: the apple-mobile-web-app meta tags Safari actually reads for "Add to Home Screen" are present', async ({ page }) => {
    await page.goto('/staff/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/images/apple-touch-icon.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Work Desk');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0A1F3A');
  });
});
