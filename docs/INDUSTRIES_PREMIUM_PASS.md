# Industries Page Premium Pass — September 2026

## Scope

This pass changes **Industries only**. It uses the premium Home / Services / Global Outsourcing / International Accounting / Virtual CFO / NFRS-IFRS / About / Contact repo as the base and does not redesign the remaining public pages, admin panel, or staff portal.

## Design objective

Make Industries demonstrate that Maven understands how finance work changes with the underlying business model — not simply list sectors as generic marketing cards.

The page now follows this order:

1. Business-model-led hero and industry lens
2. Why industry context matters
3. Stable 13-profile industry explorer
4. Detailed finance-attention and Maven-support view for the selected profile
5. Cross-industry finance discipline and professional boundaries
6. Consultation CTA based on how the business actually operates

## Key implementation decisions

- Preserved all **13 existing industry profiles** and their real `needs` / `howWeHelp` content rather than replacing them with thin marketing copy.
- Preserved the existing `#industry-N` deep links, button IDs, `data-industry-index`, `data-industry-detail`, `aria-expanded`, `aria-controls`, and master/detail interaction used by `client.js`.
- Kept the selector list stable while details render in a separate stage, preventing an opened profile from stretching neighbouring list items.
- Added numbered selector rows and a clearer detail hierarchy: **Finance attention** and **Maven support**.
- Added business-model context around transaction flow, cost/margin structure, cash/working capital and reporting audience.
- Added an across-sector standards section covering organized records, reconciliation, defined responsibility and useful management visibility.
- Kept professional boundaries explicit instead of implying industry-specific regulated credentials.
- The hero uses the existing responsive `640w / 960w / desktop` image strategy and keeps the build preload aligned with `industries-hero-bg.jpg`.
- No new animation library or runtime dependency was introduced.

## QA corrections made during the pass

The visual review caught two issues before finalization:

1. The new detail placeholder used `display:flex`, which could override the browser's default `[hidden]` behavior after a profile was selected. A specific rule now enforces `display:none !important` for hidden placeholder/detail panels.
2. The first hero headline was too long for the intended premium composition. It was tightened to the current business-model-led heading in `content/site.yaml`.

## Files changed

- `pages3.js` — Industries page composition
- `ui.js` — industry selector/detail presentation while preserving interaction hooks
- `styles.css` — Industries premium styles, sticky detail stage and responsive rules
- `content/site.yaml` — Industries hero heading/subtitle
- `build.js` — Industries SEO title/description
- `docs/BUSINESS_CONTENT_REVIEW.md` — updated Industries purpose/review
- `docs/SEO_INTENT_MAP.md` — updated Industries search intent/title
- `test/industries-premium-page.test.js` — source-level regression coverage
- `docs/INDUSTRIES_PREMIUM_PASS.md` — this record

## Validation

Final clean-source checks for this pass:

- JavaScript syntax: **119 / 119 passed**
- Premium-page targeted regressions: **47 / 47 passed**
- Full source / SEO / unit suite with temporary local QA dependency placeholders: **117 / 117 passed**
- `content/site.yaml`: parsed successfully through the build
- Generated `industries.html`: exactly **1 H1**
- Duplicate IDs: **0**
- Heading-level skips: **0**
- Industry selectors: **13**
- Industry detail panels: **13**
- Missing local links from the generated Industries page: **0**
- Visual QA completed at **1440px desktop** and **390px mobile** during the Industries pass
- No horizontal-overflow issue was observed in the completed visual QA

Temporary QA dependency placeholders and generated build output are not part of the final repository.

## Production verification

On a normal dependency-enabled environment run:

```bash
npm ci
npm run test:syntax
npm test
npm run build
npm run test:ui
```

Then verify a few direct deep links such as `/industries#industry-0` and `/industries#industry-12` on the deployed site, plus selector scrolling on a real phone browser.
