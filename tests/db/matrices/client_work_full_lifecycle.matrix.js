const { CLIENTS } = require('../support/ids');

// This file runs its entire narrative inside ONE transaction (see below),
// and several steps are EXPECTED to fail (the checklist/transition gates
// being proven). A plain query failure poisons the rest of a Postgres
// transaction -- every later statement errors with "current transaction
// is aborted" instead of its own real result (the exact bug found and
// fixed in Handbook Task 10's fail-closed tests). Every query here runs
// inside its own SAVEPOINT so an expected failure only unwinds that one
// statement, not the 20+ steps around it.
async function tryQuery(c, sql, params) {
  await c.query('SAVEPOINT step');
  try {
    const res = await c.query(sql, params);
    await c.query('RELEASE SAVEPOINT step');
    return { ok: true, rowCount: res.rowCount, rows: res.rows, error: null };
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT step');
    await c.query('RELEASE SAVEPOINT step');
    return { ok: false, rowCount: 0, rows: [], error: e.message };
  }
}

// Handbook Task 14: every prior task's matrix file proves one rule in
// isolation (a single transition, a single permission check). This file
// is different on purpose -- it drives ONE work item through a REALISTIC,
// multi-actor, full Client Work lifecycle in a single continuous flow
// (employee works it, sends for review, gets sent back, fixes it,
// resubmits, gets approved, submits, completes), proving the pieces
// actually compose correctly end to end, not just individually. This is
// what "regression" means here: not new coverage of a new rule, but
// integration evidence that the whole journey still works after every
// security/finance-control change landed in Tasks 5-13.
//
// Runs as ONE transaction (BEGIN...ROLLBACK) with the acting identity
// switched between steps via repeated SET LOCAL ROLE + set_config --
// the same technique Task 10/13 used for a single privileged scenario,
// extended here across an entire scripted, multi-actor narrative. This
// is the only way to keep every step's committed-within-the-transaction
// state visible to the next step while still getting full isolation
// (nothing here persists past this one check).
module.exports = async function clientWorkFullLifecycleMatrix({ asSuperuser, IDENTITIES, record }) {
  const area = 'Client Work full lifecycle (Handbook Task 14 regression)';

  async function actAs(c, identity) {
    await c.query('SET LOCAL ROLE authenticated');
    await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: identity.id, role: 'authenticated' })]);
  }

  await asSuperuser(async (c) => {
    const steps = []; // { label, ok, detail }
    const step = (label, ok, detail) => steps.push({ label, ok, detail });

    try {
      await c.query('BEGIN');

      // ---- Step 0: create, as the employee, from a real client + a
      // real checklist (prep + review stages, both required) --
      // mirrors what the New Work modal / recurring generation actually
      // produce, not a bare minimal row.
      await actAs(c, IDENTITIES.employeeA);
      const ins = await tryQuery(
        c,
        `insert into public.work_items (client_id, title, assignee_id, reviewer_id, status, work_scope, submission_required, review_required, created_by)
         values ($1, 'Full Lifecycle Regression Item', $2, $3, 'to_do', 'client', true, true, $2) returning id`,
        [CLIENTS.alpha.id, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
      );
      const workId = ins.rows[0]?.id;
      step('create work item (to_do, review+submission required)', ins.ok && !!workId, ins.error);

      const prepItemIns = await tryQuery(c, `insert into public.work_checklist_items (work_item_id, stage, title, is_required) values ($1, 'preparation', 'Collect source documents', true)`, [workId]);
      step('create required preparation checklist item', prepItemIns.ok, prepItemIns.error);
      const reviewItemIns = await tryQuery(c, `insert into public.work_checklist_items (work_item_id, stage, title, is_required) values ($1, 'review', 'Reviewer confirms figures', true)`, [workId]);
      step('create required review checklist item', reviewItemIns.ok, reviewItemIns.error);

      // ---- Step 1: to_do -> in_progress ----
      let r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [workId]);
      step('to_do -> in_progress (employee)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 2: in_progress -> waiting_for_client, create + follow up
      // a waiting item ----
      r = await tryQuery(c, `update public.work_items set status = 'waiting_for_client', waiting_since = current_date, follow_up_date = current_date + 3, waiting_requested_by = $2 where id = $1`, [workId, IDENTITIES.employeeA.id]);
      step('in_progress -> waiting_for_client (employee)', r.ok && r.rowCount > 0, r.error);
      const waitIns = await tryQuery(c, `insert into public.work_waiting_items (work_item_id, title, requested_by) values ($1, 'Bank statement - Shrawan', $2) returning id`, [workId, IDENTITIES.employeeA.id]);
      step('create waiting item', waitIns.ok && waitIns.rowCount > 0, waitIns.error);

      // ---- Step 3: client responds -> mark waiting item received, return
      // to In Progress (the "return to In Progress when appropriate" case) ----
      const waitId = waitIns.rows[0]?.id;
      const recv = await tryQuery(c, `update public.work_waiting_items set is_received = true where id = $1`, [waitId]);
      step('mark waiting item received', recv.ok && recv.rowCount > 0, recv.error);
      r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [workId]);
      step('waiting_for_client -> in_progress (documents received)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 4: attempt to send for review with the required prep
      // item still unchecked -- must be blocked (checklist gate) ----
      r = await tryQuery(c, `update public.work_items set status = 'ready_for_review' where id = $1`, [workId]);
      step('in_progress -> ready_for_review BLOCKED (required prep item unchecked)', !r.ok, r.error || 'CRITICAL: succeeded despite an unchecked required preparation item');

      // ---- Step 5: check the prep item, now sending for review succeeds ----
      const prepCheck = await tryQuery(c, `update public.work_checklist_items set is_done = true where work_item_id = $1 and stage = 'preparation'`, [workId]);
      step('check the required preparation item', prepCheck.ok && prepCheck.rowCount > 0, prepCheck.error);
      r = await tryQuery(c, `update public.work_items set status = 'ready_for_review' where id = $1`, [workId]);
      step('in_progress -> ready_for_review (prep item checked)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 6: reviewer sends it back (changes required) ----
      await actAs(c, IDENTITIES.reviewerA);
      r = await tryQuery(c, `update public.work_items set status = 'changes_required' where id = $1`, [workId]);
      step('ready_for_review -> changes_required (reviewer)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 7: employee fixes it, back to in_progress, resubmits ----
      await actAs(c, IDENTITIES.employeeA);
      r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [workId]);
      step('changes_required -> in_progress (employee addresses feedback)', r.ok && r.rowCount > 0, r.error);
      r = await tryQuery(c, `update public.work_items set status = 'ready_for_review' where id = $1`, [workId]);
      step('in_progress -> ready_for_review (resubmitted)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 8: admin reassigns the work mid-flow (real capability,
      // not a normal-employee one) ----
      await actAs(c, IDENTITIES.admin);
      r = await tryQuery(c, `update public.work_items set assignee_id = $2 where id = $1`, [workId, IDENTITIES.employeeB.id]);
      step('reassign assignee mid-flow (admin)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 9: reviewer approves -- blocked first (required review
      // item unchecked), then allowed once checked ----
      await actAs(c, IDENTITIES.reviewerA);
      r = await tryQuery(c, `update public.work_items set status = 'approved' where id = $1`, [workId]);
      step('ready_for_review -> approved BLOCKED (required review item unchecked)', !r.ok, r.error || 'CRITICAL: succeeded despite an unchecked required review item');
      const reviewCheck = await tryQuery(c, `update public.work_checklist_items set is_done = true where work_item_id = $1 and stage = 'review'`, [workId]);
      step('check the required review item', reviewCheck.ok && reviewCheck.rowCount > 0, reviewCheck.error);
      r = await tryQuery(c, `update public.work_items set status = 'approved' where id = $1`, [workId]);
      step('ready_for_review -> approved (review item checked)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 10: approved -> ready_to_submit (submission_required=true) ----
      r = await tryQuery(c, `update public.work_items set status = 'ready_to_submit' where id = $1`, [workId]);
      step('approved -> ready_to_submit', r.ok && r.rowCount > 0, r.error);

      // ---- Step 11: attempt completion before recording the submission
      // -- must be blocked ----
      r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [workId]);
      step('ready_to_submit -> completed BLOCKED (submission not yet recorded)', !r.ok, r.error || 'CRITICAL: completed without ever recording the submission');

      // ---- Step 12: record the submission (submission tracking: not_ready
      // -> ready_to_submit -> submitted -> acknowledged), then complete ----
      await actAs(c, IDENTITIES.employeeB); // now-current assignee, per step 8
      r = await tryQuery(c, `update public.work_items set submission_status = 'submitted', submitted_at = now(), submitted_by = $2, submission_reference = 'IRD-ACK-TEST-001' where id = $1`, [workId, IDENTITIES.employeeB.id]);
      step('record submission (submitted)', r.ok && r.rowCount > 0, r.error);
      await actAs(c, IDENTITIES.admin);
      r = await tryQuery(c, `update public.work_items set submission_status = 'acknowledged' where id = $1`, [workId]);
      step('submission acknowledged', r.ok && r.rowCount > 0, r.error);
      r = await tryQuery(c, `update public.work_items set status = 'completed' where id = $1`, [workId]);
      step('ready_to_submit -> completed (submission recorded)', r.ok && r.rowCount > 0, r.error);

      // ---- Step 13: completed is terminal -- no normal path back out ----
      r = await tryQuery(c, `update public.work_items set status = 'in_progress' where id = $1`, [workId]);
      step('completed -> in_progress BLOCKED (no normal reopen path)', !r.ok, r.error || 'CRITICAL: a completed compliance item was silently reopened');

      // ---- Step 14: activity history -- the automatic, trigger-driven
      // audit trail (status_changed x N, reassigned) must be complete and
      // attributed to the actual actor of each step, not fabricated ----
      const activity = await tryQuery(c, `select action, actor_id, detail from public.work_activity where work_item_id = $1 order by created_at asc`, [workId]);
      const statusChanges = (activity.rows || []).filter((a) => a.action === 'status_changed');
      const reassignments = (activity.rows || []).filter((a) => a.action === 'reassigned');
      const reassignByAdmin = reassignments.length > 0 && reassignments[0].actor_id === IDENTITIES.admin.id;
      // 10 real status transitions happened above: in_progress, waiting,
      // in_progress, ready_for_review, changes_required, in_progress,
      // ready_for_review, approved, ready_to_submit, completed -- the
      // initial to_do is the row's own default at creation, never a
      // logged "change".
      const activityOk = activity.ok && statusChanges.length === 10 && reassignments.length === 1 && reassignByAdmin;
      step(
        `activity history complete and correctly attributed (${statusChanges.length} status changes, ${reassignments.length} reassignment, by admin=${reassignByAdmin})`,
        activityOk,
        activity.error
      );

      const allOk = steps.every((s) => s.ok);
      record({
        area, action: `Full lifecycle: ${steps.length} steps (create -> in_progress -> waiting -> received -> blocked/gated review -> changes required -> fixed -> resubmitted -> reassigned -> blocked/gated approval -> ready_to_submit -> blocked completion -> submitted -> acknowledged -> completed -> reopen blocked -> activity verified)`,
        identity: 'employeeA/reviewerA/admin/employeeB (multi-actor)',
        allowed: allOk, expectedSecure: 'allow',
        note: allOk ? 'every step behaved exactly as the transition map, checklist gates, and audit trail are supposed to' : 'FAILURES: ' + steps.filter((s) => !s.ok).map((s) => `[${s.label}] ${s.detail}`).join(' | '),
      });
    } catch (e) {
      // Defensive: 20+ sequential steps in one function -- an unexpected
      // throw (not a normal tryQuery failure, which is already caught)
      // must still surface as a failed check, not crash the whole
      // test:db run and lose every OTHER matrix file's results with it.
      record({ area, action: 'Full lifecycle narrative', identity: 'multi-actor', allowed: false, expectedSecure: 'allow', note: `CRITICAL: unexpected exception aborted the narrative before it could finish: ${e.message}` });
    } finally {
      await c.query('ROLLBACK').catch(() => {});
    }
  });
};
