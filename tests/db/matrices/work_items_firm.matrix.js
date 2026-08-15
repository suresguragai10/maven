const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// Master Session Contract's stated rule: "Firm Work = internal ops. All
// active teammates are PEERS - may create, edit, reassign, change
// status/target date... This explicitly INCLUDES reassignment by any
// teammate, not just admin." Firm Work Task 2 shipped admin-only
// reassignment in the UI; Handbook Task 6 fixed the database layer to
// match (20260818090000_work_item_update_authorization.sql) by
// branching on work_scope before any Client-Work-specific ownership
// check. This matrix confirms the peer model actually holds now.
module.exports = async function workItemsFirmMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'work_items (firm scope)';

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.firm.id]);
    record({ area, action: 'SELECT Firm Work item not assigned to them', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'allow', note: 'work_scope=firm branch: visible to any active user regardless of assignment' });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by) values ('New firm task', $1, 'to_do', 'firm', 'Marketing', $2)`,
      [IDENTITIES.admin.id, IDENTITIES.employeeB.id]
    );
    record({ area, action: 'INSERT new Firm Work, assigned to someone else', identity: 'employeeB', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'inserted - confirms any active teammate can create+assign Firm Work at the DB level' });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [WORK_ITEMS.firm.id, IDENTITIES.employeeB.id]);
    record({
      area, action: 'UPDATE (reassign to self) Firm Work not currently assigned to them', identity: 'employeeB',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - FIXED by Handbook Task 6: guard_work_item_update() now branches on work_scope='firm' before any Client-Work ownership check, so a non-assignee peer can reassign Firm Work freely, matching the approved peer model.`,
    });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'UPDATE (status only, not reassigning) Firm Work not assigned to them', identity: 'employeeB',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - FIXED by Handbook Task 6, same fix as reassignment above: a non-assignee peer can now touch any field on Firm Work, not just via a reassignment-shaped update.`,
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [WORK_ITEMS.firm.id]);
    record({ area, action: 'UPDATE own assigned Firm Work', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where work_scope = $1', ['firm']);
    record({ area, action: 'SELECT any Firm Work', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'blocked' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'UPDATE Firm Work as a deactivated profile with a still-valid session', identity: 'inactive',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - blocked twice over: work_items_update's RLS USING clause requires current_user_active() before the row is even targetable, and guard_work_item_update()'s Firm Work branch re-checks it explicitly as defense in depth`,
    });
  });
};
