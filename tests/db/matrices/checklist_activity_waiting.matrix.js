const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

module.exports = async function checklistActivityWaitingMatrix({ asRole, IDENTITIES, ANON, record }) {
  // ---- checklist ----
  {
    const area = 'work_checklist_items';

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_checklist_items where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT checklist for a colleague\'s (in_progress) item', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: 'FIXED by Handbook Task 5: work_checklist_items_read\'s exists-subquery no longer has the "status<>ready_for_review" broad branch, matching the parent work_items_read fix.' });
    });

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, `insert into public.work_checklist_items (work_item_id, title) values ($1, 'Unauthorized item')`, [WORK_ITEMS.normal.id]);
      record({ area, action: 'INSERT a checklist item on a colleague\'s work', identity: 'employeeB', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted' });
    });

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, `update public.work_checklist_items set is_done = true where work_item_id = $1`, [WORK_ITEMS.normal.id]);
      record({ area, action: 'UPDATE (toggle) checklist item on own work', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
    });

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, `update public.work_checklist_items set is_done = true where work_item_id = $1`, [WORK_ITEMS.normal.id]);
      record({
        area, action: 'UPDATE (toggle) checklist item on a colleague\'s work', identity: 'employeeB',
        allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
        note: r.error || `${r.rowCount} row(s) - UPDATE never had the broad branch SELECT used to have; only admin/assignee/reviewer can edit, matches sensible design (anyone can watch progress, only the responsible people can change it). Now consistent with SELECT too, post-Task-5.`,
      });
    });
  }

  // ---- work_activity: the actor-spoofing finding ----
  {
    const area = 'work_activity';

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_activity where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT activity log for a colleague\'s (in_progress) item', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: 'FIXED by Handbook Task 5, matching the parent work_items_read fix.' });
    });

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(
        c,
        `insert into public.work_activity (work_item_id, actor_id, action, detail) values ($1, $2, 'completed', 'Fabricated entry - actor_id set to someone else')`,
        [WORK_ITEMS.normal.id, IDENTITIES.admin.id]
      );
      record({
        area, action: 'INSERT an activity row with actor_id set to someone ELSE (not themselves)', identity: 'employeeA',
        allowed: r.ok, expectedSecure: 'deny',
        note: r.error || 'inserted - NEW FINDING: work_activity_insert\'s WITH CHECK only verifies the caller is admin/assignee/reviewer on the work item, it never checks actor_id = auth.uid(). Any assignee/reviewer/admin can insert a work_activity row attributing an action to a DIFFERENT profile. The "immutable audit trail" (no UPDATE/DELETE policy) is only tamper-proof against edits after the fact, not against a fabricated entry at insert time.',
      });
    });

    await asRole(IDENTITIES.admin, async (c) => {
      const r = await tryQuery(c, `update public.work_activity set detail = 'edited' where work_item_id = $1`, [WORK_ITEMS.normal.id]);
      record({ area, action: 'UPDATE an existing activity entry', identity: 'admin', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - correctly immutable even for admin, no update policy exists` });
    });
  }

  // ---- work_waiting_items ----
  {
    const area = 'work_waiting_items';

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_waiting_items where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT waiting items for a colleague\'s (in_progress) item', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: 'FIXED by Handbook Task 5, matching the parent work_items_read fix.' });
    });

    await asRole(IDENTITIES.employeeB, async (c) => {
      const r = await tryQuery(c, `insert into public.work_waiting_items (work_item_id, title) values ($1, 'Unauthorized item')`, [WORK_ITEMS.normal.id]);
      record({ area, action: 'INSERT a waiting item on a colleague\'s work', identity: 'employeeB', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted' });
    });

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, `update public.work_waiting_items set is_received = true where work_item_id = $1`, [WORK_ITEMS.normal.id]);
      record({ area, action: 'UPDATE (mark received) waiting item on own work', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
    });

    await asRole(ANON, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_waiting_items limit 1', []);
      record({ area, action: 'SELECT any waiting item', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });
  }
};
