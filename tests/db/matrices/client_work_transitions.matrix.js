const { tryQuery } = require('../support/probe');
const { WORK_ITEMS, CLIENTS } = require('../support/ids');

// Handbook Task 8: guard_work_item_update()'s transition map + required-
// checklist gates. Every test below does its own setup AND the gated
// action in the SAME asRole() call/transaction -- asRole() wraps each
// call in BEGIN...ROLLBACK for isolation, so state from one call never
// carries into the next (a lesson learned the hard way while building
// Task 7's equivalent tests).
module.exports = async function clientWorkTransitionsMatrix({ asRole, IDENTITIES, record }) {
  const area = 'Client Work transitions + checklist gates';

  // ---- Obvious jump, skipping every stage ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, created_by) values ($1, 'Fresh scratch item', $2, 'to_do', 'client', $2) returning id`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    if (!ins.ok) { record({ area, action: 'SETUP FAILED for to_do -> completed jump test', identity: 'employeeA', allowed: false, expectedSecure: 'deny', note: ins.error }); return; }
    const jump = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [ins.rows[0].id]);
    record({
      area, action: 'UPDATE status directly from to_do to completed (skips in_progress/review/submission entirely)', identity: 'employeeA',
      allowed: jump.ok && jump.rowCount > 0, expectedSecure: 'deny',
      note: jump.error || `${jump.rowCount} row(s) - should be rejected as not a normal transition`,
    });
  });

  // ---- Preparation gate ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'ready_for_review' where id = $1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE in_progress -> ready_for_review with an unchecked REQUIRED preparation item', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - the seeded checklist item for this work item is required and unchecked`,
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    await c.query(`update public.work_checklist_items set is_done = true where work_item_id = $1 and stage = 'preparation'`, [WORK_ITEMS.normal.id]);
    const r = await tryQuery(c, `update public.work_items set status = 'ready_for_review' where id = $1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE in_progress -> ready_for_review after checking the required preparation item', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  // ---- Review gate ----
  await asRole(IDENTITIES.reviewerA, async (c) => {
    await c.query(`insert into public.work_checklist_items (work_item_id, stage, title, is_required) values ($1, 'review', 'Confirm figures tie to ledger', true)`, [WORK_ITEMS.readyForReview.id]);
    const r = await tryQuery(c, `update public.work_items set status = 'approved' where id = $1`, [WORK_ITEMS.readyForReview.id]);
    record({
      area, action: 'UPDATE ready_for_review -> approved with an unchecked REQUIRED review item', identity: 'reviewerA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    await c.query(`insert into public.work_checklist_items (work_item_id, stage, title, is_required, is_done) values ($1, 'review', 'Confirm figures tie to ledger', true, true)`, [WORK_ITEMS.readyForReview.id]);
    const r = await tryQuery(c, `update public.work_items set status = 'approved' where id = $1`, [WORK_ITEMS.readyForReview.id]);
    record({
      area, action: 'UPDATE ready_for_review -> approved after the required review item is already checked', identity: 'reviewerA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  // ---- Submission gate ----
  await asRole(IDENTITIES.admin, async (c) => {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, submission_required, review_required, created_by)
       values ($1, 'Submission-gated scratch item', $2, 'to_do', 'client', true, false, $2) returning id`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    await c.query(`update public.work_items set status = 'in_progress' where id = $1`, [ins.rows[0].id]);
    await c.query(`update public.work_items set status = 'ready_to_submit' where id = $1`, [ins.rows[0].id]);
    const r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [ins.rows[0].id]);
    record({
      area, action: 'UPDATE ready_to_submit -> completed without recording the submission (submission_required=true)', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, submission_required, review_required, created_by)
       values ($1, 'Submission-gated scratch item 2', $2, 'to_do', 'client', true, false, $2) returning id`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    await c.query(`update public.work_items set status = 'in_progress' where id = $1`, [ins.rows[0].id]);
    await c.query(`update public.work_items set status = 'ready_to_submit' where id = $1`, [ins.rows[0].id]);
    await c.query(`update public.work_items set submission_status = 'submitted' where id = $1`, [ins.rows[0].id]);
    const r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [ins.rows[0].id]);
    record({
      area, action: 'UPDATE ready_to_submit -> completed after recording the submission', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  // ---- Admin override ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE (as admin, NO override reason) skip straight to completed from in_progress', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - admin gets no silent bypass; must supply status_override_reason`,
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const upd = await tryQuery(c, `update public.work_items set status = 'completed', status_override_reason = 'Client closed the business; filing period must be force-closed per accountant instruction.' where id = $1`, [WORK_ITEMS.normal.id]);
    const activity = await tryQuery(c, `select action, detail from public.work_activity where work_item_id = $1 and action = 'status_override' order by created_at desc limit 1`, [WORK_ITEMS.normal.id]);
    const persisted = await tryQuery(c, `select status_override_reason from public.work_items where id = $1`, [WORK_ITEMS.normal.id]);
    record({
      area, action: 'UPDATE (as admin, WITH a real override reason) skip straight to completed from in_progress', identity: 'admin',
      allowed: upd.ok && upd.rowCount > 0 && activity.rowCount > 0 && persisted.rows[0] && persisted.rows[0].status_override_reason === null,
      expectedSecure: 'allow',
      note: !upd.ok ? upd.error : `update ok; status_override logged=${activity.rowCount > 0}; reason column cleared after use=${persisted.rows[0] && persisted.rows[0].status_override_reason === null} (detail: "${activity.rows[0] && activity.rows[0].detail}")`,
    });
  });

  // ---- Firm Work is completely exempt from all of the above ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'UPDATE Firm Work directly from to_do to completed (no transition map applies to work_scope=firm)', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) - Firm Work keeps its lighter model, untouched by this task`,
    });
  });
};
