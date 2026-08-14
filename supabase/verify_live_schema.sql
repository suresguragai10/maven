-- Maven Work Desk — live schema verification (Handbook Task 1)
--
-- READ-ONLY. Nothing in this file writes, updates, deletes, grants, or
-- revokes anything. It only queries information_schema / pg_catalog to
-- describe what is currently live, so it is safe to run directly against
-- production in the Supabase SQL editor.
--
-- HOW TO USE: run each numbered block below in the Supabase SQL editor,
-- one at a time (or all at once — each is independent), and keep the
-- output. Compare it against docs/DATABASE_SOURCE_OF_TRUTH.md, which
-- describes what the repository's migrations *expect* to be live. Where
-- they disagree, that is drift — record it, do not silently "fix" it.
--
-- Section 0 is the highest-priority thing to check first: it directly
-- tests the anonymous-execute finding described in the Task 1 report.


-- ============================================================
-- 0. PRIORITY: can an anonymous (unauthenticated) caller execute the
--    SECURITY DEFINER functions that gate client credentials and
--    generate_period_work_for_period? has_function_privilege checks the
--    named role's actual EXECUTE grant — it does not call the function.
-- ============================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'add_client_credential', 'list_client_credentials',
    'reveal_client_credential', 'delete_client_credential',
    'generate_period_work_for_period', '_generate_period_work_core',
    'set_client_attention'
  )
order by p.proname;
-- EXPECTED (per repository migrations, as of 20260816090000):
--   add_client_credential          anon_can_execute = false (see finding — repo does NOT revoke this; if true here, it is exploitable)
--   list_client_credentials        anon_can_execute = false (same caveat)
--   reveal_client_credential       anon_can_execute = false (same caveat — this one decrypts a password)
--   delete_client_credential       anon_can_execute = false (same caveat)
--   generate_period_work_for_period anon_can_execute = false (same caveat)
--   _generate_period_work_core     anon_can_execute = false, authenticated_can_execute = false (explicitly revoked in repo)
--   set_client_attention           anon_can_execute = false (explicitly revoked/granted in repo — should already be false)
-- If any of the first five show anon_can_execute = true, that confirms the
-- anonymous-execute path described in the Task 1 report is live and
-- exploitable right now. See the immediate mitigation SQL provided
-- alongside this task for a permissions-only (no data change) fix.


-- ============================================================
-- 1. Tables in public schema — names, row security status
-- ============================================================
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
-- EXPECTED tables (16 total): app_settings, client_credentials,
-- client_services, clients, notifications, personal_todos, profiles,
-- service_template_items, service_templates, work_activity,
-- work_checklist_items, work_comments, work_items, work_waiting_items.
-- All should show rls_enabled = true.


-- ============================================================
-- 2. Columns, types, defaults, nullability for every public table
-- ============================================================
select table_name, ordinal_position, column_name, data_type,
       column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ============================================================
-- 3. Check constraints (status enums, scope-conditional rules, etc.)
-- ============================================================
select tc.table_name, tc.constraint_name, cc.check_clause
from information_schema.table_constraints tc
join information_schema.check_constraints cc
  on cc.constraint_name = tc.constraint_name and cc.constraint_schema = tc.constraint_schema
where tc.table_schema = 'public' and tc.constraint_type = 'CHECK'
order by tc.table_name, tc.constraint_name;


-- ============================================================
-- 4. Primary keys, foreign keys, unique constraints
-- ============================================================
select tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as references_table, ccu.column_name as references_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
  and tc.constraint_type = 'FOREIGN KEY'
where tc.table_schema = 'public' and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type, tc.constraint_name;


-- ============================================================
-- 5. Indexes (including partial-index predicates)
-- ============================================================
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ============================================================
-- 6. RLS policies — every table, every command, full using/with-check text
-- ============================================================
select schemaname, tablename, policyname, cmd, permissive, roles,
       qual as using_expression, with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
-- IMPORTANT: policy NAMES for profiles, clients, service_templates,
-- work_checklist_items, work_comments, work_waiting_items, work_activity
-- and client_services are reconstructed best-effort in the repo (these
-- tables predate migrations being tracked at all) — compare the
-- using_expression/with_check_expression text, not just names. Do not
-- assume a name mismatch means missing policy; check the logic first.


-- ============================================================
-- 7. Functions — full definition, SECURITY DEFINER status, search_path
-- ============================================================
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as is_security_definer,
       p.proconfig as config_settings, -- look for search_path=... here
       pg_get_functiondef(p.oid) as full_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- ============================================================
-- 8. Triggers
-- ============================================================
select event_object_table as table_name, trigger_name, event_manipulation,
       action_timing, action_statement
from information_schema.triggers
where trigger_schema = 'public' or event_object_schema = 'public'
order by event_object_table, trigger_name;

-- auth.users trigger (handle_new_user) lives outside the public schema:
select trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where event_object_schema = 'auth' and event_object_table = 'users';


-- ============================================================
-- 9. Extensions installed
-- ============================================================
select extname, extnamespace::regnamespace as schema, extversion
from pg_extension
order by extname;
-- EXPECTED: pgcrypto (schema "extensions"), pg_cron. Also whatever
-- Supabase installs by default (pgsodium, pg_graphql, uuid-ossp, etc. —
-- not managed by this repo's migrations, ignore those for drift purposes).


-- ============================================================
-- 10. pg_cron jobs — confirm the daily sweep is really unscheduled
-- ============================================================
select jobid, jobname, schedule, command, active
from cron.job
order by jobid;
-- EXPECTED: no job named 'generate-period-work-daily' (unscheduled by
-- 20260811091000_recurring_work_generation.sql). If it still exists and
-- is active, the repo and live state have drifted — the app now expects
-- generation to happen via the "on Work Desk open" RPC call only, and a
-- surviving cron job could double-run generation logic unexpectedly
-- (harmless due to ON CONFLICT DO NOTHING idempotency, but still drift
-- worth knowing about).


-- ============================================================
-- 11. Table/function grants beyond what's implied by RLS
-- ============================================================
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;
-- Every table has RLS enabled, so a table-level GRANT alone does not
-- expose rows — but it's still worth confirming e.g. client_credentials
-- has no direct anon/authenticated table grant beyond what RLS already
-- blocks (defense in depth, matches the migration's own stated intent).


-- ============================================================
-- 12. Migration history Supabase itself has recorded (if using CLI/
--     migration tracking) — confirms which of the 16 repo migration
--     files the live project believes it has actually applied.
-- ============================================================
select version, name
from supabase_migrations.schema_migrations
order by version;
-- If this table/schema does not exist, the project was not set up via
-- `supabase db push`/CLI migration tracking — every SQL file in this
-- repo was pasted and run manually instead, and this section will error
-- with "relation does not exist," which is itself useful information:
-- record that as a finding, don't treat it as a script bug.
