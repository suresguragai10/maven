# Work Desk UI / Content / Accessibility / Code-Quality Audit — 2026-08

**Scope note before anything else:** the task brief for this audit pointed at
`docs/NEXT_STEPS_TRACKER.md` as required pre-reading ("Groups 1-3 already
resolved... don't re-report"). That file does not exist anywhere in this
repository or its git history (`git log --all -- "*NEXT_STEPS*"` returns
nothing, on `main` or `professional-update`), and no other doc contains the
specific items the brief described (profiles self-update RLS gap, clients
write policies, reviewer-reassignment UI gating, admin self-lockout guard,
Resources CMS editor, staff onboarding docs). Rather than guess at a document
that isn't there, this audit reads `docs/ARCHITECTURE_MAP.md`,
`docs/WORK_DESK_BASELINE_SECURITY_MAP.md`, and `docs/PRODUCT_BOUNDARIES.md`
for background, but — per the brief's own fallback instruction — verifies
every permission-adjacent claim against the *current* `staff/staff.js`
rather than trusting those docs' prose, since both are visibly stale in
places (e.g. `ARCHITECTURE_MAP.md`'s "headline finding #1" describes a
reviewer-reassignment UI/DB mismatch that the current code's own comment at
`staff.js:4260-4267` says has since been reconciled). This audit is UI/
content/a11y/code-quality/spot-check only, per the brief — it does not
re-litigate the DB permission model, which prior sessions already audited in
depth.

Read in full for this audit: `staff/staff.js` (8,123 lines), `staff/index.html`,
`docs/ARCHITECTURE_MAP.md`, `docs/WORK_DESK_BASELINE_SECURITY_MAP.md`,
`docs/PRODUCT_BOUNDARIES.md`.

---

## High priority (real bugs, worth fixing soon)

### H1. Silent partial failure when marking waiting items "received"
`staff.js:4109-4116`, `receivedBtn` click handler:

```js
receivedBtn.addEventListener('click', async function () {
  await sb.from('work_waiting_items').update({ is_received: true }).eq('work_item_id', work.id);
  var res = await sb.from('work_items').update({ status: 'in_progress', ... }).eq('id', work.id);
  if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
  toast('Marked as received — back in progress.');
  renderWorkDetail(id);
});
```

The first `await` (marking every waiting item `is_received: true`) has its
result discarded entirely — only the second call's `.error` gates the
success toast. If the first update fails partway (RLS edge case, network
blip, a stale row), the UI still reports success and the work item flips to
`in_progress`, but the individual waiting items silently stay unreceived —
the next time this page renders, the "all requirements received" banner and
the checklist will disagree with the status the user was just told is
correct. Contrast with `checklistRow`/`waitingItemRow`'s own checkbox
handlers a few dozen lines away (4348-4355, 4374-4384), which correctly
check `.error` and revert on failure.

**Fix:** check both results' `.error` (or replace the two calls with one
`SECURITY DEFINER` RPC that does both atomically), and don't show the
success toast unless both succeeded.

### H2. `openNewTemplateModal`'s create button has no double-submit guard
`staff.js:5893-5919`. `createBtn` never sets `.disabled` around its two
sequential inserts (`service_templates`, then `service_template_items`),
unlike every comparable create/save flow elsewhere in the same file:
`openNewWorkModal` (createBtn.disabled at 3695, reset at 3715),
`openFirmWorkModal` (saveBtn.disabled at 7065/7078/7084),
`openEditFirmWorkModal` (6940/6953), `openClientFormModal` (5361/5365), and
`openEditTemplateModal` — the edit counterpart of this exact modal — which
does disable (`saveBtn.disabled = true` at 6021). A fast double-click (or a
slow connection plus an impatient click) creates two duplicate templates,
each with its own copy of the checklist items. This is a real functional
gap, not just polish, because Templates directly drives recurring
compliance-work generation.

**Fix:** mirror the disable-before/re-enable-after-error pattern the sibling
modal already uses two hundred lines later in the same file.

---

## Medium priority (real issues, lower urgency)

### M1. `initials()` is defined twice — the first copy is dead, and its comment lies about live behavior
Two top-level definitions in the same IIFE scope: `staff.js:192-197` and
`staff.js:7177-7179`.

```js
// line 192 — used by avatar(), called throughout the file
function initials(name) {
  var parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); // "JO" for "John"
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
...
// line 7177 — silently overwrites the above via function-declaration hoisting
function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(function (x) { return x.charAt(0).toUpperCase(); }).join('') || '?'; // "J" for "John"
}
```

