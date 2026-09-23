# 404 Premium Pass — 2026-09-23

## Scope

This pass redesigns the generated `404.html` system page only, plus 404-specific documentation and regression coverage. It uses the Terms-complete repository as its baseline and does not change public CMS content, completed premium pages, navigation/footer architecture, security boundaries, Privacy/Tawk behavior, or Blog visibility.

## What changed

1. Replaced the generic page-hero + centered-button treatment with a dedicated branded 404 recovery layout.
2. Preserved the existing `Page not found` H1 and the required `Go to Homepage` recovery action.
3. Added a restrained oversized `404` background marker that is decorative and hidden from assistive technology.
4. Added a recovery panel linking only to established public destinations: Services, Resources, FAQ and Contact.
5. Added a secondary site-structure prompt using the existing main navigation/footer as additional recovery paths.
6. Removed the old inline presentation styles from the 404 renderer and moved all 404 presentation into scoped `not-found-premium-*` CSS.
7. Added desktop, tablet, mobile and reduced-motion handling without adding a runtime dependency.
8. Kept the existing generated-page build contract, noindex behavior and Cloudflare 404 fallback unchanged.

## Content and architecture preservation

- `content/site.yaml` is byte-for-byte unchanged by this pass.
- `admin/admin.js`, `layout.js`, `build.js`, `package-lock.json` and `wrangler.jsonc` are unchanged.
- The 404 remains generated as `dist/404.html` by the existing `build.js` code.
- `wrangler.jsonc` still uses `not_found_handling: "404-page"`.
- The 404 remains `noindex` and excluded from the sitemap.
- The intentionally hidden/noindex Blog is not surfaced in the new recovery links.
- No client counts, credentials, offices, affiliations, testimonials, legal promises or other new business claims were introduced.
- No admin/staff security code, Supabase code, CMS structure, Tawk/privacy behavior or completed premium page was changed.

## Validation

Clean/source validation:

- 404-specific regression tests: **8 / 8 passed**.
- JavaScript syntax suite: **131 / 131 passed**.
- Full Node source / SEO / unit suite during QA: **212 / 212 passed**.
- `content/site.yaml`: unchanged from the Terms-complete baseline.
- `admin/admin.js`: unchanged.
- `layout.js`: unchanged.
- `build.js`: unchanged.
- `package-lock.json`: unchanged.
- `wrangler.jsonc`: unchanged.

Generated-page validation:

- Unknown path via the project test server returns HTTP status: **404**.
- Unknown path serves the redesigned page: **yes**.
- Required `Go to Homepage` recovery link is present: **yes**.
- 404 remains noindex: **yes**.
- 404 remains excluded from the sitemap: **yes**.
- Generated 404 page H1 count: **1**.
- Recovery-panel links: **4**.
- Duplicate IDs: **0**.
- Heading-level skips: **0**.

Visual/layout QA using the generated 404 HTML with production CSS in an isolated Chromium page:

- Desktop width: **1440px** — horizontal overflow **0px**.
- Mobile width: **390px** — horizontal overflow **0px**.
- Isolated render page errors: **0** at both widths.
- Desktop and mobile screenshots were visually reviewed for hierarchy, recovery-panel balance, CTA visibility, mobile stacking and footer transition.

A normal package install was not available in the QA environment. The generated build and full source/SEO/unit suite therefore used temporary QA-only module stand-ins outside the final source plus temporary browser-copy placeholders where `build.js` expects installed browser bundles. These stand-ins, `node_modules`, generated `dist`, screenshots and other QA artifacts are removed before packaging. Install the real npm dependencies and run the production build during final whole-site QA.
