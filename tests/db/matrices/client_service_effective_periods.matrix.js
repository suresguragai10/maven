const { tryQuery } = require('../support/probe');
const { CLIENTS, SERVICE_TEMPLATE, CLIENT_SERVICE, SERVICE_TEMPLATE_UNGOVERNED, CLIENT_SERVICE_UNGOVERNED } = require('../support/ids');

// Handbook Task 13: client_services.is_active already gated generation
// correctly before this task (unchanged, re-verified below); start_date/
// end_date are new (start_period/end_period were always free-text,
// documentation-only, per that migration's own comment) and this file's
// main job is proving they now actually bound what _generate_period_
// work_core will create. Also covers the creator-vs-assignee fix
// (created_by must be the real caller, never the assignee fallback) and
// genuine cross-connection concurrency (not just "call twice in one
// transaction," which Task 11's duplicate-generation test already
// covers) for the uniqueness guarantee.
module.exports = async function clientServiceEffectivePeriodsMatrix({ asRole, asSuperuser, pool, IDENTITIES, record }) {
  const area = 'client_services effective periods (Handbook Task 13)';

  async function generateAndFetch(c, templateId, label, start, end, periodType) {
    const genRes = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, [label, periodType, start, end]);
    const rowRes = await tryQuery(
      c,
      `select id, created_by, assignee_id from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`,
      [CLIENTS.alpha.id, templateId, label]
    );
    return { genRes, row: rowRes.rows[0] };
  }

  // ---- before start: requested period entirely before start_date ----
  await asRole(IDENTITIES.admin, async (c) => {
    await c.query(`update public.client_services set start_date = '2027-06-01', end_date = null where id = $1`, [CLIENT_SERVICE_UNGOVERNED.id]);
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE_UNGOVERNED.id, 'Before Start Test', '2027-03-01', '2027-03-31', 'monthly');
    record({
      area, action: 'Generate for a period entirely before the service\'s start_date', identity: 'admin',
      allowed: genRes.ok && !row, expectedSecure: 'allow',
      note: genRes.error || (!row ? 'correctly skipped — no work item created before service start' : 'CRITICAL: a work item was created for a period before the service even started'),
    });
  });

  // ---- on/after start: period_end lands exactly ON start_date (inclusive boundary) ----
  await asRole(IDENTITIES.admin, async (c) => {
    await c.query(`update public.client_services set start_date = '2027-03-01', end_date = null where id = $1`, [CLIENT_SERVICE_UNGOVERNED.id]);
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE_UNGOVERNED.id, 'On Start Test', '2027-03-01', '2027-03-31', 'monthly');
    record({
      area, action: 'Generate for a period starting exactly on the service\'s start_date (inclusive boundary)', identity: 'admin',
      allowed: genRes.ok && !!row, expectedSecure: 'allow',
      note: genRes.error || (row ? 'correctly generated — on-or-after start is allowed' : 'CRITICAL: generation was skipped even though the period starts on the service\'s own start date'),
    });
  });

  // ---- after end: requested period entirely after end_date ----
  await asRole(IDENTITIES.admin, async (c) => {
    await c.query(`update public.client_services set start_date = null, end_date = '2027-01-31' where id = $1`, [CLIENT_SERVICE_UNGOVERNED.id]);
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE_UNGOVERNED.id, 'After End Test', '2027-04-01', '2027-04-30', 'monthly');
    record({
      area, action: 'Generate for a period entirely after the service\'s end_date', identity: 'admin',
      allowed: genRes.ok && !row, expectedSecure: 'allow',
      note: genRes.error || (!row ? 'correctly skipped — no work item created after service end' : 'CRITICAL: a work item was created for a period after the service had already ended'),
    });
  });

  // ---- inactive: already-established is_active gate, re-verified explicitly ----
  await asRole(IDENTITIES.admin, async (c) => {
    await c.query(`update public.client_services set is_active = false, start_date = null, end_date = null where id = $1`, [CLIENT_SERVICE_UNGOVERNED.id]);
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE_UNGOVERNED.id, 'Inactive Service Test', '2027-05-01', '2027-05-31', 'monthly');
    record({
      area, action: 'Generate for a deactivated (is_active=false) service', identity: 'admin',
      allowed: genRes.ok && !row, expectedSecure: 'allow',
      note: genRes.error || (!row ? 'correctly skipped — inactive services never generate' : 'CRITICAL: a work item was created for a deactivated service'),
    });
  });

  // ---- creator vs assignee: created_by must be the real caller, not
  // whichever admin happened to be picked as the assignee fallback ----
  await asRole(IDENTITIES.reviewerA, async (c) => {
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE.id, 'Creator Test Period', '2027-07-01', '2027-07-31', 'monthly');
    const ok = genRes.ok && row && row.created_by === IDENTITIES.reviewerA.id;
    record({
      area, action: 'Generate as reviewerA (who is not the service\'s assignee) — created_by must record reviewerA, not the assignee or any fallback admin', identity: 'reviewerA',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `created_by correctly = reviewerA (assignee_id = ${row.assignee_id}, a different person)` : `CRITICAL: created_by = ${row && row.created_by}, expected reviewerA's id ${IDENTITIES.reviewerA.id}`),
    });
  });

  // ---- missing default assignee: service has no assignee_id AND the
  // only active admin is (temporarily) deactivated -- must skip this one
  // service safely, not crash the whole generation call, and must not
  // affect an unrelated service in the same call that DOES have its own
  // assignee. Needs raw superuser access to flip profiles.is_active
  // (RLS would otherwise block a non-admin from doing this, and the
  // caller here must stay reviewerA specifically, since deactivating the
  // only admin identity would break the admin/reviewer auth check if
  // admin were the caller) -- same manual BEGIN/ROLLBACK pattern used in
  // Handbook Task 10's fail-closed tests.
  await asSuperuser(async (c) => {
    try {
      await c.query('BEGIN');
      await c.query(`update public.client_services set assignee_id = null where id = $1`, [CLIENT_SERVICE_UNGOVERNED.id]);
      await c.query(`update public.profiles set is_active = false where id = $1`, [IDENTITIES.admin.id]);
      await c.query(`SET LOCAL ROLE authenticated`);
      await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: IDENTITIES.reviewerA.id, role: 'authenticated' })]);

      const genRes = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['No Assignee Test Period', 'monthly', '2027-08-01', '2027-08-31']);
      const skippedRow = await tryQuery(c, `select id from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`, [CLIENTS.alpha.id, SERVICE_TEMPLATE_UNGOVERNED.id, 'No Assignee Test Period']);
      const unaffectedRow = await tryQuery(c, `select id from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`, [CLIENTS.alpha.id, SERVICE_TEMPLATE.id, 'No Assignee Test Period']);
      const ok = genRes.ok && skippedRow.rowCount === 0 && unaffectedRow.rowCount === 1;
      record({
        area, action: 'Generate when a service has no assignee and no active admin exists to fall back to — must skip that service safely, without crashing or affecting other services in the same call', identity: 'reviewerA',
        allowed: ok, expectedSecure: 'allow',
        note: genRes.error || (ok ? 'call succeeded overall; the assignee-less service was skipped (no row, no crash); the other, properly-assigned service in the same call still generated normally' : `unexpected: genRes.ok=${genRes.ok}, skipped rows=${skippedRow.rowCount}, unaffected rows=${unaffectedRow.rowCount}`),
      });
    } finally {
      await c.query('ROLLBACK').catch(() => {});
    }
  });

  // ---- historical work unchanged: deactivating a service or editing its
  // template must never rewrite an already-generated work item ----
  await asRole(IDENTITIES.admin, async (c) => {
    const { genRes, row } = await generateAndFetch(c, SERVICE_TEMPLATE.id, 'Historical Snapshot Test', '2027-09-01', '2027-09-30', 'monthly');
    if (!genRes.ok || !row) {
      record({ area, action: 'Historical work is unchanged after service deactivation and template edits', identity: 'admin', allowed: false, expectedSecure: 'allow', note: genRes.error || 'could not generate the item to snapshot' });
      return;
    }
    const before = await tryQuery(c, `select title, assignee_id, internal_due_date, external_due_date, status from public.work_items where id = $1`, [row.id]);
    await c.query(`update public.client_services set is_active = false where id = $1`, [CLIENT_SERVICE.id]);
    await c.query(`update public.service_templates set title = 'Renamed Mid-Test Template' where id = $1`, [SERVICE_TEMPLATE.id]);
    const after = await tryQuery(c, `select title, assignee_id, internal_due_date, external_due_date, status from public.work_items where id = $1`, [row.id]);
    const b = before.rows[0], a = after.rows[0];
    const unchanged = b && a && b.title === a.title && b.assignee_id === a.assignee_id
      && String(b.internal_due_date) === String(a.internal_due_date) && String(b.external_due_date) === String(a.external_due_date) && b.status === a.status;
    record({
      area, action: 'Historical work is unchanged after service deactivation and template edits', identity: 'admin',
      allowed: unchanged, expectedSecure: 'allow',
      note: unchanged ? 'work item\'s title/assignee/dates/status are byte-identical after deactivating its service and renaming its template' : 'CRITICAL: an already-generated work item changed as a side effect of editing the service or template',
    });
  });

  // ---- genuine cross-connection concurrency: two separately-committed
  // transactions, not two calls inside one rolled-back transaction (that
  // wouldn't actually exercise the unique index the way two real,
  // concurrently-committing transactions do). Runs on two independent
  // pool connections via Promise.all, then cleans up its own committed
  // rows afterward since this test intentionally does NOT roll back.
  async function runCommitted(identity, fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: identity.id, role: 'authenticated' })]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  {
    const concurrentArgs = ['Concurrency Test Period', 'monthly', '2027-10-01', '2027-10-31'];
    const [resA, resB] = await Promise.all([
      runCommitted(IDENTITIES.admin, (c) => tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, concurrentArgs)),
      runCommitted(IDENTITIES.admin, (c) => tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, concurrentArgs)),
    ]);
    const dupCheck = await asSuperuser(async (c) => tryQuery(
      c,
      `select client_id, service_template_id, count(*) as n from public.work_items where period = $1 group by client_id, service_template_id having count(*) > 1`,
      ['Concurrency Test Period']
    ));
    const totalCreated = (resA.rows[0]?.generate_period_work_for_period || 0) + (resB.rows[0]?.generate_period_work_for_period || 0);
    const ok = resA.ok && resB.ok && dupCheck.ok && dupCheck.rowCount === 0 && totalCreated > 0;
    record({
      area, action: 'Two genuinely concurrent, separately-committed generate_period_work_for_period calls for the identical period', identity: 'admin (x2 connections)',
      allowed: ok, expectedSecure: 'allow',
      note: (resA.error || resB.error || dupCheck.error) || (ok ? `${totalCreated} total row(s) created across both calls, zero duplicate (client, service, period) combinations — the unique index held under real concurrency` : `CRITICAL: ${dupCheck.rowCount} duplicate combination(s) found, or the calls failed`),
    });
    // Cleanup: this test intentionally committed real rows -- remove them
    // so they don't linger for the rest of this run, matching every
    // other check's "pristine seed data for the next check" discipline.
    await asSuperuser(async (c) => { await c.query(`delete from public.work_items where period = $1`, ['Concurrency Test Period']); });
  }
};
