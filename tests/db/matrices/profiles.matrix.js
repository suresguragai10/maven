const { tryQuery } = require('../support/probe');

module.exports = async function profilesMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
  const area = 'profiles';

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.profiles where id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'SELECT a colleague\'s profile', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow', note: 'blanket authenticated-read is intentional (assignee/reviewer pickers)' });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select id from public.profiles where id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'SELECT any profile', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - current_user_active() should exclude this session` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select id from public.profiles limit 1', []);
    record({ area, action: 'SELECT any profile', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.profiles set role = 'admin' where id = $1`, [IDENTITIES.employeeA.id]);
    record({ area, action: 'UPDATE own role to admin (self-escalation)', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) affected` });
  });

  // Regression coverage for a real gap found live (2026-08-21, see
  // 20260904090000_close_profiles_self_update_drift.sql): a legacy,
  // never-migrated live policy ("profiles_update_own_or_admin") let any
  // authenticated user directly UPDATE their own entire profiles row
  // (any column, not just phone/photo_url), with NO active-status check
  // at all -- a deactivated staff member could reactivate their own
  // is_active flag directly via the REST API, bypassing offboarding
  // entirely. Only a direct table UPDATE has ever been able to touch
  // this row shape this way -- update_my_profile() (SECURITY DEFINER)
  // is scoped separately and isn't exercised by these checks.
  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `update public.profiles set is_active = true where id = $1`, [IDENTITIES.inactive.id]);
    record({ area, action: 'UPDATE own is_active back to true (self-reactivation after offboarding)', identity: 'inactive', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) affected` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.profiles set designation = 'Self-Promoted Title' where id = $1`, [IDENTITIES.employeeA.id]);
    record({ area, action: 'UPDATE own designation directly (bypassing update_my_profile()\'s field scoping)', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) affected - only phone/photo_url should ever be self-editable, only via the RPC` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `update public.profiles set is_active = false where id = $1`, [IDENTITIES.employeeB.id]);
    record({ area, action: 'UPDATE deactivate a colleague', identity: 'admin', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) affected` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `insert into public.profiles (id, full_name, role) values (gen_random_uuid(), 'Direct insert test', 'employee')`, []);
    record({ area, action: 'INSERT a profile directly (bypassing auth.users trigger)', identity: 'admin', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted - no insert policy should exist for anyone, profiles are only created via handle_new_user()' });
  });
};
