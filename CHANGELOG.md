# Change Log — Maven Consultancy Website Update

Date: 2026-07-03
Base: `maven-main` clean source repo
Scope: implemented the requirements in `FULL_AUDIT_AND_REQUIREMENTS.md`, fixed the
real bugs found in the code, and added three professional extras (Privacy Policy
page, contact-form honeypot spam guard, canonical + Open Graph SEO tags).

Every change below was verified with `npm run build` passing and an automated
dead-internal-link check returning zero.

---

## 1. Bugs fixed (these were broken in the original code)

1. **Contact form was silently broken.** `content/site.yaml` stored
   `formspreeId` as a full URL (`https://formspree.io/f/xgojnjby`), but
   `client.js` did `fetch('https://formspree.io/f/' + id)` — producing a doubled,
   invalid endpoint, so every submission fell back to manual send.
   - `site.yaml` now stores the bare ID (`xgojnjby`).
   - `client.js` now accepts either a bare ID **or** a full URL, so it can never
     double the endpoint again.

2. **Blog folder path mismatch.** `blog.js` reads `content/blog/`, but the repo
   shipped the folder as `content-blog/`, so posts added the documented way were
   never picked up. The folder is now `content/blog/` (with its `README.md`).

3. **Admin "View Live Site" link pointed at GitHub Pages**
   (`owner.github.io/repo`) even though the site deploys to Cloudflare. It now
   uses `brand.siteUrl` when set, and hides the link until a domain is configured
   (so it never sends you to a dead URL).

4. **Footer "Quick Links" were hard-coded** and ignored page visibility. They are
   now generated from the visible pages, so hiding a page also removes it here.

5. **Stale duplicate source removed.** The repo contained a nested, older copy of
   the whole project at `maven-website-source/` and stale generated `*.html` files
   at the repo root. Both were removed — the HTML is generated into `dist/` by the
   build, and root HTML should never be committed. Added a `.gitignore` for
   `dist/` and `node_modules/`.

---

## 2. New features (from the audit requirements)

### Page hide / show
- New `pages:` list in `site.yaml`, one entry per page with a `hidden` flag.
- Hidden pages are removed from desktop nav, mobile nav, and footer links, and get
  `noindex, nofollow`.
- Hidden pages are **still generated** into `dist/`, so existing buttons/links
  never break. This is deliberately safer than deleting a page.
- Blog is hidden by default until the first real post is published.
- Editable in admin under **Pages: Hide & Headings → Hide / Show Pages**.

### Editable page headings
- New `pageHeaders:` block in `site.yaml` (eyebrow / title / subtitle per page).
- All page hero headings now read from this instead of hard-coded text
  (`pages1–5.js` updated).
- Editable in admin under **Pages: Hide & Headings → Editable Page Headings**.

### Team page (`team.html`)
- New page rendered by `pages6.js`, with initials-based avatars.
- Content in `site.yaml` under `teamMembers:` (name, role, location, bio, hidden).
- Editor in admin under **Team Page**.

### Testimonials page (`testimonials.html`)
- New page rendered by `pages6.js`.
- Content in `site.yaml` under `testimonials:` (quote, name, role, business, hidden).
- The placeholder testimonial ships **hidden**, so nothing fake appears publicly.
- Editor in admin under **Testimonials Page**.

### Generated files
- `404.html` — styled, with recovery links; served by Cloudflare via
  `wrangler.jsonc` (`not_found_handling: 404-page`). Always `noindex`.
- `robots.txt` — always generated; disallows `/admin/`; references the sitemap
  when a site URL is set.
- `sitemap.xml` — generated **only** when `brand.siteUrl` is set, and lists only
  visible, indexable pages (hidden/noindex pages are excluded).

---

## 3. Professional extras added (requested)

1. **Privacy Policy page (`privacy.html`).** Because the contact form collects
   name, phone, email, and business details, this should exist before ads/SEO
   campaigns. Content is editable in `site.yaml` (`privacyIntro`,
   `privacySections`). Review the wording with a legal professional before major
   campaigns.

2. **Contact-form honeypot spam guard.** A hidden `company_website` field is added
   to the inquiry form. Humans never see or fill it; bots usually do. If it's
   filled, the submission is silently dropped. Zero dependencies, no user friction.

3. **Canonical + Open Graph URL tags.** When `brand.siteUrl` is set, every page
   gets a `<link rel="canonical">` and `og:url` (plus a Twitter card tag). This
   improves SEO and how links look when shared. Nothing is emitted until a domain
   is configured, so there are no wrong URLs in the meantime.

---

## 4. Deployment workflow (`.github/workflows/deploy.yml`)

- Uses `actions/checkout@v6` and `actions/setup-node@v6` (Node 24) with npm cache.
- Uses `npm ci` (reproducible, correct for CI) instead of `npm install`.
- Adds concurrency so only the latest commit deploys.
- Verifies `dist/index.html`, `dist/404.html`, and `dist/admin/index.html` exist
  before deploying.
- Deploys with `cloudflare/wrangler-action@v3` using the existing
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

---

## 5. Files changed

Added: `pages6.js`, `content/blog/README.md`, `.gitignore`, `CHANGELOG.md`.
Updated: `content/site.yaml`, `data.js`, `layout.js`, `build.js`, `client.js`,
`styles.css`, `admin/index.html`, `pages1.js`, `pages2.js`, `pages3.js`,
`pages4.js`, `pages5.js`, `.github/workflows/deploy.yml`.
Removed: `content-blog/` (moved to `content/blog/`), `maven-website-source/`
(stale duplicate), stale root `*.html` files.

---

## 6. Before you go live (checklist)

1. Set the GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. Once the domain is confirmed, set `brand.siteUrl` in the admin (Brand & Contact
   → Website URL). This turns on `sitemap.xml` and canonical links.
3. Add real team members, or hide the Team page until ready.
4. Add real testimonials only after you have client permission (they start hidden).
5. Keep Blog hidden until the first real post exists.
6. Review the Privacy Policy wording; adjust for your exact practices.
7. Deploy via GitHub Actions — never commit generated root HTML.
