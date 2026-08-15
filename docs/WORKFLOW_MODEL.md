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

### Submission sub-workflow

Separate from `status`: `submission_required` (boolean, set per
template), `submission_status` (`not_ready` / `ready_to_submit` /
`submitted` / `acknowledged`), `submission_reference`,
`submission_note`, `submitted_at`, `submitted_by`. Intended rule:
submission fields can only be recorded once the work item's own
`status` is already `ready_to_submit` or `completed` — recording a
submission on anything earlier would mean claiming something was filed
before it was actually approved.

**Current enforcement gap:** this rule is only enforced against a plain
employee. Admin and a matching reviewer can currently record submission
fields on an item at any status, bypassing the "only once ready"
guard entirely — same root cause as the reviewer-rescope gap in
ROLE_CAPABILITIES.md (both live inside the same
`guard_work_item_update()` branch that admin/reviewer skip). Confirmed
in [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("submission
fields/actions").

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
the app; a direct database attempt to do so is blocked as a side effect
of the "only reviewer/admin can rescope" guard (changing `client_id` is
itself a guarded change) — see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("work_items (client
scope)", "convert Client Work to Firm Work directly").
