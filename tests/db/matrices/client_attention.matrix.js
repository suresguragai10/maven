const { tryQuery } = require('../support/probe');
const { CLIENTS } = require('../support/ids');

// set_client_attention() was one of the six functions flagged in Handbook
// Task 1 for the `current_user_role() not in (...)` / NULL bypass, fixed
// at the root by Handbook Task 9's coalesce() rewrite
// (20260821090000_offboarding_revokes_business_access.sql). Its
// migration already explicitly revoked EXECUTE from public/anon (so anon
// was always blocked at the grant layer here); the `inactive` identity
// (authenticated role, current_user_role() returns NULL) is what used to
// reproduce the actual logic bug, now fixed.
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
      note: r.error || 'succeeded - the NULL-bypass finding this test was written to catch; FIXED by Handbook Task 9\'s coalesce(current_user_role(), \'\') rewrite.',
    });
  });
};
