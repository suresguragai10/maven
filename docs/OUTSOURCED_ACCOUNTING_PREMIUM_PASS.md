# Outsourced Accounting Premium Pass

Date: 2026-09-22
Scope: `outsourced-accounting.html` only, plus the supporting CMS/SEO/test changes required by that page.

## Positioning

The page remains the Nepal-domestic outsourced-accounting page. It is deliberately different from `international-accounting.html`, which serves international businesses and accounting firms.

The page now positions outsourced accounting as a defined monthly finance operating model for growing Nepal businesses rather than a simple "cheaper than hiring" pitch.

## Page architecture

1. Premium hero with a four-part monthly finance operating model
2. Domestic proof strip
3. "When Outsourcing Makes Sense" fit section, including an explicit note that outsourcing is not right for every finance role
4. Monthly finance scope covering bookkeeping, reconciliations, payables/receivables support, payroll accounting support, VAT/TDS and tax coordination, and monthly reporting
5. Five-step repeatable monthly cycle
6. Controls, handoffs, confidentiality, review and professional-responsibility section
7. Growth path from core monthly books through management reporting and Virtual CFO support
8. Four-page FAQ section
9. Monthly-accounting CTA

## Content / claim safeguards

- Removed the blanket "Lower cost than full-time accounting staff" benefit claim.
- Kept the page explicitly Nepal-focused.
- Did not claim guaranteed savings, guaranteed compliance, 24/7 support, licensed audit authority, or services outside Maven's documented scope.
- Clarified that businesses needing continuous on-site control or high-volume daily approvals may still require in-house finance staff.
- Clarified management responsibility and the boundary around statutory audit, legal opinions and other regulated work.
- Added a warning not to send sensitive banking, payroll, tax or identity documents through website chat.

## CMS support

`content/site.yaml` now includes four outsourced-accounting FAQs. The existing Outsourced Accounting admin editor was extended so those FAQs remain editable rather than becoming hard-coded page content.

The existing editable benefits list is still rendered on the public page as a concise summary of the intended monthly finance routine.

## Responsive / motion treatment

- Hero image uses the same 640px / 960px / original desktop image strategy as the site's preload system.
- Desktop layouts collapse to one-column mobile layouts without viewport-width hacks.
- Existing reveal motion is reused; no new animation dependency was added.
- `prefers-reduced-motion` remains respected.

## Validation

Source-level checks:

- JavaScript syntax: 120 / 120 passed
- Premium-page targeted regressions: 55 / 55 passed
- New Outsourced Accounting regression file: 8 / 8 passed

Temporary QA build (local dependency placeholders only; not included in the final repo):

- Full Node source/SEO/unit suite: 125 / 125 passed
- Generated page: 1 H1
- Duplicate IDs: 0
- Desktop overflow at 1440px: 0px
- Mobile overflow at 390px: 0px
- FAQ items: 4
- Internal-link and responsive-hero-preload checks passed as part of the full suite

Temporary `node_modules`, generated `dist`, responsive QA image variants and screenshots were removed before packaging.
