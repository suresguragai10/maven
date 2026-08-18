# UI regression testing (Handbook Task 2)

A Playwright regression harness for the public marketing site and the
`/staff/` and `/admin/` app entry shells. Built so the known accordion and
navigation issues (and anything like them going forward) are caught by an
automated test instead of relying on someone remembering to click around
before a release.

## Why Playwright, and what was added

No browser test framework existed in this repo before this task (`npm
test` is 18 pure calculator-math tests — see `docs/CURRENT_BASELINE.md`
§3 — with zero relation to rendered pages). One dependency was added:
**`@playwright/test`** (devDependency only, not shipped to `dist/` or the
deployed site). It was chosen because it's the framework this task's own
instructions named as the default, it needs no separate test runner or
assertion library, and it can drive real Chromium/Firefox/WebKit engines
headlessly — necessary for the CSS layout (overflow) and focus-management
checks this suite does, which a DOM-only tool (jsdom, etc.) can't verify.
Nothing else was added. Browser *binaries* (not an npm dependency — a
separate download Playwright manages) are required once per machine; see
Setup below.

## Setup

```bash
npm install                        # installs @playwright/test itself
npm run test:ui:install-browsers   # one-time: downloads Chromium, Firefox, WebKit binaries (~500MB combined)
```

The browser binaries are cached outside the repo
(`%LOCALAPPDATA%\ms-playwright` on Windows, `~/.cache/ms-playwright` on
Linux/Mac) — not committed, not part of `node_modules/`. CI needs the
same install step before running tests; see "CI" below.

## Running

```bash
npm run test:ui          # Chromium only — the fast, reliable default
npm run test:ui:all      # Chromium + Firefox + WebKit
npm run test:ui:report   # opens the last run's HTML report (screenshots/traces on failure)
```

Every run does a full `node build.js` first (via Playwright's `webServer`
config in `playwright.config.js`), then serves the real `dist/` output
over a local static server (`tests/ui/support/serve-dist.js`, ~80 lines,
no new dependency — hand-rolled rather than pulling in `serve`/
`http-server` for something this small) and points the browser at that.
**Tests never load source files directly** — they exercise exactly what
gets deployed, so a build-time regression (a page missing from `dist/`,
for instance) would be caught too, not just a runtime one.

### Batch 2C responsive verification gate

Batch 2C turns the public-site responsive review into a broader repeatable gate instead of another visual redesign. `overflow.spec.js` now runs the exact 320/360/390/430/768/1024/1280/1440 matrix against every generated public route, including direct access to hidden/noindex Blog and Testimonials pages. `responsive-gate.spec.js` then exercises dynamic states that a first-paint overflow check cannot prove: open mobile submenu, Industries detail, FAQ panel, Contact validation, expanded EMI schedule, Back-to-Top threshold and floating-control/footer clearance. It also records uncaught page errors and broken same-origin assets on the critical mobile smoke pages.

The owner-workstation gate is `npm.cmd run test:ui` (Chromium) after syntax/unit/build are green. `npm.cmd run test:ui:all` remains the broader cross-browser follow-up when Chromium is clean. A missing browser binary or environment failure is **UNVERIFIED**, not PASS.

## Layout

```
tests/ui/
  support/
    pages.js         — shared page list, viewport widths, expected nav structure
    serve-dist.js     — the static file server described above
    mock-supabase.js  — Handbook Task 17: intercepts the real Supabase
                        client's network calls with fixture data, see below
  public/             — marketing site tests (home, mobile nav, desktop nav
                         dropdowns, FAQ, documents, industries, overflow,
                         hidden-links, contact, 404/nav)
  app/                — staff.js / admin.js: pre-login shell smoke tests
                        (staff.spec.js, admin.spec.js), plus a genuinely
                        logged-in Firm Work suite (firm-work.spec.js,
                        Handbook Task 17) using the mock below
playwright.config.js   — at repo root, alongside package.json
```

## Testing past the login screen (Handbook Task 17)

