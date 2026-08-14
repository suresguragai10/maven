# Permission Baseline (Handbook Task 3)

Generated 2026-08-14T17:10:04.019Z by `node tests/db/run.js` -- **every row below reflects an actual query run against a real, disposable local Postgres instance**, not a reading of the policy text. Regenerate this file any time by running the harness again; do not hand-edit it, edits will be overwritten.

## Environment

- Local, disposable Postgres 18 via the `embedded-postgres` npm package (devDependency) -- see `tests/db/support/pg-instance.js` for why (the system-wide PostgreSQL install on this machine is missing its `share/` directory and cannot run `initdb`; touching its existing, password-protected data directory was ruled out with the owner's input). A fresh instance is created and destroyed for every run; nothing persists between runs and nothing here ever touched production.
- Schema: all 16 files in `supabase/migrations/` applied VERBATIM, in filename order, with exactly one documented exception (the `create extension if not exists pg_cron;` line is skipped -- pg_cron needs shared_preload_libraries and isn't bundled with the embedded package; nothing in this task's matrices depends on it). `pgcrypto` runs for real -- confirmed working before relying on it.
- `auth.users`/`auth.uid()`/`auth.role()` are reproduced by a minimal stub (`tests/db/support/auth-stub.sql`) that sets the same `request.jwt.claims` GUC PostgREST sets from a verified JWT -- this is the same technique used by hand in the Supabase SQL editor during the V2 Permission Audit (Task 19), automated here instead of typed once.
- **This harness tests the repository's migrations, not the live database.** Where Handbook Task 1 found live drift (e.g. the anon-execute grant mitigation applied by hand, never committed as a migration), this harness reproduces the ORIGINAL, pre-mitigation, as-committed state -- see the `client_credentials` and `recurring generation functions` sections below. That is intentional: it proves the gap lives in the repository itself, not only in whatever the live database happened to have before a manual fix.

## Summary

89 checks run across 16 areas. **22 show current behavior that does not match the intended permission model** (listed first, below) -- per this task's own instruction, none of these were fixed here; this document only establishes evidence. "Secure" below means "matches this document's own stated intent," not a claim that the intent itself is optimal.

## Findings — current behavior does not match the intended model

| Area | Action | Identity | Observed | Note |
|---|---|---|---|---|
| work_items (client scope) | UPDATE (as the item's reviewer): move it to a different client entirely | reviewerA | **ALLOWED** (expected DENY) | 1 row(s) - guard_work_item_update()'s reviewer branch skips ALL else-branch checks once role='reviewer' and they match old/new.reviewer_id, so a reviewer can rescope/reassign/change-client on anything they review, not just record review decisions. The V2 Permission Audit's own stated role matrix says "Reviewer = review work / record review activity; Admin/Manager = configure clients" - this contradicts that. New finding, not previously flagged. |
| work_items (firm scope) | UPDATE (reassign to self) Firm Work not currently assigned to them | employeeB | **DENIED** (expected ALLOW) | You can only update work assigned to you. |
| work_items (firm scope) | UPDATE (status only, not reassigning) Firm Work not assigned to them | employeeB | **DENIED** (expected ALLOW) | You can only update work assigned to you. |
| work_activity | INSERT an activity row with actor_id set to someone ELSE (not themselves) | employeeA | **ALLOWED** (expected DENY) | inserted - NEW FINDING: work_activity_insert's WITH CHECK only verifies the caller is admin/assignee/reviewer on the work item, it never checks actor_id = auth.uid(). Any assignee/reviewer/admin can insert a work_activity row attributing an action to a DIFFERENT profile. The "immutable audit trail" (no UPDATE/DELETE policy) is only tamper-proof against edits after the fact, not against a fabricated entry at insert time. |
| submission fields/actions | UPDATE submission fields (as the item's reviewer) while status=in_progress | reviewerA | **ALLOWED** (expected DENY) | 1 row(s) - NEW FINDING: the submission-timing check lives INSIDE guard_work_item_update()'s else-branch, which role='reviewer' (matching old/new.reviewer_id) skips entirely along with every other else-branch rule. A reviewer can backfill submission fields on an item that was never actually marked ready_to_submit. This is a workflow-integrity gap, not just a permission one: the rule reads as a compliance-state guard, but it's only enforced against plain employees. |
| submission fields/actions | UPDATE submission fields (as admin) while status=in_progress | admin | **ALLOWED** (expected DENY) | 1 row(s) - same root cause as the reviewer case above: admin's branch is also "null" (skips the else-branch entirely), so this is not a separate bug, it's the same one, doubly confirmed. |
| notifications | SELECT own notifications (as a deactivated profile with a still-valid session) | inactive | **ALLOWED** (expected DENY) | 1 row(s) - notifications_read is pure auth.uid()=user_id ownership, never touched by the is_active hardening pass (20260815090000's own stated scope excludes it as "moot"). A still-valid deactivated session keeps reading its own old notifications. |
| personal_todos | SELECT own to-dos (as a deactivated profile with a still-valid session) | inactive | **ALLOWED** (expected DENY) | 1 row(s) - same gap as notifications: pure ownership check, never gated on is_active. |
| client_attention (set_client_attention RPC) | CALL as a deactivated profile with a still-valid authenticated session | inactive | **ALLOWED** (expected DENY) | succeeded - EMPIRICALLY REPRODUCES the Task 1 NULL-bypass finding: current_user_role() returns NULL for this identity, "NULL not in ('admin','reviewer')" evaluates to NULL, PL/pgSQL treats a NULL IF-condition as false, the RAISE never fires. This is the exact residual risk documented in maven_critical_finding_anon_execute_bypass.md, now proven against a real query instead of reasoned about. |
| client_credentials | CALL list_client_credentials as anonymous (no committed grant restriction) | anon | **ALLOWED** (expected DENY) | CRITICAL: no error at all - the call reached the function body. Confirms this repository's migrations, replayed fresh with no manual live patching, leave this function callable by anon. (This is separate from whether it returned useful data - see the credential-id-specific reveal test below for the full chain.) |
| client_credentials | Full anonymous chain: list then reveal a real password | anon | **ALLOWED** (expected DENY) | CRITICAL: decrypted password returned to an anonymous caller: "S3edPassword!". This is the complete, working exploit chain for the Task 1 finding, reproduced end-to-end against the committed migrations. |
| client_credentials | CALL list_client_credentials as a deactivated profile with a still-valid session | inactive | **ALLOWED** (expected DENY) | succeeded - same NULL-bypass root cause as client_attention.matrix.js, reproduced here too |
| client_credentials | CALL add_client_credential as anonymous | anon | **ALLOWED** (expected DENY) | succeeded - an anonymous caller can plant a fake credential row |
| client_credentials | CALL delete_client_credential as anonymous (nonexistent id, function-reachability check only) | anon | **ALLOWED** (expected DENY) | no error raised - the function ran to completion (a no-op delete for this id), confirming the call was reachable, not blocked at the grant layer |
| client_credentials | has_function_privilege(anon, reveal_client_credential, EXECUTE) - direct grant inspection | n/a (catalog check) | **ALLOWED** (expected DENY) | anon_can_execute = true - confirms the missing-grant-restriction finding independent of actually calling the function |
| recurring generation functions | CALL generate_period_work_for_period as anonymous | anon | **ALLOWED** (expected DENY) | CRITICAL: succeeded - no committed grant restriction on this function either, same class of finding as client_credentials. An anonymous caller can trigger bulk work-item generation for any client/period. |
| recurring generation functions | CALL generate_period_work_for_period as a deactivated profile | inactive | **ALLOWED** (expected DENY) | succeeded - same NULL-bypass root cause |
| SECURITY DEFINER function grants (catalog inspection) | EXECUTE grant to 'anon' on add_client_credential(p_client_id uuid, p_label text, p_username text, p_password text, p_notes text) | n/a (catalog check) | **ALLOWED** (expected DENY) | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| SECURITY DEFINER function grants (catalog inspection) | EXECUTE grant to 'anon' on delete_client_credential(p_id uuid) | n/a (catalog check) | **ALLOWED** (expected DENY) | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| SECURITY DEFINER function grants (catalog inspection) | EXECUTE grant to 'anon' on generate_period_work_for_period(p_period text, p_period_type text) | n/a (catalog check) | **ALLOWED** (expected DENY) | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| SECURITY DEFINER function grants (catalog inspection) | EXECUTE grant to 'anon' on list_client_credentials(p_client_id uuid) | n/a (catalog check) | **ALLOWED** (expected DENY) | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| SECURITY DEFINER function grants (catalog inspection) | EXECUTE grant to 'anon' on reveal_client_credential(p_id uuid) | n/a (catalog check) | **ALLOWED** (expected DENY) | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |

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
| SELECT client_services | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| INSERT a client_services subscription | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "client_services" |

### work_items (client scope)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own assigned item | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT a colleague's item (status=in_progress, not assigned/reviewing) | employeeA | ALLOWED | ALLOW | PASS | confirmed broad: work_items_read allows any active user to see any item whose status is not ready_for_review, regardless of assignment - not scoped to assignee/reviewer/admin the way it might look at a glance |
| SELECT a colleague's item that IS ready_for_review | employeeB | DENIED | DENY | PASS | this is the one status where visibility actually narrows to assignee/reviewer/admin |
| SELECT the item they are reviewer on, while ready_for_review | reviewerA | ALLOWED | ALLOW | PASS |  |
| UPDATE a colleague's item they are not assigned to | employeeA | DENIED | DENY | PASS | You can only update work assigned to you. |
| UPDATE own item's status (ordinary case) | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE own item: reassign to someone else | employeeA | DENIED | DENY | PASS | Only a reviewer or admin can reassign or rescope work. |
| UPDATE own item: convert Client Work to Firm Work directly | employeeA | DENIED | DENY | PASS | Only a reviewer or admin can reassign or rescope work. |
| UPDATE (as the item's reviewer): move it to a different client entirely | reviewerA | ALLOWED | DENY | FAIL | 1 row(s) - guard_work_item_update()'s reviewer branch skips ALL else-branch checks once role='reviewer' and they match old/new.reviewer_id, so a reviewer can rescope/reassign/change-client on anything they review, not just record review decisions. The V2 Permission Audit's own stated role matrix says "Reviewer = review work / record review activity; Admin/Manager = configure clients" - this contradicts that. New finding, not previously flagged. |
| SELECT any work item | anon | DENIED | DENY | PASS | 0 row(s) |

### work_items (firm scope)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT Firm Work item not assigned to them | employeeB | ALLOWED | ALLOW | PASS | work_scope=firm branch: visible to any active user regardless of assignment |
| INSERT new Firm Work, assigned to someone else | employeeB | ALLOWED | ALLOW | PASS | inserted - confirms any active teammate can create+assign Firm Work at the DB level |
| UPDATE (reassign to self) Firm Work not currently assigned to them | employeeB | DENIED | ALLOW | FAIL | You can only update work assigned to you. |
| UPDATE (status only, not reassigning) Firm Work not assigned to them | employeeB | DENIED | ALLOW | FAIL | You can only update work assigned to you. |
| UPDATE own assigned Firm Work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| SELECT any Firm Work | anon | DENIED | DENY | PASS | 0 row(s) |

### work_checklist_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT checklist for a colleague's (in_progress) item | employeeB | ALLOWED | ALLOW | PASS | same broad-read pattern as the parent work_items row |
| INSERT a checklist item on a colleague's work | employeeB | DENIED | DENY | PASS | new row violates row-level security policy for table "work_checklist_items" |
| UPDATE (toggle) checklist item on own work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| UPDATE (toggle) checklist item on a colleague's work | employeeB | DENIED | DENY | PASS | 0 row(s) - unlike SELECT, UPDATE has no "status<>ready_for_review" broad branch: only admin/assignee/reviewer can edit, matches sensible design (anyone can watch progress, only the responsible people can change it) |

### work_activity

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT activity log for a colleague's (in_progress) item | employeeB | ALLOWED | ALLOW | PASS |  |
| INSERT an activity row with actor_id set to someone ELSE (not themselves) | employeeA | ALLOWED | DENY | FAIL | inserted - NEW FINDING: work_activity_insert's WITH CHECK only verifies the caller is admin/assignee/reviewer on the work item, it never checks actor_id = auth.uid(). Any assignee/reviewer/admin can insert a work_activity row attributing an action to a DIFFERENT profile. The "immutable audit trail" (no UPDATE/DELETE policy) is only tamper-proof against edits after the fact, not against a fabricated entry at insert time. |
| UPDATE an existing activity entry | admin | DENIED | DENY | PASS | 0 row(s) - correctly immutable even for admin, no update policy exists |

### work_waiting_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT waiting items for a colleague's (in_progress) item | employeeB | ALLOWED | ALLOW | PASS |  |
| INSERT a waiting item on a colleague's work | employeeB | DENIED | DENY | PASS | new row violates row-level security policy for table "work_waiting_items" |
| UPDATE (mark received) waiting item on own work | employeeA | ALLOWED | ALLOW | PASS | 1 row(s) |
| SELECT any waiting item | anon | DENIED | DENY | PASS | 0 row(s) |

### submission fields/actions

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| UPDATE submission fields while status=in_progress (not ready_to_submit) | employeeA | DENIED | DENY | PASS | Submission can only be recorded once the work is ready to submit. |
| UPDATE submission fields (as the item's reviewer) while status=in_progress | reviewerA | ALLOWED | DENY | FAIL | 1 row(s) - NEW FINDING: the submission-timing check lives INSIDE guard_work_item_update()'s else-branch, which role='reviewer' (matching old/new.reviewer_id) skips entirely along with every other else-branch rule. A reviewer can backfill submission fields on an item that was never actually marked ready_to_submit. This is a workflow-integrity gap, not just a permission one: the rule reads as a compliance-state guard, but it's only enforced against plain employees. |
| UPDATE submission fields (as admin) while status=in_progress | admin | ALLOWED | DENY | FAIL | 1 row(s) - same root cause as the reviewer case above: admin's branch is also "null" (skips the else-branch entirely), so this is not a separate bug, it's the same one, doubly confirmed. |

### service_templates / service_template_items

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT templates list | employeeA | ALLOWED | ALLOW | PASS | needed for New Work modal template picker |
| INSERT a new template | employeeA | DENIED | DENY | PASS | new row violates row-level security policy for table "service_templates" |
| INSERT a new template | admin | ALLOWED | ALLOW | PASS | inserted |
| DELETE template checklist items | reviewerA | DENIED | DENY | PASS | 0 row(s) - admin-only |

### app_settings

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT workflow settings | employeeA | ALLOWED | ALLOW | PASS | 8 row(s) - readable, values aren't sensitive |
| UPSERT a workflow setting | reviewerA | DENIED | DENY | PASS | new row violates row-level security policy for table "app_settings" |
| SELECT workflow settings | anon | DENIED | DENY | PASS | 0 row(s) |

### notifications

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own notifications | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT a colleague's notifications | employeeB | DENIED | DENY | PASS | 0 row(s) - strict ownership |
| SELECT own notifications (as a deactivated profile with a still-valid session) | inactive | ALLOWED | DENY | FAIL | 1 row(s) - notifications_read is pure auth.uid()=user_id ownership, never touched by the is_active hardening pass (20260815090000's own stated scope excludes it as "moot"). A still-valid deactivated session keeps reading its own old notifications. |
| SELECT any notification | anon | DENIED | DENY | PASS | 0 row(s) |

### personal_todos

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT own to-dos | employeeA | ALLOWED | ALLOW | PASS |  |
| SELECT a colleague's to-dos | employeeB | DENIED | DENY | PASS | 0 row(s) |
| SELECT own to-dos (as a deactivated profile with a still-valid session) | inactive | ALLOWED | DENY | FAIL | 1 row(s) - same gap as notifications: pure ownership check, never gated on is_active. |

### client_attention (set_client_attention RPC)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| CALL as reviewer | reviewerA | ALLOWED | ALLOW | PASS | succeeded - reviewers are deliberately included per the V2 audit's stated decision |
| CALL as a plain employee (real, non-NULL role) | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL as anonymous | anon | DENIED | DENY | PASS | permission denied for function set_client_attention |
| CALL as a deactivated profile with a still-valid authenticated session | inactive | ALLOWED | DENY | FAIL | succeeded - EMPIRICALLY REPRODUCES the Task 1 NULL-bypass finding: current_user_role() returns NULL for this identity, "NULL not in ('admin','reviewer')" evaluates to NULL, PL/pgSQL treats a NULL IF-condition as false, the RAISE never fires. This is the exact residual risk documented in maven_critical_finding_anon_execute_bypass.md, now proven against a real query instead of reasoned about. |

### client_credentials

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| SELECT the table directly (even as admin) | admin | DENIED | DENY | PASS | 0 row(s) - correctly blocked, zero RLS policies means direct table access is denied for everyone, by design |
| CALL list_client_credentials as reviewer | reviewerA | ALLOWED | ALLOW | PASS |  |
| CALL list_client_credentials as a plain employee | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL list_client_credentials as anonymous (no committed grant restriction) | anon | ALLOWED | DENY | FAIL | CRITICAL: no error at all - the call reached the function body. Confirms this repository's migrations, replayed fresh with no manual live patching, leave this function callable by anon. (This is separate from whether it returned useful data - see the credential-id-specific reveal test below for the full chain.) |
| CALL reveal_client_credential as anonymous (no committed grant restriction) | anon | DENIED | DENY | PASS | Credential not found. |
| Full anonymous chain: list then reveal a real password | anon | ALLOWED | DENY | FAIL | CRITICAL: decrypted password returned to an anonymous caller: "S3edPassword!". This is the complete, working exploit chain for the Task 1 finding, reproduced end-to-end against the committed migrations. |
| CALL list_client_credentials as a deactivated profile with a still-valid session | inactive | ALLOWED | DENY | FAIL | succeeded - same NULL-bypass root cause as client_attention.matrix.js, reproduced here too |
| CALL add_client_credential as anonymous | anon | ALLOWED | DENY | FAIL | succeeded - an anonymous caller can plant a fake credential row |
| CALL delete_client_credential as anonymous (nonexistent id, function-reachability check only) | anon | ALLOWED | DENY | FAIL | no error raised - the function ran to completion (a no-op delete for this id), confirming the call was reachable, not blocked at the grant layer |
| has_function_privilege(anon, reveal_client_credential, EXECUTE) - direct grant inspection | n/a (catalog check) | ALLOWED | DENY | FAIL | anon_can_execute = true - confirms the missing-grant-restriction finding independent of actually calling the function |

### recurring generation functions

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| CALL generate_period_work_for_period as admin | admin | ALLOWED | ALLOW | PASS | succeeded, count=1 |
| CALL generate_period_work_for_period as a plain employee | employeeA | DENIED | DENY | PASS | Not authorized. |
| CALL generate_period_work_for_period as anonymous | anon | ALLOWED | DENY | FAIL | CRITICAL: succeeded - no committed grant restriction on this function either, same class of finding as client_credentials. An anonymous caller can trigger bulk work-item generation for any client/period. |
| CALL generate_period_work_for_period as a deactivated profile | inactive | ALLOWED | DENY | FAIL | succeeded - same NULL-bypass root cause |
| CALL _generate_period_work_core directly (bypassing the wrapper), even as admin | admin | DENIED | DENY | PASS | permission denied for function _generate_period_work_core |

### SECURITY DEFINER function grants (catalog inspection)

| Action | Identity | Observed | Expected | Result | Note |
|---|---|---|---|---|---|
| EXECUTE grant to 'anon' on _generate_period_work_core(p_period text, p_period_type text) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=false (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on add_client_credential(p_client_id uuid, p_label text, p_username text, p_password text, p_notes text) | n/a (catalog check) | ALLOWED | DENY | FAIL | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on current_user_active() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on current_user_role() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on delete_client_credential(p_id uuid) | n/a (catalog check) | ALLOWED | DENY | FAIL | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on generate_period_work_for_period(p_period text, p_period_type text) | n/a (catalog check) | ALLOWED | DENY | FAIL | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on guard_profile_update() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on guard_work_item_update() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on handle_new_user() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on list_client_credentials(p_client_id uuid) | n/a (catalog check) | ALLOWED | DENY | FAIL | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on log_work_item_created() | n/a (catalog check) | ALLOWED | ALLOW | PASS | informational only, not scored as a finding either way - trigger/helper function; anon_can_execute=true |
| EXECUTE grant to 'anon' on reveal_client_credential(p_id uuid) | n/a (catalog check) | ALLOWED | DENY | FAIL | privileged-action function; anon_can_execute=true, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |
| EXECUTE grant to 'anon' on set_client_attention(p_client_id uuid, p_level text, p_reason text) | n/a (catalog check) | DENIED | DENY | PASS | privileged-action function; anon_can_execute=false, authenticated_can_execute=true (cross-reference the matching matrix file for what actually happens when called) |

## How to re-run

```bash
npm run test:db
```

Regenerates this file and `docs/permission_baseline.json` from a fresh run. A future security fix should change specific rows from FAIL to PASS in the relevant area -- that diff, in version control, is the proof the task's acceptance criterion asks for: the original unauthorized action fails at the database level, provably, not just because a button disappeared from the UI.
