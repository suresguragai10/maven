const { tryQuery } = require('../support/probe');
const { SERVICE_TEMPLATE } = require('../support/ids');

module.exports = async function templatesAndSettingsMatrix({ asRole, IDENTITIES, ANON, record }) {
  {
    const area = 'service_templates / service_template_items';

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, 'select id from public.service_templates', []);
      record({ area, action: 'SELECT templates list', identity: 'employeeA', allowed: r.rowCount > 0, expectedSecure: 'allow', note: 'needed for New Work modal template picker' });
    });

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, `insert into public.service_templates (title, category) values ('Unauthorized Template', 'Tax')`, []);
      record({ area, action: 'INSERT a new template', identity: 'employeeA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'inserted' });
    });

    await asRole(IDENTITIES.admin, async (c) => {
      const r = await tryQuery(c, `insert into public.service_templates (title, category) values ('Admin Template', 'Tax')`, []);
      record({ area, action: 'INSERT a new template', identity: 'admin', allowed: r.ok, expectedSecure: 'allow', note: r.error || 'inserted' });
    });

    await asRole(IDENTITIES.reviewerA, async (c) => {
      const r = await tryQuery(c, `delete from public.service_template_items where template_id = $1`, [SERVICE_TEMPLATE.id]);
      record({ area, action: 'DELETE template checklist items', identity: 'reviewerA', allowed: r.ok && r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s) - admin-only` });
    });

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select id from public.service_templates', []);
      record({ area, action: 'SELECT templates list, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });
  }

  {
    const area = 'app_settings';

    await asRole(IDENTITIES.employeeA, async (c) => {
      const r = await tryQuery(c, 'select key from public.app_settings', []);
      record({ area, action: 'SELECT workflow settings', identity: 'employeeA', allowed: r.ok, expectedSecure: 'allow', note: r.error || `${r.rowCount} row(s) - readable, values aren't sensitive` });
    });

    await asRole(IDENTITIES.reviewerA, async (c) => {
      const r = await tryQuery(c, `insert into public.app_settings (key, value) values ('waiting_stale_days', '5') on conflict (key) do update set value = excluded.value`, []);
      record({ area, action: 'UPSERT a workflow setting', identity: 'reviewerA', allowed: r.ok, expectedSecure: 'deny', note: r.error || 'succeeded - admin-only per app_settings_update/insert_admin' });
    });

    await asRole(ANON, async (c) => {
      const r = await tryQuery(c, 'select key from public.app_settings limit 1', []);
      record({ area, action: 'SELECT workflow settings', identity: 'anon', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });

    await asRole(IDENTITIES.inactive, async (c) => {
      const r = await tryQuery(c, 'select key from public.app_settings', []);
      record({ area, action: 'SELECT workflow settings, as a deactivated profile with a still-valid session', identity: 'inactive', allowed: r.rowCount > 0, expectedSecure: 'deny', note: r.error || `${r.rowCount} row(s)` });
    });
  }
};
