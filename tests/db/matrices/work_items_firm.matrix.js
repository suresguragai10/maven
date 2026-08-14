const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// Master Session Contract's stated rule: "Firm Work = internal ops. All
// active teammates are PEERS - may create, edit, reassign, change
// status/target date... This explicitly INCLUDES reassignment by any
// teammate, not just admin." Firm Work Task 2 shipped admin-only
// reassignment in the UI, already flagged as a known conflict awaiting
// Handbook Task 16. This matrix confirms, at the database level, exactly
// how far that conflict actually goes.
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
      note: r.error || `${r.rowCount} row(s) - THE KNOWN CONFLICT, confirmed at the DB level: guard_work_item_update()'s else-branch "You can only update work assigned to you" applies to Firm Work identically to Client Work; there is no peer-reassignment carve-out. This is the exact gap Handbook Task 16 is scoped to fix.`,
    });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'UPDATE (status only, not reassigning) Firm Work not assigned to them', identity: 'employeeB',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - broader than "reassignment" alone: a non-assignee peer currently cannot touch ANY field on someone else's Firm Work, not just the assignee field. Worth Task 16 knowing the fix needs to cover the whole else-branch for work_scope='firm', not just the reassignment check specifically.`,
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
};
