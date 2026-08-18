# Batch 3 - Attendance/Profile Database Proof and Security Baseline

## Purpose

Batch 3 is the database-authoritative verification gate for Maven Attendance and staff-profile security before Work Desk UX completion.

The goal of this batch is proof, not feature expansion. `main` remains untouched.

## Scope verified

The repository attendance/profile migration and surrounding permission model were exercised against a fresh disposable local PostgreSQL instance.

The proof covers:

- employee own-attendance access;
- reviewer own-attendance access;
- admin all-staff attendance access;
- inactive-account denial;
- Punch In and Punch Out RPC behavior;
- one attendance row per Nepal business date;
- Asia/Kathmandu midnight boundary behavior;
- direct INSERT, UPDATE and DELETE bypass denial;
- admin correction authorization;
- mandatory correction reason;
- immutable correction audit history through the application role;
- anonymous attendance RPC denial;
- self-profile update boundaries;
- protection of admin-managed profile fields;
- absence of GPS, IP, device, screenshot, presence and productivity-surveillance fields.

## Test-matrix correction

The original Attendance matrix produced seven misleading findings because several checks depended on state created inside earlier `asRole(...)` transactions even though the database harness intentionally rolls those transactions back.

The corrected matrix keeps security actions role-scoped while using deterministic setup fixtures where cross-check persistence is required.

Expected PostgreSQL exceptions are also isolated in separate transactions. This prevents an intentionally rejected query from aborting the same transaction that contains a later valid check.

The Nepal midnight assertion now compares PostgreSQL `date` values as date text inside SQL, avoiding JavaScript `Date` timezone conversion during the assertion.

No Attendance production migration or RLS rule was weakened to make these tests pass.

## Exact database evidence

Clean owner-workstation rerun:

```text
node .\tests\db\run.js

278 checks run, 0 show current behavior that doesn't match the intended model.
Written: docs/PERMISSION_BASELINE.md, docs/permission_baseline.json
```

The generated permission baseline records:

- 33 repository migrations;
- 278 checks;
- 0 permission-model mismatches.

Key Attendance rows explicitly pass for:

- own vs other-user reads;
- reviewer isolation;
- admin reads;
- inactive-user denial;
- direct-table mutation denial;
- audited admin correction;
- correction-history visibility;
- Nepal midnight boundary;
- no surveillance fields;
- anonymous RPC denial;
- controlled self-profile updates;
- protection of admin-managed profile fields;
- own Punch Out.

## Wider regression evidence

The owner workstation also passed:

```text
npm.cmd run test:syntax
JavaScript syntax: 92 passed / 0 failed
```

```text
npm.cmd test
46 passed / 0 failed
```

```text
npm.cmd run build
PASS
```

```text
npm.cmd run test:ui
307 passed / 0 failed
```

## Embedded PostgreSQL interruption note

One earlier `npm.cmd run test:db` execution printed the successful 278-check result but was manually interrupted when the shell prompt did not return immediately.

That interruption left an orphaned embedded PostgreSQL child listening on the disposable test port. The orphan was identified as Maven's `@embedded-postgres` test process and stopped.

After the test port was confirmed free, a clean direct rerun with `node .\tests\db\run.js` completed with 278 checks / 0 mismatches and returned normally to PowerShell.

The clean rerun is the Batch 3 database evidence used for this checkpoint.

## Boundaries not claimed complete

Batch 3 does not certify Maven as production-ready.

Still outstanding in later controlled batches:

- focused Attendance browser UX verification;
- CSV UX verification;
- correction-history UI verification;
- Work Desk systematic UX completion;
- final full RLS/offboarding regression after later operational changes;
- live/test Supabase deployment proof where required;
- cross-browser release checks;
- PWA cache/storage verification;
- production deployment verification;
- final owner release approval.

## Batch 3 conclusion

The defined Batch 3 local database acceptance gate is satisfied:

- repository migrations apply in disposable local PostgreSQL;
- Attendance/profile database authorization behaves as intended in the matrix;
- no unresolved permission-model mismatch is reported;
- syntax, unit, build and full Chromium regression gates remain green.

The next controlled implementation batch is Batch 4 only after this Batch 3 checkpoint passes final Git diff review and is committed/pushed to `professional-update`.

Do not merge to `main` without explicit owner release approval.