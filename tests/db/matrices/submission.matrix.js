const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// `normal` is seeded at status='in_progress' -- none of these attempts
// should be able to record a submission yet, since guard_work_item_update()
// only allows submission fields to change once old.status is
// 'ready_to_submit' or 'completed'.
//
// HISTORY (kept for context, not a live finding): this file originally
// documented a real gap -- the submission-timing check lived inside an
// else-branch that role='reviewer'/'admin' skipped entirely, so either
// could backfill submission fields on an item never actually marked
// ready_to_submit. Handbook Task 6 (20260818090000_work_item_update_
// authorization.sql) rewrote guard_work_item_update() to unify the
// role-dispatch so this check applies regardless of role -- all three
// cases below now correctly DENY. Re-confirmed here, not re-discovered.
module.exports = async function submissionMatrix({ asRole, IDENTITIES, record }) {
  const area = 'submission fields/actions';

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `update public.work_items set submission_status = 'submitted', submitted_at = now(), submitted_by = $2 where id = $1`,
      [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'UPDATE submission fields while status=in_progress (not ready_to_submit)', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - "Submission can only be recorded once the work is ready to submit"`,
    });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(
      c,
      `update public.work_items set submission_status = 'submitted', submitted_at = now(), submitted_by = $2 where id = $1`,
      [WORK_ITEMS.normal.id, IDENTITIES.reviewerA.id]
    );
    record({
      area, action: 'UPDATE submission fields (as the item\'s reviewer) while status=in_progress', identity: 'reviewerA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - correctly denied since Task 6; see this file's header for the pre-Task-6 history`,
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `update public.work_items set submission_status = 'submitted', submitted_at = now(), submitted_by = $2 where id = $1`,
      [WORK_ITEMS.normal.id, IDENTITIES.admin.id]
    );
    record({
      area, action: 'UPDATE submission fields (as admin) while status=in_progress', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - correctly denied since Task 6; see this file's header for the pre-Task-6 history`,
    });
  });
};
