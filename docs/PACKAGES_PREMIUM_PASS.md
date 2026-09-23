# Packages / Engagements Premium Pass

Date: 2026-09-22  
Scope: `packages.html` only, plus Packages-specific metadata, CMS guidance, documentation and regression coverage.

## Positioning

The Packages page now presents **three engagement starting points** rather than a basic three-card pricing table or a good/better/best ladder.

The commercial logic is:

**understand the need -> review scope drivers -> confirm inclusions -> provide a customized quote**

No fixed prices, fabricated discount claims, popularity labels, or "best value" treatment were introduced.

## Page architecture

1. Custom premium photo hero using the existing Packages photography
2. "How a quote is scoped" panel covering six real fee drivers
3. Three CMS-managed engagement starting points:
   - Startup Setup Package
   - Monthly Compliance Package
   - Business Growth Package
4. Dedicated dark "Scope & Fee" section explaining why fee varies
5. Clear separation of government fees, penalties, official charges, and third-party professional charges
6. Four-step enquiry-to-quote process
7. "Custom Scope" section showing that clients can combine services rather than force-fit a named package
8. Final customized-quote CTA

## CMS preservation

The existing package records remain the source of truth. The page still reads:

- package name
- tagline
- audience
- typical situation
- inclusion list
- fee/scoping note

from `content/site.yaml` through `data.packages` / `data.packagesFeeNote`.

The admin package editor remains intact. Its fee-note label was updated to reflect that the note now appears in the dedicated **Scope & Fee** section.

The premium pass deliberately **did not rewrite the individual service bullets** because wording such as "guidance" vs. "registration support" can change the apparent commercial scope and requires owner approval.

## Pricing / claims safeguards

- Every option uses **Quote after review** rather than an invented number.
- The three options are explicitly described as **not rigid tiers**.
- No option is labelled most popular, recommended, best value, premium, or superior.
- Quote drivers are limited to factors already supported by the existing fee note: transaction volume, employee count, accounts/entities, record quality, reporting complexity, urgency/timing, and overall scope.
- Government fees, penalties, official charges, and third-party professional charges remain visibly separate where applicable.
- Custom-combination examples are labelled examples only; actual inclusions are confirmed during scoping.

## SEO

Default Packages metadata now uses:

- Title: `Accounting Support Packages & Custom Quotes | Maven Consultancy Nepal`
- Description: three flexible starting points for setup, recurring compliance and growth-stage finance support, with custom quotes based on scope, volume, records, reporting needs and timing.

This keeps the page's commercial / pricing intent without implying a fixed tariff.

## Responsive / motion treatment

- Hero uses the existing responsive `packages-hero-bg` 640 / 960 / original image family.
- Two-column hero becomes one column on tablet/mobile.
- The six quote-driver descriptions are intentionally shortened to labels in the mobile hero; full detail remains in the later Scope & Fee section.
- Engagement rows become stacked summaries + scope lists on smaller screens.
- Fee factors collapse 2 columns -> 1 column.
- Quote process collapses 4 columns -> 2 -> 1.
- Existing reveal motion is reused; arrow motion respects `prefers-reduced-motion`.
- No animation library or runtime dependency was added.

## Validation

Clean-source checks before temporary QA dependencies:

- JavaScript syntax: **123 / 123 passed**
- Cumulative premium-page regression suite (after Packages test was added): **82 / 82 passed**
- New Packages regression file: **8 / 8 passed**

Temporary QA build (local dependency placeholders only; removed before packaging):

- Production build completed, including responsive image generation
- Full Node source / SEO / unit suite: **149 / 149 passed**
- Generated Packages page: **1 H1**
- Heading-level skips: **0**
- Duplicate IDs: **0**
- Engagement starting points: **3**
- Fee factors: **6**
- Quote-process steps: **4**
- Custom-combination examples: **4**
- Old `.package-card` components on generated Packages page: **0**
- Missing local links from generated Packages page: **0**
- Desktop overflow at 1440px: **0px**
- Mobile overflow at 390px: **0px**

The system browser blocks local HTTP navigation in this environment, so visual QA used the generated production Packages HTML with the production CSS inlined into an isolated QA shell. The generated responsive hero images were embedded for the layout pass; external scripts were intentionally not executed. Temporary `node_modules`, generated `dist`, QA HTML/screenshots and dependency placeholders are removed before packaging.
