# Contact Page Premium Pass — September 2026

## Scope

This pass changes **Contact only**. It uses the premium Home / Services / International / Virtual CFO / NFRS / About repo as the base and does not redesign the remaining public pages, admin panel, or staff portal.

## Design objective

Make Contact feel like the controlled entry point to a professional finance, tax, accounting and outsourced-finance relationship — not a generic form page.

The page now follows this order:

1. Conversation-first hero
2. Clear channel choices: detailed form, WhatsApp, live chat
3. Inquiry/service routing for Nepal, international, and uncertain prospects
4. Detailed inquiry form
5. What happens next / document-handling controls
6. Direct contact and Kathmandu office
7. Final “not sure where to begin?” prompt

## Key implementation decisions

- Preserved every existing contact-form ID and field name used by `client.js` and the Playwright form tests.
- Preserved Formspree submission, honeypot protection, client-side validation, email/WhatsApp fallback, and accessible `role="alert"` error handling.
- Kept the first `.form-hint` as the sensitive-record warning so the existing privacy regression remains valid.
- Tawk is presented as an optional live-chat channel only “when the team is available”; no 24/7 or guaranteed-response claim was introduced.
- WhatsApp is a quick-question channel; the form remains the preferred place for detailed scope.
- Sensitive financial, identity, payroll, bank and tax documents are explicitly excluded from the initial website inquiry.
- The Kathmandu office and office hours remain sourced from `content/site.yaml`.
- The Contact hero uses the same 640 / 960 / desktop responsive image tiers as the build preload strategy.
- No new animation library or runtime dependency was introduced.

## Files changed

- `pages3.js` — Contact page composition
- `styles.css` — Contact-only premium styles and responsive rules
- `content/site.yaml` — Contact hero heading/subtitle
- `build.js` — broader Contact meta description
- `icons.js` — small live-chat/message icon used in the channel panel
- `test/contact-premium-page.test.js` — source-level regression coverage
- `docs/CONTACT_PREMIUM_PASS.md` — this record

## Validation

Final clean-source checks for this pass:

- JavaScript syntax: **118 / 118 passed**
- Premium-page targeted regressions: **41 / 41 passed**
- Full source / SEO / unit suite in the temporary QA build: **111 / 111 passed**
- `content/site.yaml`: parsed successfully
- Contact browser QA: 1440px desktop and 390px mobile
- Horizontal overflow: none observed at both QA widths
- H1 count: exactly 1
- Duplicate IDs: none detected
- Broken loaded local images: none detected

The local browser could not load the external Google Maps iframe during sandbox QA, so map pixels were blank in the QA capture. The map URL, iframe markup and CSP allowance remain unchanged; this was not a layout failure.

## Production verification

On a normal dependency-enabled environment run:

```bash
npm ci
npm run test:syntax
npm test
npm run build
npm run test:ui
```

Then submit a real test inquiry through the Formspree-connected production/staging form and confirm the notification arrives at the intended mailbox.
