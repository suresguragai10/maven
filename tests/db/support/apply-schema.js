// Applies the auth stub, then every file in supabase/migrations/ in
// filename order -- run VERBATIM, unmodified, with exactly one
// documented exception: `create extension if not exists pg_cron;`
// (in 20260811090000_extensions.sql) is skipped, because pg_cron is a
// background-worker extension that needs shared_preload_libraries
// configured at server start, isn't part of the embedded Postgres
// package's bundled extensions, and isn't needed for anything in this
// task's test matrices (recurring generation is tested by calling the
// RPC function directly, not by exercising the cron schedule itself --
// see matrices/recurring_generation.matrix.js). pgcrypto, by contrast,
// IS bundled in the embedded package and runs for real -- confirmed
// before relying on it (see docs/PERMISSION_BASELINE.md "Environment").
// Every other migration statement, in every other file, runs exactly as
// committed to supabase/migrations/.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const AUTH_STUB = path.join(__dirname, 'auth-stub.sql');
const VAULT_STUB = path.join(__dirname, 'vault-stub.sql');
const PG_CRON_LINE = 'create extension if not exists pg_cron;';

async function applySchema(client) {
  const authStubSql = fs.readFileSync(AUTH_STUB, 'utf8');
  await client.query(authStubSql);
  const vaultStubSql = fs.readFileSync(VAULT_STUB, 'utf8');
  await client.query(vaultStubSql);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const file of files) {
    let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    if (sql.includes(PG_CRON_LINE)) {
      sql = sql.replace(PG_CRON_LINE, '-- (skipped in local test harness: pg_cron unavailable, not required by Task 3\'s matrices)');
    }
    await client.query(sql);
    applied.push(file);
  }
  return applied;
}

module.exports = { applySchema, MIGRATIONS_DIR };
