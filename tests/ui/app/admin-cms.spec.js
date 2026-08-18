const { test, expect } = require('@playwright/test');
const { installGithubMock, buildFixtureContent } = require('../support/mock-github');

// Handbook Task 30: exercises the full connect -> edit -> save flow against
// a mocked GitHub API (see mock-github.js), proving admin.js's own
// validateContent()/computeChangedSummary()/conflict-handling code paths
// run for real, not just that they exist.

async function connect(page, mock) {
  await page.goto('/admin/');
  await page.locator('#in-owner').fill(mock.owner);
  await page.locator('#in-repo').fill(mock.repo);
  await page.locator('#in-branch').fill('professional-update');
  await page.locator('#in-token').fill(mock.token);
  await page.locator('#connectBtn').click();
  await expect(page.locator('#app')).toBeVisible();
}

// Playwright's hasText does a case-insensitive SUBSTRING match, so a plain
// `.filter({ hasText: 'Email' })` also matches the unrelated "Formspree
// Form ID (contact form email delivery)" field, and `.filter({ hasText:
// 'Title' })` matches the "URL slug... from the title" hint text too. This
// scopes to a .f-field whose own <label> text is an EXACT match instead.
function fieldByExactLabel(page, container, exactLabel) {
  const escaped = exactLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return container.locator('.f-field').filter({ has: page.locator('label', { hasText: new RegExp('^' + escaped + '$') }) });
}

test.describe('Admin CMS — validation blocks bad saves before any network call', () => {
  test('an empty required field is blocked with an actionable error, and nothing is sent to GitHub', async ({ page }) => {
    const mock = await installGithubMock(page);
    await connect(page, mock);

    const legalNameInput = fieldByExactLabel(page, page.locator('#sec-brand'), 'Legal Name').locator('input');
    await legalNameInput.fill('');

    await page.locator('#saveBtn').click();

    const banner = page.locator('#saveBanner.error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Cannot save');
    await expect(banner).toContainText('Legal Name');

    // The whole point: no PUT was ever attempted.
    expect(mock.state.putCalls.length).toBe(0);
  });

  test('an invalid email is blocked the same way', async ({ page }) => {
    const mock = await installGithubMock(page);
    await connect(page, mock);

    const emailInput = fieldByExactLabel(page, page.locator('#sec-brand'), 'Email').locator('input');
    await emailInput.fill('not-an-email');

    await page.locator('#saveBtn').click();

    await expect(page.locator('#saveBanner.error')).toContainText('Email');
    expect(mock.state.putCalls.length).toBe(0);
  });

  test('a malformed tax slab (a blank/unlimited slab followed by more slabs) is caught', async ({ page }) => {
    const mock = await installGithubMock(page);
    await connect(page, mock);

    // Add a slab to the one fixture FY table, then blank its width so the
    // FIRST slab becomes "unlimited" while a second slab still follows it
    // — exactly the shape tax-calc.js would silently mis-handle.
    await page.locator('a[href="#sec-calculators"]').click();
    await page.locator('#sec-calculators').locator('button:has-text("+ Add slab")').first().click();
    await page.locator('#sec-calculators .slab-row').first().locator('input[type="number"]').first().fill('');

    await page.locator('#saveBtn').click();

    await expect(page.locator('#saveBanner.error')).toContainText('unlimited');
    expect(mock.state.putCalls.length).toBe(0);
  });
});

test.describe('Admin CMS — valid save flow', () => {
  test('a valid edit shows a pre-save diff summary, then saves and reports success without claiming deployment', async ({ page }) => {
    const mock = await installGithubMock(page);
    await connect(page, mock);

    const legalNameInput = fieldByExactLabel(page, page.locator('#sec-brand'), 'Legal Name').locator('input');
    await legalNameInput.fill('Updated Consultancy Pvt. Ltd.');

    await page.locator('#saveBtn').click();

    const confirmBanner = page.locator('#saveBanner.confirm');
    await expect(confirmBanner).toBeVisible();
    await expect(confirmBanner).toContainText('1 change');
    await expect(confirmBanner).toContainText('brand.legalName');
    // The confirm step itself must not have hit the network yet.
    expect(mock.state.putCalls.length).toBe(0);

    await confirmBanner.locator('button:has-text("Confirm & Save to GitHub")').click();

    await expect(page.locator('#toast')).toContainText('Saved to GitHub');
    await expect(page.locator('#toast')).toContainText('has not been confirmed yet');
    // Must never claim the deploy itself succeeded.
    await expect(page.locator('#toast')).not.toContainText('Deployment succeeded');
    await expect(page.locator('#toast')).not.toContainText('published');

    expect(mock.state.putCalls.length).toBe(1);
  });
});

