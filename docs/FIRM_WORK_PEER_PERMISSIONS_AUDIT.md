# Firm Work Peer-Edit Permissions Audit (Task 27)

**Audit only — no RLS, migration, or grant was touched to produce this
document**, per this task's own "do not silently change Firm Work RLS"
instruction. This re-examines the same permission first flagged as an
owner decision item in Task 21 (`docs/WORK_DESK_BASELINE_SECURITY_MAP.md`,
owner decision list item 4) and asks the question directly: does it still
fit how Maven actually operates.

## What the model actually is

Any active teammate — employee, reviewer, or admin, no role distinction —
has full read/write power over **any** Firm Work item: they can change its
status, reassign its owner, edit its checklist, edit its Next Action, mark
it Blocked, post updates, and move it into or out of any project. This is
true at both layers:

- **Database**: `work_items_update`/`work_checklist_items` RLS policies for
  `work_scope = 'firm'` require only `current_user_active()` — no
  ownership or role check at all. Confirmed still the case by
  `docs/PERMISSION_BASELINE.md`'s Firm Work peer-permissions area (11
  checks, 0 findings) and by this session's own Task 21 baseline read.
- **UI**: `staff/staff.js`'s Firm Work detail page shows the status
  control, Next Action field, and checklist as directly editable to
  whoever is looking at it — no `canEdit`-style gate the way Client Work's
  detail page has one for reviewer-only fields.

This is not an accident or an oversight. It is a deliberately chosen,
repeatedly reaffirmed product decision:

- First established in the Handbook-era Task 6 migration and Task 16 UI
  fix (which also closed two real gaps found during its own
  verification — a checklist write-policy gap and a missing
  deactivated-assignee check — both fixed *without* narrowing the peer
  model itself).
- Restated explicitly in `docs/PRODUCT_BOUNDARIES.md`: "any active
  teammate has full edit/reassign/checklist/status power on ANY Firm Work
  item."
- Re-flagged (not changed) in this session's own Task 21 baseline audit as
  the single broadest permission in the system, listed for periodic
  conscious review rather than because anything suggested it was wrong.

## Why it exists

Firm Work is explicitly *not* client compliance work — it's internal
operations (business development, marketing, admin, "everything else").
The product's own stated reasoning (`PRODUCT_BOUNDARIES.md`) is that
Client Work's reviewer/assignee boundaries exist because compliance
delivery has real external accountability; Firm Work has none of that, and
gating peer collaboration behind ownership or role would mean routine
internal coordination — "I saw this needs doing, I did it" — has to wait
on the original owner or an admin, for a five-person team where that
owner might be out sick or mid-task on something else.

## What actually bounds this permission today

"Anyone can edit anything" is true, but it is not the same as "anonymous"
or "unaccountable":

- Every status/reassignment/project/due-date change is logged
  automatically and unforgeably by `guard_work_item_update()` into
  `work_activity`, with `source = 'system'` — never a client-insertable
  row, confirmed in Task 7's audit-trail work and unchanged since.
- `projects`' own `updated_by`/`updated_at` are forced from the real
  caller by trigger (Task 19), spoofing rejected — confirmed by the local
  RLS harness.
- A deactivated teammate is blocked from touching Firm Work the instant
  `is_active = false`, DB-wide (Task 9), independent of this peer model —
  offboarding doesn't rely on this permission being narrow to be safe.
- The UI's Firm Work Detail page (`staff/staff.js`) surfaces "who did
  what, when" directly in the Activity History and Updates sections —
  Task 27 additionally moved a "Latest Update" preview into the top
  summary card so the most recent hand-off context is visible before
  anyone else touches the item, reducing the odds of two people stepping
  on each other's edit by simple lack of visibility rather than by an
  access restriction.

So the real question isn't "can this be abused with zero trace" — it
can't, everything is attributed and permanent — it's "should broad write
access require an explicit ownership/role check anyway, the way Client
Work's does."

## Assessment

For Maven's current operating model — a five-person team, Firm Work
explicitly scoped to internal ops with no external filing risk, and a
full unforgeable audit trail already in place — the peer model still
fits. The two real gaps that existed (checklist write policy,
deactivated-assignee assignment) were already found and closed in Task
16; nothing found in this pass, or in the Task 21 baseline audit before
it, points to a new gap. Narrowing it now (e.g. to "only the assignee or
an admin can edit") would add friction to exactly the kind of low-stakes,
fast internal coordination Firm Work exists to support, for a team small
enough that everyone already knows what everyone else is working on.

**Recommendation: keep the peer model as-is. No RLS change made.**

One forward-looking condition worth naming explicitly, for whoever revisits
this later: the model's own justification is team size and mutual
visibility. If Maven's headcount grows meaningfully past what fits in one
Team page glance (the product boundary docs never named a number, but this
audit will: comfortably true at 5, worth re-asking well before 20), or if
Firm Work ever grows a category with real external/financial consequence
(the same way Client Work has statutory deadlines), that's the trigger to
revisit this decision — not a fixed date, a fixed condition.

## What was NOT done in this task

No RLS policy, grant, or trigger was added, changed, or removed. This
document is the deliverable the task asked for; the permission itself is
unchanged.
