# Security Model (Maven Work Desk)

**Current, authoritative — skeleton.** High-level shape of how
authorization actually works in this app. Deliberately not exhaustive
(later tasks, notably the credential-hardening and RLS-fix tasks in the
implementation sequence, should enrich this as they land) — its job
right now is to state the load-bearing principles once, so they don't
have to be re-derived from migration comments every session.

For exact, current, evidence-backed detail, this document defers to two
living artifacts rather than duplicating them:
- [DATABASE_SOURCE_OF_TRUTH.md](DATABASE_SOURCE_OF_TRUTH.md) — expected
  schema, RLS, and grants, with live-vs-repo drift classified.
- [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) — actual, reproducible
  test results for what each role can and can't do, regenerable on demand
  (`npm run test:db`).

## The core principle: RLS is the real boundary

Every table has Row Level Security enabled. Frontend checks (hiding a
button, disabling a form field) are a UX convenience only — **a hidden
button is never authorization.** Every sensitive rule must also be
enforced at the database layer, either by an RLS policy or by a trigger.
This has been the practice throughout this project (e.g. the V2
Permission Audit closed a gap where a real capability existed at the
database layer with no corresponding UI exposure at all — the reverse
direction of the mistake this principle guards against).

## The two central gate functions

Almost every policy and privileged function ultimately calls one of
these two `SECURITY DEFINER` functions:

- **`current_user_role()`** — returns the caller's role
  (`employee`/`reviewer`/`admin`), or `NULL` if the caller has no
  matching profile row, or that profile is `is_active = false`.
- **`current_user_active()`** — returns whether the caller has an
  active profile at all (boolean), used by the broad "any active
  teammate" read/write policies that don't care about specific role.

Both close off a deactivated account's access **the moment their
profile is flagged inactive**, at the database layer — independent of
whether their Supabase Auth session has actually expired yet. See
"Offboarding procedure" below for exactly what that does and doesn't
mean in practice.

## Offboarding procedure (Handbook Task 9)

**"Inactive" means no application access, not merely hidden from the
Staff screen.** As of Task 9, every table and function that touches
Maven business data checks `current_user_role()`/`current_user_active()`
— both of which query `profiles.is_active` fresh, on every single
request. Confirmed by table/function, with live evidence, in
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md):

| Area | Gated by |
|---|---|
| Client Work + its checklist/comments/activity/waiting-items | `work_items_read`/`update` + child-table policies (`current_user_active()`) |
| Firm Work | same policies, plus an explicit re-check inside `guard_work_item_update()`'s Firm Work branch |
| `clients`, `client_services` | `current_user_active()` (read), `current_user_role() = 'admin'` (write) |
| `service_templates`, `app_settings` | `current_user_active()` (read) |
| `notifications`, `personal_todos` | ownership **and** `current_user_active()` (Task 9 — previously ownership only, see below) |
| `client_attention`, `client_credentials`, recurring generation RPCs | `coalesce(current_user_role(), '') in (...)` (Task 9 root-cause fix, see above) |

### The one precise claim this document will make about tokens

**Deactivating a profile does not revoke, expire, or invalidate their
existing Supabase Auth JWT.** A browser tab where that person is still
logged in keeps a technically-valid, correctly-signed access token for
as long as Supabase would normally honor it (until its natural
expiry/refresh cycle). What changes is that **every business-data
request that token is used for is independently re-authorized against
the live `profiles.is_active` value at the moment of the request** — so
in practice, the very next Client Work read, Firm Work edit,
notification fetch, or credential reveal attempt fails, immediately,
without needing the token itself to stop working. This is proven, not
assumed: [PERMISSION_BASELINE.md](PERMISSION_BASELINE.md)'s `inactive`
identity tests simulate exactly this scenario (a real authenticated
session, `is_active = false`) against every area in the table above,
and all currently pass.

What this does **not** cover, and where a real gap could still exist if
this app's architecture changes: anything that doesn't route through
`current_user_role()`/`current_user_active()` per request — e.g. a
future feature using Supabase Realtime subscriptions (not used anywhere
in this app today), or a future Edge Function / service-role integration
that bypasses RLS entirely. Nothing like that exists today, but the
guarantee above is specific to "every current request path checks
`is_active` live," not to "the token itself becomes unusable."

### Recommended operational steps, in order

