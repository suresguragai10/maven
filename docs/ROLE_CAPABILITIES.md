# Role Capabilities (Maven Work Desk)

**Current, authoritative.** Answers "can role X do action Y on Client
Work vs. Firm Work" from one place. Where current database enforcement
doesn't yet match the rule stated here, that's called out explicitly
and cross-referenced to [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md)
— this document states the *intended* rule; the baseline document is
the live evidence of what's actually enforced today.

## The actual roles

The schema (`profiles.role`) supports exactly **three** roles:

```sql
role text not null default 'employee' check (role in ('employee', 'reviewer', 'admin'))
```

**There is no "Manager" role in the schema.** A few historical notes
(e.g. an early role-matrix comment in one migration) use "Admin/Manager"
as loose shorthand for the admin role's real-world job title — that is
not a fourth database role, and no future task should add a distinct
`manager` value without an explicit product decision and a migration.

Additionally: `is_active` (boolean) gates every role — a deactivated
profile loses all role-appropriate capability at the database layer
(`current_user_role()` returns `NULL` for an inactive profile), not just
in the UI. See SECURITY_MODEL.md for how that's enforced and its known
residual gaps.

## Client Work capabilities

| Action | Employee | Reviewer | Admin |
|---|---|---|---|
| Read a client-scope work item | Only if assignee | Only if the assigned reviewer on it | Any, always |
| Create a work item | Only assigned to self | Yes, any assignee | Yes, any assignee |
| Update own assigned item (status, dates, description) | Yes, within allowed status transitions (see WORKFLOW_MODEL.md) | N/A unless also assignee | Yes, any item |
| Reassign / change reviewer / change client / change service template | **No** | **No** — reviewing is not configuring | Yes |
| Change `work_scope` on an existing item | **No, nobody can** — immutable after creation, admin included | **No, nobody can** | **No, nobody can** |
| Set `approved` / `changes_required` / `ready_to_submit` / `completed` | **No** | Yes, on items they review, and only via a valid transition (see WORKFLOW_MODEL.md) | Yes, any item, and also only via a valid transition by default |
| Record submission fields (`submission_status`, `submitted_at`, etc.) | Only once the item is already `ready_to_submit`/`completed` | Same rule, no exception | Same rule, no exception |
| Override an invalid transition or an unmet required-checklist gate | **No** | **No** | **Yes, only** — requires a non-empty `status_override_reason` in the same update; permanently logged to `work_activity` as `status_override`. Not a silent bypass (see WORKFLOW_MODEL.md, "Admin override") |
| Edit checklist items | Only on own assigned item | Only on items they review | Any |
| Comment / view activity | Read/write only on own assigned item | Read/write only on items they review | Any |
| Toggle waiting-for-client items | Only on own assigned item | Only on items they review | Any |
| View / manage client credentials | **No** | Yes (deliberate — a reviewer often needs a client's portal login to actually perform a review; confirmed product decision, not an oversight) | Yes |

**Read visibility fixed, Handbook Task 5:** the table above now matches
actual enforcement. Previously, `work_items_read` (and its four child
tables) carried a blanket "any active user may read any item that
isn't currently `ready_for_review`" fallback — meaning an unrelated
employee could read a colleague's confidential client work simply
because of its status, not because of any real relationship to it. That
fallback is removed as of
`supabase/migrations/20260817090000_client_work_select_visibility.sql`;
read access is now exactly assignee / assigned-reviewer / admin, with
no status-based exception. Confirmed via the Task 3 harness, see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md), "work_items (client
scope)."

**Write authorization fixed, Handbook Task 6:** the table above now
matches actual enforcement. Previously `guard_work_item_update()`'s
reviewer branch was a blanket skip (identical in shape to admin's) once
a caller was the assigned reviewer — a reviewer could rescope, reassign,
change the client, or record submission fields on an item that was
never marked `ready_to_submit`. As of
`supabase/migrations/20260818090000_work_item_update_authorization.sql`,
the reviewer branch only permits what "review work and record review
decisions" actually means; reassignment/rescoping is admin-only, and the
submission-timing rule is now a universal check applying to every role,
admin included (a workflow-integrity rule, not a permission one — see
[SECURITY_MODEL.md](SECURITY_MODEL.md)). `work_scope` and
`id`/`created_at`/`created_by` are now immutable after creation for
every role too. Confirmed via the Task 3 harness, see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md).

**Valid-transition + checklist-gate enforcement added, Handbook Task 8:**
admin's status-setting power is no longer unconditional either — by
default, admin is bound by the same transition map and required-
checklist gates as everyone else (see WORKFLOW_MODEL.md). Admin's actual
extra power is narrower and more specific than before: the ability to
supply an explicit, mandatory, permanently-logged override reason to
bypass those gates for one specific exceptional change, not a blanket
ability to set any status at any time.

## Firm Work capabilities (peer model)

Per [PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md): **role does not
gate Firm Work capability.** Every active profile — employee, reviewer,
or admin — has the same Firm Work powers:

