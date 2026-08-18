# Batch 2A - Technical Consistency Cleanup

**Status:** active implementation batch. This document records the narrow Batch 2A scope and prevents older project notes from silently overriding the current professional-update workflow.

## Owner decisions preserved

- `100+ clients served` is confirmed and may remain public.
- Public Team members will be managed later through Website Content Admin. Internal Staff profiles never auto-sync to public Team content.
- Staff photo handling must remain simple: optional image reference plus initials fallback; no upload manager, crop editor, gallery, facial processing or social-photo integration.
- `main` remains untouched until final release approval. Current checkpoints belong on `professional-update` only.
- Finance/tax/legal values are out of scope and must not be rewritten in this batch.

## Changes in Batch 2A

### 1. Documentation and branch safety

Current-facing Git/Admin guidance now points development work to `professional-update` and labels older direct-to-main instructions as historical. Website Content Admin no longer silently defaults its branch to `main`; the operator must enter/choose a branch explicitly.

### 2. Simple staff photo behavior

Work Desk keeps one optional text reference only. Accepted sources are:

- local site images beginning with `/images/`; or
- public objects from Maven's own Supabase project Storage URL.

The Staff CSP allows that same controlled Supabase origin and does not open `img-src` to arbitrary HTTPS hosts. Invalid sources are rejected before save. Missing or broken images fall back to staff initials.

### 3. Public heading semantics

Shared footer navigation labels use `h2` rather than jumping directly to `h4`. Public regression coverage now requires exactly one `h1` per indexable page and checks forward heading-level progression across the full document, not only `#main`.

### 4. Content safety

`content/site.yaml` is intentionally untouched in Batch 2A. No tax, VAT/TDS, statutory deadline, professional qualification, finance/legal meaning or owner-approved public claim is changed by this consistency pass.

## Acceptance gate

- No current operator guide tells the owner to push unfinished development to `main`.
- Admin branch selection is explicit; no implicit `main` fallback remains.
- Staff photo values accepted by the UI are compatible with Staff CSP and broken/missing photos degrade to initials.
- Indexable public pages retain one H1 and logical heading progression once browser tests run.
- Dependency-free source/syntax tests pass in this environment.
- Full build/Playwright remain owner-workstation gates if clean dependency installation is unavailable here.
- Diff contains only intended Batch 2A consistency changes and `content/site.yaml` remains byte-for-byte unchanged.


## Verification evidence in this environment

- `npm run test:syntax`: **89 passed / 0 failed**.
- Dependency-free focused tests (`batch2-source`, calculator, tax): **27 passed / 0 failed**.
- Full `npm test`: **27 passed / 12 failed**, with all 12 failures coming from SEO tests whose build hook could not start because `js-yaml` is not installed in this container. This is an environment/dependency gap, not a source-test failure.
- Direct `node build.js`: **UNVERIFIED / environment-blocked** with `Cannot find module 'js-yaml'`.
- Playwright/browser checks: **UNVERIFIED** here because project dependencies/browsers are not installed.
- `content/site.yaml` SHA-256 remained unchanged during Batch 2A source edits.

The owner workstation must still run the normal install, full test, build and localhost/browser checks before this batch is accepted for commit/push.

## Do not expand this batch

Do not redesign pages, change marketing/legal copy, publish Team/Blog/Testimonials, apply Attendance SQL to production, add a staff photo media system, loosen CSP broadly, or merge/push to `main` as part of Batch 2A.
