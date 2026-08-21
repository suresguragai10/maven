# Search Console and SEO Measurement Readiness (Task 19)

This is an **owner action checklist** — Google Search Console itself is a Google account/dashboard outside this codebase; nothing here can be done from inside the repository. What this task changed in the codebase is narrow and explicit (see "What changed" at the bottom); everything else below is a sequence for whoever has access to the domain's DNS and a Google account to follow.

## Analytics/privacy — read this first

**Search Console needs no analytics script, tracking pixel, or cookie of any kind.** It works purely from (1) proving you own the domain and (2) Google's own crawl/search data — nothing is installed on the site to make Search Console work. If this checklist is ever used as a reason to add Google Analytics, a tag manager, or any other tracking script "for SEO," that is a **separate decision** this document does not recommend and this task did not require.

The site already has exactly one optional, privacy-respecting analytics option: Cloudflare Web Analytics (`brand.cloudflareAnalyticsToken` in Website Content Admin) — cookieless, no cross-site tracking, off by default, on only if the owner explicitly configures a token. That mechanism is unrelated to and unaffected by anything in this checklist.

## Step 1 — Verify domain ownership

**Preferred: DNS TXT record verification**, done entirely at the DNS provider (Cloudflare, since that's already where this domain's DNS and hosting live) — no code change, and it's a **domain-level** property that automatically covers `www` and any subdomain, unlike a single-URL verification.

1. In Search Console, add a property using **Domain** (not "URL prefix").
2. Google gives a TXT record value — add it in Cloudflare DNS → the domain's DNS records → a new `TXT` record at the root.
3. Verify in Search Console. DNS propagation can take a few minutes to a few hours.
4. Once verified, this TXT record can stay in DNS indefinitely (Google periodically re-checks it) — no ongoing maintenance.

**Fallback: HTML tag verification**, only if DNS access isn't available to whoever is doing this step:

1. In Search Console, add a property using **URL prefix** (`https://mavennepal.com.np`) instead, and choose the **HTML tag** method.
2. Copy just the `content="..."` value (not the whole `<meta>` tag).
3. Open Website Content Admin → **Brand & Contact** → **Google Search Console Verification Code**, paste it in, save.
4. This is safe to store here — Google's own documentation states this value is designed to be publicly visible in page source (anyone can already see it via view-source on any verified site); it proves ownership only, it does not grant access to anything. It was deliberately built as a CMS field rather than hardcoded in the repo, so a value tied to a specific domain never ends up baked into source code.
5. Once verified, this field can be safely cleared again if you want — Search Console remembers the verification even if the tag is later removed (though re-verification will need it again if Google ever asks to re-check).

## Step 2 — Submit the sitemap

The sitemap already exists, is already tested, and needs no code change: `https://mavennepal.com.np/sitemap.xml` — confirmed well-formed, listing exactly the 18 currently-indexable pages, no duplicates, no trailing `.html` (`test/seo.test.js`, run on every build). In Search Console: **Sitemaps** (left sidebar) → enter `sitemap.xml` → Submit.

## Step 3 — URL Inspection

For any specific page that needs a manual check (e.g. right after this professional-update branch eventually goes live, or after a major content change): Search Console → **URL Inspection** → paste the full page URL. This tells you directly whether Google has actually indexed that exact page, what it saw the last time it crawled, and lets you request re-indexing after a real content change. Useful first checks once verified: the homepage, and 2–3 of the pages with the most distinct content (`/services`, `/nfrs-ifrs`, `/global-outsourcing`).

## Step 4 — Indexing coverage

Search Console → **Pages** (under Indexing). This report shows which pages are indexed vs. excluded, and *why* excluded (noindex, duplicate, crawled-not-indexed, etc.). Cross-reference against `docs/SEO_INTENT_MAP.md`'s 18-page inventory (Task 10) — every one of those 18 should eventually show as indexed; `testimonials.html`/`blog.html` should **not** appear here at all while they stay hidden/noindexed (already enforced by the build and tested), and `/admin/`, `/staff/` should never appear (blocked by `robots.txt` and their own `noindex` tags, both tested — Task 11).

## Step 5 — Core Web Vitals

Search Console → **Core Web Vitals** (or the standalone PageSpeed Insights / CrUX report once enough real-user traffic accumulates — this report needs actual visitors over time, it won't populate immediately after launch). Task 18 already measured and improved LCP by 29–45% across the pages tested (`docs/PERFORMANCE_AUDIT.md`) using synthetic (Playwright + CDP) measurement; this Search Console report is the eventual **real-user** confirmation of that work once there's enough traffic for Google to report on it — treat a gap between the two as expected in the early weeks, not as a discrepancy to chase.

## Step 6 — Impressions, clicks, and CTR

Search Console → **Performance** (the main query/page report). This is the report that actually tells you what's working — a page can rank well (impressions) but get few clicks if the title/description isn't compelling, which is a real, checkable feedback loop into the title/description work already done in Task 12. Check this report periodically (monthly is reasonable for a site this size), not daily — a small business site won't produce meaningfully different data day-to-day.

## Step 7 — Branded vs. non-branded queries

In the **Performance** report, filter the Queries tab. **Branded** = queries containing "Maven," "Maven Consultancy," or close misspellings — these mostly reflect people who already know the business (word of mouth, business cards, direct referral) and are usually high-CTR regardless of title/description quality. **Non-branded** = queries about the actual service category ("accounting services Nepal," "outsourced bookkeeping Nepal," "NFRS implementation," etc.) — this is the truer signal of whether the SEO work in Tasks 10–18 is actually reaching new people who didn't already know the business. Track the two separately; a rising branded-query count mostly reflects offline reputation, while a rising non-branded count reflects organic search actually working.

## What changed in this task (for the record)

- `content/site.yaml`: added `brand.googleSiteVerification` (blank by default).
- `layout.js`: emits `<meta name="google-site-verification">` only when that field is set — otherwise nothing is added to `<head>` at all.
- `admin/admin.js`: new CMS field for the above, with an explicit note that DNS verification is preferred and that this value is not sensitive.
- `tests/ui/support/mock-github.js`: test fixture updated to match the new brand field (keeps the admin-panel test suite's fixture data complete).
- No analytics script, tracking pixel, or third-party SDK was added anywhere — Search Console needs none of those, and this task's own instruction is not to install one "solely for SEO."
