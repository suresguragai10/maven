# Batch 2B - Public Visual Composition and Responsive Polish

## Scope

Batch 2B is a narrow public-site polish pass after the approved Batch 2 and Batch 2A checkpoints. It does not change business rules, finance/tax/legal copy, attendance, Work Desk permissions, or website-admin architecture.

## Changes

- Broke the Home page out of consecutive mist-grey sections by returning Industries to a white section, improving visual rhythm without adding content.
- Kept the Contact inquiry form visually stationary on hover. It may share service-card structure, but it is not a clickable marketing card and should not lift while a user is entering data.
- Tightened section-heading, page-hero, CTA-band and International spacing at tablet/mobile widths.
- Simplified the narrow-phone Home hero by hiding the decorative 100+ badge only on small screens; the confirmed client-count evidence remains available in the Home stats row.
- Made phone CTAs intentionally full-width where stacked controls are more usable.
- Tightened Industries detail composition and actions on phones.
- Reduced mobile container gutters at 430px and below while preserving comfortable reading space.
- Added source-level regression checks in `test/batch2b-source.test.js`.

## Guardrails preserved

- Maven navy/gold/white palette remains unchanged.
- Nepal-first positioning remains unchanged.
- The confirmed 100+ clients claim is not removed or rewritten.
- No finance, tax, legal or compliance values are changed.
- No new image assets, paid dependencies, animation libraries or tracking are introduced.
- Main remains untouched until the final release gate.

## Verification required on the owner's machine

1. `npm.cmd run test:syntax`
2. `npm.cmd test`
3. `npm.cmd run build`
4. Localhost visual review at desktop and mobile widths, especially Home, Services, Industries, FAQ, About, International and Contact.
5. Confirm no horizontal overflow, CTA crowding, heading/crop regressions, or form movement on hover.
