# NFRS / IFRS Implementation & Financial Reporting — Premium Page Pass

This pass redesigns only `nfrs-ifrs.html`. It uses the combined Home + Services + Global Outsourcing + International Accounting + Virtual CFO repo as the base.

## Positioning

The page is intentionally more technical and reporting-led than the other service pages. It presents Maven as implementation and financial-reporting support rather than as a statutory auditor or a source of blanket regulatory conclusions.

The page now follows a clear reporting journey:

1. Readiness and current-state assessment.
2. Technical accounting analysis.
3. Transition workings, reconciliations and accounting adjustments.
4. Financial statements, notes, disclosures and supporting schedules.
5. Handover, year-end organization and audit coordination.

The existing entity-specific applicability hedge remains visible. No new standard number, filing deadline, entity threshold, mandatory-adoption rule or assurance claim was added.

## Design structure

1. Technical two-column hero with a Reporting Readiness Map.
2. Four-point proof strip covering readiness, transition, financial statements and year-end coordination.
3. “Implementation, Not Formatting” section showing the chain from records to handover.
4. Three grouped fit scenarios built from the existing `whoFor` content.
5. Three visible core implementation layers built from the existing `supportAreas` content.
6. Dark technical-accounting section listing the existing transaction/reporting focus areas.
7. Six-stage implementation path using the existing editable process data.
8. Reporting-package section grouping the existing deliverables into a traceable set of outputs.
9. Dedicated, always-visible professional-boundary section.
10. Full detailed technical scope retained in accordions.
11. Existing FAQ and related-service pathways retained.
12. Strong closing NFRS / IFRS consultation CTA.

## Professional boundaries preserved

- Applicability of a reporting framework remains engagement-specific.
- Maven supports accounting analysis, implementation, schedules, documentation and financial statement preparation support.
- Statutory audit, assurance, certification, legal opinion, valuation, actuarial and other licensed professional work remain with appropriately authorized independent professionals.
- The page does not state that Maven issues audit opinions or acts as a statutory audit firm.

## Performance / responsive treatment

The custom hero uses the existing reporting image family and the same responsive tiers used elsewhere in the site:

- `card-reporting-640w.jpg`
- `card-reporting-960w.jpg`
- `card-reporting.jpg`

`build.js` continues to preload the reporting image family for this page.

## Validation

- Desktop visual QA at 1440px.
- Mobile visual QA at 390px.
- No horizontal overflow at either width.
- Exactly one H1 in the built page.
- No duplicate IDs.
- Responsive technical grids collapse cleanly on mobile.
- The professional-boundary text remains fully visible in the primary reading flow.
- A dedicated source regression test protects the page structure, responsive hero and compliance-sensitive boundary wording.
