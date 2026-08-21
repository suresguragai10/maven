# Work Desk Baseline / Security Map (Task 21)

**Audit-only.** No schema, RLS, or application code was changed to produce this
document. Where this file states a fact about RLS/grants/triggers, it was
verified against the actual migration SQL in `supabase/migrations/`, not
against prose in another doc. Existing authoritative docs
(`SECURITY_MODEL.md`, `ROLE_CAPABILITIES.md`, `PRODUCT_BOUNDARIES.md`,
`WORKFLOW_MODEL.md`, `ATTENDANCE_OPERATIONS.md`, `DATABASE_SOURCE_OF_TRUTH.md`,
`PERMISSION_BASELINE.md`) remain the detailed reference for each area; this
document's job is to cross-check them against current code, close a real
documentation gap, and produce the owner decision list the task asked for.
Read this alongside them, not instead of them.

## 1. The two real gates, restated

Every meaningful authorization decision in the Work Desk ultimately reduces to
two `SECURITY DEFINER` functions: `current_user_role()` and
`current_user_active()`. Both return `NULL`/`false` the instant
`profiles.is_active = false`, independent of whether the JWT is otherwise
valid. UI-level role checks in `staff/staff.js` (disabled buttons, hidden
menu items, `is_active`-filtered dropdowns) are consistently present
throughout the file, but per the standing project rule, none of them are
themselves the authorization boundary — RLS policies, triggers, and RPC
`security definer` checks are. This audit confirms that rule is followed
correctly almost everywhere (see §7 for the one place it is only
UI-enforced).

## 2. Client Work

- Eight statuses, DB-enforced by `work_items_status_scope_check` to never mix
  with Firm Work's five. `guard_work_item_update()` enforces a specific
  from→to transition map (`WORKFLOW_MODEL.md`), independent of and in
  addition to RLS.
- Setting `approved` / `changes_required` / `ready_to_submit` / `completed`
  requires reviewer or admin — a plain employee, even the assignee, cannot
  self-approve. `ready_for_review` requires a `reviewer_id` to already be set
  or the transition is rejected outright.
- Required-checklist gates block `→ ready_for_review`, `→ approved`, and
  `→ completed` (when `submission_required`) until the relevant
  `is_required` items for that stage are done. A service with no required
  items in a stage is vacuously satisfied, never a false blocker.
- Submission fields (`submission_status`, `submission_reference`, etc.) can
  only be recorded once `status` is already `ready_to_submit`/`completed` —
  a universal check applying to every role, including admin and the assigned
  reviewer.
- Read visibility is narrow (assignee, assigned reviewer, admin only) as of
  Handbook Task 5 — confirmed still the current policy shape by
  `DATABASE_SOURCE_OF_TRUTH.md`'s later task narratives and unchanged by
  anything since.
- Admin override: `status_override_reason` bypasses the transition map and
  checklist gates for one change, but the reason is mandatory and every use
  is permanently logged to `work_activity` as a `status_override` entry; the
  column itself is always reset to `NULL` by the trigger regardless of
  outcome. Admin is bound by the same rules as everyone else by default and
  only escapes them by leaving an accountable record.
- `work_scope` (`'client'`/`'firm'`) is immutable after creation for every
  role including admin, enforced by an explicit trigger check — there is no
  supported or unsupported path to convert a Client Work item into a Firm
  Work item or vice versa.

## 3. Reviewer permissions

Confirmed via `ROLE_CAPABILITIES.md` and cross-checked against
`guard_work_item_update()`'s role dispatch: a reviewer can approve/reject/
move-to-submission on items where they are the assigned `reviewer_id`, and —
per the standing "reviewer rescope power" finding from the original Task 3
permission-baseline audit — can also reassign/rescope items outside their own
queue. That finding was resolved at the time as an intentional (if broad)
capability, not a bug, and nothing found in this pass changes that
conclusion. It is carried forward on the owner decision list (§8) simply
because the Work Desk has grown substantially since that original finding and
it deserves a fresh yes/no, not because new evidence suggests it should
change.

## 4. Firm Work peer permissions

- Five statuses, deliberately not reusing Client Work's strings (`review` is
  a self-serve flag, not an approval gate — any peer can set or clear it).
