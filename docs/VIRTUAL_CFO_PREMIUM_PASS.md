# Virtual CFO & Management Reporting — Premium Page Pass

This pass redesigns only `virtual-cfo.html`. It uses the combined Home + Services + Global Outsourcing + International Accounting repo as the base.

## Positioning

The page is deliberately different from Remote Accounting Support:

- Remote Accounting = recurring bookkeeping, reconciliations, month-end operations and accounting capacity.
- Virtual CFO / Management Reporting = management information, cash-flow visibility, budgets, forecasts, KPI review, scenarios and finance discussion built on reliable accounting.

The page now explicitly states that this layer can support growing businesses in Nepal and international teams. It does **not** claim overseas offices, 24/7 availability, investment advice, regulated financial advice or decision-making authority.

## Design structure

1. Analytical two-column hero with a management-finance cycle panel.
2. Four-point finance-focus proof strip.
3. Four-level finance ladder from bookkeeping through Virtual CFO support.
4. Management-pack anatomy covering performance, variance, working capital and forward visibility.
5. Dark management-cycle section: close, explain, forecast, discuss.
6. Full editable detailed scope retained in accordions from `virtualCfo.supportAreas`.
7. “When this becomes useful” section with practical fit signals.
8. Existing FAQs retained.
9. Strong closing consultation CTA.

## Professional boundaries preserved

- Management remains responsible for business decisions.
- Maven supports agreed financial information, analysis and management discussion.
- Scenario work is not investment, lending or regulated financial advice.
- Remote Accounting Support remains the preceding operational layer when reliable recurring records are not yet in place.

## Performance / responsive treatment

The custom hero uses the existing reporting image with the site-standard responsive tiers:

- `card-reporting-640w.jpg`
- `card-reporting-960w.jpg`
- `card-reporting.jpg`

`build.js` preloads the same responsive image family for this page.

## Validation

- Desktop visual QA: 1440px viewport.
- Mobile visual QA: 390px viewport.
- No horizontal overflow at either width.
- Exactly one H1, no duplicate IDs, no heading-level skips, and no broken internal links in the built page.
- JavaScript syntax suite: 115 / 115 passed.
- Full source / SEO / unit suite: 93 / 93 passed using temporary local dependency shims because the npm dependency directory is not included in the supplied ZIP. The shims and generated `dist/` output are not part of the final package.
