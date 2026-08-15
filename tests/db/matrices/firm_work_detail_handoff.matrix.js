const { tryQuery } = require('../support/probe');
const { IDENTITIES, PROJECT } = require('../support/ids');

// Handbook Task 18: the three real schema gaps this task closes -- an
// optional update_type on work_comments (explicitly NOT a Decision
// Needed/Owner Approval hierarchy), follow_up_date usable on Firm Work
// (previously client-scope only), and project_id changes now showing up
// in work_activity's trusted history (previously the only field Task 15
// added that guard_work_item_update() never logged).
module.exports = async function firmWorkDetailHandoffMatrix({ asRole, asSuperuser, record }) {
  const area = 'Firm Work async handoff (Handbook Task 18)';

  async function makeFirmItem(c, title) {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
       values ($2, $1, 'to_do', 'firm', 'Administration', $1) returning id`,
      [IDENTITIES.employeeA.id, title]
    );
    return ins.rows[0]?.id;
  }

  // ---- update_type: valid values accepted ----
  for (const t of ['progress', 'result', 'blocker', 'handoff', 'note']) {
    await asRole(IDENTITIES.employeeA, async (c) => {
      const itemId = await makeFirmItem(c, `update_type=${t} test item`);
      const r = await tryQuery(
        c,
        `insert into public.work_comments (work_item_id, author_id, body, update_type) values ($1, $2, 'test update', $3)`,
        [itemId, IDENTITIES.employeeA.id, t]
      );
      record({ area, action: `Post an update with update_type='${t}'`, identity: 'employeeA', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'accepted' });
    });
  }

  // ---- update_type: NULL (no type) still allowed -- optional, not required ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'update_type=null test item');
    const r = await tryQuery(
      c,
      `insert into public.work_comments (work_item_id, author_id, body) values ($1, $2, 'untyped update')`,
      [itemId, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'Post an update with no update_type at all', identity: 'employeeA', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'accepted -- type is optional' });
  });

  // ---- update_type: the explicitly-rejected hierarchy never sneaks back
  // in -- the owner rejected Decision Needed / Owner Approval in an
  // earlier task; this proves the check constraint actually enforces
  // that, not just that the UI's <select> happens not to offer it. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'update_type=decision_needed test item');
    const r = await tryQuery(
      c,
      `insert into public.work_comments (work_item_id, author_id, body, update_type) values ($1, $2, 'bad type', 'decision_needed')`,
      [itemId, IDENTITIES.employeeA.id]
    );
    record({
      area, action: "Post an update with update_type='decision_needed' (the explicitly rejected hierarchy)", identity: 'employeeA',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a Decision Needed / Owner Approval type was accepted despite being explicitly rejected',
    });
  });

  // ---- follow_up_date: now usable on Firm Work (was client-scope only) ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'follow_up_date test item');
    const r = await tryQuery(
      c,
      `update public.work_items set follow_up_date = current_date + 7 where id = $1`,
      [itemId]
    );
    record({ area, action: 'Set follow_up_date on a Firm Work item', identity: 'employeeA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  // ---- Blocked transition + blocker_reason + follow_up_date together in
  // one write -- the exact shape the detail page's "Save Blocker Context
  // & Mark Blocked" button sends. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'blocked+follow_up_date combined test item');
    await c.query(`update public.work_items set status = 'in_progress' where id = $1`, [itemId]);
    const r = await tryQuery(
      c,
      `update public.work_items set status = 'blocked', blocker_reason = $2, follow_up_date = current_date + 3 where id = $1`,
      [itemId, 'Waiting on the landlord to confirm a viewing date before we can proceed.']
    );
    record({
      area, action: 'Mark Blocked with a real reason and a follow-up date in the same write', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)`,
    });
  });

  // ---- project_id changes now show up in work_activity's trusted
  // history (Task 15 added the column; this task closes the gap where
  // changing it was silently unlogged). A second, scratch project is
  // created here (any active teammate may -- projects_insert) so there's
  // a real old -> new transition to observe, not just NULL -> something.
  // Checked by exact detail-string EXISTENCE rather than "most recent
  // row" -- every insert in this transaction shares one now() (Postgres
  // freezes now() for the whole transaction), so both project_changed
  // rows below get an IDENTICAL created_at and "order by created_at desc
  // limit 1" can't reliably tell them apart. Existence of the exact
  // expected string sidesteps the tie entirely. ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'project_id activity logging test item');
    await c.query(`update public.work_items set project_id = $2 where id = $1`, [itemId, PROJECT.id]);

    const proj2 = await tryQuery(
      c,
      `insert into public.projects (name, created_by) values ('Marketing Campaign', $1) returning id`,
      [IDENTITIES.employeeA.id]
    );
    const proj2Id = proj2.rows[0]?.id;

    const r = await tryQuery(c, `update public.work_items set project_id = $2 where id = $1`, [itemId, proj2Id]);
    if (!r.ok) {
      record({ area, action: 'Change project_id on an existing Firm Work item', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: r.error });
      return;
    }
    const activity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'project_changed' and detail = 'Office Search → Marketing Campaign'`,
      [itemId]
    );
    const loggedCorrectly = activity.rowCount === 1;
    record({
      area, action: 'project_id change is logged to work_activity as old -> new (Task 18 HISTORY requirement)', identity: 'employeeA',
      allowed: loggedCorrectly, expectedSecure: 'allow',
      note: loggedCorrectly ? 'logged: "Office Search → Marketing Campaign"' : 'CRITICAL: expected a project_changed row reading "Office Search → Marketing Campaign", not found',
    });
  });

  // ---- project_id change FROM a project back to none also logs (not
  // just the "picked a project for the first time" direction). ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'project_id cleared activity logging test item');
    await c.query(`update public.work_items set project_id = $2 where id = $1`, [itemId, PROJECT.id]);
    const r = await tryQuery(c, `update public.work_items set project_id = null where id = $1`, [itemId]);
    if (!r.ok) {
      record({ area, action: 'Clear project_id on an existing Firm Work item', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: r.error });
      return;
    }
    const activity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'project_changed' and detail = 'Office Search → —'`,
      [itemId]
    );
    const loggedCorrectly = activity.rowCount === 1;
    record({
      area, action: 'Clearing project_id (back to no project) is also logged as old -> —', identity: 'employeeA',
      allowed: loggedCorrectly, expectedSecure: 'allow',
      note: loggedCorrectly ? 'logged: "Office Search → —"' : 'CRITICAL: expected "Office Search → —", not found',
    });
  });

  // ---- Comments read policy already covers update_type (it's just a
  // new column on an existing, already-tested-readable table) -- one
  // sanity check that a colleague can read a typed update, not a full
  // re-test of Task 6's read policy. asRole() wraps each call in its own
  // BEGIN...ROLLBACK, so a row seeded in one asRole call never persists
  // for a later one -- this needs the same single-transaction,
  // role-switching technique firm_work_form_validation.matrix.js's
  // "historical blocked item" case and client_work_full_lifecycle.matrix.js
  // use for the same reason. ----
  await asSuperuser(async (c) => {
    await c.query('BEGIN');
    try {
      async function actAs(identity) {
        await c.query('SET LOCAL ROLE authenticated');
        await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: identity.id, role: 'authenticated' })]);
      }
      await actAs(IDENTITIES.employeeA);
      const itemId = await makeFirmItem(c, 'employeeB reads typed update test item');
      await c.query(
        `insert into public.work_comments (work_item_id, author_id, body, update_type) values ($1, $2, 'handoff note', 'handoff')`,
        [itemId, IDENTITIES.employeeA.id]
      );

      await actAs(IDENTITIES.employeeB);
      const r = await tryQuery(c, `select update_type from public.work_comments where work_item_id = $1 and update_type = 'handoff'`, [itemId]);
      record({
        area, action: "A different active teammate can read a typed update on someone else's Firm Work (peer model, unchanged)", identity: 'employeeB',
        allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)`,
      });
    } finally {
      await c.query('ROLLBACK').catch(() => {});
    }
  });
};
