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

## Layout

```
tests/ui/
  support/
    pages.js         — shared page list, viewport widths, expected nav structure
    serve-dist.js     — the static file server described above
    mock-supabase.js  — Handbook Task 17: intercepts the real Supabase
                        client's network calls with fixture data, see below
  public/             — marketing site tests (home, mobile nav, FAQ, documents,
                         industries, overflow, hidden-links, contact, 404/nav)
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

## Known/expected failures

Per this task's instruction not to weaken an assertion just to make CI
green, the following are asserted as the CORRECT (bug-free) behavior and
marked with Playwright's `test.fail()` so they show as an *expected*
failure — CI stays informative (a real fix will show up as an
unexpected pass, which Playwright itself flags) without either hiding
the bug or making the suite permanently red for something already known.

### The accordion "two-click" bug (FAQ + Documents Needed)

**Confirmed real**, root-caused via `styles.css` and `client.js`, not
just suspected. `pages*.js` server-renders each accordion's *first* item
pre-expanded (`class="accordion-item is-open"`, `aria-expanded="true"`),
with no inline `style="max-height"` — every other item starts correctly
collapsed with an explicit `style="max-height:0"` matching its
`aria-expanded="false"`. `styles.css` has exactly one rule for the panel:

```css
.accordion-panel { max-height: 0; overflow: hidden; transition: max-height 0.28s ease; }
```

There is no `.accordion-item.is-open .accordion-panel` override. So the
"pre-opened" first item has nothing giving it height — it renders
**visually collapsed** despite declaring itself open. Clicking it the
first time reads `is-open` as true (from the class), so `client.js`'s
handler treats the click as "close an already-open item" and sets
`max-height: 0px` — already the case, so nothing visibly changes. A
**second** click is needed before it visually opens. Every other item
opens correctly on one click; this is specific to whichever item is
marked pre-open, on both pages that use this component.

Covered by:
- `tests/ui/public/faq.spec.js` — 2 tests marked `test.fail()`
- `tests/ui/public/documents.spec.js` — 1 test marked `test.fail()`

Not fixed here (out of this task's scope) — likely fix is either adding
the missing `.is-open .accordion-panel { max-height: ... }` CSS rule, or
rendering the first item's panel with an inline max-height server-side
like the others, whichever the repair task decides is the more
maintainable of the two.

### Mobile-nav open/close/focus-return

**Confirmed NOT buggy** — tested and passing normally (not a
`test.fail()`). `client.js`'s `openMobileNav()`/`closeMobileNav()`
already move focus correctly (into the panel on open, back to the toggle
on close, including via Escape). This task's "why" line named this as a
*known* issue to guard against; testing found it already correct as
built. Kept as a normal (non-`test.fail()`) test so any future regression
here fails loudly.

## New findings surfaced by this task (not previously known/documented)

These were not named in this task's description — they were found by
actually running the overflow suite for the first time. Per this task's
"do not fix known UI bugs" instruction and since these are newly
discovered (not previously "known" to be excluded from fixing), they are
left as normal, **un-suppressed failing tests** — the point of this
suite is exactly to surface things like this instead of relying on
visual memory, so hiding them behind `test.fail()` would defeat that.

1. **Home page overflows horizontally at 320px** (`scrollWidth` 356 vs
   `clientWidth` 320, ~36px). Diagnosed to `.service-card.service-card--
   photo` cards in the services grid rendering at 332px wide inside a
   320px viewport — `.grid-3`/`.grid-4` do collapse to a single column
   under 640px (`styles.css` line 361), but the card itself doesn't
   shrink below ~332px at the very smallest supported width. Reproduces
   identically on Chromium, Firefox, and WebKit.
2. **Contact page overflows horizontally at 320/360/390px** (up to 87px
   at 320px — `scrollWidth` 407 vs `clientWidth` 320). Diagnosed to the
   `.contact-info-list`/`.section-head--left` column rendering at a fixed
   ~383–407px regardless of viewport, inside a `.two-col` layout that
   does collapse to one column under 860px (`styles.css` line 512) but
   whose right-hand content isn't itself shrinking to fit. Reproduces
   identically on all three browsers; stops occurring at 430px and above.
3. **WebKit-only, ~2px, at 320px**: `/services` and `/documents-needed`
   also fail WebKit's overflow check by 2px (322 vs 320). Given the
   magnitude, this may be a WebKit-specific scrollbar-gutter or subpixel
   rounding difference rather than the same class of bug as #1/#2 — flag
   for the repair task to confirm either way, not treated as urgent.

None of these were fixed in this task (test-harness-only scope). They're
real, reproducible, and now permanently guarded by
`tests/ui/public/overflow.spec.js` — recommended as a quick, self-
contained fix whenever convenient (likely CSS-only), or scheduled into
Handbook Task 25 ("Public UI regressions").

## CI

Not yet wired into `.github/workflows/deploy.yml` — this task built the
harness itself; gating deploys on it is Handbook Task 38 ("CI release
gates"). To add it there later: `npx playwright install --with-deps
chromium` (or all three) before `npm run test:ui` in the existing
workflow, after the current `npm test` step.
