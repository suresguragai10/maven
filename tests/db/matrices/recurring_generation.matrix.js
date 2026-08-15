const { tryQuery } = require('../support/probe');

// Handbook Task 11 changed both functions' signatures (added required
// p_period_start/p_period_end, Gregorian) -- every call below now passes
// a valid date range so these checks keep testing WHO may call the
// function, not incidentally failing on the unrelated new validation
// this task added (see period_normalization.matrix.js for THAT).
const VALID_ARGS = ['Bhadra 2083', 'monthly', '2026-08-17', '2026-09-16'];

module.exports = async function recurringGenerationMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'recurring generation functions';

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, VALID_ARGS);
    record({ area, action: 'CALL generate_period_work_for_period as admin', identity: 'admin', allowed: r.ok, expectedSecure: 'allow', note: r.error || `succeeded, count=${r.rows[0]?.generate_period_work_for_period}` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, VALID_ARGS);
    record({ area, action: 'CALL generate_period_work_for_period as a plain employee', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded' });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, VALID_ARGS);
    record({
      area, action: 'CALL generate_period_work_for_period as anonymous', identity: 'anon',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: succeeded - no committed grant restriction on this function either, same class of finding as client_credentials. An anonymous caller can trigger bulk work-item generation for any client/period.',
    });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, VALID_ARGS);
    record({ area, action: 'CALL generate_period_work_for_period as a deactivated profile', identity: 'inactive', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded - same NULL-bypass root cause' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select public._generate_period_work_core($1, $2, $3, $4)`, VALID_ARGS);
    record({
      area, action: 'CALL _generate_period_work_core directly (bypassing the wrapper), even as admin', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'succeeded - should never happen: this function is explicitly revoked from public/anon/AND authenticated, meaning it should be unreachable regardless of the caller\'s app-level role, since the Postgres role for any real identity here is "authenticated"',
    });
  });
};
