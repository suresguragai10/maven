# Homepage Premium Pass — 2026-09-22

Scope: **Home page only**. Other public-page layouts were intentionally left unchanged so the redesign can continue page by page.

## Positioning used

The homepage now presents Maven as a modern finance, tax, accounting and outsourced-finance partner with two connected markets:

- Nepal-based businesses needing compliance, accounting, payroll and reporting support.
- International businesses and accounting firms needing remote bookkeeping and finance capacity.

The tone is professional and knowledge-led rather than promotional or agency-like.

## What changed on Home

1. Rebuilt the hero around a stronger finance-led headline and clearer service positioning.
2. Replaced the old rotating document/service mockup with a restrained finance-function panel.
3. Added a concise proof strip for established year, clients served, connected service areas and remote delivery.
4. Replaced the long three-chapter homepage service treatment with three premium capability pillars:
   - Establish & Stay Compliant
   - Run Your Finance Function
   - Report, Plan & Scale
5. Removed package cards from the homepage. Packages remain available on their dedicated page and in navigation; the homepage now leads with capability and trust rather than price/package framing.
6. Added a quieter operating-standard section based on communication, confidentiality, deadline discipline and internal review.
7. Moved international outsourced finance higher in the page and gave it a dedicated premium dark treatment.
8. Simplified management deliverables to four decision-useful outputs.
9. Kept the four-stage engagement process but rewrote it around scope and delivery rather than transactional workflow language.
10. Kept industries as a compact credibility/fit layer.
11. Added a Knowledge & Tools section linking to practical resources, calculators and official reference links.
12. Updated the homepage SEO title and description to reflect both Nepal services and international outsourcing.

## Motion direction

Motion remains restrained:

- existing reveal/stagger system only;
- subtle image scale and arrow movement on hover;
- no looping hero animation;
- no floating decorative objects;
- full `prefers-reduced-motion` support retained.

## Technical notes

- No new front-end dependency was added.
- Existing CMS/content architecture is retained.
- Existing security/Tawk integration is untouched.
- Home-specific CSS is scoped under `home-*` selectors to avoid redesigning other pages accidentally.
- The old homepage-only skyline/document-card/package helper code was removed from `pages1.js` after the redesign, reducing dead source code.

## Verification completed

- `npm run test:syntax`: **111 passed / 0 failed**.
- `pages1.js` renders successfully against the current YAML content using a local validation shim.
- Generated homepage HTML has exactly one H1, no forward heading-level skips and no duplicate IDs.
- Generated Home internal links were checked against the built public pages: **0 missing files / 0 missing anchors**.
- The public build reached and generated all public HTML successfully in this environment. The full repo build could not finish because installed npm dependencies are unavailable here; the build later stops when it tries to copy the real admin-side `js-yaml` browser bundle. This is an environment/dependency limitation, not a homepage source error.

## Suggested next page

**Services** should be the next design pass. It is the strongest next step because Home now promises three clear finance capability layers; the Services page should visually continue that same premium system and make the detailed service architecture easier to scan.
