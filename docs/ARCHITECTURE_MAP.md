# Architecture Map (Task 01)

An inventory of every named public and Work Desk surface, classified as **Preserve** (works correctly, leave alone), **Improve** (real gap, worth a future task, not urgent/broken), **Duplicate/Confusing** (two things describe or do the same thing inconsistently), **Security-sensitive** (verified either safe or unsafe — flagged either way), or **Unverified** (couldn't be confirmed / the requested surface doesn't exist as asked). No redesign happened in this task — mapping only, per instructions.

**Method**: three parallel read-only research passes (public site + Website Admin dependencies; Work Desk full sidebar/screen inventory; UI-permission-to-DB-authorization cross-reference), then synthesized here. All claims below trace to file:line citations gathered in those passes, plus `docs/PERMISSION_BASELINE.md` (regenerated fresh in Task 00, 278 checks / 0 mismatches, corroborated reproducible).

---

## Headline findings (read this part first)

1. **One real security-sensitive UI/DB mismatch, fail-safe but misleading.** The Edit Work modal and bulk-reassign checkbox show reassignment controls to a reviewer for their own reviewed Client Work item — but `guard_work_item_update()` (the DB trigger) explicitly denies a reviewer from reassigning/rescoping, admin-only. The database blocks it correctly (confirmed live in the baseline), so **no unauthorized write can actually succeed** — but the UI shows a control that will silently fail, and the code's own comments (`staff.js:1664-1669`, `3573-3576`) incorrectly assert this already matches DB behavior. A future dev reading those comments would be misled. **Classify: Security-sensitive (verified fail-safe) + Duplicate/Confusing (wrong comment) + Improve** — hide/disable the control for reviewers, or fix the comment, in a future task. This is the single most important finding in this map.
2. **The "3 capability chapter" image consolidation has not started.** Home and Services both still render one photo per service category (6 distinct images), not the 3 chapter-level compositions the new design standard calls for. This confirms Task 02+ has real, unstarted work to do — not already-done work to verify.
3. **Two task-list surface names don't exist as distinct Work Desk destinations**: "Projects" is a modal inside Firm Work, not its own nav route; "Notifications" is a topbar bell dropdown, not a routed sidebar page. Both are real features — just not separate surfaces the way the task prompt implied. Flagged as Unverified/clarify rather than silently mapped onto something they aren't.
4. **Attendance is a model example of correct UI/DB alignment and non-surveillance design** — every admin-only UI gate has a matching RLS policy or role-checked RPC, no location/IP/device/scoring fields exist anywhere, and even admin cannot delete a correction audit row (append-only, DB-enforced). Worth pointing to as the pattern to replicate elsewhere, not something needing fixes.
5. **One real CMS gap**: the Resources page's content (`resourcesHub` in `content/site.yaml`) has zero admin-panel editor — it can only be changed by hand-editing YAML directly, unlike every other page's content.
6. **Several Work Desk sidebar labels don't match the page's own heading** for the same feature (e.g. sidebar "Team Work" → page says "Team"; sidebar "Recent Updates" → page says "Since Last Seen"; sidebar "Operations Overview" → page says "Manager Dashboard"). Cosmetic, not a functional bug, but genuinely confusing for anyone cross-referencing a screenshot, a doc, or a support conversation against the live nav.

---

## Part A — Public site

