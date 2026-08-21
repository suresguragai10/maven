# Next Steps Tracker

A single consolidated list, built from the 12 audit/planning docs already sitting in this repo (`ARCHITECTURE_MAP.md`, `CONTENT_AUTHORITY_BRIEFS.md`, `FIRM_WORK_PEER_PERMISSIONS_AUDIT.md`, `GLOBAL_POSITIONING_MODEL.md`, `LOCAL_SEO_OWNER_CHECKLIST.md`, `NFRS_IFRS_OWNER_REVIEW.md`, `OWNER_REVIEW.md`, `PERFORMANCE_AUDIT.md`, `SEARCH_CONSOLE_CHECKLIST.md`, `SEO_INTENT_MAP.md`, `STAFF_ONBOARDING.md`, `WORK_DESK_BASELINE_SECURITY_MAP.md`) plus this session's own findings. Update the checkboxes as items close so nothing gets lost across sessions.

## Group 1 — Live database checks (quick, high value, do first)

- [x] **FIXED (2026-08-21, live + committed as `20260904090000_close_profiles_self_update_drift.sql`).** The live `profiles` table did carry the broader `profiles_update_own_or_admin` policy — a real, exploitable gap: any signed-in user could directly update their own entire row (any column, not just phone/photo), with no active-status check at all, meaning a deactivated staff member could self-reactivate by directly setting `is_active = true`. Removing it also revealed the correct admin-only policy (`profiles_update_admin`) didn't exist live either — both fixed together, verified via a real Staff & Access edit, and covered by 2 new regression checks.
- [x] **FIXED (2026-08-21, live + committed as part of the same migration).** The live `clients` table only ever had a SELECT policy — `clients_insert_admin`/`clients_update_admin` (defined in the original migration) never actually existed live. Nobody, not even admin, could add or edit a client through Work Desk. Restored both; already covered by existing local regression tests (which is exactly why this was invisible locally — the repo's own migrations were always correct, only live had drifted).
- [x] `activity_log` table — confirmed does not exist live. Nothing to do.
- [x] `rls_auto_enable()` — confirmed live and active (event trigger `ensure_rls`, auto-enables RLS on any new `public` table). Genuinely useful safety net, no action needed.
- [x] **FIXED.** `guard_task_update()` — confirmed fully orphaned (no live trigger references it, no `tasks` table exists). Cleanup migration written (`20260907090000_drop_orphaned_guard_task_update.sql`), local harness still 289/289 clean. Needs the one-line SQL run live.

## Group 2 — Small, low-risk code/doc fixes

- [x] **FIXED.** Reassignment controls (Edit Work's Assignee/Reviewer fields, and the bulk-reassign toolbar on All Work) are now admin-only, matching `guard_work_item_update()` exactly — a reviewer no longer sees a control that would have silently done nothing on save. Covered by 4 new Playwright tests.
- [x] **FIXED.** `STAFF_ONBOARDING.md` rewritten to document Create New Staff as the primary path (Dashboard kept as fallback), with a clear revision note explaining what changed and why.
- [x] Sidebar label vs. page heading mismatches — checked current state (the audit predates some earlier fixes this session): "Operations Overview" and "Catch-Up"/"Firm Work Catch-Up" are already consistent. "Team Work"→"Team" and "My To-Do"→"My To-Do List" remain, but on reflection these are just normal shortened sidebar labels (same pattern as the already-fine Catch-Up one), not genuinely confusing — left as-is.
- [x] **FIXED.** Resources page now has a full admin-panel editor (intro + all 4 tiles' title/text/CTA, matching the same locked-link pattern used elsewhere for fixed-page tiles). Covered by 2 new admin-cms tests; also had to extend the shared test fixture (`mock-github.js`) which didn't carry `resourcesHub` data at all.
- [x] **Reviewed in full, deliberately NOT refactored.** Read the actual bucketing code in all 4 relevant screens (Deadlines, Today's Needs Attention/Upcoming, Manager Dashboard's Team Workload, Reports). They aren't accidental duplicates of the same logic: Deadlines uses 4 mutually-exclusive buckets plus a statutory-date-source toggle; Today uses a reason-based dedup list plus a separate 7-day catch-all; Team Workload is deliberately *cumulative* (today ⊂ 7-days ⊂ 30-days — explicitly documented in its own code comment as intentional, not exclusive buckets); Reports is date-range trend analysis, a different concern entirely. Forcing these into one shared helper would risk a real behavior regression for a cosmetic line-count win — the low-level primitives (`effectiveDue`/`isOverdue`/`compareByDue`) already are shared, which is the correct amount of sharing for genuinely different business rules.

## Group 3 — Owner decisions needed (confirm or change, not urgent)

- [x] **Confirmed by owner (2026-08-21): keep as-is.** Firm Work: any active teammate can edit/reassign/status any Firm Work item, no ownership/role gate.
- [x] **Confirmed by owner (2026-08-21): fine as-is.** `profiles_read_authenticated`: every authenticated user can read every other profile's full contact info.
- [x] **Confirmed by owner (2026-08-21): keep as-is.** Projects: any active user (not just admin) can create/rename/archive any project.
- [x] **Confirmed by owner (2026-08-21): keep as-is.** Reviewer rescope power: a reviewer can reassign Client Work items outside their own queue.
- [x] **FIXED.** Admin self-deactivation guard added at the DB level. Along the way, found and fixed a related, deeper drift: the real live guard trigger is named `prevent_self_role_escalation` (not `guard_profile_update` as this repo's own migration had reconstructed it, which never actually ran live) — also discovered `created_at`/`updated_at` columns exist live but were undocumented in any migration. All reconciled in one migration; covered by a new regression check.
- [x] **Confirmed by owner (2026-08-21): accurate as published.** NFRS/IFRS page's capacity claims (expected credit loss calculations, consolidation/group reporting, foreign-invested/group company scope) all genuinely reflect Maven's current capability — no change needed.

## Group 4 — Content/legal verification (the owner's or a professional's call, not code)

**Highest priority — before FY 2083/84 becomes the active filing year:**
- [ ] FY 2083/84 income tax slabs — currently sourced from the Budget, not yet confirmed against the gazetted Finance Act.

**Also open, lower urgency:**
- [ ] FY 2082/83 income tax slabs (single/couple bands).
- [ ] Deduction caps: Retirement NPR 500,000 / Life Insurance NPR 40,000 / Health Insurance NPR 20,000.
- [ ] VAT rate (13%) still current.
- [ ] All 11 TDS rates/categories, individually.
- [ ] NPR 50,000 cumulative-payment contract-TDS threshold.
- [ ] SSF contribution waiver rule, including partial-year eligibility.
- [ ] "~7 working days" company registration estimate still matches current OCR practice.
- [ ] Founder bio "almost two years" US-client tenure claim still accurate.

## Group 5 — Owner actions outside the codebase

- [ ] Google Business Profile: create/claim listing using the exact NAP block in `LOCAL_SEO_OWNER_CHECKLIST.md`, complete address verification.
- [ ] Google Search Console: verify domain ownership (DNS TXT record preferred), submit sitemap, check indexing coverage periodically.
- [ ] Professional directory listings: use the same exact NAP, re-check every 6-12 months for drift.

## Group 6 — Larger future work (not urgent, real scope)

- [x] **Re-scoped (2026-08-21, full public-site audit — see `docs/PUBLIC_SITE_AUDIT_2026_08.md`).** The premise here was wrong: checked every non-Home/Services page directly — none of them ever had a photo-per-category grid to begin with (they use a single hero photo + icon-based cards). There's no old pattern left to "consolidate." If a capability-chapter treatment is wanted on other pages, that's a fresh design decision needing new photography, not a continuation of started work — genuinely optional, not queued.
- [ ] Responsive image `srcset`/`sizes` pipeline — every image currently ships full-resolution to every device; needs an image-processing dependency (e.g. `sharp`), a real architectural addition, not a quick fix.
- [ ] Blog content: 6 flagship briefs are planning-ready (`CONTENT_AUTHORITY_BRIEFS.md`), nothing drafted or published, blog stays hidden until real content exists. Brief 6 (outsourcing from Nepal) needs real sourcing research before it can even be drafted safely.
- [ ] OTP-based account creation/reset (in place of the email-link invite) — the user's own idea, explicitly deferred earlier this session.

## Group 7 — From the 2026-08-21 full public-site + Work Desk audits

Public site (`docs/PUBLIC_SITE_AUDIT_2026_08.md`):
- [x] 5 stale prior-audit-doc claims corrected in place (`ARCHITECTURE_MAP.md` x4, `SEO_INTENT_MAP.md`, `BUSINESS_CONTENT_REVIEW.md`) — capability chapters, stagger motion, per-card CTAs, and the Resources CMS gap had all already shipped but were never marked done; the reviewer-reassignment fix from earlier tonight was also still shown as open there.
- [x] **FIXED.** Home and About no longer duplicate the same proof-panel copy. About now leads with `data.aboutClosing` (an already-existing, already-approved "who we are" paragraph, previously buried as a second paragraph on About) instead of repeating Home's `data.aboutText`. Zero new content written — used only real copy that already existed. Verified visually via screenshot (clean layout, no breakage) and covered by a new regression test.
- [ ] `.accordion-panel` and `.doc-card-tab` transitions run at 300ms vs. ~150-220ms for the rest of the site's hover/toggle transitions (`styles.css:359,511`) — minor, worth tightening to ~200ms for a snappier feel, not a rule violation (no hard ms ceiling is actually written down anywhere).
- [ ] Blog card headings skip a level (`<h1>` straight to `<h3>`, `pages4.js:47`) — low priority, blog is still hidden with zero real posts.

Work Desk (`docs/WORK_DESK_UI_AUDIT_2026_08.md` — note: the audit agent's own working directory defaulted to the stale old OneDrive path, so its output landed there and its own git-history check was against a stale clone; its actual `staff.js` content citations were verified accurate against current code before acting on anything):
- [x] **FIXED.** Real data-integrity bug: "Mark Documents Received" discarded the result of its first update (marking waiting items received) and only checked the second before showing success — a failure would silently report success while items stayed unreceived. Now checks both, covered by a new regression test.
- [x] **FIXED.** New Template's Create button had no double-submit guard (unlike its own Edit Template counterpart and every sibling create flow) — a fast double-click could create duplicate templates with duplicate checklists. Now disables during save, covered by a new regression test.
- [x] **FIXED.** Dead duplicate `initials()` function removed (a function-hoisting shadow bug — the second definition silently won for every call site, the first was unreachable dead code with a misleading comment).
- [x] **FIXED.** Priority dots (work/Firm Work rows) were color-only with just a `title` tooltip, not a reliable accessible name — added `role="img"` + `aria-label`.
- [x] **FIXED.** Two icon-only buttons (To-Do delete, checklist editor's Move Up/Down/Remove) had no `aria-label`, relying only on `title`.
- [ ] Two functions have grown large (`renderReportsPage` ~450 lines, `openNewWorkModal` ~700 lines) — not broken, a future refactor candidate, not urgent.
- [ ] Client activate/deactivate logic duplicated between the list and detail views, with an unexplained asymmetry in which actions each surface offers — worth a deliberate decision, not urgent.
- [x] **FIXED.** `returnBtn`, `addWaitBtn`, `commentBtn`, `addItemBtn` within `renderWorkDetail` now all disable during their save, matching sibling buttons in the same function.

## Housekeeping

- [x] The 12 pre-existing audit docs listed at the top turned out to already be committed (from earlier this session) — confirmed via `git ls-files`, nothing to do.
- [ ] Old OneDrive folder copy (`OneDrive - Nepa Wholesale Inc (1)\Desktop\Maven\maven`) — confirmed safe to delete, still sitting there until the user does so.
