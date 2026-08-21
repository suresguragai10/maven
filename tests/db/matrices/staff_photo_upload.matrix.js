// Regression coverage for two real, live findings (2026-08-21):
// 1. The original staff-photos migration only had INSERT/UPDATE/DELETE
//    policies on storage.objects, no SELECT policy. Every upload still
//    failed with "new row violates row-level security policy" even
//    though the INSERT's own WITH CHECK passed -- Postgres RLS also
//    enforces the SELECT policy when an INSERT/UPDATE reads its own row
//    back via RETURNING (which the real Storage API does internally).
//    This matrix exercises that exact path (INSERT ... RETURNING) so a
//    future migration can't silently drop the SELECT policy and
//    reintroduce the same live failure.
// 2. Upload is self-only for every role, including admin, by owner's
//    explicit instruction -- an earlier version of the policy let an
//    admin write into anyone's folder; that capability is deliberately
//    gone, and this matrix guards against it silently coming back.
const { tryQuery } = require('../support/probe');

module.exports = async function staffPhotoUploadMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'staff_photo_upload';
  const ownPath = (id) => `${id}/regression-test.png`;

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id`,
      ['staff-photos', ownPath(IDENTITIES.employeeA.id), IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT (with RETURNING) a photo into own folder', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) - needs both the INSERT and SELECT policies to pass` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id`,
      ['staff-photos', ownPath(IDENTITIES.employeeB.id), IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a photo into a colleague\'s folder', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - only the folder owner should ever be able to write here` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id`,
      ['staff-photos', ownPath(IDENTITIES.employeeA.id), IDENTITIES.admin.id]
    );
    record({ area, action: 'INSERT a photo into a colleague\'s folder (admin uploading on someone else\'s behalf)', identity: 'admin', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - upload is self-only for every role, including admin, by owner's instruction` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(
      c,
      `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id`,
      ['staff-photos', ownPath(IDENTITIES.employeeA.id), null]
    );
    record({ area, action: 'INSERT a photo with no session at all', identity: 'anon', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const seedName = ownPath(IDENTITIES.employeeA.id) + '-seed.png';
    const seed = await tryQuery(c, `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)`, ['staff-photos', seedName, IDENTITIES.employeeA.id]);
    if (!seed.ok) { record({ area, action: 'SELECT a staff-photos object', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: `seed insert itself failed: ${seed.error}` }); return; }
    const r = await tryQuery(c, `select id from storage.objects where bucket_id = $1 and name = $2`, ['staff-photos', seedName]);
    record({ area, action: 'SELECT a staff-photos object', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) - this is the SELECT policy the earlier bug was missing` });
  });
};
