# Maven Work Desk — Database Source of Truth

Handbook Task 1. Answers: does `supabase/migrations/` accurately represent
what is actually live? Written by replaying all 16 migration files in
filename (chronological) order and recording the resulting expected state.

**LIVE PARITY = PARTIALLY VERIFIED.** This environment has no direct or
programmatic access to the live Supabase database — no service-role key,
no CLI project link, no credentials. Every interaction with the live
database this project has ever had was the owner pasting SQL into the
Supabase SQL editor and reporting the result back. The owner ran
`supabase/verify_live_schema.sql`'s §0 and the consolidated RLS/functions/
extensions/cron query against production on 2026-08-14 — those results
are folded into §0 and §3 below as confirmed, classified drift. Table
columns/constraints/indexes/triggers/table-grants (script sections 2–5,
8, 11) were not yet run live — see §5 for what's left.

**UPDATE, Handbook Task 9 (2026-08-15): the finding in §0 below is now
FIXED as a committed migration** (`20260821090000_offboarding_revokes_
business_access.sql`) — both the anon-grant path and the underlying
NULL-unsafe logic bug, across all six affected functions. §0 is kept
as-written below as the historical record of the original finding and
reasoning (per this project's "don't delete historical evidence"
convention) — see [SECURITY_MODEL.md](SECURITY_MODEL.md) ("Fixed bug
class") and [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) (zero
outstanding findings) for the current, resolved state.

## 0. Highest-priority finding — check this first

Six `SECURITY DEFINER` functions authorize callers with this pattern:

```sql
if public.current_user_role() not in ('admin', 'reviewer') then
  raise exception 'Not authorized.';
end if;
```

`current_user_role()` returns SQL `NULL` for any caller with no matching
*active* profile row — including a genuinely anonymous caller (no login
at all: `auth.uid()` is `NULL`, so `id = auth.uid()` matches zero rows).
`NULL NOT IN ('admin', 'reviewer')` evaluates to `NULL`, not `TRUE`. In
PL/pgSQL, `IF <null-condition> THEN ... END IF` treats a `NULL` condition
identically to `FALSE` — the `THEN` branch is skipped, so `raise
exception` never fires, and the function body continues to run with full
`SECURITY DEFINER` privileges.

This differs from how RLS policies behave: a `NULL` `USING`/`WITH CHECK`
expression correctly excludes the row (RLS is fail-closed on `NULL`).
This bug is specific to the *inverted* `IF NOT (...) THEN RAISE` idiom
used inside plain PL/pgSQL functions, not a general property of anything
else in this schema. `guard_work_item_update()` and `guard_profile_update()`
use a *positive*-listing pattern (`if role = 'admin' then ... elsif role =
'reviewer' and ... then ... else <restrictive>`) which falls through to
its restrictive `else` branch on `NULL` — that pattern is safe.

Grants determine how exploitable this actually is. Checked directly
against migration text (`grep`-verified, not assumed):

