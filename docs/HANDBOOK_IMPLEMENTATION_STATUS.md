# Replacement Handbook Implementation Status

This file tracks the repository implementation against `Maven_Professional_Replacement_Implementation_Handbook_Aug2026.docx`. A task is not marked complete merely because UI/source exists; acceptance tests and environment-dependent checks still matter.

## Current verification evidence

- Owner workstation: `npm.cmd install` completed with 0 reported vulnerabilities on 17 Aug 2026.
- Owner workstation: `npm.cmd run build` completed successfully and generated the public site, Admin and Staff output.
- This source pass: `node scripts/check-syntax.js` => **88 passed / 0 failed**.
- This source pass: `node --test test/calc-utils.test.js test/tax-calc.test.js` => **18 passed / 0 failed**.
- Clean `npm ci`, full `npm test`, Playwright browsers and database/RLS integration still need to be run on the owner workstation/test database before release.

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
| 11 | Whitespace/composition | EXISTING PATCH / VISUAL QA PENDING | About proof panel and International proof grid exist; owner localhost review required. |
| 12 | Accessibility + motion | IMPLEMENTED, UI TEST PENDING | Continuous hero bob removed; JS scrolling now respects reduced motion; all-page heading regression added. |
| 13 | Responsive/floating UX | IMPLEMENTED, UI TEST PENDING | Floating controls now respect safe-area insets; overflow coverage expanded. |
| 14 | Website Content Admin completeness | NOT STARTED IN THIS BATCH | Next implementation batch. |
| 15 | Multi-admin publishing | NOT STARTED IN THIS BATCH | Next implementation batch; production identity gate remains environment-dependent. |
| 16 | Nepal-first content/SEO | NOT STARTED IN THIS BATCH | Technical SEO exists; page-intent/conversion pass remains. |
| 17 | Performance/privacy | NOT STARTED IN THIS BATCH | Requires measured build/browser run. |
| 18 | Hidden Team/Testimonials/Blog readiness | NOT STARTED IN THIS BATCH | Hidden state already exists; admin draft workflow review remains. |
| 19 | Work detail/handoff polish | NOT STARTED IN THIS BATCH | Next Work Desk batch. |
| 20 | Attendance QA/reporting | PARTIAL | DB matrix expanded; browser attendance tests/correction-history UI still required. |
| 21 | Full RLS/offboarding regression | NOT VERIFIED | Requires local/test database. Do not certify from source inspection. |
| 22 | PWA regression | NOT STARTED IN THIS BATCH | Requires browser/Application/Cache Storage verification. |
| 23 | Release gate | NOT READY | Must remain blocked until all P0/P1, DB, browser and production checks pass. |

## Release warning

Do not merge this implementation into production `main` only because the public build succeeds. Attendance/profile SQL must be applied and tested in a disposable/test Supabase environment first, and the public visual changes should be approved via localhost before push/merge.