| Action | Any active teammate |
|---|---|
| Read any Firm Work item | Yes, always (not scoped to assignee) |
| Create Firm Work, assign to anyone active | Yes |
| Reassign / change status / change target date / edit checklist / post updates, on ANY Firm Work item (not just their own) | Yes — this is the intended rule |
| Delete a Firm Work item | Admin only (no product decision yet to open this to peers; matches Client Work's existing delete-is-admin-only convention) |
| Create/rename a project (`projects`), or archive/reactivate one (Handbook Task 15/19) | Yes — same open-collaboration model as Firm Work itself; no delete offered to anyone, archiving is the retirement path. Every edit auto-attributed via `updated_by`/`updated_at` (Task 19), never trusted from the client. |
| Set `project_id`/`next_action`/`blocker_reason` on a Firm Work item (Handbook Task 15) | Yes, via the same channel as any other field edit on that item (see the row above) |

**Enforcement gap closed, Handbook Task 6:** the database previously
restricted write access on someone else's Firm Work item to admin (or
the current assignee) — the known conflict between Firm Work Task 2's
shipped UI (admin-only reassignment) and this document's stated peer
rule. Fixed in the same migration as the Client Work reviewer fix above
(`20260818090000_work_item_update_authorization.sql`):
`guard_work_item_update()` now branches on `work_scope = 'firm'` before
any Client-Work-specific ownership check, so any active teammate — any
role — has full edit/reassign power on any Firm Work item, exactly as
this table states. An inactive profile is still blocked, both by RLS
and by an explicit check in the trigger itself. Confirmed in
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("work_items (firm
scope)").

**UI gap closed, Handbook Task 16 (2026-08-15):** the Firm Work modal
itself (`openFirmWorkModal` in `staff/staff.js`) still gated every field
— including the owner picker — to `isAdmin() || isMine`, contradicting
the database rule above and this document's own stated peer model ever
since Task 6 shipped it. Fixed: `canEdit`/`canEditFull` are now
unconditionally `true` for any signed-in user viewing the modal: no
field is disabled based on "not the owner." The "Only the owner or an
admin can edit this item" read-only notice is gone. The database is
still the real enforcement layer regardless (see the Task 6 paragraph
above) — this was purely a UI convention that had drifted out of sync
with it, now corrected.

**Two additional real gaps found while verifying Task 16, both closed:**
1. `work_checklist_items`'s `INSERT`/`UPDATE` policies still predated
   Firm Work entirely (last touched by `20260815090000`, a migration
   from before `work_scope` existed) and only allowed admin, the item's
   *current* assignee, or its reviewer to write — Task 5's visibility
   fix only ever added Firm Work's open-read branch, never a matching
   write branch. A teammate who wasn't the current assignee could see a
   Firm Work item's checklist but not add or check off an item on it,
   contradicting "manage its checklist." Fixed in
   `20260827090000_firm_work_peer_permissions.sql` by adding the same
   `work_scope = 'firm'` branch write already had on read.
2. Nothing previously stopped assigning Firm Work to a **deactivated**
   profile — the UI's owner picker only ever listed active profiles,
   which is a convenience, not a boundary. Fixed with a trigger-level
   check (a `CHECK` constraint can't query another table) in both
   `set_work_item_created_by()` (creation) and
   `guard_work_item_update()`'s firm branch (reassignment, only checked
   when `assignee_id` is actually changing — an already-assigned person
   who is deactivated *later* doesn't retroactively lock the item).

## Configuration / admin-only capabilities

These require `role = 'admin'`, full stop, on both Client and Firm Work
contexts:

- Create/edit clients, client contact details, active/inactive status.
- Create/edit service templates and their checklist definitions.
- Create/edit client service subscriptions (which client gets which
  recurring service).
- Change anyone's role or active/inactive status (Staff page).
- Workflow settings (stale-waiting thresholds, deadline-warning windows,
  etc. — `app_settings`).
- Delete a work item (Client or Firm scope).
- Run the manual "Generate Period Work" action (also reachable to
  `reviewer`, see recurring generation below).

## Reviewer-specific capabilities (Client Work only — Firm Work has no reviewer concept)

- Everything an employee can do on their own assigned work, plus:
- Record review decisions (approve / request changes) on items where
  they are the assigned reviewer.
- View and manage client credentials (see table above).
- Trigger recurring work generation (`generate_period_work_for_period`
  — admin and reviewer both, by design; a plain employee cannot).
- Set client attention flags (`set_client_attention` — admin and
  reviewer both, by design, confirmed during the V2 Permission Audit:
  "reviewers often need to flag a client's status while working with
  them").

Firm Work has **no reviewer concept at all** — there is no
review/approval step in the Firm Work lifecycle (see
[WORKFLOW_MODEL.md](WORKFLOW_MODEL.md)), so "reviewer capabilities" only
ever apply to Client Work.

## Anonymous / unauthenticated

No capability, by design, on either Client or Firm Work — every table
either has no read/write policy for an unauthenticated caller, or (for
`client_credentials`) has no RLS policy allowing direct table access at
all. **Fixed, Handbook Task 9:** six `SECURITY DEFINER` RPC functions
(`add_client_credential`, `list_client_credentials`,
`reveal_client_credential`, `delete_client_credential`,
`generate_period_work_for_period`, `set_client_attention`) previously
had no committed grant restriction and were reachable by an anonymous
caller (and independently, by a deactivated profile's still-valid
session) due to a NULL-role authorization bug. Both the grant and the
underlying logic bug are now fixed as committed migrations — see
[SECURITY_MODEL.md](SECURITY_MODEL.md) ("Fixed bug class") and
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md), which shows zero
outstanding findings as of Task 9.
