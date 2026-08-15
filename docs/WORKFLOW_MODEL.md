# Workflow Model (Maven Work Desk)

**Current, authoritative.** What each `work_items.status` value means,
for Client Work and Firm Work separately — they are different enums
sharing one column, enforced by
`work_items_status_scope_check` (`supabase/migrations/
20260816090000_firm_work_data_model.sql`). A client-scope row can only
ever hold a client-scope status, and vice versa; the database rejects
the other set entirely, not just the UI.

## Client Work statuses (`work_scope = 'client'`)

Eight values, roughly linear with two review-cycle branches:

| Status | Meaning |
|---|---|
| `to_do` | Created, not yet started. The only status a new item can be created with. |
| `in_progress` | Actively being worked by the assignee. |
| `waiting_for_client` | Blocked on the client providing something (documents, confirmation). See "Waiting-for-client sub-workflow" below — this status and the `work_waiting_items` checklist work together. |
| `ready_for_review` | Assignee has finished their part and handed it to the reviewer. Requires a `reviewer_id` to be set; the database rejects the transition otherwise. Read visibility here is the same as every other status as of Handbook Task 5 — assignee, assigned reviewer, and admin only; see [SECURITY_MODEL.md](SECURITY_MODEL.md) and [ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md). |
| `changes_required` | Reviewer sent it back. Returns to the assignee, who is expected to move it back through `in_progress` → `ready_for_review` again. |
| `approved` | Reviewer signed off on the work itself. Does not yet mean it's been filed/submitted anywhere — see submission sub-workflow below. |
| `ready_to_submit` | Approved and ready for the actual filing/submission step. This is the status that unlocks recording submission fields (see below). |
| `completed` | Done. Terminal state. |

Setting `approved` / `changes_required` / `ready_to_submit` /
`completed` requires reviewer or admin — a plain employee (even the
assignee) cannot self-approve their own work. This is enforced by
`guard_work_item_update()`, independently of RLS.

### Valid transitions (Handbook Task 8)

Before Task 8, no valid-transition model existed at all — any role
permitted to set a given status could set it from *any* current status,
including obvious skips like `to_do` straight to `completed`. As of
`supabase/migrations/20260820090000_client_work_transitions_and_gates.sql`,
`guard_work_item_update()` enforces this map (in addition to the
role checks above — a transition still has to be both permitted for the
caller's role AND valid for the item's current status):

| From | Normally allowed to |
|---|---|
| `to_do` | `in_progress`, `waiting_for_client` |
| `in_progress` | `waiting_for_client`, `ready_for_review`; `ready_to_submit` or `completed` directly, only if the template has `requires_review = false` (see below) |
| `waiting_for_client` | `in_progress` |
| `ready_for_review` | `changes_required`, `approved`, `waiting_for_client` |
| `changes_required` | `in_progress`, `waiting_for_client` |
| `approved` | `ready_to_submit` (if `submission_required`) or `completed` (if not), `waiting_for_client` |
| `ready_to_submit` | `completed`, `waiting_for_client` |
| `completed` | *(nothing — reopening is admin-override only, see below)* |

Anything not listed above is rejected outright, unless an admin supplies
an explicit override reason (see "Admin override" below).

### Required-checklist gates (Handbook Task 8)

`work_checklist_items.is_required` was, before this task, purely a
display label ("(Optional)" vs. not) — it never blocked anything. It is
now a real operational control, checked at the moment of the relevant
transition:

- **`→ ready_for_review`**: every `is_required = true` item with
  `stage = 'preparation'` must have `is_done = true`.
- **`→ approved`**: every `is_required = true` item with `stage =
  'review'` must have `is_done = true`.
- **`→ completed`, when `submission_required`**: `submission_status`
  must already be `submitted` or `acknowledged`, AND every
  `is_required = true` item with `stage = 'submission'` must have
  `is_done = true`.

A service that doesn't need a given stage simply has no `is_required`
items in it — the gate is then vacuously satisfied, never a false
blocker. `service_templates.requires_review` (new, mirrors the existing
`requires_submission`, defaults `true`) and the matching
`work_items.review_required` (copied from the template at creation,
including by the recurring-generation function) control whether the
review stage applies to a given service at all — a template with
`requires_review = false` allows `in_progress` to skip straight to
`ready_to_submit`/`completed`, per the transition table above.

