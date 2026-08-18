# Admin CMS Security (Handbook Task 30)

**Current, authoritative.** How `/admin/` is (and isn't) protected, what changed in Task 30, and what an owner should still set up outside this repository.

## What the admin panel actually is

`/admin/` is a single static page (`admin/index.html` + `admin/admin.js`) with no backend of its own. It talks directly to `https://api.github.com` from the browser, using a GitHub Personal Access Token (PAT) the operator pastes in, to read and commit changes to `content/site.yaml` (and `content/blog/*.md`) on this repository. There is no server-side admin session, no database, and no user accounts — **whoever has the URL and a working PAT can edit the site's content.**

That means this repo's code can only ever be *one* layer of the admin panel's security. The other, equally necessary layer — **deciding who is even allowed to load `/admin/` in the first place** — has to live outside this codebase, because a static site has nothing server-side to enforce it with. See "The identity gate" below.

## Token handling (unchanged by Task 30, verified correct)

- The PAT is kept in `sessionStorage` only (`admin.js`'s own comment: "kept in sessionStorage only, so it's gone as soon as the tab/browser closes rather than sitting in the browser's storage indefinitely"). It is never written to `localStorage`.
- Only `owner`/`repo` (non-sensitive) are remembered in `localStorage` across sessions. Batch 2A moved the selected `branch` to `sessionStorage` with the token so a previous production `main` selection does not silently carry into a later development session.
- **Disconnect clears it completely**: the Disconnect button calls `sessionStorage.clear()` then `location.reload()`, which both wipes the token from browser storage and re-runs the whole script from scratch, clearing it from JS memory (`state.token`) too. There is no code path where a token survives a disconnect.
- **Nothing in `admin.js` logs the token.** There is no `console.log`/`console.error`/`console.warn` anywhere in the file (verified by direct search). `ghApi()`'s error path only ever surfaces GitHub's own JSON error message and HTTP status — never request headers, never the token.
- The token is sent to exactly one destination: `https://api.github.com`, as an `Authorization: token …` header. The admin CSP's `connect-src` (see below) makes any other destination for that header impossible even if a future code change tried to send it somewhere else.

**Residual risk, not eliminated by any of the above**: a PAT sitting in `sessionStorage` is still readable by any JavaScript that manages to execute on this page — i.e. an XSS vulnerability in `/admin/*` would be able to steal it for the lifetime of that tab. The tight CSP (below) is what actually closes that door in practice; token-storage hygiene alone is not a substitute for it.

## Content-Security-Policy for `/admin/*` (unchanged by Task 30, verified still correct)

`build.js` emits a **stricter** CSP for `/admin/*` than the public site gets (see the `adminCsp` block and the surrounding comment in `build.js`):

```
default-src 'self'
script-src 'self' https://static.cloudflareinsights.com
style-src 'self' 'unsafe-inline'
img-src 'self'
connect-src 'self' https://api.github.com https://cloudflareinsights.com
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'self'
```

The reasons this is *tighter* than the public-site CSP, not looser:
- `script-src` has **no `'unsafe-inline'`** — there is no inline `<script>` anywhere in `admin/index.html`; all logic lives in `admin.js`, and `js-yaml` is self-hosted from `node_modules` rather than pulled from a CDN. This means a reflected/stored HTML-injection bug here still can't execute attacker JS without also finding a way around this policy.
- `connect-src` allow-lists only `api.github.com` (plus Cloudflare's own analytics beacon host, which Cloudflare injects into every response regardless of page content) — nothing else this page could be tricked into exfiltrating a token to is even network-reachable.
- `img-src` is `'self'` only (the public site's is `data: https:` to allow admin-entered photo URLs to render on the live site — that's a public-page concern, not an admin-page one).

**Task 30 did not touch this CSP.** Any future change to `admin/admin.js` that needs to talk to a new host must add it explicitly to `adminCsp` in `build.js` — do not loosen `script-src` back to `'unsafe-inline'` or widen `connect-src` to `*` as a shortcut.

## `noindex` is not authentication

`admin/index.html` sets `<meta name="robots" content="noindex, nofollow">`. **This asks well-behaved search engines not to list the page — it does nothing to prevent a human or a bot from loading the URL directly.** Anyone with the exact `/admin/` path can open the connect screen (though without a valid, appropriately-scoped PAT they cannot load or save real content — see below). Treating `noindex` as if it were access control would be a real mistake; it is SEO hygiene, nothing more.

## The identity gate (owner action required, outside this repo)

Because this is a static site with no backend, the *only* way to actually gate who can even reach `/admin/*` is at the hosting/edge layer, in front of the page — not in `admin.js`. **Recommended: Cloudflare Access** (since this site already deploys via Cloudflare Workers/Pages, per `docs/CURRENT_BASELINE.md`):

1. In the Cloudflare dashboard, under **Zero Trust → Access → Applications**, add a **Self-hosted** application scoped to this site's `/admin/*` path.
2. Configure a policy allowing only specific, named email addresses (or a Google Workspace/GitHub/etc. identity provider group) — not "anyone with the link."
3. Cloudflare Access then requires a real login (email OTP, SSO, etc.) *before the browser ever receives `admin/index.html`* — the page and its CSP above become a second layer, not the only one.
4. This is independent of the GitHub PAT: a operator would need to pass BOTH the Access login AND have a valid, correctly-scoped PAT to actually save anything.

Any equivalent identity-aware proxy (Cloudflare Access is recommended here specifically because the site already runs on Cloudflare, avoiding a second vendor) satisfies the same requirement: **authenticate the human before the page loads, don't rely on the page or the PAT alone.**

## Least-privilege, repo-scoped PAT guidance

`admin/index.html`'s own connect screen already walks a new operator through the correct setup (Settings → Developer settings → Personal access tokens → **Fine-grained tokens**), and it already gets the important parts right:

- **Fine-grained token, not classic** — classic PATs can't be scoped to a single repository.
- **Repository access: "Only select repositories"**, pointing at this repo alone — never "All repositories."
- **Repository permissions → Contents: Read and write. Everything else: No access.** — this token cannot touch Issues, Actions, Settings, other repos' Contents, or anything else in the account it belongs to.
- **Set an expiration** (the onboarding suggests ~90 days) rather than "No expiration."

Operator practice this document adds (not enforced by code, since the token is entered fresh each session and never stored server-side):
- Generate a token under an account dedicated to admin editing if more than one person edits content, rather than sharing one operator's personal token — makes `git log`'s commit authorship and any future audit meaningful.
- Rotate/regenerate the token at each expiration rather than extending it indefinitely.
- Revoke a token immediately from GitHub's own token list if a laptop/browser it was pasted into is lost, stolen, or compromised — this repo has no way to force that remotely, since the token isn't stored here.

## What Task 30 actually changed (see `admin/admin.js` for the implementation)

- **`validateContent(content)`**: a structural validation pass that runs entirely before any network request, blocking Save with field-level, actionable errors for empty required brand fields, malformed emails/URLs, invalid Show/Hide values, duplicate or empty identifiers (page keys, fiscal-year keys, package names), malformed arrays, invalid team-photo URLs, and malformed calculator/rate *shapes* (e.g. an "unlimited" tax slab that isn't the last one in its table, which the calculator engine would otherwise silently mis-apply). It never judges whether a value is *correct* — only whether it's well-formed enough not to break the build or the calculators (see `docs/FINANCE_CONTENT_REVIEW.md` for the separate, owner/professional-verification question of rate *accuracy*).
- **Pre-save diff summary**: `computeChangedSummary()` shows exactly which fields changed (e.g. `brand.legalName: "X" → "Y"`) before a save commits, instead of a full YAML dump — capped at 25 lines so it stays a summary.
- **GitHub conflict handling**: a 409 (or 422) response on save — GitHub's signal that `content/site.yaml` changed since this page loaded it — now shows a specific "someone else's changes are newer, nothing was saved" message with an explicit reload action, instead of a generic error. The save is never retried or forced through.
- **Messaging**: "Saved to GitHub" and "deployment not yet confirmed" are now two separately stated facts, never conflated — nothing in this page claims a deploy succeeded, since nothing here checks GitHub Actions' actual run status. Blog post saves always say "saved," never "published," and state the Blog page's current Show/Hide status live at save time.