| Function | Explicit `REVOKE`/`GRANT` in repo? | Anonymous-reachable if live matches repo? |
|---|---|---|
| `add_client_credential` | **None found** — relies on Postgres's default `EXECUTE ... TO PUBLIC` | **Yes** — critical, this table has zero RLS policies of its own |
| `list_client_credentials` | **None found** | **Yes** — critical (returns credential labels/usernames/notes) |
| `reveal_client_credential` | **None found** | **Yes** — critical (decrypts and returns a plaintext password) |
| `delete_client_credential` | **None found** | **Yes** — critical |
| `generate_period_work_for_period` | **None found** | **Yes** — moderate (creates work items, no data leak, but unauthorized writes) |
| `_generate_period_work_core` | `revoke execute ... from public, anon, authenticated` (20260811091000, line 167) | No — correctly locked; only reachable through the wrapper above, which has its own separate problem |
| `set_client_attention` | `revoke ... from public, anon` + `grant ... to authenticated` (20260814090000, lines 59–60) | No for anonymous callers — already grant-restricted. **Residual risk**: an `authenticated` caller whose profile was deactivated keeps a valid Supabase session until it separately expires (documented in 20260815090000's own header comment) — for that narrow window, this same `NOT IN`/`NULL` bug still bypasses the check for a deactivated user specifically, same as the four credential functions and the generation wrapper would for *any* caller once anon is blocked. |

`client_credentials` has **zero RLS policies by design** (documented
intentionally in `20260811090700_client_credentials.sql`: "even a leaked
anon key can't read this table directly, only through a function that
decrypts exactly what it's asked for") — meaning if the anonymous-execute
path is live, these four functions are the *entire* protection for every
client's stored portal password, and that protection does not hold.

**CONFIRMED LIVE and MITIGATED, 2026-08-14.** The owner ran the
grant-revoke mitigation, then ran `verify_live_schema.sql` section 0
directly against production. Live result:

| Function | anon_can_execute | authenticated_can_execute |
|---|---|---|
| `add_client_credential` | false | true |
| `list_client_credentials` | false | true |
| `reveal_client_credential` | false | true |
| `delete_client_credential` | false | true |
| `generate_period_work_for_period` | false | true |
| `set_client_attention` | false | true |
| `_generate_period_work_core` | false | false |

The anonymous-execute path is closed. This does **not** mean the root
cause is fixed — the `NOT IN`/`NULL` bug in these six functions' own
logic is unchanged; only the grant-level door is now shut. A deactivated
profile's still-valid `authenticated`-role session (per
`20260815090000`'s own documented caveat: deactivation alone does not
revoke an outstanding Supabase Auth session) still trips the same bypass
for these six functions specifically, the same residual risk
`set_client_attention` already carried before this fix. The root-cause
fix (`coalesce(current_user_role(), '') not in (...)`, or an equivalent
NULL-safe rewrite) is left for Task 10 ("Credential + secret hardening"),
to ship as a real tested migration.

## 1. Provenance: which migrations are original vs. reconstructed

Not all 16 files carry the same evidentiary weight. Several tables were
stood up manually in the Supabase SQL editor *before* this repository
tracked SQL at all — their migration files are documented, best-effort
**reconstructions** written afterward from the frontend's actual
read/write behavior, not the original scripts that were run. This is
stated directly in their own header comments:

- `20260811090100_profiles.sql` — "this table predates the rest of the
  schema in this migrations/ folder... The RLS policies and trigger below
  are a faithful reconstruction of confirmed, tested behavior."
- `20260811090200_clients.sql` — "Same provenance note as profiles."
- `20260811090500_work_item_children.sql` (covers `work_checklist_items`,
  `work_comments`, `work_waiting_items`, `work_activity`) — same caveat;
  its insert policy is explicitly named `_write` not `_insert` "to match
  the live policy name."
- `20260811090600_client_services.sql` — same caveat, same `_write`
  vs. `_insert` naming note.
- `20260815090000_v2_permission_audit.sql` confirms the full list of
  affected tables in one place: **profiles, clients,
  work_checklist_items, work_comments, work_waiting_items, work_activity,
  client_services** — and states plainly that a prior task already hit a
  real name mismatch (`client_services`' insert policy is actually named
  `_write`, not `_insert`, as first reconstructed).

Practical consequence for verification: for these seven tables, **do not
compare policy names** between live and repo — compare the `using`/`with
check` expression text (`verify_live_schema.sql` section 6 selects `qual`
and `with_check` directly for this reason). A name mismatch on one of
these seven tables is expected and not itself drift; a *logic* mismatch
is.

The remaining nine tables (`service_templates`, `service_template_items`,
`work_items`, `client_credentials`, `personal_todos`, `app_settings`,
`notifications` — added via `20260813100000` — plus the two Task
13/17/18/Firm-Work additions layered on top) were created *by* a
migration file tracked in this repo from the start, so their file is the
original source, not a reconstruction.

## 2. Expected schema, as of migration `20260830090000` (last applied)

### Tables (18)

| Table | Origin | RLS | Notable columns added by later migrations |
|---|---|---|---|
| `profiles` | reconstructed | enabled | — |
| `clients` | reconstructed | enabled | `attention_level`, `attention_reason`, `attention_set_by`, `attention_set_at` (20260814090000) |
| `service_templates` | original (20260811090300) | enabled | `is_active` (20260813100000-era Task 13); `requires_review` boolean default `true` (20260820090000); `requires_external_deadline` boolean default `false` (20260824090000, Task 12) — `filing_deadline_day` legacy/no longer read as of the same migration, see §2 note below |
| `service_template_items` | original | enabled | `is_required` (Task 13) |
| `work_items` | original (20260811090400) | enabled | `submission_*` fields, `completed_at`, `submitted_at/by`, `created_by` (later Task 13-era additions); `work_scope`, `firm_category` + scope-conditional checks (20260816090000); `client_id` NOT NULL dropped (20260816090000); `review_required` boolean default `true`, `status_override_reason` text (write-only, always reset to `NULL`) (20260820090000); `period_type`, `period_start_date`, `period_end_date` (20260823090000, Task 11) — nullable, additive only; NULL on every row generated before this migration (intentionally not backfilled, see the migration's own header); `project_id`, `next_action`, `blocker_reason` (20260826090000, Task 15) — Firm Work only, see §2 note below |
| `work_checklist_items` | reconstructed (bundled in 20260811090500) | enabled | `is_required` (Task 13) |
| `work_comments` | reconstructed (bundled in 20260811090500) | enabled | — |
| `work_waiting_items` | reconstructed (bundled in 20260811090500) | enabled | `requested_by`, `follow_up_date`, `last_followed_up_at`, `follow_up_count`, `note` (added across the Waiting-checklist work, pre-handbook) |
| `work_activity` | reconstructed (bundled in 20260811090500) | enabled | `source` text, `'system'`\|`'client'`, default `'system'` (20260819090000) |
| `client_services` | reconstructed (20260811090600) | enabled | `start_period`, `end_period` (Task 12-era, free-text/documentation only, never compared); `start_date`, `end_date` (20260825090000, Task 13) — explicit Gregorian, DB-enforced bounds on generation eligibility |
| `client_credentials` | original (20260811090700) | enabled, **zero policies** | — |
| `personal_todos` | original (20260811090800) | enabled | — |
| `app_settings` | original (20260811090900) | enabled | `app_settings_insert_admin` policy (Task 18) |
| `notifications` | original (20260813100000) | enabled | — |
| `deadline_rules` | original (20260824090000, Task 12) | enabled, **no insert/update/delete policy** | Governed replacement for `service_templates.filing_deadline_day` — every write goes through `add_deadline_rule()`, see [FINANCE_RULE_GOVERNANCE.md](FINANCE_RULE_GOVERNANCE.md) |
| `projects` | original (20260826090000, Task 15) | enabled, **no delete policy** | Lightweight Firm Work groupings (id, name, description, status active/archived) — read/insert/update open to any active teammate; archiving is the intended retirement path, no delete offered. Handbook Task 19 ("Projects/Initiatives") should re-verify this table's current state before assuming it still needs building from scratch. |

Full column-by-column, constraint-by-constraint detail is intentionally
not duplicated here — it is fully recoverable by reading the 16 migration
files in order, and `verify_live_schema.sql` section 2–4 pulls the live
equivalent directly from `information_schema`. Restating both by hand
here would just create a third copy that can drift from either.

### RLS pattern, current state (post `20260815090000`, `20260816090000`,
and `20260817090000` — Handbook Task 5)

Two `SECURITY DEFINER` functions gate almost everything:

```sql
current_user_role()   -- returns role, or NULL if no active profile matches auth.uid()
current_user_active()  -- returns is_active (false if no profile row), coalesced to false
```

Every admin/reviewer-gated policy checks `current_user_role() = 'admin'`
(or `in ('admin','reviewer')`). Every "any active team member" read/write
policy checks `current_user_active()`. `work_items` additionally OR's in
`work_scope = 'firm'` so Firm Work is visible/writable to any active
teammate regardless of the client-work-specific assignee/reviewer
predicate.

**Updated by Task 5** (`20260817090000_client_work_select_visibility.sql`):
`work_items_read`/`work_items_update` and all four child tables'
`*_read` policies (`work_checklist_items`, `work_comments`,
`work_waiting_items`, `work_activity`) no longer have a
`status <> 'ready_for_review'` broad-fallback branch — that clause was
the actual mechanism letting any active employee read any client-scope
work item (and its checklist/comments/activity/waiting rows) regardless
of assignment, as long as it wasn't currently `ready_for_review`; see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) for the confirmed
before/after evidence. The four child tables' `work_scope = 'firm'`
compatibility is now handled by an explicit branch inside each one's
`exists (select 1 from work_items w where ... and (w.work_scope='firm'
or ...))` subquery, mirroring `work_items_read` directly, rather than
depending on Firm Work's distinct `'review'` status value to
incidentally satisfy the old broad clause (which is now gone). Current
client-scope read rule, uniformly across every status including
`ready_for_review`: `admin`, OR `assignee_id = auth.uid()`, OR
`reviewer_id = auth.uid()`. `TO authenticated` was also added explicitly
to all five policies (a `NULL`/anon caller is now excluded by role match
before the `USING` clause is even evaluated, not just by it evaluating
false) and a `work_items_reviewer_id_idx` index was added to match the
long-standing `work_items_assignee_id_idx`, since both columns are now
used identically in these policies.

**Updated by Task 7** (`20260819090000_trustworthy_activity_audit.sql`):
`work_activity_insert` no longer permits a client to insert any action
value it likes with any actor it likes — the `WITH CHECK` now requires
`source = 'client'`, `actor_id = auth.uid()`, and `action` to be one of
exactly `checklist_toggled`/`waiting_item_toggled`/`follow_up_recorded`
(the only actions this app still legitimately logs from the client;
every work_items-level system event — status, submission, assignment,
due-date — is inserted only by `guard_work_item_update()` itself, which
bypasses RLS as a table-owner/`SECURITY DEFINER` action). No
`UPDATE`/`DELETE` policy exists on `work_activity`, unchanged.

**Updated by Task 9** (`20260821090000_offboarding_revokes_business_
access.sql`): `personal_todos` and `notifications` were originally left
on pure ownership-only policies (`auth.uid() = user_id`) by the V2
Permission Audit (`20260815090000`), on the reasoning that ownership
already made the `is_active` gap "moot." That reasoning missed that
ownership and active status are orthogonal — a deactivated user still
owns their old rows. All seven policies across both tables
(`notifications_read`/`insert`/`update`,
`personal_todos_select_own`/`insert_own`/`update_own`/`delete_own`) now
also require `current_user_active()`, closing the gap for real. See
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) — zero outstanding
findings as of Task 9.

