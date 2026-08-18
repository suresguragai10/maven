# GitHub Publishing - Maven Repository

## Current Maven branch discipline

This repository already exists and has production history. **Do not run the new-repository bootstrap commands for the current Maven project.** During the professional quality pass:

- work/checkpoint on `professional-update`;
- inspect `git status` and the intended diff before every commit;
- run the required syntax/tests/build/local preview gates;
- push accepted checkpoints only to `professional-update`;
- keep `main` untouched until the final owner-approved release gate.

The commands in the next section are retained only for a genuinely new/empty repository scenario.

## New/empty repository bootstrap only

Create an empty repository in the Maven GitHub account/organization. Do not initialize it with a second README if you are uploading this existing repository history as a new project.

From the repository folder:

```bash
git init
git add .
git commit -m "Maven professional quality pass"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

If the repository already exists locally with Git history, do not run `git init` again. Add or confirm the remote, commit the reviewed changes, and push the intended branch.

## Before any release candidate reaches production

```bash
npm ci
npm test
npm run build
npm run test:ui
npm run test:db
```

Run any additional release/cross-browser commands required by the replacement handbook.

## Secrets

Never commit:

- Supabase service-role keys;
- database passwords;
- GitHub PATs;
- credential-encryption passphrases;
- `.env` files containing production secrets.

Use repository/environment secrets in the deployment platform and keep the public browser limited to publishable keys such as the Supabase anonymous key when the application's RLS model is designed for it.

## Multiple website-content admins

Each administrator should use their own GitHub identity/token with only the repository access required for content editing. Do not share one long-lived token among staff. The Website Content Admin and Work Desk operational admin are separate systems by design.
