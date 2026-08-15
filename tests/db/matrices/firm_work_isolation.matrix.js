const { tryQuery } = require('../support/probe');
const { CLIENTS, WORK_ITEMS } = require('../support/ids');

// Handbook Task 14's REGRESSION BOUNDARY: Firm Work must never appear in
// Client compliance counters, statutory overdue counts, period
// compliance totals, or client service reporting unless an explicitly
// named report intentionally includes it. staff.js has no server-side
// view/RLS boundary for this (RLS intentionally lets any authenticated
// teammate read work_scope='firm' rows -- see 20260816090000's own
// comment) -- the actual boundary is query-construction discipline:
// every Client-compliance-facing query filters .eq('work_scope',
// 'client'). This file proves that discipline empirically by replaying
// the SAME query shapes staff.js actually uses (loadWork(), Reports'
// three sub-queries) against real seed data that includes a genuine
// Firm Work row (WORK_ITEMS.firm), rather than trusting a code read.
module.exports = async function firmWorkIsolationMatrix({ asRole, asSuperuser, IDENTITIES, record }) {
  const area = 'Firm Work / Client Work reporting isolation (Handbook Task 14)';

  // ---- negative control: prove Firm Work data genuinely exists and
  // WOULD show up if a query forgot to scope it -- otherwise an
  // always-empty Firm Work table would make every "isolation" check
  // below vacuously true. ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select id, work_scope from public.work_items where id = $1`, [WORK_ITEMS.firm.id]);
    record({
      area, action: 'Sanity check: the seeded Firm Work item is real and unfiltered queries do see it', identity: 'admin',
      allowed: r.ok && r.rowCount === 1 && r.rows[0].work_scope === 'firm', expectedSecure: 'allow',
      note: r.error || (r.rowCount === 1 ? `confirmed work_scope='${r.rows[0].work_scope}'` : 'the Firm Work fixture is missing -- every check below would be meaningless'),
    });
  });

  // ---- loadWork()'s exact filter shape (Today, My Work, All Work,
  // Deadlines, Manager Dashboard, Period Summary, Search all route
  // through this same client-side helper, per its own header comment) ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select id, work_scope from public.work_items where work_scope = 'client'`, []);
    const leaked = (r.rows || []).some((w) => w.id === WORK_ITEMS.firm.id);
    const hasClientRows = (r.rows || []).length > 0;
    record({
      area, action: `loadWork()'s query shape (work_scope='client') excludes the Firm Work item`, identity: 'admin',
      allowed: r.ok && !leaked && hasClientRows, expectedSecure: 'allow',
      note: r.error || (leaked ? 'CRITICAL: the Firm Work item appeared in a client-scoped query' : `${r.rowCount} client-scope row(s), Firm Work correctly absent`),
    });
  });

  // ---- Reports page's three query shapes (active / created-in-range /
  // completed-in-range), each independently .eq('work_scope','client') ----
  const reportQueries = [
    { label: 'Reports "active" query (status <> completed)', sql: `select id from public.work_items where work_scope = 'client' and status <> 'completed'` },
    { label: 'Reports "created in range" query', sql: `select id from public.work_items where work_scope = 'client' and created_at <= now()` },
    { label: 'Reports "completed in range" query', sql: `select id from public.work_items where work_scope = 'client' and status = 'completed' and completed_at is not null` },
  ];
  for (const q of reportQueries) {
    await asRole(IDENTITIES.admin, async (c) => {
      const r = await tryQuery(c, q.sql, []);
      const leaked = (r.rows || []).some((w) => w.id === WORK_ITEMS.firm.id);
      record({
        area, action: q.label, identity: 'admin',
        allowed: r.ok && !leaked, expectedSecure: 'allow',
        note: r.error || (leaked ? 'CRITICAL: Firm Work leaked into a compliance report query' : `${r.rowCount} row(s), Firm Work correctly absent`),
      });
    });
  }

  // ---- the one legitimate inclusion path: the Firm Work page's own
  // query, which intentionally shows ONLY work_scope='firm' ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select id, work_scope from public.work_items where work_scope = 'firm'`, []);
    const found = (r.rows || []).some((w) => w.id === WORK_ITEMS.firm.id);
    const anyClientLeaked = (r.rows || []).some((w) => w.work_scope !== 'firm');
    record({
      area, action: 'Firm Work page\'s own query shape (work_scope=\'firm\') correctly includes Firm Work and nothing else', identity: 'admin',
      allowed: r.ok && found && !anyClientLeaked, expectedSecure: 'allow',
      note: r.error || (found && !anyClientLeaked ? `${r.rowCount} row(s), all work_scope='firm'` : 'CRITICAL: the one explicitly-named Firm Work view is wrong'),
    });
  });

  // ---- Client Detail's pattern (.eq('client_id', X), no explicit
  // work_scope filter) is safe by SCHEMA CONSTRAINT, not by query
  // discipline -- prove the constraint itself, not just the absence of
  // a violation in existing data. work_items_scope_fields_check
  // (Handbook Task 6) requires work_scope='firm' rows to have client_id
  // IS NULL; this attempts to insert a Firm Work row WITH a real
  // client_id, which must be rejected at the database level. ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, client_id, assignee_id, status, work_scope, firm_category, created_by)
       values ('Should be rejected', $1, $2, 'to_do', 'firm', 'Administration', $2)`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'INSERT a work_scope=\'firm\' row WITH a client_id set -- proves Client Detail\'s client_id filter can never structurally match Firm Work', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a Firm Work row was created with a client_id, meaning Client Detail\'s .eq(client_id, X) pattern is not actually a safe boundary',
    });
  });

  // ---- catalog check: the constraint actually exists (not just that
  // this one insert happened to fail for some unrelated reason) ----
  await asSuperuser(async (c) => {
    const r = await tryQuery(
      c,
      `select 1 from pg_constraint where conname = 'work_items_scope_fields_check' and conrelid = 'public.work_items'::regclass`,
      []
    );
    record({
      area, action: 'work_items_scope_fields_check constraint exists on work_items', identity: 'n/a (catalog check)',
      allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow',
      note: r.error || (r.rowCount === 1 ? 'confirmed present' : 'CRITICAL: the constraint the isolation guarantee depends on does not exist'),
    });
  });
};