### Functions (all `public` schema unless noted)

| Function | Security | search_path | Purpose |
|---|---|---|---|
| `current_user_role()` | DEFINER, `sql`, stable | `public` | role, or NULL if inactive/no profile |
| `current_user_active()` | DEFINER, `sql`, stable | `public` | is_active, coalesced false |
| `handle_new_user()` | DEFINER, trigger | `public` | creates a profile row on `auth.users` insert |
| `guard_profile_update()` | DEFINER, trigger | `public` | blocks non-admins changing `role`/`is_active` (NULL-safe: positive-list pattern, but see §0 residual note — RLS is the real gate here anyway) |
| `guard_work_item_update()` | DEFINER, trigger | `public` | core business-rule enforcement on status/field transitions; NULL-safe (positive-list pattern). Rewritten by Handbook Task 6 (`20260818090000`) — branches on `work_scope` before any Client-Work role logic, reviewer no longer skips reassign/rescope/submission-timing checks, `work_scope`/`id`/`created_at`/`created_by` immutable. Extended by Task 7 (`20260819090000`) — logs `status_changed`/`submission_status_changed` to `work_activity` unconditionally, forces `submitted_by` from `auth.uid()`. Extended again by Task 8 (`20260820090000`) — adds the Client Work valid-transition map + required-checklist gates (preparation/review/submission stages) + the admin-only, reason-required, permanently-logged override path (`status_override_reason` → `work_activity` action `status_override`). Firm Work is exempt from all of this (unchanged 5-status model). Task 16 (`20260827090000`) adds one check to the firm branch: on reassignment (`assignee_id` actually changing), the new assignee must be an active profile. Task 17 (`20260828090000`) adds one more: transitioning `status` INTO `'blocked'` (not merely being blocked already) requires `blocker_reason` to be at least 10 characters — scoped to the transition moment specifically so a historical row that predates this rule is never locked out of routine editing. Task 18 (`20260829090000`) adds one more unconditional activity-logging block: `project_id` changes now log `project_changed` (old → new project name) to `work_activity`, closing the one field Task 15 added that was never logged. |
| `log_work_item_created()` | DEFINER, trigger | `public` | writes the initial `work_activity` row |
| `set_work_item_created_by()` | DEFINER, trigger (`BEFORE INSERT` on `work_items`) | `public` | Task 7 — forces `created_by := auth.uid()`, never trusts client-supplied `created_by`. Task 16 (`20260827090000`) adds: for `work_scope = 'firm'`, `assignee_id` must be an active profile at creation time too. |
| `work_item_status_label(text)` | invoker, `sql`, immutable | n/a | Task 7 — maps a status enum value to its human label (mirrors `staff.js`'s `STATUS_LABELS`) for readable `work_activity` detail text |
| `_generate_period_work_core(period, period_type, period_start, period_end)` | DEFINER, plpgsql | `public` | actual generation logic; explicitly revoked from public/anon/authenticated. Task 8 added `requires_submission`/`requires_review` copy-through from the template. Task 11 (`20260823090000`) added the two new required date params — `month_start`/`month_end` for `filing_deadline_day`/`internal_offset_days` now derive from `period_end`, never from `current_date` (the bug this task existed to fix) — and both are validated non-null with `period_end >= period_start` before anything else runs. Task 12 (`20260824090000`, signature unchanged) left-joins the active `deadline_rules` row per template instead of reading `service_templates.filing_deadline_day` directly — no active rule means `external_due_date` stays `NULL`, never a guess. Task 13 (`20260825090000`, signature unchanged) adds `client_services.start_date`/`end_date` window filtering to the eligibility `WHERE`; fixes `created_by` to `auth.uid()` (the real caller) instead of the arbitrary assignee-fallback admin; skips (not crashes on) a service with neither its own assignee nor any active admin to fall back to. |
| `add_client_credential`, `list_client_credentials`, `reveal_client_credential`, `delete_client_credential` | DEFINER, plpgsql | `public` (+`extensions` for the two that call pgcrypto) | NULL-safe + grant-restricted to `authenticated` as of Task 9 (see [SECURITY_MODEL.md](SECURITY_MODEL.md) "Fixed bug class"); `add_client_credential`/`reveal_client_credential` additionally Vault-backed as of Task 10 (see [SECURITY_MODEL.md](SECURITY_MODEL.md) "Secret setup, rotation, and recovery") |
| `generate_period_work_for_period(period, period_type, period_start, period_end)` | DEFINER, plpgsql | `public` | public wrapper; NULL-safe + grant-restricted to `authenticated` as of Task 9; new required date params as of Task 11, see above |
| `add_deadline_rule(service_template_id, financial_year_label, effective_from, effective_to, filing_deadline_day, source_title, source_url, source_reference, source_page_section, verified_date)` | DEFINER, plpgsql | `public` | Task 12 (`20260824090000`) — admin-only (stricter than the admin/reviewer pattern elsewhere, deliberately, for legal-deadline governance); the ONLY way any row enters/changes in `deadline_rules` (the table itself has no insert/update policy); atomically supersedes whatever rule was active for the template, then inserts the new one; rejects missing `source_title`/`verified_date`/out-of-range `filing_deadline_day`; `verified_by` forced from `auth.uid()`, never client-supplied. Grant-restricted to `authenticated`, anon-revoked, from its own original migration (no live-drift risk the way the older six functions had from Task 1). See [FINANCE_RULE_GOVERNANCE.md](FINANCE_RULE_GOVERNANCE.md). |
| `set_client_attention(client_id, level, reason)` | DEFINER, plpgsql | `public` | see §0 — NOT NULL-safe, but grant-restricted to `authenticated` |
| `pg_temp.drop_policies_for(table, cmd)` | invoker, plpgsql | n/a | migration-time helper only, session-temporary, not part of live schema after the migration finishes |

### Extensions

- `pgcrypto` — installed into the `extensions` schema (not `public`);
  every function calling `pgp_sym_encrypt`/`pgp_sym_decrypt` must include
  `extensions` in its own `search_path` or the call fails. Confirmed this
  was hit once historically per the extension migration's own comment.
- `supabase_vault` — confirmed already installed on this project (seen in
  the live extension list captured during Task 3's harness runs), not
  added by any migration in this repo. Backs `vault.secrets` /
  `vault.decrypted_secrets`, used as of Task 10 to store the
  `client_credentials` encryption passphrase outside Git and outside the
  browser — see "`client_credentials` secret handling" above and
  [SECURITY_MODEL.md](SECURITY_MODEL.md).
- `pg_cron` — installed, but its originally-described daily
  "generate work for the current period" job was later unscheduled
  (`perform cron.unschedule('generate-period-work-daily')` in
  `20260811091000_recurring_work_generation.sql`) in favor of an
  on-Work-Desk-open check from `staff.js`. The extension stays installed
  for potential future use; the daily schedule does not exist anymore.
  **Drift risk**: if the live project still has an active cron job by
  this name (e.g. if that specific `DO $$ ... unschedule ... $$` block
  was somehow never run live), generation would double-fire — harmless
  today only because `_generate_period_work_core` is idempotent via
  `ON CONFLICT DO NOTHING`, not because a stray schedule would be
  harmless in general. `verify_live_schema.sql` section 10 checks this.

### `client_credentials` secret handling (Handbook Task 10)

As of `20260822090000_credential_vault_hardening.sql`, the two functions
that touch plaintext (`add_client_credential`, `reveal_client_credential`)
no longer contain any passphrase literal at all. Each looks up
`decrypted_secret` from `vault.decrypted_secrets` (Supabase Vault, the
`supabase_vault` extension — confirmed already installed on this project)
by the fixed name `client_credentials_passphrase`, at call time, and
`RAISE EXCEPTION`s a specific, clear message if that secret is missing or
empty — no fallback to a placeholder or default. The previously-committed
literal, `'REPLACE_WITH_SECRET_PASSPHRASE'`, is gone from both function
bodies as of this migration; it remains, harmlessly, inside the original
`20260811090700_client_credentials.sql` migration's history (Postgres
replays every migration file in order — the `create or replace function`
in `20260822090000` is simply what's live now). The real secret value
itself is never committed anywhere in this repository — see
[SECURITY_MODEL.md](SECURITY_MODEL.md) "Secret setup, rotation, and
recovery" for the one-time `vault.create_secret(...)` setup step an admin
must run directly in the Supabase SQL editor.

### Recurring generation: requested period drives due dates (Handbook Task 11)

Before `20260823090000_normalize_generation_periods.sql`,
`_generate_period_work_core`'s `month_start`/`month_end` (the basis for
`filing_deadline_day`/`internal_offset_days` calculation) came from
`date_trunc('month', current_date)` — the day generation happened to run
on, completely independent of `p_period`, the period label actually
requested. Generating a backfill for a past period, or a future period
ahead of schedule, silently computed due dates from today's Gregorian
month instead of the requested one. As of this migration,
`_generate_period_work_core`/`generate_period_work_for_period` both
require two new parameters, `p_period_start`/`p_period_end` (Gregorian
`date`, non-null, `end >= start`, enforced by `RAISE EXCEPTION` if
violated) — `month_start`/`month_end` now derive from `p_period_end`.
This is deliberately NOT a Bikram Sambat→Gregorian conversion formula
(no owner-approved BS calendar table exists in this project, and
guessing one for legally significant filing dates is exactly the risk
this task exists to close) — the Gregorian range is an explicit period
record a human provides, same as the period label itself always was.
`work_items.period_type`/`period_start_date`/`period_end_date` (new,
nullable columns) record that range on each generated row going forward;
every row generated before this migration keeps `period` (its free-text
label) as its only period information — NULL on the three new columns is
intentional, not a gap to backfill (see the migration's own header for
why a template-recurrence-based backfill was considered and rejected).

### Deadline governance: `deadline_rules` replaces a bare integer (Handbook Task 12)

Full detail in [FINANCE_RULE_GOVERNANCE.md](FINANCE_RULE_GOVERNANCE.md);
summarized here for the schema record. `service_templates.
filing_deadline_day` is legacy as of `20260824090000_deadline_governance.sql`
— `_generate_period_work_core` no longer reads it. The governed
replacement, `deadline_rules`, holds at most one `active` row per
`service_template_id` (partial unique index), each requiring a
`source_title` and `verified_date` and stamping `verified_by` from
`auth.uid()` — enforced by `add_deadline_rule()`, the only function
permitted to write to the table at all (zero insert/update policy,
same defense-in-depth pattern as `client_credentials`). A template
flagged `requires_external_deadline` with no active rule generates work
with `external_due_date` left `NULL`, not a guess. This migration's own
one-time backfill (`update service_templates set
requires_external_deadline = true where filing_deadline_day is not
null`) sets the CATEGORY flag from existing data — it does not fabricate
or carry forward any date value, and does not insert any `deadline_rules`
row; every template that previously had a `filing_deadline_day` value
generates with an unset external deadline, flagged for verification,
until an admin enters a real, sourced rule live.

### Client-service effective periods and creator-vs-assignee (Handbook Task 13)

`client_services.start_period`/`end_period` had existed since before the
handbook (free-text, e.g. "Shrawan 2083") but, per that migration's own
comment, were "NOT compared against the period being generated" — a
service configured with a start/end period label would still generate
work for ANY requested period, before its start or after its end,
because nothing ever checked. `20260825090000_client_service_effective_
periods.sql` adds `start_date`/`end_date` (Gregorian, explicit, optional
— same "keep the label, add an explicit Gregorian value" principle as
Tasks 11/12) and `_generate_period_work_core`'s eligibility `WHERE` now
requires the service's window to overlap the requested period's own
range: `(start_date is null or start_date <= period_end) and (end_date is
null or end_date >= period_start)`. `NULL` on either bound (every
pre-Task-13 row) means unrestricted, matching prior behavior exactly for
anyone who hasn't set them.

Separately, verified by reading: `created_by` on every generated
`work_items` row had always been `fallback_admin` — an arbitrary
(unordered `LIMIT 1`), non-deterministic active admin selected only
because `assignee_id` is `NOT NULL` and a service might have none
configured. That fallback is legitimate for `assignee_id`; reusing it for
`created_by` recorded whichever admin the query planner happened to pick
as having "created" work they may have never triggered. Fixed to
`auth.uid()` — the real caller, guaranteed non-null by
`generate_period_work_for_period`'s own admin/reviewer authorization
check running first. A service with neither its own `assignee_id` nor
any active admin to fall back to now safely skips (no insert, no
constraint-violation crash aborting the rest of the batch) rather than
hitting `work_items.assignee_id`'s `NOT NULL` constraint mid-loop.

Unchanged, re-verified rather than re-implemented: `work_items_client_
service_period_unique` + `ON CONFLICT DO NOTHING` was already the real,
DB-level (not frontend-only) uniqueness guarantee, and already correct
under genuine concurrent execution — proven directly in this task's test
matrix via two separately-committed transactions on independent
connections, not just two sequential calls in one transaction. Editing a
`service_templates`/`client_services` row was already structurally
incapable of rewriting an existing `work_items` row (generation only
ever `INSERT`s; no `UPDATE` path touches historical rows) — also
unchanged, now covered by an explicit test rather than left assumed.

### Firm Work: projects/initiatives and async fields (Handbook Task 15)

Verified first, not assumed: of the approved Firm Work model's required
fields (title, firm_category, assignee_id-as-owner, status), all four
already existed and were already wired into the Firm Work UI before this
task. Of the optional fields, several also already worked with zero
schema change — `internal_due_date` (Firm Work's single "Due Date"),
`priority`, `description`, and `work_checklist_items`/`work_comments`/
`work_activity` (all three already had a `work_scope = 'firm'` branch in
their read policies, added by `20260817090000`). `20260826090000_firm_
work_projects_and_async_fields.sql` adds exactly the three genuinely
missing pieces: the `projects` table (see above), and `work_items.
project_id`/`next_action`/`blocker_reason` — all nullable, all Firm Work
only.

`work_items_scope_fields_check` (originally Task 6) is extended, not
replaced in spirit: the client branch now also requires `project_id`/
`next_action`/`blocker_reason` to be `NULL` (symmetric with how the firm
branch has always required `client_id`/`period`/etc. to be `NULL`). While
touching this constraint, also closed a latent gap: `period_type`/
`period_start_date`/`period_end_date` (Task 11) were added to
`work_items` without ever being added to this constraint's firm-branch
exclusion list — no live code path has ever set them on a `work_scope =
'firm'` row (`_generate_period_work_core` hardcodes `'client'`, and no
edit UI exposes these fields at all), but the constraint itself didn't
prevent it. Added `NOT VALID` (not assumed clean, given this
environment's standing inability to directly inspect live drift) — still
fully enforced for every new write, only the retroactive check of
existing rows is deferred. See the migration's own header for the
verification query to run live before an optional `VALIDATE CONSTRAINT`.

### Firm Work: closing the peer-permission gaps (Handbook Task 16)

`guard_work_item_update()` already implemented most of the approved
peer model correctly as of Task 6 — an active caller of any role can
already update any field on any Firm Work item, and `work_scope` itself
has been universally immutable (checked first, before any role dispatch,
applies even to admin) since the same task. `20260827090000_firm_work_
peer_permissions.sql` closes the two gaps actually found by reading, not
assumed: `work_checklist_items`'s `INSERT`/`UPDATE` policies (last
touched by a pre-Firm-Work migration, `20260815090000`) had no
`work_scope = 'firm'` branch at all — only admin/current-assignee/
reviewer could write, contradicting "manage its checklist" for any other
active peer — fixed by adding the same branch the read policy already
had. And nothing previously stopped assigning Firm Work to a
**deactivated** profile (the UI's owner picker filtering to active
profiles was a convenience, not a boundary) — fixed with an active-
profile check added to both `set_work_item_created_by()` (creation) and
`guard_work_item_update()`'s firm branch (reassignment only — an
already-assigned person who is deactivated *later* doesn't retroactively
lock the item from further edits, only *new* assignment attempts
targeting an inactive profile are rejected).

Also fixed, UI only: `staff/staff.js`'s `openFirmWorkModal` still gated
every field (including the owner picker) to `isAdmin() || isMine`,
a leftover from before Task 6's DB-layer fix that was flagged but never
closed — see [ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md)'s Task 16
note for detail. No RLS/trigger change was needed for this half; the
database was already correct.

### Firm Work list/create/edit experience (Handbook Task 17)

Verified first: most of what this task asks for already existed
(Task 15/16) — title/category/owner/project/target date/priority/
status/description/next_action/blocker_reason/checklist all already
wired into `openFirmWorkModal`; the list already showed title/category/
project/owner/status/due date/priority; filters already covered owner/
category/project/status/priority/due date; search already used a
server-side `ilike` query, not a client-side download-then-filter. Two
concrete VALIDATION gaps remained, both closed by `20260828090000_firm_
work_form_validation.sql`:

1. Category was optional; this task's own required-fields list makes it
   required for Firm Work. Added as a `work_items_firm_category_
   required_check` constraint, `NOT VALID` (same standing caution about
   unverifiable live drift as every other new constraint this session —
   the check still fully applies to every new write).
2. Nothing required `blocker_reason` when a Firm Work item's status
   becomes `'blocked'`. Added to `guard_work_item_update()`'s firm
   branch — deliberately a TRIGGER check (not a plain `CHECK`
   constraint, which can't see `OLD`), and deliberately scoped to only
   the moment of transitioning INTO `'blocked'` (`old.status is distinct
   from 'blocked'`), not to every future edit of an already-Blocked row.
   A plain `CHECK` constraint would have re-validated the entire row on
   every subsequent UPDATE, silently locking any historical Blocked item
   without context out of routine editing — exactly the "don't corrupt
   existing records" mistake this project's migrations consistently
   avoid. See the migration's own header for the full reasoning.

Also found and fixed, UI only, via an actual browser measurement (not
assumed): the Firm Work filter row's two native `type="date"` inputs
side by side overflowed a 375px viewport by 26px — `flex-wrap` added to
that one row lets them stack instead of forcing the page wider. New
browser test infrastructure,
[tests/ui/support/mock-supabase.js](../tests/ui/support/mock-supabase.js),
intercepts the real `@supabase/supabase-js` bundle's network calls (the
same file `dist/staff/supabase.js` ships) with fixture data — this is
what caught both the mobile-overflow bug and a `.single()` response-
shape mismatch in the mock itself, neither of which the DB permission
harness alone could have found, since that harness never renders a
browser at all.

### Firm Work async handoff (Handbook Task 18)

Verified first: title/category/project/owner/status/priority/target
date/next_action/blocker_reason/description/checklist/updates/activity
already existed and were already stored (Task 15/16/17) — the gap this
task closes is mostly SURFACING them properly, not new storage. Three
real schema gaps closed by `20260829090000_firm_work_detail_handoff.sql`:

1. `work_comments.update_type` — a new nullable column, checked against
   exactly `progress`/`result`/`blocker`/`handoff`/`note`. Deliberately
   NOT a Decision Needed / Owner Approval hierarchy — the owner rejected
   that shape in an earlier task, and the DB check constraint (not just
   the UI's `<select>`) enforces it can't sneak back in.
2. `work_items.follow_up_date` — previously constrained to client scope
   only (`work_items_scope_fields_check`'s firm branch required it
   `NULL`, built for Client Work's "waiting for client" callback date).
   Relaxed to allow Firm Work too, reusing the same column rather than
   adding a fourth near-duplicate date field — `waiting_since`/
   `waiting_requested_by` stay firm-`NULL` since those are specifically
   "waiting on someone outside the firm" semantics that don't apply to
   Firm Work's peer model. This is a pure relaxation of an existing NULL
   requirement, so (unlike this project's usual NOT VALID caution around
   brand-new restrictions) no follow-up validate step is needed — nothing
   that satisfied the old constraint can ever violate the relaxed one.
3. `guard_work_item_update()` — one more unconditional activity-logging
   block added (`project_changed`, logging old → new project name),
   closing the one gap in Task 18's own "HISTORY" requirement
   ("Reassignment/status/project/target changes must show old -> new").
   `project_id` was added by Task 15 but never logged until now.

UI: `staff/staff.js`'s Firm Work item view moved from a modal
(`openFirmWorkModal`, now create-only) to a dedicated page
(`renderFirmWorkDetail`, route `#firmwork/<id>`), mirroring Client Work's
`renderWorkDetail` page pattern but firm-scope-only (Client Work's page
assumes `client_id`/`service_template_id`/submission/waiting-for-client
fields throughout, none of which apply to Firm Work). Top summary shows
every field this task lists (including `updated_at` as "Last Updated");
Next Action is inline-editable right in the summary (not buried in an
edit modal); a Blocked status reveals a Blocker Context box requiring a
real reason (reusing Task 17's DB rule) with an optional follow-up date.
Reassignment/title/category/priority/due date/description/project moved
to a smaller "Edit Basics" modal.

Building the direct-link route (`#firmwork/<id>`, reachable by bookmark
or shared link — itself part of what "asynchronous handoff" means)
surfaced a real, previously-latent race: several `render*Page` functions
(`renderTodayPage`, `renderManagerDashboard`, `renderDeadlinesPage`,
`renderPeriodSummaryPage`, and `renderSearchPage`) removed their own
"Loading…" placeholder with a bare `main.removeChild(loading)` after an
`await`; if a hash navigation (a bookmarked link opened right after
login, before the default view's initial fetch resolves) lands in
between, a newer render can already have cleared `#main`, and the older
render's `removeChild` then throws `"Failed to execute 'removeChild' ...
not a child of this node"` — caught by a Playwright test that navigates
straight to a Firm Work detail link immediately post-login and asserts
zero console errors. Fixed by guarding all five sites with `if
(loading.parentNode) loading.parentNode.removeChild(loading)` instead of
an unguarded `main.removeChild(loading)` — a plain safety guard, not a
behavior change, in every non-race case.

### Projects / Initiatives management (Handbook Task 19)

Verified first: the `projects` table, its RLS (open to any active
teammate for read/insert/update, no delete — Task 15), Firm Work's
project filter/column/picker (Task 15/17), and the create/edit modals'
inline "+ New Project" quick-create all already shipped. One real gap
against this task's own requirements: "every material project edit
should be attributable" — only the *original* creator (`created_by`) was
ever tracked, nothing recorded who most recently renamed or archived a
project. `20260830090000_projects_management.sql` adds `projects.
updated_by`, auto-set (alongside `updated_at`) by a new `BEFORE UPDATE`
trigger — never trusted from the client, same convention as every other
provenance column in this schema. The same trigger also pins `id`/
`created_by`/`created_at` immutable on UPDATE, mirroring `guard_work_
item_update()`'s own immutability rule.

Everything else this task asked for was UI-only, in `staff/staff.js`:
- **Projects management modal** (`openProjectsModal`) — list all
  projects (active first, then archived), inline rename, inline
  Archive/Reactivate (the column already supported both directions;
  offering only one-way archiving would have been a dead end for a
  mistaken click), and the same "+ New Project" quick-create pattern.
- **Project Detail modal** (`openProjectDetailModal`) — active/completed
  Firm Work counts plus the actual items, each clickable straight into
  its own Firm Work Detail page (Task 18). Reachable from the Projects
  modal and from a new clickable "Project" value on the Firm Work Detail
  page's own top summary — a small cross-link tying Task 18 and 19
  together.
- **Firm Work search now matches project name** — `project_id` is a
  foreign key, not text, so it can't join into a plain `ilike`; matched
  Client Work's own Search page's existing pattern for client/staff name
  matching (`renderSearchPage`): compute matching project IDs client-side
  from the already-loaded `state.projects`, fold them into the same
  server-side `.or()` as `project_id.in.(...)`. Still one query, never a
  client-side download-then-filter.
- **Archiving verified not to hide/delete history** — there is no delete
  policy on `projects` at all (confirmed by a DB test attempting delete
  as admin and expecting denial), and the Firm Work list's project filter
  already listed archived projects (labeled `(archived)`) before this
  task, so historical work under a retired project was always reachable;
  this task adds explicit DB + Playwright coverage proving it, rather
  than leaving it as an unverified assumption.

Building `firm-work-detail.spec.js`/`projects.spec.js` — the first tests
to chain `.insert(...).select().single()` / `.update(...).select()
.single()` onto a WRITE rather than a plain read — surfaced the same
`.single()` bare-object-vs-array bug Task 17 found and fixed for GET, but
this time on POST/PATCH: `tests/ui/support/mock-supabase.js` always
wrapped a written row in an array even when `.single()` asked for a bare
object, so `res.data` came back unusable right after a write. Fixed in
the mock only, same technique, see `docs/UI_TESTING.md`.

## 3. Confirmed live drift (2026-08-14)

The owner ran the consolidated RLS/functions/extensions/cron query
directly against production. This section classifies every discrepancy
found, per Task 1's own required buckets.

### 3a. Production missing a migration — urgent, needs owner verification

**`clients` has no live INSERT or UPDATE policy.** The repo migration
(`20260811090200_clients.sql`) defines `clients_insert_admin` and
`clients_update_admin` alongside `clients_read_authenticated`. Live shows
**only** `clients_read_authenticated` — no insert or update policy of any
name exists for this table. `20260815090000_v2_permission_audit.sql`
explicitly assumed these two policies already existed and deliberately
left them untouched (its own comment: "admin-only write policies
[including] clients_insert/update_admin ... already keyed on
current_user_role() ... unaffected, no change needed") — so this isn't
something that migration removed; the policies appear to simply never
have existed live, or were dropped outside any tracked migration.

**Practical effect if this is really the live state**: with RLS enabled
and no matching policy, Postgres denies the operation for every role,
including admin — nobody could create or edit a client through the
normal app/PostgREST path. This needs a real-world check (try creating
or editing a client in the Staff app) to confirm impact, and if
confirmed, a policy needs to be added — but per Task 1's "do not alter
production data" scope and "record drift, do not fix it blindly"
instruction, no fix was applied here. Flagged as the single highest
priority item to resolve, likely as an expedited fix rather than waiting
for its turn in the task sequence, once confirmed.

### 3b. Repository missing a change — live behavior differs from what's documented, not a security problem, needs backfilling into a migration for accuracy

**`profiles` allows self-update, not just admin-update.** Live policy is
`profiles_update_own_or_admin`: `(auth.uid() = id) OR
(current_user_role() = 'admin')` — any user can update their own row.
The repo's reconstruction (`profiles_update_admin`, admin-only) is
narrower than what's actually live. Consistent with this, the live
anti-escalation trigger is named `prevent_self_role_escalation`, not
`guard_profile_update` (which does not exist live at all) — the real
design appears to be "anyone may edit their own profile; a trigger
specifically blocks a non-admin from changing their own `role`/`is_active`
during that edit," which is a coherent, sensible feature, just not one
that made it into any migration file. The original `profiles.sql`
reconstruction's cited justification ("an employee cannot promote
themselves") is consistent with self-update-but-not-self-escalation, so
this looks like the reconstruction under-scoped the policy rather than
live drifting away from an intentionally narrower original. No staff.js
screen currently appears to exercise self-profile-editing, so this is
dormant but real. Needs a migration written to match live reality (Task
4, architecture contracts, or an earlier opportunistic fix — owner's
call) rather than "fixing" live to match the narrower repo version, since
live is arguably the more correct/intended behavior.

### 3c. Owner decision needed — unknown-origin live objects, no migration, cannot classify further without input

- **`activity_log` table** — RLS enabled, admin-only `SELECT`,
  authenticated-insert-own-row `INSERT`. No migration file defines it,
  and it's distinct from `work_activity` (the per-work-item trail this
  document does account for). Unknown whether this is a general
  system-wide activity log still in use, or a superseded/legacy object
  from an earlier design that was never dropped.
- **`guard_task_update` function** — no migration defines it, and no live
  table named anything like "tasks" was found to check it's attached to
  (the live table query only covers ordinary tables; it could be attached
  to a view, or be an orphaned trigger function with nothing left
  pointing at it).
- **`rls_auto_enable` function** — `search_path = pg_catalog` stands out
  as unusual for anything in this app's own migrations (everything else
  uses `public` or `public, extensions`). Could be a Supabase
  platform/advisor-generated function, or a personal DBA safety net set
  up directly against the project outside of any Claude session. Not
  guessed at further here.

None of these three appear to be part of any currently-shipped Maven Work
Desk feature per the migrations this document is built from. They are
not removed or altered here — only recorded — pending the owner's input
on origin and whether they should be documented, kept, or cleaned up.

### 3d. Safe historical differences — logic matches, only naming differs (expected, not a defect)

`service_templates`' and `service_template_items`' INSERT policies are
named `service_templates_write` / `service_template_items_write` live,
not `service_templates_insert_admin` /
`service_template_items_insert_admin` as reconstructed in the repo — same
`_write`-not`_insert` naming pattern already documented for
`client_services`. In both cases the live `with_check` expression
(`current_user_role() = 'admin'`) matches the repo's intended logic
exactly; only the name differs. Notably, neither of these two tables was
originally flagged in §1 as a "predates the repo" reconstruction (they
were assumed to be original, repo-authored migrations) — this result
shows the naming-drift issue isn't confined to the seven tables §1 lists;
treat policy names as unreliable everywhere in this schema, not just
those seven, and always compare `using`/`with_check` text instead.

### 3e. Confirmed matching — no drift

- All 15 live tables have RLS enabled, matching expectation.
- `pg_cron` jobs: **zero** live (the query returned no rows) — confirms
  the daily "generate-period-work-daily" sweep really was unscheduled,
  matching `20260811091000_recurring_work_generation.sql`'s intent
  exactly.
- The five previously anon-reachable functions now correctly show
  `anon_can_execute = false` (see §0's live-confirmed table).
- `_generate_period_work_core` is correctly locked to nobody
  (`anon_can_execute = false`, `authenticated_can_execute = false`),
  matching its explicit revoke in the repo.
- `pgcrypto` lives in `extensions`, `pg_cron` shows under `pg_catalog` (its
  control functions are exposed there while job data lives in a separate
  `cron` schema — normal, not drift). `pg_stat_statements`, `plpgsql`,
  `supabase_vault`, `uuid-ossp` are Supabase-default extensions not
  managed by any migration in this repo — expected, not drift.
- Every function's `search_path` matches what its migration specifies
  (`public`, or `public, extensions` for the two pgcrypto-calling
  credential functions).

## 4. Known limitations of this document

- Live queries WERE run for this task (§0, §3) — RLS policies, functions,
  extensions, cron jobs, table/RLS-enablement list are now
  live-confirmed, not merely inferred from migrations. What remains
  unconfirmed live: full column/constraint/index detail
  (`verify_live_schema.sql` sections 2–5, 8, 11 — not yet run), and the
  three unknown-origin objects in §3c, which need owner input rather than
  another query to resolve.
- Seven tables' *policy names* were expected to be known-unreliable
  reconstructions (§1); §3 confirms this is actually true more broadly —
  `service_templates` and `service_template_items` (not in the original
  seven) also turned out to have renamed policies, logic intact. Treat
  every policy name in this schema as unverified until compared, not just
  those seven.
- **CONFIRMED 2026-08-14** (owner ran `verify_live_schema.sql` section 12
  live): `supabase_migrations.schema_migrations` contains exactly one row
  — `20260811090000` / `extensions`. Every migration after the first was
  applied by hand-pasting into the Supabase SQL editor, never through
  `supabase db push`/CLI tracking, for the entire life of this project.
  This matches the project's actual workflow (every prior task in this
  repository was confirmed live the same way: paste SQL, run, reply
  "Success") and is not itself a defect — but it means Supabase's own
  migration bookkeeping cannot be trusted as a completeness check for
  which of the 16 files are actually live; that can only be confirmed by
  checking each file's actual effect (tables/columns/policies/functions),
  which is what sections 0–11 of the same script are for.
- The `client_credentials` passphrase's actual live value cannot and
  should not be checked this way; only its existence/non-placeholder
  status matters here, deferred to Task 10.

## 5. What's left to fully close the loop

Most of Task 1's acceptance criteria are now satisfied — §0 and §3 give
live-confirmed, classified discrepancies. What remains:

1. **Real-world check on `clients` INSERT/UPDATE (§3a)** — try creating
   or editing a client in the Staff app and report what happens. This is
   the single highest-priority open item; everything else here can wait
   for its normal place in the task sequence, this one probably shouldn't.
2. **Owner input on the three unknown-origin objects (§3c)** —
   `activity_log`, `guard_task_update`, `rls_auto_enable`. Whenever
   convenient, not urgent.
3. Optionally, run `verify_live_schema.sql` sections 2–5, 8, 11 for full
   column/constraint/index/trigger/grant-level completeness — lower
   priority, since the security- and RLS-relevant surface (§0, §3) is
   already covered.

## 6. Nothing in this task altered production data

This task only read files in this repository and wrote two new files
(this document and `supabase/verify_live_schema.sql`, which itself
performs no writes). No migration was applied, no table was altered, no
row was inserted, updated, or deleted. The one action recommended
outside Task 1's own scope — revoking anonymous `EXECUTE` on six
functions — was handed to the owner as optional, clearly-labeled,
permissions-only SQL to run at their discretion; it was not run from
here, and it does not touch any table's data even if run.
