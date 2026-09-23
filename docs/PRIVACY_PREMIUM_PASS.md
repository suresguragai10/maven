# Privacy Policy Premium Pass — 2026-09-23

## Scope

This pass redesigns `privacy.html` only, plus page-specific documentation and regression coverage. The existing `content/site.yaml` privacy intro, section titles, section text and `privacyLastReviewed` value remain the source of truth and were not rewritten.

## What changed

1. Kept the existing photographic legal-page hero and current Privacy Policy heading/subtitle.
2. Replaced the narrow plain-text body with a professional legal-document layout: a policy index beside the main document on desktop and stacked above it on smaller screens.
3. Added numbered section navigation generated from the same live `privacySections` array used for the policy body.
4. Added stable same-page anchors generated from each section title so the index and document remain synchronized as CMS content changes.
5. Promoted the existing policy intro into a restrained document overview treatment without changing its wording.
6. Rendered each existing policy section as a clear numbered document section while preserving its full CMS-managed title and text.
7. Kept the existing owner-controlled `privacyLastReviewed` value visible in the document index rather than generating a date automatically.
8. Kept the existing Contact Maven closing CTA and existing SEO title/description.
9. Added dedicated desktop, tablet, mobile and reduced-motion styling without adding a runtime dependency.

## CMS, privacy and architecture preservation

- `content/site.yaml` is byte-for-byte unchanged by this pass.
- The existing Website Admin Privacy Policy editor is unchanged.
- Privacy rendering still comes from `data.privacyIntro`, `data.privacySections` and `data.privacyLastReviewed`.
- The Formspree and Tawk.to disclosures remain in the CMS-managed policy text exactly as before.
- The warning not to send financial records, identification documents, banking information, payroll files or other confidential documents through the general website form or live chat remains unchanged.
- The existing Tawk integration and site-wide Tawk/privacy notice were not modified.
- Terms of Service remains on its existing renderer and was not redesigned in this pass.
- No admin/staff security code, Supabase code, navigation architecture, completed premium page or Blog behavior was changed.
- No new legal promises, retention periods, data-processing claims, jurisdictional rights or substantive legal positions were introduced.

## Validation

Clean/source validation:

- Privacy Policy regression tests: **8 / 8 passed**.
- JavaScript syntax suite: **129 / 129 passed**.
- Full Node source / SEO / unit suite during QA: **196 / 196 passed**.
- `content/site.yaml` SHA-256 matched the Testimonials-complete baseline exactly.
- `admin/admin.js` and `layout.js` matched the baseline exactly.

Generated-page validation:

- Production page generation completed in the temporary QA environment.
- Generated Privacy Policy page: **1 H1**.
- Privacy policy sections: **8**.
- Policy-index links: **8**.
- Policy-index anchors match the generated section IDs: **yes**.
- Duplicate IDs: **0**.
- Heading-level skips: **0**.
- Rendered policy intro matches the CMS source exactly: **yes**.
- Rendered section titles match the CMS source exactly: **yes**.
- Rendered section bodies match the CMS source exactly: **yes**.
- Last-reviewed value: **September 2026**, sourced from `privacyLastReviewed`.
- Privacy page remains public/indexable: **yes**.
- Canonical route: `https://mavennepal.com.np/privacy`.

Visual/layout QA using the generated production Privacy Policy `<main>` with production CSS in an isolated Chromium shell:

- Desktop width: **1440px** — horizontal overflow **0px**.
- Mobile width: **390px** — horizontal overflow **0px**.
- Isolated render page errors: **0** at both widths.
- Desktop and mobile screenshots were visually reviewed for hero readability, index/document balance, section hierarchy, text measure, responsive stacking and CTA layout.

`npm ci --no-audit --no-fund` did not complete within the environment timeout. The production-generation QA therefore used temporary local dependency placeholders only where the interrupted install left required packages incomplete; those placeholders, the partial `node_modules`, generated `dist`, and QA screenshots are removed before packaging. Normal real dependencies must be installed and the production build rerun in the deployment environment as part of final whole-site QA.
