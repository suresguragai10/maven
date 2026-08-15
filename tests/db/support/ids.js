// Deterministic, fixed UUIDs for every seeded row this harness creates.
// Fixed (not randomly generated per run) so failures are reproducible and
// matrix files can reference a specific row by name without re-querying
// for it first.

const IDENTITIES = {
  // is_active = false; everything else here is a normal active profile.
  inactive: { id: '11111111-1111-1111-1111-111111111111', fullName: 'Inactive Former Staff', role: 'employee', isActive: false },
  employeeA: { id: '22222222-2222-2222-2222-222222222222', fullName: 'Employee A', role: 'employee', isActive: true },
  employeeB: { id: '33333333-3333-3333-3333-333333333333', fullName: 'Employee B', role: 'employee', isActive: true },
  reviewerA: { id: '44444444-4444-4444-4444-444444444444', fullName: 'Reviewer A', role: 'reviewer', isActive: true },
  reviewerB: { id: '55555555-5555-5555-5555-555555555555', fullName: 'Reviewer B', role: 'reviewer', isActive: true },
  admin: { id: '66666666-6666-6666-6666-666666666666', fullName: 'Admin', role: 'admin', isActive: true },
};

// Not a real profile row -- represents a caller with no session at all
// (no Authorization header / the bare anon key), used by asRole() to
// test genuinely anonymous access.
const ANON = { key: 'anon' };

const CLIENTS = {
  alpha: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Alpha Trading Pvt. Ltd.' },
  beta: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Beta Traders Pvt. Ltd.' },
};

const SERVICE_TEMPLATE = { id: 'cccccccc-0000-0000-0000-000000000001', title: 'Monthly VAT Return' };

const CLIENT_SERVICE = { id: 'cccccccc-0000-0000-0000-000000000002' };

// Handbook Task 11: a quarterly and a yearly service template + active
// client_service, alongside the existing monthly SERVICE_TEMPLATE/
// CLIENT_SERVICE above, so period_normalization.matrix.js can exercise
// _generate_period_work_core for all three recurrence types against
// real, deterministic filing_deadline_day/internal_offset_days values,
// not just the monthly one every other matrix file already relies on.
const SERVICE_TEMPLATE_QUARTERLY = { id: 'cccccccc-0000-0000-0000-000000000003', title: 'Quarterly TDS Return' };
const CLIENT_SERVICE_QUARTERLY = { id: 'cccccccc-0000-0000-0000-000000000004' };
const SERVICE_TEMPLATE_YEARLY = { id: 'cccccccc-0000-0000-0000-000000000005', title: 'Annual Tax Return' };
const CLIENT_SERVICE_YEARLY = { id: 'cccccccc-0000-0000-0000-000000000006' };

// Handbook Task 12: a monthly template explicitly flagged requires_
// external_deadline = true but with NO deadline_rules row seeded for it
// -- the deliberate "governance not set up yet" fixture, so
// deadline_governance.matrix.js can prove generation leaves external_
// due_date unset (never guesses) until an admin adds a rule live.
const SERVICE_TEMPLATE_UNGOVERNED = { id: 'cccccccc-0000-0000-0000-000000000007', title: 'Ungoverned Monthly Filing' };
const CLIENT_SERVICE_UNGOVERNED = { id: 'cccccccc-0000-0000-0000-000000000008' };

const WORK_ITEMS = {
  // Client scope, employeeA/reviewerA's own item, ordinary in-progress status.
  normal: { id: 'dddddddd-0000-0000-0000-000000000001', clientId: CLIENTS.alpha.id, title: 'Alpha VAT Return - Shrawan' },
  // Client scope, employeeA/reviewerA's item, in the narrow-visibility status
  // (only assignee/reviewer/admin should be able to see this one).
  readyForReview: { id: 'dddddddd-0000-0000-0000-000000000002', clientId: CLIENTS.alpha.id, title: 'Alpha Tax Return - Ready' },
  // Client scope, employeeB/reviewerB's item -- used to prove employeeA
  // canNOT see/touch a colleague's ordinary client work.
  other: { id: 'dddddddd-0000-0000-0000-000000000003', clientId: CLIENTS.beta.id, title: 'Beta Bookkeeping - Monthly' },
  // Firm scope -- work_scope='firm', client_id NULL, visible to every
  // active teammate regardless of assignment.
  firm: { id: 'dddddddd-0000-0000-0000-000000000004', title: 'Renew office internet contract' },
};

// Local-harness-only stand-in for the real Vault-stored passphrase
// (Handbook Task 10). Never used anywhere near production -- the real
// secret is generated and stored by an admin directly in Supabase Vault,
// never in a file. This constant only exists so seed.js and the test
// matrices agree on one value for the throwaway, always-destroyed local
// database's own vault-stub secret.
const TEST_VAULT_PASSPHRASE = 'local-test-harness-passphrase-never-used-in-production';

module.exports = {
  IDENTITIES, ANON, CLIENTS, SERVICE_TEMPLATE, CLIENT_SERVICE, WORK_ITEMS, TEST_VAULT_PASSPHRASE,
  SERVICE_TEMPLATE_QUARTERLY, CLIENT_SERVICE_QUARTERLY, SERVICE_TEMPLATE_YEARLY, CLIENT_SERVICE_YEARLY,
  SERVICE_TEMPLATE_UNGOVERNED, CLIENT_SERVICE_UNGOVERNED,
};
