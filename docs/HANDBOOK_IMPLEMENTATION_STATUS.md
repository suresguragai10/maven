# Replacement Handbook Implementation Status

This file tracks the repository implementation against `Maven_Professional_Replacement_Implementation_Handbook_Aug2026.docx`. A task is not marked complete merely because UI/source exists; acceptance tests and environment-dependent checks still matter.

## Current verification evidence

- Owner workstation: `npm.cmd install` completed with 0 reported vulnerabilities on 17 Aug 2026.
- Owner workstation: `npm.cmd run build` completed successfully and generated the public site, Admin and Staff output.
- This Batch 2 source pass: `npm run test:syntax` => **89 passed / 0 failed**.
- This Batch 2 dependency-free source pass: `node --test test/batch2-source.test.js test/calc-utils.test.js test/tax-calc.test.js` => **23 passed / 0 failed**.
- Clean `npm ci`, full `npm test`, Playwright browsers and database/RLS integration still need to be run on the owner workstation/test database before release.

## Current controlled batch

Batch 2 is the active source pass: shared footer composition, floating-action/footer clearance, restrained progressive motion and public visual polish. See `docs/IMPLEMENTATION_BATCH_ROADMAP.md` for the future batch grouping. This does not waive the owner localhost review or the database/browser release gates.

## Task status

| Task | Area | Status | Notes / remaining gate |
|---|---|---|---|
| 0 | Foundation baseline | PARTIAL | Added portable `npm run test:syntax`. Local build is proven; clean `npm ci`, full unit/UI/DB results still required. |
| 1 | Attendance/profile DB | IMPLEMENTED, TEST PENDING | Migration hardened with deterministic Nepal work-date helper and `public, pg_temp` search path; DB matrix expanded. Must run against disposable/test Postgres/Supabase. |
| 2 | My Tasks | IMPLEMENTED, UI TEST PENDING | My Tasks title, explicit Client/Firm creation actions, All/Client/Firm segmented scope control and scope explanation added. |
| 3 | Attendance UX | IMPLEMENTED, DB/UI TEST PENDING | Nepal-time display/correction conversion, Gregorian month/calendar, admin summary, CSV, punch state. Requires migration + role/browser tests. |
| 4 | Profile + Directory | EXISTING PATCH / REVIEW PENDING | Internal directory and self-profile exist; database permission regression and final admin UX review still required. |
| 5 | Work Desk administration boundary | EXISTING PATCH / REVIEW PENDING | Operational admin remains in Work Desk and website CMS is cross-linked only. Needs permission regression. |
| 6 | Visual system | IMPLEMENTED, VISUAL QA PENDING | Brand palette retained; spacing/radius/motion rules documented in `docs/DESIGN_SYSTEM.md`. |
| 7 | Nepal-first Home | IMPLEMENTED, VISUAL QA PENDING | International showcase moved below Nepal services/packages/industries; hero CTA reduced to two primary choices. |
| 8 | Service photography | IMPLEMENTED, VISUAL QA PENDING | Stable local image mapping + semantic editorial `<img>` system; NFRS/IFRS reporting fallback documented. |
| 9 | Industries master/detail | EXISTING PATCH + REGRESSION TEST | Stable selector grid/full-width detail remains; browser test already covers sibling-height bug/deep links. |
| 10 | Collapsed disclosures | EXISTING PATCH + EXPANDED TEST | FAQ/Documents plus NFRS/International/CFO collapsed state covered. |
| 11 | Whitespace/composition | BATCH 2 POLISH / VISUAL QA PENDING | About/International composition remains; shared footer rhythm and disclaimer measure were tightened. Owner localhost review required. |
| 12 | Accessibility + motion | BATCH 2 ENHANCED, UI TEST PENDING | Reveal now fails open if observer setup fails, reduced-motion users skip reveal waiting, accordion ARIA/transition state is synchronized, and header feedback remains restrained. |
| 13 | Responsive/floating UX | BATCH 2 ENHANCED, UI TEST PENDING | Floating controls respect safe areas and dynamically clear the visible footer; Back-to-Top appears only after meaningful scroll; footer links reflow 4 -> 2 -> 1 columns. |
| 14 | Website Content Admin completeness | FUTURE BATCH | Scheduled after Work Desk/database verification in the controlled roadmap. |
| 15 | Multi-admin publishing | FUTURE BATCH | Scheduled with Website Content Admin; production identity gate remains environment-dependent. |
| 16 | Nepal-first content/SEO | NOT STARTED IN THIS BATCH | Technical SEO exists; page-intent/conversion pass remains. |
| 17 | Performance/privacy | NOT STARTED IN THIS BATCH | Requires measured build/browser run. |
| 18 | Hidden Team/Testimonials/Blog readiness | NOT STARTED IN THIS BATCH | Hidden state already exists; admin draft workflow review remains. |
| 19 | Work detail/handoff polish | FUTURE BATCH | Scheduled with the systematic Work Desk UX completion batch. |
| 20 | Attendance QA/reporting | PARTIAL | DB matrix expanded; browser attendance tests/correction-history UI still required. |
| 21 | Full RLS/offboarding regression | NOT VERIFIED | Requires local/test database. Do not certify from source inspection. |
| 22 | PWA regression | NOT STARTED IN THIS BATCH | Requires browser/Application/Cache Storage verification. |
| 23 | Release gate | NOT READY | Must remain blocked until all P0/P1, DB, browser and production checks pass. |

## Release warning

Do not merge this implementation into production `main` only because the public build succeeds. Attendance/profile SQL must be applied and tested in a disposable/test Supabase environment first, and the public visual changes should be approved via localhost before push/merge.
