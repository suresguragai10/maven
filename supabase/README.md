# Maven Work Desk — database

> **Partially superseded — for current, evidence-backed schema/RLS/grant
> detail, see `docs/DATABASE_SOURCE_OF_TRUTH.md`, and for role/workflow
> product rules see `docs/PRODUCT_BOUNDARIES.md`,
> `docs/ROLE_CAPABILITIES.md`, and `docs/WORKFLOW_MODEL.md` (Handbook
> Tasks 1 and 4).** This file's "What's intentionally not here" section
> is out of date — a `notifications` table and in-app notifications
> shipped after this was written, and its migration-order table is
> missing 5 files added since. The provenance/history narrative below is
> still accurate and useful; the specific claims just noted are not.

This is the Supabase (Postgres) schema behind the staff portal at `/staff`
(`staff/staff.js` + `staff/index.html`). It's a separate project from the
public website's own infrastructure — no code here is deployed by
`build.js`; these files exist purely to document and reproduce the
database.

## How this folder came to exist

Every table/policy/function in this project was originally applied by
pasting SQL directly into the Supabase SQL Editor, one block at a time,
across many sessions — none of it lived in this repo. The files in
`migrations/` are a **reconstruction**, built by inspecting exactly what
`staff/staff.js` reads and writes (every `.from(table)`, `.rpc(name)`,
and column reference) and cross-referencing the SQL blocks that were
actually run and confirmed working. They're organized cleanly by
subsystem rather than in literal chat-history order.

**Confidence level**: everything from `service_templates` onward
(everything built after this repo-tracking convention started) is
reproduced with high confidence — those SQL blocks are known verbatim.
`profiles` and `clients` predate that point; their table shapes are
certain (the frontend proves them), but their RLS policies and the
`profiles` role-change trigger are a faithful reconstruction of
documented, tested behavior rather than a copy of the original literal
statements. If you're about to trust this folder as the sole source of
truth for a disaster-recovery scenario, diff it against the live
project's actual schema first (Database → Tables / Policies / Functions
in the Supabase dashboard) rather than assuming an exact match.

## Applying these migrations

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file into the SQL Editor in filename order (they're
numbered so that's also correct) — every statement is written to be
safe to re-run (`create table if not exists`, `create or replace
function`, `create policy` guarded implicitly by running once).

**After running `20260822090000_credential_vault_hardening.sql`** (which
supersedes the placeholder passphrase originally in
`20260811090700_client_credentials.sql`): an admin must run a one-time
`select vault.create_secret(...)` command directly in the Supabase SQL
editor to configure the `client_credentials` encryption passphrase in
Supabase Vault. Until that's done, storing or revealing a client
credential fails closed with a clear error — this is intentional, not a
bug. Never commit the real passphrase value anywhere. See
[docs/SECURITY_MODEL.md](../docs/SECURITY_MODEL.md) "Secret setup,
rotation, and recovery" for the exact command and full procedure.

## What's intentionally not here

- **File/document storage** — postponed by explicit product decision, not
  an oversight. No `work_documents` table, no Supabase Storage bucket.
- **Notifications/reminders** — the product decision was "in-app only";
  the Today dashboard and Deadlines view *are* the reminder surface. No
  email/SMS integration, no `notifications` table.
- **Important Links** (client page) — mentioned in the original product
  brief but never given a concrete data model there, and judged low
  value against the compliance-tracking core.

## Migration order

| File | Contents |
|---|---|
| `20260811090000_extensions.sql` | `pgcrypto`, `pg_cron` |
| `20260811090100_profiles.sql` | Staff accounts/roles, `current_user_role()`, auth-signup trigger, role-change guard trigger |
| `20260811090200_clients.sql` | Client records |
| `20260811090300_service_templates.sql` | Reusable work definitions + their per-stage checklists |
| `20260811090400_work_items.sql` | The core object — work item + status-guard trigger |
| `20260811090500_work_item_children.sql` | Checklist, comments, waiting-for-client checklist, activity log |
| `20260811090600_client_services.sql` | Per-client recurring service subscriptions |
| `20260811090700_client_credentials.sql` | Encrypted client portal logins + reveal-on-demand RPCs |
| `20260811090800_personal_todos.sql` | Private per-user scratchpad |
| `20260811090900_app_settings.sql` | Key/value settings (currently just the auto-generate period) |
| `20260811091000_recurring_work_generation.sql` | Manual + scheduled (`pg_cron`) recurring work generation |
| … | (later Handbook Task migrations — see `docs/DATABASE_SOURCE_OF_TRUTH.md` §2 for the full, current list) |
| `20260822090000_credential_vault_hardening.sql` | Handbook Task 10 — `client_credentials` passphrase moved to Supabase Vault, fail-closed when unconfigured |
| `20260823090000_normalize_generation_periods.sql` | Handbook Task 11 — recurring generation now requires an explicit Gregorian period range; due dates derive from the requested period, never `current_date` |
