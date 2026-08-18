# Replacement Handbook Implementation Status

This file tracks the repository implementation against `Maven_Professional_Replacement_Implementation_Handbook_Aug2026.docx`. A task is not marked complete merely because UI/source exists; acceptance tests and environment-dependent checks still matter.

## Current verification evidence

- Owner workstation, Batch 2B checkpoint: `npm.cmd run test:syntax` => **90 passed / 0 failed**.
- Owner workstation, Batch 2B checkpoint: `npm.cmd test` => **42 passed / 0 failed**.
- Owner workstation, Batch 2B checkpoint: `npm.cmd run build` => **PASS**; public site, Admin and Staff output generated.
- Owner localhost review of Batch 2B public composition: **approved** before commit/push.
- Batch 2C adds the broader Playwright responsive/interaction gate; it is **NOT VERIFIED** until `npm.cmd run test:ui` actually runs on the owner workstation.
- Database/RLS integration still requires disposable/local/test infrastructure before release.

## Current controlled batch

**Batch 2C - Public Responsive and Interaction Verification Gate is the active pass.** Batch 2B is owner-approved and pushed; 2C deliberately avoids another redesign and instead expands browser evidence across all generated public routes and the agreed responsive widths. See `docs/BATCH2C_VERIFICATION_GATE.md`. Database/security work remains blocked until this public browser gate is reviewed.

## Task status

| Task | Area | Status | Notes / remaining gate |
|---|---|---|---|
| 0 | Foundation baseline | PARTIAL | Added portable `npm run test:syntax`. Local build is proven; clean `npm ci`, full unit/UI/DB results still required. |
| 1 | Attendance/profile DB | IMPLEMENTED, TEST PENDING | Migration hardened with deterministic Nepal work-date helper and `public, pg_temp` search path; DB matrix expanded. Must run against disposable/test Postgres/Supabase. |
| 2 | My Tasks | IMPLEMENTED, UI TEST PENDING | My Tasks title, explicit Client/Firm creation actions, All/Client/Firm segmented scope control and scope explanation added. |
| 3 | Attendance UX | IMPLEMENTED, DB/UI TEST PENDING | Nepal-time display/correction conversion, Gregorian month/calendar, admin summary, CSV, punch state. Requires migration + role/browser tests. |
| 4 | Profile + Directory | BATCH 2A CONSISTENCY FIX / REVIEW PENDING | Internal directory and self-profile exist; profile photos remain optional/simple, accept only controlled sources compatible with Staff CSP, and fall back to initials. Database permission regression and final admin UX review still required. |
| 5 | Work Desk administration boundary | EXISTING PATCH / REVIEW PENDING | Operational admin remains in Work Desk and website CMS is cross-linked only. Needs permission regression. |
| 6 | Visual system | BATCH 2B OWNER-APPROVED / 2C BROWSER GATE | Brand palette retained; visual localhost review approved; automated responsive gate now broadened. |
| 7 | Nepal-first Home | BATCH 2B OWNER-APPROVED / 2C BROWSER GATE | Nepal-first order preserved; Batch 2B rhythm/mobile CTA polish approved; 2C rechecks dynamic responsive behavior. |
| 8 | Service photography | OWNER VISUAL REVIEW PASSED / REGRESSION GATE | Stable local image mapping remains; 2C all-route responsive checks guard against crop/layout spill. |
| 9 | Industries master/detail | EXISTING PATCH + REGRESSION TEST | Stable selector grid/full-width detail remains; browser test already covers sibling-height bug/deep links. |
| 10 | Collapsed disclosures | EXISTING PATCH + EXPANDED TEST | FAQ/Documents plus NFRS/International/CFO collapsed state covered. |
| 11 | Whitespace/composition | BATCH 2B OWNER-APPROVED | Public composition/footer rhythm approved on localhost; 2C converts remaining responsive confidence into browser regression evidence. |
| 12 | Accessibility + motion | BATCH 2 ENHANCED / 2C UI GATE PENDING | Existing heading/reduced-motion/JS-disabled/accordion tests are retained; 2C adds runtime/mobile interaction smoke evidence. |
| 13 | Responsive/floating UX | BATCH 2C VERIFICATION ACTIVE | All generated public routes now enter the 8-width overflow matrix; dynamic states and floating/footer geometry receive dedicated Playwright coverage. |
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


## Batch 2B public visual composition

Owner workstation syntax/unit/build gates passed and localhost visual review was approved before commit/push. Scope remained limited to public composition/responsive behavior. See `docs/BATCH2B_VISUAL_COMPOSITION.md`.

## Batch 2C public verification gate

Verification-only browser coverage now expands the public overflow matrix to every generated public route and adds dynamic-state, floating-control and runtime/local-asset checks. See `docs/BATCH2C_VERIFICATION_GATE.md`. Do not mark this gate PASS until Playwright actually runs on the owner workstation.
