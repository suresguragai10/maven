const { tryQuery } = require('../support/probe');
const { CLIENTS, IDENTITIES } = require('../support/ids');

// Handbook Task 20: no schema/RLS change was needed for this task (Firm
// Work's read policy has been open to every active teammate since Task
// 6/16; Client Work's own assignee-scoped read is unchanged) -- this
// matrix exists to prove the QUERY shape My Work's combined view relies
// on actually returns the right rows via real RLS-filtered queries, not
// just to re-prove permission boundaries already covered elsewhere.
module.exports = async function myWorkCombinedMatrix({ asRole, record }) {
  const area = 'My Work combined Client+Firm (Handbook Task 20)';

  async function makeFirmItem(c, title, assigneeId) {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
       values ($2, $1, 'to_do', 'firm', 'Administration', $1) returning id`,
      [assigneeId, title]
    );
    return ins.rows[0]?.id;
  }
  async function makeClientItem(c, title, assigneeId) {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, created_by)
       values ($1, $2, $3, 'to_do', 'client', $3) returning id`,
      [CLIENTS.alpha.id, title, assigneeId]
    );
    return ins.rows[0]?.id;
  }

  // ---- The Firm Work half of My Work: assignee_id filter server-side,
  // not a client-side download-then-filter -- proven by seeding one item
  // assigned to employeeA and one to employeeB, then querying "my Firm
  // Work" exactly the way loadMyFirmWork() does, as employeeA. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const mine = await makeFirmItem(c, 'My Work combined - assigned to me (firm)', IDENTITIES.employeeA.id);
    const notMine = await makeFirmItem(c, 'My Work combined - assigned to colleague (firm)', IDENTITIES.employeeB.id);

    const r = await tryQuery(
      c,
      `select id from public.work_items where work_scope = 'firm' and assignee_id = $1`,
      [IDENTITIES.employeeA.id]
    );
    const ids = (r.rows || []).map((row) => row.id);
    const correct = r.ok && ids.includes(mine) && !ids.includes(notMine);
    record({
      area, action: "\"My Work\"'s Firm Work query returns only items assigned to the caller, not a colleague's unassigned-to-them item", identity: 'employeeA',
      allowed: correct, expectedSecure: 'allow',
      note: r.error || (correct ? `${ids.length} row(s), correctly excludes the colleague's item` : `CRITICAL: got ${JSON.stringify(ids)}`),
    });
  });

  // ---- The Client Work half stays exactly as scoped as it always was
  // (loadWork('mine') is unchanged by this task) -- one sanity check
  // that a Firm Work item never leaks into a work_scope='client' query,
  // which is the actual "must not contaminate client compliance
  // reporting" boundary this whole feature has to respect. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const clientItem = await makeClientItem(c, 'My Work combined - client item', IDENTITIES.employeeA.id);
    const firmItem = await makeFirmItem(c, 'My Work combined - firm item, same assignee', IDENTITIES.employeeA.id);

    const r = await tryQuery(
      c,
      `select id from public.work_items where work_scope = 'client' and assignee_id = $1`,
      [IDENTITIES.employeeA.id]
    );
    const ids = (r.rows || []).map((row) => row.id);
    const correct = r.ok && ids.includes(clientItem) && !ids.includes(firmItem);
    record({
      area, action: "My Work's Client Work query never includes a Firm Work item, even one assigned to the same person", identity: 'employeeA',
      allowed: correct, expectedSecure: 'allow',
      note: r.error || (correct ? 'Firm Work correctly excluded from the client-scope query' : `CRITICAL: got ${JSON.stringify(ids)}`),
    });
  });

  // ---- Personal To-Do stays completely separate -- My Work's two
  // queries (work_items, scoped by work_scope) never touch
  // personal_todos at all, and personal_todos rows never carry a
  // work_scope, so there is no code path that could accidentally fold
  // one in. This check just confirms personal_todos is unaffected by
  // this task's own read pattern -- an employee's private to-do stays
  // visible only via its own table/query. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    await tryQuery(c, `insert into public.personal_todos (user_id, text) values ($1, 'My Work combined - private todo, must not leak')`, [IDENTITIES.employeeA.id]);
    const r = await tryQuery(
      c,
      `select id from public.work_items where (work_scope = 'client' or work_scope = 'firm') and assignee_id = $1 and title = 'My Work combined - private todo, must not leak'`,
      [IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'A personal to-do never appears in a work_items query, regardless of scope', identity: 'employeeA',
      allowed: r.ok && r.rowCount === 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s) found (expected 0 -- personal_todos is a separate table, never joined into work_items)`,
    });
  });
};
