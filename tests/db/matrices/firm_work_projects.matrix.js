const { tryQuery } = require('../support/probe');
const { CLIENTS, WORK_ITEMS, PROJECT } = require('../support/ids');

// Handbook Task 15: projects/initiatives table + work_items.project_id/
// next_action/blocker_reason. Covers exactly what the task's own TEST
// section asks for: schema constraints (both directions -- client-scope
// rejects the new firm-oriented fields, firm-scope rejects the client-
// compliance fields Task 11 added after the original scope constraint
// was written), RLS compatibility for the new projects table, historical
// records (the pre-Task-15 seeded Firm Work item still satisfies the
// extended constraint with NULLs), and nullability (every new field is
// genuinely optional).
module.exports = async function firmWorkProjectsMatrix({ asRole, asSuperuser, IDENTITIES, ANON, record }) {
  const area = 'projects / Firm Work async fields (Handbook Task 15)';

  // ---- schema constraint: client-scope must reject the new fields ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, project_id, created_by)
       values ($1, 'Should be rejected', $2, 'to_do', 'client', $3, $2)`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id, PROJECT.id]
    );
    record({
      area, action: 'INSERT a client-scope work item with project_id set', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a Client Work row was created carrying a Firm-Work-only field',
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, next_action, created_by)
       values ($1, 'Should be rejected', $2, 'to_do', 'client', 'Call the client', $2)`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a client-scope work item with next_action set', identity: 'admin', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'CRITICAL: a Client Work row was created carrying a Firm-Work-only field' });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, blocker_reason, created_by)
       values ($1, 'Should be rejected', $2, 'to_do', 'client', 'Waiting on IT', $2)`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a client-scope work item with blocker_reason set', identity: 'admin', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'CRITICAL: a Client Work row was created carrying a Firm-Work-only field' });
  });

  // ---- schema constraint: firm-scope must still reject the Client-Work
  // compliance fields, INCLUDING the ones Task 11 added after the
  // original scope constraint was written (the latent gap this
  // migration closes) ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, period_type, period_start_date, period_end_date, created_by)
       values ('Should be rejected', $1, 'to_do', 'firm', 'Administration', 'monthly', '2026-01-01', '2026-01-31', $1)`,
      [IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'INSERT a firm-scope work item with period_type/period_start_date/period_end_date set', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a Firm Work row was created carrying compliance-period fields -- the exact "Firm Work must not use client compliance rules" boundary this task requires',
    });
  });

  // ---- schema constraint: a valid firm-scope row WITH the new fields
  // set is allowed. status must be 'to_do' -- work_items_insert's own
  // policy requires every new row (any scope) to start there, matching
  // the real New Firm Work modal, which never sends a status on create. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, project_id, next_action, blocker_reason, created_by)
       values ('Lease negotiation', $1, 'to_do', 'firm', 'Firm Setup', $2, 'Send counter-offer to landlord', 'Waiting on partner sign-off', $1) returning id`,
      [IDENTITIES.employeeA.id, PROJECT.id]
    );
    record({
      area, action: 'INSERT a valid firm-scope work item with project_id, next_action, and blocker_reason all set', identity: 'employeeA',
      allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s)`,
    });
  });

  // ---- FK integrity: project_id must reference a real project ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, project_id, created_by)
       values ('Should be rejected', $1, 'to_do', 'firm', '00000000-0000-0000-0000-000000000000', $1)`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a firm-scope work item with a project_id that does not exist', identity: 'admin', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'CRITICAL: an orphaned project reference was accepted' });
  });

  // ---- nullability: a firm-scope row with all three new fields left
  // NULL is valid (they're genuinely optional, not silently required) ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, created_by)
       values ('No project, no next action, no blocker', $1, 'to_do', 'firm', $1) returning id`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'INSERT a firm-scope work item with project_id/next_action/blocker_reason all omitted', identity: 'employeeA', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) - all three genuinely optional` });
  });

  // ---- historical records: the pre-Task-15 seeded Firm Work item
  // still exists and still satisfies the extended constraint (NULL on
  // all three new columns) -- confirms the migration didn't corrupt or
  // reject anything that predates it ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select project_id, next_action, blocker_reason from public.work_items where id = $1`, [WORK_ITEMS.firm.id]);
    const row = r.rows[0];
    const ok = r.ok && row && row.project_id === null && row.next_action === null && row.blocker_reason === null;
    record({
      area, action: 'Pre-existing (pre-Task-15) Firm Work item still readable, with NULL on every new column', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: r.error || (ok ? 'historical record intact and unmodified by the migration' : `CRITICAL: project_id=${row && row.project_id}, next_action=${row && row.next_action}, blocker_reason=${row && row.blocker_reason}`),
    });
  });

  // ---- projects RLS: read/insert/update open to any active teammate,
  // matching Firm Work's own open-collaboration model; no delete policy ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.projects where id = $1', [PROJECT.id]);
    record({ area, action: 'SELECT a project as a plain employee', identity: 'employeeA', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `insert into public.projects (name, created_by) values ('Marketing Campaign', $1) returning id`, [IDENTITIES.employeeB.id]);
    record({ area, action: 'INSERT a new project as a plain employee', identity: 'employeeB', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) - matches "any active team member" creating Firm Work groupings` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `update public.projects set status = 'archived' where id = $1`, [PROJECT.id]);
    record({ area, action: 'UPDATE (archive) a project as a plain employee', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select id from public.projects limit 1', []);
    record({ area, action: 'SELECT any project as anonymous', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, `insert into public.projects (name) values ('Unauthorized project')`, []);
    record({ area, action: 'INSERT a project as anonymous', identity: 'anon', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted' });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select id from public.projects where id = $1', [PROJECT.id]);
    record({ area, action: 'SELECT a project as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `delete from public.projects where id = $1`, [PROJECT.id]);
    record({
      area, action: 'DELETE a project, even as admin (no delete policy -- archive is the intended retirement path)', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || `${r.rowCount} row(s) - CRITICAL: a project was deleted despite no delete policy existing, which would orphan any work_items still referencing it`,
    });
  });
};
