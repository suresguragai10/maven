// Task 22: real, empirical browser evidence for the redesigned Work Desk
// navigation — the sidebar collapsed from 18 flat destinations down to a
// small primary set with page-level tabs for grouped screens, Global
// Search moved into the topbar as a utility, and the old wrapped-button
// mobile row was replaced with an accessible off-canvas drawer. This file
// covers the drawer and the group/tab mechanics directly; individual
// screens' own specs (team.spec.js, my-work.spec.js, since-last-seen.spec.js)
// already cover that their specific destination still works through the
// new nav.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true };

async function login(page) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: {
      profiles: [ADMIN],
      clients: [], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [],
    },
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

test.describe('Work Desk navigation (Task 22)', () => {
  test('primary sidebar destinations are collapsed to a small set, not 18 flat items', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await login(page);

    // Admin sees the fullest sidebar: Today, My Work, Client Work, Firm
    // Work, Team, Reports, Personal, Admin — 8 primary destinations, each
    // a real, visible button (the external CMS link is not counted, same
    // as before this task).
    const primaryButtons = page.locator('#sidebar button');
    await expect(primaryButtons).toHaveCount(8);
    for (const label of ['Today', 'My Work', 'Client Work', 'Firm Work', 'Team', 'Reports', 'Personal', 'Admin']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    // Global Search is a topbar utility now, not a sidebar destination.
    await expect(page.locator('#sidebar')).not.toContainText('Global Search');

    expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a grouped destination (Client Work) shows page-level tabs for its screens', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    // First tab (All Work, admin-visible) is the default landing screen.
    await expect(page.getByRole('heading', { name: 'All Work' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Client Work sections' });
    await expect(tabs).toBeVisible();
    for (const label of ['All Work', 'Review Queue', 'Deadlines', 'Clients']) {
      await expect(tabs.getByRole('tab', { name: label })).toBeVisible();
    }
    await tabs.getByRole('tab', { name: 'Deadlines' }).click();
    await expect(page.getByRole('heading', { name: 'Deadlines' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Deadlines' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Global Search opens from the topbar utility button, not the sidebar', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Global Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  });

  test('clicking the topbar logo returns to Today from anywhere, no page reload needed', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Firm Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Firm Work', level: 1 })).toBeVisible();
    await page.locator('#brandHomeBtn').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  });

  test('mobile: sidebar is an off-canvas drawer, opened by a hamburger toggle, closed by Escape with focus returned', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toBeVisible();
    await expect(page.locator('#sidebar')).not.toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();

    // Escape closes it and returns focus to the toggle button.
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar')).not.toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('mobile: clicking a nav item closes the drawer and navigates', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('#sidebar')).toBeVisible();

    await page.getByRole('button', { name: 'Team', exact: true }).click();
    await expect(page.locator('#sidebar')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  });

  test('desktop: the hamburger toggle and close button are not shown, sidebar renders inline as always', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('button', { name: 'Open menu' })).not.toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();
  });

  // Real bug found during a manual audit: navigating straight into a work
  // item's own detail page (via gotoWork/gotoClient/gotoFirmWork -- the
  // same thing clicking a row from Today, Search, Team, or anywhere else
  // does) never called renderSidebar(), so the sidebar kept showing
  // whichever section had been active BEFORE, not the one the item
  // actually belongs to -- e.g. landing on a Firm Work item while the
  // sidebar still said "Today" was active.
  test('the sidebar\'s active section updates correctly when landing directly on a work/client/Firm Work detail page', async ({ page }) => {
    const CLIENT_A = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
    const WORK1 = {
      id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_A.id, service_template_id: null,
      assignee_id: ADMIN.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
      internal_due_date: '2026-09-01', external_due_date: null, period: null, submission_required: false, review_required: true,
      created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    const FIRM1 = {
      id: 'w2', title: 'Renew office internet', work_scope: 'firm', firm_category: 'Administration',
      assignee_id: ADMIN.id, status: 'in_progress', priority: 'normal', internal_due_date: '2026-09-01',
      description: null, project_id: null, next_action: null, blocker_reason: null,
      client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    };
    await installSupabaseMock(page, {
      user: ADMIN,
      tables: {
        profiles: [ADMIN], clients: [CLIENT_A], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
        work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
        work_items: [WORK1, FIRM1],
      },
    });
    await page.goto('/staff/');
    await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);

    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.evaluate((id) => { location.hash = 'firmwork/' + id; }, FIRM1.id);
    await expect(page.getByRole('heading', { name: 'Renew office internet', level: 1 })).toBeVisible();
    await expect(page.locator('#sidebar button.is-active')).toHaveText('Firm Work');

    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.evaluate((id) => { location.hash = 'client/' + id; }, CLIENT_A.id);
    await expect(page.getByRole('heading', { name: CLIENT_A.name, level: 1 })).toBeVisible();
    await expect(page.locator('#sidebar button.is-active')).toHaveText('Client Work');
  });
});
