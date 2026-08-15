const { tryQuery } = require('../support/probe');
const { WORK_ITEMS, CLIENTS } = require('../support/ids');

module.exports = async function workItemsClientMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'work_items (client scope)';

  // ---- Read visibility ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.normal.id]);
    record({ area, action: 'SELECT own assigned item', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow' });
  });

  await asRole(IDENTITIES.reviewerB, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.normal.id]);
    record({
      area, action: 'SELECT an item where they are neither assignee nor the assigned reviewer (reviewer role alone does not grant broad access)', identity: 'reviewerB',
      allowed: r.rowCount > 0, expectedSecure: 'deny',
      note: 'Confirms Handbook Task 5\'s design decision directly: reviewer scope is reviewer_id=them specifically, not blanket reviewer-role visibility into every client\'s work. Matches staff.js loadWork(\'review\')\'s own pre-existing comment about the intended model.',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.other.id]);
    record({
      area, action: 'SELECT a colleague\'s item (status=in_progress, not assigned/reviewing)', identity: 'employeeA',
      allowed: r.rowCount > 0, expectedSecure: 'deny',
      note: 'FIXED by Handbook Task 5 (20260817090000_client_work_select_visibility.sql): work_items_read no longer has a blanket "status <> ready_for_review" branch. Previously any active user could see any non-ready-for-review item regardless of assignment; now correctly scoped to assignee/reviewer/admin.',
    });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.readyForReview.id]);
    record({ area, action: 'SELECT a colleague\'s item that IS ready_for_review', identity: 'employeeB', allowed: r.rowCount > 0, expectedSecure: 'deny', note: 'this is the one status where visibility actually narrows to assignee/reviewer/admin' });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items where id = $1', [WORK_ITEMS.readyForReview.id]);
    record({ area, action: 'SELECT the item they are reviewer on, while ready_for_review', identity: 'reviewerA', allowed: r.rowCount > 0, expectedSecure: 'allow' });
  });

  // ---- Write guard: cross-boundary update blocked by the TRIGGER (RLS's USING clause alone would have matched the row) ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set priority = 'high' where id = $1`, [WORK_ITEMS.other.id]);
    record({
      area, action: 'UPDATE a colleague\'s item they are not assigned to', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - blocked directly by RLS since Handbook Task 5 tightened work_items_update's USING clause to match work_items_read (previously this row was RLS-visible via the removed "status<>ready_for_review" branch and only stopped by guard_work_item_update()'s trigger check; now the row isn't even reachable, so the trigger never gets a chance to run)`,
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'waiting_for_client', waiting_since = current_date where id = $1`, [WORK_ITEMS.normal.id]);
    record({ area, action: 'UPDATE own item\'s status (ordinary case)', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  // ---- Task 3's explicit ask: attempt to change assignee/reviewer/client/scope directly ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [WORK_ITEMS.normal.id, IDENTITIES.employeeB.id]);
    record({ area, action: 'UPDATE own item: reassign to someone else', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - "Only a reviewer or admin can reassign or rescope work"` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set work_scope = 'firm', client_id = null, service_template_id = null, reviewer_id = null where id = $1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE own item: convert Client Work to Firm Work directly', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - blocked as a side effect of the client_id-change guard, not an explicit work_scope check; flagged in docs as a design note, not a live gap`,
    });
  });

  // ---- Genuinely new finding: reviewer's rescope power is NOT limited to review actions ----
  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set client_id = $2 where id = $1`, [WORK_ITEMS.normal.id, CLIENTS.beta.id]);
    record({
      area, action: 'UPDATE (as the item\'s reviewer): move it to a different client entirely', identity: 'reviewerA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - guard_work_item_update()'s reviewer branch skips ALL else-branch checks once role='reviewer' and they match old/new.reviewer_id, so a reviewer can rescope/reassign/change-client on anything they review, not just record review decisions. The V2 Permission Audit's own stated role matrix says "Reviewer = review work / record review activity; Admin/Manager = configure clients" - this contradicts that. New finding, not previously flagged.`,
    });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select id from public.work_items limit 1', []);
    record({ area, action: 'SELECT any work item', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });
};
