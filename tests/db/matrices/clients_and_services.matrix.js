const { tryQuery } = require('../support/probe');
const { CLIENTS, SERVICE_TEMPLATE } = require('../support/ids');

module.exports = async function clientsMatrix({ asRole, IDENTITIES, ANON, record }) {
  const area = 'clients/client_services';

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.clients', []);
    record({ area, action: 'SELECT clients list', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow', note: `${r.rowCount} row(s) - needed for New Work client picker` });
  });

  await asRole(ANON, async (c) => {
    const r = await tryQuery(c, 'select id from public.clients', []);
    record({ area, action: 'SELECT clients list', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.admin, async (c) => {
    const r = await tryQuery(c, `insert into public.clients (name) values ('New Client Co.')`, []);
    record({ area, action: 'INSERT new client', identity: 'admin', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'inserted' });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `insert into public.clients (name) values ('Unauthorized Client Co.')`, []);
    record({ area, action: 'INSERT new client', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted' });
  });

  await asRole(IDENTITIES.reviewerA, async (c) => {
    const r = await tryQuery(c, `update public.clients set name = 'Renamed' where id = $1`, [CLIENTS.alpha.id]);
    record({ area, action: 'UPDATE a client\'s details', identity: 'reviewerA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) affected - clients_update_admin is admin-only, reviewer is not exempted` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, 'select id from public.client_services where client_id = $1', [CLIENTS.alpha.id]);
    record({ area, action: 'SELECT client_services', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow', note: `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.employeeA, async (c) => {
    const r = await tryQuery(c, `insert into public.client_services (client_id, service_template_id, assignee_id) values ($1, $2, $3)`, [CLIENTS.beta.id, SERVICE_TEMPLATE.id, IDENTITIES.employeeA.id]);
    record({ area, action: 'INSERT a client_services subscription', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted - admin-only per client_services_write' });
  });

  // ---- Handbook Task 9: deactivated profile, still-valid session ----
  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select id from public.clients', []);
    record({ area, action: 'SELECT clients list, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });

  await asRole(IDENTITIES.inactive, async (c) => {
    const r = await tryQuery(c, 'select id from public.client_services', []);
    record({ area, action: 'SELECT client_services, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
  });
};