- No role gates Firm Work capability at all: any active teammate has full
  edit/reassign/checklist/status power on **any** Firm Work item. This is a
  repeatedly-reaffirmed, explicit product decision (`PRODUCT_BOUNDARIES.md`;
  fixed at the DB layer in Handbook Task 6, then in the UI in Task 16, which
  also closed two further gaps — a checklist write-policy gap and a
  deactivated-assignee assignment gap — found during that task's own
  verification).
- No submission/waiting-for-client/reviewer/period fields exist on
  Firm-scope rows at all; `work_items_scope_fields_check` enforces every one
  of them `NULL`/`false`/`'not_ready'`.

## 5. Projects (Firm Work grouping)

`public.projects` (Handbook Task 15, extended Task 19): `id`, `name`,
`description`, `status` (`active`/`archived`), `created_by`/`created_at`
(immutable after insert), `updated_by`/`updated_at` (auto-set from the real
caller by trigger, spoofing rejected). RLS:

```sql
create policy "projects_read"   on public.projects for select using (public.current_user_active());
create policy "projects_insert" on public.projects for insert with check (public.current_user_active());
create policy "projects_update" on public.projects for update using (public.current_user_active());
```

No DELETE policy exists — archiving is the only retirement path, and the
local RLS harness confirms even admin cannot hard-delete a project. Any
active user (not just admin) can create, rename, archive, or reactivate any
project — the same peer philosophy as Firm Work items themselves, extended to
the grouping construct. `work_items.project_id` is Firm-Work-only, enforced
by the same scope-fields check; archiving a project preserves `project_id` on
its linked work items rather than orphaning them.

## 6. Profile editing

Two genuinely separate, correctly-scoped paths — confirmed by direct code
read, not assumption:

- **Admin, any profile**: `staff.js`'s `openStaffProfileModal()` does a
  direct `profiles` table `UPDATE`, authorized by the `profiles_update_admin`
  RLS policy (admin role required) plus the `guard_profile_update()` trigger
  (blocks any role change unless the caller is already admin, defense in
  depth on top of RLS). The role-change dropdown and the activate/deactivate
  toggle are both UI-disabled when editing your own row (`disabled = isSelf`)
  — this is a **UI-only** guard; see §7 for why that matters for the
  deactivate case specifically.
- **Self, own profile only**: `renderProfilePage()` exposes exactly two
  editable fields, `phone` and `photo_url` (full_name/designation/work_email/
  join_date are shown read-only with an explicit "managed by an admin" hint).
  Saving calls `sb.rpc('update_my_profile', { p_phone, p_photo_url })`. The
  backing function (`20260902090000_attendance_and_staff_profiles.sql`) is
  `SECURITY DEFINER`, checks `current_user_active()` first (raises on
  inactive), scopes its `UPDATE` with `where id = auth.uid()` (cannot touch
  any other row regardless of caller role), and is granted only to
  `authenticated` (revoked from `public`/`anon`). Local RLS-harness checks
  confirm it cannot alter role/is_active/designation/work_email/join_date
  even if a caller tries to smuggle those fields in, and confirm it is
  denied outright for an inactive caller.

This is a correctly-designed, already-secure system. **The real finding here
is a documentation gap, not a security gap**: neither `SECURITY_MODEL.md` nor
`ROLE_CAPABILITIES.md` mentions `update_my_profile()` at all — both predate
the migration that introduced it. This document is the first to record it;
the two source docs should eventually be updated to reference it, but that is
a documentation task, not a permissions change, and out of scope for this
audit-only task.

**Open drift question (not resolved by this task, see §8 item 1):**
`DATABASE_SOURCE_OF_TRUTH.md` §3b records a one-time live-database snapshot
from 2026-08-14 finding a *broader* live policy,
`profiles_update_own_or_admin` (`auth.uid() = id OR current_user_role() =
'admin'` — full self-row UPDATE, not scoped to phone/photo_url), and a live
trigger named `prevent_self_role_escalation` rather than
`guard_profile_update`. That snapshot predates the `update_my_profile()` RPC
migration (which was written and shipped later, 2026-09-02) and was never
re-verified against live state since. It is genuinely unknown from this
repository alone whether that broader live policy still exists (making the
current self-service RPC path optional/redundant rather than the only path),
was already superseded when the RPC shipped, or needs an explicit migration
to reconcile repo and live state. This cannot be resolved by reading files —
it requires a live-schema check.

