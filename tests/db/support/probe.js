// Runs one query as whatever role/claims the caller has already SET
// LOCAL'd on `client` (see harness.asRole), and normalizes the outcome
// so matrix files don't each repeat their own try/catch. Never throws --
// a denial (RLS silently matching 0 rows) and a hard error (permission
// denied on a REVOKEd function, or a trigger's RAISE EXCEPTION) are both
// legitimate "this was blocked" outcomes, just via different mechanisms,
// and matrix files frequently need to tell them apart in their notes.
async function tryQuery(client, sql, params) {
  try {
    const res = await client.query(sql, params);
    return { ok: true, rowCount: res.rowCount, rows: res.rows, error: null };
  } catch (e) {
    return { ok: false, rowCount: 0, rows: [], error: e.message };
  }
}

module.exports = { tryQuery };
