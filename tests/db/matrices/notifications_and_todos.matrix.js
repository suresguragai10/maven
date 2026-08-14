const { tryQuery } = require('../support/probe');

module.exports = async function notificationsAndTodosMatrix({ asRole, IDENTITIES, ANON, record }) {
  {
    const area = 'notifications';

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, 'select id from public.notifications where user_id = $1', [IDENTITIES.employeeA.id]);
      record({ area, action: 'SELECT own notifications', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow' });
    });

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, 'select id from public.notifications where user_id = $1', [IDENTITIES.employeeA.id]);
      record({ area, action: 'SELECT a colleague\'s notifications', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - strict ownership` });
    });

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.notifications where user_id = $1', [IDENTITIES.inactive.id]);
      record({
        area, action: 'SELECT own notifications (as a deactivated profile with a still-valid session)', identity: 'inactive',
        allowed: r.rowCount > 0, expectedSecure: 'deny',
        note: r.error || `${r.rowCount} row(s) - notifications_read is pure auth.uid()=user_id ownership, never touched by the is_active hardening pass (20260815090000's own stated scope excludes it as "moot"). A still-valid deactivated session keeps reading its own old notifications.`,
      });
    });

    await asRole(ANON, async (c) => {
      const r = await tryQuery(c, 'select id from public.notifications limit 1', []);
      record({ area, action: 'SELECT any notification', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });
  }

  {
    const area = 'personal_todos';

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, 'select id from public.personal_todos where user_id = $1', [IDENTITIES.employeeA.id]);
      record({ area, action: 'SELECT own to-dos', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow' });
    });

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, 'select id from public.personal_todos where user_id = $1', [IDENTITIES.employeeA.id]);
      record({ area, action: 'SELECT a colleague\'s to-dos', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.personal_todos where user_id = $1', [IDENTITIES.inactive.id]);
      record({
        area, action: 'SELECT own to-dos (as a deactivated profile with a still-valid session)', identity: 'inactive',
        allowed: r.rowCount > 0, expectedSecure: 'deny',
        note: r.error || `${r.rowCount} row(s) - same gap as notifications: pure ownership check, never gated on is_active.`,
      });
    });
  }
};
