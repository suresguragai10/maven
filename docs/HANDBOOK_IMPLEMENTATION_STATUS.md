# Replacement Handbook Implementation Status

This file tracks the repository implementation against `Maven_Professional_Replacement_Implementation_Handbook_Aug2026.docx`. A task is not marked complete merely because UI/source exists; acceptance tests and environment-dependent checks still matter.

## Current verification evidence

- Batch 2B public composition was owner-approved on localhost before its checkpoint.
- Batch 2C Chromium browser gate is proven on the owner workstation: `npm.cmd run test:ui` => **307 passed / 0 failed**.
- Batch 3 disposable database proof is proven with `node tests/db/run.js`: **278 checks / 0 mismatches** across **33 repository migrations**.
- Batch 3 JavaScript syntax: `npm.cmd run test:syntax` => **92 passed / 0 failed**.
- Batch 3 main automated suite: `npm.cmd test` => **46 passed / 0 failed**.
- Batch 3 production build: `npm.cmd run build` => **PASS**; public site, Admin and Staff output generated.
- Batch 3 full Chromium regression: `npm.cmd run test:ui` => **307 passed / 0 failed**.
- The database proof uses a fresh disposable local Postgres instance and proves repository migration/RLS/RPC behavior. It does **not** certify a live Supabase deployment or production release.

## Current controlled batch

**Batch 3 - Attendance/profile database proof and security baseline has passed its defined local verification gate.** The repository migrations were exercised against disposable local Postgres with 278 checks / 0 mismatches, and syntax/unit/build/full Chromium regression gates are green. The Batch 3 checkpoint is still pending final diff review, commit and push to `professional-update`; do not start Batch 4 until that checkpoint is clean. `main` remains untouched.

## Task status

| Task | Area | Status | Notes / remaining gate |
|---|---|---|---|
| 0 | Foundation baseline | PARTIAL | Owner-workstation syntax, unit, Chromium UI, disposable DB and production-build gates are now proven. Clean `npm ci`, cross-browser, deployment and release-environment checks remain later gates. |
| 1 | Attendance/profile DB | DATABASE PROOF PASSED | All 33 repository migrations applied to disposable local Postgres; attendance/profile RLS/RPC matrix now passes with exact evidence. Live Supabase deployment remains a separate release check. |
| 2 | My Tasks | IMPLEMENTED, CURRENT UI REGRESSION PASSED / BATCH 4 UX REVIEW PENDING | My Tasks title, explicit Client/Firm creation actions, All/Client/Firm segmented scope control and scope explanation are implemented and covered by the current Chromium regression. Systematic role-aware Work Desk UX completion remains in Batch 4. |
| 3 | Attendance UX | IMPLEMENTED, DB PROOF PASSED / UI QA PENDING | Nepal-time display/correction conversion, Gregorian month/calendar, admin summary, CSV and punch-state foundations remain. Database rules are proven; focused Attendance browser/CSV/correction-history UX verification remains for later Work Desk/attendance QA batches. |
| 4 | Profile + Directory | DATABASE PERMISSION PROOF PASSED / UX REVIEW PENDING | Internal directory and self-profile exist; controlled self-profile updates and protected admin-managed fields are proven in the database matrix. Profile photos remain optional/simple with controlled sources and initials fallback. Final Work Desk UX review remains. |
| 5 | Work Desk administration boundary | EXISTING PATCH / DATABASE REGRESSION PASSED | Operational admin remains in Work Desk and website CMS is cross-linked only. Current database permission regression is green; final Work Desk UX/admin review remains. |
| 6 | Visual system | BATCH 2B OWNER-APPROVED / 2C BROWSER PASSED | Brand palette retained; visual localhost review approved; full Chromium responsive/interaction regression is green. |
| 7 | Nepal-first Home | BATCH 2B OWNER-APPROVED / 2C BROWSER PASSED | Nepal-first order preserved; Batch 2B rhythm/mobile CTA polish approved; Batch 2C responsive/browser regression passed. |
| 8 | Service photography | OWNER VISUAL REVIEW PASSED / REGRESSION PASSED | Stable local image mapping remains; Batch 2C all-route responsive checks passed. |
| 9 | Industries master/detail | EXISTING PATCH + REGRESSION TEST | Stable selector grid/full-width detail remains; browser test already covers sibling-height bug/deep links. |
| 10 | Collapsed disclosures | EXISTING PATCH + EXPANDED TEST | FAQ/Documents plus NFRS/International/CFO collapsed state covered. |
| 11 | Whitespace/composition | BATCH 2B OWNER-APPROVED / 2C BROWSER PASSED | Public composition/footer rhythm was approved on localhost, and Batch 2C converted the remaining responsive confidence into passing browser regression evidence. |
| 12 | Accessibility + motion | BATCH 2 ENHANCED / 2C UI GATE PASSED | Heading, reduced-motion, JS-disabled, accordion and runtime/mobile interaction coverage remains green in the full Chromium suite. |
| 13 | Responsive/floating UX | BATCH 2C VERIFICATION PASSED | All generated public routes passed the 8-width overflow matrix; dynamic states and floating/footer geometry passed dedicated Playwright coverage. |
| 14 | Website Content Admin completeness | FUTURE BATCH | Scheduled after Work Desk/database verification in the controlled roadmap. |
| 15 | Multi-admin publishing | FUTURE BATCH | Scheduled with Website Content Admin; production identity gate remains environment-dependent. |
| 16 | Nepal-first content/SEO | NOT STARTED IN THIS BATCH | Technical SEO exists; page-intent/conversion pass remains. |
| 17 | Performance/privacy | NOT STARTED IN THIS BATCH | Requires measured build/browser run. |
| 18 | Hidden Team/Testimonials/Blog readiness | NOT STARTED IN THIS BATCH | Hidden state already exists; admin draft workflow review remains. |
| 19 | Work detail/handoff polish | FUTURE BATCH | Scheduled with the systematic Work Desk UX completion batch. |
| 20 | Attendance QA/reporting | PARTIAL - DATABASE PROOF PASSED | Database matrix now proves attendance/RLS/RPC behavior; focused browser attendance, CSV and correction-history UX verification still remains. |
| 21 | Full RLS/offboarding regression | CURRENT DATABASE BASELINE PASSED / FINAL REGRESSION LATER | Disposable local database matrix passes 278 checks / 0 mismatches, including inactive-user and bypass-denial cases. The full matrix must be rerun again after later operational changes before release. |
| 22 | PWA regression | NOT STARTED IN THIS BATCH | Requires browser/Application/Cache Storage verification. |
| 23 | Release gate | NOT READY | Must remain blocked until all P0/P1, DB, browser and production checks pass. |

