# Setting up the CMS on your existing GitHub repo

> **Historical reference — a one-time bootstrap guide, fully
> superseded.** The CMS/admin panel and GitHub Actions deploy pipeline
> described here are long since set up and live; nothing in this
> project currently needs these steps repeated. Kept for historical
> record only (per `docs/CURRENT_BASELINE.md` §8, "safe to archive" —
> not deleted here since it may still have value if the deploy pipeline
> is ever rebuilt from scratch).

This turns your site into: **edit `content/site.yaml` on GitHub → site rebuilds and
goes live automatically.** No Netlify, no separate CMS login — everything stays on GitHub.

## Step 1 — Add these files to your existing repo

1. Unzip `maven-website-source.zip`.
2. Go to your repo on github.com → **Add file → Upload files**.
3. Drag the **whole unzipped folder** (not just individual files) into the upload
   box. Modern browsers (Chrome, Edge, Firefox on desktop) will keep the folder
   structure, including the `.github/workflows/` and `content/` subfolders.
4. Scroll down, commit message like "Add CMS build system", click **Commit changes**.

**If drag-and-drop of a folder doesn't work in your browser:** use "Add file →
Create new file" instead, and for each file below, type the exact path into the
filename box (this auto-creates the folders) and paste in the matching content
from the unzipped folder:
`package.json`, `package-lock.json`, `build.js`, `data.js`, `icons.js`, `ui.js`,
`layout.js`, `pages1.js`, `pages2.js`, `pages3.js`, `styles.css`, `client.js`,
`.gitignore`, `content/site.yaml`, `.github/workflows/deploy.yml`.

## Step 2 — Remove the old flat HTML files (optional but tidy)

The 9 `.html` files you uploaded earlier (index.html, about.html, etc.) are now
generated automatically by the build — you can delete them from the repo root.
If you skip this, it's harmless; they'll just be ignored once Pages switches to
the Actions build below.

## Step 3 — Switch GitHub Pages to "GitHub Actions"

1. Repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, change it from "Deploy from a
   branch" to **GitHub Actions**.
3. Go to the **Actions** tab — you should see a workflow run start automatically
   (triggered by your commit in Step 1). Wait for the green checkmark.
4. Once it's green, your site is live at the same URL as before.

## Step 4 — Edit your content going forward

1. In the repo, open `content/site.yaml`.
2. Click the pencil (✏️) icon to edit.
3. Change any text between quotes — phone number, FAQs, packages, whatever.
4. Scroll down, commit directly to `main`.
5. Check the **Actions** tab: green check = live in ~1 minute. Red X = the site
   did **not** update (your previous version stays live), so it's safe to try
   things — just open the failed run to see what line caused the error.

Everything else (icons, colors, layout, page structure) still lives in code —
if you ever want to change those, come back and ask, or hand the repo to a
developer.
