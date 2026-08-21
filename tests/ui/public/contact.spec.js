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
    // just visually present. Handbook Task 26: role="alert" means a
    // screen reader announces it the moment it's revealed (no separate
    // aria-live attribute needed — role=alert implies assertive/atomic),
    // and moving focus onto it gives a keyboard user a sensible next Tab
    // stop instead of leaving them on the button they just pressed. See
    // accessibility.spec.js for the per-field aria-invalid assertions.
    await expect(errorEl).not.toHaveAttribute('hidden', '');
    await expect(errorEl).toHaveAttribute('role', 'alert');
    await expect(errorEl).toBeFocused();

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

  // Handbook Task 25: the two tests above only ever prove submission is
  // BLOCKED before any network call — neither exercises the actual
  // fetch()/showSuccess() path a real valid submission takes. This test
  // does, but per this task's own "keep validation from submitting to
  // Formspree during tests" instruction, the real formspree.io endpoint
  // is intercepted via page.route() and answered with a fake response —
  // the test proves client.js's own success handling works without ever
  // reaching the third-party service, in CI or anywhere else.
  test('a fully valid submission posts to Formspree exactly once and shows the success message (Formspree intercepted, never hit for real)', async ({ page }) => {
    await page.goto('/contact');

    let formspreeRequests = 0;
    let capturedBody = null;
    await page.route('https://formspree.io/**', async (route) => {
      formspreeRequests++;
      capturedBody = route.request().postData();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.locator('#f-name').fill('Test User');
    await page.locator('#f-phone').fill('9800000000');
    await page.locator('#f-service').selectOption({ index: 1 });
    await page.locator('#f-message').fill('Test message body for a fully valid submission.');
    await page.locator('#f-email').fill('test@example.com');

    await page.locator('#inquiryForm button[type="submit"]').click();

    await expect(page.locator('#formResult')).toBeVisible();
    await expect(page.locator('#formResult')).toContainText(/thank you/i);
    expect(formspreeRequests, 'exactly one submission to the (intercepted) Formspree endpoint').toBe(1);
    expect(capturedBody, 'the real Formspree endpoint must never actually be reached during tests').not.toBeNull();
  });

  // Task 08: the submit button is disabled synchronously as the first thing
  // that happens once the Formspree fetch starts (see client.js), which
  // should make a second click land on an already-disabled button and do
  // nothing -- this proves that in practice, not just by reading the code.
  // The route is deliberately slow so a real double-click has a genuine
  // window to land during the in-flight request, not just an instant.
  test('rapid double-click on submit only sends one inquiry', async ({ page }) => {
    await page.goto('/contact');

    let formspreeRequests = 0;
    await page.route('https://formspree.io/**', async (route) => {
      formspreeRequests++;
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.locator('#f-name').fill('Test User');
    await page.locator('#f-phone').fill('9800000000');
    await page.locator('#f-service').selectOption({ index: 1 });
    await page.locator('#f-message').fill('Test message body for a duplicate-submission check.');

    const submitBtn = page.locator('#inquiryForm button[type="submit"]');
    await submitBtn.click();
    // Fire a second click immediately, while the first request is still
    // in flight (the route above deliberately holds for 400ms).
    await submitBtn.click({ force: true }).catch(() => {}); // a truly disabled button may refuse the click entirely -- both outcomes are fine, only the request count matters
    await expect(submitBtn).toBeDisabled();

    await expect(page.locator('#formResult')).toBeVisible({ timeout: 5000 });
    expect(formspreeRequests, 'exactly one Formspree request despite the double click').toBe(1);
  });

  test('the whole form is keyboard-operable end to end, including submission', async ({ page }) => {
    await page.goto('/contact');

    let formspreeRequests = 0;
    await page.route('https://formspree.io/**', async (route) => {
      formspreeRequests++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.locator('#f-name').focus();
    await page.keyboard.type('Keyboard User');
    await page.keyboard.press('Tab'); // business name (optional, skip)
    await page.keyboard.press('Tab');
    await page.keyboard.type('9800000000'); // phone
    await page.keyboard.press('Tab');
    await page.keyboard.type('keyboard@example.com'); // email
    await page.keyboard.press('Tab');
    await expect(page.locator('#f-service')).toBeFocused();
    await page.locator('#f-service').selectOption({ index: 1 });
    await page.keyboard.press('Tab'); // business type (optional, skip)
    await page.keyboard.press('Tab');
    await expect(page.locator('#f-message')).toBeFocused();
    await page.keyboard.type('Submitted using only the keyboard.');
    await page.keyboard.press('Tab');
    await expect(page.locator('#inquiryForm button[type="submit"]')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#formResult')).toBeVisible();
    expect(formspreeRequests).toBe(1);
  });

  test('the privacy/security note about not attaching sensitive documents is visible', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('.form-hint').first()).toContainText(/don't attach financial records/i);
  });
});
