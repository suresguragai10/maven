# Maven Work Desk — Database Source of Truth

Handbook Task 1. Answers: does `supabase/migrations/` accurately represent
what is actually live? Written by replaying all 16 migration files in
filename (chronological) order and recording the resulting expected state.

**LIVE PARITY = UNVERIFIED.** This environment has no direct or
programmatic access to the live Supabase database — no service-role key,
no CLI project link, no credentials. Every interaction with the live
database this project has ever had was the owner pasting SQL into the
Supabase SQL editor and reporting the result back. This document
describes what the repository *expects* to be live, classified by how
confident that expectation is. It is not a confirmed live/repo diff.
`supabase/verify_live_schema.sql` is the read-only script the owner needs
to run to turn this into a confirmed diff — see "How to close the loop"
at the end.

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

## 2. Expected schema, as of migration `20260816090000` (last applied)

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

### RLS pattern, current state (post `20260815090000` + `20260816090000`)

Two `SECURITY DEFINER` functions gate almost everything:

```sql
current_user_role()   -- returns role, or NULL if no active profile matches auth.uid()
current_user_active()  -- returns is_active (false if no profile row), coalesced to false
```

Every admin/reviewer-gated policy checks `current_user_role() = 'admin'`
(or `in ('admin','reviewer')`). Every "any active team member" read/write
policy checks `current_user_active()`. `work_items` additionally OR's in
`work_scope = 'firm'` so Firm Work is visible/writable to any active
teammate regardless of the client-work-specific
assignee/reviewer/`ready_for_review` predicate — the four `work_items`
child tables (`work_checklist_items`, `work_comments`,
`work_waiting_items`, `work_activity`) were **not** given an equivalent
explicit `work_scope` branch; Firm Work's use of a distinct `'review'`
status value (instead of colliding with `'ready_for_review'`) is what
keeps those child tables' existing `status <> 'ready_for_review'`
visibility clause correct for Firm Work without changing it. `personal_todos`
and `notifications` were deliberately left on their original
ownership-only policies (`auth.uid() = user_id`) — never touched by the
`is_active` hardening pass, since an already-more-restrictive
per-row-ownership check makes the `is_active` gap moot for those two
tables specifically (noted in `20260815090000`'s own scope).

### Functions (all `public` schema unless noted)

| Function | Security | search_path | Purpose |
|---|---|---|---|
| `current_user_role()` | DEFINER, `sql`, stable | `public` | role, or NULL if inactive/no profile |
| `current_user_active()` | DEFINER, `sql`, stable | `public` | is_active, coalesced false |
| `handle_new_user()` | DEFINER, trigger | `public` | creates a profile row on `auth.users` insert |
| `guard_profile_update()` | DEFINER, trigger | `public` | blocks non-admins changing `role`/`is_active` (NULL-safe: positive-list pattern, but see §0 residual note — RLS is the real gate here anyway) |
| `guard_work_item_update()` | DEFINER, trigger | `public` | core business-rule enforcement on status/field transitions; NULL-safe (positive-list pattern) |
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

## 3. Known limitations of this document

- No live query was run. Every statement above describes what 16
  migration files, read in order, imply should be live — not what is
  confirmed live.
- Seven tables' *policy names* are known-unreliable reconstructions (§1);
  their policy *logic* is believed accurate to historical behavior at
  reconstruction time, but has not been independently re-verified against
  the live database in this task.
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

## 4. How to close the loop (turns this into a real drift report)

1. Run `supabase/verify_live_schema.sql` in the Supabase SQL editor,
   section by section (or all at once).
2. Check section 0 first — if `anon_can_execute` is `true` for any of the
   four credential functions or `generate_period_work_for_period`,
   apply the mitigation grant SQL provided in chat immediately; it only
   changes permissions, not data.
3. Share the output back. Each live-vs-repo discrepancy found will then
   be classified into one of the four buckets Task 1's acceptance
   criteria calls for:
   - **Safe historical difference** — e.g., a reconstructed policy name
     differs but its logic matches.
   - **Repository missing a change** — live has something no migration
     file describes (this file's own admission: it cannot rule this out
     without the live query).
   - **Production missing a migration** — a migration file exists but its
     effect isn't live (e.g., a file was never actually pasted/run).
   - **Owner decision needed** — e.g., confirming the real
     `client_credentials` passphrase, or deciding when to apply the
     grant-hardening/root-cause fix from §0.
4. Until step 3 happens, treat every "expected" statement in this
   document as **unverified**, not confirmed.

## 5. Nothing in this task altered production data

This task only read files in this repository and wrote two new files
(this document and `supabase/verify_live_schema.sql`, which itself
performs no writes). No migration was applied, no table was altered, no
row was inserted, updated, or deleted. The one action recommended
outside Task 1's own scope — revoking anonymous `EXECUTE` on six
functions — was handed to the owner as optional, clearly-labeled,
permissions-only SQL to run at their discretion; it was not run from
here, and it does not touch any table's data even if run.