Because both are plain `function` declarations in the same scope, the
second one wins for *every* call site in the file, including `avatar()`
(line 200), which is defined and used long before line 7177. The first
definition's documented behavior (2-letter initials for a single-word name)
never actually runs — it's dead code with a comment describing behavior
that doesn't happen. Practical effect: a staff member with a one-word name
gets a 1-letter avatar instead of the 2-letter one the first function's own
inline comment implies is the design.

**Fix:** delete one of the two (decide which 1-word behavior is wanted) and
keep a single `initials()`.

### M2. Two functions have grown large enough to be hard to navigate
- `renderReportsPage` (`staff.js` ~2754-3203, ~450 lines, the largest single
  function in the file) contains the range-filter UI, the report-picker UI,
  *and* seven independent nested report-builder closures
  (`buildWaitingReport`, `buildReviewWaitReport`, `buildUpcomingReport`,
  `buildCompletedByMonthReport`, `buildCompletedByPeriodReport`,
  `buildByServiceReport`, `buildByStatusReport`) all in one scope.
- `openNewWorkModal` (`staff.js:3560-4259`, ~700 lines) builds the entire
  New Work form, template-driven prefill logic, and the create handler in
  one function.

Neither is broken — both work correctly and are internally well-commented —
but both mix multiple concerns in one closure, which makes them hard to
unit-test or modify safely in isolation. Not urgent; a good candidate for a
future refactor task, not a hotfix.

**Fix suggestion:** hoist each `buildXReport(items, range)` in
`renderReportsPage` to a top-level function taking its inputs as parameters
instead of closing over the outer scope.