## 7. Admin controls

Admin-only actions confirmed via `staff.js`'s Staff-list table and modal:
role changes, activate/deactivate, and (via the modal) full profile edits.
Backed correctly by `profiles_update_admin` + `guard_profile_update()`.

One asymmetry worth naming precisely: the self-action UI guard
(`disabled = isSelf`) covers both the role dropdown and the
activate/deactivate toggle in the admin modal, but `profiles_update_admin`
itself has **no clause excluding an admin's own row** from a direct-table
deactivate. If an admin ever changed `is_active` on their own account
through means other than this specific modal (a different admin tool, a
future UI path, direct API access), the DB would allow it. This is not a
privilege-escalation risk — it can only ever make an admin's *own* access
narrower, never broader — but if the firm has few admin accounts it is an
operational lockout risk worth an explicit decision (see §8 item 4).

## 8. Inactive users / offboarding

`current_user_active()` blocks all business data DB-wide the instant
`is_active = false` (Handbook Task 9) — confirmed still the design by
`SECURITY_MODEL.md`'s offboarding procedure and by the current
`PERMISSION_BASELINE.md`/`permission_baseline.json` showing 0 findings across
278 checks (regenerated as part of this task, see §10). `staff.js` also
consistently filters every assignee/reviewer/client picker on `is_active` —
UI-level consistency layered correctly on top of the real DB block, not a
substitute for it.

## 9. Attendance

Read the RLS/RPC layer in full (`20260902090000_attendance_and_staff_profiles.sql`)
and cross-checked against `docs/ATTENDANCE_OPERATIONS.md` — **matches
exactly, no drift found**:

- `attendance_entries`/`attendance_corrections`: RLS `SELECT`-only, scoped to
  own row or admin (`current_user_active() and (user_id = auth.uid() or
  current_user_role() = 'admin')`). **No INSERT/UPDATE/DELETE policy exists
  on either table** — every write goes through one of three
  `SECURITY DEFINER` RPCs.
- `attendance_punch_in()`/`attendance_punch_out()`: active-gated, strictly
  self-scoped (`auth.uid()`), server-derives the Nepal business date, reject
  double-punch-in and punch-out-without-punch-in with clear errors. Granted
  only to `authenticated`.
