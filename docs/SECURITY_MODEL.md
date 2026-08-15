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
whether their Supabase Auth session has actually expired yet (it hasn't,
necessarily; see "known residual gap" below).

## Known bug class: the NULL-unsafe `NOT IN` check

A recurring, already-identified pattern in this codebase: some
`SECURITY DEFINER` functions authorize with

```sql
if public.current_user_role() not in ('admin', 'reviewer') then
  raise exception 'Not authorized.';
end if;
```

`current_user_role()` returns `NULL` for a caller with no active
profile (an anonymous caller, or a deactivated one with a still-valid
session). `NULL NOT IN (...)` evaluates to `NULL`, and PL/pgSQL treats a
`NULL` `IF` condition as `FALSE` — the exception never fires, and the
function runs anyway. This is **not** a property of RLS policies
generally (a `NULL` `USING`/`WITH CHECK` expression correctly excludes a
row — RLS is fail-closed on `NULL`); it's specific to this *inverted*
`IF NOT (...) THEN RAISE` idiom used inside plain functions.
Trigger functions in this schema (`guard_work_item_update()`,
`guard_profile_update()`) use a *positive*-listing pattern instead
(`if role = 'admin' then ... elsif role = 'reviewer' and ... then ...
else <restrictive>`), which is safe under the same NULL case.

Affected functions, current status, and the empirical proof of exactly
how far each one is currently reachable: see
[PERMISSION_BASELINE.md](PERMISSION_BASELINE.md) ("client_attention",
"client_credentials", "recurring generation functions",
"SECURITY DEFINER function grants"). Root-cause fix (a NULL-safe
rewrite, e.g. `coalesce(current_user_role(), '') not in (...)`) is
scoped to a dedicated credential/secret-hardening task in the
implementation sequence — not yet shipped as of this document.

**Known residual gap, independent of the above:** deactivating a
profile (`is_active = false`) does not itself revoke that person's
outstanding Supabase Auth session/JWT. Until it separately expires, a
just-deactivated user's session can still trip the NULL-bypass bug
above (`current_user_role()` returns `NULL` for them too, same as an
anonymous caller, once their profile is inactive). This is documented
where relevant rather than treated as a surprise each time it's
rediscovered.

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
