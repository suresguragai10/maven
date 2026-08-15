const { tryQuery } = require('../support/probe');
const { IDENTITIES } = require('../support/ids');

// Handbook Task 22: the two real logging gaps this task closes
// (next_action/blocker_reason changes were never written to
// work_activity, despite both being on this task's own "show primarily
// Firm Work changes" example list), the mark_feed_seen() RPC's
// attribution and narrow scope, and that Client Work stays out of what
// this feed's own query would fetch (the exclusion lives in staff.js's
// query shape, not new RLS -- this just confirms the RPC/logging pieces
// that ARE schema-level).
module.exports = async function sinceLastSeenMatrix({ asRole, record }) {
  const area = 'Since Last Seen feed (Handbook Task 22)';

  async function makeFirmItem(c, title) {
    const ins = await tryQuery(
      c,
      `insert into public.work_items (title, assignee_id, status, work_scope, firm_category, created_by)
       values ($2, $1, 'to_do', 'firm', 'Administration', $1) returning id`,
      [IDENTITIES.employeeA.id, title]
    );
    return ins.rows[0]?.id;
  }

  // ---- next_action changes are now logged ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'next_action logging test item');
    const r = await tryQuery(c, `update public.work_items set next_action = 'Call the landlord back' where id = $1`, [itemId]);
    if (!r.ok) { record({ area, action: 'Set next_action', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: r.error }); return; }
    const activity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'next_action_changed' and detail = 'Next action: Call the landlord back'`,
      [itemId]
    );
    record({
      area, action: 'Setting next_action logs a next_action_changed activity row with the new value', identity: 'employeeA',
      allowed: activity.rowCount === 1, expectedSecure: 'allow',
      note: activity.rowCount === 1 ? 'logged correctly' : 'CRITICAL: next_action change was not logged to work_activity',
    });
  });

  // ---- clearing next_action is also logged (not just setting it) ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'next_action cleared logging test item');
    await c.query(`update public.work_items set next_action = 'Something' where id = $1`, [itemId]);
    const r = await tryQuery(c, `update public.work_items set next_action = null where id = $1`, [itemId]);
    if (!r.ok) { record({ area, action: 'Clear next_action', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: r.error }); return; }
    const activity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'next_action_changed' and detail = 'Next action cleared'`,
      [itemId]
    );
    record({
      area, action: 'Clearing next_action is also logged, not just setting it', identity: 'employeeA',
      allowed: activity.rowCount === 1, expectedSecure: 'allow',
      note: activity.rowCount === 1 ? 'logged correctly' : 'CRITICAL: clearing next_action was not logged',
    });
  });

  // ---- blocker_reason changes are now logged (added/removed) ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const itemId = await makeFirmItem(c, 'blocker_reason logging test item');
    await c.query(`update public.work_items set status = 'in_progress' where id = $1`, [itemId]);
    const r = await tryQuery(
      c,
      `update public.work_items set status = 'blocked', blocker_reason = 'Waiting on the landlord to confirm a viewing date.' where id = $1`,
      [itemId]
    );
    if (!r.ok) { record({ area, action: 'Set blocker_reason', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: r.error }); return; }
    const activity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'blocker_changed' and detail like 'Blocker: Waiting on the landlord%'`,
      [itemId]
    );
    record({
      area, action: 'Marking Blocked with a reason logs a blocker_changed activity row', identity: 'employeeA',
      allowed: activity.rowCount === 1, expectedSecure: 'allow',
      note: activity.rowCount === 1 ? 'logged correctly' : 'CRITICAL: blocker_reason change was not logged',
    });

    const clearR = await tryQuery(c, `update public.work_items set status = 'in_progress', blocker_reason = null where id = $1`, [itemId]);
    if (!clearR.ok) { record({ area, action: 'Clear blocker_reason', identity: 'employeeA', allowed: false, expectedSecure: 'allow', note: clearR.error }); return; }
    const clearedActivity = await c.query(
      `select 1 from public.work_activity where work_item_id = $1 and action = 'blocker_changed' and detail = 'Blocker cleared'`,
      [itemId]
    );
    record({
      area, action: 'Removing a blocker (status leaves Blocked, blocker_reason cleared) logs a blocker_changed row', identity: 'employeeA',
      allowed: clearedActivity.rowCount === 1, expectedSecure: 'allow',
      note: clearedActivity.rowCount === 1 ? 'logged correctly' : 'CRITICAL: blocker_reason clearing was not logged',
    });
  });

  // ---- mark_feed_seen(): sets the CALLER's own since_last_seen_at,
  // never someone else's, and never trusts a client-supplied value
  // (there is none to supply -- the RPC takes no arguments at all). ----
  await asRole(IDENTITIES.employeeA, async (c) => {
    const before = await c.query(`select since_last_seen_at from public.profiles where id = $1`, [IDENTITIES.employeeA.id]);
    const r = await tryQuery(c, `select public.mark_feed_seen()`);
    const after = await c.query(`select since_last_seen_at from public.profiles where id = $1`, [IDENTITIES.employeeA.id]);
    const otherUnchanged = await c.query(`select since_last_seen_at from public.profiles where id = $1`, [IDENTITIES.employeeB.id]);
    const updatedSelf = r.ok && after.rows[0]?.since_last_seen_at && after.rows[0].since_last_seen_at !== before.rows[0]?.since_last_seen_at;
    const othersUntouched = !otherUnchanged.rows[0]?.since_last_seen_at;
    record({
      area, action: 'mark_feed_seen() sets only the calling user\'s own since_last_seen_at', identity: 'employeeA',
      allowed: updatedSelf && othersUntouched, expectedSecure: 'allow',
      note: r.error || (updatedSelf && othersUntouched ? 'employeeA updated, employeeB untouched' : `CRITICAL: got self=${JSON.stringify(after.rows[0])}, other=${JSON.stringify(otherUnchanged.rows[0])}`),
    });
  });

  // ---- An inactive user cannot call mark_feed_seen() -- same
  // fail-closed convention as every other SECURITY DEFINER RPC in this
  // schema (e.g. add_deadline_rule() from Handbook Task 12). ----
  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, `select public.mark_feed_seen()`);
    record({
      area, action: 'An inactive user cannot call mark_feed_seen()', identity: 'inactive',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: an inactive account was able to mark the feed reviewed',
    });
  });
};
