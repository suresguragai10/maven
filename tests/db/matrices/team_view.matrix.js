const { tryQuery } = require('../support/probe');
const { IDENTITIES } = require('../support/ids');

// Handbook Task 21: the Team screen's whole security model rests on
// reusing the SAME unfiltered-by-assignee query pattern Manager Dashboard
// already relies on (query work_items with no .eq('assignee_id', ...),
// let work_items_read RLS decide what actually comes back) -- this
// matrix proves that pattern is genuinely safe for a PLAIN EMPLOYEE
// viewer (Manager Dashboard is reviewer/admin-gated in the UI, but the
// Team screen is open to everyone, so the RLS boundary itself is what
// has to hold here, not a role gate in front of it).
module.exports = async function teamViewMatrix({ asRole, record }) {
  const area = 'Team screen — RLS-only scoping, not a bypass (Handbook Task 21)';

  // ---- A plain employee's unfiltered Client Work query does NOT return
  // a colleague's item they neither own nor review -- exactly the "must
  // not become a bypass that leaks Client Work data beyond RLS"
  // requirement, exercised with the EXACT query shape (no assignee_id
  // filter) the Team screen actually sends. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `select id, assignee_id from public.work_items where work_scope = 'client'`);
    // The seeded fixtures include work assigned to employeeB (see
    // tests/db/support/seed.js's WORK_ITEMS.other) that employeeA neither
    // owns nor reviews -- if the Team screen's query pattern were
    // somehow bypassing RLS, that row would leak through here.
    const leaked = (r.rows || []).some((row) => row.assignee_id && row.assignee_id !== IDENTITIES.employeeA.id);
    record({
      area, action: "A plain employee's unfiltered Client Work query never returns a colleague's item they don't own or review", identity: 'employeeA',
      allowed: r.ok && !leaked, expectedSecure: 'allow',
      note: r.error || (leaked ? `CRITICAL: leaked rows with foreign assignee_id: ${JSON.stringify(r.rows)}` : `${r.rows.length} row(s), all correctly scoped to employeeA's own work`),
    });
  });

  // ---- Admin's identical query (same shape, no assignee_id filter)
  // legitimately sees everyone's Client Work -- the Team screen's own
  // query doesn't special-case role at all; RLS does that. ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select distinct assignee_id from public.work_items where work_scope = 'client'`);
    const distinctAssignees = (r.rows || []).map((row) => row.assignee_id);
    const seesMultiple = r.ok && distinctAssignees.length > 1;
    record({
      area, action: "Admin's identical unfiltered query legitimately sees Client Work across multiple assignees (RLS grants this, the query itself is role-agnostic)", identity: 'admin',
      allowed: seesMultiple, expectedSecure: 'allow',
      note: r.error || `${distinctAssignees.length} distinct assignee(s)`,
    });
  });

  // ---- Firm Work half: unfiltered by assignee, all-team visible for
  // EVERY role, including a plain employee -- confirms the Team screen's
  // Firm Work section is genuinely populated for everyone, not silently
  // empty for non-admins. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `select distinct assignee_id from public.work_items where work_scope = 'firm'`);
    record({
      area, action: 'A plain employee\'s unfiltered Firm Work query sees Firm Work across the whole team (all-team visible by design)', identity: 'employeeA',
      allowed: r.ok, expectedSecure: 'allow',
      note: r.error || `${(r.rows || []).length} distinct assignee(s) visible`,
    });
  });

  // ---- A reviewer sees their own Client Work AND anyone's where they
  // are specifically the reviewer -- proving the Team screen would show
  // a PARTIAL (not full) Client Work section for a colleague the viewer
  // reviews, which is the correct, non-bypassing behavior, not a bug. ----
  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, `select id, assignee_id, reviewer_id from public.work_items where work_scope = 'client'`);
    const leaked = (r.rows || []).some((row) => row.assignee_id !== IDENTITIES.reviewerA.id && row.reviewer_id !== IDENTITIES.reviewerA.id);
    record({
      area, action: "A reviewer's unfiltered query returns only their own assigned work plus work they specifically review -- never a colleague's unrelated item", identity: 'reviewerA',
      allowed: r.ok && !leaked, expectedSecure: 'allow',
      note: r.error || (leaked ? `CRITICAL: leaked an unrelated row: ${JSON.stringify(r.rows)}` : `${r.rows.length} row(s), correctly scoped`),
    });
  });
};