- `attendance_admin_correct()`: requires active admin explicitly (not just
  any authenticated user), requires a ≥3-character `reason`, rejects
  punch-out earlier than punch-in, and writes a full old/new audit row to
  `attendance_corrections` (which itself has no UPDATE/DELETE policy —
  append-only, matching the doc's stated design). Also usable as the
  documented "add missing attendance" path.
- No GPS/IP/device/screenshot/presence/productivity column exists anywhere
  in either table — confirmed by direct schema read, matching the doc's
  explicit non-collection list and the local RLS harness's own "no
  surveillance-style columns" check.

## 10. Local checks run for this task

| Check | Result |
|---|---|
| `npm run build` | PASS — 21 pages + assets written, no errors |
| `npm test` (`node --test`) | PASS — 67/67 |
| `npm run test:syntax` | PASS — 93/93 files |
| `npm run test:db` (regenerates `PERMISSION_BASELINE.md`/`permission_baseline.json`) | run against the current 33 migrations; see the regenerated files for the authoritative up-to-date count and findings |

No UI/browser tests were run against authenticated Work Desk screens in this
task specifically (this was a read/audit task, not a feature change); the
existing `tests/ui/app/*.spec.js` suite (staff, team, projects, firm-work,
firm-work-detail, since-last-seen, business-development, admin, admin-cms)
was inspected for coverage (see §11) rather than re-run, since nothing in
those areas changed.

## 11. UI test coverage notes (for future reference, not a gap found this task)

- `staff.spec.js` only covers the pre-login shell — no authenticated-page
  coverage exists in this file (by design; the harness has no real Supabase
  session).
- `team.spec.js`, `projects.spec.js`, `firm-work.spec.js` each exercise real
  server-side query construction (asserting actual REST filter strings, not
  client-side filtering) for their respective areas, plus mobile-overflow
  checks and (in `team.spec.js`) an explicit full-page scan asserting no
  surveillance/productivity-scoring language ever appears in the rendered
  page — a good structural safeguard for the no-surveillance product rule.
- No TODO/skip/xfail markers found in any of the four files read for this
  task.

## 12. Still-open items carried forward from the 2026-08-14 live snapshot

`DATABASE_SOURCE_OF_TRUTH.md` §3 records a one-time comparison of the live
Supabase project against the migrations directory, dated 2026-08-14. Besides
the `profiles` self-update drift already detailed in §6, two further items
from that same snapshot remain unresolved and are not something this
audit-only task can close from the repository alone:

- **`clients` table missing a live INSERT/UPDATE policy** (§3a) — filed at
  the time as "urgent, unconfirmed impact." Nearly a week of active
  development has passed since; this needs a fresh live check to confirm
  whether it's real, already fixed live, or still open.
- **Three unknown-origin live objects**: an `activity_log` table, a
  `guard_task_update()` function, and an `rls_auto_enable()` function — none
  explained by any migration in this repository. Still unexplained.

Both are restated on the owner decision list below since they are exactly
the kind of "current code alone can't answer this" item Task 21 exists to
surface.

## OWNER DECISION LIST

Permissions and open items that are either intentionally broad by design or
factually unresolved from this repository alone — listed for the owner's
awareness and decision, **not** changed here per the task's explicit
instruction not to tighten or weaken RLS based on how something "looks."

1. **[Unresolved fact, highest priority] `profiles` self-update: does the
   live database still carry the broader `profiles_update_own_or_admin`
   policy found in the 2026-08-14 snapshot, in addition to or instead of the
   newer `update_my_profile()` RPC?** This needs a live-schema check, not a
   repo read, to answer. If the broader policy is still live, it makes the
   RPC's field-scoping (phone/photo_url only) bypassable by a direct
   `profiles` table update from any authenticated client, which would be a
   real gap — but this cannot be confirmed or denied from the code alone.
2. **`clients` table's live INSERT/UPDATE policy status** — flagged urgent
   in the same 2026-08-14 snapshot, never re-checked since.
3. **Three unexplained live-only DB objects** (`activity_log` table,
   `guard_task_update()`, `rls_auto_enable()`) — origin and purpose unknown,
   not reflected in any migration.
4. **Firm Work peer model** — any active teammate (any role) has full edit/
   reassign/status/checklist power over any Firm Work item, no ownership or
   role gate at all. Confirmed working exactly as designed and repeatedly
   reaffirmed (`PRODUCT_BOUNDARIES.md`); listed here only because it is the
   single broadest permission in the system and deserves a periodic
   conscious yes, not because anything suggests it's wrong.
5. **`profiles_read_authenticated`** grants every active authenticated user
   full-row read access to every other profile, including admin/reviewer
   accounts and all of their contact fields (phone, work email, photo,
   join date). Broad by necessity (people-pickers need names across the
   whole roster) but is an unscoped full-table read rather than a
   column-limited view — worth an explicit "yes, that's fine for a firm this
   size" rather than an assumed default.
6. **Projects RLS has no role gate** — any active user, not just admin, can
   create/rename/archive/reactivate any project. Consistent with the Firm
   Work peer philosophy, extended to the grouping construct itself; flagged
   for the same "confirm this is still wanted" reason as item 4.
7. **Reviewer rescope power** — a reviewer can reassign/rescope Client Work
   items outside their own assigned review queue, per the original Task 3
   permission-baseline audit's finding (resolved then as intentional, not a
   bug). Restated here for a fresh look now that the Work Desk has grown
   substantially since that finding.
8. **Admin self-deactivation has no DB-level guard** — only a UI-level
   `disabled = isSelf` guard exists on the deactivate toggle in the admin
   modal; `profiles_update_admin` itself permits an admin to deactivate their
   own row via any other path. Pure lockout risk (never a privilege
   escalation), worth a decision on whether a DB-level self-exclusion is
   wanted given how few admin accounts a firm this size is likely to run.

## What was NOT done in this task (by design)

No RLS policy, grant, trigger, or migration was added or changed. No UI
behavior was changed. Nothing on the owner decision list above was tightened
or loosened — per the task's explicit instruction, broad-but-intentional
permissions were catalogued, not touched. No commit, no push.
