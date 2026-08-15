const { tryQuery } = require('../support/probe');
const { CLIENTS } = require('../support/ids');

// Handbook Task 10: "do not print decrypted credentials in logs/tests" --
// every check below compares a decrypted value against what's expected
// and records only a boolean, never the plaintext itself, even for the
// harness's own throwaway seed password.
const SEEDED_PASSWORD = 'S3edPassword!';

// client_credentials has ZERO RLS policies of its own by design (see the
// migration's own comment: "even a leaked anon key can't read this table
// directly, only through a function..."). These four functions are its
// entire protection. The anon EXECUTE grant (originally applied live, by
// hand, during Handbook Task 1, but never committed as a migration) and
// the underlying NULL-unsafe NOT IN logic bug (usable by a deactivated
// profile's still-valid session even with the grant closed) are both now
// fixed for real, as committed migrations, by Handbook Task 9
// (20260821090000_offboarding_revokes_business_access.sql). The tests
// below still exercise the anon/inactive paths directly, as evidence
// they're actually closed now, not just believed to be.
module.exports = async function clientCredentialsMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
  const area = 'client_credentials';

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, 'select id from public.client_credentials where client_id = $1', [CLIENTS.alpha.id]);
    record({ area, action: 'SELECT the table directly (even as admin)', identity: 'admin', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - correctly blocked, zero RLS policies means direct table access is denied for everyone, by design` });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, 'select * from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    record({ area, action: 'CALL list_client_credentials as reviewer', identity: 'reviewerA', allowed: r.ok, expectedSecure: 'allow' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select * from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    record({ area, action: 'CALL list_client_credentials as a plain employee', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded' });
  });

  for (const fn of ['list_client_credentials', 'reveal_client_credential']) {
    await asRole(ANON, async (c) => {
      const args = fn === 'list_client_credentials' ? [CLIENTS.alpha.id] : [null]; // reveal needs a real credential id; see below for the meaningful anon reveal test
      const sql = fn === 'list_client_credentials'
        ? `select * from public.${fn}($1)`
        : `select public.${fn}($1)`;
      const r = await tryQuery(c, sql, args);
      record({
        area, action: `CALL ${fn} as anonymous`, identity: 'anon',
        allowed: r.ok, expectedSecure: 'deny',
        note: r.error || `CRITICAL: no error at all - the call reached the function body despite the anon EXECUTE grant closed by Handbook Task 9. (This is separate from whether it returned useful data - see the credential-id-specific reveal test below for the full chain.)`,
      });
    });
  }

  // The complete anonymous attack chain: list credential metadata, then
  // try to decrypt the password for the id it returned -- using nothing
  // but the publicly-embedded anon key, no login at all. Both steps are
  // now expected to be blocked at the grant layer (Handbook Task 9), so
  // this exists as ongoing evidence the chain stays closed, not to
  // demonstrate a working exploit. Per Handbook Task 10 ("do not print
  // decrypted credentials in logs/tests"), a decrypted value is never
  // written into the note even if this regresses -- only a boolean match
  // against the known seed password.
  await asRole(ANON, async (c) => {
    const listResult = await tryQuery(c, 'select id from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    if (!listResult.ok || listResult.rowCount === 0) {
      record({ area, action: 'Full anonymous chain: list then reveal a real password', identity: 'anon', allowed: false, expectedSecure: 'deny', note: listResult.error || 'list_client_credentials returned no rows for anon - chain stops here, cannot proceed to reveal' });
      return;
    }
    const credId = listResult.rows[0].id;
    const revealResult = await tryQuery(c, 'select public.reveal_client_credential($1) as password', [credId]);
    const leaked = revealResult.ok && revealResult.rows[0]?.password === SEEDED_PASSWORD;
    record({
      area, action: 'Full anonymous chain: list then reveal a real password', identity: 'anon',
      allowed: leaked, expectedSecure: 'deny',
      note: revealResult.error || (leaked ? 'CRITICAL: reveal_client_credential returned the correct decrypted password to an anonymous caller (value redacted from this report per Task 10).' : 'reveal_client_credential returned a result but it did not match the known seed password'),
    });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select * from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    record({
      area, action: 'CALL list_client_credentials as a deactivated profile with a still-valid session', identity: 'inactive',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'succeeded - same NULL-bypass root cause as client_attention.matrix.js, reproduced here too',
    });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_client_credential($1, 'Fake portal', 'attacker', 'attackerpw', 'inserted by anon')`,
      [CLIENTS.alpha.id]
    );
    record({ area, action: 'CALL add_client_credential as anonymous', identity: 'anon', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded - an anonymous caller can plant a fake credential row' });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select public.delete_client_credential($1)', ['00000000-0000-0000-0000-000000000000']);
    record({ area, action: 'CALL delete_client_credential as anonymous (nonexistent id, function-reachability check only)', identity: 'anon', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'no error raised - the function ran to completion (a no-op delete for this id), confirming the call was reachable, not blocked at the grant layer' });
  });

  await asSuperuser(async (c) => {
    const r = await tryQuery(c, `select has_function_privilege('anon', 'public.reveal_client_credential(uuid)', 'EXECUTE') as anon_can_execute`, []);
    record({
      area, action: 'has_function_privilege(anon, reveal_client_credential, EXECUTE) - direct grant inspection', identity: 'n/a (catalog check)',
      allowed: r.rows[0]?.anon_can_execute === true, expectedSecure: 'deny',
      note: `anon_can_execute = ${r.rows[0]?.anon_can_execute} - confirms the anon EXECUTE grant is closed (Handbook Task 9), independent of actually calling the function`,
    });
  });

  // ---- Handbook Task 10: Vault-backed decryption actually works for an
  // authorized caller. Only a boolean match is ever recorded, per "do not
  // print decrypted credentials in logs/tests" -- the raw value itself
  // never appears in a note.
  await asRole(IDENTITIES.reviewerA, async (c) => {
    const listResult = await tryQuery(c, 'select id from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    if (!listResult.ok || listResult.rowCount === 0) {
      record({ area, action: 'Authorized reveal decrypts to the correct value', identity: 'reviewerA', allowed: false, expectedSecure: 'allow', note: listResult.error || 'list_client_credentials returned no rows - cannot proceed to reveal' });
      return;
    }
    const credId = listResult.rows[0].id;
    const revealResult = await tryQuery(c, 'select public.reveal_client_credential($1) as password', [credId]);
    const matches = revealResult.ok && revealResult.rows[0]?.password === SEEDED_PASSWORD;
    record({
      area, action: 'Authorized reveal decrypts to the correct value', identity: 'reviewerA',
      allowed: matches, expectedSecure: 'allow',
      note: revealResult.error || (matches ? 'decrypted value matched the known seed password (value not printed, per Task 10)' : 'reveal succeeded but the decrypted value did not match the known seed password - possible passphrase mismatch'),
    });
  });

  // ---- Handbook Task 10: fail closed when the Vault secret is missing.
  // authenticated/anon have no direct grant on vault.secrets (mirrors a
  // real Supabase project, where only the platform/postgres role can
  // touch vault tables directly -- everything else goes through a
  // SECURITY DEFINER function). So the delete has to run while still on
  // the superuser connection, BEFORE switching to the 'authenticated'
  // role + admin JWT claims to call the RPC, exactly like asRole() does
  // internally -- all inside one BEGIN...ROLLBACK so the deletion never
  // outlives this one check and every later check still sees the secret
  // configured. Each RPC gets its OWN transaction: once a RAISE EXCEPTION
  // fires, Postgres poisons the rest of that transaction block (every
  // later statement fails with "current transaction is aborted" rather
  // than actually running), and tryQuery() doesn't use savepoints -- so a
  // second expected-to-fail call in the same transaction as the first
  // would report the wrong reason, not the fail-closed check itself.
  async function asAdminWithNoVaultSecret(fn) {
    await asSuperuser(async (c) => {
      try {
        await c.query('BEGIN');
        await c.query(`delete from vault.secrets where name = 'client_credentials_passphrase'`);
        await c.query(`SET LOCAL ROLE authenticated`);
        await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: IDENTITIES.admin.id, role: 'authenticated' })]);
        await fn(c);
      } finally {
        await c.query('ROLLBACK').catch(() => {});
      }
    });
  }

  await asAdminWithNoVaultSecret(async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_client_credential($1, 'Should not be stored', 'nobody', 'irrelevant', 'fail-closed check')`,
      [CLIENTS.alpha.id]
    );
    record({
      area, action: 'CALL add_client_credential with no Vault secret configured (fail-closed check)', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: add_client_credential succeeded with no passphrase configured - it must fail closed, not silently encrypt with a fallback',
    });
  });

  await asAdminWithNoVaultSecret(async (c) => {
    const listResult = await tryQuery(c, 'select id from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    if (!listResult.ok || listResult.rowCount === 0) {
      record({ area, action: 'CALL reveal_client_credential with no Vault secret configured (fail-closed check)', identity: 'admin', allowed: false, expectedSecure: 'deny', note: listResult.error || 'no existing credential row to attempt reveal on' });
      return;
    }
    const revealResult = await tryQuery(c, 'select public.reveal_client_credential($1) as password', [listResult.rows[0].id]);
    record({
      area, action: 'CALL reveal_client_credential with no Vault secret configured (fail-closed check)', identity: 'admin',
      allowed: revealResult.ok, expectedSecure: 'deny',
      note: revealResult.error || 'CRITICAL: reveal_client_credential succeeded with no passphrase configured - it must fail closed, not attempt a garbage decrypt',
    });
  });
};