`staff.spec.js`/`admin.spec.js` only ever tested the pre-login shell —
this environment has no live Supabase credentials, so nothing past the
login form could be exercised for a long stretch of this project's
history (every DB-facing handbook task instead relied on
`tests/db/`'s local-Postgres permission harness, which is authoritative
for server-side rules but renders no browser at all).

`tests/ui/support/mock-supabase.js` closes that gap for pages that don't
need real backend logic to test meaningfully — it uses Playwright's
`page.route()` to intercept the REAL `@supabase/supabase-js` UMD
bundle's network calls (the exact file `dist/staff/supabase.js` ships,
copied from `node_modules` at build time — see `build.js`) and answers
them with fixture data. `staff.js` and the real client library run
completely unmodified; only the network boundary is faked. This is
deliberately NOT a general PostgREST emulator — GET requests do simple
`eq.` filtering (enough to make `.single()` calls resolve correctly) but
otherwise return a table's full fixture array regardless of query
params, since query CORRECTNESS is already proven by `tests/db/`; this
mock's job is only to give the UI something real to render and to let
assertions inspect the outgoing request itself (e.g. confirming a filter
value actually appears in the query string, proving a server-side query
was used rather than a client-side download-then-filter).

`firm-work.spec.js` is the first consumer: 6 tests covering list
rendering, create-form validation, filter/search request shape,
edit/reassign, the completed-history status filter, and mobile/tablet
overflow. Building this surfaced two real bugs neither `tests/db/` nor a
code read would have caught: a `.single()` response-shape mismatch in
the mock itself (fixed in the mock, not the app — see the file's own
comments) and a genuine mobile-layout overflow in the Firm Work filter
row's date-range inputs (fixed in `staff.js`, see Handbook Task 17's
commit). Reusable for any future task that touches authenticated
Staff/Admin app pages — extend the `tables` fixture passed to
`installSupabaseMock()` rather than building a new mock per task.

**Handbook Task 19 follow-up:** the `.single()` bare-object-vs-array fix
above was originally applied to the mock's GET handler only. Writing
`firm-work-detail.spec.js`/`projects.spec.js` — the first tests to chain
`.insert(...).select().single()` / `.update(...).select().single()` onto
a WRITE, not just a read — surfaced the identical bug on POST/PATCH: the
mock always wrapped the returned row in an array, so a `.single()` call
right after a write silently got no usable `data`. Fixed the same way,
in the mock only (`tests/ui/support/mock-supabase.js`), checking the same
`Accept: application/vnd.pgrst.object+json` header on POST/PATCH that GET
already checked.

## Browsers

Chromium is the project `npm run test:ui` runs by itself and is what
should gate CI — it was run repeatedly during this task and is stable
(72 passed / 4 failed, identical results across 3 separate runs).
Firefox and WebKit are configured and were both run via `npm run
test:ui:all` — this is real cross-browser coverage, not a claim without
evidence:

- **Firefox**, run alone: identical result to Chromium (72 passed / 4
  failed, same 4 tests).
- **WebKit**, run alone: 70 passed / 6 failed — the same 4 as Chromium
  plus two WebKit-only ~2px overflows (`/services` and
  `/documents-needed` at 320px only — see "Known/expected failures"
  below).
