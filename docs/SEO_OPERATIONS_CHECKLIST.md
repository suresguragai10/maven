# SEO Operations Checklist (Handbook Task 31)

This is an **operator checklist for external accounts and manual steps** — Google Search Console, Bing Webmaster Tools, Google Business Profile, and baseline performance tracking. It is deliberately separate from `test/seo.test.js`, which protects the *technical* SEO surface (canonical URLs, sitemap, robots, structured data, metadata) with automated tests against every build. Nothing in this document requires a code change to act on; where a code change would help, that's noted as a future task, not done here.

## What's already automated (no manual checking needed)

`test/seo.test.js` runs as part of `npm test` on every build and will fail if a future code change breaks any of:
- Extensionless canonical URLs on every indexable page, matching the sitemap
- `sitemap.xml` containing exactly the intended indexable routes (no hidden pages, no duplicates, no stale entries)
- `robots.txt` disallowing `/admin/` and `/staff/`, allowing everything else, pointing at the sitemap
- Hidden pages (currently Blog, Testimonials — see `content/site.yaml`'s `pages[].hidden`) staying `noindex, nofollow` and out of the sitemap until deliberately un-hidden
- OG/Twitter Card metadata present and non-empty on every indexable page, and `og:image` resolving to a real file
- Structured data (`AccountingService` site-wide, `FAQPage` on the FAQ page only) parsing as valid JSON-LD, `sameAs` never containing anything but a real configured profile URL, and the FAQ schema's question count matching what's actually visible on the page (never a superset)
- No two indexable pages accidentally sharing an identical `<title>` or meta description
- Internal anchors on the homepage pointing at pages that actually exist, with no `javascript:` pseudo-links or empty hrefs

If a Search Console report ever looks wrong (a page missing from the index, a duplicate-title warning, a structured-data error), check whether `npm test` still passes first — if it does, the technical output is correct and the issue is either a Google-side indexing delay or something outside this repo's build (e.g. DNS, hosting).

## One-time setup

### Google Search Console
1. [search.google.com/search-console](https://search.google.com/search-console) → **Add property** → **Domain** property for `mavennepal.com.np` (covers `www`/non-`www` and http/https automatically, unlike a URL-prefix property).
2. Verify via the DNS TXT record method (add the record at your DNS provider — Cloudflare, if DNS is managed there) rather than an HTML file or meta tag, since a domain property requires DNS verification anyway and it's the most durable method (survives a full site rebuild/redeploy).
3. Once verified, **Sitemaps** → submit `https://mavennepal.com.np/sitemap.xml`.
4. Set the **preferred domain**/canonical signal implicitly follows what `brand.siteUrl` in `content/site.yaml` is set to (`https://mavennepal.com.np`, no `www`) — every canonical tag and the sitemap itself already point there consistently (verified by `test/seo.test.js`), so there's nothing extra to configure in Search Console for this.

### URL Inspection tool (use when publishing something that matters)
- After publishing a genuinely new indexable page, or a substantive update to an existing one (not a typo fix), use **URL Inspection** → paste the exact canonical URL → **Request Indexing**. This does not guarantee fast indexing but does queue a crawl sooner than waiting for Google's own schedule.
- Do **not** request indexing for every minor content tweak — it's a finite, throttled quota, and Google already re-crawls known-good pages on its own schedule via the sitemap.
- If a page was just un-hidden (e.g. Blog or Testimonials, once real content exists), request indexing for it explicitly — it was previously `noindex` and Google may have already crawled and remembered that state.

### Google Business Profile
1. Claim/create a listing at [business.google.com](https://business.google.com) for **Maven Consultancy Services Pvt. Ltd.**
2. **NAP consistency is the whole point of this step**: Name, Address, and Phone on the listing must match the site *exactly* — pull them directly from `content/site.yaml`'s `brand.legalName`/`brand.addressLine`/`brand.mobile` (or the admin panel's Brand & Contact section) rather than retyping from memory, since a mismatch (e.g. a different phone number, an abbreviated address) actively hurts local search relevance rather than being neutral.
3. Category: an accounting-adjacent category that matches what the site itself claims (e.g. "Accounting firm" is arguably too strong given the footer disclaimer explicitly says "not a licensed audit firm" — "Business management consultant" or "Bookkeeping service" more accurately matches the site's own positioning; pick whichever Google category is closest to actual services, don't reach for the most prestigious-sounding one).
4. Link the website field to `https://mavennepal.com.np`.
5. **Do not add reviews yourself or ask for fake/incentivized ones** — this violates Google's policy and directly contradicts this task's own content rules. Only real client reviews, requested normally.

### Bing Webmaster Tools
1. [bing.com/webmasters](https://www.bing.com/webmasters) → add the site.
2. Bing Webmaster Tools can **import verification and site data directly from an already-verified Google Search Console property** — use that instead of a second manual DNS/meta-tag verification if it's offered, to avoid maintaining two separate verification methods.
3. Submit `https://mavennepal.com.np/sitemap.xml` there too (Bing does not automatically pick up a sitemap referenced in `robots.txt` as reliably as Google does).

### Bing IndexNow — **not currently implemented**
This codebase does **not** currently ping the IndexNow API on publish (confirmed: no IndexNow code anywhere in `build.js` or elsewhere). IndexNow is a simple protocol (an HTTP request naming the changed URL, plus a key file hosted at the site root) that would let Bing/other participating engines learn about a change immediately instead of waiting for their next crawl. This is a reasonable **future enhancement**, not something silently added by this documentation task — implementing it would mean:
- Generating and hosting a key file at `/<key>.txt` (a small addition to `build.js`'s static-file output).
- A way to trigger the ping (either a manual step after publishing, or wiring it into the GitHub Actions deploy workflow).

If this gets prioritized later, treat it as its own small task rather than bolting it onto an unrelated change.

## Baseline query/impression/click tracking

Once Search Console has a few weeks of data (there's nothing meaningful to review immediately after verification):

- **Cadence**: check monthly, not daily — organic search data is noisy week-to-week and a daily check mostly just creates anxiety over nothing. **Performance** report → filter to the last 3 months, compare against the previous period.
- **What to actually look at**: total clicks and impressions trend (is it growing, flat, or dropping — a sudden drop is the one thing worth investigating off-cadence), which **queries** are already bringing traffic (informs which pages/services to make clearer, never an invitation to keyword-stuff those exact phrases back into the copy), and which indexable **pages** get zero impressions after a couple of months (may indicate the page's topic doesn't match real search demand, or that internal linking to it is weak — not necessarily a metadata problem).
- **Coverage report**: periodically confirm the indexed-page count roughly matches the sitemap's URL count (currently 18) — a large, growing gap between "submitted" and "indexed" is worth investigating (though some gap is normal and not automatically a problem).
- **Do not chase impressions/clicks by adding more pages, more keywords, or more cities than the business actually operates in** — this repo's own rules (see below) and this task's explicit instructions rule that out as a strategy.

## Content rules this checklist (and any future SEO work) must keep following

Restated from this task's own instructions, since operational SEO work is exactly where these get tempting to bend "just this once":
- Tighten metadata only where it's clearly awkward or actually duplicated (verified by `test/seo.test.js`) — do not chase an arbitrary character-count target for its own sake.
- No keyword stuffing, no fake reviews (see Google Business Profile above), no fake per-city landing pages, no hidden keywords, no doorway pages.
- Never claim or imply a guaranteed Google rich result (FAQ rich results in particular have become narrower/less available over time across the industry generally) — structured data here exists so content is machine-readable and accurately described, not as a promise of a specific search-result appearance.
- Structured data must only assert facts already true and configured elsewhere on the site (`brand.*` fields) — `sameAs` links only to social profiles that actually exist and are set in the CMS, never a placeholder or a competitor's/generic profile.
