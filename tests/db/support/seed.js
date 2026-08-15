// Deterministic seed data, inserted once per test run as the raw
// superuser connection (no RLS applies to a superuser -- this is
// privileged setup, not something going through the app's own rules,
// exactly like a real one-time database seed would be). Every check in
// tests/db/matrices/ then re-approaches this same data AS one of the
// seeded identities via harness.asRole() to see what RLS/grants actually
// allow.

const {
  IDENTITIES, CLIENTS, SERVICE_TEMPLATE, CLIENT_SERVICE, WORK_ITEMS, TEST_VAULT_PASSPHRASE,
  SERVICE_TEMPLATE_QUARTERLY, CLIENT_SERVICE_QUARTERLY, SERVICE_TEMPLATE_YEARLY, CLIENT_SERVICE_YEARLY,
} = require('./ids');

async function seed(client) {
  // ---- profiles (via auth.users -> handle_new_user() trigger) ----
  for (const identity of Object.values(IDENTITIES)) {
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [identity.id, `${identity.fullName.replace(/\s+/g, '.').toLowerCase()}@test.local`, JSON.stringify({ full_name: identity.fullName })]
    );
    // handle_new_user() already created the profile as role='employee',
    // is_active=true -- fix up to the identity's actual intended state.
    await client.query(`update public.profiles set role = $2, is_active = $3 where id = $1`, [identity.id, identity.role, identity.isActive]);
  }

  // ---- clients ----
  for (const c of Object.values(CLIENTS)) {
    await client.query(`insert into public.clients (id, name) values ($1, $2)`, [c.id, c.name]);
  }

  // ---- service template (+ one checklist item, for recurring generation) ----
  await client.query(
    `insert into public.service_templates (id, title, category, recurrence, filing_deadline_day, internal_offset_days)
     values ($1, $2, 'Tax & Compliance', 'monthly', 25, 3)`,
    [SERVICE_TEMPLATE.id, SERVICE_TEMPLATE.title]
  );
  await client.query(
    `insert into public.service_template_items (template_id, stage, title, sort_order) values ($1, 'preparation', 'Collect purchase register', 0)`,
    [SERVICE_TEMPLATE.id]
  );
  await client.query(
    `insert into public.client_services (id, client_id, service_template_id, assignee_id, reviewer_id)
     values ($1, $2, $3, $4, $5)`,
    [CLIENT_SERVICE.id, CLIENTS.alpha.id, SERVICE_TEMPLATE.id, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
  );

  // ---- Handbook Task 11: quarterly + yearly templates/services, so
  // period_normalization.matrix.js can exercise _generate_period_work_core
  // for every recurrence type, each with its own deterministic
  // filing_deadline_day/internal_offset_days to assert against.
  await client.query(
    `insert into public.service_templates (id, title, category, recurrence, filing_deadline_day, internal_offset_days)
     values ($1, $2, 'Tax & Compliance', 'quarterly', 15, 5)`,
    [SERVICE_TEMPLATE_QUARTERLY.id, SERVICE_TEMPLATE_QUARTERLY.title]
  );
  await client.query(
    `insert into public.client_services (id, client_id, service_template_id, assignee_id, reviewer_id)
     values ($1, $2, $3, $4, $5)`,
    [CLIENT_SERVICE_QUARTERLY.id, CLIENTS.alpha.id, SERVICE_TEMPLATE_QUARTERLY.id, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
  );
  await client.query(
    `insert into public.service_templates (id, title, category, recurrence, filing_deadline_day, internal_offset_days)
     values ($1, $2, 'Tax & Compliance', 'yearly', 10, 7)`,
    [SERVICE_TEMPLATE_YEARLY.id, SERVICE_TEMPLATE_YEARLY.title]
  );
  await client.query(
    `insert into public.client_services (id, client_id, service_template_id, assignee_id, reviewer_id)
     values ($1, $2, $3, $4, $5)`,
    [CLIENT_SERVICE_YEARLY.id, CLIENTS.alpha.id, SERVICE_TEMPLATE_YEARLY.id, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
  );

  // ---- work_items: client scope (normal + ready_for_review), + firm scope ----
  await client.query(
    `insert into public.work_items (id, client_id, title, assignee_id, reviewer_id, status, work_scope, created_by)
     values ($1, $2, $3, $4, $5, 'in_progress', 'client', $4)`,
    [WORK_ITEMS.normal.id, CLIENTS.alpha.id, WORK_ITEMS.normal.title, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
  );
  await client.query(
    `insert into public.work_items (id, client_id, title, assignee_id, reviewer_id, status, work_scope, created_by)
     values ($1, $2, $3, $4, $5, 'ready_for_review', 'client', $4)`,
    [WORK_ITEMS.readyForReview.id, CLIENTS.alpha.id, WORK_ITEMS.readyForReview.title, IDENTITIES.employeeA.id, IDENTITIES.reviewerA.id]
  );
  await client.query(
    `insert into public.work_items (id, client_id, title, assignee_id, reviewer_id, status, work_scope, created_by)
     values ($1, $2, $3, $4, $5, 'in_progress', 'client', $4)`,
    [WORK_ITEMS.other.id, CLIENTS.beta.id, WORK_ITEMS.other.title, IDENTITIES.employeeB.id, IDENTITIES.reviewerB.id]
  );
  await client.query(
    `insert into public.work_items (id, title, assignee_id, status, work_scope, firm_category, created_by)
     values ($1, $2, $3, 'to_do', 'firm', 'Administration', $3)`,
    [WORK_ITEMS.firm.id, WORK_ITEMS.firm.title, IDENTITIES.employeeA.id]
  );

  // ---- children of `normal`: checklist, comment, activity, waiting item ----
  await client.query(
    `insert into public.work_checklist_items (work_item_id, stage, title, sort_order) values ($1, 'preparation', 'Collect purchase register', 0)`,
    [WORK_ITEMS.normal.id]
  );
  await client.query(
    `insert into public.work_comments (work_item_id, author_id, body) values ($1, $2, 'Waiting on the client for last month''s bank statement.')`,
    [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
  );
  await client.query(
    `insert into public.work_activity (work_item_id, actor_id, action, detail) values ($1, $2, 'created', 'Seeded by test harness')`,
    [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
  );
  await client.query(
    `insert into public.work_waiting_items (work_item_id, title, requested_by) values ($1, 'Bank statement - Shrawan', $2)`,
    [WORK_ITEMS.normal.id, IDENTITIES.employeeA.id]
  );

  // ---- Vault secret (Handbook Task 10) — the local stub's stand-in for
  // the real, admin-configured, never-committed Supabase Vault secret.
  // Seeded here so the "secret IS configured" test scenarios have a
  // realistic starting point; a dedicated matrix test separately proves
  // the fail-closed behavior when this row doesn't exist (see
  // client_credentials.matrix.js).
  await client.query(`select vault.create_secret($1, 'client_credentials_passphrase', 'Local test harness only.')`, [TEST_VAULT_PASSPHRASE]);

  // ---- client_credentials (created_by admin) ----
  await client.query(
    `insert into public.client_credentials (client_id, label, username, password_encrypted, created_by)
     values ($1, 'IRD portal', 'alpha_trading', extensions.pgp_sym_encrypt('S3edPassword!', $2), $3)`,
    [CLIENTS.alpha.id, TEST_VAULT_PASSPHRASE, IDENTITIES.admin.id]
  );

  // ---- notifications (employeeA's own) ----
  await client.query(
    `insert into public.notifications (user_id, kind, title, work_item_id, dedup_key)
     values ($1, 'due_today_summary', 'You have 1 item due today', $2, 'seed-due-today')`,
    [IDENTITIES.employeeA.id, WORK_ITEMS.normal.id]
  );

  // ---- personal_todos (employeeA's own) ----
  await client.query(`insert into public.personal_todos (user_id, text) values ($1, 'Call the printer about new letterheads')`, [IDENTITIES.employeeA.id]);

  // ---- one notification + one todo owned by the INACTIVE identity ----
  // Neither table's RLS was touched by the is_active hardening pass
  // (pure ownership check, auth.uid() = user_id) -- these rows exist
  // specifically to test whether that gap is real: does a deactivated
  // user's own still-valid session keep reading their own rows here?
  await client.query(
    `insert into public.notifications (user_id, kind, title, dedup_key) values ($1, 'overdue_item', 'Old reminder', 'seed-inactive-notif')`,
    [IDENTITIES.inactive.id]
  );
  await client.query(`insert into public.personal_todos (user_id, text) values ($1, 'Old personal reminder')`, [IDENTITIES.inactive.id]);
}

module.exports = { seed };
