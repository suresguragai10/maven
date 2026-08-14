const { tryQuery } = require('../support/probe');
const { CLIENTS } = require('../support/ids');

// set_client_attention() is one of the six functions flagged in Handbook
// Task 1 for the `current_user_role() not in (...)` / NULL bypass. Unlike
// the other five, its migration (20260814090000_client_attention.sql)
// DOES explicitly revoke EXECUTE from public/anon and grant only to
// authenticated -- so anon should be blocked at the grant layer here, and
// the only way to reproduce the actual bug is the `inactive` identity
// (authenticated role, but current_user_role() returns NULL).
module.exports = async function clientAttentionMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'client_attention (set_client_attention RPC)';

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, `select public.set_client_attention($1, 'needs_attention', 'Overdue documents')`, [CLIENTS.alpha.id]);
    record({ area, action: 'CALL as reviewer', identity: 'reviewerA', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'succeeded - reviewers are deliberately included per the V2 audit\'s stated decision' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `select public.set_client_attention($1, 'high_attention', 'Unauthorized')`, [CLIENTS.alpha.id]);
    record({ area, action: 'CALL as a plain employee (real, non-NULL role)', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded - confirms the NOT IN check works correctly for a real, resolvable role; the bug is specific to NULL' });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, `select public.set_client_attention($1, 'high_attention', 'Anonymous attempt')`, [CLIENTS.alpha.id]);
    record({ area, action: 'CALL as anonymous', identity: 'anon', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded - matches Task 1\'s live-confirmed finding that this function is grant-restricted to authenticated' });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `select public.set_client_attention($1, 'high_attention', 'Deactivated-session attempt')`, [CLIENTS.alpha.id]);
    record({
      area, action: 'CALL as a deactivated profile with a still-valid authenticated session', identity: 'inactive',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'succeeded - EMPIRICALLY REPRODUCES the Task 1 NULL-bypass finding: current_user_role() returns NULL for this identity, "NULL not in (\'admin\',\'reviewer\')" evaluates to NULL, PL/pgSQL treats a NULL IF-condition as false, the RAISE never fires. This is the exact residual risk documented in maven_critical_finding_anon_execute_bypass.md, now proven against a real query instead of reasoned about.',
    });
  });
};
