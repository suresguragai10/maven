const { tryQuery } = require('../support/probe');
const { CLIENTS, IDENTITIES } = require('../support/ids');

// Handbook Task 17: the two VALIDATION rules that needed real database
// enforcement -- Category required for Firm Work, and Blocked requiring
// real context, scoped so it never locks a historical record out of
// routine editing (see 20260828090000_firm_work_form_validation.sql's
// header for the full reasoning).
module.exports = async function firmWorkFormValidationMatrix({ asRole, asSuperuser, record }) {
  const area = 'Firm Work form validation (Handbook Task 17)';

  // ---- category required for Firm Work ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, created_by)
       values ('No category', $1, 'to_do', 'firm', $1)`,
      [IDENTITIES.employeeA.id]
    );
    record({
      area, action: 'CREATE Firm Work with no category', identity: 'employeeA',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: Firm Work was created with no category, contradicting this task\'s required-fields list',
    });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
       values ('Has a category', $1, 'to_do', 'firm', 'Marketing', $1) returning id`,
      [IDENTITIES.employeeA.id]
    );
    record({ area, action: 'CREATE Firm Work with a valid category', identity: 'employeeA', allowed: r.ok && r.rowCount === 1, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(
      c,
      `insert into public.work_items (client_id, title, assignee_id, status, work_scope, created_by)
       values ($1, 'Client Work, no firm_category', $2, 'to_do', 'client', $2)`,
      [CLIENTS.alpha.id, IDENTITIES.employeeA.id]
    );
    record({ area, action: 'CREATE Client Work with no firm_category (category is a Firm-Work-only requirement)', identity: 'employeeA', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'correctly unaffected -- firm_category is never required for Client Work' });
  });

  // ---- Blocked requires real context, only at the moment of
  // transitioning into it. Each case gets its OWN transaction (its own
  // fresh scratch item, taken to in_progress first) rather than three
  // sequential attempts in one asRole call -- a RAISE EXCEPTION poisons
  // the rest of a Postgres transaction (the exact bug found and fixed in
  // Handbook Task 10/14's tests), and two of these three attempts are
  // expected to fail. ----
  async function attemptBlockedTransition(blockerReasonValue) {
    return asRole(IDENTITIES.employeeA, async (c) => {
      const ins = await tryQuery(
        c,
        `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
         values ('Blocked-context test item', $1, 'to_do', 'firm', 'Administration', $1) returning id`,
        [IDENTITIES.employeeA.id]
      );
      const itemId = ins.rows[0]?.id;
      await c.query(`update public.work_items set status = 'in_progress' where id = $1`, [itemId]);
      const sql = blockerReasonValue === undefined
        ? `update public.work_items set status = 'blocked' where id = $1`
        : `update public.work_items set status = 'blocked', blocker_reason = $2 where id = $1`;
      const params = blockerReasonValue === undefined ? [itemId] : [itemId, blockerReasonValue];
      return tryQuery(c, sql, params);
    });
  }

  {
    const r = await attemptBlockedTransition(undefined);
    record({
      area, action: 'Transition to Blocked with no blocker_reason at all', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: marked Blocked with zero explanation of what\'s blocking it',
    });
  }
  {
    const r = await attemptBlockedTransition('ugh');
    record({
      area, action: 'Transition to Blocked with a too-short blocker_reason ("ugh")', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: a token, non-useful blocker_reason was accepted',
    });
  }
  {
    const r = await attemptBlockedTransition('Waiting on the landlord to confirm a viewing date before we can proceed.');
    record({
      area, action: 'Transition to Blocked with a real blocker_reason', identity: 'employeeA',
      allowed: r.ok && r.rowCount > 0, expectedSecure: 'allow',
      note: r.error || `${r.rowCount} row(s)`,
    });
  }

  // ---- an already-Blocked historical item (no context, from before
  // this rule existed) stays editable for unrelated changes -- this is
  // NOT an approval flow and must not lock old records out of routine
  // editing. Inserted directly as superuser (bypasses RLS's status=
  // 'to_do'-at-insert requirement and the UPDATE-only trigger) to
  // simulate a row that predates this migration. ----
  await asSuperuser(async (c) => {
    await c.query('BEGIN');
    try {
      const ins = await tryQuery(
        c,
        `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
         values ('Historical blocked item, no context', $1, 'blocked', 'firm', 'Administration', $1) returning id`,
        [IDENTITIES.employeeA.id]
      );
      const itemId = ins.rows[0]?.id;

      await c.query('SET LOCAL ROLE authenticated');
      await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: IDENTITIES.employeeA.id, role: 'authenticated' })]);
      const unrelatedEdit = await tryQuery(c, `update public.work_items set title = 'Renamed, still Blocked, still no context' where id = $1`, [itemId]);
      record({
        area, action: 'Unrelated edit (rename) on an already-Blocked historical item with no blocker_reason', identity: 'employeeA',
        allowed: unrelatedEdit.ok && unrelatedEdit.rowCount > 0, expectedSecure: 'allow',
        note: unrelatedEdit.error || `${unrelatedEdit.rowCount} row(s) - historical records are never locked out of routine editing just because they predate this rule`,
      });
    } finally {
      await c.query('ROLLBACK').catch(() => {});
    }
  });
};
