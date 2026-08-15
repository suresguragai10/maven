// Handbook Task 17: a real, empirical browser test of the Firm Work
// list/form needs a logged-in session and real-looking data, but this
// environment has no live Supabase credentials (documented since
// tests/ui/app/staff.spec.js's own header comment, and every DB-facing
// handbook task this session). Rather than reimplementing any part of
// the Supabase client, this intercepts the REAL @supabase/supabase-js
// UMD bundle's own network calls (the exact file dist/staff/supabase.js
// ships, per build.js) via Playwright's page.route() and answers them
// with fixture data -- staff.js and the real client library run
// completely unmodified; only the network boundary is faked.
//
// Scope: enough of PostgREST's wire format to drive real UI behavior
// (list rendering, filters, search, create/edit validation), NOT a
// general-purpose PostgREST emulator -- GET always returns the full
// fixture array for that table regardless of query params (query
// CORRECTNESS is already proven by the DB permission harness in
// tests/db/; this mock's job is only to give the UI something real to
// render and to let assertions inspect what request the UI actually
// sent, e.g. confirming a filter/search value appears in the outgoing
// query string).

const SUPABASE_URL = 'https://moqmgyniwytwmlcdthzy.supabase.co';

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A structurally-valid (unsigned) JWT -- gotrue-js decodes the payload
// client-side to read `exp`/`sub`, it does not verify the signature
// itself (that only happens server-side, which is exactly what's being
// mocked out here).
function fakeJwt(userId) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${header}.${payload}.mock-signature`;
}

function fakeSession(user) {
  return {
    access_token: fakeJwt(user.id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

// tableName -> array of rows. Mutated in place by insert/update/delete so
// a test can create an item then immediately assert it appears — but
// GET always returns the CURRENT full array, unfiltered, per the header
// note above.
async function installSupabaseMock(page, { user, tables }) {
  const store = {};
  Object.keys(tables || {}).forEach((k) => { store[k] = (tables[k] || []).slice(); });
  const requestLog = [];

  await page.route(`${SUPABASE_URL}/auth/v1/token**`, async (route) => {
    requestLog.push({ url: route.request().url(), method: route.request().method() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession(user)) });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/logout**`, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requestLog.push({ url: request.url(), method: request.method(), postData: request.postData() });
    const table = url.pathname.replace('/rest/v1/', '');
    store[table] = store[table] || [];

    if (request.method() === 'GET') {
      // Minimal eq.<value> filtering -- enough for the app's own
      // .eq('id', ...) / .eq('work_item_id', ...) lookups (used by
      // .single() calls in particular, which need a real, correctly-
      // scoped match) to find the right row. Every other PostgREST
      // operator (ilike, or, gte/lte, in) is left unfiltered -- this
      // mock's job is exercising the UI, not re-proving query semantics
      // the DB permission harness already covers; tests that care about
      // a specific filter/search assert the OUTGOING request URL
      // instead of the returned rows.
      let rows = store[table];
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
        const m = /^eq\.(.*)$/.exec(value);
        if (m) rows = rows.filter((r) => String(r[key]) === m[1]);
      }
      // postgrest-js's .single()/.maybeSingle() send Accept: application/
      // vnd.pgrst.object+json and expect a bare JSON object in the
      // response, not an array -- returning an array here silently
      // breaks every .single() call (e.g. enterApp()'s own profile
      // fetch), which then reads as "no profile found" and logs the
      // mocked session straight back out.
      const wantsSingle = (request.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (wantsSingle) {
        if (rows.length === 1) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0]) });
        } else {
          await route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ message: 'mock: expected exactly one row' }) });
        }
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
        body: JSON.stringify(rows),
      });
      return;
    }

    if (request.method() === 'POST') {
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch (e) { /* ignore */ }
      const row = Object.assign(
        { id: 'mock-' + Math.random().toString(36).slice(2), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        body
      );
      store[table].push(row);
      const wantsRepresentation = (request.headers()['prefer'] || '').includes('return=representation');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: wantsRepresentation ? JSON.stringify([row]) : '',
      });
      return;
    }

    if (request.method() === 'PATCH') {
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch (e) { /* ignore */ }
      const idMatch = url.searchParams.get('id'); // e.g. "eq.<uuid>"
      const targetId = idMatch ? idMatch.replace(/^eq\./, '') : null;
      let updated = [];
      store[table] = store[table].map((r) => {
        if (targetId && r.id === targetId) {
          const merged = Object.assign({}, r, body, { updated_at: new Date().toISOString() });
          updated.push(merged);
          return merged;
        }
        return r;
      });
      const wantsRepresentation = (request.headers()['prefer'] || '').includes('return=representation');
      await route.fulfill({ status: 200, contentType: 'application/json', body: wantsRepresentation ? JSON.stringify(updated) : '' });
      return;
    }

    if (request.method() === 'DELETE') {
      const idMatch = url.searchParams.get('id');
      const targetId = idMatch ? idMatch.replace(/^eq\./, '') : null;
      store[table] = store[table].filter((r) => !(targetId && r.id === targetId));
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  return { store, requestLog };
}

module.exports = { installSupabaseMock, fakeSession };
