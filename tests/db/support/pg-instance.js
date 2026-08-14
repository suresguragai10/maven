// Handbook Task 3 — a real, disposable local Postgres instance for direct
// RLS/authorization testing.
//
// WHY embedded-postgres: this machine has a system-wide PostgreSQL 18
// install, but it's missing its share/ directory (no postgres.bki, no
// extension .control files) — initdb fails immediately against it, and
// it can't be used to stand up an isolated test cluster. The existing
// data directory that DOES work requires a password nobody here has, and
// editing its pg_hba.conf to get in would mean touching a system
// database that isn't this project's to touch. embedded-postgres
// downloads a complete, self-contained Postgres 18 binary (platform
// package, ~30MB, includes a full share/ tree — pgcrypto's real
// extension is present, confirmed before relying on it) and manages its
// own throwaway data directory. It brings its own `pg` (node-postgres)
// client as a dependency, so no separate client library was needed.
//
// The instance lives entirely under the OS temp directory, on a
// non-default port, and is destroyed (persistent: false) every time
// stop() runs — never the same files twice, never anything left behind
// in the repo or on a well-known port.

// embedded-postgres ships as a pure ESM package; Node's CJS/ESM interop
// exposes its default export under `.default` when require()'d this way.
const EmbeddedPostgres = require('embedded-postgres').default;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.MAVEN_TEST_PG_PORT || 55433);
const PASSWORD = 'maven-test-harness-local-only';
const DB_NAME = 'maven_permission_baseline';

function makeInstance() {
  const dataDir = path.join(os.tmpdir(), 'maven-test-pg-' + crypto.randomBytes(6).toString('hex'));
  return new EmbeddedPostgres({
    databaseDir: dataDir,
    port: PORT,
    user: 'postgres',
    password: PASSWORD,
    authMethod: 'password',
    persistent: false, // stop() wipes the data directory -- always start clean
    // Without this, initdb picks up the Windows default codepage
    // (WIN1252) instead of UTF8 -- several migration files contain
    // literal UTF-8 characters (e.g. "->" arrows in comments), which then
    // fail to load with "has no equivalent in encoding WIN1252".
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {}, // Postgres's own stdout is noisy and not useful test output
    onError: (e) => console.error('[embedded-postgres]', e),
  });
}

async function startTestDatabase() {
  const pg = makeInstance();
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);
  return {
    pg,
    port: PORT,
    database: DB_NAME,
    connectionConfig: {
      host: 'localhost',
      port: PORT,
      user: 'postgres',
      password: PASSWORD,
      database: DB_NAME,
    },
  };
}

async function stopTestDatabase(pg) {
  await pg.stop();
}

module.exports = { startTestDatabase, stopTestDatabase, PORT, DB_NAME };
