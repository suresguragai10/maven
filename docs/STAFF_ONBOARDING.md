# Staff Onboarding / Offboarding (Task 32, updated 2026-08-21)

**Current, authoritative.** Covers how a new Supabase Auth login gets
created for a new team member, and the full onboarding/offboarding flow
around it. See also [SECURITY_MODEL.md](SECURITY_MODEL.md) (offboarding's
DB-level guarantees), [ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md) (what
each role can do), and `staff/staff.js`'s Staff & Access page
(`renderStaff()`), which links back to this document's own workflow in its
own on-page copy.

**Revision note**: this originally said Work Desk would never create
`auth.users` accounts, full stop — that was correct at the time, and the
reasoning below (why a service-role key can never sit in the browser)
still holds completely. What changed, per an explicit, deliberate owner
decision (not an incremental drift): Work Desk now offers a **Create New
Staff** button that creates the account through a small server-side
component instead of a browser-held key. The Supabase Dashboard path
still exists and still works as a fallback.

## Why account creation still can't hold a service-role key in the browser

Creating a new sign-in (`auth.users` row) requires either the target
person setting their own password via a Supabase invite/magic-link flow,
or an admin action authenticated with a **service-role key** — a
credential with unrestricted database access that bypasses RLS entirely.
Putting that key in a browser-side admin panel would mean anyone who
could reach the panel (or intercept its network traffic, or find the key
in browser dev tools/local storage) effectively has superuser access to
every table in the project, RLS included. That's still true today, and
`docs/ADMIN_SECURITY.md`'s parallel reasoning for why the separate Website
Content Admin panel doesn't do privileged operations in-browser either is
unchanged.

**What changed**: a service-role key can safely exist *server-side*,
outside the browser bundle entirely. Work Desk's **Create New Staff**
button (Staff & Access page) calls a Supabase Edge Function,
`create-staff-account` (`supabase/functions/create-staff-account/index.ts`)
— a small piece of code that runs on Supabase's servers, holds the
service-role key only as a platform-injected environment variable never
sent to any browser, does its own admin+active check on the caller before
doing anything (defense in depth, same pattern as every DB-level check in
this app), and sends the new person a real Supabase sign-in invite email.
They click it and set their own password — Work Desk never generates,
sees, or stores a password for them. This function has to be deployed
once via the Supabase Dashboard (not something this repo can do on push);
until it is, Create New Staff shows a clear error rather than pretending
to work, and the Dashboard path below still works exactly as before.

Everything else Work Desk's own Staff & Access page does — role, active
status, designation, contact fields, photo — uses the
`anon`/`authenticated` key plus RLS, the same key already sitting in
`staff/supabase.js`, safe to ship to a browser because RLS is the real
boundary regardless of who holds it.

## Onboarding a new team member — the actual steps

1. **Create their login.** Two ways, same result:
   - **Work Desk → Admin → Staff & Access → Create New Staff.** Enter
     their work email, full name, designation, and role; sends a real
     sign-in invite email immediately. Requires the `create-staff-account`
     Edge Function to have been deployed once (see above) — if it hasn't,
     this shows an error rather than silently failing.
   - **Fallback: Supabase Dashboard → Authentication → Users → Add User.**
     Still works exactly as before, no dependency on the Edge Function.
     Needs Supabase Dashboard access.
2. **A `profiles` row is created automatically** the moment that
   `auth.users` row exists — `handle_new_user()` (see
   `supabase/migrations/20260811090100_profiles.sql`) inserts it with
   `role = 'employee'` (the least-privileged role) and `is_active = true`
   by default; Create New Staff additionally sets the designation/role the
   admin actually chose right after, via the same Edge Function. No manual
   step is needed for the Dashboard path's profile row.
3. **Give them Work Desk's URL and their login.** Via Create New Staff,
   they get this from the invite email itself, no separate step needed.
   Via the Dashboard path, tell them directly.
4. **On Staff & Access** (`/staff/` → Admin → Staff & Access), an admin:
   - Sets their **Designation**, **Work email**, **Phone**, **Join date**
     via Edit — these are separate from their Auth email. Phone and photo
     stay editable by the person themselves afterward on My Profile
     (Task 31); everything else on this list stays admin-managed. (Create
     New Staff already sets designation/role at creation time — this step
     is for anything that needs adjusting afterward, or for accounts
     created via the Dashboard fallback.)
   - Promotes them to **Reviewer** or **Admin** if the role warrants it —
     `employee` is the safe default a new account always starts at; this
     is always a deliberate, separate step, never automatic, unless
     already chosen at Create New Staff time.

## Offboarding — what actually happens, and in what order

1. **Reassign anything that would otherwise be silently stranded, first.**
   Deactivating someone via Staff & Access already does this for you: if
   they have open (non-completed) Client or Firm Work assigned to them,
   the deactivation flow (`confirmDeactivateStaff()`) blocks the direct
   toggle and instead opens a "Reassign Before Deactivating" modal listing
   every open item and requiring a new assignee before it will proceed —
   see [WORK_DESK_BASELINE_SECURITY_MAP.md](WORK_DESK_BASELINE_SECURITY_MAP.md)
   for the original audit that established this rule (Task 9's offboarding
   work).
2. **Task 32 extends the same principle to role changes**: demoting
   someone from Reviewer/Admin down to Employee while they're still the
   assigned `reviewer_id` on open Client Work items would silently strand
   review responsibility the same way — `guard_work_item_update()`
   requires the CURRENT role to be `reviewer` (not just a matching
   `reviewer_id`) for reviewer-specific actions, so the moment the role
   changes, they lose the ability to act on those items even though
   nothing about the items themselves changed. The role dropdown on Staff
   & Access now checks for this and offers to reassign the reviewer
   first — see `confirmRoleChange()`.
3. **Deactivate them** (`is_active = false`). The instant this is set,
   `current_user_active()` returns false for every check across the
   whole schema — they lose access to all business data DB-wide, not just
   the ability to log into Work Desk. This is proven, not assumed: see
   SECURITY_MODEL.md's offboarding evidence table.
4. **Their Supabase Auth account itself is left alone** — deactivation is
   entirely a `profiles.is_active` flag, not an Auth-level suspension or
   deletion. If you also want to prevent them from ever signing in again
   at the Auth layer (not just being denied all data once signed in),
   that's a separate, deliberate step in the Supabase Dashboard
   (Authentication → Users → disable or delete the account) — Work Desk
   does not do this automatically, so a deactivated `profiles` row and a
   live Auth account can coexist by design (their session would just show
   an empty, data-less app).

## What Work Desk explicitly does NOT do (and won't, without a fresh decision)

- **No service-role key anywhere in the browser bundle, ever** — this one
  is absolute and unaffected by the change above; the key exists only as
  a server-side Edge Function environment variable.
- No **delete** or **password-reset** for `auth.users` from within Work
  Desk — Create New Staff only ever creates; removing someone's ability to
  sign in at all, or forcing a password reset, still needs the Supabase
  Dashboard (Authentication → Users).
- No bulk/CSV staff import.
- No SSO/directory-sync integration.

If a future task ever proposes any of the above, it needs a fresh,
explicit product decision — not an incremental addition to Staff & Access.
The service-role-key boundary above is the one item on this list that
should never move without an extremely deliberate, well-understood
reason — everything else is a scope question, that one is a security
invariant.
