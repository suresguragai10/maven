const { tryQuery } = require('../support/probe');
const { CLIENTS } = require('../support/ids');

// client_credentials has ZERO RLS policies of its own by design (see the
// migration's own comment: "even a leaked anon key can't read this table
// directly, only through a function..."). These four functions are its
// entire protection. None of the four have an explicit grant restriction
// IN THE MIGRATION FILE -- the REVOKE that closes the anon path was
// applied live, by hand, during Handbook Task 1, and was never captured
// as a committed migration (intentionally deferred to Task 10). This
// matrix replays ONLY the committed migrations, so it reproduces the
// ORIGINAL, pre-mitigation state -- proving the vulnerability lives in
// the repository itself, not just in whatever the live database happened
// to have before it was fixed by hand.
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
        area, action: `CALL ${fn} as anonymous (no committed grant restriction)`, identity: 'anon',
        allowed: r.ok, expectedSecure: 'deny',
        note: r.error || `CRITICAL: no error at all - the call reached the function body. Confirms this repository's migrations, replayed fresh with no manual live patching, leave this function callable by anon. (This is separate from whether it returned useful data - see the credential-id-specific reveal test below for the full chain.)`,
      });
    });
  }

  // The complete anonymous attack chain: list credential metadata, then
  // decrypt the password for the id it returned -- using nothing but the
  // publicly-embedded anon key, no login at all.
  await asRole(ANON, async (c) => {
    const listResult = await tryQuery(c, 'select id from public.list_client_credentials($1)', [CLIENTS.alpha.id]);
    if (!listResult.ok || listResult.rowCount === 0) {
      record({ area, action: 'Full anonymous chain: list then reveal a real password', identity: 'anon', allowed: false, expectedSecure: 'deny', note: listResult.error || 'list_client_credentials returned no rows for anon - chain stops here, cannot proceed to reveal' });
      return;
    }
    const credId = listResult.rows[0].id;
    const revealResult = await tryQuery(c, 'select public.reveal_client_credential($1) as password', [credId]);
    record({
      area, action: 'Full anonymous chain: list then reveal a real password', identity: 'anon',
      allowed: revealResult.ok && !!revealResult.rows[0]?.password, expectedSecure: 'deny',
      note: revealResult.error || `CRITICAL: decrypted password returned to an anonymous caller: "${revealResult.rows[0]?.password}". This is the complete, working exploit chain for the Task 1 finding, reproduced end-to-end against the committed migrations.`,
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
      note: `anon_can_execute = ${r.rows[0]?.anon_can_execute} - confirms the missing-grant-restriction finding independent of actually calling the function`,
    });
  });
};