- Running all three projects **concurrently** (`test:ui:all`'s default)
  produced extra, non-reproducing failures in Firefox/WebKit on a couple
  of runs (a few tests timing out) that did **not** reproduce when each
  project was run alone. This traces to the hand-rolled dev static server
  being single-threaded and getting contended by three browsers' workers
  hitting it at once, not a real per-browser bug — confirmed by running
  each project in isolation and getting stable, identical results both
  times. If `test:ui:all` looks flaky in CI, run projects sequentially
  (`playwright test --project=chromium && playwright test
  --project=firefox && playwright test --project=webkit`) rather than
  trusting a single flaky combined run.

## Fixed by Handbook Task 25

Every regression this file originally documented as "known" or "newly
found but not fixed" (Task 2's own scope was tests only) was root-cause
fixed by Task 25, using these same tests as the acceptance bar. Nothing
below is a `test.fail()` anymore — each is now a normal, passing
regression test, and a future break here fails the suite loudly instead
of being silently tolerated.

### The accordion "two-click" bug (FAQ + Documents Needed + every
### FAQ-shaped block on the site)

**Root cause**: `ui.js`'s `accordionItem()` server-rendered a pre-opened
item's panel with NO inline style at all, leaving it at `styles.css`'s
`.accordion-panel { max-height: 0; }` default despite declaring
`is-open`/`aria-expanded="true"` — visually collapsed on load. The first
click then read the (already-true) `is-open` class and "closed" an
already-invisible panel; a second click was needed to see it open.

**Fix**: the panel's initial inline style now always matches its class/
aria state — `style="max-height:none"` when pre-opened (not a hardcoded
pixel guess, so arbitrarily long answer text is never clipped), matching
the existing `style="max-height:0"` closed case. `client.js` converts
`none` to a real pixel value on load (a CSS transition can't animate
`from: none`) so the first click still animates shut correctly. Since
FAQ, Documents Needed, and every other FAQ-shaped block (Support Areas,
NFRS/International/Virtual CFO FAQs) all share this one component, one
fix covers all of them.

Covered by `tests/ui/public/faq.spec.js` and `documents.spec.js` (the
previous `test.fail()` cases now assert the item IS visible on load and
DOES close on the first click).

### Mobile-nav open/close/focus-return

Unchanged from Task 2 — already correct, still passing normally.
`client.js`'s `openMobileNav()`/`closeMobileNav()` move focus correctly
on open/close/Escape. Task 25 added: a collapsed submenu's links are now
`inert` (removed on open, restored on close) so they're excluded from
Tab order while visually hidden — previously they were fully focusable
at `max-height:0`. See `mobile-nav.spec.js`.

### Desktop nav dropdowns (Handbook Task 25 — not a previously-tracked
### regression, but explicitly in scope for this task)

Previously the dropdown parent `.nav-link` was both a real navigable
`<a href>` AND the only way to reveal the dropdown (CSS `:hover`/
`:focus-within`) — ambiguous on touch, where a tap just navigates away
immediately with no way to see the children first. Now each dropdown
item has its own `.nav-dropdown-toggle` button (real `aria-expanded`/
`aria-controls`, same pattern the mobile submenu button already used),
independently click/tap/keyboard-operable, with Escape and click-outside
closing it and only one dropdown open at a time. `:hover` stays as a
fine-pointer-only enhancement (`@media (hover: hover) and (pointer:
fine)`); `:focus-within` and the explicit `.is-open` state work
unconditionally on every device. The parent link's own navigation is
completely unchanged. See `tests/ui/public/nav-dropdown.spec.js`.

### Public-site overflow (home, contact, WebKit /services + /documents-needed)

**Root cause, all three**: `.grid-2`/`.grid-3`/`.grid-4`, `.two-col`,
and `.form-grid` used bare `1fr` tracks — CSS shorthand for `minmax(auto,
1fr)`, which does NOT shrink a track below its content's own min-content
width. A `.service-card--photo` (home), `.contact-info-list` (contact),
and `.form-field` (contact's own inquiry form, only visible once the
`.two-col` overflow was fixed and the form's real width became the next
constraint) each had content wide enough to force their single-column
track past the viewport, dragging the whole page wider with it. This is
also very likely what the WebKit-only ~2px overflow was — no
WebKit-specific code was touched, and re-running the suite after the fix
showed it gone on WebKit too.

**Fix**: `minmax(0, 1fr)` instead of bare `1fr` on those five rules
(base + collapsed-breakpoint variants) — lets tracks shrink to fit
available space. Zero breakpoint values or column counts changed; this
only fixes shrink behavior, so `/industries` (which shares `.grid-3`)
was re-verified to still render its 13 cards (an odd count) correctly
with no overflow, not assumed safe by association. See
`tests/ui/public/overflow.spec.js` (all 48 checks now pass on Chromium
and WebKit) and `industries.spec.js`'s badge/grid-separation and
odd-count tests.

## Additional Task 25 hardening (not driven by a specific known bug)

- `type="button"` added to every JS-only trigger button that lacked it
  (accordion triggers) — a `<button>` with no explicit `type` defaults
  to `type="submit"` if it's ever inside a `<form>`.
- Collapsed accordion/industry-card panels are now `inert` (removed on
  open, restored on close) — their content is excluded from Tab order
  while visually hidden, matching the same fix applied to mobile
  submenus.
- Open accordion/industry-card panels recalculate their `max-height` on
  window `resize`/`orientationchange` (debounced) — previously a stale
  height captured at open time could clip reflowed content or leave dead
  space after a viewport change.
- `tests/ui/public/contact.spec.js` gained a third test exercising a
  fully valid submission end to end (`fetch()` → success message) with
  the real `formspree.io` endpoint intercepted via `page.route()` — the
  two pre-existing tests only ever proved submission was BLOCKED before
  any network call; this proves the success path itself works, without
  the real third-party service ever being reached during tests.

## A pre-existing flaky test, found and fixed while verifying Task 25

`industries.spec.js`'s `#industry-N` deep-link test read
`panel.getBoundingClientRect().height` immediately after `client.js` set
`panel.style.maxHeight` — but that property is CSS-transitioned
(`transition: max-height 0.28s ease`), so the *rendered* box height at
the instant of the read can still be mid-animation, not the target
value. Reproduced 5/5 times, and confirmed via `git stash` to already
fail identically on the pre-Task-25 code — this was a latent bug in the
test itself, not something Task 25 introduced. Fixed by asserting on the
inline `style.maxHeight` value (the synchronous target `client.js` just
set) instead of the animated, timing-dependent rendered height.

## Fixed by Handbook Task 26 (accessibility regression pass)

`axe-core` was deliberately NOT added — the task allowed either axe-core
"if the dependency/maintenance cost is justified" or strong Playwright
semantic assertions plus a manual keyboard checklist, and this repo has
added zero new dependencies all session. New coverage lives in
`tests/ui/public/accessibility.spec.js`:

- **Skip link**: real `<a href="#main">`, first in the DOM, verified as
  the first real Tab stop on Chromium/Firefox. Skipped on WebKit — its
  default Tab order excludes plain links (matching real desktop Safari's
  own default "Tab moves between form controls only" setting), so
  `keyboard.press('Tab')` never reaches an anchor-only skip link there;
  this is an engine/OS default, not something site markup can change.
- **Landmarks**: exactly one `<main>`; the mobile nav overlay is now a
  real `<nav aria-label="Mobile">` (was a plain unlabeled `<div>`),
  distinct from the desktop `<nav aria-label="Primary">`. Header/footer
  toggle buttons (`.nav-toggle`, `.mobile-nav-close`, `.back-to-top`) now
  all declare `type="button"` — previously only the Task-25-era buttons
  did.
- **Heading structure**: `accordionItem()` (`ui.js`) now wraps its
  trigger button in a real heading element instead of a bare `<span>`, so
  a screen-reader user browsing by heading finds each FAQ/Documents-
  Needed/support-area item directly. The level is caller-supplied
  (`headingLevel`, default `h3`) since the correct level depends on
  what precedes the accordion on that page — `h2` for FAQ/Documents
  Needed (no other h2 exists yet), `h3` everywhere a `sectionHead()`
  already provided one (every NFRS/IFRS-style support accordion).
  `industryCard()`'s card name and `teamCard()`'s name both moved from
  h3 to h2 — both pages had no h2 between their h1 and that h3 grid, a
  genuine skip; `.contact-info-item`'s four h4s became h3 for the same
  reason (Contact's h2 "Talk to us..." was followed directly by h4s with
  nothing at h3 until "Send an Inquiry", document order later).
- **Contact form errors**: `#formError` now has `role="alert"`, and a
  blocked submission moves focus onto it (`errorEl.focus()`) instead of
  only `scrollIntoView()`-ing it — a keyboard/screen-reader user
  previously got no indication a submission failed unless they happened
  to tab back onto the (visually) revealed message. The actual offending
  field(s) also get `aria-invalid="true"` + `aria-describedby="formError"`,
  cleared again once the form is valid.
- **Calculators page**: the tab bar's `role="tablist"` existed before
  this task with no matching `role="tab"`/`aria-selected`/`aria-controls`
  or keyboard support — arguably worse than plain buttons, since
  assistive tech announcing "tab list" implies arrow-key navigation that
  didn't exist. Completed the pattern (roving `tabindex`, `role="tabpanel"`,
  Left/Right/Home/End navigation matching the existing immediate-
  activation click behavior). The EMI schedule toggle (a bespoke
  disclosure not built on `accordionItem()`) gained
  `aria-expanded`/`aria-controls`, kept in sync in `client.js`. The four
  calculators' headline results (`tax-out-annual`, `vat-total`, `tds-tax`,
  `emi-monthly`) are now `aria-live="polite"` — deliberately just the one
  headline figure per calculator, not the whole breakdown/results block,
  so a screen reader isn't flooded re-reading the full table on every
  keystroke.