## Release warning

Do not merge this implementation into production `main` merely because local Batch 3 verification is green. Repository attendance/profile SQL has now been proven against disposable local Postgres, but live Supabase deployment, later Work Desk/Attendance UX verification, final full security regression, cross-browser checks and production deployment gates remain outstanding. `main` stays untouched until explicit owner release approval.

## Batch 2B public visual composition

Owner workstation syntax/unit/build gates passed and localhost visual review was approved before commit/push. Scope remained limited to public composition/responsive behavior. See `docs/BATCH2B_VISUAL_COMPOSITION.md`.

## Batch 2C public verification gate

Batch 2C verification is complete on the owner workstation. The expanded public overflow matrix covers every generated public route and includes dynamic-state, floating-control, runtime-error and local-asset checks across the agreed responsive widths.

The full Chromium Playwright suite passed with **307 passed / 0 failed**. See `docs/BATCH2C_VERIFICATION_GATE.md`.

## Batch 3 attendance/profile database proof

Batch 3 local database/security verification is complete. All 33 repository migrations were exercised against fresh disposable local PostgreSQL and the permission harness passed with **278 checks / 0 mismatches**.

Attendance/profile proof includes own-only employee/reviewer attendance access, admin all-staff access, inactive-user denial, direct-table mutation denial, audited corrections, Nepal work-date handling, anonymous RPC denial, controlled self-profile editing and the absence of surveillance fields.

This is repository migration/RLS/RPC proof against disposable local PostgreSQL; it is **not** a claim that a live Supabase or production deployment has been certified.

See `docs/BATCH3_DATABASE_SECURITY_PROOF.md`.

Batch 4 may begin only after the Batch 3 changes pass final Git diff review and the accepted checkpoint is committed and pushed to `professional-update`.

Do not merge to `main` without explicit owner release approval.