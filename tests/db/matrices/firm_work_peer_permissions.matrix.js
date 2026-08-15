const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// Handbook Task 16: direct, empirical proof of every item in the task's
// own "TEST DIRECTLY" list. WORK_ITEMS.firm is seeded assigned to
// employeeA (see tests/db/support/seed.js) -- employeeB and reviewerA
// are both genuine non-owners of it, exactly the "peer editing someone
// else's Firm Work" scenario this task is about.
module.exports = async function firmWorkPeerPermissionsMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'Firm Work peer permissions (Handbook Task 16)';

  // ---- employee A edits Firm Work owned by employee B -> allowed.
  // (WORK_ITEMS.firm is owned by employeeA, so this uses employeeB
  // editing employeeA's item -- the same relationship, whichever
  // direction; named to match the task's own phrasing.) ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(
      c,
      `update public.work_items set title = 'Renamed by a non-owner peer', description = 'Edited by employeeB', priority = 'high' where id = $1`,
      [WORK_ITEMS.firm.id]
    );
    record({
      area, action: 'Employee edits title/description/priority on Firm Work owned by a different employee', identity: 'employeeB',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - ownership identifies responsibility, not exclusive edit rights`,
    });
  });

  // ---- reviewer edits another user's Firm Work -> allowed while active ----
  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'in_progress', next_action = 'Follow up with landlord' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Reviewer edits status/next_action on Firm Work not assigned to or reviewed by them', identity: 'reviewerA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - Firm Work has no reviewer concept; a reviewer is just another active teammate here`,
    });
  });

  // ---- active user reassigns to active teammate -> allowed + history ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const upd = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [WORK_ITEMS.firm.id, IDENTITIES.reviewerA.id]);
    const activity = await tryQuery(c, `select detail from public.work_activity where work_item_id = $1 and action = 'reassigned' order by created_at desc limit 1`, [WORK_ITEMS.firm.id]);
    const logged = activity.ok && activity.rowCount > 0 && (activity.rows[0].detail || '').includes('Reviewer A');
    record({
      area, action: 'Reassign Firm Work to a different active teammate, and confirm it is logged to activity history', identity: 'employeeB',
      allowed: upd.ok && upd.rowCount > 0 && logged, expectedSecure: 'allow',
      note: (upd.error || activity.error) || (logged ? `reassigned and logged: "${activity.rows[0].detail}"` : 'CRITICAL: reassignment succeeded but was not recorded in activity history'),
    });
  });

  // ---- assignment to inactive teammate -> denied (both at creation and
  // at reassignment time) ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
       values ('Should be rejected', $1, 'to_do', 'firm', 'Administration', $2)`,
      [IDENTITIES.inactive.id, IDENTITIES.admin.id]
    );
    record({
      area, action: 'CREATE Firm Work assigned to a deactivated profile', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: Firm Work was created assigned to someone who cannot act on it',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [WORK_ITEMS.firm.id, IDENTITIES.inactive.id]);
    record({
      area, action: 'REASSIGN existing Firm Work to a deactivated profile', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - CRITICAL: Firm Work was reassigned to someone who cannot act on it`,
    });
  });

  // ---- inactive user -> denied (their own attempt to touch Firm Work
  // at all, regardless of who it's assigned to) ----
  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `update public.work_items set title = 'Should not be allowed' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Deactivated profile with a still-valid session attempts to edit Firm Work', identity: 'inactive',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - blocked both by RLS (current_user_active() in work_items_update) and by guard_work_item_update()'s own explicit check`,
    });
  });

  // ---- attempt to change work_scope -> denied, even for admin ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `update public.work_items set work_scope = 'client', client_id = null where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Attempt to change work_scope from firm to client, as admin', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - CRITICAL: Firm Work was rescoped into Client Work, which could be used to bypass Client Work's compliance permissions`,
    });
  });

  // ---- checklist: manage-by-any-peer (the RLS gap this task closes --
  // previously only admin/current-assignee/reviewer could write) ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const ins = await tryQuery(c, `insert into public.work_checklist_items (work_item_id, title) values ($1, 'Peer-added checklist item') returning id`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Add a checklist item to Firm Work not assigned to them', identity: 'employeeB',
      allowed: ins.ok && ins.rowCount === 1, expectedSecure: 'allow',
      note: ins.error || `${ins.rowCount} row(s) - FIXED by this task: work_checklist_items_write previously had no work_scope='firm' branch at all`,
    });
    if (ins.ok && ins.rows[0]) {
      const upd = await tryQuery(c, `update public.work_checklist_items set is_done = true where id = $1`, [ins.rows[0].id]);
      record({
        area, action: 'Toggle a checklist item on Firm Work not assigned to them', identity: 'employeeB',
        allowed: upd.ok && upd.rowCount > 0, expectedSecure: 'allow',
        note: upd.error || `${upd.rowCount} row(s) - FIXED by this task: work_checklist_items_update previously had no work_scope='firm' branch either`,
      });
    }
  });

  // ---- updates/comments: already open to any peer who can see the
  // item (Firm Work's status is never 'ready_for_review', so the
  // pre-existing catch-all already covers it) -- re-verified directly,
  // not re-implemented ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `insert into public.work_comments (work_item_id, author_id, body) values ($1, $2, 'Chiming in as a peer, not the owner.')`, [WORK_ITEMS.firm.id, IDENTITIES.employeeB.id]);
    record({ area, action: 'Post an update/comment on Firm Work not assigned to them', identity: 'employeeB', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'already worked before this task; re-verified here directly' });
  });

  // ---- anon stays fully locked out ----
  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, `update public.work_items set title = 'Should not be allowed' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Anonymous attempts to edit Firm Work', identity: 'anon',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - CRITICAL: no login at all was enough to edit Firm Work`,
    });
  });
};
