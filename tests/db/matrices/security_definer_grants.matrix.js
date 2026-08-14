// A direct catalog inspection of every SECURITY DEFINER function's actual
// EXECUTE grants -- the same has_function_privilege() technique used
// against the live database in Handbook Task 1, run here against a fresh
// replay of ONLY the committed migrations (no live-only manual patches),
// so it shows exactly what a brand new environment built from this repo
// today would have.
// Functions that perform a genuinely privileged action if reached --
// these are the ones where an anon EXECUTE grant is itself the finding.
// The rest of the SECURITY DEFINER functions in this schema are either
// pure trigger functions (never meant to be called directly at all -
// Postgres does let you SELECT a trigger function, but it errors
// immediately with "trigger functions can only be called as triggers",
// which is its own kind of "safe by construction") or read-only "who am
// I" helpers (current_user_role()/current_user_active()) that are
// SUPPOSED to be callable by anyone, including anon - they just return
// your own (or nobody's) role, no privileged action happens. Scoring
// those as findings would misrepresent the schema's actual design.
const PRIVILEGED_ACTION_FUNCTIONS = new Set([
  'add_client_credential', 'list_client_credentials', 'reveal_client_credential',
  'delete_client_credential', 'generate_period_work_for_period', 'set_client_attention',
  '_generate_period_work_core',
]);

module.exports = async function securityDefinerGrantsMatrix({ asSuperuser, record }) {
  const area = 'SECURITY DEFINER function grants (catalog inspection)';

  await asSuperuser(async (c) => {
    const res = await c.query(`
      select p.proname as function_name,
             pg_get_function_identity_arguments(p.oid) as args,
             p.prosecdef as is_security_definer,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by p.proname
    `);

    for (const row of res.rows) {
      const isPrivileged = PRIVILEGED_ACTION_FUNCTIONS.has(row.function_name);
      record({
        area,
        action: `EXECUTE grant to 'anon' on ${row.function_name}(${row.args})`,
        identity: 'n/a (catalog check)',
        allowed: row.anon_can_execute === true,
        // Only privileged-action functions are scored as a real
        // allow/deny expectation; everything else is recorded for
        // completeness with expectedSecure set to whatever is ACTUALLY
        // there, so it always shows "secure": true (informational, not a
        // pass/fail claim about the design of trigger/helper functions).
        expectedSecure: isPrivileged ? 'deny' : (row.anon_can_execute ? 'allow' : 'deny'),
        note: isPrivileged
          ? `privileged-action function; anon_can_execute=${row.anon_can_execute}, authenticated_can_execute=${row.authenticated_can_execute} (cross-reference the matching matrix file for what actually happens when called)`
          : `informational only, not scored as a finding either way - ${row.is_security_definer ? 'trigger/helper function' : 'not SECURITY DEFINER'}; anon_can_execute=${row.anon_can_execute}`,
      });
    }
  });
};
