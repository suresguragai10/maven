# Batch 2C - Public Responsive and Interaction Verification Gate

## Purpose

Batch 2C is a verification-only public-site pass after the owner-approved Batch 2B visual checkpoint. It does not redesign the site and does not change business rules, finance/tax/legal content, Work Desk permissions, Attendance, database/RLS logic, or Website Admin behavior.

The goal is to turn the remaining "looks good on localhost" confidence into repeatable browser evidence before moving to database/security work.

## Automated browser coverage added

- Expands horizontal-overflow coverage from a representative page slice to every generated public route, including hidden/noindex Blog and Testimonials pages.
- Runs the agreed responsive width matrix: 320, 360, 390, 430, 768, 1024, 1280 and 1440 pixels.
- Verifies fragile dynamic states at narrow widths:
  - open mobile navigation + Services submenu;
  - open Industries detail;
  - open FAQ answer;
  - Contact validation error state;
  - expanded EMI amortization schedule inside its intentional horizontal scroller.
- Verifies WhatsApp and Back-to-Top controls remain inside the viewport, use a practical touch target, appear deliberately, and clear the visible footer.
- Adds a mobile-width runtime smoke gate for critical public pages that records uncaught JavaScript errors and broken same-origin assets/routes.

## Existing gates intentionally reused

Batch 2C does not duplicate tests that already exist for:

- exactly one H1 and no forward heading-level skips;
- collapsed FAQ/support disclosures;
- Industries master/detail selection and deep links;
- reduced-motion and JavaScript-disabled reveal behavior;
- mobile-nav focus management;
- Contact form accessibility;
- canonical/sitemap/robots/noindex/schema output.

## Owner workstation acceptance sequence

1. Confirm `professional-update` and a clean working tree.
2. Run `npm.cmd run test:syntax`.
3. Run `npm.cmd test`.
4. Run `npm.cmd run build`.
5. Run `npm.cmd run test:ui` (Chromium gate).
6. If Chromium is green, run `npm.cmd run test:ui:all` where the installed browser binaries/environment permit it; treat cross-browser failures as real until reproduced/triaged.
7. Re-open localhost for a short human smoke check at desktop and phone widths.
8. Commit/push only after the owner accepts the evidence.

If Playwright browser binaries are missing, install them once with `npm.cmd run test:ui:install-browsers`. Do not label the UI gate PASS if it did not actually run.

## Git safety

- Work only on `professional-update`.
- `main` remains untouched until the final release gate and explicit owner approval.
- Do not stage Playwright reports, traces, screenshots, `node_modules`, `dist`, or other generated test artifacts unless a future task explicitly requires a reviewed artifact.
