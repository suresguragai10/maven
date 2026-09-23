# FAQ Premium Pass — 2026-09-22

## Scope

This pass changes only the public FAQ experience and its supporting SEO/CMS guidance. The nine approved FAQ questions and answers in `content/site.yaml` remain the source of truth; no factual answer was rewritten as part of the design pass.

## What changed

1. Replaced the old generic page-hero + single accordion stack with a premium FAQ hero and **Question Desk**.
2. Added four practical topic groups:
   - Services & Scope
   - Coverage & Setup
   - Fees & Confidentiality
   - Reporting & Advisory
3. Kept the FAQ list CMS-managed. Questions are categorized at render time and every item remains visible; new/unmatched FAQ entries safely fall back to **Services & Scope** instead of disappearing.
4. Added a short orientation section explaining how to use the FAQ before requesting a quote or sending documents.
5. Kept every answer collapsed by default through the existing accessible accordion component.
6. Added visible professional-boundary guidance for case-specific tax, legal, filing, reporting and regulated-professional questions.
7. Added deeper paths to Services, Global Outsourcing, Documents Checklist and Contact.
8. Updated the FAQ title/description for accounting, tax and finance question intent while preserving the existing `FAQPage` JSON-LD generated from the same `data.faqs` dataset.
9. Updated the admin guidance so editors know the public page groups FAQ entries automatically.
10. Added responsive 640px / 960px hero references and dedicated mobile/reduced-motion styling without adding a new runtime dependency.

## Content governance retained

- Maven is still explicitly not presented as a statutory audit firm.
- The existing approximately seven-working-day company-registration estimate was not changed; it remains an owner-review item because government processing time can change.
- The existing data-safety answer was not embellished with security controls that are not documented.
- General FAQ answers are framed as orientation, not a substitute for entity-specific professional judgement.

## Validation

- FAQ-specific regression tests: **8 / 8 passed**.
- Cumulative premium-page + Tawk regression suite: **105 / 105 passed**.
- JavaScript syntax suite: **126 / 126 passed**.
- Built-page layout QA at **1440px** and **390px**: zero horizontal overflow, one H1, no duplicate IDs, no heading-level skips, four topic groups, nine FAQ items and three deeper-path cards.
- Full source / SEO / unit suite: **172 / 172 passed** after final page generation and documentation updates.

Temporary local dependency placeholders and generated QA/build output are not part of the final handoff ZIP.
