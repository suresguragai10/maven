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

## 2. Expected schema, as of migration `20260818090000` (last applied)

### Tables (16)

| Table | Origin | RLS | Notable columns added by later migrations |
|---|---|---|---|
| `profiles` | reconstructed | enabled | — |
| `clients` | reconstructed | enabled | `attention_level`, `attention_reason`, `attention_set_by`, `attention_set_at` (20260814090000) |
| `service_templates` | original (20260811090300) | enabled | `is_active` (20260813100000-era Task 13) |
| `service_template_items` | original | enabled | `is_required` (Task 13) |
| `work_items` | original (20260811090400) | enabled | `submission_*` fields, `completed_at`, `submitted_at/by`, `created_by` (later Task 13-era additions); `work_scope`, `firm_category` + scope-conditional checks (20260816090000); `client_id` NOT NULL dropped (20260816090000) |
| `work_checklist_items` | reconstructed (bundled in 20260811090500) | enabled | `is_required` (Task 13) |
| `work_comments` | reconstructed (bundled in 20260811090500) | enabled | — |
| `work_waiting_items` | reconstructed (bundled in 20260811090500) | enabled | `requested_by`, `follow_up_date`, `last_followed_up_at`, `follow_up_count`, `note` (added across the Waiting-checklist work, pre-handbook) |
| `work_activity` | reconstructed (bundled in 20260811090500) | enabled | — |
| `client_services` | reconstructed (20260811090600) | enabled | `start_period`, `end_period` (Task 12-era) |
| `client_credentials` | original (20260811090700) | enabled, **zero policies** | — |
| `personal_todos` | original (20260811090800) | enabled | — |
| `app_settings` | original (20260811090900) | enabled | `app_settings_insert_admin` policy (Task 18) |
| `notifications` | original (20260813100000) | enabled | — |
| (no separate "projects/initiatives" table yet — handbook Task 19, not built) | | | |

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

`personal_todos` and `notifications` were deliberately left on their
original ownership-only policies (`auth.uid() = user_id`) — never
touched by the `is_active` hardening pass, since an already-more-
restrictive per-row-ownership check makes the `is_active` gap moot for
those two tables specifically (noted in `20260815090000`'s own scope;
still a confirmed low-severity gap, see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md)).

### Functions (all `public` schema unless noted)

| Function | Security | search_path | Purpose |
|---|---|---|---|
| `current_user_role()` | DEFINER, `sql`, stable | `public` | role, or NULL if inactive/no profile |
| `current_user_active()` | DEFINER, `sql`, stable | `public` | is_active, coalesced false |
| `handle_new_user()` | DEFINER, trigger | `public` | creates a profile row on `auth.users` insert |
| `guard_profile_update()` | DEFINER, trigger | `public` | blocks non-admins changing `role`/`is_active` (NULL-safe: positive-list pattern, but see §0 residual note — RLS is the real gate here anyway) |
| `guard_work_item_update()` | DEFINER, trigger | `public` | core business-rule enforcement on status/field transitions; NULL-safe (positive-list pattern). Rewritten by Handbook Task 6 (`20260818090000_work_item_update_authorization.sql`) — now branches on `work_scope` before any Client-Work role logic (Firm Work = full peer power for any active user), reviewer's branch no longer skips the reassign/rescope/submission-timing checks the way admin's does, and `work_scope`/`id`/`created_at`/`created_by` are universally immutable after creation. |
| `log_work_item_created()` | DEFINER, trigger | `public` | writes the initial `work_activity` row |
| `add_client_credential`, `list_client_credentials`, `reveal_client_credential`, `delete_client_credential` | DEFINER, plpgsql | `public` (+`extensions` for the two that call pgcrypto) | see §0 — NOT NULL-safe, no explicit grant restriction |
| `_generate_period_work_core(period, period_type)` | DEFINER, plpgsql | `public` | actual generation logic; explicitly revoked from public/anon/authenticated |
| `generate_period_work_for_period(period, period_type)` | DEFINER, plpgsql | `public` | public wrapper; see §0 — NOT NULL-safe, no explicit grant restriction |
| `set_client_attention(client_id, level, reason)` | DEFINER, plpgsql | `public` | see §0 — NOT NULL-safe, but grant-restricted to `authenticated` |
| `pg_temp.drop_policies_for(table, cmd)` | invoker, plpgsql | n/a | migration-time helper only, session-temporary, not part of live schema after the migration finishes |

### Extensions

- `pgcrypto` — installed into the `extensions` schema (not `public`);
  every function calling `pgp_sym_encrypt`/`pgp_sym_decrypt` must include
  `extensions` in its own `search_path` or the call fails. Confirmed this
  was hit once historically per the extension migration's own comment.
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

### `client_credentials` secret handling

The two functions that touch plaintext (`add_client_credential`,
`reveal_client_credential`) call `pgp_sym_encrypt`/`pgp_sym_decrypt` with
a literal placeholder string, `'REPLACE_WITH_SECRET_PASSPHRASE'`, still
present in the migration file as committed. The file's own header
warns this must be replaced with a real passphrase before running, and
the real value must never be committed. This document does not attempt
to verify what passphrase is actually live (that would require reading
`pg_proc` source with a service role, and even then the value itself
must never be pasted anywhere) — flagged here only so it is not lost:
Task 10 needs to confirm a real (non-placeholder, non-committed)
passphrase is what's actually live, ideally sourced from Supabase
Vault/project secrets rather than inline in function source at all.

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