### Admin override (Handbook Task 8)

An admin who genuinely needs an exception (an out-of-band correction, a
client relationship ending mid-period, etc.) can supply
`status_override_reason` in the SAME update as the status change. If
non-empty, it bypasses both the transition map and the checklist gates
for that one change — but the reason is mandatory (empty/missing is
rejected the same as anyone else's invalid transition) and every use is
permanently recorded as a `status_override` entry in `work_activity`,
including the reason text and what was overridden. The column itself
never persists a value — `guard_work_item_update()` always resets it to
`NULL` after reading it, whether or not it was used. This is deliberately
not a blanket admin bypass: admin is bound by the same transition map
and checklist gates as everyone else by default, and only escapes them
by leaving an accountable, permanent record of why. See
`staff/staff.js`'s `openOverrideStatusModal()` for the UI (admin-only;
appears automatically when a normal status change is rejected).

### Submission sub-workflow

Separate from `status`: `submission_required` (boolean, set per
template), `submission_status` (`not_ready` / `ready_to_submit` /
`submitted` / `acknowledged`), `submission_reference`,
`submission_note`, `submitted_at`, `submitted_by`. Intended rule:
submission fields can only be recorded once the work item's own
`status` is already `ready_to_submit` or `completed` — recording a
submission on anything earlier would mean claiming something was filed
before it was actually approved.

**Fixed, Handbook Task 6:** this rule is now a universal check (outside
the role dispatch entirely), so it applies to every role including
admin and a matching reviewer, not just a plain employee. As of
Handbook Task 8, completion additionally requires the relevant
`stage = 'submission'` required checklist items to be checked too — see
"Required-checklist gates" below.

### Waiting-for-client sub-workflow

`work_waiting_items` is a per-item checklist of specific things being
waited on (e.g. "Bank statement — Shrawan"), independent of but
typically used alongside `status = 'waiting_for_client'`. Each item has
its own `is_received` flag, `requested_date`, `follow_up_date`, and
follow-up count — the parent item's `waiting_since` date is the overall
"how long has this been stuck" signal used by the Today dashboard and
Reports.

## Firm Work statuses (`work_scope = 'firm'`)

Five values — deliberately its own set, not a subset or reuse of
Client Work's, and specifically **not** using the string
`'ready_for_review'` (see the design note in
`20260816090000_firm_work_data_model.sql`: reusing that string would
have pulled Firm Work into the reviewer-required trigger check and the
narrow-visibility RLS branch, both Client-Work-specific rules Firm Work
must not inherit):

| Status | Meaning |
|---|---|
| `to_do` | Created, not yet started. |
| `in_progress` | Being worked on. |
| `blocked` | Stuck on something (Firm Work's equivalent of "waiting," but with no client and no structured waiting-items checklist — just a status and, if needed, a comment explaining why). |
| `review` | Optional self-serve "someone should look at this before it's done" signal. **Not** a reviewer-approval gate — any peer can move a Firm Work item into or out of `review`, same as any other status change (see PRODUCT_BOUNDARIES.md, "no Decision-Needed/owner-approval queue"). Distinct from Client Work's `ready_for_review` in both name and meaning. |
| `completed` | Done. Terminal state. |

Firm Work has no submission sub-workflow, no waiting-for-client
sub-workflow, no reviewer field, no period, and no filing deadline — the
database enforces all of this directly
(`work_items_scope_fields_check`): every one of those columns must be
`NULL`/`false`/`'not_ready'` on a firm-scope row.

## What determines which status set applies

`work_items.work_scope` (`'client'` | `'firm'`) — set once at creation,
matching the boundary in PRODUCT_BOUNDARIES.md. There is no supported
path for converting an existing item from one scope to the other through
the app; as of Handbook Task 6, a direct database attempt to do so is
rejected by an explicit, universal immutability check (`work_scope
cannot be changed after creation`), for every role including admin — see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("work_items (client
scope)", "convert Client Work to Firm Work directly").