### Layout shell, design tokens, header, footer
**Classify: Preserve.** `layout.js`'s landmark structure (skip-link → header → `#main` → footer), the desktop nav's split link/toggle pattern (Task 25's own fix), the mobile nav's `inert`-gated submenu accordion, and the footer's 4-column nav + brand/disclaimer layout are all intact and match `docs/DESIGN_SYSTEM.md`'s own claims verbatim (checked directly against `styles.css`'s `:root` token block — every value matches). No action needed.

### Motion system
**Classify: Improve (minor, not broken).** The reveal system (`opacity`/`translateY(12px)`, 420ms, `cubic-bezier(0.22,1,0.36,1)`) exactly matches the new Motion Governance standard's easing curve and reveal-timing band, with a correctly fail-open reduced-motion path. Two real gaps against the *new* standard (not bugs in the old code — the old code predates this exact standard): **no child-stagger logic exists anywhere** (zero `stagger`/delay-offset code found; every `.reveal` element fires independently), and a handful of micro-interactions (accordion panel `max-height` 300ms, doc-card tab 300ms) run slightly above the 160-240ms micro-interaction band. Neither is urgent — flag for the Public UI/UX phase (02-09), not a defect to hotfix.

### Home (`pages1.js home()`)
**Classify: Improve (image architecture) + Duplicate/Confusing (content overlap with About).**
- Still one photo per service category (6 images), not yet consolidated into the 3 capability-chapter compositions the new standard calls for — this is exactly what Task 02+ should do.
- Home and About render near-identical `aboutText`/`aboutFacts` "proof panel" content and an identical first-8-industries badge grid. Not broken, but repetitive — a visitor clicking from Home to About sees the same facts twice in almost the same layout. Worth tightening later, not urgent.
- No inbound hash-fragment anchors target Home — nothing to preserve there.

### Services (`pages2.js services()`)
**Classify: Improve (image architecture), otherwise Preserve.** Same one-photo-per-category pattern as Home (not yet consolidated). **Real anchors that MUST be preserved in any restructure**: `services.html#registration`, `#tax`, `#payroll`, `#reporting`, `#advisory` (from nav dropdown children and footer links) — all currently satisfied by `id="${cat.key}"` on each service `<article>`. `#bookkeeping` and `#nfrs-ifrs` category ids exist but have no inbound links today (fine, not broken, just currently unused).

### Industries (`pages3.js industries()`)
**Classify: Preserve.** Icon-based cards, no photos, click-to-expand detail stage, `#industry-N` deep-link handling confirmed working (client.js parses the hash on load and auto-selects the matching panel). No changes needed.

### NFRS/IFRS (`pages7.js nfrsIfrs()`)
**Classify: Preserve.** Already uses a single, restrained hero image (shared with the Reporting category, per an explicit documented fallback) rather than photo-per-section — this happens to already match the new standard's "Advise & Report Better: typography-led technical authority, restrained imagery" treatment, ahead of the rest of the site. Worth noting as the precedent to follow when Task 02+ builds the other two chapters.

### International hub + International Accounting + Virtual CFO
**Classify: Preserve.** Confirmed (again, consistent with the earlier Task 28 finding) that these remain a genuinely distinct story from the Nepal-market service pages, not blended in — matches the standing rule. Minor, low-priority note: all three end with near-identical "Book a Free Discovery Call" CTA phrasing — reads as intentional cross-page consistency (each has its own distinct subtitle text from a separate YAML field), not accidental duplication; no action needed.

### About (`pages1.js about()`)
**Classify: Duplicate/Confusing (see Home), otherwise Preserve.** Structure itself is sound; the overlap is with Home, not an internal problem.

### Team (`pages6.js team()`)
**Classify: Preserve.** Matches the existing Task 28 findings (real photo alt-text or correctly `aria-hidden` initials fallback, one real member, correct "profiles being prepared" fallback state for zero members).

### Resources (`pages7.js resources()`)
**Classify: Improve (real CMS gap).** Page itself works correctly and is YAML-driven (not hardcoded), but `content.resourcesHub` has **zero corresponding admin.js editor** — no `sec-resources` section exists anywhere in the 1,684-line admin panel. This is the one page whose content can only be changed by a developer hand-editing `content/site.yaml`, unlike every other page. Matches the standing "CMS editability must survive" concern directly — this predates any task, not introduced by one, but is worth a small future fix (add a `resourcesHub` editor section following the existing pattern).

### Useful Links, Contact
**Classify: Preserve.** Both fully admin-editable, both already hardened in earlier tasks (Contact's form validation/focus/`aria-invalid`/Formspree-interception all previously fixed and tested; Useful Links has its own third-party-disclaimer note and admin editor).

### Website Admin (`admin/admin.js` + `admin/index.html`) dependency map
**Classify: Preserve, with the one Resources gap noted above (Improve).** Cross-checked all 27 top-level `content/site.yaml` keys against admin.js's `sec-*` editors — 26 of 27 have a working editor; `resourcesHub` is the sole gap (see above). Validation/conflict-handling/messaging hardening from Task 30 is untouched and confirmed intact.

---

## Part B — Work Desk

### Authentication & app shell
**Classify: Preserve.** Login → `is_active` check → profile load → sidebar/route render, with a try/catch fallback error card on failure. No self-signup, admin-invite-only, matches the intended model.

### Routing
**Classify: Preserve.** Clean hash-based routing (`routeFromHash`), a fixed known-view allowlist with unknown hashes falling back to `today` rather than erroring.

### The sidebar itself — 6 groups: Workspace, Client Delivery, Team, Personal, Insights, Administration
**Classify: Duplicate/Confusing (naming only, not a functional bug).** Real, current items and their labels are documented in full in the research pass; several **sidebar labels don't match their own page's `<h1>`** for the same feature:

| Sidebar label | Page's own heading | 
|---|---|
| Team Work | "Team" |
| Recent Updates | "Since Last Seen" |
| Operations Overview | "Manager Dashboard" |
| My To-Do | "My To-Do List" |

Also: the reviewer/admin-only "Client Work" nav item (the all-clients-firm-wide list, `state.view='all-work'`) shares its exact label with "Client Work" the **product-boundary concept** (as opposed to Firm Work) — a real naming collision, since My Tasks and Team Work also contain "Client Work"-scoped items without being that specific nav item. None of this affects security or data correctness — pure copy/labeling, safe to fix later as a small, low-risk task (align page `<h1>` text to nav labels, or vice versa).

### Dashboard (`today`)
**Classify: Preserve.** Personal landing page, Client-Work-scoped by design, "Needs Your Attention" list correctly deduped by severity (overdue → waiting → changes-required).

### My Tasks (`my-work`)
**Classify: Preserve.** The one view that correctly spans both Client and Firm Work for "what's assigned to me," with an explicit All/Client/Firm scope toggle — matches the product boundary's intent that a person's own work list shouldn't force them to check two separate screens.

### Client Work / "All Work" (`all-work`)
**Classify: Preserve** functionally; naming issue noted above under "the sidebar itself."

### Review Queue (`review`)
**Classify: Preserve.** Reviewer sees own-assigned-as-reviewer items, admin sees all — matches DB (`work_items` RLS).

### Deadlines
**Classify: Improve (low urgency).** Works correctly today, but its "overdue/due-soon" bucketing logic is independently reimplemented (not shared) across Deadlines, Period Summary, Operations Overview, Reports, and Dashboard's "Needs Your Attention" — only the low-level primitives (`isOverdue()`/`effectiveDue()`/`compareByDue()`) are actually shared. No evidence of current inconsistency between these five views, but the duplication is a real drift risk if one is ever edited without the others. Worth a shared-helper extraction in a future Work Desk task — not urgent, not a live bug.

### Clients
**Classify: Preserve.** Admin-gated writes match `clients_update_admin` RLS exactly.

### Firm Work
**Classify: Preserve.**

### "Projects"
**Classify: Unverified — the task's assumed surface doesn't exist as asked.** There is no standalone "Projects" nav item or route. "Manage Projects" is a button/modal reachable from inside the Firm Work page. If a dedicated Projects screen is wanted, that's new work, not something to "map" as already existing.

### Team Work (`team`)
**Classify: Preserve** functionally (open to every active teammate, explicitly framed in-code as "not a leaderboard," RLS-scoped not app-logic-scoped); naming issue noted above.

### Global Search (`search`)
**Classify: Preserve.** Confirmed to search both Client and Firm Work (placeholder copy says so explicitly); URL-query-string filter state, not hash-based, so it's shareable/reloadable.

### "Notifications"
**Classify: Unverified — the task's assumed surface doesn't exist as asked.** Not a routed sidebar page; it's the topbar bell dropdown (`#notifBellBtn`/`#notifPanel`). Real feature, just not the kind of surface this map's other rows are (a full-page destination).

### Recent Updates (`since-last-seen`)
**Classify: Preserve** functionally (Firm-Work-only catch-up feed, explicit-mark-reviewed model, not presence-tracking); naming issue noted above.

### Attendance
**Classify: Preserve — and a positive model to replicate.** See headline finding #4. Every admin-only UI gate (see-all-staff, corrections, CSV export, team summary) has a matching, verified-live RLS policy or role-checked RPC. Data captured is exactly `work_date`/`punched_in_at`/`punched_out_at` — no location/IP/device/presence field exists anywhere in the code (confirmed by direct grep, not just documentation claims). Corrections are audit-logged and append-only even for admin (no UPDATE/DELETE policy exists on the corrections table). `docs/ATTENDANCE_OPERATIONS.md`'s claims were cross-checked against the actual code and match exactly.

### Staff Directory (`directory`)
**Classify: Security-sensitive (verified intentional, not a gap).** Every active staff member's name, role/designation, work email, phone, and join date is visible to every authenticated teammate, by an explicit, commented, intentional design decision in the `profiles_read_authenticated` RLS policy (needed for assignee/reviewer pickers elsewhere in the app). Not a flaw — flagged only so the owner is aware this is a deliberate scope, not an oversight, should it ever come up in a security review.

### My Profile (`profile`)
**Classify: Preserve.** Self-edit limited to phone/photo only, enforced twice (UI disables other fields, and the `update_my_profile()` RPC only ever writes those two columns server-side regardless of what a client sends).

### My To-Do (`todo`)
**Classify: Preserve.** Correctly private, `user_id`-filtered, explicitly labeled as such in the UI copy.

### Operations Overview (`manager`)
**Classify: Preserve.** Explicitly framed in-code as workload balancing, not a leaderboard (alphabetical order, no derived productivity metric) — matches the standing no-surveillance/no-ranking rule.

### Reports
**Classify: Preserve.** Same explicit non-leaderboard framing as Operations Overview.

### Period Summary
**Classify: Preserve.** The one Insights-group item with no nav-level role gate, but correctly self-scoping via `loadWork(isReviewerOrAdmin() ? 'all' : 'mine')` — an employee only ever sees their own periods despite the page being reachable by everyone. Consistent, not a gap.

### Templates
**Classify: Preserve.** Admin-only writes match `service_templates`/`add_deadline_rule` DB enforcement exactly (reviewer explicitly denied on deadline rules too, not just employees).

### Staff & Access
**Classify: Preserve — and security-sensitive (verified safe).** Role/activation changes are admin-only both in the UI and at the DB (`profiles_update_admin`); self-escalation to admin is denied at the DB level even for an admin acting on their own row (per the earlier permission-baseline work this session).

### Settings
**Classify: Preserve.** Admin-only workflow-threshold config, backed by admin-only `app_settings` upsert.

### client_credentials / Supabase Vault
**Classify: Preserve — security-sensitive (re-verified, unchanged).** Still Vault-based, still fail-closed (raises a clear configuration error rather than falling back to a weak default), still zero direct RLS on the table itself (all access forced through four reviewer/admin-gated SECURITY DEFINER RPCs). No migration since Task 10 touches this. Confirmed live in the baseline.

### Modal/shared-shell infrastructure (`openModal`/`closeModal`/`toast`)
**Classify: Preserve.** Focus-trap, `role="dialog"`/`aria-modal`, Escape-to-close, and return-focus-on-close are all present and working — this is the Task 26 accessibility fix, confirmed still intact by direct code read (not just doc claim).

---

## Part C — UI permission → DB authorization map (Work Desk)

33 distinct client-side `isAdmin()`/`isReviewerOrAdmin()`/inline-role gates were found and individually checked against `docs/PERMISSION_BASELINE.md` (278 checks / 0 mismatches, regenerated fresh this session) and, where the baseline didn't directly cover a case, the raw migration SQL.

**Result: 32 of 33 gates have confirmed, matching DB-level enforcement** (RLS policy or a role check inside a `SECURITY DEFINER` function) — Clients, Templates, Staff & Access, Settings, Attendance, client_credentials, and the Client Work status/override flow all check out exactly. The `security_definer_grants` catalog-inspection matrix (22 rows) also shows 0 mismatches — no privileged function grants `EXECUTE` to `anon`.

**The 1 exception is headline finding #1 above**: reviewer-facing reassignment controls on a Client Work item (bulk-select eligibility and the Edit Work modal's `canReassign`) are shown to a reviewer for their own reviewed item, but `guard_work_item_update()` denies that exact action, admin-only. Fails safe — no unauthorized write can succeed — but the UI/code-comment claim that this matches DB behavior is incorrect, and showing a control that silently fails is a real (if minor) UX defect worth fixing in a future task.

---

## Checks run for this task

Since this was a pure inspection/mapping task with zero source changes, no new test run was required beyond Task 00's very recent, still-valid results (same session, same branch, no code touched since): `npm run test:syntax` 92/92, `npm test` 46/46, `npm run build` clean, `npm run test:ui` 307/307, DB/RLS harness 278 checks/0 mismatches (regenerated fresh, reproducible). `git status` re-confirmed clean except the same pre-existing timestamp-only `docs/PERMISSION_BASELINE.md`/`permission_baseline.json` diff from Task 00 (left uncommitted, unchanged).
