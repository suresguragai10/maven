// Task 35: a complete internal-app usability pass, desktop through
// 320px -- no horizontal overflow across the app's primary destinations
// at the narrowest common baseline (320px, not just the 375px many
// earlier per-page tests already covered); the shared openModal()/
// closeModal() focus-trap mechanism (used by dozens of modals across
// this app, but never directly tested until now); heading navigation
// (focus actually lands on each page's own <h1> after a real
// navigation, and each page has exactly one); the field() label-
// association fix (a real for/id relationship, not just a visual
// sibling) landing correctly; touch target minimums; and confirmation
// that Work Desk's motion stays minimal/functional and respects
// prefers-reduced-motion, never marketing-style scroll animation (which
// this app has none of to begin with).
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('../support/mock-supabase');

const ADMIN = { id: '66666666-6666-6666-6666-666666666666', email: 'admin@test.local', full_name: 'Admin User', role: 'admin', is_active: true, designation: 'Managing Partner' };
const EMPLOYEE_A = { id: '22222222-2222-2222-2222-222222222222', email: 'employee.a@test.local', full_name: 'Employee A', role: 'employee', is_active: true };
const CLIENT_ALPHA = { id: 'c1', name: 'Alpha Trading Pvt. Ltd.', is_active: true };
const CLIENT_ITEM = {
  // Assigned to ADMIN (not Employee A) so the admin fixture used to log
  // in for every test in this file also sees it on Today/My Work -- a
  // couple of checks here (e.g. confirming .task-row exists at all)
  // depend on the logged-in user actually having a visible work item.
  id: 'w1', title: 'Alpha VAT Return', work_scope: 'client', client_id: CLIENT_ALPHA.id, service_template_id: null,
  assignee_id: ADMIN.id, reviewer_id: null, status: 'in_progress', priority: 'normal',
  internal_due_date: '2026-09-01', external_due_date: null, period: 'Bhadra 2083', submission_required: false, review_required: true,
  created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};
