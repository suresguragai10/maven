const { tryQuery } = require('../support/probe');
const { IDENTITIES, PROJECT } = require('../support/ids');

// Handbook Task 19: the one real schema gap this task closes -- every
// material project edit should be attributable, but only the ORIGINAL
// creator (created_by) was ever tracked. Adds updated_by/updated_at,
// auto-set by a trigger (never trusted from the client). Also proves
// what was already true structurally: any active teammate may create/
// rename/archive any project (same peer model as Firm Work itself,
// unchanged since Task 15), and archiving never hides or deletes
// historical Firm Work under that project.
module.exports = async function projectsManagementMatrix({ asRole, record }) {
  const area = 'Projects management (Handbook Task 19)';

  // ---- Any active teammate may create a project ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.projects (name, created_by) values ('Marketing Campaign', $1) returning id`,
      [IDENTITIES.employeeB.id]
    );
    record({ area, action: 'Create a project as a plain employee', identity: 'employeeB', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  // ---- updated_by/updated_at are auto-set from the ACTING identity,
  // never trusted from a client-supplied value -- attempt to spoof both
  // and confirm the real caller wins. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const ins = await tryQuery(c, `insert into public.projects (name, created_by) values ('Attribution test project', $1) returning id`, [IDENTITIES.employeeA.id]);
    const projectId = ins.rows[0]?.id;

    const upd = await tryQuery(
      c,
      `update public.projects set name = 'Attribution test project (renamed)', updated_by = $2, updated_at = '2020-01-01' where id = $1 returning updated_by, updated_at`,
      [projectId, IDENTITIES.employeeB.id] // attempted spoof -- claims employeeB did this
    );
    const row = upd.rows[0];
    const correctlyAttributed = upd.ok && row && row.updated_by === IDENTITIES.employeeA.id && new Date(row.updated_at).getFullYear() > 2020;
    record({
      area, action: 'Renaming a project sets updated_by/updated_at from the REAL caller, ignoring a spoofed value', identity: 'employeeA',
      allowed: correctlyAttributed, expectedSecure: 'allow',
      note: upd.error || (correctlyAttributed ? `updated_by correctly = employeeA (spoofed employeeB rejected)` : `CRITICAL: got updated_by=${row && row.updated_by}, updated_at=${row && row.updated_at}`),
    });
  });

  // ---- id/created_by/created_at stay immutable on update, same
  // convention as work_items -- a rename should never be able to also
  // rewrite provenance. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const ins = await tryQuery(c, `insert into public.projects (name, created_by) values ('Immutability test project', $1) returning id, created_by, created_at`, [IDENTITIES.employeeA.id]);
    const projectId = ins.rows[0]?.id;
    const originalCreatedBy = ins.rows[0]?.created_by;
    const originalCreatedAt = ins.rows[0]?.created_at;

    const upd = await tryQuery(
      c,
      `update public.projects set name = 'renamed', created_by = $2, created_at = '2020-01-01' where id = $1 returning created_by, created_at`,
      [projectId, IDENTITIES.employeeB.id]
    );
    const row = upd.rows[0];
    const stayedImmutable = upd.ok && row && row.created_by === originalCreatedBy && new Date(row.created_at).getTime() === new Date(originalCreatedAt).getTime();
    record({
      area, action: 'created_by/created_at cannot be rewritten via UPDATE, even by the project\'s own creator', identity: 'employeeA',
      allowed: stayedImmutable, expectedSecure: 'allow',
      note: upd.error || (stayedImmutable ? 'provenance unchanged' : `CRITICAL: created_by/created_at were rewritten -- got ${JSON.stringify(row)}`),
    });
  });

  // ---- Archiving is open to any active teammate (same peer model),
  // and does not delete or hide the project row or its Firm Work. ----
  await asRole(IDENTITIES.employeeB, async (c) => {
    const r = await tryQuery(c, `update public.projects set status = 'archived' where id = $1 and status = 'active'`, [PROJECT.id]);
    record({ area, action: 'Archive a project created by someone else (peer model)', identity: 'employeeB', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });

    const reactivate = await tryQuery(c, `update public.projects set status = 'active' where id = $1`, [PROJECT.id]);
    record({ area, action: 'Reactivate an archived project', identity: 'employeeB', allowed: reactivate.ok && reactivate.rowCount === 1, expectedSecure: 'allow', note: reactivate.error || `${reactivate.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, project_id, created_by)
       values ('Item under a soon-to-be-archived project', $1, 'to_do', 'firm', 'Administration', $2, $1) returning id`,
      [IDENTITIES.employeeA.id, PROJECT.id]
    );
    const itemId = ins.rows[0]?.id;
    await c.query(`update public.projects set status = 'archived' where id = $1`, [PROJECT.id]);

    const stillThere = await tryQuery(c, `select project_id from public.work_items where id = $1`, [itemId]);
    const row = stillThere.rows[0];
    const historyPreserved = stillThere.ok && row && row.project_id === PROJECT.id;
    record({
      area, action: 'Archiving a project does NOT clear or delete project_id on Firm Work that references it', identity: 'employeeA',
      allowed: historyPreserved, expectedSecure: 'allow',
      note: stillThere.error || (historyPreserved ? 'project_id untouched, history intact' : `CRITICAL: project_id was cleared or the row vanished -- got ${JSON.stringify(row)}`),
    });

    await c.query(`update public.projects set status = 'active' where id = $1`, [PROJECT.id]); // leave the shared fixture as found
  });

  // ---- No delete policy exists on projects at all -- archiving is the
  // only offered retirement path, by design (Task 19: "must not delete
  // or hide historical Firm Work permanently"). ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `delete from public.projects where id = $1`, [PROJECT.id]);
    record({
      area, action: 'Delete a project outright (even as admin) -- no delete policy exists, by design', identity: 'admin',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a project was deleted -- historical Firm Work under it would lose its label with no way back',
    });
  });
};