### M3. Priority is a color-only indicator with a weak text alternative
`staff.js:2234-2235` (`workRow`), `2288` (`firmWorkRow`), `6375` (checklist
editor's duplicate-source preview) all render:

```js
var dot = el('span', 'priority-dot priority-dot-' + w.priority);
dot.title = w.priority.charAt(0).toUpperCase() + w.priority.slice(1) + ' priority';
```

`staff/index.html:168-171` styles this as an 8×8px colored circle only
(gray/blue/red for low/normal/high). The only text alternative is a `title`
attribute on a plain `<span>` — `title` is not a reliable accessible name
for assistive tech, provides nothing on touch devices (no hover), and gives
colorblind or low-vision sighted users nothing without hovering. Every
*other* status indicator in the app — the status badges (`STATUS_LABELS`)
and attention badges (`ATTENTION_LABELS`, `attentionBadge()` at 209-215) —
correctly pairs color with a visible text label. Priority is the one
exception to an otherwise-consistent pattern.

**Fix:** add a short visible glyph/letter (e.g. "H"/"N"/"L") next to the dot,
or at minimum an `aria-label` on the span.

### M4. Client activate/deactivate logic duplicated, and the two surfaces expose different actions for no stated reason
`staff.js:4701-4711` (`renderClients`, the list-card view) and
`staff.js:4827-4837` (`renderClientDetail`) contain byte-for-byte identical
"toggle `clients.is_active`" logic — the only difference is the final
`render()` vs. `renderClientDetail(id)` call. Beyond the duplication itself:
the list card's actions are Deadlines / Credentials / Deactivate, while the
detail page's actions are Edit / Credentials / Change Flag / Deactivate. An
admin browsing the client list has no way to edit a client or change its
attention flag without first clicking into the detail page — not
necessarily wrong, but it's an unexplained asymmetry between two views of
the same actions, the kind of thing worth a deliberate decision rather than
an accident of two people writing similar code at different times.

**Fix:** extract a shared `toggleClientActive(c, onDone)` helper; separately
decide whether Edit/Change Flag belong on the list card too.

### M5. One page's own action buttons are inconsistent with each other on loading state
Within `renderWorkDetail`'s Overview/Checklist/Comments panes:
`returnBtn` (4098), `receivedBtn` (4109 — also H1), `addWaitBtn` (4141),
`commentBtn` (4196), and `addItemBtn` (4228) never set `.disabled` during
their `await sb...` call. The same function's own `saveBtn` (4314),
`subSaveBtn` (4049), and the follow-up modal's `saveBtn` (4443) all do. The
comment/checklist "Add" buttons are also missing any duplicate-submit guard,
so a fast double-click can insert the same comment or checklist item twice.

**Fix:** apply the same disable/re-enable pattern already used by sibling
buttons a few hundred lines away in the same function.

### M6. One sidebar-label/page-heading mismatch survived two prior cleanup passes
`NAV_GROUPS.team`'s tab is labeled "Team Work" (`staff.js:1118`), but
`renderTeamPage`'s own `<h1>` reads "Team" (`staff.js:1809`). This is
exactly the class of bug Task 28 fixed for Firm Work's "Catch-Up" tab
(comment at 1106-1111 explains the fix) and Task 33 fixed for "Operations
Overview" (comment at 2460-2463) — this one instance appears to have been
missed by both passes.

**Fix:** one-line change, rename the tab label to "Team" to match (or
change the `<h1>`, whichever reads better in context).

### M7. Personal To-Do's delete button has no accessible name beyond a glyph
`staff.js:7145`: `delBtn.textContent = '×'; delBtn.title = 'Delete';` — no
`aria-label`. The button's accessible name defaults to its visible text
content ("×"), not the `title`, which is only a supplementary tooltip, not
a guaranteed accessible-name override when the element already has text.

**Fix:** `delBtn.setAttribute('aria-label', 'Delete')`.

---

## Low priority / polish opinions

- **L1.** `renderTodoPage`'s `<h1>` reads "My To-Do List" (`staff.js:7103`)
  vs. the sidebar tab's "My To-Do" (`staff.js:1135`) — same category as M6
  but trivial enough (one word) that it's arguably fine as-is; flagged only
  for completeness.
- **L2.** `genBtn` in the Generate Period Work modal (`staff.js:6151-6157`)
  sends `periodInput.value.trim()` straight to `generate_period_work_for_period`
  without a client-side empty-string check — the button's `disabled` state
  is driven only by "are there eligible services" (line 6140), not by
  whether the period label was filled in. Not a security issue (the RPC is
  the real boundary and will presumably reject or no-op), just a
  friendlier-error opportunity other forms in the same file (e.g. the
  Auto-Generate Periods card at 5519-5528) already take.
- **L3.** Button-copy conventions ("Create X" for new entities, "Save"/"Save
  Changes" for edits, "Add X" for list items) were checked across ~25 call
  sites and found internally consistent — noted here only because it was a
  candidate finding that turned out not to be a real issue.

---

## What's already solid (evidence, not just claims)

- **Modal focus management is correctly built**, not just documented as
  such: `openModal`/`closeModal` (`staff.js:283-328`) set
  `aria-labelledby` from the modal's own heading, trap Tab/Shift+Tab inside
  the dialog, close on Escape, and restore focus to whatever opened the
  modal. Confirmed by direct read, matching `ARCHITECTURE_MAP.md`'s claim.
- **No unsafe `innerHTML` usage.** A full-file grep for `innerHTML` returns
  exactly two hits: `icon()` (`staff.js:188`, assigning a fixed string from
  the static `ICON_PATHS` table, never user input) and one `= ''` clear
  (`staff.js:5561`). Every other piece of dynamic content in the file goes
  through `textContent`/`createTextNode`/DOM element creation.
- **The disable-during-save pattern is the norm, not the exception** — the
  gaps flagged above (H2, M5) stand out precisely because roughly two dozen
  other save/create flows in the file get this right, including the
  newest one: `openCreateStaffModal`'s invite flow (`staff.js:7873-7890`)
  disables `send`, wraps the fetch in try/catch, and re-enables on every
  exit path.
- **Checkbox toggles (checklist items, waiting items, to-dos) correctly
  revert on failure** instead of leaving the UI showing a state the
  database rejected — see `staff.js:4348-4355` and `4374-4384`.
- **Terminology is consistent.** A full-file grep for "Compliance Work" or
  lower-cased "client work"/"firm work" as a would-be UI label found none —
  "Client Work" and "Firm Work" are used as consistent proper nouns
  throughout, including in the newer grouped-sidebar labels
  (`staff.js:1092-1146`).
- **Two previously-documented nav-label/heading mismatches are confirmed
  fixed in the live code**, with comments citing the fix
  (`staff.js:1106-1111` for Firm Work's Catch-Up tab, `2460-2463` for
  Operations Overview) — good evidence this file is actively being kept
  internally consistent over time, not left to drift. (M6 above is the one
  instance that slipped through both passes.)
- **The new staff-photo upload path is defensively written**: client-side
  file-type/size checks (`staff.js:7213-7223`), a strict allow-list on what
  URL a photo field can ever be saved as — same-origin Supabase Storage
  public path or a local `/images/` path, nothing else
  (`allowedStaffPhotoUrl`, `staff.js:7192-7204`) — and a visible
  "Uploading…"/error status line (`staff.js:7309-7319`), even though the
  real security boundary is server-side RLS on the storage bucket, not this
  client check.

---

## Summary

10 real findings (2 High, 7 Medium, 1 further Low-adjacent already counted
above) plus 3 polish notes, all with concrete line citations. Nothing found
here rises to the severity of the DB/RLS work already completed and
verified in prior sessions — this pass is UI polish, one real data-
integrity bug (H1), one real double-submit gap (H2), and a handful of
consistency/accessibility nits on an otherwise well-maintained, actively
self-correcting file.
