# Terms of Service Premium Pass — 2026-09-23

## Scope

This pass redesigns `terms.html` only, plus page-specific documentation and regression coverage. The existing `content/site.yaml` terms intro, section titles, section text and `termsLastReviewed` value remain the source of truth and were not rewritten.

## What changed

1. Kept the established photographic legal-page hero and current Terms of Service heading/subtitle.
2. Replaced the narrow plain-text body with a restrained professional legal-document layout: a terms index beside the main document on desktop and stacked above it on smaller screens.
3. Added numbered section navigation generated from the same live `termsSections` array used for the document body.
4. Added stable same-page anchors generated from each section title so the index and document remain synchronized with the source content.
5. Promoted the existing terms intro into a document-overview treatment without changing its wording.
6. Rendered each existing terms section as a clear numbered document section while preserving its full source title and text.
7. Kept the existing source-controlled `termsLastReviewed` value visible in the document index rather than generating a date automatically.
8. Kept the existing Contact Maven closing CTA and existing SEO title/description.
9. Added dedicated desktop, tablet, mobile and reduced-motion styling without adding a runtime dependency.

## Content, legal and architecture preservation

- `content/site.yaml` is byte-for-byte unchanged by this pass.
- Terms rendering still comes from `data.termsIntro`, `data.termsSections` and `data.termsLastReviewed`.
- All ten existing Terms section titles and bodies remain unchanged.
- The existing August 2026 last-reviewed value remains unchanged.
- The existing positions covering Maven's service boundaries, engagement/fees, client responsibilities, confidentiality, service limitations, website use, changes to terms and Nepal governing law remain in the content source rather than being hard-coded into the renderer.
- The Privacy Policy renderer remains separate on its existing `privacy-document-*` structure.
- The existing Tawk/privacy behavior was not modified.
- No admin/staff security code, Supabase code, navigation architecture, completed premium page or Blog behavior was changed.
- No new liabilities, warranties, rights, governing-law positions, dispute procedures, service promises or other substantive legal positions were introduced.

## Validation

Clean/source validation:

- Terms of Service regression tests: **8 / 8 passed**.
- Existing Privacy Policy regression tests also pass after the Terms change: **8 / 8 passed**.
- JavaScript syntax suite: **130 / 130 passed**.
- Full Node source / SEO / unit suite during QA: **204 / 204 passed**.
- `content/site.yaml` matched the Privacy-complete baseline exactly.
- `admin/admin.js`, `layout.js` and `build.js` matched the baseline exactly.

Generated-page validation:

- Generated Terms page: **1 H1**.
- Terms sections: **10**.
- Terms-index links: **10**.
- Terms-index anchors match the generated section IDs: **yes**.
- Duplicate IDs: **0**.
- Heading-level skips: **0**.
- Rendered Terms intro matches the source exactly: **yes**.
- Rendered section titles match the source exactly: **yes**.
- Rendered section bodies match the source exactly: **yes**.
- Last-reviewed value: **August 2026**, sourced from `termsLastReviewed`.
- Terms page remains public/indexable: **yes**.
- Canonical route: `https://mavennepal.com.np/terms`.

Visual/layout QA using the rendered Terms `<main>` with production CSS in an isolated Chromium shell:

- Desktop width: **1440px** — horizontal overflow **0px**.
- Mobile width: **390px** — horizontal overflow **0px**.
- Isolated render page errors: **0** at both widths.
- Desktop and mobile screenshots were visually reviewed for hero readability, index/document balance, section hierarchy, text measure, responsive stacking and CTA layout.

`npm ci --no-audit --no-fund` did not complete within the environment timeout. The broader source/SEO/unit QA therefore used temporary local dependency stand-ins only where real dependencies were unavailable; the placeholders, partial `node_modules`, generated `dist`, isolated QA shell and screenshots are removed before packaging. Normal real dependencies must be installed and the production build rerun in the deployment environment as part of final whole-site QA.
