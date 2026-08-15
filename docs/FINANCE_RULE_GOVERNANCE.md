# Finance Rule Governance (Handbook Task 12)

**Current, authoritative.** How a statutory filing deadline becomes
approved configuration in Maven Work Desk, and why the system refuses to
guess one when it can't.

## The core principle

**A plausible but incorrect filing deadline is more dangerous than a
blank field that asks for verification.** An accounting firm's software
computing a confident-looking date that turns out to be wrong is worse
than the same software honestly saying "nobody has verified this yet" —
the first looks trustworthy and isn't; the second is visibly a task, not
a silent risk. Every legally sensitive deadline this app computes
follows from that principle:

- Nothing in this codebase — no migration, no `staff.js` code path, and
  no instruction given to an AI assistant working on this repository —
  is permitted to invent, update, or "correct" a Nepal VAT/TDS/tax
  deadline from general knowledge, model memory, or a generic website
  search. Every deadline this app ever computes traces back to a human
  who read a primary source and typed in what it said.
- A Finance Bill/Budget assumption is not final law until an owner has
  confirmed it against a primary source. Nothing here treats "the Budget
  probably says X" as configuration.
- If no verified rule exists for a service, the system leaves the
  external deadline **unset** and visibly flags it — it never falls back
  to a guess, a default, or silently reuses a stale value.

## Two dates, never conflated

Every Client Work item can carry two independent dates:

- **Internal Target** (`work_items.internal_due_date`) — when Maven
  expects the work actually finished. This is Maven's own operational
  buffer, not a legal fact. It drives day-to-day urgency (see
  `effectiveDue()` in `staff.js`) because it's meant to land before the
  real deadline.
- **External / Filing Deadline** (`work_items.external_due_date`) — the
  actual statutory or client-facing deadline. This is the one that must
  trace to an approved rule (see below) whenever the service is flagged
  as having one.

Generation derives External from the verified rule (if one exists) and
Internal separately, by subtracting the template's own
`internal_offset_days` from External — **Internal is never treated as a
substitute for External, and External is never overwritten by Internal**
or vice versa. Both remain independently editable per work item (Work
Details → Edit), and any manual change to either is logged immutably to
`work_activity` (action `due_date_changed`, unconditional — see
`guard_work_item_update()`, unchanged by this task) — a manual override
is always possible, and always leaves an audit trail.

Labeled distinctly everywhere a work item's due date appears — Today, My
Work, All Work, Work Details, and Deadlines all read through the same
`dueDateText()`/Work Details `metaGrid` code paths in `staff.js`, so
there is exactly one place that decides how these two dates are
described, not five independent, potentially-inconsistent copies.

## The governed model: `deadline_rules`

Before this task, `service_templates.filing_deadline_day` was a bare
integer an admin could type into the Edit Template modal with no record
of where it came from or whether anyone had actually checked it. As of
`20260824090000_deadline_governance.sql`, that integer is legacy and no
longer read by generation. The governed replacement is the
`deadline_rules` table — one row per verification event, per service:

| Field | Meaning |
|---|---|
| `service_template_id` | Which service this rule governs |
| `financial_year_label` | Free-text FY/effective-period label (e.g. "FY 2082/83 onwards") — informational, like `work_items.period`; not used for automatic date-range matching (see below) |
| `effective_from` / `effective_to` | Optional Gregorian bounds, for the human record — same "explicit period record, never a BS→Gregorian formula" principle established in Handbook Task 11 |
| `filing_deadline_day` | The concrete rule this app can compute with: a day-of-month (1–31), applied to the Gregorian month the requested work period ends in, clamped to that month's real last day |
| `source_title` | **Required.** What the rule comes from (e.g. "Income Tax Act 2058, Finance Act 2082 amendment") |
| `source_url` | Optional link |
| `source_reference` | Optional citation (e.g. an IRD circular number) |
| `source_page_section` | Optional page/section within the source |
| `verified_date` | **Required.** When someone actually checked this against the source |
| `verified_by` | Who — always `auth.uid()` at insert time, never client-supplied (same provenance discipline as `work_items.created_by`) |
| `status` | `active` or `superseded` — at most **one** `active` row per `service_template_id` at any time, enforced by a partial unique index, not application logic |
| `superseded_by` | Points at whichever rule replaced this one, once it has been |

