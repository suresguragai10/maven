const { tryQuery } = require('../support/probe');
const {
  CLIENTS, SERVICE_TEMPLATE, SERVICE_TEMPLATE_QUARTERLY, SERVICE_TEMPLATE_YEARLY,
} = require('../support/ids');

// node-postgres parses a `date` column into a JS Date at UTC midnight by
// default; format defensively so a string (shouldn't happen, but cheap
// to handle) or a Date both compare the same way.
function fmtDate(d) {
  if (d == null) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Handbook Task 11: proves the REQUESTED period's own Gregorian date
// range -- never current_date -- drives both the due dates computed at
// generation time and the new structured period_type/period_start_date/
// period_end_date columns, for monthly/quarterly/yearly, whether the
// requested period is in the past, present, or future relative to
// whenever this suite happens to run. Distinct from recurring_
// generation.matrix.js, which covers WHO may call these functions --
// this file covers WHETHER what gets generated is actually correct.
// filing_deadline_day/internal_offset_days per seeded template (see
// tests/db/support/seed.js): monthly SERVICE_TEMPLATE = 25/3, quarterly
// SERVICE_TEMPLATE_QUARTERLY = 15/5, yearly SERVICE_TEMPLATE_YEARLY =
// 10/7 -- all comfortably under 28, so no month-end clamping is expected
// to trigger in any case below (that clamping behavior itself predates
// this task and is unchanged).
module.exports = async function periodNormalizationMatrix({ asRole, IDENTITIES, record }) {
  const area = 'period normalization (Handbook Task 11)';

  async function generateAndFetch(c, client, template, label, start, end, periodType) {
    const genRes = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, [label, periodType, start, end]);
    const rowRes = await tryQuery(
      c,
      `select internal_due_date, external_due_date, period_type, period_start_date, period_end_date
       from public.work_items where client_id = $1 and service_template_id = $2 and period = $3`,
      [client.id, template.id, label]
    );
    return { genRes, row: rowRes.rows[0] };
  }

  // ---- historical monthly period: well before whenever this suite runs ----
  await asRole(IDENTITIES.admin, async (c) => {
    const { genRes, row } = await generateAndFetch(c, CLIENTS.alpha, SERVICE_TEMPLATE, 'Poush 2081 (historical test)', '2025-01-01', '2025-01-31', 'monthly');
    const ok = genRes.ok && row && fmtDate(row.external_due_date) === '2025-01-25' && fmtDate(row.internal_due_date) === '2025-01-22'
      && row.period_type === 'monthly' && fmtDate(row.period_start_date) === '2025-01-01' && fmtDate(row.period_end_date) === '2025-01-31';
    record({
      area, action: 'Generate a historical monthly period (Jan 2025) — due dates land in the requested period, not today', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `external=${fmtDate(row.external_due_date)}, internal=${fmtDate(row.internal_due_date)} — correct` : `wrong: external=${fmtDate(row && row.external_due_date)}, internal=${fmtDate(row && row.internal_due_date)}, period_type=${row && row.period_type}`),
    });
  });

  // ---- current monthly period: computed from wall-clock "today" so this
  // genuinely exercises the case where the requested period overlaps the
  // day the suite happens to run, without hardcoding a date that will
  // eventually become "historical" itself ----
  await asRole(IDENTITIES.admin, async (c) => {
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const pad = (n) => String(n).padStart(2, '0');
    const start = `${y}-${pad(m + 1)}-01`;
    const end = fmtDate(new Date(Date.UTC(y, m + 1, 0)));
    const expectedExternal = `${y}-${pad(m + 1)}-25`;
    const expectedInternal = `${y}-${pad(m + 1)}-22`;
    const { genRes, row } = await generateAndFetch(c, CLIENTS.alpha, SERVICE_TEMPLATE, 'Current Period Test', start, end, 'monthly');
    const ok = genRes.ok && row && fmtDate(row.external_due_date) === expectedExternal && fmtDate(row.internal_due_date) === expectedInternal;
    record({
      area, action: 'Generate the current monthly period (brackets today) — due dates still derive from the requested range', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `external=${fmtDate(row.external_due_date)}, internal=${fmtDate(row.internal_due_date)} — correct` : `wrong: expected external=${expectedExternal}/internal=${expectedInternal}, got external=${fmtDate(row && row.external_due_date)}/internal=${fmtDate(row && row.internal_due_date)}`),
    });
  });

  // ---- future monthly period: fixed, always ahead of any realistic run
  // of this suite ----
  await asRole(IDENTITIES.admin, async (c) => {
    const { genRes, row } = await generateAndFetch(c, CLIENTS.alpha, SERVICE_TEMPLATE, 'Ashadh 2087 (future test)', '2030-06-01', '2030-06-30', 'monthly');
    const ok = genRes.ok && row && fmtDate(row.external_due_date) === '2030-06-25' && fmtDate(row.internal_due_date) === '2030-06-22';
    record({
      area, action: 'Generate a future monthly period (Jun 2030) — due dates land in 2030, not today\'s month', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `external=${fmtDate(row.external_due_date)}, internal=${fmtDate(row.internal_due_date)} — correct` : `wrong: external=${fmtDate(row && row.external_due_date)}, internal=${fmtDate(row && row.internal_due_date)}`),
    });
  });

  // ---- quarterly period ----
  await asRole(IDENTITIES.admin, async (c) => {
    const { genRes, row } = await generateAndFetch(c, CLIENTS.alpha, SERVICE_TEMPLATE_QUARTERLY, 'Q4 2082/83 (test)', '2026-04-01', '2026-06-30', 'quarterly');
    const ok = genRes.ok && row && fmtDate(row.external_due_date) === '2026-06-15' && fmtDate(row.internal_due_date) === '2026-06-10'
      && row.period_type === 'quarterly';
    record({
      area, action: 'Generate a quarterly period — due dates land in the period\'s ending month', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `external=${fmtDate(row.external_due_date)}, internal=${fmtDate(row.internal_due_date)} — correct` : `wrong: external=${fmtDate(row && row.external_due_date)}, internal=${fmtDate(row && row.internal_due_date)}, period_type=${row && row.period_type}`),
    });
  });

  // ---- annual/yearly period ----
  await asRole(IDENTITIES.admin, async (c) => {
    const { genRes, row } = await generateAndFetch(c, CLIENTS.alpha, SERVICE_TEMPLATE_YEARLY, 'FY 2082/83 (test)', '2025-07-16', '2026-07-15', 'yearly');
    const ok = genRes.ok && row && fmtDate(row.external_due_date) === '2026-07-10' && fmtDate(row.internal_due_date) === '2026-07-03'
      && row.period_type === 'yearly';
    record({
      area, action: 'Generate a yearly period — due dates land in the period\'s ending month', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: genRes.error || (ok ? `external=${fmtDate(row.external_due_date)}, internal=${fmtDate(row.internal_due_date)} — correct` : `wrong: external=${fmtDate(row && row.external_due_date)}, internal=${fmtDate(row && row.internal_due_date)}, period_type=${row && row.period_type}`),
    });
  });

  // ---- duplicate generation: same call twice in the SAME transaction
  // (asRole rolls back at the end of the callback, so both calls must
  // happen inside one callback to observe the second one seeing the
  // first's insert) ----
  await asRole(IDENTITIES.admin, async (c) => {
    const first = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Magh 2082 (dup test)', 'monthly', '2026-01-15', '2026-02-13']);
    const second = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Magh 2082 (dup test)', 'monthly', '2026-01-15', '2026-02-13']);
    const firstCount = first.rows[0]?.generate_period_work_for_period;
    const secondCount = second.rows[0]?.generate_period_work_for_period;
    // firstCount isn't pinned to a literal (it's however many active
    // monthly client_services the seed happens to have -- currently more
    // than one, see SERVICE_TEMPLATE_UNGOVERNED) -- idempotency is about
    // the SECOND identical call creating nothing new, not the exact size
    // of the first.
    const ok = first.ok && second.ok && firstCount > 0 && secondCount === 0;
    record({
      area, action: 'Call generate_period_work_for_period twice for the identical client+service+period', identity: 'admin',
      allowed: ok, expectedSecure: 'allow',
      note: (first.error || second.error) || (ok ? `first created ${firstCount}, second created ${secondCount} — idempotent, no duplicate work_items row` : `not idempotent: first=${firstCount}, second=${secondCount}`),
    });
  });

  // ---- invalid/ambiguous period: missing or reversed Gregorian range
  // must be rejected, not silently substituted with today's date ----
  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Missing Start Test', 'monthly', null, '2026-08-31']);
    record({
      area, action: 'Generate with p_period_start = null', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: succeeded with no period_start — must fail closed rather than silently falling back to any default',
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Missing End Test', 'monthly', '2026-08-01', null]);
    record({
      area, action: 'Generate with p_period_end = null', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: succeeded with no period_end — must fail closed rather than silently falling back to any default',
    });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `select public.generate_period_work_for_period($1, $2, $3, $4)`, ['Reversed Range Test', 'monthly', '2026-09-01', '2026-08-01']);
    record({
      area, action: 'Generate with p_period_end before p_period_start', identity: 'admin',
      allowed: r.ok, expectedSecure: 'deny',
      note: r.error || 'CRITICAL: succeeded with an end date before the start date — an ambiguous/invalid range must be rejected',
    });
  });
};
