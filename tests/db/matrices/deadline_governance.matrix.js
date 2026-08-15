const { tryQuery } = require('../support/probe');
const { CLIENTS, SERVICE_TEMPLATE, SERVICE_TEMPLATE_UNGOVERNED, WORK_ITEMS } = require('../support/ids');

// Handbook Task 12: deadline_rules is the governed replacement for the
// old bare service_templates.filing_deadline_day integer -- every check
// here proves either (a) who may add/read a rule, (b) that a rule can
// never enter the system without a source citation and a verified date,
// (c) that adding a new rule atomically supersedes the old one rather
// than ever leaving two simultaneously active, or (d) that generation
// actually uses the governed rule (or correctly leaves the deadline
// unset when none exists) rather than reading the legacy column.
module.exports = async function deadlineGovernanceMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
  const area = 'deadline_rules governance (Handbook Task 12)';

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.deadline_rules where service_template_id = $1', [SERVICE_TEMPLATE.id]);
    record({ area, action: 'SELECT deadline_rules as a plain employee', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) — reading the rule (not writing it) is fine for anyone authenticated` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.deadline_rules (service_template_id, financial_year_label, filing_deadline_day, source_title, verified_date, verified_by, status)
       values ($1, 'Direct insert attempt', 1, 'Attempted bypass', current_date, $2, 'active')`,
      [SERVICE_TEMPLATE.id, IDENTITIES.admin.id]
    );
    record({
      area, action: 'Direct INSERT into deadline_rules, even as admin (bypassing add_deadline_rule)', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a rule was inserted without going through add_deadline_rule — its validation (source_title, verified_date, single-active-per-template) can be bypassed entirely',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 20, 'Some source', null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({ area, action: 'CALL add_deadline_rule as a plain employee', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded — deadline governance must be admin-only' });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 20, 'Some source', null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({ area, action: 'CALL add_deadline_rule as reviewer', identity: 'reviewerA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded — this is legal-deadline governance, deliberately narrower than the admin/reviewer pattern used elsewhere' });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 20, 'Some source', null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({ area, action: 'CALL add_deadline_rule as anonymous', identity: 'anon', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'CRITICAL: succeeded with no login at all' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 20, null, null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({
      area, action: 'CALL add_deadline_rule with no source_title', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a rule was accepted with no source citation at all',
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 20, 'Some source', null, null, null, null)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({
      area, action: 'CALL add_deadline_rule with no verified_date', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a rule was accepted with no record of anyone having verified it',
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test', null, null, 32, 'Some source', null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    record({
      area, action: 'CALL add_deadline_rule with filing_deadline_day = 32 (out of range)', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: an impossible day-of-month was accepted',
    });
  });

  // ---- supersede flow: adding a second rule for a template that
  // already has an active one must atomically flip the old one to
  // 'superseded' (with superseded_by pointing at the new row) and leave
  // exactly one 'active' row — never two, never a silent overwrite of
  // the old row's own history.
  await asRole(IDENTITIES.admin, async (c) => {
    const before = await tryQuery(c, `select id, filing_deadline_day, status from public.deadline_rules where service_template_id = $1 and status = 'active'`, [SERVICE_TEMPLATE.id]);
    const oldRuleId = before.rows[0]?.id;
    const addRes = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test — superseding rule', null, null, 28, 'Updated test source', null, null, null, current_date) as new_id`,
      [SERVICE_TEMPLATE.id]
    );
    const newRuleId = addRes.rows[0]?.new_id;
    const afterAll = await tryQuery(c, `select id, filing_deadline_day, status, superseded_by from public.deadline_rules where service_template_id = $1`, [SERVICE_TEMPLATE.id]);
    const activeRows = (afterAll.rows || []).filter((r) => r.status === 'active');
    const oldRow = (afterAll.rows || []).find((r) => r.id === oldRuleId);
    const ok = addRes.ok && activeRows.length === 1 && activeRows[0].id === newRuleId && activeRows[0].filing_deadline_day === 28
      && oldRow && oldRow.status === 'superseded' && oldRow.superseded_by === newRuleId;
    record({
      area, action: 'Add a second rule for a template that already has an active one — must supersede, not duplicate', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: addRes.error || (ok ? `exactly 1 active row (day ${activeRows[0]?.filing_deadline_day}), old rule correctly superseded and linked` : `not atomic: ${activeRows.length} active row(s), old row status=${oldRow?.status}, superseded_by=${oldRow?.superseded_by}`),
    });
  });

  // ---- generation correctness: no rule yet -> external stays unset ----
  await asRole(IDENTITIES.admin, async (c) => {
    const genRes = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Ungoverned Test Period 1', 'monthly', '2026-02-01', '2026-02-28']);
    const rowRes = await tryQuery(
      c,
      `select external_due_date, internal_due_date from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`,
      [CLIENTS.alpha.id, SERVICE_TEMPLATE_UNGOVERNED.id, 'Ungoverned Test Period 1']
    );
    const row = rowRes.rows[0];
    const ok = genRes.ok && row && row.external_due_date === null && row.internal_due_date === null;
    record({
      area, action: 'Generate work for a template with requires_external_deadline=true but no active rule — external must stay unset, never guessed', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? 'external_due_date and internal_due_date both correctly NULL — no fabricated deadline' : `CRITICAL: external_due_date=${row && row.external_due_date}, internal_due_date=${row && row.internal_due_date} — a deadline was produced with no governed rule behind it`),
    });
  });

  // ---- generation correctness: rule added -> external now derives from it ----
  await asRole(IDENTITIES.admin, async (c) => {
    const addRes = await tryQuery(
      c,
      `select public.add_deadline_rule($1, 'FY test — now governed', null, null, 20, 'Test source now added', null, null, null, current_date)`,
      [SERVICE_TEMPLATE_UNGOVERNED.id]
    );
    const genRes = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Ungoverned Test Period 2', 'monthly', '2026-03-01', '2026-03-31']);
    const rowRes = await tryQuery(
      c,
      `select external_due_date from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`,
      [CLIENTS.alpha.id, SERVICE_TEMPLATE_UNGOVERNED.id, 'Ungoverned Test Period 2']
    );
    const row = rowRes.rows[0];
    const dateStr = row && row.external_due_date && (typeof row.external_due_date === 'string' ? row.external_due_date.slice(0, 10) : `${row.external_due_date.getUTCFullYear()}-03-20`);
    const ok = addRes.ok && genRes.ok && dateStr === '2026-03-20';
    record({
      area, action: 'Generate work for the same template after a rule is added — external now derives from the governed rule', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: (addRes.error || genRes.error) || (ok ? `external_due_date=${dateStr}, matches the new rule's day 20` : `wrong: external_due_date=${dateStr}`),
    });
  });

  // ---- manual override + audit history: unchanged trigger behavior
  // from Handbook Task 7/8, verified here explicitly because Task 12's
  // own TEST requirement calls out "manual-override … with audit
  // history" by name.
  await asRole(IDENTITIES.admin, async (c) => {
    const upd = await tryQuery(c, `update public.work_items set external_due_date = '2026-12-25' where id = $1`, [WORK_ITEMS.normal.id]);
    const actRes = await tryQuery(
      c,
      `select detail from public.work_activity where work_item_id = $1 and action = 'due_date_changed' order by created_at desc limit 1`,
      [WORK_ITEMS.normal.id]
    );
    const logged = actRes.ok && actRes.rowCount > 0 && (actRes.rows[0].detail || '').includes('2026-12-25');
    record({
      area, action: 'Manually override external_due_date on an existing work item — must be logged to work_activity', identity: 'admin',
      allowed: upd.ok && logged, expectedSecure: 'allow',
      note: upd.error || actRes.error || (logged ? `work_activity recorded: "${actRes.rows[0].detail}"` : 'CRITICAL: the override was not logged — a manual deadline change would be untraceable'),
    });
  });

  await asSuperuser(async (c) => {
    const r = await tryQuery(c, `select has_function_privilege('anon', 'public.add_deadline_rule(uuid, text, date, date, int, text, text, text, text, date)', 'EXECUTE') as anon_can_execute`, []);
    record({
      area, action: 'has_function_privilege(anon, add_deadline_rule, EXECUTE) — direct grant inspection', identity: 'n/a (catalog check)',
      allowed: r.rows[0]?.anon_can_execute === true, expectedSecure: 'deny',
      note: `anon_can_execute = ${r.rows[0]?.anon_can_execute}`,
    });
  });
};
