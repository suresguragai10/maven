# Maven Controlled Implementation Batch Roadmap

This roadmap converts the replacement handbook into small, reviewable implementation batches. The handbook remains the product/acceptance source of truth; this file only groups its tasks into a safe working order.

## Non-negotiable workflow for every batch

1. Work from `professional-update`; keep `main` untouched until the final release gate.
2. Inspect the current source before editing; never re-implement a completed patch just because an older task description says "implement".
3. Keep Finance/tax/legal values unchanged unless owner-approved primary-source evidence is supplied.
4. Run syntax, automated tests and production build where the environment permits.
5. Perform localhost responsive/visual review before commit/push.
6. Push only an accepted checkpoint to `professional-update`.
7. Database/security gates must be proven against disposable/local/test infrastructure before production.

## Batch 1 - Professional foundation and product-rule patch

**State:** implemented in the current `professional-update` checkpoint; verification gates remain.

**Handbook coverage:** Tasks 0-10 plus foundations for Tasks 11-13 and 20.

Delivered foundations include the Maven design system, Nepal-first public composition, purposeful local service imagery, Industries master/detail, collapsed disclosures, grouped Work Desk navigation/My Tasks direction, Attendance, My Profile, Staff Directory, split admin architecture foundations, database migration/RLS scaffolding and regression-test updates.

Batch 1 is not the release gate. Database execution, full browser coverage and final visual approval remain separate requirements.

## Batch 2 - Footer, restrained motion and public visual polish

**Batch 2C is complete and green.** Batch 2B passed the owner workstation syntax/unit/build gates and localhost visual review; Batch 2C subsequently passed the full Chromium responsive/interaction suite with 307/307 tests. Database/security work then advanced to Batch 3.


**Primary handbook coverage:** Tasks 6-13, especially Tasks 11, 12 and 13.

**Scope:**

- Recompose the shared footer so it is materially shorter and better balanced without rewriting legal/disclaimer meaning.
- Give the Maven/company area usable width and keep the four footer navigation groups clear.
- Constrain disclaimer measure and make the copyright row compact.
- Prevent WhatsApp and Back-to-Top controls from covering the footer or mobile safe areas.
- Keep Back-to-Top secondary and reveal it only after meaningful scrolling.
- Finish the native progressive reveal system so core content cannot remain hidden when JavaScript/observer initialization fails.
- Respect `prefers-reduced-motion` in JavaScript as well as CSS.
- Add restrained button/card/image/accordion micro-interactions and keep header scroll feedback subtle.
- Recheck Home, Services, Industries, FAQ, About, International and Contact composition/responsive behavior without adding filler copy or random imagery.

**Acceptance gate:** syntax/unit/build remain green; Chromium Playwright covers every generated public route at 320/360/390/430/768/1024/1280/1440 with no document overflow; dynamic mobile-nav/Industries/FAQ/Contact/calculator states remain contained; floating controls clear the footer; critical pages emit no uncaught runtime error or broken same-origin asset; owner localhost smoke review remains satisfactory before push.

## Batch 3 - Attendance/profile database proof and security baseline

**State:** local acceptance gate passed on the owner workstation; checkpoint pending final diff review, commit and push to `professional-update`.

**Handbook coverage:** Task 1 plus the database-authoritative parts of Tasks 20 and 21.

- Apply migrations only to disposable/local/test Postgres or test Supabase.
- Prove employee/reviewer own-only attendance, admin all-staff access, inactive-user denial and direct-table mutation denial.
- Prove correction reason/audit history and profile role/self-edit boundaries.
- Review SECURITY DEFINER functions, grants and search paths.
- Confirm no GPS/IP/device/screenshot/presence/productivity fields exist.

**Acceptance gate:** database matrices pass with exact counts and no unresolved P0/P1 security/data-integrity defect.

## Batch 4 - Work Desk systematic UX completion

**Handbook coverage:** Tasks 2-5 and 19.

- Finish My Tasks All / Client / Firm hierarchy and role-aware navigation.
- Preserve stricter Client Work semantics and lighter collaborative Firm Work semantics.
- Complete Attendance daily/monthly UX against the proven database rules.
- Finish My Profile, Staff Directory and Work Desk administration boundaries.
- Polish Client/Firm detail handoff around status, blocker, Next Action and trustworthy history.

**Acceptance gate:** employee/reviewer/admin browser paths, mobile layout, deep links and permission-sensitive actions verified.

## Batch 5 - Website Content Admin and future-content readiness

**Handbook coverage:** Tasks 14, 15 and 18.

- Complete routine `site.yaml` editing without a giant raw-YAML workflow.
- Protect structural and finance/legal-sensitive fields appropriately.
- Verify per-admin GitHub identity/token handling, stale-SHA conflict safety and Saved-vs-Deployed messaging.
- Keep Team/Testimonials/Blog independent, hidden/noindexed until deliberately published.

**Acceptance gate:** two-admin conflict scenarios, validation, disconnect/token behavior and hidden-content behavior verified; production identity-gate limitations documented truthfully.

## Batch 6 - Nepal-first SEO, performance and privacy measurement

**Handbook coverage:** Tasks 16 and 17.

- Review page intent, internal linking and conversion paths without keyword stuffing or fabricated proof.
- Preserve canonical/sitemap/robots/noindex/schema tests.
- Measure representative build size, image/LCP/CLS behavior and third-party requests before optimizing.
- Verify CSP/privacy statements match actual integrations.

**Acceptance gate:** generated SEO tests pass and performance/privacy changes are evidence-driven.

## Batch 7 - Attendance regression, full security regression and PWA

**Handbook coverage:** remaining Task 20, Task 21 and Task 22.

- Add browser coverage for own-vs-admin attendance, CSV and correction validation.
- Run the full RLS/offboarding/security matrix after all operational changes.
- Reverify PWA installability and prove authenticated/client/attendance API data is not cached as offline business data.

**Acceptance gate:** browser + DB security suites pass and PWA cache/storage inspection is clean.

## Batch 8 - Release candidate and final GitHub gate

**Handbook coverage:** Task 23 and the release checklist.

- Freeze feature scope; fix blocking regressions only.
- Run clean install, syntax, unit/SEO, browser/cross-browser, DB/RLS, Admin and PWA gates.
- Review `git status` and staged diff for secrets/generated artifacts.
- Push the reviewed release candidate, confirm the deployed commit and run non-destructive production smoke checks.
- Merge to `main` only after explicit owner approval.

**Final outcome:** `SAFE TO DEPLOY` only when the complete release evidence agrees.
