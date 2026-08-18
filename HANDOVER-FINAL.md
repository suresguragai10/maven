# Maven Consultancy Website — Complete Project Handover

> **Historical reference — dated July 2026, public-site/CMS scope only.**
> Kept for its narrative value, not treated as current. Known
> inaccuracies (self-contradicts on GitHub Pages vs. Cloudflare Workers
> hosting; never mentions `/staff/` despite it being the largest part of
> the codebase; points to the wrong file for updating tax slabs) are
> catalogued in `docs/CURRENT_BASELINE.md` §8. This document has no
> claims about Maven Work Desk (staff portal) roles, Client Work, or
> Firm Work — for that, see `docs/PRODUCT_BOUNDARIES.md`,
> `docs/ROLE_CAPABILITIES.md`, and `docs/WORKFLOW_MODEL.md`, the current
> authoritative sources as of Handbook Task 4.

> **Do not use this July handover for current Git/branch/deployment steps.**
> Current work is checkpointed only to `professional-update`; keep `main`
> untouched until owner-approved release. See `docs/GITHUB_PUBLISHING.md` and
> `docs/HANDBOOK_IMPLEMENTATION_STATUS.md`.

**Document prepared:** July 2026
**Live site:** https://mavennepal.com.np (custom domain, via Cloudflare)
**GitHub repo:** https://github.com/suresguragai10/maven
**Admin panel:** https://mavennepal.com.np/admin/
**GitHub username:** suresguragai10

---

## SECTION 1 — WHAT THIS IS

A professional 11-page static website for Maven Consultancy Services Pvt. Ltd.
with a custom-built CMS (admin panel), automatic deployment via GitHub Actions,
and free hosting via GitHub Pages behind Cloudflare.

**No monthly hosting cost. No third-party CMS subscription. No server to manage.**

### Pages currently live
| Page | URL |
|---|---|
| Home | /index.html |
| About | /about.html |
| Services | /services.html |
| Outsourced Accounting | /outsourced-accounting.html |
| Packages | /packages.html |
| Documents Checklist | /documents-needed.html |
| Industries | /industries.html |
| Useful Links | /useful-links.html |
| Financial Calculators | /calculators.html |
| FAQ | /faq.html |
| Contact | /contact.html |
| Blog (hidden) | /blog.html (not linked in nav — see Section 9) |
| Admin Panel | /admin/index.html |

---

## SECTION 2 — HOW IT WORKS (ARCHITECTURE)

```
You edit text
      │
      ▼
content/site.yaml          ← the single source of truth for all website text
      │
      │  (via admin panel at /admin/, or directly on GitHub)
      ▼
build.js                   ← Node.js script that reads the YAML and generates HTML
      │
      ▼
dist/*.html                ← 11 finished HTML pages (CSS + JS fully inlined)
      │
      │  .github/workflows/deploy.yml  (triggers on every commit to main)
      ▼
GitHub Pages               ← publishes dist/ automatically
      │
      ▼
Cloudflare                 ← your domain mavennepal.com.np points here
                              (SSL, CDN, DDoS protection — all free)
```

**The key safety feature:** if a bad edit breaks the build (e.g. wrong YAML
indentation), the Action fails with a red X and the **live site stays on the
last good version**. Nothing breaks publicly. Fix the error, commit again,
it goes green and deploys.

### Tech stack
- **Build:** Node.js (v24), js-yaml, marked (for blog Markdown)
- **Hosting:** Cloudflare Workers (free)
- **DNS/CDN:** Cloudflare (free plan)
- **Contact form delivery:** Formspree (free, 50 submissions/month)
- **Dependencies:** only 2 npm packages — js-yaml and marked

---

## SECTION 3 — REPOSITORY FILE STRUCTURE

