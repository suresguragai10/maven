const { tryQuery } = require('../support/probe');

module.exports = async function attendanceMatrix({ asRole, asSuperuser, IDENTITIES, record }) {
  const area = 'attendance';

  // Start from a deterministic empty attendance state for this matrix.
  await asSuperuser(async (c) => {
    await c.query('delete from public.attendance_corrections');
    await c.query('delete from public.attendance_entries');
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_in()).id as id', []);
    record({ area, action: 'Punch in for own current Nepal work date', identity: 'employeeA', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'allow', note: punch.error || 'RPC created own attendance entry' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const own = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Read own attendance', identity: 'employeeA', allowed: own.rowCount > 0, expectedSecure: 'allow', note: own.error || `${own.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const other = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Read another employee attendance', identity: 'employeeB', allowed: other.rowCount > 0, expectedSecure: 'deny', note: other.error || `${other.rowCount} row(s) — RLS should hide colleague attendance` });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const other = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Reviewer reads employee attendance', identity: 'reviewerA', allowed: other.rowCount > 0, expectedSecure: 'deny', note: other.error || `${other.rowCount} row(s) — reviewer has no all-attendance privilege` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const all = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Admin reads employee attendance', identity: 'admin', allowed: all.rowCount > 0, expectedSecure: 'allow', note: all.error || `${all.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const direct = await tryQuery(c,
      `insert into public.attendance_entries (user_id, work_date, punched_in_at)
       values ($1, current_date - 10, now())`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Direct INSERT attendance bypassing punch RPC', identity: 'employeeA', allowed: direct.ok && direct.rowCount > 0, expectedSecure: 'deny', note: direct.error || `${direct.rowCount} row(s) affected — no INSERT RLS policy should exist` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const correction = await tryQuery(c,
      `select (public.attendance_admin_correct($1, current_date - 5, now() - interval '8 hours', now(), 'employee bypass attempt')).id`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Call admin correction RPC', identity: 'employeeA', allowed: correction.ok && correction.rows.length > 0, expectedSecure: 'deny', note: correction.error || 'unexpectedly corrected attendance' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const correction = await tryQuery(c,
      `select (public.attendance_admin_correct($1, current_date - 5, now() - interval '8 hours', now(), 'approved missing punch correction')).id as id`,
      [IDENTITIES.employeeB.id]
    );
    record({ area, action: 'Correct/add employee attendance with reason', identity: 'admin', allowed: correction.ok && correction.rows.length > 0, expectedSecure: 'allow', note: correction.error || 'admin correction RPC succeeded' });

    const audit = await tryQuery(c,
      'select id from public.attendance_corrections where user_id = $1 and reason = $2',
      [IDENTITIES.employeeB.id, 'approved missing punch correction']
    );
    record({ area, action: 'Correction creates audit history', identity: 'admin', allowed: audit.rowCount > 0, expectedSecure: 'allow', note: audit.error || `${audit.rowCount} correction row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Read another employee correction history', identity: 'employeeA', allowed: audit.rowCount > 0, expectedSecure: 'deny', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Read own correction history', identity: 'employeeB', allowed: audit.rowCount > 0, expectedSecure: 'allow', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_in()).id', []);
    record({ area, action: 'Punch in after account deactivation', identity: 'inactive', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'deny', note: punch.error || 'unexpectedly punched in' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const punchOut = await tryQuery(c, 'select (public.attendance_punch_out()).id as id', []);
    record({ area, action: 'Punch out own open attendance', identity: 'employeeA', allowed: punchOut.ok && punchOut.rows.length > 0, expectedSecure: 'allow', note: punchOut.error || 'own attendance closed' });
  });
};