1. **Deactivate the profile** — Staff page → toggle the person to
   inactive (`profiles.is_active = false`). This alone is sufficient to
   block all application business-data access, per the table above, and
   is the only step that needs to happen inside the Maven app itself.
2. **Optional, extra hygiene**: in the Supabase Dashboard →
   Authentication → Users, find the person and revoke/sign out their
   active sessions (or temporarily ban the account if immediate,
   full re-authentication-blocking is wanted). This forces a fresh login
   attempt the next time they try — which will succeed at the Auth
   layer (their credentials still work) but land them on a
   deactivated-account experience in the app, same as before. Not
   required for business-data protection given step 1 alone already
   provides it, but closes the token down entirely rather than leaving
   it "authenticated but useless."
3. **Do not delete the Supabase Auth user** for anyone with any real
   Maven history. `profiles.id` references `auth.users(id) ON DELETE
   CASCADE` — deleting the auth user deletes their `profiles` row too.
   Every table that references `profiles(id)` from actual business data
   (`work_items.assignee_id`/`reviewer_id`/`created_by`/`submitted_by`,
   `work_comments.author_id`, `work_activity.actor_id`,
   `work_waiting_items.requested_by`, `client_services.assignee_id`/
   `reviewer_id`, `client_credentials.created_by`,
   `clients.attention_set_by`, `service_templates.default_assignee_id`/
   `default_reviewer_id`) does **not** have `ON DELETE CASCADE` —
   verified directly against every migration, not assumed — so Postgres
   will simply refuse the deletion with a foreign key violation for
   anyone who has ever been assigned, reviewed, commented, or logged
   activity on so much as one work item. This is a safe failure mode
   (it protects historical data by refusing), but don't work around it
   (e.g. by manually clearing references first) — that would be exactly
   the historical-data loss this task's "do not accidentally delete
   historical records" instruction exists to prevent. `personal_todos`
   and `notifications` **do** cascade-delete on profile deletion —
   acceptable, since neither has compliance/historical significance.
4. **Reassignment is a separate, deliberate action, never silent.**
   Flipping `is_active` by itself never touches
   `work_items.assignee_id`/`reviewer_id`. `staff.js`'s
   `confirmDeactivateStaff()` checks for open (non-`completed`) work
   assigned to the person first: if there is none, it deactivates
   directly, nothing to reassign. If there IS open work, it requires an
   explicit "Reassign & Deactivate" action naming a specific new
   assignee — there is no "skip reassignment" option in that path, by
   design, since leaving compliance work assigned to someone who can no
   longer access or act on it would be worse than requiring the choice
   up front. Either way, reassignment (when it happens) is always a
   deliberate, visible, human-picked action — never a side effect
   silently triggered by the deactivation itself.

## Fixed bug class: the NULL-unsafe `NOT IN` check

A pattern that existed across six `SECURITY DEFINER` functions
(`add_client_credential`, `list_client_credentials`,
`reveal_client_credential`, `delete_client_credential`,
`generate_period_work_for_period`, `set_client_attention`), fixed by
Handbook Task 9:

```sql
-- before (vulnerable):
if public.current_user_role() not in ('admin', 'reviewer') then
  raise exception 'Not authorized.';
end if;

-- after (Task 9, 20260821090000_offboarding_revokes_business_access.sql):
if coalesce(public.current_user_role(), '') not in ('admin', 'reviewer') then
  raise exception 'Not authorized.';
end if;
```

`current_user_role()` returns `NULL` for a caller with no active
profile (an anonymous caller, or a deactivated one with a still-valid
session). `NULL NOT IN (...)` evaluates to `NULL`, and PL/pgSQL treats a
`NULL` `IF` condition as `FALSE` — the exception never fired, and the
function ran anyway. This was **not** a property of RLS policies
generally (a `NULL` `USING`/`WITH CHECK` expression correctly excludes a
row — RLS is fail-closed on `NULL`); it was specific to this *inverted*
`IF NOT (...) THEN RAISE` idiom used inside plain functions. Trigger
functions in this schema (`guard_work_item_update()`,
`guard_profile_update()`) use a *positive*-listing pattern instead
(`if role = 'admin' then ... elsif role = 'reviewer' and ... then ...
else <restrictive>`), which was always safe under the same `NULL` case
and needed no change.