```
maven/ (repo root)
├── content/
│   ├── site.yaml              ← ALL EDITABLE TEXT LIVES HERE
│   └── blog/
│       ├── README.md          ← Instructions for adding blog posts
│       └── *.md               ← Blog posts go here when ready
│
├── admin/
│   └── index.html             ← The custom CMS admin panel (self-contained page)
│
├── .github/
│   └── workflows/
│       └── deploy.yml         ← GitHub Actions: auto-build + auto-deploy
│
├── build.js                   ← Generates all HTML pages from content/site.yaml
├── data.js                    ← Reads and parses content/site.yaml
├── layout.js                  ← Page shell: header, nav, footer, SEO tags
├── pages1.js                  ← Home + About page content
├── pages2.js                  ← Services + Outsourced Accounting + Packages
├── pages3.js                  ← Documents + Industries + FAQ + Contact
├── pages4.js                  ← Useful Links + Blog (hidden)
├── pages5.js                  ← Financial Calculators
├── blog.js                    ← Scans content/blog/*.md, parses Markdown posts
├── icons.js                   ← SVG icon library + the stamp/seal-check motif
├── ui.js                      ← Reusable HTML components (cards, accordions, etc.)
├── styles.css                 ← Full stylesheet (design tokens, layout, responsive)
├── client.js                  ← Browser JS: nav, calculators, form, scroll effects
├── package.json               ← npm scripts + dependency declarations
├── package-lock.json          ← Exact dependency versions (do not edit manually)
├── .gitignore                 ← Tells git to ignore node_modules/ and dist/
└── HANDOVER.md                ← This file
```

**Files you NEVER need to touch for content edits:**
layout.js, pages1–5.js, blog.js, icons.js, ui.js, styles.css, client.js,
package.json, package-lock.json, deploy.yml

**The only file for content:** `content/site.yaml` (via admin panel)

**The only file for blog posts:** `content/blog/your-post.md`

---

## SECTION 4 — HOW TO EDIT CONTENT (DAY-TO-DAY)

### Method A — Admin Panel (recommended)

1. Open https://mavennepal.com.np/admin/
2. Enter your GitHub token (saved in browser if you checked "Remember")
3. Edit any field — changes appear live in the form
4. Click **Save Changes** (top right)
5. Go to https://github.com/suresguragai10/maven/actions
6. Watch the new run — green ✓ = live in about 1 minute

