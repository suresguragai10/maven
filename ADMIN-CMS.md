# Your Custom Admin Panel

`admin/index.html` is a self-contained, custom-built content editor for your
site — no third-party CMS, no separate account. It runs entirely in your
browser and talks directly to GitHub using a token only you hold.

## How it works

- You open `https://<yourusername>.github.io/<repo>/admin/`
- Paste in a GitHub token (one-time setup, instructions are on the page itself)
- It loads `content/site.yaml`, shows it as normal text boxes with **Add** /
  **Remove** buttons for lists (FAQs, packages, services, etc.)
- You edit, click **Save Changes** — it commits straight to your repo
- Your existing GitHub Action rebuilds and republishes automatically

## Adding it to your repo

Same as before — either drag the unzipped folder into "Upload files" (make
sure the `admin` folder comes along with it), or use "Create new file" and
type `admin/index.html` as the path, then paste in the file's contents.

## Getting a token (do this once)

Full steps are inside the page under "How do I get a token?" — short version:

1. GitHub → your profile photo → **Settings → Developer settings**
2. **Personal access tokens → Fine-grained tokens → Generate new token**
3. Repository access → **only your site's repo**
4. Permissions → **Contents: Read and write** (nothing else)
5. Set an expiry (e.g. 90 days), generate, copy the token

## On security

- The token goes **only** from your browser straight to GitHub's API — never
  through any third-party server, and never through me.
- Scoping it to one repo with only "Contents: Read and write" means even if
  it leaked, it can't touch your other repos, account settings, or billing.
- The admin page itself is publicly reachable by URL like any other page, but
  it's useless without a valid token, so a random visitor can't do anything
  with it.
- Every save is a normal git commit — fully visible and reversible in your
  repo's history if anything ever looks wrong.
- One trade-off: saving through this panel rewrites `content/site.yaml`
  cleanly, which means the explanatory `#` comments I originally added to
  that file will be replaced (the form itself now guides you instead, so this
  shouldn't matter — but it's normal to see if you peek at the raw file).

## Note on "Remember token on this device"

- Checked → token is saved in this browser's `localStorage` so you won't have
  to paste it in again next time. Convenient, but stays on that device.
- Unchecked → nothing is saved; you re-enter it each visit. More cautious,
  especially on a shared or public computer.
