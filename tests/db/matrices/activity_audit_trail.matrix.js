const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// Handbook Task 7: proves the audit trail exists because the database
// transition happened, not because the browser remembered to log it --
// by making the change via the API exactly like staff.js would (a plain
// work_items UPDATE, no separate activity insert at all) and then
// checking, as an independent query, that a matching work_activity row
// appeared anyway.
module.exports = async function activityAuditTrailMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'work_activity (trustworthy audit trail)';

  // ---- Direct API status change creates history with no explicit log call ----
  // Update and verification happen inside the SAME transaction (asRole()
  // wraps every check in BEGIN...ROLLBACK for isolation, so a separate
  // asSuperuser() call afterward would see the update already undone --
  // querying within the same connection/transaction, after the UPDATE,
  // is how you observe a trigger's own side effect without needing to
  // actually commit real state anywhere).
  await asRole(IDENTITIES.employeeA, async (c) => {
    const upd = await tryQuery(c, `update public.work_items set status = 'waiting_for_client', waiting_since = current_date where id = $1`, [WORK_ITEMS.normal.id]);
    const check = await tryQuery(c, `select action, source, detail from public.work_activity where work_item_id = $1 and action = 'status_changed' order by created_at desc limit 1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE status via a plain UPDATE, then check a status_changed row appeared with no separate activity insert issued', identity: 'employeeA',
      allowed: upd.ok && check.rowCount > 0 && check.rows[0].source === 'system', expectedSecure: 'allow',
      note: !upd.ok ? upd.error : (check.rowCount > 0 ? `found: source=${check.rows[0].source} detail="${check.rows[0].detail}"` : 'no matching row found — the trigger did not log it'),
    });
  });

  // ---- Direct API reassignment creates history ----
  await asRole(IDENTITIES.admin, async (c) => {
    const upd = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [WORK_ITEMS.firm.id, IDENTITIES.employeeB.id]);
    const check = await tryQuery(c, `select action, source, detail from public.work_activity where work_item_id = $1 and action = 'reassigned' order by created_at desc limit 1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'UPDATE Firm Work assignee via a plain UPDATE, then check a reassigned row appeared with no separate activity insert issued', identity: 'admin',
      allowed: upd.ok && check.rowCount > 0 && check.rows[0].source === 'system', expectedSecure: 'allow',
      note: !upd.ok ? upd.error : (check.rowCount > 0 ? `found: source=${check.rows[0].source} detail="${check.rows[0].detail}"` : 'no matching row found'),
    });
  });

  // ---- Forged system events rejected ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_activity (work_item_id, actor_id, action, detail, source) values ($1, $2, 'status_changed', 'Fabricated: Completed', 'system')`,
      [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a forged system-shaped event directly (source=system, action=status_changed)', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted — forgery succeeded' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_activity (work_item_id, actor_id, action, detail, source) values ($1, $2, 'reassigned', 'Fabricated reassignment', 'client')`,
      [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a forged reassignment event with source=client (action not on the allowlist)', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted — forgery succeeded' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_activity (work_item_id, actor_id, action, detail, source) values ($1, $2, 'checklist_toggled', 'Checked off: fake item', 'client')`,
      [WORK_ITEMS.normal.id, IDENTITIES.admin.id]
    );
    record({
      area, action: 'INSERT an allowlisted action but with actor_id spoofed to someone else', identity: 'employeeA',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'inserted — actor spoofing succeeded even on an allowlisted action type',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_activity (work_item_id, actor_id, action, detail) values ($1, $2, 'checklist_toggled', 'Checked off: real item')`,
      [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'INSERT an allowlisted action, correct actor, but omitting source (defaults to \'system\')', identity: 'employeeA',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'inserted — the source column\'s default (\'system\') was NOT overridden by the WITH CHECK requiring \'client\', so an accidental omission would have silently mislabeled a client row as system',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_activity (work_item_id, actor_id, action, detail, source) values ($1, $2, 'checklist_toggled', 'Checked off: real item', 'client')`,
      [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a genuinely legitimate allowlisted client action (correct actor, correct source)', identity: 'employeeA', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'inserted' });
  });

  // ---- Immutability still holds ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `update public.work_activity set detail = 'tampered' where work_item_id = $1`, [WORK_ITEMS.normal.id]);
    record({ area, action: 'UPDATE an existing activity entry, even as admin', identity: 'admin', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - still no UPDATE policy` });
  });

  // ---- Previous activity remains readable ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `select id from public.work_activity where work_item_id = $1 and action = 'created'`, [WORK_ITEMS.normal.id]);
    record({ area, action: 'SELECT the original "created" activity entry, seeded before this migration existed', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow', note: `${r.rowCount} row(s) - pre-existing history survives the migration and stays readable` });
  });

  // ---- created_by is forced from the authenticated caller, not client input ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const fakeCreator = IDENTITIES.admin.id;
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by) values ('Spoofed creator test', $1, 'to_do', 'firm', 'Research', $2) returning created_by`,
      [IDENTITIES.employeeB.id, fakeCreator]
    );
    record({
      area, action: 'INSERT a new work item with created_by spoofed to someone else', identity: 'employeeB',
      allowed: r.ok && r.rows[0] && r.rows[0].created_by === fakeCreator, expectedSecure: 'deny',
      note: r.error || `created_by ended up as ${r.rows[0] && r.rows[0].created_by} (requested spoof: ${fakeCreator}, real caller: ${IDENTITIES.employeeB.id}) — should always equal the real caller, forced by the new BEFORE INSERT trigger`,
    });
  });
};
