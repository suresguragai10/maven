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
| Read a client-scope work item | Own (assignee/reviewer), or any item not currently `ready_for_review` | Same as employee | Any, always |
| Read a `ready_for_review` item | Only if assignee or reviewer on it | Only if assignee or reviewer on it | Any |
| Create a work item | Only assigned to self | Yes, any assignee | Yes, any assignee |
| Update own assigned item (status, dates, description) | Yes, within allowed status transitions (see WORKFLOW_MODEL.md) | N/A unless also assignee | Yes, any item |
| Reassign / change reviewer / change client / change service template | **No** | **No** — reviewing is not configuring; see note below | Yes |
| Set `approved` / `changes_required` / `ready_to_submit` / `completed` | **No** | Yes, on items they review | Yes, any item |
| Record submission fields (`submission_status`, `submitted_at`, etc.) | Only once the item is already `ready_to_submit`/`completed` | Same rule — see note below | Same rule — see note below |
| Edit checklist items | Only on own assigned item | Only on items they review | Any |
| Comment / view activity | Broad read (see above); write requires admin/assignee/reviewer | Same | Any |
| Toggle waiting-for-client items | Only on own assigned item | Only on items they review | Any |
| View / manage client credentials | **No** | Yes (deliberate — a reviewer often needs a client's portal login to actually perform a review; confirmed product decision, not an oversight) | Yes |

**Note on reviewer scope, intended vs. current:** the intended rule is
"Reviewer = review work and record review decisions; Admin = configure
clients/services/assignment." **Current database enforcement is
broader than this** — a reviewer can currently rescope, reassign, or
move a work item to a different client on anything they review, and can
also record submission fields on an item that was never marked
`ready_to_submit`. Both are confirmed, tracked gaps (see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md), "work_items (client
scope)" and "submission fields/actions"), not the intended design —
listed here so this table isn't read as silently endorsing them.

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

**Current enforcement gap:** the database currently restricts write
access on someone else's Firm Work item to admin (or the current
assignee) — a non-assignee peer cannot yet touch any field on it, not
just reassignment. Confirmed in
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("work_items (firm
scope)"). This is the known conflict between Firm Work Task 2's shipped
UI (admin-only reassignment) and this document's stated peer rule —
scoped to a dedicated fix task in the implementation sequence.

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
all. **Known, tracked exception:** several `SECURITY DEFINER` RPC
functions (`add_client_credential`, `list_client_credentials`,
`reveal_client_credential`, `delete_client_credential`,
`generate_period_work_for_period`) currently have no committed grant
restriction and are reachable by an anonymous caller due to a NULL-role
authorization bug — this is a live, serious finding, not an intended
capability. See
[maven_critical_finding_anon_execute_bypass] cross-referenced in
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("client_credentials",
"recurring generation functions") for the full detail and current
mitigation status.
