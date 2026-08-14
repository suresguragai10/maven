const { test, expect } = require('@playwright/test');

// #inquiryForm has novalidate (see contact.html) -- native browser
// validation is intentionally disabled and client.js's own submit
// handler (see /client.js "Contact / inquiry form") does the checking:
// e.preventDefault() runs unconditionally, then required fields are
// checked before any network call is attempted.
test.describe('Contact form validation', () => {
  test('submitting with required fields empty blocks submission and shows an accessible error', async ({ page }) => {
    await page.goto('/contact');

    let networkSubmitFired = false;
    page.on('request', (req) => {
      if (req.url().includes('formspree.io')) networkSubmitFired = true;
    });

    await page.locator('#inquiryForm button[type="submit"]').click();

    const errorEl = page.locator('#formError');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).not.toBeEmpty();

    // Accessible: must actually be discoverable by assistive tech, not
    // just visually present.
    await expect(errorEl).not.toHaveAttribute('hidden', '');

    await expect(page).toHaveURL(/\/contact/);
    expect(networkSubmitFired).toBe(false);
  });

  test('an invalid email is rejected with its own message, without touching other fields', async ({ page }) => {
    await page.goto('/contact');

    await page.locator('#f-name').fill('Test User');
    await page.locator('#f-phone').fill('9800000000');
    await page.locator('#f-service').selectOption({ index: 1 });
    await page.locator('#f-message').fill('Test message body.');
    await page.locator('#f-email').fill('not-an-email');

    await page.locator('#inquiryForm button[type="submit"]').click();

    const errorEl = page.locator('#formError');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText(/email/i);
  });
});
