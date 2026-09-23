# Testimonials Premium Pass — 2026-09-23

## Scope

This pass redesigns `testimonials.html` only, plus page-specific SEO, documentation and regression coverage. The existing `content/site.yaml` testimonial entries remain the source of truth. No published testimonial quote, client name, role or business name was rewritten in this pass.

## Source-of-truth check before redesign

The working repository already contains two visible testimonial entries:

1. Anil Nepal — Director, Uphaar Nepal Pvt. Ltd.
2. Laxman Khadka — Director, Adhika Consultancy Pvt. Ltd.

Both entries are marked public in the CMS content, and the Testimonials page is already public/indexable in the current repository. The redesign uses only those existing published entries and remains data-driven through `data.testimonials`.

## What changed

1. Replaced the old generic page hero and basic testimonial-card grid with a dedicated premium client-feedback composition.
2. Added a custom dark hero with a **Published Client Voices** panel that lists the currently rendered testimonial sources using the same CMS data.
3. Added explicit page principles showing the live published testimonial count, named attribution and full published quote treatment.
4. Rebuilt each testimonial as a larger editorial quote card while preserving the full CMS-supplied quote and attribution.
5. Added a grounded **Themes in Current Feedback** section covering only subjects directly present in the two published statements: accounting/records, tax/compliance, financial management and the working relationship.
6. Added clear continuation paths into Maven's Services page and Contact page without implying that a testimonial guarantees the same outcome for another client.
7. Kept a safe zero-testimonial fallback so the page never fabricates placeholder social proof if all entries are hidden later.
8. Updated only the Testimonials title/description metadata to describe the current published feedback more precisely.
9. Added dedicated desktop, tablet, mobile and reduced-motion styling without adding a runtime dependency.

## CMS and architecture preservation

- `content/site.yaml` is unchanged by this pass.
- The existing Website Admin Testimonials editor is unchanged.
- Public testimonial rendering still comes from `data.testimonials`, which filters out entries where `hidden: true`.
- New or hidden CMS entries continue to flow through the same data path; no client identity or testimonial is hard-coded into the page template.
- Existing navigation visibility behavior remains unchanged.
- No admin/staff security code, Supabase code, Tawk integration, global content architecture or completed premium page was changed.
- Blog behavior remains untouched.

## Social-proof safeguards

- No testimonial was invented, paraphrased or shortened.
- No star rating, aggregate rating, review score, client logo or unsupported client-count claim was added.
- Names, roles and business names are shown only from the existing published testimonial records.
- The hero count is calculated from the live visible testimonial array rather than hard-coded.
- The page's thematic summaries are limited to statements present in the two current published testimonials.
- If there are no visible testimonials, the page renders a neutral publication-policy message instead of placeholder praise.

## Validation

Clean/source validation:

- Testimonials regression tests: **8 / 8 passed**.
- JavaScript syntax suite: **128 / 128 passed**.
- Full Node source / SEO / unit suite: **188 / 188 passed**.

Generated-page validation:

- Generated Testimonials page: **1 H1**.
- Heading-level skips: **0**.
- Duplicate IDs: **0**.
- Published testimonial cards: **2**.
- Hero source rows: **2**.
- Feedback theme cards: **4**.
- Continuation cards: **2**.
- Rendered testimonial quote text matches the two visible CMS source entries exactly: **yes**.
- Missing internal links from the generated Testimonials page: **0**.
- Testimonials page remains indexable: **yes** (no robots `noindex` meta).
- Canonical route: `https://mavennepal.com.np/testimonials`.

Isolated visual/layout QA using the generated production `<main>` and production CSS:

- Desktop width: **1440px** — horizontal overflow **0px**.
- Mobile width: **390px** — horizontal overflow **0px**.
- Isolated render page errors: **0** at both widths.
- Desktop and mobile screenshots were visually reviewed for section stacking, quote-card readability, CTA layout and responsive collapse.

The managed browser blocks ordinary localhost/file navigation in this environment, so visual QA used the same isolated generated-page method used for the Useful Links pass: production CSS plus the generated Testimonials `<main>` loaded directly into the browser. The page has no testimonial-specific photographic dependency, so no asset substitution was needed for this layout check.

Temporary `node_modules`, generated `dist`, QA shells/screenshots and dependency placeholders are removed before packaging. Normal real dependencies should be installed and the production build rerun in the deployment environment as part of final whole-site QA.