**What you can edit in the admin panel:**
- Brand & Contact (name, phone, WhatsApp, email, address, hours, tagline)
- About (paragraphs, facts, values)
- Services (all 6 categories — titles, taglines, items)
- Outsourced Accounting (title, paragraph, benefits, CTA)
- Packages (names, audience, what's included, fee note)
- Documents Checklist (groups and items)
- Industries (names)
- Useful Links (name, URL, description — add/remove freely)
- Why Choose Us
- Process Steps (titles and descriptions)
- FAQs (questions and answers — add/remove freely)
- Footer disclaimer + partner note
- Contact form dropdown options
- Formspree ID (for contact form email delivery)

### Method B — Direct YAML Edit (backup method)

1. Go to https://github.com/suresguragai10/maven
2. Click `content/site.yaml`
3. Click the pencil (✏️) Edit icon
4. Edit any text **between the quotes** only
5. Historical release step: commit/merge to main only after the current release gate and owner approval
6. Check Actions tab for green ✓

**YAML safety rules:**
- Only change text between `'single quotes'` or `"double quotes"`
- Never change field names (the word before the colon)
- Never change `key:` or `icon:` values
- Keep the same indentation — YAML breaks if spacing is wrong
- The `usefulLinks:` block must stay at the TOP of the file (flush-left)

---

## SECTION 5 — GITHUB TOKEN (ADMIN PANEL ACCESS)

The admin panel uses a GitHub Personal Access Token to read and write
`content/site.yaml` directly. This token never touches any external server —
it goes from your browser straight to GitHub's API.

### If your token expires or stops working:

1. Go to https://github.com/settings/tokens?type=beta
2. Click **Generate new token**
3. Token name: "Maven Website Admin"
4. Repository access: **Only select repositories** → pick `suresguragai10/maven`
5. Permissions → Repository permissions → **Contents: Read and write**
   (leave everything else as "No access")
6. Set expiration: 90 days (or longer)
7. Click **Generate token** — copy the `github_pat_...` string immediately
8. Open the admin panel → paste the new token → check "Remember" → Connect

Tokens expire based on what you set. Set a calendar reminder 1 week before
expiry to renew it. If you forget, just generate a new one with the same steps.

---

## SECTION 6 — CONTACT FORM (FORMSPREE)

The contact form submits to **Formspree** and delivers inquiries directly to
your email inbox.

### If form stops delivering emails:
1. Check https://formspree.io — log in, confirm your form is active
2. Free plan allows 50 submissions/month — upgrade if you exceed this
3. Check your spam folder
4. The Formspree ID is stored in the admin panel under **Brand & Contact →
   Formspree Form ID**. If it's blank or wrong, emails won't send.

### Fallback:
If Formspree fails for any reason, the form automatically falls back to
showing "Send via Email" and "Send via WhatsApp" buttons — so no inquiry is
ever silently lost.

---

## SECTION 7 — DOMAIN AND CLOUDFLARE

**Domain:** mavennepal.com.np
**Nameservers:** Cloudflare (set up July 2026)
**GitHub Pages custom domain:** configured in repo Settings → Pages

### If the domain stops working:
1. Check https://dash.cloudflare.com — log in, check your domain is active
2. Check the CNAME record points to `suresguragai10.github.io`
3. In the repo → Settings → Pages → Custom domain — confirm it shows
   `mavennepal.com.np` and the green "DNS check successful" message
4. SSL certificate is issued by GitHub/Let's Encrypt automatically — if it
   shows as expired, go to repo Settings → Pages → and re-save the domain

### Cloudflare benefits you have for free:
- SSL (https://) — automatic
- DDoS protection
- CDN (faster loading across Nepal and globally)
- Analytics (in your Cloudflare dashboard)

---

## SECTION 8 — FINANCIAL CALCULATORS (TAX RATES NEED YEARLY UPDATE)

The calculators page has four tools:
- **Income Tax** — FY 2082/83 and FY 2083/84 slabs, with deductions and
  female rebate. Updates live as you type.
- **VAT** — 13% add or extract
- **TDS** — 10 common payment types with FY 2082/83 rates
- **Loan EMI** — standard reducing-balance formula

### ⚠️ IMPORTANT — Annual Update Required (every May/June)

Nepal's tax slabs and TDS rates change with each year's Finance Act, announced
with the budget (usually Jestha/May–June).

**When the new budget is announced:**
1. The tax slab table in `client.js` (search for `TAX_TABLES`) needs updating
2. The TDS dropdown in `pages5.js` may need rate updates
3. Ask a developer to make these changes — it takes about 10 minutes

**Current rates in the calculator:**
- FY 2082/83: Individual slabs 1%/10%/20%/30%/36%/39%, couple has higher
  first slab of 6L. SSF contributor waiver on 1% slab.
- FY 2083/84: Unified schedule (no single/couple distinction), slabs
  1%/10%/20%/27%/29% — from the Budget of Jestha 2083, pending gazetted
  Finance Act confirmation.
- TDS rates: Rent to entity 10%, VAT-registered service 1.5%, PAN-only
  service 15%, consultancy 15%, dividend 5% (final), bank interest to
  individual 5% (final), lottery 25%.

All calculators show "indicative only" disclaimers — they are lead-generation
tools that encourage visitors to contact Maven for exact figures.

---

## SECTION 9 — THE BLOG (HIDDEN, READY TO LAUNCH)

A full blog system is built and working but deliberately hidden:
- Not in the navigation menu
- Every blog page has `noindex` meta tag (search engines skip it)
- Reachable only by direct URL: /blog.html

### To add a blog post (without launching publicly):
Create a file in `content/blog/` named `your-post-slug.md` with this format:

```
---
title: "5 Common VAT Filing Mistakes in Nepal"
date: "2026-09-01"
excerpt: "A short summary shown on the blog listing page."
---

Write your post here in normal Markdown.

## A subheading

- Bullet points work
- **Bold** and *italic* work
- [Links](https://example.com) work
```

Commit it → it builds automatically → reachable at `/blog-your-post-slug.html`

### To launch the blog publicly (when ready with 3–4 posts):
Ask a developer to make two small changes:
1. Add `{ key: 'blog', label: 'Blog', href: 'blog.html' }` to the `nav`
   array in `data.js`
2. Remove the `NOINDEX` constant from the build step in `build.js`

This takes about 5 minutes.

---

## SECTION 10 — PHOTOS AND TESTIMONIALS (PLANNED FOR 2–3 MONTHS)

Not yet built. When you're ready, a developer needs to add:

**Testimonials section** — on the homepage, with fields in the admin panel:
client name, business type, quote, star rating. Takes about 2 hours to build.

**Photos** — recommended approach:
1. Upload photos to a `/images/` folder in the GitHub repo (via GitHub web
   UI → Add file → Upload files)
2. Reference the photo URL in the admin panel text field
3. A team photo can go on the About page; testimonial headshots alongside
   each testimonial

Alternative: Use Cloudflare Images (~$5/month) for a true one-panel upload
experience directly from the admin panel. Ask a developer when you're ready.

---

## SECTION 11 — LEGAL / COMPLIANCE WORDING (DO NOT CHANGE)

Maven must NOT be presented as a statutory audit firm, CA firm, or licensed
audit firm. This is a deliberate compliance decision, not an oversight.

**Do NOT add wording like:**
- "statutory audit services"
- "audit certification"
- "CA-certified"
- "licensed audit"
- "we conduct audits"

**Current safe wording already in place:**
- FAQ: "Does Maven provide statutory audit services?" → clearly says No
- Services page: "Support Through Partners" note about coordinating with
  independent licensed professionals
- Footer disclaimer on every page confirming Maven is a consultancy, not
  an audit firm

If you edit these sections, preserve this positioning.

---

## SECTION 12 — DESIGN REFERENCE (FOR ANY FUTURE DEVELOPER)

### Brand colors (CSS custom properties in styles.css)
```css
--navy-950: #0A1F3A   /* darkest navy — hero background */
--navy-900: #102A4C   /* primary navy — nav, footer, dark sections */
--gold-500: #C79A3E   /* warm gold — primary CTA buttons, accents */
--gold-700: #8F6B22   /* deep gold — eyebrow text, links */
--mist:     #F4F6F8   /* light grey — alternating section backgrounds */
```

### Typography
- **Headings:** Source Serif 4 (Google Fonts) — gives an established,
  institutional feel
- **Body/UI:** Source Sans 3 (Google Fonts) — clean, readable
- Both loaded from Google Fonts in the page `<head>`

### Signature motif
A hand-stamped "seal-check" mark (`stampMark()` in `icons.js`) used as:
- List bullets throughout the site
- The hero illustration (the document card with a stamp)
Visual concept: "compliance/document approved" — directly relevant to Maven's
core services.

### Changing colors/fonts
Edit the CSS custom properties at the top of `styles.css` — changing a
variable there updates it everywhere on the site at once.

---

## SECTION 13 — THINGS STILL PENDING / TO DO

### Complete immediately
- [ ] **Facebook and LinkedIn footer links** — currently point to `#`. Replace
      with real profile URLs in `layout.js` (requires a code change, not admin
      panel — ask a developer or find and replace `href="#" aria-label="Facebook"`
      and `href="#" aria-label="LinkedIn"` in `layout.js`)
- [ ] **Real logo** — currently a text "M" mark. If you have a logo file,
      ask a developer to replace it in `layout.js`
- [ ] **Google Map embed** — contact page shows a generic address search.
      Get the exact embed code from your Google Business Profile and replace
      the iframe `src` in `pages3.js`

### In 2–3 months
- [ ] Photos and testimonials (see Section 10)
- [ ] Launch the blog once you have 3–4 posts ready (see Section 9)

### Every year (May/June)
- [ ] Update tax slabs and TDS rates in `client.js` and `pages5.js` after
      the Finance Act is gazetted (see Section 8)

### Token renewal (every 90 days or when set to expire)
- [ ] Renew the GitHub personal access token for the admin panel (see Section 5)

---

## SECTION 14 — TROUBLESHOOTING QUICK REFERENCE

| Problem | Likely cause | Fix |
|---|---|---|
| Actions run fails (red ✗) | YAML syntax error in content/site.yaml (wrong indentation, missing quote) | Click the failed run → build job → read the error line → fix and re-commit. Live site is safe until fixed. |
| YAML error "bad indentation at line X" | A block is indented when it should be flush-left, or vice versa | The `usefulLinks:` block must be at the top of site.yaml with zero spaces before it |
| Admin panel can't connect | Token expired, or wrong repo/username | Generate a new token (Section 5). Check username is `suresguragai10` and repo is `maven` |
| Admin panel "sha conflict" error on Save | site.yaml was changed on GitHub directly while the panel was open | Refresh/reconnect the admin panel to reload the latest version, then re-apply your edit |
| Site shows old content after saving | Browser cache | Open in an incognito window, or press Ctrl+Shift+R. GitHub Pages can take 1–2 minutes to propagate. |
| Contact form not delivering emails | Formspree ID missing, wrong, or monthly limit hit | Check formspree.io → confirm form is active, check the ID in admin panel Brand & Contact |
| WhatsApp buttons open wrong number | WhatsApp digits field has old/wrong value | Admin panel → Brand & Contact → WhatsApp Number (digits only) → update → Save |
| useful-links.html or calculators.html 404 | Old version of build.js or data.js in repo | Confirm pages4.js, pages5.js, and updated build.js/data.js are in the repo root |
| Custom domain not working | DNS not propagated, or CNAME wrong | Check Cloudflare dashboard → DNS tab → CNAME should point to suresguragai10.github.io |
| Blog post not appearing | Wrong folder location | File must be in `content/blog/` NOT `content-blog/` at root |
| Actions tab shows no workflow | deploy.yml not at correct path | Must be at `.github/workflows/deploy.yml` — not `workflows/deploy.yml` |

---

## SECTION 15 — KEY CONTACTS AND ACCOUNTS

| Service | URL | Notes |
|---|---|---|
| GitHub repo | https://github.com/suresguragai10/maven | All website code and content |
| GitHub Actions | https://github.com/suresguragai10/maven/actions | See all build runs |
| GitHub Pages settings | https://github.com/suresguragai10/maven/settings/pages | Domain, deploy source |
| Cloudflare dashboard | https://dash.cloudflare.com | DNS, SSL, analytics |
| Formspree dashboard | https://formspree.io | Contact form, submission logs |
| IRD (for useful links) | https://ird.gov.np | Verify URL is still correct yearly |
| OCR (for useful links) | https://ocr.gov.np | Verify URL is still correct yearly |
| SSF (for useful links) | https://ssf.gov.np | Verify URL is still correct yearly |

---

## SECTION 16 — LOCAL DEVELOPMENT (FOR A DEVELOPER)

If a developer needs to work on this locally:

```bash
git clone https://github.com/suresguragai10/maven.git
cd maven
npm install          # installs js-yaml and marked
npm run build        # reads content/site.yaml, writes 11 pages to dist/
```

Open any file in `dist/` directly in a browser — no local server needed
because all CSS and JS are fully inlined in each HTML file.

To preview changes: edit any `.js` file → run `npm run build` → refresh
the browser. The dist/ folder is git-ignored and rebuilt on every deploy.

**Node.js version:** 24 (as specified in deploy.yml). Works on 20+ too.

---

*End of handover document. Last updated July 2026.*
*If you need to resume work on this site and this document is all you have,*
*everything needed to understand, edit, or extend the site is in these 16 sections.*

---

## SECTION 17 — CLOUDFLARE WORKERS (UPDATED ARCHITECTURE)

**Migrated from GitHub Pages to Cloudflare Workers on July 2026.**

### What changed
- Hosting: GitHub Pages → **Cloudflare Workers**
- Deploy command: `actions/deploy-pages` → **`npx wrangler deploy`**
- Domain management: Manual CNAME → **Cloudflare Workers Custom Domain (automatic)**
- Deploy time: ~90 seconds → **~23 seconds**
- DDoS protection: Basic → **Full Cloudflare proxy (orange cloud)**

### Key URLs
| URL | Purpose |
|---|---|
| https://mavennepal.com.np | Live site (root domain) |
| https://www.mavennepal.com.np | Live site (www) |
| https://mavennepal.com.np/admin/ | Admin panel |
| https://maven.sureshguragain10.workers.dev | Workers.dev fallback URL |

### Cloudflare dashboard
- **Workers & Pages → maven** — see deployments, custom domains, analytics
- **Custom domains:** mavennepal.com.np + www.mavennepal.com.np (both Production)
- DNS is now fully managed by Cloudflare Workers — no manual DNS records needed

### GitHub secrets required
| Secret | Purpose |
|---|---|
| CLOUDFLARE_API_TOKEN | Wrangler deploy permission (Workers Scripts + Workers Routes) |
| CLOUDFLARE_ACCOUNT_ID | Your Cloudflare account: cb020f893fbb0a1575e73e0bbb2284fc |

### If token expires
1. Cloudflare → My Profile → API Tokens → Create Token (Custom)
2. Permissions: Account → Workers Scripts → Edit + Zone → Workers Routes → Edit
3. Zone: mavennepal.com.np only
4. GitHub → repo Settings → Secrets → update CLOUDFLARE_API_TOKEN

### wrangler.jsonc (key settings)
- name: "maven" — must match the Worker name in Cloudflare
- assets.directory: "./dist" — the build output folder
- not_found_handling: "404-page" — shows 404 for missing pages
- The admin panel is copied into dist/admin/index.html during build (see build.js)

### Deploy pipeline
Historical production behavior after an approved release reaches main:
1. npm install
2. node build.js (reads content/site.yaml → generates dist/*.html + dist/admin/index.html)
3. npx wrangler deploy (uploads dist/ to Cloudflare Workers)
Done in ~23 seconds. No stuck deployments possible.