`coalesce(current_user_role(), '')` turns a `NULL` role into the empty
string before the `NOT IN` check runs — `'' NOT IN ('admin', 'reviewer')`
is unambiguously `TRUE`, so the exception now fires correctly for both
an anonymous caller and a deactivated one. Task 9's migration also
committed the anon-`EXECUTE`-grant revoke for the five functions that
never had one (only `set_client_attention` already had it, from its own
original migration) — closing both the grant-level anonymous path and
the underlying logic bug in the same change. Empirically confirmed via
the Task 3 harness against a real `is_active = false` identity with a
simulated still-valid session: see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) — as of Task 9, zero
outstanding findings across all 128 checks.

## `client_credentials`: deny-by-default, not policy-based

Unlike every other table, `client_credentials` has **zero RLS
policies** — not a permissive one, none at all. With RLS enabled and no
policy, every direct table operation is denied for every role,
including admin. The only way in is four `SECURITY DEFINER` functions
(`add_client_credential`, `list_client_credentials`,
`reveal_client_credential`, `delete_client_credential`), each doing its
own admin/reviewer check internally. This is deliberate defense in
depth (documented in the migration itself: "even a leaked anon key
can't read this table directly, only through a function that decrypts
exactly what it's asked for") — and exactly why the NULL-bypass bug
above is especially serious for this table specifically: those four
functions are its *entire* protection, with nothing else backing them
up.

The two functions that touch plaintext, `add_client_credential` and
`reveal_client_credential`, encrypt/decrypt `password_encrypted` with
`pgp_sym_encrypt`/`pgp_sym_decrypt` using a symmetric passphrase. As of
Handbook Task 10, that passphrase is never a literal in migration SQL —
see "Secret setup, rotation, and recovery" below for where it actually
lives and how it's configured.

## Secret setup, rotation, and recovery (Handbook Task 10)

**What changed, and why.** The original `client_credentials` migration
encrypted/decrypted with a literal placeholder string,
`'REPLACE_WITH_SECRET_PASSPHRASE'`, committed directly in Git, with a
comment instructing whoever ran it to replace that value with a real
passphrase before use — but the replacement itself, being a real secret,
could never itself be committed back. Nothing enforced that the
replacement had actually happened, and every later migration that had
any other reason to touch these two functions had to reproduce their
full body, silently re-committing the same placeholder each time. A
fresh environment built from this repo alone — exactly the scenario this
task's acceptance criterion is about — would have silently "encrypted"
every client credential with a string sitting in public Git history.

As of `20260822090000_credential_vault_hardening.sql`,
`add_client_credential` and `reveal_client_credential` look the
passphrase up at call time from **Supabase Vault**
(`vault.decrypted_secrets`, backed by the `supabase_vault` Postgres
extension — confirmed already installed on this project, not something
this task adds) under the fixed secret name
`client_credentials_passphrase`. Both functions now **fail closed**: if
that secret is missing or empty, they `RAISE EXCEPTION` with a specific
message identifying exactly what's missing, for every caller including
admin — nobody can store or reveal a credential until an admin
completes the one-time setup below. This is Supabase's own supported
secret-storage mechanism, not a custom scheme, and requires no new paid
service.

### One-time setup (required before any credential can be stored or revealed)

1. **Generate a strong, random passphrase** — at least 32 characters,
   from a real password manager's generator or `openssl rand -base64 32`
   run locally, never typed from memory or reused from anything else.
   Do not save it into any file in this repository, any chat log, or any
   ticket/issue tracker.
2. **Store it in a durable, independent secret manager the firm already
   trusts** (e.g. the same password manager used for other Maven admin
   credentials) — this is the *only* durable copy of the raw value
   outside Vault itself. See "Recovery" below for why this step is not
   optional.
3. **Run this once, in the Supabase SQL editor, as an admin/owner of the
   project** (never commit this command with the real value filled in —
   paste it directly into the SQL editor and run it there):

   ```sql
   select vault.create_secret(
     '<paste the generated passphrase here>',
     'client_credentials_passphrase',
     'Symmetric passphrase for encrypting/decrypting client portal credentials (client_credentials.password_encrypted).'
   );
   ```

4. Confirm setup worked by having an admin/reviewer store one real
   credential via the Work Desk UI and reveal it back successfully. If
   either fails with "Client credential encryption is not configured...",
   the secret name was not entered exactly as
   `client_credentials_passphrase`, or step 3 was not actually run
   against this project.

### Rotation

Rotating means replacing the stored secret's value — there is no
built-in "re-encrypt everything" step, so rotation has a real
consequence: **every credential already encrypted under the old
passphrase becomes permanently undecryptable the moment the secret
changes.** `reveal_client_credential` will raise `Credential not
found.`-adjacent decrypt failures for those rows, not a helpful
migration path — pgcrypto has no way to decrypt with the old value once
it's gone.

To rotate safely:
1. Before changing anything, use the existing Work Desk UI to reveal and
   record (in the same trusted secret manager, not in this repo or in
   plaintext) every currently-stored client credential's value.
2. Update the secret in Supabase Vault (`select
   vault.update_secret(...)` targeting the existing secret's id, or
   delete and recreate via `vault.create_secret(...)` with a new
   passphrase — either way, do this directly in the SQL editor, never
   committed).
3. Re-enter every credential from step 1 through `add_client_credential`
   (the Work Desk "Add credential" flow) so it's re-encrypted under the
   new passphrase.
4. Only rotate when there's a real reason to (suspected exposure,
   routine security hygiene on a defined schedule) — rotation is
   disruptive by design, not a casual maintenance action.

