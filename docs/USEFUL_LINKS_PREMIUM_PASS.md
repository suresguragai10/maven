# Useful Links Premium Pass — 2026-09-23

## Scope

This pass redesigns `useful-links.html` only, plus page-specific SEO, documentation and regression coverage. The existing `content.site.yaml` `usefulLinks` entries remain the source of truth for the directory; no approved link name, URL or description was rewritten in this pass.

## What changed

1. Replaced the old generic page hero and service-card grid with a dedicated premium reference-directory experience.
2. Added a photographic hero using the existing Useful Links asset and generated 640px / 960px responsive variants.
3. Added a **Reference Desk** panel that explains how to use the directory without presenting a third-party portal as case-specific advice.
4. Rebuilt the directory as a numbered, editorial two-column source list while preserving every CMS-managed link.
5. Kept every external destination in a new tab with `noopener noreferrer`, a descriptive new-tab `aria-label`, and the existing shared `safeUrl()` protection.
6. Made the third-party boundary visible twice: in the hero panel and directly below the source directory.
7. Added a four-step verify-before-acting workflow: open the original source, check current context, match it to the situation, and obtain confirmation where needed.
8. Added three complementary routes back into the Resources hub: Documents Checklist, Financial Calculators and FAQ.
9. Updated only the Useful Links title/description metadata so it describes the broader official/institutional directory rather than naming only a subset of current entries.
10. Added dedicated desktop, tablet, mobile and reduced-motion styling without adding a runtime dependency.

## CMS and architecture preservation

- `content/site.yaml` remains unchanged for the seven Useful Links entries.
- The existing Website Admin Useful Links editor remains unchanged.
- The source directory still renders directly from `data.usefulLinks`; new or removed CMS entries flow into the same layout automatically.
- External URLs still pass through `safeUrl()` before rendering.
- No admin/staff security code, Supabase code, navigation architecture, or completed premium page was changed.
- Blog behavior remains untouched.

## Content safeguards

- The page does not imply Maven owns or controls any linked authority or institution.
- External-site availability, content and requirements are explicitly described as changeable.
- The page directs users to verify current requirements at the source.
- Public portal information is not framed as entity-specific legal, tax, accounting or regulated professional advice.
- No new professional credentials, client counts, testimonials, affiliations, offices, statutory-audit claims, statutory rates or deadlines were introduced.

## Validation

Clean/source validation:

- Useful Links regression tests: **8 / 8 passed**.
- JavaScript syntax suite: **127 / 127 passed**.
- Full Node source / SEO / unit suite: **180 / 180 passed**.

Temporary QA build (local dependency placeholders only; removed before packaging):

- Production page generation completed and all responsive image variants were generated.
- Generated Useful Links page: **1 H1**.
- Heading-level skips: **0**.
- Duplicate IDs: **0**.
- CMS source cards: **7**.
- Secure external-link controls: **7 / 7**.
- Verify-before-acting steps: **4**.
- Related resource cards: **3**.
- Generated external directory exactly matched the seven approved CMS name/URL pairs: **yes**.
- Missing internal links from generated Useful Links page: **0**.
- Desktop layout QA at **1440px**: **0px horizontal overflow**.
- Mobile layout QA at **390px**: **0px horizontal overflow**.
- Isolated browser render page errors: **0** at both widths.

The managed browser blocks ordinary localhost navigation in this environment, so visual QA used the generated production `<main>` with production CSS inlined into an isolated QA shell; the existing hero image was embedded for the layout pass. Temporary `node_modules`, generated `dist`, QA shell/screenshots and dependency placeholders are removed before packaging.
