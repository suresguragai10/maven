// Orchestrates a full test run: start embedded Postgres, apply every
// migration verbatim, seed deterministic data, then hand back a pool plus
// asRole() -- the actual role-impersonation primitive every matrix file
// uses to ask "what can this identity really do at the database level."
//
// asRole() reproduces exactly what PostgREST does for a real Supabase
// request: switch the Postgres ROLE to 'anon' or 'authenticated' (this is
// what makes an explicit REVOKE ... FROM anon/authenticated actually bite
// -- a real permission-denied error, not just an empty RLS result) AND
// set the request.jwt.claims GUC that auth.uid()/auth.role() read. Every
// call runs inside BEGIN ... ROLLBACK: nothing a test does -- including a
// successful, "this should have been blocked" write -- ever persists past
// that one check, so tests stay independent of run order and the seed
// data stays pristine for the next one. This is the same JWT-impersonation
// technique used by hand in the Supabase SQL editor during the V2
// Permission Audit (Task 19) -- automated and repeated here instead of
// typed once.

const { Pool } = require('pg');
const { startTestDatabase, stopTestDatabase } = require('./pg-instance');
const { applySchema } = require('./apply-schema');
const { seed } = require('./seed');
const { IDENTITIES, ANON } = require('./ids');

async function setupHarness() {
  const { pg, connectionConfig } = await startTestDatabase();
  const pool = new Pool(connectionConfig);
  pool.on('error', () => {}); // a rolled-back/expired client emitting after release is expected, not a real fault

  const setupClient = await pool.connect();
  try {
    await applySchema(setupClient);
    await seed(setupClient);
  } finally {
    setupClient.release();
  }

  async function asRole(identityOrAnon, fn) {
    const isAnon = identityOrAnon === ANON || identityOrAnon.key === 'anon';
    const pgRole = isAnon ? 'anon' : 'authenticated';
    const claims = isAnon ? { role: 'anon' } : { sub: identityOrAnon.id, role: 'authenticated' };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${pgRole}`);
      await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify(claims)]);
      return await fn(client);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }

  // A handful of checks (EXECUTE-grant inspection, raw catalog reads) need
  // the unrestricted superuser connection rather than an impersonated one.
  async function asSuperuser(fn) {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async function teardown() {
    await pool.end();
    await stopTestDatabase(pg);
  }

  return { pool, asRole, asSuperuser, teardown, IDENTITIES, ANON };
}

module.exports = { setupHarness, IDENTITIES, ANON };