test.describe('Admin CMS — GitHub conflict (stale SHA)', () => {
  test('a 409 on save shows a conflict-specific message and never overwrites blindly', async ({ page }) => {
    const mock = await installGithubMock(page, { conflictOnSave: true });
    await connect(page, mock);

    const legalNameInput = fieldByExactLabel(page, page.locator('#sec-brand'), 'Legal Name').locator('input');
    await legalNameInput.fill('Updated Consultancy Pvt. Ltd.');
    await page.locator('#saveBtn').click();
    await page.locator('#saveBanner.confirm button:has-text("Confirm & Save to GitHub")').click();

    const conflictBanner = page.locator('#saveBanner.conflict');
    await expect(conflictBanner).toBeVisible();
    await expect(conflictBanner).toContainText('changed since this page loaded it');
    await expect(conflictBanner.locator('button:has-text("Reload Latest Content")')).toBeVisible();

    // Exactly one PUT was attempted (and rejected) -- the app did not
    // retry or fall back to overwriting.
    expect(mock.state.putCalls.length).toBe(1);
  });
});

test.describe('Admin CMS — Blog messaging', () => {
  test('saving a post while the Blog page is hidden says "saved", never "published", and states it is hidden', async ({ page }) => {
    const mock = await installGithubMock(page); // fixture's Blog page defaults to hidden: true
    await connect(page, mock);

    await page.locator('a[href="#sec-blog"]').click();
    await expect(page.locator('#blogVisibilityNote')).toContainText('HIDDEN');

    await page.locator('#sec-blog button:has-text("+ Write New Post")').click();
    const blogForm = page.locator('#sec-blog .sub-card');
    await fieldByExactLabel(page, blogForm, 'Title').locator('input').fill('A Test Post');
    await fieldByExactLabel(page, blogForm, 'Post Body (Markdown)').locator('textarea').fill('Body text.');

    await page.locator('#sec-blog button:has-text("Save New Post")').click();

    await expect(page.locator('#toast')).toContainText('Post saved to GitHub');
    await expect(page.locator('#toast')).toContainText('hidden');
    await expect(page.locator('#toast')).not.toContainText('published');
    await expect(page.locator('#toast')).not.toContainText('Post published');

    expect(mock.state.blogPutCalls.length).toBe(1);
  });

  test('saving a post while the Blog page is shown says it will go live after deploy, still never "published"', async ({ page }) => {
    const fixtureContent = buildFixtureContent();
    fixtureContent.pages = fixtureContent.pages.map((p) => (p.key === 'blog' ? Object.assign({}, p, { hidden: false }) : p));
    const mock = await installGithubMock(page, { fixtureContent });
    await connect(page, mock);

    await page.locator('a[href="#sec-blog"]').click();
    await expect(page.locator('#blogVisibilityNote')).not.toContainText('HIDDEN');

    await page.locator('#sec-blog button:has-text("+ Write New Post")').click();
    const blogForm = page.locator('#sec-blog .sub-card');
    await fieldByExactLabel(page, blogForm, 'Title').locator('input').fill('A Second Test Post');
    await fieldByExactLabel(page, blogForm, 'Post Body (Markdown)').locator('textarea').fill('Body text.');
    await page.locator('#sec-blog button:has-text("Save New Post")').click();

    await expect(page.locator('#toast')).toContainText('Post saved to GitHub');
    await expect(page.locator('#toast')).toContainText('automatic deploy finishes');
    await expect(page.locator('#toast')).not.toContainText('published');
  });
});

test.describe('Admin CMS — disconnect clears the token', () => {
  test('Disconnect returns to the connect screen with no token left in storage', async ({ page }) => {
    const mock = await installGithubMock(page);
    await connect(page, mock);

    await page.locator('#disconnectBtn').click();

    await expect(page.locator('#connectScreen')).toBeVisible();
    const tokenInStorage = await page.evaluate(() => window.sessionStorage.getItem('maven_admin_token'));
    expect(tokenInStorage).toBeNull();
  });
});
