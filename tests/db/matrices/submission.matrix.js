const { tryQuery } = require('../support/probe');
const { WORK_ITEMS } = require('../support/ids');

// `normal` is seeded at status='in_progress' -- none of these attempts
// should be able to record a submission yet, since guard_work_item_update()
// only allows submission fields to change once old.status is
// 'ready_to_submit' or 'completed'.
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
      note: r.error || `${r.rowCount} row(s) - NEW FINDING: the submission-timing check lives INSIDE guard_work_item_update()'s else-branch, which role='reviewer' (matching old/new.reviewer_id) skips entirely along with every other else-branch rule. A reviewer can backfill submission fields on an item that was never actually marked ready_to_submit. This is a workflow-integrity gap, not just a permission one: the rule reads as a compliance-state guard, but it's only enforced against plain employees.`,
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
      note: r.error || `${r.rowCount} row(s) - same root cause as the reviewer case above: admin's branch is also "null" (skips the else-branch entirely), so this is not a separate bug, it's the same one, doubly confirmed.`,
    });
  });
};
