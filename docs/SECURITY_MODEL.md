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
function (see the same doc plus `supabase/verify_live_schema.sql`),
CSP/header-level security (see `dist/_headers`, not yet documented in a
dedicated file), and secret-handling practices beyond the
`client_credentials` passphrase note already captured in
DATABASE_SOURCE_OF_TRUTH.md. Extend this skeleton as those areas get
their own dedicated task rather than letting it go stale by omission.
