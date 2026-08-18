const { tryQuery } = require('../support/probe');

module.exports = async function attendanceMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
  const area = 'attendance';

  // Start from a deterministic empty attendance state for this matrix.
  await asSuperuser(async (c) => {
    await c.query('delete from public.attendance_corrections');
    await c.query('delete from public.attendance_entries');
  });

  // The harness intentionally rolls every asRole() transaction back. RPC
  // behavior is therefore tested inside its own transaction, while read/RLS
  // checks use explicit superuser-created fixtures that persist between checks.
  await asRole(IDENTITIES.employeeA, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_in()).id as id', []);
    record({ area, action: 'Punch in for own current Nepal work date', identity: 'employeeA', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'allow', note: punch.error || 'RPC created own attendance entry' });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const first = await tryQuery(c, 'select (public.attendance_punch_in()).id as id', []);
    const second = first.ok
      ? await tryQuery(c, 'select (public.attendance_punch_in()).id as id', [])
      : { ok: false, rows: [], error: `first punch failed: ${first.error}` };
    record({ area, action: 'Second punch in on same Nepal work date', identity: 'employeeB', allowed: second.ok && second.rows.length > 0, expectedSecure: 'deny', note: second.error || 'unexpectedly accepted a second punch-in' });
  });

  // Persistent fixture for independent SELECT/RLS checks. This is setup data,
  // not the action under test; role behavior below still runs through asRole().
  await asSuperuser(async (c) => {
    await c.query(
      `insert into public.attendance_entries (user_id, work_date, punched_in_at, punched_out_at)
       values (
         $1,
         public.attendance_nepal_work_date(now()) - 1,
         now() - interval '1 day 8 hours',
         now() - interval '1 day'
       )`,
      [IDENTITIES.employeeA.id]
    );
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const own = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Read own attendance', identity: 'employeeA', allowed: own.rowCount > 0, expectedSecure: 'allow', note: own.error || `${own.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const other = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Read another employee attendance', identity: 'employeeB', allowed: other.rowCount > 0, expectedSecure: 'deny', note: other.error || `${other.rowCount} row(s) - RLS should hide colleague attendance` });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const other = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Reviewer reads employee attendance', identity: 'reviewerA', allowed: other.rowCount > 0, expectedSecure: 'deny', note: other.error || `${other.rowCount} row(s) - reviewer has no all-attendance privilege` });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const ownPunch = await tryQuery(c, 'select (public.attendance_punch_in()).id as id', []);
    record({ area, action: 'Reviewer punches own attendance', identity: 'reviewerA', allowed: ownPunch.ok && ownPunch.rows.length > 0, expectedSecure: 'allow', note: ownPunch.error || 'reviewer created own attendance entry' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const all = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Admin reads employee attendance', identity: 'admin', allowed: all.rowCount > 0, expectedSecure: 'allow', note: all.error || `${all.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select id from public.attendance_entries where user_id = $1', [IDENTITIES.employeeA.id]);
    record({ area, action: 'Read attendance after account deactivation', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - inactive sessions must not read attendance` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const direct = await tryQuery(c,
      `insert into public.attendance_entries (user_id, work_date, punched_in_at)
       values ($1, ((now() at time zone 'Asia/Kathmandu')::date - 10), now())`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Direct INSERT attendance bypassing punch RPC', identity: 'employeeA', allowed: direct.ok && direct.rowCount > 0, expectedSecure: 'deny', note: direct.error || `${direct.rowCount} row(s) affected - no INSERT RLS policy should exist` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const directUpdate = await tryQuery(c,
      `update public.attendance_entries set punched_out_at = now() where user_id = $1`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Direct UPDATE attendance bypassing punch RPC', identity: 'employeeA', allowed: directUpdate.ok && directUpdate.rowCount > 0, expectedSecure: 'deny', note: directUpdate.error || `${directUpdate.rowCount} row(s) affected - no UPDATE RLS policy should exist` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const directDelete = await tryQuery(c,
      `delete from public.attendance_entries where user_id = $1`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Direct DELETE attendance bypassing controlled RPCs', identity: 'employeeA', allowed: directDelete.ok && directDelete.rowCount > 0, expectedSecure: 'deny', note: directDelete.error || `${directDelete.rowCount} row(s) affected - no DELETE RLS policy should exist` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const directUpdate = await tryQuery(c,
      `update public.attendance_entries
       set punched_in_at = punched_in_at + interval '1 minute'
       where user_id = $1`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Admin direct UPDATE attendance bypassing correction RPC', identity: 'admin', allowed: directUpdate.ok && directUpdate.rowCount > 0, expectedSecure: 'deny', note: directUpdate.error || `${directUpdate.rowCount} row(s) affected - admin corrections must use the audited RPC` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const directDelete = await tryQuery(c,
      'delete from public.attendance_entries where user_id = $1',
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Admin direct DELETE attendance', identity: 'admin', allowed: directDelete.ok && directDelete.rowCount > 0, expectedSecure: 'deny', note: directDelete.error || `${directDelete.rowCount} row(s) affected - attendance history must not be silently deleted` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const correction = await tryQuery(c,
      `select (public.attendance_admin_correct($1, ((now() at time zone 'Asia/Kathmandu')::date - 5), now() - interval '8 hours', now(), 'employee bypass attempt')).id`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Call admin correction RPC', identity: 'employeeA', allowed: correction.ok && correction.rows.length > 0, expectedSecure: 'deny', note: correction.error || 'unexpectedly corrected attendance' });
  });

  // Expected exceptions must live in their own transaction. In PostgreSQL an
  // error aborts the current transaction, so combining this denial with the
  // following valid admin correction would make the valid check meaningless.
  await asRole(IDENTITIES.admin, async (c) => {
    const missingReason = await tryQuery(c,
      `select (public.attendance_admin_correct($1, ((now() at time zone 'Asia/Kathmandu')::date - 6), now() - interval '8 hours', now(), ' ')).id as id`,
      [IDENTITIES.employeeB.id]
    );
    record({ area, action: 'Admin correction without meaningful reason', identity: 'admin', allowed: missingReason.ok && missingReason.rows.length > 0, expectedSecure: 'deny', note: missingReason.error || 'unexpectedly accepted blank correction reason' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const correction = await tryQuery(c,
      `select (public.attendance_admin_correct($1, ((now() at time zone 'Asia/Kathmandu')::date - 5), now() - interval '8 hours', now(), 'approved missing punch correction')).id as id`,
      [IDENTITIES.employeeB.id]
    );
    record({ area, action: 'Correct/add employee attendance with reason', identity: 'admin', allowed: correction.ok && correction.rows.length > 0, expectedSecure: 'allow', note: correction.error || 'admin correction RPC succeeded' });

    if (correction.ok) {
      const audit = await tryQuery(c,
        'select id from public.attendance_corrections where user_id = $1 and reason = $2',
        [IDENTITIES.employeeB.id, 'approved missing punch correction']
      );
      record({ area, action: 'Correction creates audit history', identity: 'admin', allowed: audit.rowCount > 0, expectedSecure: 'allow', note: audit.error || `${audit.rowCount} correction row(s)` });
    } else {
      record({ area, action: 'Correction creates audit history', identity: 'admin', allowed: false, expectedSecure: 'allow', note: `correction RPC failed first: ${correction.error}` });
    }
  });

  // Persistent audit fixture for independent correction-history RLS checks.
  await asSuperuser(async (c) => {
    const entry = await c.query(
      `insert into public.attendance_entries (user_id, work_date, punched_in_at, punched_out_at)
       values (
         $1,
         public.attendance_nepal_work_date(now()) - 7,
         now() - interval '7 days 8 hours',
         now() - interval '7 days'
       )
       returning id, user_id, work_date, punched_in_at, punched_out_at`,
      [IDENTITIES.employeeB.id]
    );
    const row = entry.rows[0];
    await c.query(
      `insert into public.attendance_corrections (
         attendance_entry_id, user_id, work_date,
         old_punched_in_at, old_punched_out_at,
         new_punched_in_at, new_punched_out_at,
         reason, corrected_by
       ) values ($1, $2, $3, null, null, $4, $5, $6, $7)`,
      [row.id, row.user_id, row.work_date, row.punched_in_at, row.punched_out_at, 'fixture correction history', IDENTITIES.admin.id]
    );
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Read another employee correction history', identity: 'employeeA', allowed: audit.rowCount > 0, expectedSecure: 'deny', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Reviewer reads another employee correction history', identity: 'reviewerA', allowed: audit.rowCount > 0, expectedSecure: 'deny', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Read own correction history', identity: 'employeeB', allowed: audit.rowCount > 0, expectedSecure: 'allow', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const audit = await tryQuery(c, 'select id from public.attendance_corrections where user_id = $1', [IDENTITIES.employeeB.id]);
    record({ area, action: 'Admin reads employee correction history', identity: 'admin', allowed: audit.rowCount > 0, expectedSecure: 'allow', note: audit.error || `${audit.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const directDelete = await tryQuery(c,
      'delete from public.attendance_corrections where user_id = $1',
      [IDENTITIES.employeeB.id]
    );
    record({ area, action: 'Admin direct DELETE correction audit history', identity: 'admin', allowed: directDelete.ok && directDelete.rowCount > 0, expectedSecure: 'deny', note: directDelete.error || `${directDelete.rowCount} row(s) affected - audit history must be immutable through the app role` });
  });

  // Compare date text in SQL so the pg driver cannot convert DATE values into
  // JavaScript Date objects and accidentally apply another timezone.
  await asSuperuser(async (c) => {
    const boundary = await tryQuery(c,
      `select
         public.attendance_nepal_work_date('2026-08-17 18:14:59+00'::timestamptz)::text as before_midnight,
         public.attendance_nepal_work_date('2026-08-17 18:15:00+00'::timestamptz)::text as at_midnight`,
      []
    );
    const row = boundary.rows && boundary.rows[0];
    const allowed = !!row && row.before_midnight === '2026-08-17' && row.at_midnight === '2026-08-18';
    record({ area, action: 'Nepal midnight work-date boundary', identity: 'database', allowed, expectedSecure: 'allow', note: boundary.error || JSON.stringify(row) });
  });

  // Schema proof: attendance must not grow surveillance columns by accident.
  await asSuperuser(async (c) => {
    const surveillance = await tryQuery(c,
      `select table_name, column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name in ('attendance_entries', 'attendance_corrections')
         and lower(column_name) ~ '(gps|latitude|longitude|location|ip|device|screenshot|presence|productivity)'`,
      []
    );
    record({ area, action: 'Attendance schema contains no surveillance fields', identity: 'database', allowed: surveillance.ok && surveillance.rowCount === 0, expectedSecure: 'allow', note: surveillance.error || (surveillance.rowCount === 0 ? 'no surveillance-style columns found' : JSON.stringify(surveillance.rows)) });
  });

  // Anonymous callers must not be able to execute any attendance mutation RPC.
  await asRole(ANON, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_in()).id', []);
    record({ area, action: 'Anonymous call to punch-in RPC', identity: 'anon', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'deny', note: punch.error || 'unexpectedly punched in anonymously' });
  });

  await asRole(ANON, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_out()).id', []);
    record({ area, action: 'Anonymous call to punch-out RPC', identity: 'anon', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'deny', note: punch.error || 'unexpectedly punched out anonymously' });
  });

  await asRole(ANON, async (c) => {
    const correction = await tryQuery(c,
      `select (public.attendance_admin_correct($1, ((now() at time zone 'Asia/Kathmandu')::date - 5), now() - interval '8 hours', now(), 'anonymous bypass attempt')).id`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Anonymous call to admin correction RPC', identity: 'anon', allowed: correction.ok && correction.rows.length > 0, expectedSecure: 'deny', note: correction.error || 'unexpectedly corrected attendance anonymously' });
  });

  // update_my_profile() is the controlled self-service path added by the same
  // migration. Prove allowed fields can change while admin-managed fields do not.
  await asRole(IDENTITIES.employeeA, async (c) => {
    const before = await tryQuery(c,
      `select role, is_active, designation, work_email, join_date::text as join_date
       from public.profiles where id = $1`,
      [IDENTITIES.employeeA.id]
    );
    const updated = await tryQuery(c,
      'select * from public.update_my_profile($1, $2)',
      ['+977-9800000000', '/assets/staff/employee-a.jpg']
    );
    const after = updated.ok
      ? await tryQuery(c,
          `select phone, photo_url, role, is_active, designation, work_email, join_date::text as join_date
           from public.profiles where id = $1`,
          [IDENTITIES.employeeA.id]
        )
      : { ok: false, rows: [], error: `profile update failed: ${updated.error}` };

    const afterRow = after.rows && after.rows[0];
    record({
      area,
      action: 'Update own permitted profile fields through controlled RPC',
      identity: 'employeeA',
      allowed: !!afterRow && afterRow.phone === '+977-9800000000' && afterRow.photo_url === '/assets/staff/employee-a.jpg',
      expectedSecure: 'allow',
      note: updated.error || after.error || 'phone/photo updated through update_my_profile()'
    });

    const beforeRow = before.rows && before.rows[0];
    const protectedUnchanged = !!beforeRow && !!afterRow
      && beforeRow.role === afterRow.role
      && beforeRow.is_active === afterRow.is_active
      && beforeRow.designation === afterRow.designation
      && beforeRow.work_email === afterRow.work_email
      && beforeRow.join_date === afterRow.join_date;
    record({
      area,
      action: 'Self-profile RPC preserves admin-managed fields',
      identity: 'employeeA',
      allowed: protectedUnchanged,
      expectedSecure: 'allow',
      note: before.error || after.error || 'role/active/designation/work_email/join_date unchanged'
    });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const update = await tryQuery(c, 'select * from public.update_my_profile($1, $2)', ['+977-9800000001', null]);
    record({ area, action: 'Update profile after account deactivation', identity: 'inactive', allowed: update.ok && update.rows.length > 0, expectedSecure: 'deny', note: update.error || 'unexpectedly updated inactive profile' });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const punch = await tryQuery(c, 'select (public.attendance_punch_in()).id', []);
    record({ area, action: 'Punch in after account deactivation', identity: 'inactive', allowed: punch.ok && punch.rows.length > 0, expectedSecure: 'deny', note: punch.error || 'unexpectedly punched in' });
  });

  // Seed one open current-day row outside asRole(); the punch-out action itself
  // is still performed as employeeA and rolled back afterward.
  await asSuperuser(async (c) => {
    await c.query(
      `insert into public.attendance_entries (user_id, work_date, punched_in_at)
       values ($1, public.attendance_nepal_work_date(now()), now() - interval '1 hour')`,
      [IDENTITIES.employeeA.id]
    );
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const punchOut = await tryQuery(c, 'select (public.attendance_punch_out()).id as id', []);
    record({ area, action: 'Punch out own open attendance', identity: 'employeeA', allowed: punchOut.ok && punchOut.rows.length > 0, expectedSecure: 'allow', note: punchOut.error || 'own attendance closed' });
  });

  // Leave the disposable database clean for consistency, even though attendance
  // is currently the final matrix in the run order.
  await asSuperuser(async (c) => {
    await c.query('delete from public.attendance_corrections');
    await c.query('delete from public.attendance_entries');
  });
};