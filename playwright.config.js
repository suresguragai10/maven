// Maven Work Desk / public site -- Playwright regression harness config.
//
// Tests run against dist/ (built output), served locally by
// tests/ui/support/serve-dist.js, never against source files directly --
// this is what actually deploys, and it's the only way to catch build-time
// issues (e.g. a page missing from dist/) as well as runtime ones.
//
// Chromium is the baseline project and must pass (or fail only on
// documented, known bugs -- see docs/UI_TESTING.md) for `npm run test:ui`
// to be meaningful. Firefox/WebKit projects are included but are launched
// only via `npm run test:ui:all` -- keeping the default `test:ui` run fast
// and Chromium-only avoids overstating cross-browser coverage on every
// run; see docs/UI_TESTING.md for which browsers actually ran last.
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.UI_TEST_PORT || 4173;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30000,
  expect: { timeout: 5000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'node build.js && node tests/ui/support/serve-dist.js',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: { UI_TEST_PORT: String(PORT) },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
