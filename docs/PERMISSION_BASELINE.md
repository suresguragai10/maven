# Permission Baseline (Handbook Task 3)

Generated 2026-08-15T16:31:09.637Z by `node tests/db/run.js` -- **every row below reflects an actual query run against a real, disposable local Postgres instance**, not a reading of the policy text. Regenerate this file any time by running the harness again; do not hand-edit it, edits will be overwritten.

## Environment

- Local, disposable Postgres 18 via the `embedded-postgres` npm package (devDependency) -- see `tests/db/support/pg-instance.js` for why (the system-wide PostgreSQL install on this machine is missing its `share/` directory and cannot run `initdb`; touching its existing, password-protected data directory was ruled out with the owner's input). A fresh instance is created and destroyed for every run; nothing persists between runs and nothing here ever touched production.
- Schema: all 30 files in `supabase/migrations/` applied VERBATIM, in filename order, with exactly one documented exception (the `create extension if not exists pg_cron;` line is skipped -- pg_cron needs shared_preload_libraries and isn't bundled with the embedded package; nothing in this task's matrices depends on it). `pgcrypto` runs for real -- confirmed working before relying on it.
- `auth.users`/`auth.uid()`/`auth.role()` are reproduced by a minimal stub (`tests/db/support/auth-stub.sql`) that sets the same `request.jwt.claims` GUC PostgREST sets from a verified JWT -- this is the same technique used by hand in the Supabase SQL editor during the V2 Permission Audit (Task 19), automated here instead of typed once.
- **This harness tests the repository's migrations, not the live database.** Where Handbook Task 1 found live drift (e.g. the anon-execute grant mitigation applied by hand, never committed as a migration), this harness reproduces the ORIGINAL, pre-mitigation, as-committed state -- see the `client_credentials` and `recurring generation functions` sections below. That is intentional: it proves the gap lives in the repository itself, not only in whatever the live database happened to have before a manual fix.

## Summary

227 checks run across 29 areas. **0 show current behavior that does not match the intended permission model** (listed first, below) -- per this task's own instruction, none of these were fixed here; this document only establishes evidence. "Secure" below means "matches this document's own stated intent," not a claim that the intent itself is optimal.

## Full evidence table, by area

### profiles

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT a colleague's profile | employeeA | ALLOWED | ALLOW | PASS | blanket authenticated-read is intentional (assignee/reviewer pickers) |
| SELECT any profile | inactive | DENIED | DENY | PASS | 0 row(s) - current_user_active() should exclude this session |
| SELECT any profile | anon | DENIED | DENY | PASS | 0 row(s) |
| UPDATE own role to admin (self-escalation) | employeeA | DENIED | DENY | PASS | 0 row(s) affected |
| UPDATE deactivate a colleague | admin | ALLOWED | ALLOW | PASS | 1 row(s) affected |
| INSERT a profile directly (bypassing auth.users trigger) | admin | DENIED | DENY | PASS | new row violates row-level security policy for table "profiles" |

### clients/client_services

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT clients list | employeeA | ALLOWED | ALLOW | PASS | 2 row(s) - needed for New Work client picker |
| SELECT clients list | anon | DENIED | DENY | PASS | 0 row(s) |
| INSERT new client | admin | ALLOWED | ALLOW | PASS | inserted |
| INSERT new client | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "clients" |
| UPDATE a client's details | reviewerA | DENIED | DENY | PASS | 0 row(s) affected - clients_update_admin is admin-only, reviewer is not exempted |
| SELECT client_services | employeeA | ALLOWED | ALLOW | PASS | 4 row(s) |
| INSERT a client_services subscription | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "client_services" |
| SELECT clients list, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |
| SELECT client_services, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### work_items (client scope)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own assigned item | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT an item where they are neither assignee nor the assigned reviewer (reviewer role alone does not grant broad access) | reviewerB | DENIED | DENY | PASS | Confirms Handbook Task 5's design decision directly: reviewer scope is reviewer_id=them specifically, not blanket reviewer-role visibility into every client's work. Matches staff.js loadWork('review')'s own pre-existing comment about the intended model. |
| SELECT a colleague's item (status=in_progress, not assigned/reviewing) | employeeA | DENIED | DENY | PASS | FIXED by Handbook Task 5 (20260817090000_client_work_select_visibility.sql): work_items_read no longer has a blanket "status <> ready_for_review" branch. Previously any active user could see any non-ready-for-review item regardless of assignment; now correctly scoped to assignee/reviewer/admin. |
| SELECT a colleague's item that IS ready_for_review | employeeB | DENIED | DENY | PASS | this is the one status where visibility actually narrows to assignee/reviewer/admin |
| SELECT the item they are reviewer on, while ready_for_review | reviewerA | ALLOWED | ALLOW | PASS |  |
| UPDATE a colleague's item they are not assigned to | employeeA | DENIED | DENY | PASS | 0 row(s) - blocked directly by RLS since Handbook Task 5 tightened work_items_update's USING clause to match work_items_read (previously this row was RLS-visible via the removed "status<>ready_for_review" branch and only stopped by guard_work_item_update()'s trigger check; now the row isn't even reachable, so the trigger never gets a chance to run) |
| UPDATE own item's status (ordinary case) | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE own item: reassign to someone else | employeeA | DENIED | DENY | PASS | Only an admin can reassign or rescope work. |
| UPDATE own item: convert Client Work to Firm Work directly | employeeA | DENIED | DENY | PASS | work_scope cannot be changed after creation. |
| UPDATE own item: convert Client Work to Firm Work directly, as admin | admin | DENIED | DENY | PASS | work_scope cannot be changed after creation. |
| UPDATE (as the item's reviewer): move it to a different client entirely | reviewerA | DENIED | DENY | PASS | Only an admin can reassign or rescope work. |
| UPDATE (as the item's reviewer): reassign it to someone else | reviewerA | DENIED | DENY | PASS | Only an admin can reassign or rescope work. |
| UPDATE (as the item's reviewer): change work_scope directly | reviewerA | DENIED | DENY | PASS | work_scope cannot be changed after creation. |
| UPDATE (as the item's reviewer): record a legitimate review decision (approve) | reviewerA | ALLOWED | ALLOW | PASS | 1 row(s) - confirms the fix is scoped correctly: blocking reassignment/rescope does not block reviewers from doing their actual job |
| UPDATE created_at/created_by directly, even as admin | admin | DENIED | DENY | PASS | id/created_at/created_by cannot be changed. |
| SELECT any work item | anon | DENIED | DENY | PASS | 0 row(s) |
| SELECT any Client Work item, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |
| UPDATE a Client Work item, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### work_items (firm scope)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT Firm Work item not assigned to them | employeeB | ALLOWED | ALLOW | PASS | work_scope=firm branch: visible to any active user regardless of assignment |
| INSERT new Firm Work, assigned to someone else | employeeB | ALLOWED | ALLOW | PASS | inserted - confirms any active teammate can create+assign Firm Work at the DB level |
| UPDATE (reassign to self) Firm Work not currently assigned to them | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - FIXED by Handbook Task 6: guard_work_item_update() now branches on work_scope='firm' before any Client-Work ownership check, so a non-assignee peer can reassign Firm Work freely, matching the approved peer model. |
| UPDATE (status only, not reassigning) Firm Work not assigned to them | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - FIXED by Handbook Task 6, same fix as reassignment above: a non-assignee peer can now touch any field on Firm Work, not just via a reassignment-shaped update. |
| UPDATE own assigned Firm Work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| SELECT any Firm Work | anon | DENIED | DENY | PASS | 0 row(s) |
| UPDATE Firm Work as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) - blocked twice over: work_items_update's RLS USING clause requires current_user_active() before the row is even targetable, and guard_work_item_update()'s Firm Work branch re-checks it explicitly as defense in depth |

### work_checklist_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT checklist for a colleague's (in_progress) item | employeeB | DENIED | DENY | PASS | FIXED by Handbook Task 5: work_checklist_items_read's exists-subquery no longer has the "status<>ready_for_review" broad branch, matching the parent work_items_read fix. |
| INSERT a checklist item on a colleague's work | employeeB | DENIED | DENY | PASS | new row violates row-level security policy for table "work_checklist_items" |
| UPDATE (toggle) checklist item on own work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE (toggle) checklist item on a colleague's work | employeeB | DENIED | DENY | PASS | 0 row(s) - UPDATE never had the broad branch SELECT used to have; only admin/assignee/reviewer can edit, matches sensible design (anyone can watch progress, only the responsible people can change it). Now consistent with SELECT too, post-Task-5. |
| SELECT checklist, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### work_activity

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT activity log for a colleague's (in_progress) item | employeeB | DENIED | DENY | PASS | FIXED by Handbook Task 5, matching the parent work_items_read fix. |
| INSERT an activity row with actor_id set to someone ELSE (not themselves) | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "work_activity" |
| UPDATE an existing activity entry | admin | DENIED | DENY | PASS | 0 row(s) - correctly immutable even for admin, no update policy exists |
| SELECT activity log, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |
| SELECT (as an active teammate) historical activity authored by the now-deactivated profile, including resolving their name | employeeA | ALLOWED | ALLOW | PASS | found: "Historical entry from before deactivation" by Inactive Former Staff - deactivation never deletes/hides historical actor references |

### work_waiting_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT waiting items for a colleague's (in_progress) item | employeeB | DENIED | DENY | PASS | FIXED by Handbook Task 5, matching the parent work_items_read fix. |
| INSERT a waiting item on a colleague's work | employeeB | DENIED | DENY | PASS | new row violates row-level security policy for table "work_waiting_items" |
| UPDATE (mark received) waiting item on own work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| SELECT any waiting item | anon | DENIED | DENY | PASS | 0 row(s) |
| SELECT waiting items, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### work_activity (trustworthy audit trail)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| UPDATE status via a plain UPDATE, then check a status_changed row appeared with no separate activity insert issued | employeeA | ALLOWED | ALLOW | PASS | found: source=system detail="In Progress → Waiting for Client" |
| UPDATE Firm Work assignee via a plain UPDATE, then check a reassigned row appeared with no separate activity insert issued | admin | ALLOWED | ALLOW | PASS | found: source=system detail="Assignee: Employee A → Employee B." |
| INSERT a forged system-shaped event directly (source=system, action=status_changed) | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "work_activity" |
| INSERT a forged reassignment event with source=client (action not on the allowlist) | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "work_activity" |
| INSERT an allowlisted action but with actor_id spoofed to someone else | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "work_activity" |
| INSERT an allowlisted action, correct actor, but omitting source (defaults to 'system') | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "work_activity" |
| INSERT a genuinely legitimate allowlisted client action (correct actor, correct source) | employeeA | ALLOWED | ALLOW | PASS | inserted |
| UPDATE an existing activity entry, even as admin | admin | DENIED | DENY | PASS | 0 row(s) - still no UPDATE policy |
| SELECT the original "created" activity entry, seeded before this migration existed | employeeA | ALLOWED | ALLOW | PASS | 2 row(s) - pre-existing history survives the migration and stays readable |
| INSERT a new work item with created_by spoofed to someone else | employeeB | DENIED | DENY | PASS | created_by ended up as 33333333-3333-3333-3333-333333333333 (requested spoof: 66666666-6666-6666-6666-666666666666, real caller: 33333333-3333-3333-3333-333333333333) — should always equal the real caller, forced by the new BEFORE INSERT trigger |

### Client Work transitions + checklist gates

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| UPDATE status directly from to_do to completed (skips in_progress/review/submission entirely) | employeeA | DENIED | DENY | PASS | Only a reviewer or admin can set that status. |
| UPDATE in_progress -> ready_for_review with an unchecked REQUIRED preparation item | employeeA | DENIED | DENY | PASS | Complete all required preparation checklist items before sending for review. |
| UPDATE in_progress -> ready_for_review after checking the required preparation item | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE ready_for_review -> approved with an unchecked REQUIRED review item | reviewerA | DENIED | DENY | PASS | Complete all required review checklist items before approving. |
| UPDATE ready_for_review -> approved after the required review item is already checked | reviewerA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE ready_to_submit -> completed without recording the submission (submission_required=true) | admin | DENIED | DENY | PASS | Record the submission and complete all required submission checklist items before marking completed. |
| UPDATE ready_to_submit -> completed after recording the submission | admin | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE (as admin, NO override reason) skip straight to completed from in_progress | admin | DENIED | DENY | PASS | Invalid status change: In Progress → Completed is not a normal transition. |
| UPDATE (as admin, WITH a real override reason) skip straight to completed from in_progress | admin | ALLOWED | ALLOW | PASS | update ok; status_override logged=true; reason column cleared after use=true (detail: "Invalid status change: In Progress → Completed is not a normal transition. OVERRIDDEN (In Progress → Completed). Reason: Client closed the business; filing period must be force-closed per accountant instruction.") |
| UPDATE Firm Work directly from to_do to completed (no transition map applies to work_scope=firm) | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) - Firm Work keeps its lighter model, untouched by this task |

### submission fields/actions

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| UPDATE submission fields while status=in_progress (not ready_to_submit) | employeeA | DENIED | DENY | PASS | Submission can only be recorded once the work is ready to submit. |
| UPDATE submission fields (as the item's reviewer) while status=in_progress | reviewerA | DENIED | DENY | PASS | Submission can only be recorded once the work is ready to submit. |
| UPDATE submission fields (as admin) while status=in_progress | admin | DENIED | DENY | PASS | Submission can only be recorded once the work is ready to submit. |

### service_templates / service_template_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT templates list | employeeA | ALLOWED | ALLOW | PASS | needed for New Work modal template picker |
| INSERT a new template | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "service_templates" |
| INSERT a new template | admin | ALLOWED | ALLOW | PASS | inserted |
| DELETE template checklist items | reviewerA | DENIED | DENY | PASS | 0 row(s) - admin-only |
| SELECT templates list, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### app_settings

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT workflow settings | employeeA | ALLOWED | ALLOW | PASS | 8 row(s) - readable, values aren't sensitive |
| UPSERT a workflow setting | reviewerA | DENIED | DENY | PASS | new row violates row-level security policy for table "app_settings" |
| SELECT workflow settings | anon | DENIED | DENY | PASS | 0 row(s) |
| SELECT workflow settings, as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |

### notifications

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own notifications | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT a colleague's notifications | employeeB | DENIED | DENY | PASS | 0 row(s) - strict ownership |
| SELECT own notifications (as a deactivated profile with a still-valid session) | inactive | DENIED | DENY | PASS | 0 row(s) - FIXED by Handbook Task 9: notifications_read now requires current_user_active() in addition to ownership (20260821090000_offboarding_revokes_business_access.sql). |
| SELECT any notification | anon | DENIED | DENY | PASS | 0 row(s) |

### personal_todos

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own to-dos | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT a colleague's to-dos | employeeB | DENIED | DENY | PASS | 0 row(s) |
| SELECT own to-dos (as a deactivated profile with a still-valid session) | inactive | DENIED | DENY | PASS | 0 row(s) - FIXED by Handbook Task 9, same fix as notifications. |

### client_attention (set_client_attention RPC)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| CALL as reviewer | reviewerA | ALLOWED | ALLOW | PASS | succeeded - reviewers are deliberately included per the V2 audit's stated decision |
| CALL as a plain employee (real, non-NULL role) | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL as anonymous | anon | DENIED | DENY | PASS | permission denied for function set_client_attention |
| CALL as a deactivated profile with a still-valid authenticated session | inactive | DENIED | DENY | PASS | Not authorized. |

### client_credentials

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT the table directly (even as admin) | admin | DENIED | DENY | PASS | 0 row(s) - correctly blocked, zero RLS policies means direct table access is denied for everyone, by design |
| CALL list_client_credentials as reviewer | reviewerA | ALLOWED | ALLOW | PASS |  |
| CALL list_client_credentials as a plain employee | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL list_client_credentials as anonymous | anon | DENIED | DENY | PASS | permission denied for function list_client_credentials |
| CALL reveal_client_credential as anonymous | anon | DENIED | DENY | PASS | permission denied for function reveal_client_credential |
| Full anonymous chain: list then reveal a real password | anon | DENIED | DENY | PASS | permission denied for function list_client_credentials |
| CALL list_client_credentials as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | Not authorized. |
| CALL add_client_credential as anonymous | anon | DENIED | DENY | PASS | permission denied for function add_client_credential |
| CALL delete_client_credential as anonymous (nonexistent id, function-reachability check only) | anon | DENIED | DENY | PASS | permission denied for function delete_client_credential |
| has_function_privilege(anon, reveal_client_credential, EXECUTE) - direct grant inspection | n/a (catalog check) | DENIED | DENY | PASS | anon_can_execute = false - confirms the anon EXECUTE grant is closed (Handbook Task 9), independent of actually calling the function |
| Authorized reveal decrypts to the correct value | reviewerA | ALLOWED | ALLOW | PASS | decrypted value matched the known seed password (value not printed, per Task 10) |
| CALL add_client_credential with no Vault secret configured (fail-closed check) | admin | DENIED | DENY | PASS | Client credential encryption is not configured. An admin must set up the client_credentials_passphrase secret in Supabase Vault before credentials can be stored — see docs/SECURITY_MODEL.md. |
| CALL reveal_client_credential with no Vault secret configured (fail-closed check) | admin | DENIED | DENY | PASS | Client credential encryption is not configured. An admin must set up the client_credentials_passphrase secret in Supabase Vault before credentials can be revealed — see docs/SECURITY_MODEL.md. |

### recurring generation functions

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| CALL generate_period_work_for_period as admin | admin | ALLOWED | ALLOW | PASS | succeeded, count=2 |
| CALL generate_period_work_for_period as a plain employee | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL generate_period_work_for_period as anonymous | anon | DENIED | DENY | PASS | permission denied for function generate_period_work_for_period |
| CALL generate_period_work_for_period as a deactivated profile | inactive | DENIED | DENY | PASS | Not authorized. |
| CALL _generate_period_work_core directly (bypassing the wrapper), even as admin | admin | DENIED | DENY | PASS | permission denied for function _generate_period_work_core |

### period normalization (Handbook Task 11)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Generate a historical monthly period (Jan 2025) — due dates land in the requested period, not today | admin | ALLOWED | ALLOW | PASS | external=2025-01-25, internal=2025-01-22 — correct |
| Generate the current monthly period (brackets today) — due dates still derive from the requested range | admin | ALLOWED | ALLOW | PASS | external=2026-08-25, internal=2026-08-22 — correct |
| Generate a future monthly period (Jun 2030) — due dates land in 2030, not today's month | admin | ALLOWED | ALLOW | PASS | external=2030-06-25, internal=2030-06-22 — correct |
| Generate a quarterly period — due dates land in the period's ending month | admin | ALLOWED | ALLOW | PASS | external=2026-06-15, internal=2026-06-10 — correct |
| Generate a yearly period — due dates land in the period's ending month | admin | ALLOWED | ALLOW | PASS | external=2026-07-10, internal=2026-07-03 — correct |
| Call generate_period_work_for_period twice for the identical client+service+period | admin | ALLOWED | ALLOW | PASS | first created 2, second created 0 — idempotent, no duplicate work_items row |
| Generate with p_period_start = null | admin | DENIED | DENY | PASS | p_period_start and p_period_end are required: the requested period's Gregorian date range must be provided explicitly, never assumed from today's date. |
| Generate with p_period_end = null | admin | DENIED | DENY | PASS | p_period_start and p_period_end are required: the requested period's Gregorian date range must be provided explicitly, never assumed from today's date. |
| Generate with p_period_end before p_period_start | admin | DENIED | DENY | PASS | p_period_end cannot be before p_period_start. |

### deadline_rules governance (Handbook Task 12)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT deadline_rules as a plain employee | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) — reading the rule (not writing it) is fine for anyone authenticated |
| Direct INSERT into deadline_rules, even as admin (bypassing add_deadline_rule) | admin | DENIED | DENY | PASS | new row violates row-level security policy for table "deadline_rules" |
| CALL add_deadline_rule as a plain employee | employeeA | DENIED | DENY | PASS | Only an admin can add or update a deadline rule. |
| CALL add_deadline_rule as reviewer | reviewerA | DENIED | DENY | PASS | Only an admin can add or update a deadline rule. |
| CALL add_deadline_rule as anonymous | anon | DENIED | DENY | PASS | permission denied for function add_deadline_rule |
| CALL add_deadline_rule with no source_title | admin | DENIED | DENY | PASS | A source title is required — a deadline rule cannot be added without a citation. |
| CALL add_deadline_rule with no verified_date | admin | DENIED | DENY | PASS | A verified date is required. |
| CALL add_deadline_rule with filing_deadline_day = 32 (out of range) | admin | DENIED | DENY | PASS | filing_deadline_day must be between 1 and 31. |
| Add a second rule for a template that already has an active one — must supersede, not duplicate | admin | ALLOWED | ALLOW | PASS | exactly 1 active row (day 28), old rule correctly superseded and linked |
| Generate work for a template with requires_external_deadline=true but no active rule — external must stay unset, never guessed | admin | ALLOWED | ALLOW | PASS | external_due_date and internal_due_date both correctly NULL — no fabricated deadline |
| Generate work for the same template after a rule is added — external now derives from the governed rule | admin | ALLOWED | ALLOW | PASS | external_due_date=2026-03-20, matches the new rule's day 20 |
| Manually override external_due_date on an existing work item — must be logged to work_activity | admin | ALLOWED | ALLOW | PASS | work_activity recorded: "Internal: — → —. Filing: — → 2026-12-25" |
| has_function_privilege(anon, add_deadline_rule, EXECUTE) — direct grant inspection | n/a (catalog check) | DENIED | DENY | PASS | anon_can_execute = false |

### client_services effective periods (Handbook Task 13)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Generate for a period entirely before the service's start_date | admin | ALLOWED | ALLOW | PASS | correctly skipped — no work item created before service start |
| Generate for a period starting exactly on the service's start_date (inclusive boundary) | admin | ALLOWED | ALLOW | PASS | correctly generated — on-or-after start is allowed |
| Generate for a period entirely after the service's end_date | admin | ALLOWED | ALLOW | PASS | correctly skipped — no work item created after service end |
| Generate for a deactivated (is_active=false) service | admin | ALLOWED | ALLOW | PASS | correctly skipped — inactive services never generate |
| Generate as reviewerA (who is not the service's assignee) — created_by must record reviewerA, not the assignee or any fallback admin | reviewerA | ALLOWED | ALLOW | PASS | created_by correctly = reviewerA (assignee_id = 22222222-2222-2222-2222-222222222222, a different person) |
| Generate when a service has no assignee and no active admin exists to fall back to — must skip that service safely, without crashing or affecting other services in the same call | reviewerA | ALLOWED | ALLOW | PASS | call succeeded overall; the assignee-less service was skipped (no row, no crash); the other, properly-assigned service in the same call still generated normally |
| Historical work is unchanged after service deactivation and template edits | admin | ALLOWED | ALLOW | PASS | work item's title/assignee/dates/status are byte-identical after deactivating its service and renaming its template |
| Two genuinely concurrent, separately-committed generate_period_work_for_period calls for the identical period | admin (x2 connections) | ALLOWED | ALLOW | PASS | 2 total row(s) created across both calls, zero duplicate (client, service, period) combinations — the unique index held under real concurrency |

### Client Work full lifecycle (Handbook Task 14 regression)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Full lifecycle: 25 steps (create -> in_progress -> waiting -> received -> blocked/gated review -> changes required -> fixed -> resubmitted -> reassigned -> blocked/gated approval -> ready_to_submit -> blocked completion -> submitted -> acknowledged -> completed -> reopen blocked -> activity verified) | employeeA/reviewerA/admin/employeeB (multi-actor) | ALLOWED | ALLOW | PASS | every step behaved exactly as the transition map, checklist gates, and audit trail are supposed to |

### Firm Work / Client Work reporting isolation (Handbook Task 14)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Sanity check: the seeded Firm Work item is real and unfiltered queries do see it | admin | ALLOWED | ALLOW | PASS | confirmed work_scope='firm' |
| loadWork()'s query shape (work_scope='client') excludes the Firm Work item | admin | ALLOWED | ALLOW | PASS | 3 client-scope row(s), Firm Work correctly absent |
| Reports "active" query (status <> completed) | admin | ALLOWED | ALLOW | PASS | 3 row(s), Firm Work correctly absent |
| Reports "created in range" query | admin | ALLOWED | ALLOW | PASS | 3 row(s), Firm Work correctly absent |
| Reports "completed in range" query | admin | ALLOWED | ALLOW | PASS | 0 row(s), Firm Work correctly absent |
| Firm Work page's own query shape (work_scope='firm') correctly includes Firm Work and nothing else | admin | ALLOWED | ALLOW | PASS | 1 row(s), all work_scope='firm' |
| INSERT a work_scope='firm' row WITH a client_id set -- proves Client Detail's client_id filter can never structurally match Firm Work | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_scope_fields_check" |
| work_items_scope_fields_check constraint exists on work_items | n/a (catalog check) | ALLOWED | ALLOW | PASS | confirmed present |

### projects / Firm Work async fields (Handbook Task 15)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| INSERT a client-scope work item with project_id set | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_scope_fields_check" |
| INSERT a client-scope work item with next_action set | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_scope_fields_check" |
| INSERT a client-scope work item with blocker_reason set | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_scope_fields_check" |
| INSERT a firm-scope work item with period_type/period_start_date/period_end_date set | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_scope_fields_check" |
| INSERT a valid firm-scope work item with project_id, next_action, and blocker_reason all set | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| INSERT a firm-scope work item with a project_id that does not exist | admin | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_firm_category_required_check" |
| INSERT a firm-scope work item with project_id/next_action/blocker_reason all omitted | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) - all three genuinely optional |
| Pre-existing (pre-Task-15) Firm Work item still readable, with NULL on every new column | admin | ALLOWED | ALLOW | PASS | historical record intact and unmodified by the migration |
| SELECT a project as a plain employee | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| INSERT a new project as a plain employee | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - matches "any active team member" creating Firm Work groupings |
| UPDATE (archive) a project as a plain employee | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| SELECT any project as anonymous | anon | DENIED | DENY | PASS | 0 row(s) |
| INSERT a project as anonymous | anon | DENIED | DENY | PASS | new row violates row-level security policy for table "projects" |
| SELECT a project as a deactivated profile with a still-valid session | inactive | DENIED | DENY | PASS | 0 row(s) |
| DELETE a project, even as admin (no delete policy -- archive is the intended retirement path) | admin | DENIED | DENY | PASS | 0 row(s) - CRITICAL: a project was deleted despite no delete policy existing, which would orphan any work_items still referencing it |

### Firm Work peer permissions (Handbook Task 16)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Employee edits title/description/priority on Firm Work owned by a different employee | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - ownership identifies responsibility, not exclusive edit rights |
| Reviewer edits status/next_action on Firm Work not assigned to or reviewed by them | reviewerA | ALLOWED | ALLOW | PASS | 1 row(s) - Firm Work has no reviewer concept; a reviewer is just another active teammate here |
| Reassign Firm Work to a different active teammate, and confirm it is logged to activity history | employeeB | ALLOWED | ALLOW | PASS | reassigned and logged: "Assignee: Employee A → Reviewer A." |
| CREATE Firm Work assigned to a deactivated profile | admin | DENIED | DENY | PASS | Firm Work can only be assigned to an active teammate. |
| REASSIGN existing Firm Work to a deactivated profile | employeeA | DENIED | DENY | PASS | Firm Work can only be assigned to an active teammate. |
| Deactivated profile with a still-valid session attempts to edit Firm Work | inactive | DENIED | DENY | PASS | 0 row(s) - blocked both by RLS (current_user_active() in work_items_update) and by guard_work_item_update()'s own explicit check |
| Attempt to change work_scope from firm to client, as admin | admin | DENIED | DENY | PASS | work_scope cannot be changed after creation. |
| Add a checklist item to Firm Work not assigned to them | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - FIXED by this task: work_checklist_items_write previously had no work_scope='firm' branch at all |
| Toggle a checklist item on Firm Work not assigned to them | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) - FIXED by this task: work_checklist_items_update previously had no work_scope='firm' branch either |
| Post an update/comment on Firm Work not assigned to them | employeeB | ALLOWED | ALLOW | PASS | already worked before this task; re-verified here directly |
| Anonymous attempts to edit Firm Work | anon | DENIED | DENY | PASS | 0 row(s) - CRITICAL: no login at all was enough to edit Firm Work |

### Firm Work form validation (Handbook Task 17)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| CREATE Firm Work with no category | employeeA | DENIED | DENY | PASS | new row for relation "work_items" violates check constraint "work_items_firm_category_required_check" |
| CREATE Firm Work with a valid category | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| CREATE Client Work with no firm_category (category is a Firm-Work-only requirement) | employeeA | ALLOWED | ALLOW | PASS | correctly unaffected -- firm_category is never required for Client Work |
| Transition to Blocked with no blocker_reason at all | employeeA | DENIED | DENY | PASS | Explain what's blocking this (at least a short sentence) before marking it Blocked. |
| Transition to Blocked with a too-short blocker_reason ("ugh") | employeeA | DENIED | DENY | PASS | Explain what's blocking this (at least a short sentence) before marking it Blocked. |
| Transition to Blocked with a real blocker_reason | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| Unrelated edit (rename) on an already-Blocked historical item with no blocker_reason | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) - historical records are never locked out of routine editing just because they predate this rule |

### Firm Work async handoff (Handbook Task 18)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Post an update with update_type='progress' | employeeA | ALLOWED | ALLOW | PASS | accepted |
| Post an update with update_type='result' | employeeA | ALLOWED | ALLOW | PASS | accepted |
| Post an update with update_type='blocker' | employeeA | ALLOWED | ALLOW | PASS | accepted |
| Post an update with update_type='handoff' | employeeA | ALLOWED | ALLOW | PASS | accepted |
| Post an update with update_type='note' | employeeA | ALLOWED | ALLOW | PASS | accepted |
| Post an update with no update_type at all | employeeA | ALLOWED | ALLOW | PASS | accepted -- type is optional |
| Post an update with update_type='decision_needed' (the explicitly rejected hierarchy) | employeeA | DENIED | DENY | PASS | new row for relation "work_comments" violates check constraint "work_comments_update_type_check" |
| Set follow_up_date on a Firm Work item | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| Mark Blocked with a real reason and a follow-up date in the same write | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| project_id change is logged to work_activity as old -> new (Task 18 HISTORY requirement) | employeeA | ALLOWED | ALLOW | PASS | logged: "Office Search → Marketing Campaign" |
| Clearing project_id (back to no project) is also logged as old -> — | employeeA | ALLOWED | ALLOW | PASS | logged: "Office Search → —" |
| A different active teammate can read a typed update on someone else's Firm Work (peer model, unchanged) | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) |

### Projects management (Handbook Task 19)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| Create a project as a plain employee | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) |
| Renaming a project sets updated_by/updated_at from the REAL caller, ignoring a spoofed value | employeeA | ALLOWED | ALLOW | PASS | updated_by correctly = employeeA (spoofed employeeB rejected) |
| created_by/created_at cannot be rewritten via UPDATE, even by the project's own creator | employeeA | ALLOWED | ALLOW | PASS | provenance unchanged |
| Archive a project created by someone else (peer model) | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) |
| Reactivate an archived project | employeeB | ALLOWED | ALLOW | PASS | 1 row(s) |
| Archiving a project does NOT clear or delete project_id on Firm Work that references it | employeeA | ALLOWED | ALLOW | PASS | project_id untouched, history intact |
| Delete a project outright (even as admin) -- no delete policy exists, by design | admin | DENIED | DENY | PASS | CRITICAL: a project was deleted -- historical Firm Work under it would lose its label with no way back |

### My Work combined Client+Firm (Handbook Task 20)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| "My Work"'s Firm Work query returns only items assigned to the caller, not a colleague's unassigned-to-them item | employeeA | ALLOWED | ALLOW | PASS | 2 row(s), correctly excludes the colleague's item |
| My Work's Client Work query never includes a Firm Work item, even one assigned to the same person | employeeA | ALLOWED | ALLOW | PASS | Firm Work correctly excluded from the client-scope query |
| A personal to-do never appears in a work_items query, regardless of scope | employeeA | ALLOWED | ALLOW | PASS | 0 row(s) found (expected 0 -- personal_todos is a separate table, never joined into work_items) |

### SECURITY DEFINER function grants (catalog inspection)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| EXECUTE grant to 'anon' on _generate_period_work_core(p_period text, p_period_type text, p_period_start date, p_period_end date) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=false (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on add_client_credential(p_client_id uuid, p_label text, p_username text, p_password text, p_notes text) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on add_deadline_rule(p_service_template_id uuid, p_financial_year_label text, p_effective_from date, p_effective_to date, p_filing_deadline_day integer, p_source_title text, p_source_url text, p_source_reference text, p_source_page_section text, p_verified_date date) | n/a (catalog check) | DENIED | DENY | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=false |
| EXECUTE grant to 'anon' on current_user_active() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on current_user_role() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on delete_client_credential(p_id uuid) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on generate_period_work_for_period(p_period text, p_period_type text, p_period_start date, p_period_end date) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on guard_profile_update() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on guard_work_item_update() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on handle_new_user() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on list_client_credentials(p_client_id uuid) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on log_work_item_created() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on reveal_client_credential(p_id uuid) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on set_client_attention(p_client_id uuid, p_level text, p_reason text) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on set_projects_updated_by() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on set_work_item_created_by() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on work_item_status_label(p_status text) | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - not SECURITY DEFINER; anon_can_execute=true |

## How to re-run

```bash
npm run test:db
```

Regenerates this file and `docs/permission_baseline.json` from a fresh run. A future security fix should change specific rows from FAIL to PASS in the relevant area -- that diff, in version control, is the proof the task's acceptance criterion asks for: the original unauthorized action fails at the database level, provably, not just because a button disappeared from the UI.
