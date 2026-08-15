// Handbook Task 3 orchestrator: start a disposable local Postgres, apply
// every migration verbatim, seed deterministic data, run every matrix in
// matrices/ against real role-impersonated queries, then write both a
// machine-readable snapshot (docs/permission_baseline.json) and the
// human-readable report (docs/PERMISSION_BASELINE.md) from the SAME
// results array -- the doc is generated from what actually happened,
// never hand-typed, so it can't silently drift from reality.

const fs = require('fs');
const path = require('path');
const { setupHarness } = require('./support/harness');
const { makeRecorder } = require('./support/record');
const { MIGRATIONS_DIR } = require('./support/apply-schema');

const MATRIX_FILES = [
  'profiles',
  'clients_and_services',
  'work_items_client',
  'work_items_firm',
  'checklist_activity_waiting',
  'activity_audit_trail',
  'client_work_transitions',
  'submission',
  'templates_and_settings',
  'notifications_and_todos',
  'client_attention',
  'client_credentials',
  'recurring_generation',
  'period_normalization',
  'security_definer_grants',
];

function renderMarkdown(results, meta) {
  const byArea = new Map();
  for (const r of results) {
    if (!byArea.has(r.area)) byArea.set(r.area, []);
    byArea.get(r.area).push(r);
  }

  const insecure = results.filter((r) => !r.secure);
  const lines = [];
  lines.push('# Permission Baseline (Handbook Task 3)');
  lines.push('');
  lines.push(`Generated ${meta.generatedAt} by \`node tests/db/run.js\` -- **every row below reflects an actual query run against a real, disposable local Postgres instance**, not a reading of the policy text. Regenerate this file any time by running the harness again; do not hand-edit it, edits will be overwritten.`);
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push('- Local, disposable Postgres 18 via the `embedded-postgres` npm package (devDependency) -- see `tests/db/support/pg-instance.js` for why (the system-wide PostgreSQL install on this machine is missing its `share/` directory and cannot run `initdb`; touching its existing, password-protected data directory was ruled out with the owner\'s input). A fresh instance is created and destroyed for every run; nothing persists between runs and nothing here ever touched production.');
  lines.push(`- Schema: all ${meta.migrationCount} files in \`supabase/migrations/\` applied VERBATIM, in filename order, with exactly one documented exception (the \`create extension if not exists pg_cron;\` line is skipped -- pg_cron needs shared_preload_libraries and isn't bundled with the embedded package; nothing in this task's matrices depends on it). \`pgcrypto\` runs for real -- confirmed working before relying on it.`);
  lines.push('- `auth.users`/`auth.uid()`/`auth.role()` are reproduced by a minimal stub (`tests/db/support/auth-stub.sql`) that sets the same `request.jwt.claims` GUC PostgREST sets from a verified JWT -- this is the same technique used by hand in the Supabase SQL editor during the V2 Permission Audit (Task 19), automated here instead of typed once.');
  lines.push('- **This harness tests the repository\'s migrations, not the live database.** Where Handbook Task 1 found live drift (e.g. the anon-execute grant mitigation applied by hand, never committed as a migration), this harness reproduces the ORIGINAL, pre-mitigation, as-committed state -- see the `client_credentials` and `recurring generation functions` sections below. That is intentional: it proves the gap lives in the repository itself, not only in whatever the live database happened to have before a manual fix.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`${results.length} checks run across ${byArea.size} areas. **${insecure.length} show current behavior that does not match the intended permission model** (listed first, below) -- per this task\'s own instruction, none of these were fixed here; this document only establishes evidence. "Secure" below means "matches this document's own stated intent," not a claim that the intent itself is optimal.`);
  lines.push('');

  if (insecure.length) {
    lines.push('## Findings — current behavior does not match the intended model');
    lines.push('');
    lines.push('| Area | Action | Identity | Observed | Note |');
    lines.push('|---|---|---|---|---|');
    for (const r of insecure) {
      lines.push(`| ${r.area} | ${r.action} | ${r.identity} | **${r.allowed ? 'ALLOWED' : 'DENIED'}** (expected ${r.expectedSecure.toUpperCase()}) | ${r.note.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  lines.push('## Full evidence table, by area');
  lines.push('');
  for (const [area, rows] of byArea) {
    lines.push(`### ${area}`);
    lines.push('');
    lines.push('| Action | Identity | Observed | Expected | Result | Note |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of rows) {
      lines.push(`| ${r.action} | ${r.identity} | ${r.allowed ? 'ALLOWED' : 'DENIED'} | ${r.expectedSecure.toUpperCase()} | ${r.secure ? 'PASS' : 'FAIL'} | ${r.note.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  lines.push('## How to re-run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:db');
  lines.push('```');
  lines.push('');
  lines.push('Regenerates this file and `docs/permission_baseline.json` from a fresh run. A future security fix should change specific rows from FAIL to PASS in the relevant area -- that diff, in version control, is the proof the task\'s acceptance criterion asks for: the original unauthorized action fails at the database level, provably, not just because a button disappeared from the UI.');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const harness = await setupHarness();
  const { record, results } = makeRecorder();
  try {
    for (const name of MATRIX_FILES) {
      const matrixFn = require(path.join(__dirname, 'matrices', `${name}.matrix.js`));
      await matrixFn({ ...harness, record });
    }
  } finally {
    await harness.teardown();
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    migrationCount: fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).length,
  };

  const docsDir = path.join(__dirname, '..', '..', 'docs');
  fs.writeFileSync(path.join(docsDir, 'permission_baseline.json'), JSON.stringify({ meta, results }, null, 2));
  fs.writeFileSync(path.join(docsDir, 'PERMISSION_BASELINE.md'), renderMarkdown(results, meta));

  const insecureCount = results.filter((r) => !r.secure).length;
  console.log(`\n${results.length} checks run, ${insecureCount} show current behavior that doesn't match the intended model.`);
  console.log('Written: docs/PERMISSION_BASELINE.md, docs/permission_baseline.json');
}

main().catch((e) => {
  console.error('DB permission harness run failed:', e);
  process.exit(1);
});
