# Maven Website Content Admin

**Current operating guide.** The Website Content Admin at `/admin/` edits public website content stored in `content/site.yaml` and selected Blog files through the GitHub Contents API. It is separate from the Supabase-backed Maven Work Desk administration for staff, roles and attendance.

## Current safe workflow

1. Open `https://mavennepal.com.np/admin/` through the production identity gate when it is configured.
2. Enter the GitHub owner, repository, **branch**, and your own fine-grained GitHub token.
3. During the current professional update, use `professional-update`. Do not use `main` for unfinished development or testing.
4. Review/edit content, use the built-in validation, then review the pre-save change summary.
5. Save only to the branch you intentionally selected. A GitHub save is a commit; it does **not** prove deployment succeeded.
6. Use the Actions link to inspect deployment separately. Merge/publish to `main` only after the project release gate and owner approval.

The branch field intentionally has no automatic `main` default. This prevents a development/admin test from silently targeting production.

## Token setup

Use a separate token for each human admin:

1. GitHub -> Settings -> Developer settings.
2. Personal access tokens -> Fine-grained tokens -> Generate new token.
3. Repository access -> Only select repositories -> Maven repository only.
4. Repository permissions -> Contents: Read and write. Leave unrelated permissions disabled.
5. Set an expiration and generate the token.

The token is kept in `sessionStorage` only for the current browser session. It is not stored in `localStorage`; Disconnect clears the session token. Owner/repository may be remembered locally for convenience. The selected branch is session-only with the token, so a previous production `main` choice does not silently carry into a later browser session.

## Security boundary

`/admin/` is a static browser application. A valid GitHub token authorizes GitHub writes; it is **not** an identity gate for loading the page. Production should protect `/admin/*` with Cloudflare Access or an equivalent identity-aware edge gate. `noindex` is SEO hygiene, not authentication.

The Admin and Work Desk remain deliberately separate:

- Website Content Admin: public pages, services, industries, international content, public Team, FAQs/resources, SEO, Blog/Testimonials visibility/content.
- Work Desk Admin: staff/access, attendance, templates and operational settings.
- Public Team content never auto-syncs from internal Staff Directory/Profile records.

See `docs/ADMIN_SECURITY.md` for the detailed security model and `docs/GITHUB_PUBLISHING.md` for branch/release discipline.