### Why "one active rule at a time," not date-range matching

An earlier design considered matching a rule to a requested period by
its `effective_from`/`effective_to` window automatically. That was
rejected: if two rules' windows ever overlapped (a data-entry mistake),
automatically picking one would itself be a guess — exactly what this
task exists to prevent. Instead, exactly one rule is `active` for a
service at any moment, full stop. When the real deadline changes, an
admin explicitly adds the new rule; the previous one is automatically
`status = 'superseded'` and `superseded_by`-linked in the same
transaction (`add_deadline_rule()`), never silently. `financial_year_label`/
`effective_from`/`effective_to` remain as the human-readable record of
*when* a given rule was believed correct, without being load-bearing for
which one generation actually uses.

## How a rule becomes approved configuration

1. **`service_templates.requires_external_deadline`** — an explicit
   admin checkbox ("This service has a statutory filing deadline") on
   the New/Edit Template modal. This only marks *whether* the category
   has a real filing deadline at all; it carries no date. A template
   left unchecked (e.g. general bookkeeping/advisory with no statutory
   filing date) never shows a "requires verification" flag anywhere,
   because none is expected.
2. On the Templates page, a template flagged this way shows a **"Manage
   Deadline Rule"** button (admin-only). It displays the full history of
   every rule ever recorded for that service — active and superseded —
   each with its source citation and verified-by/date, and a form to add
   a new one.
3. Saving that form calls `add_deadline_rule(...)`, a `SECURITY DEFINER`
   RPC that is the **only** way any row ever enters or changes in
   `deadline_rules` — the table itself has no `INSERT`/`UPDATE` policy
   at all (same deny-by-default-at-the-table, access-only-through-a-
   function pattern already used for `client_credentials`). The function
   itself enforces, server-side, independent of whatever the UI form
   did or didn't check:
   - caller is `admin` (`coalesce(current_user_role(), '') = 'admin'`,
     the NULL-safe pattern this session's every privileged function has
     used since Handbook Task 9);
   - `financial_year_label`, `filing_deadline_day` (1–31), `source_title`,
     and `verified_date` are all present;
   - the target `service_template_id` exists;
   - then, atomically: supersede whatever rule was `active` for that
     template (if any), insert the new one as `active`, and link
     `superseded_by` on the old row to the new one's id.
4. Generation (`_generate_period_work_core`, called by both the manual
   "Generate Period Work" button and the auto-generate-on-login check)
   left-joins the active `deadline_rules` row for each service. If one
   exists, External derives from its `filing_deadline_day`, applied to
   the requested period's own ending month (see Handbook Task 11 — never
   `current_date`). **If none exists, External is left `NULL`** — the
   work item still generates (assignee/checklist/etc. are unaffected),
   it simply has no filing deadline yet.

## Tracing a deadline back to its rule

The task's acceptance criterion — "a user can trace every statutory
deadline used by the system to a specific approved rule/version" — is
satisfied by:

- **Work Details**: the External / Filing Deadline field shows the
  actual date if set, or "Requires verification" (visibly amber) if the
  template needs one and none is active yet.
- **Templates page**: each flagged template's card shows its currently
  active rule's day-of-month, FY label, verified date, verified-by name,
  and source title inline — or a visible "⚠ No verified deadline rule
  yet" warning if none exists. "Manage Deadline Rule" opens the full
  history, so a superseded rule from two years ago is still visible, not
  deleted.
- **`work_activity`**: any *manual* override of a specific work item's
  External/Internal date (Edit Work modal) is logged immutably with the
  before/after values — a governed rule sets the generated default, but
  a human can always override an individual item, and that override
  itself is traceable.

No deadline this app has ever generated is untraceable: it is either
`NULL` (visibly flagged, nothing to trace because nothing was computed),
came from a specific `deadline_rules` row (traceable via the Templates
page history), or was a manual per-item override (traceable via
`work_activity`).

## What this document does not, and will not, contain

No real Nepal VAT/TDS/tax deadline value. This file describes the
*mechanism*, not the *data* — entering real deadline data happens live,
through `add_deadline_rule()`, by an admin working from a primary
source, never by editing this file or any migration.
