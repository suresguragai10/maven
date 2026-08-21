# Staff Onboarding / Offboarding (Task 32)

**Current, authoritative.** Covers the one step Work Desk deliberately does
NOT do in-browser (creating a new Supabase Auth login), and the full
onboarding/offboarding flow around it. See also
[SECURITY_MODEL.md](SECURITY_MODEL.md) (offboarding's DB-level guarantees),
[ROLE_CAPABILITIES.md](ROLE_CAPABILITIES.md) (what each role can do), and
`staff/staff.js`'s Staff & Access page (`renderStaff()`), which links back
to this document's own workflow in its own on-page copy.

## Why account creation happens in the Supabase Dashboard, not in Work Desk

Creating a new sign-in (`auth.users` row) requires either the target
person setting their own password via a Supabase invite/magic-link flow,
or an admin action authenticated with a **service-role key** — a
credential with unrestricted database access that bypasses RLS entirely.
Putting that key in a browser-side admin panel would mean anyone who
could reach the panel (or intercept its network traffic, or find the key
in browser dev tools/local storage) effectively has superuser access to
every table in the project, RLS included. That is explicitly out of
scope for this app — see this task's own "do not build browser-side Auth
administration requiring a service-role key" instruction, and
`docs/ADMIN_SECURITY.md`'s parallel reasoning for why the separate
Website Content Admin panel doesn't do privileged operations in-browser
either.

Everything Work Desk's own Staff & Access page does — role, active
status, designation, contact fields, photo — uses the `anon`/`authenticated`
key plus RLS, the same key already sitting in `staff/supabase.js`, safe to
ship to a browser because RLS is the real boundary regardless of who holds
it.

## Onboarding a new team member — the actual steps

1. **Supabase Dashboard → Authentication → Users → Add User.** Set their
   email; either send an invite (they set their own password) or set a
   temporary password directly, whichever your Supabase project is
   configured for. This step needs Supabase Dashboard access — nothing in
   Work Desk can do it, by design (see above).
2. **A `profiles` row is created automatically** the moment that
   `auth.users` row exists — `handle_new_user()` (see
   `supabase/migrations/20260811090100_profiles.sql`) inserts it with
   `role = 'employee'` (the least-privileged role) and `is_active = true`.
   No manual step is needed for this part.
3. **Give them Work Desk's URL and their login.** They can sign in
   immediately as an active Employee.
4. **On Staff & Access** (`/staff/` → Admin → Staff & Access), an admin:
   - Sets their **Designation**, **Work email**, **Phone**, **Join date**
     via Edit — these are separate from their Auth email. Phone and photo
     stay editable by the person themselves afterward on My Profile
     (Task 31); everything else on this list stays admin-managed.
   - Promotes them to **Reviewer** or **Admin** if the role warrants it —
     `employee` is the safe default a new account always starts at; this
     is always a deliberate, separate step, never automatic.

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

## What Work Desk explicitly does NOT do (and won't)

- No service-role key anywhere in the browser bundle, ever.
- No create/delete/password-reset for `auth.users` from within Work Desk.
- No bulk/CSV staff import.
- No SSO/directory-sync integration.

If a future task ever proposes any of the above, it needs a fresh,
explicit product decision — not an incremental addition to Staff & Access.
