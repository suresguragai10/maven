# Image SEO, Performance and Core Web Vitals Audit (Task 18)

This audit measured **real production output** (built `dist/`, headless Chrome via Playwright + the Chrome DevTools Protocol, throttled to a Slow-4G-ish mobile profile, 390×844 viewport) before making any change, per this task's own "measure before optimizing" instruction. Every number below is a real measurement, not an estimate.

## Method

A one-off Playwright script (not committed — this is an audit report, not a new permanent test) served the built `dist/` folder locally, applied `Network.emulateNetworkConditions` (150ms latency, 1.6Mbps down / 750Kbps up), and used `PerformanceObserver` for `largest-contentful-paint` and `layout-shift` (the same APIs real Core Web Vitals tooling uses), plus per-resource `Content-Length` totals by type. Measured on Home, Services, and About — one page from each major template family (custom hero, `pageHero()` with photo, `pageHero()` with photo + two-column layout).

## Finding 1: every page's hero photo is the actual LCP element, and it wasn't prioritized

Confirmed by measurement, not assumption: on all three pages tested, the `largest-contentful-paint` entry's `url` was the page's own hero background photo — not the H1 text, not any other image. This applies to Home (`.hero`'s external-stylesheet background image) and every sub-page (`pageHero()`'s inline-style background image, which is discoverable by the browser's preload scanner but not prioritized as "high" by default the way an `<img fetchpriority=high>` would be).

**Before / after** (same throttled mobile profile, same three pages):

| Page | LCP before | LCP after | Change |
|---|---|---|---|
| Home | 1984ms | 1348ms | **-636ms (-32%)** |
| Services | 2424ms | 1344ms | **-1080ms (-45%)** |
| About | 1888ms | 1340ms | **-548ms (-29%)** |

**Fix**: added a `<link rel="preload" as="image" fetchpriority="high">` for each page's own hero image, emitted only when the page actually has one (`heroImage` field per `build.js` `pages[]` entry → `layout.js`'s `renderPage()`). **Total transferred bytes were identical before and after** (598.2KB / 582.4KB / 369.1KB respectively, both runs) — this is a pure priority/discovery-timing fix, not new weight. No image was moved out of CSS; the existing background-image technique (needed for the gradient-over-photo treatment) was kept as-is.

This directly satisfies "prefer fewer, better-optimized service/capability images over many decorative files" from the opposite direction of what that might suggest — the fix here was *loading the same images faster*, not adding or removing any.

## Finding 2: CLS is already low, and images are not a contributor

| Page | CLS (before = after, unaffected by the LCP fix) | Shift sources |
|---|---|---|
| Home | 0.0299 | `P`, `#text`, `DIV` |
| Services | 0.0047 | `#text`, `#text` |
| About | 0.0371 | `SECTION`, `#text`, `P` |

All three are well within Google's "good" threshold (<0.1) and nowhere near "poor" (≥0.25). No `IMG` node appears in any shift source — confirmed by measurement, not assumption. This is because `capabilityChapter()`/`serviceEntry()`-style images sit in containers with CSS-defined `min-height` and `object-fit: cover`, so the container's layout is stable before the image's own intrinsic size is even known — explicit `width`/`height` HTML attributes are a common best practice but weren't the actual gap here; the CSS-container approach already achieves the same effect. Not changed, since it's already working and re-verified rather than assumed.

## Finding 3: font payload, checked and left alone

Fonts are the single largest transferred-byte category (147.6KB, larger than the hero image on two of three pages tested). Checked whether any of the 7 requested weights (Source Serif 4: 500/600/700; Source Sans 3: 400/500/600/700) are unused in `styles.css` — all four weight values (400/500/600/700) have real `font-weight` declarations in the stylesheet. Removing an actually-used weight would force the browser to synthesize bold, a real typographic-quality regression for "a premium professional firm" (this task's own instruction) — not cut, since the measured cost doesn't clearly outweigh that risk. `display=swap` is already set (confirmed in the existing Google Fonts URL), which is the correct mitigation for perceived load time regardless of payload size.

## Finding 4: CSS/JS payload is not a concern

Stylesheet: 59.3KB. Script: 46.5KB. Both delivered from content-hashed, `immutable`-cached `/assets/*` paths (confirmed in `dist/_headers`: `Cache-Control: public, max-age=31536000, immutable`) — a repeat visitor to any second page pays zero cost for either file. `/images/*` gets a shorter `max-age=604800` (7 days), a deliberate tradeoff already in place since image filenames aren't content-hashed. Neither needed a change.

## Finding 5 (not fixed — recommendation only): no responsive image variants exist

No `<img>` on the site uses `srcset`/`sizes` — every image ships the same full-resolution file to a 390px-wide phone and a 1920px-wide desktop. Measured image sizes are already moderate (72–276KB per page, not multi-MB), so this isn't an urgent problem today, but it's a real, identified gap. Building this properly means generating real resized variants at build time, which needs an image-processing dependency this repo doesn't currently have (`sharp` or similar) — adding one is a bigger, separate architectural decision than this task's "measure and fix targeted issues" scope, so it's recorded here as a finding for a future dedicated task rather than rushed into this one.

## What was NOT changed, and why

- No image was newly lazy-loaded or un-lazy-loaded beyond what already existed (below-the-fold `capabilityChapter`/`serviceEntry` images already correctly use `loading="lazy"`; hero images were never lazy in the first place, since CSS background-images have no native lazy-loading mechanism — consistent with this task's explicit "do not lazy-load the true LCP hero" instruction).
- No animation timing was changed — reviewed against `styles.css`'s actual `transition` properties and confirmed every one is opacity/transform/color/shadow/border/`max-height` (the last only for accordion expand/collapse, a bounded single-element cost, not page-wide), matching the motion-governance budget from earlier tasks. No layout-triggering property (`width`/`height`/`top`/`left`) is animated anywhere.
- No font weights were removed (Finding 3).
- No responsive-image pipeline was built (Finding 5) — flagged, not implemented, since it needs a new dependency and is out of proportion with this task's fix scope.
