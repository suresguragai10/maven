# Maven Consultancy Website - Full Audit and Add-on Requirements

> **Historical reference — public-site/CMS scope only, superseded on
> anything to do with Maven Work Desk.** Everything below predates the
> Work Desk staff portal entirely (this audit is about the public
> marketing site's CMS/admin panel). For current, authoritative product
> boundaries, roles, and workflow for `/staff`, see
> `docs/PRODUCT_BOUNDARIES.md`, `docs/ROLE_CAPABILITIES.md`, and
> `docs/WORKFLOW_MODEL.md` (Handbook Task 4).

> **Historical deployment notes below are not current branch instructions.**
> During the professional quality pass, use `professional-update` for reviewed
> checkpoints and leave `main` untouched until the final release gate.

> **Implementation status (2026-07-03):** All requirements in this document have
> now been implemented in the codebase, plus three requested extras (Privacy
> Policy page, contact-form honeypot spam guard, canonical + Open Graph SEO tags).
> Several real bugs found in the original code were also fixed (broken Formspree
> URL, wrong blog folder path, GitHub Pages admin link, hard-coded footer links).
> See `CHANGELOG.md` for the full, verified list of what changed. The notes below
> describe the intended behavior, which now matches the shipped code.

Date: 2026-07-03
Repo base used: `maven-main.zip` cleaned source repo
Deployment target: Cloudflare Workers Static Assets through GitHub Actions

## 1. Executive Summary

The repository is a static Node.js-generated website. The source content lives mainly in `content/site.yaml`, the admin panel edits that YAML file through GitHub's contents API, GitHub Actions builds the site into `dist/`, and Cloudflare deploys the generated `dist/` folder.

The repo is suitable for Cloudflare deployment by GitHub Actions, not GitHub Pages branch deployment. The root HTML files are not required because they are generated during the build.

This update adds requested CMS/admin improvements:

- A tick/check box for each page to hide it from the main website navigation/footer.
- Blog visibility is controlled from the same page list.
- Page hero headings are now editable from the admin panel.
- New Team page.
- New Testimonials page.
- Team and testimonial content editors in the admin panel.
- Fixed Formspree configuration.
- Fixed wrong blog content folder path.
- Added generated `404.html` support.
- Improved GitHub Actions deployment workflow for Cloudflare.

## 2. Important Behavior Notes

### Page hide checkbox

Each page now has a `hidden` checkbox in the admin panel.

When a page is hidden:

- It is removed from desktop navigation.
- It is removed from mobile navigation.
- It is removed from footer quick links.
- It gets `noindex, nofollow` in the generated HTML.
- It is still generated into `dist/` for direct preview and safety, so existing buttons do not immediately break.

This is intentionally safer than deleting the page completely. If you want hidden pages to not be generated at all, that can be added later, but it requires checking all internal buttons/links to avoid dead links.

### Blog

Blog is hidden by default:

```yaml
- key: blog
  label: Blog
  href: blog.html
  hidden: true
```

Untick/hide false from admin when ready to show Blog in the Resources menu.

### Page headings

Page hero heading text now lives under:

```yaml
pageHeaders:
  about:
    eyebrow: About Maven
    title: About Maven Consultancy
    subtitle: A focused, practical consultancy built for startups, SMEs, and growing businesses across Nepal.
```

These fields are editable from admin under **Pages: Hide & Headings**.

## 3. Files Changed or Added

### Added

- `pages6.js`
  - Adds Team page renderer.
  - Adds Testimonials page renderer.
  - Adds 404 page renderer.

- `FULL_AUDIT_AND_REQUIREMENTS.md`
  - This audit and requirements file.

- `content/blog/README.md`
  - Correct blog content folder location.

### Updated

- `admin/index.html`
  - Added page hide checkboxes.
  - Added editable page heading fields.
  - Added Team editor.
  - Added Testimonials editor.
  - Added optional Website URL field for sitemap generation.
  - Updated live-site link behavior to use `brand.siteUrl` if provided.

- `content/site.yaml`
  - Fixed `formspreeId` to only `xgojnjby`.
  - Added `brand.siteUrl` optional field.
  - Added `pages` visibility config.
  - Added `pageHeaders` editable headings.
  - Added `teamMembers` content.
  - Added `testimonials` content.

- `data.js`
  - Builds navigation from CMS page visibility settings.
  - Exports page headings, team members, and testimonials.
  - Supports hidden page checks.

- `layout.js`
  - Footer quick links are now generated from visible navigation.

- `pages1.js`, `pages2.js`, `pages3.js`, `pages4.js`, `pages5.js`
  - Main page hero headings now use CMS-editable `pageHeaders` instead of hard-coded text.

- `build.js`
  - Adds Team and Testimonials pages.
  - Adds generated `404.html`.
  - Applies `noindex` to hidden pages.
  - Generates `robots.txt`.
  - Generates `sitemap.xml` only when `brand.siteUrl` is provided.

- `styles.css`
  - Adds Team and Testimonials card styles.

- `.github/workflows/deploy.yml`
  - Uses `npm ci`.
  - Adds deployment concurrency.
  - Adds build verification.
  - Uses `cloudflare/wrangler-action@v3`.

### Removed

- `outsourced-accounting.html` from repo root.
- Wrong folder `content-blog/`.

Root HTML files should not be committed because they are generated into `dist/`.

## 4. Admin Panel Requirements Implemented

### 4.1 Page hide tick/check box

Location in admin:

```text
Pages: Hide & Headings -> Hide/Show Pages
```

Requirement:

- Each page has one checkbox/tick mark.
- If checked, page is hidden from the main site navigation/footer.
- Blog uses the same mechanism.

Implementation:

```yaml
pages:
- key: blog
  label: Blog
  href: blog.html
  hidden: true
```

### 4.2 Editable page headings

Location in admin:

```text
Pages: Hide & Headings -> Editable Page Headings
```

Editable fields:

- Small Heading / Eyebrow
- Main Heading
- Subtitle

Implementation:

```yaml
pageHeaders:
  services:
    eyebrow: Our Services
    title: Accounting, Tax, Registration & Compliance Services in Nepal
    subtitle: Practical support across six core areas — from first registration to ongoing monthly compliance.
```

### 4.3 Team page

New page:

```text
team.html
```

Location in admin:

```text
Team Page
```

Editable fields:

- Hide this team member
- Name
- Role / Position
- Location
- Short Bio

Data location:

```yaml
teamMembers:
- name: Maven Consultancy Team
  role: Accounting, Tax & Compliance Support
  location: Kathmandu, Nepal
  bio: Add individual team members from the admin panel when you are ready to publish names and roles.
  hidden: false
```

### 4.4 Testimonials page

New page:

```text
testimonials.html
```

Location in admin:

```text
Testimonials Page
```

Editable fields:

- Hide this testimonial
- Client Quote
- Client Name
- Client Role
- Business / Company

Data location:

```yaml
testimonials:
- quote: Add approved client feedback here once you have permission to publish it.
  name: Client Name
  role: Business Owner
  business: Company Name
  hidden: true
```

Default testimonial is hidden so placeholder content does not appear publicly.

## 5. Deployment Audit

### Current deployment approach

The correct deployment flow is:

```text
Historical production-release flow after approval: merge/push the reviewed release to main -> GitHub Actions -> npm ci -> npm run build -> Cloudflare deploy from dist/. Current development checkpoints remain on professional-update.
```

This is correct for Cloudflare Workers Static Assets.

### Required GitHub secrets

Set these in GitHub repository settings:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

### Cloudflare config

`wrangler.jsonc` uses:

```json
"assets": {
  "directory": "./dist",
  "not_found_handling": "404-page"
}
```

This is correct. The build now creates `dist/404.html`.

### GitHub Actions workflow

Workflow now:

- Uses `actions/checkout@v6`.
- Uses `actions/setup-node@v6`.
- Uses Node 24.
- Uses `npm ci`, better for CI than `npm install`.
- Verifies build output exists.
- Uses `cloudflare/wrangler-action@v3`.

## 6. Remaining Optional Requirements

These are not required for launch, but are recommended next.

### 6.1 Cloudflare Access for `/admin/`

The admin panel currently requires a GitHub token, but `/admin/` is publicly reachable. This is acceptable for a simple static admin, but stronger security would be:

```text
Cloudflare Zero Trust / Access rule for /admin/*
```

### 6.2 Image support for Team page

Current Team page uses initials avatars. Later, you can add:

```yaml
photo: /assets/team/name.jpg
```

This requires adding an image upload/management workflow.

### 6.3 Full blog editor

The admin currently edits `content/site.yaml`. Blog posts are Markdown files under `content/blog/`. A future upgrade can add admin support to create/edit/delete blog Markdown posts.

### 6.4 Sitemap live domain

Set this in admin once the final Cloudflare domain is ready:

```yaml
brand:
  siteUrl: https://your-domain.com
```

When `siteUrl` is set, the build will generate `sitemap.xml` with the correct absolute URLs.

### 6.5 Privacy Policy page

Because the contact form collects name, phone, email, and business details, add a Privacy Policy page before running ads or SEO campaigns.

### 6.6 Contact form spam protection

Before public marketing campaigns, add either:

- Cloudflare Turnstile, or
- a hidden honeypot field, or
- Formspree anti-spam settings.

## 7. Testing Completed

### Build test

Command run:

```bash
npm run build
```

Result:

```text
Build passed.
```

Generated files include:

```text
dist/index.html
dist/team.html
dist/testimonials.html
dist/blog.html
dist/404.html
dist/admin/index.html
dist/robots.txt
```

### Visibility test

With Blog hidden:

- `blog.html` is generated.
- Blog is not linked in navigation.
- Blog receives `noindex, nofollow`.

With Team and Testimonials visible:

- `team.html` is generated.
- `testimonials.html` is generated.
- Both appear in the About dropdown.

## 8. Final Recommendation

Use the updated repo as the new source base.

Before live deployment:

1. Set GitHub secrets for Cloudflare.
2. Set final `brand.siteUrl` when domain is confirmed.
3. Add real team members or hide Team page until ready.
4. Add real testimonials only after client permission.
5. Keep Blog hidden until the first real post is added.
6. Use GitHub Actions to deploy to Cloudflare; do not manually deploy generated root HTML files.