### Recovery

Supabase Vault has no "forgot the passphrase" mechanism — its whole
purpose is that the raw value isn't recoverable from the database by
anyone without the encryption key Supabase itself manages, and even
then, this app never needs to read the passphrase from anywhere except
`vault.decrypted_secrets` at call time. Two distinct failure modes:

- **The Vault secret itself is intact, but nobody remembers the raw
  value.** Not a problem in practice — `add_client_credential`/
  `reveal_client_credential` never need a human to type the passphrase
  in; they read it from Vault automatically. This only matters if you
  need to rotate (see above), which is why step 2 of setup — keeping an
  independent backup in a trusted secret manager — matters: it's the
  only way to *change* the passphrase deliberately without losing access
  to already-encrypted rows in the process it requires (re-entering
  them).
- **Vault itself is ever wiped or corrupted, and no independent backup of
  the passphrase exists.** Every already-encrypted `client_credentials`
  row becomes permanently unreadable — there is no recovery path, by
  design (this is the same property that makes the encryption
  meaningful in the first place). This is precisely why step 2 of setup
  is not optional: the independent backup is the only thing that makes
  this scenario recoverable at all, by allowing every credential to be
  manually re-entered.

No real secret value is, or should ever be, written into this file, any
other file in this repository, or any migration.

## `work_activity`: trustworthy by construction, not by convention

Every material `work_items` state transition (status change, sent for
review/changes requested/approved/completion — all just specific status
values, logged generically — due-date change, assignment/reassignment,
submission tracking) is logged by `guard_work_item_update()` itself, a
`BEFORE UPDATE` trigger, as of Handbook Task 7. This means the audit
trail exists because the transition happened at the database — via the
Staff app, a direct API call, anything — not because the browser
remembered to make a second, separate, unawaited insert after the
update succeeded (which is exactly what happened before this task: a
fire-and-forget client-side `logActivity()` call, easy to silently lose
on a closed tab or dropped connection, and easy to spoof — its `actor_id`
came straight from client-supplied data with nothing checking it against
`auth.uid()`).

`work_activity` now has a `source` column (`'system'` | `'client'`) and
a tightened `work_activity_insert` policy: a direct client insert is
only permitted for three specific, non-material action types
(`checklist_toggled`, `waiting_item_toggled`, `follow_up_recorded` —
none of them work_items-level events), and only with `source = 'client'`
and `actor_id = auth.uid()` enforced by the policy itself. Every other
action value, or any attempt to claim `source = 'system'`, is rejected
outright — a user cannot fabricate a row that looks like a system event.
Combined with the pre-existing lack of any `UPDATE`/`DELETE` policy,
`work_activity` rows are now immutable AND their system-sourced entries
are unforgeable, closing the actor-spoofing gap Task 3 found. `created_by`
(on `work_items`) is similarly forced from `auth.uid()` at creation time
by a new `BEFORE INSERT` trigger, not trusted from client input.

## What this document does not yet cover

Exhaustive per-table RLS policy text (see
DATABASE_SOURCE_OF_TRUTH.md §2–3), the full grant inventory for every
function (see the same doc plus `supabase/verify_live_schema.sql`), and
CSP/header-level security (see `dist/_headers`, not yet documented in a
dedicated file). Extend this skeleton as those areas get their own
dedicated task rather than letting it go stale by omission.
