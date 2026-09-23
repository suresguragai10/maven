# About Page Premium Pass

Date: 2026-09-22

## Scope

This pass changes the public **About** page only. The Home, Services, Global Outsourcing, International Accounting, Virtual CFO, NFRS/IFRS, admin, staff and CMS architecture are otherwise unchanged.

## Positioning

The About page now acts as a professional-services trust page rather than a short generic company profile. It presents Maven as a Kathmandu-based finance and accounting partner with Nepal-wide support and structured remote delivery for international teams.

The page deliberately avoids generic mission/vision filler and unsupported scale claims. Existing approved facts, values, team profiles and professional-process statements remain the foundation.

## New page architecture

1. Premium About hero with a firm-profile panel
2. Who We Are / connected finance scope
3. How We Work / five existing Maven values
4. Engagement Discipline / scope, records, internal review and communication
5. Confidentiality callout with Privacy Policy path
6. People Behind the Work / three-person team preview with a full Team-page path
7. Kathmandu Base + International Delivery split
8. Consultation CTA

## Important content decisions

- Keeps Maven explicitly Kathmandu-based.
- Keeps Nepal-wide support distinct from remote international delivery.
- Uses existing team biographies rather than inventing new credentials.
- Uses the existing internal-review and confidentiality model rather than adding unsupported quality certifications.
- Does not imply overseas offices, 24/7 coverage, statutory audit authority, guaranteed outcomes or regulated services Maven does not claim to provide.
- Preserves the dedicated Team page rather than duplicating all team biographies on About.

## Design and motion

- Custom responsive About hero using the existing `about-hero-bg.jpg` family.
- Responsive hero tiers match the site's existing `640w / 960w / desktop` preload strategy.
- Typography-led editorial sections replace the old generic values/industry grids.
- Subtle hero entrance motion is CSS-only and disabled under `prefers-reduced-motion`.
- Existing reveal system is reused for below-the-fold content; no new animation dependency was added.

## Validation

- JavaScript syntax: **116 / 116 passed**.
- Premium-page targeted regression suite: **35 / 35 passed**.
- Full source / SEO / unit suite: **105 / 105 passed** using temporary local dependency shims because the supplied repository does not include installed npm dependencies.
- YAML parses successfully.
- Built About page checks:
  - exactly one H1
  - no heading-level skips
  - no duplicate IDs
  - no missing local images
  - no broken About-page internal links
  - no undefined CSS design tokens in the About-specific styles
- Visual QA performed at **1440px** and **390px** widths; `scrollWidth === clientWidth` at both sizes, so no horizontal overflow was detected.

Temporary QA dependency shims, generated `dist/`, screenshots and browser-test files are removed before packaging and are not part of the handoff ZIP.