**Work Desk (`staff/`) — no dedicated Playwright suite** (the mock-Supabase
harness from Task 17 is heavier machinery than this pass's shell-level
changes warranted): a skip link, `<nav id="sidebar" aria-label="Primary">`,
`aria-current="page"` on the active sidebar item, `role="alert"` on the
login error box, and a fixed `outline:none` on all form-field `:focus`
states (a real, previously-unflagged gap — every OTHER interactive
element relied on the browser's own default focus ring; this was the one
place it was explicitly suppressed). `openModal()`/`closeModal()` — the
single shared entry point every "New Work"/"New Client"/etc. form goes
through — gained `role="dialog"`/`aria-modal`, a dynamic `aria-labelledby`
(reusing each modal's existing `<h2>` in its `.modal-head`), a Tab focus
trap, Escape-to-close, and return-focus-to-trigger on close, matching the
pattern already used for the public site's mobile nav and desktop
dropdowns. Route changes now move focus to the new page's `<h1>`
(`routeFromHash` → `focusMainHeading()`/`renderAndFocus()`) — the many
OTHER `render()` call sites used for in-place refreshes after a save
(not real navigations) are deliberately untouched, since yanking focus
to the page heading after e.g. checking a checklist box would be a
regression, not a fix. Verified via `node --check`, `node build.js`, and
manual code review only — see the manual keyboard checklist below for
what still needs a human pass with real credentials.

**Found but deliberately NOT fixed this task (flagged, not silently
skipped)**: work-item list rows (`workRow`/`firmWorkRow`/`attentionRow`/
`notifRow` in `staff.js`, used across Today/My Work/Team/All Work/Search/
Since Last Seen) are plain clickable `<div>`s with no `tabindex`, `role`,
or keyboard handler — a keyboard-only user cannot open a work item from
any list screen at all. This is real and significant, but touches 10+
call sites across the app's core daily-use screens, well beyond "login/
basic application shell" scope; fixing it safely deserves its own task
rather than a scope-expanding side-fix here. See the handbook task
sequence memory for the explicit decision this needs.

### Manual keyboard checklist (Work Desk — needs a human pass with real
### credentials; not exercised by any automated test in this repo)

- [ ] Tab from the login form through Sign In reaches the app shell in a
      sensible order; a failed login's error is announced (role="alert").
- [ ] Skip link (first Tab press) jumps to `#main`.
- [ ] Sidebar items are reachable by Tab; the active one has a visible
      focus ring (the `outline:none` fix above) and `aria-current="page"`.
- [ ] Opening any "New X" modal traps Tab inside it, Escape closes it,
      and focus returns to the button that opened it.
- [ ] Clicking a sidebar item moves focus to the new page's heading
      (confirm with a screen reader, not just visually).
- [ ] Known gap: work-item list rows are NOT keyboard-openable (see
      above) — confirm this still matches the flagged, not-yet-fixed
      status before relying on this checklist as a completeness signal.

## CI

Not yet wired into `.github/workflows/deploy.yml` — this task built the
harness itself; gating deploys on it is Handbook Task 38 ("CI release
gates"). To add it there later: `npx playwright install --with-deps
chromium` (or all three) before `npm run test:ui` in the existing
workflow, after the current `npm test` step.
