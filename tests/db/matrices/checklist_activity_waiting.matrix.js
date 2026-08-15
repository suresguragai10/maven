const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

module.exports = async function checklistActivityWaitingMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
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

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_checklist_items where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT checklist, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
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

    // ---- Handbook Task 9: deactivated profile, still-valid session, plus
    // "historical records referencing an inactive user stay readable" ----
    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_activity where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT activity log, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });

    // Simulates a row that was really inserted back when this profile was
    // still active (bypasses RLS via the raw superuser connection — this
    // is standing in for real historical data, not a normal app write,
    // and is NOT wrapped in asRole()'s BEGIN...ROLLBACK, so it genuinely
    // persists for the rest of this run, same as real seed data would).
    await asSuperuser(async (c) => {
      await c.query(
        `insert into public.work_activity (work_item_id, actor_id, action, detail, source) values ($1, $2, 'status_changed', 'Historical entry from before deactivation', 'system')`,
        [WORK_ITEMS.normal.id, IDENTITIES.inactive.id]
      );
    });
    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(
        c,
        `select wa.detail, p.full_name from public.work_activity wa join public.profiles p on p.id = wa.actor_id where wa.work_item_id = $1 and wa.actor_id = $2`,
        [WORK_ITEMS.normal.id, IDENTITIES.inactive.id]
      );
      record({
        area, action: 'SELECT (as an active teammate) historical activity authored by the now-deactivated profile, including resolving their name', identity: 'employeeA',
        allowed: r.rowCount > 0 && !!(r.rows[0] && r.rows[0].full_name), expectedSecure: 'allow',
        note: r.error || (r.rowCount > 0 ? `found: "${r.rows[0].detail}" by ${r.rows[0].full_name} - deactivation never deletes/hides historical actor references` : 'not found'),
      });
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

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.work_waiting_items where work_item_id = $1', [WORK_ITEMS.normal.id]);
      record({ area, action: 'SELECT waiting items, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });
  }
};
