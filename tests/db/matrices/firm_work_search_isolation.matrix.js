const { tryQuery } = require('../support/probe');
const { IDENTITIES } = require('../support/ids');

// Handbook Task 23: extends Task 14's firm_work_isolation.matrix.js
// (loadWork()/Reports/Client Detail already proven there) with the
// ground genuinely new to this task -- recurring Client Work generation
// staying Client-only now that work_scope is explicit in its INSERT
// rather than implicit via the column default, the new global-Search
// Firm Work query shape never bleeding into Client results (or vice
// versa), and completed Firm Work staying fully queryable (permanent
// history, not just "not deleted").
module.exports = async function firmWorkSearchIsolationMatrix({ asRole, record }) {
  const area = 'Firm Work search + recurring-generation isolation (Handbook Task 23)';

  async function makeFirmItem(c, title, extra) {
    extra = extra || {};
    const ins = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, description, created_by)
       values ($2, $1, $3, 'firm', 'Administration', $4, $1) returning id`,
      [IDENTITIES.employeeA.id, title, extra.status || 'to_do', extra.description || null]
    );
    return ins.rows[0]?.id;
  }

  // ---- Recurring generation stays Client-only even with deceptively
  // similar Firm Work data present -- a Firm item is seeded first with a
  // title that deliberately echoes what recurring generation itself
  // would produce ("Monthly VAT Return"-shaped), to prove the isolation
  // isn't just "the two code paths never happened to collide" but that
  // generation genuinely cannot produce a firm-scope row. ----
  await asRole(IDENTITIES.admin, async (c) => {
    await makeFirmItem(c, 'Monthly VAT Return — decoy Firm Work item with a compliance-sounding title');

    const genRes = await tryQuery(
      c,
      `select public.generate_period_work_for_period($1, $2, $3, $4)`,
      ['Isolation Test Period (Task 23)', 'monthly', '2027-09-01', '2027-09-30']
    );
    const createdCount = genRes.rows[0]?.generate_period_work_for_period ?? 0;
    if (!genRes.ok || createdCount === 0) {
      record({ area, action: 'Recurring generation runs (prerequisite for the isolation check below)', identity: 'admin', allowed: false, expectedSecure: 'allow', note: genRes.error || 'created 0 rows -- cannot verify isolation with no generated rows' });
      return;
    }
    const generated = await tryQuery(
      c,
      `select id, work_scope from public.work_items where period = $1`,
      ['Isolation Test Period (Task 23)']
    );
    const allClient = generated.ok && generated.rows.length > 0 && generated.rows.every((r) => r.work_scope === 'client');
    record({
      area, action: 'Every row recurring generation creates has work_scope=\'client\', with a decoy Firm Work item present', identity: 'admin',
      allowed: allClient, expectedSecure: 'allow',
      note: generated.error || (allClient ? `${generated.rows.length} row(s), all work_scope='client'` : `CRITICAL: generation produced a non-client row: ${JSON.stringify(generated.rows)}`),
    });
  });

  // ---- The new global-Search Firm Work query shape (Handbook Task 23)
  // never returns a Client Work row, even when a Client Work item exists
  // with a title matching the same search term. ----
  await asRole(IDENTITIES.admin, async (c) => {
    const firmId = await makeFirmItem(c, 'Website redesign kickoff');
    const clientIns = await tryQuery(
      c,
      `select id from public.work_items where work_scope = 'client' limit 1`
    );
    // Rename an existing real Client Work row to share the search term,
    // proving the Firm query's own work_scope='firm' filter -- not an
    // accident of no client row matching -- is what keeps it out.
    if (clientIns.rows[0]) {
      await c.query(`update public.work_items set title = 'Website redesign client engagement' where id = $1`, [clientIns.rows[0].id]);
    }
    const r = await tryQuery(
      c,
      `select id, work_scope from public.work_items where work_scope = 'firm' and title ilike '%website redesign%'`
    );
    const foundFirm = r.ok && r.rows.some((row) => row.id === firmId);
    const leakedClient = r.ok && r.rows.some((row) => row.work_scope !== 'firm');
    record({
      area, action: "Global Search's Firm Work query shape finds the Firm item and never returns a same-titled Client Work row", identity: 'admin',
      allowed: foundFirm && !leakedClient, expectedSecure: 'allow',
      note: r.error || (foundFirm && !leakedClient ? `${r.rowCount} row(s), correctly firm-only` : `CRITICAL: got ${JSON.stringify(r.rows)}`),
    });
  });

  // ---- Completed Firm Work stays fully searchable/readable -- not
  // hidden, archived out of reach, or excluded from a work_scope='firm'
  // query just because it's done. Permanent history, per this task's
  // own "HISTORY" requirement. ----
  await asRole(IDENTITIES.admin, async (c) => {
    const completedId = await makeFirmItem(c, 'Old office search — completed months ago', { status: 'to_do' });
    await c.query(`update public.work_items set status = 'completed' where id = $1`, [completedId]);
    const r = await tryQuery(
      c,
      `select id, status from public.work_items where work_scope = 'firm' and title ilike '%office search%'`
    );
    const found = r.ok && r.rows.some((row) => row.id === completedId && row.status === 'completed');
    record({
      area, action: 'A completed Firm Work item remains fully queryable by title months later, status intact', identity: 'admin',
      allowed: found, expectedSecure: 'allow',
      note: r.error || (found ? 'found, status=completed, fully searchable' : `CRITICAL: completed Firm Work not found or status changed: ${JSON.stringify(r.rows)}`),
    });
  });
};
