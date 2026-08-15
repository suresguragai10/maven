# Product Boundaries (Maven Work Desk)

**Current, authoritative.** This document states the owner-approved product
rules for Maven Work Desk (`/staff`) — what Client Work and Firm Work
each are, what must never cross between them, and the standing
product-scope decisions that govern every future task. It exists so a
future session can answer "is this in scope, and does it touch Client
Work compliance data" without re-deriving the answer from migration
comments or old chat-pasted checklists. It restates, in one place,
decisions made across the V2, Firm Work, and Handbook phases of this
project — it does not introduce new rules of its own.

Companion documents: [ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md) (who
can do what), [WORKFLOW_MODEL.md](WORKFLOW_MODEL.md) (what each status
means), [SECURITY_MODEL.md](SECURITY_MODEL.md) (how it's enforced).

## Client Work vs. Firm Work

**Client Work is real client/compliance delivery.** Tax filings,
bookkeeping, registrations, payroll runs, anything with a real client, a
real deadline, and real regulatory or contractual consequence if missed.
`work_items.work_scope = 'client'`. Governed by the stricter
deadline/review/waiting/submission/reporting machinery this app was
originally built around — that machinery is not being diluted or
reinterpreted by anything Firm Work adds.

**Firm Work is internal Maven operations.** Office administration,
marketing, website/digital work, firm setup, research, business
development, and anything else that keeps the firm running but isn't
itself billable client delivery. `work_items.work_scope = 'firm'`,
`client_id` is always `NULL`. Categories (fixed set, enforced by DB
check constraint): Business Development, Marketing, Website / Digital,
Administration, Firm Setup, Research, Other.

**Firm Work must never affect client compliance counters, reports, or
deadlines.** No Firm Work row ever has a `client_id`, a
`service_template_id`, a `period`, a `filing`/`external_due_date`,
waiting-for-client fields, or submission fields — the database enforces
this directly (`work_items_scope_fields_check`), not just the UI. Any
report, dashboard, or count that describes client compliance status
(overdue filings, waiting-for-client, submission status, the Reports
page) must only ever read `work_scope = 'client'` rows. This is a hard
boundary, not a style preference.

## Firm Work: peer model

All active teammates are peers on Firm Work, regardless of their
Client-Work role (employee/reviewer/admin) — there is no separate "Firm
Work role." Any active teammate may:

- create Firm Work and assign it to anyone else active;
- edit it — reassign it, change its status, change its target date,
  add/edit checklist items, post progress updates;
- do all of the above whether or not they are the current assignee.

There is **no reviewer-approval gate and no admin-only step** in the
Firm Work lifecycle. This is a deliberate departure from Client Work's
review-gated model — Firm Work is internal, low-stakes-per-item, and
async coordination, not compliance delivery.

**Database enforcement fixed, Handbook Task 6:** any active teammate
now has full edit/reassign power on any Firm Work item at the database
layer — see [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("work_items
(firm scope)") for confirmed evidence. **The Staff app UI has not been
updated to match** — `openFirmWorkModal()` in `staff/staff.js` still
disables every field unless the caller is admin or the current
assignee, so a peer still can't actually use this via the app yet, only
via direct API. Updating the UI is a separate, still-open task.

## Business Development

Business Development (pipeline, prospects, referral follow-up) is
**ordinary Firm Work** — a `firm_category`, nothing more. No CRM, no
prospect/lead entity, no lead scoring, no sales-pipeline automation,
no automated outreach/paid messaging integration, no employee
conversion-rate rankings. If a prospect needs tracking, it's a Firm
Work item like any other, in the "Business Development" category — a
company/person name mentioned in a title or description stays plain
operational text, not a structured field. **Confirmed live (Handbook
Task 24)**: recommended patterns (a Project per campaign, a handful of
linked Firm Work items, outcomes recorded via a Result-tagged update or
the description — never a sales database) are documented in
[BUSINESS_DEVELOPMENT_PATTERNS.md](BUSINESS_DEVELOPMENT_PATTERNS.md).
A lightweight "Duplicate" button on the Firm Work Detail page
(pre-fills category/owner/priority/description/project/checklist from
an existing item) supports repeatable campaigns without a separate
templates system. If an outreach converts, the new client is always
created deliberately in the Clients module — nothing here ever
auto-converts a Firm Work item into a client.

## Project / Initiative grouping

**Approved** for Firm Work — a lightweight way to group related Firm
Work items under a named effort (e.g. "Office Search," "Website
Relaunch," "PWA," "Q3 Marketing Campaign"). Not yet built as of this
document. Explicitly **not** approved: Kanban boards, Gantt charts,
resource-planning/capacity views, or any other heavyweight
project-management surface. Grouping and a simple list is the ceiling
for V1.

## No Decision-Needed / owner-approval queue

Firm Work has no "pending owner approval" state and no separate
decision-needed workflow. The team is intentionally equal-position for
Firm Work (see peer model above) — adding an approval gate would
contradict that. If a business rule is genuinely ambiguous, the correct
move (per the Master Session Contract) is to implement the unambiguous
parts, isolate the ambiguous part, and ask — not to invent an approval
queue as a workaround.

## Personal To-Do

Stays separate and private — `personal_todos`, owned per-user, never
shared, never Firm Work. A private reminder is not team-visible internal
work; conflating the two was explicitly rejected during the Firm Work
design phase.

## PWA V1 scope

Install-first and online-first only. A user can install the app to
their home screen/desktop and use it like a native app while online.
**Not in V1**: offline editing, offline data mutation, background sync,
or blind caching of authenticated Supabase responses for offline
availability. A future PWA version may extend this; V1 does not attempt
it, and no task should build offline mutation without this document
being updated first.

## What this document does not cover

Who can perform which specific action on which specific field —
[ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md) is authoritative for that.
Status meanings and valid transitions —
[WORKFLOW_MODEL.md](WORKFLOW_MODEL.md). How any of this is actually
enforced at the database layer, and where enforcement currently falls
short of the rules stated here — [SECURITY_MODEL.md](SECURITY_MODEL.md)
and [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md).