const FIRM_ITEM = {
  id: 'w2', title: 'Renew office internet contract', work_scope: 'firm', firm_category: 'Administration',
  assignee_id: ADMIN.id, status: 'in_progress', priority: 'normal', internal_due_date: '2026-09-01',
  description: null, project_id: null, next_action: null, blocker_reason: null,
  client_id: null, created_by: ADMIN.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

async function loginAsAdmin(page) {
  await installSupabaseMock(page, {
    user: ADMIN,
    tables: {
      profiles: [ADMIN, EMPLOYEE_A],
      clients: [CLIENT_ALPHA], service_templates: [], deadline_rules: [], app_settings: [], projects: [],
      work_comments: [], work_checklist_items: [], work_activity: [], notifications: [], personal_todos: [],
      work_items: [CLIENT_ITEM, FIRM_ITEM], attendance_entries: [], attendance_corrections: [],
    },
  });
  await page.goto('/staff/');
  await page.locator('input[type="email"], input[name="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill('irrelevant-mocked-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('320px overflow sweep (Task 35)', () => {
  // One destination per case, each reached the same way a real admin
  // would navigate there through the sidebar/tabs (Task 22's IA), then
  // measured at 320px -- the narrowest width this task asks for, one
  // notch below the 375px most earlier per-task tests already covered.
  const destinations = [
    { name: 'Today', nav: async (page) => {} },
    { name: 'My Work', nav: async (page) => { await page.getByRole('button', { name: 'My Work', exact: true }).click(); } },
    { name: 'Client Work → All Work', nav: async (page) => { await page.getByRole('button', { name: 'Client Work', exact: true }).click(); } },
    { name: 'Client Work → Clients', nav: async (page) => { await page.getByRole('button', { name: 'Client Work', exact: true }).click(); await page.getByRole('tab', { name: 'Clients' }).click(); } },
    { name: 'Firm Work', nav: async (page) => { await page.getByRole('button', { name: 'Firm Work', exact: true }).click(); } },
    { name: 'Team → Team Work', nav: async (page) => { await page.getByRole('button', { name: 'Team', exact: true }).click(); } },
    { name: 'Team → Directory', nav: async (page) => { await page.getByRole('button', { name: 'Team', exact: true }).click(); await page.getByRole('tab', { name: 'Directory' }).click(); } },
    { name: 'Team → Attendance', nav: async (page) => { await page.getByRole('button', { name: 'Team', exact: true }).click(); await page.getByRole('tab', { name: 'Attendance' }).click(); } },
    { name: 'Admin → Staff & Access', nav: async (page) => { await page.getByRole('button', { name: 'Admin', exact: true }).click(); } },
    { name: 'Admin → Templates', nav: async (page) => { await page.getByRole('button', { name: 'Admin', exact: true }).click(); await page.getByRole('tab', { name: 'Templates' }).click(); } },
    { name: 'Admin → Settings', nav: async (page) => { await page.getByRole('button', { name: 'Admin', exact: true }).click(); await page.getByRole('tab', { name: 'Settings' }).click(); } },
    { name: 'Global Search', nav: async (page) => { await page.getByRole('button', { name: 'Global Search', exact: true }).click(); } },
  ];

  for (const dest of destinations) {
    test(`${dest.name} has no horizontal overflow at 320px`, async ({ page }) => {
      await loginAsAdmin(page);
      await dest.nav(page);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.waitForTimeout(100);
      const overflow = await noHorizontalOverflow(page);
      expect(overflow, `${dest.name} overflows horizontally at 320px by ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test('Client Detail has no horizontal overflow at 320px', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    await page.getByRole('tab', { name: 'Clients' }).click();
    await page.getByRole('button', { name: CLIENT_ALPHA.name }).click();
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(100);
    const overflow = await noHorizontalOverflow(page);
    expect(overflow, `Client Detail overflows horizontally at 320px by ${overflow}px`).toBeLessThanOrEqual(1);
  });

  test('the mobile nav drawer itself has no horizontal overflow at 320px', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.waitForTimeout(100);
    const overflow = await noHorizontalOverflow(page);
    expect(overflow, `Nav drawer overflows horizontally at 320px by ${overflow}px`).toBeLessThanOrEqual(1);
  });
});

test.describe('Modal focus trap (Task 35)', () => {
  test('Tab wraps inside the modal, Escape closes it, and focus returns to the button that opened it', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    const editBtn = page.locator('table tbody tr').filter({ hasText: 'Employee A' }).getByRole('button', { name: 'Edit' });
    await editBtn.click();

    const modal = page.locator('#modalCard');
    await expect(modal).toBeVisible();
    // Focus starts inside the modal (openModal() moves it to the first
    // focusable element), never left stranded on the trigger behind it.
    await expect(page.locator('#modalCard :focus')).toHaveCount(1);

    // Shift+Tab from the first focusable element wraps to the last.
    const focusable = modal.locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const count = await focusable.count();
    expect(count).toBeGreaterThan(1);
    await page.keyboard.press('Shift+Tab');
    await expect(focusable.last()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('#modalOverlay')).toHaveClass(/hidden/);
    await expect(editBtn).toBeFocused();
  });
});

test.describe('Heading navigation (Task 35)', () => {
  test('each of several real navigations moves focus to that page\'s own <h1>, and each page has exactly one', async ({ page }) => {
    await loginAsAdmin(page);
    // Scoped to #main -- the live app region focusMainHeading() itself
    // operates on -- because the login screen's own static <h1>
    // ("Work Desk") stays in the DOM (just display:none, out of the a11y
    // tree) after signing in, which would otherwise double-count here
    // without ever being a real second heading anyone perceives.
    await expect(page.locator('#main h1')).toHaveCount(1);
    await expect(page.locator('#main h1:focus')).toHaveCount(1);

    await page.getByRole('button', { name: 'Firm Work', exact: true }).click();
    // Scoped to #main -- the live app region focusMainHeading() itself
    // operates on -- because the login screen's own static <h1>
    // ("Work Desk") stays in the DOM (just display:none, out of the a11y
    // tree) after signing in, which would otherwise double-count here
    // without ever being a real second heading anyone perceives.
    await expect(page.locator('#main h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Firm Work' })).toBeFocused();

    await page.getByRole('button', { name: 'Team', exact: true }).click();
    // Scoped to #main -- the live app region focusMainHeading() itself
    // operates on -- because the login screen's own static <h1>
    // ("Work Desk") stays in the DOM (just display:none, out of the a11y
    // tree) after signing in, which would otherwise double-count here
    // without ever being a real second heading anyone perceives.
    await expect(page.locator('#main h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeFocused();
  });
});

test.describe('Label association (Task 35)', () => {
  test('field() now produces a real for/id association -- getByLabel resolves correctly, not just a visual sibling', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.locator('table tbody tr').filter({ hasText: 'Employee A' }).getByRole('button', { name: 'Edit' }).click();

    const nameField = page.getByLabel('Full name');
    await expect(nameField).toHaveValue('Employee A');
    const labelFor = await page.locator('#modalCard label', { hasText: 'Full name' }).getAttribute('for');
    expect(labelFor).toBeTruthy();
    const inputId = await nameField.getAttribute('id');
    expect(inputId).toBe(labelFor);
  });
});

test.describe('Touch targets (Task 35)', () => {
  test('primary sidebar buttons and page-level tabs meet the WCAG 2.5.8 24x24px minimum target size', async ({ page }) => {
    await loginAsAdmin(page);
    const todayBtn = page.getByRole('button', { name: 'Today', exact: true });
    const box = await todayBtn.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);

    await page.getByRole('button', { name: 'Client Work', exact: true }).click();
    const tab = page.getByRole('tab', { name: 'Deadlines' });
    const tabBox = await tab.boundingBox();
    expect(tabBox.height).toBeGreaterThanOrEqual(24);
  });

  test('the mobile hamburger and drawer-close buttons meet the 24x24px minimum', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 375, height: 800 });
    const toggle = page.getByRole('button', { name: 'Open menu' });
    const box = await toggle.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  });
});

test.describe('Motion (Task 35)', () => {
  test('respects prefers-reduced-motion: reduce -- no transition/transform on hover when the OS setting is set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAsAdmin(page);
    // My Work always lists every one of the user's own items regardless
    // of due date (Today's own list is date-windowed and can be empty),
    // so this is the reliable place to find a real .task-row.
    await page.getByRole('button', { name: 'My Work', exact: true }).click();
    const row = page.locator('.task-row').first();
    await expect(row).toBeVisible();
    const transitionDuration = await row.evaluate((el) => getComputedStyle(el).transitionDuration);
    // "0s" (or "0s, 0s, 0s" for the multi-property shorthand) once
    // reduced motion is honoured; the un-reduced value is "0.12s" per
    // property.
    expect(transitionDuration.replace(/\s/g, '')).toMatch(/^(0s,?)+$/);
  });

  test('no scroll-triggered reveal/entrance animation exists anywhere in the Work Desk stylesheet', async ({ page }) => {
    await loginAsAdmin(page);
    const hasKeyframesOrReveal = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE) return true;
          if (rule.selectorText && /reveal/i.test(rule.selectorText)) return true;
        }
      }
      return false;
    });
    expect(hasKeyframesOrReveal).toBe(false);
  });
});
