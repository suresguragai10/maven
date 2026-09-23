# Calculators Premium Pass

Date: 2026-09-22  
Scope: `calculators.html` only, plus calculator-specific metadata, current-year selection behavior, documentation and regression coverage.

## Positioning

The Calculators page now works as a **professional planning-tools desk** rather than a collection of calculator boxes.

The page keeps four live tools:

1. Salary Income Tax
2. VAT
3. TDS
4. Loan EMI

The design and copy make a clear distinction between an **indicative calculation** and a filing position, tax opinion, payroll decision, or lending decision.

## Page architecture

1. Custom premium photo hero using the existing Calculators photography
2. Desktop "Calculation Desk" panel showing the four available tools
3. Workbench introduction with a prominent **Estimate, then verify** safeguard
4. Existing accessible four-tab calculator interface, visually upgraded but functionally preserved
5. Tool-specific "Useful for / Does not determine" scope guide
6. Dark four-step "Use the Tools Well" workflow:
   - Choose the right period
   - Enter the actual facts
   - Read the breakdown
   - Confirm before acting
7. Final CTA for entity-specific review or professional context

## Calculator-engine preservation

The premium pass deliberately **did not rewrite the calculation engines** in `tax-calc.js` or `calc-utils.js`. Existing DOM hooks, input IDs, output IDs, tab semantics and schedule/breakdown behavior remain intact.

One functional default was corrected: the Income Tax calculator previously opened on a hard-coded older fiscal year even when a newer configured table existed. It now selects the **latest configured tax table** by default. The user can still switch fiscal years explicitly.

No statutory rate, tax slab, VAT percentage, TDS rate, EMI formula, deduction cap or SSF rule was silently changed in this design pass.

## Statutory-data safeguards

- The page no longer describes FY 2083/84 as merely a Budget-stage schedule.
- IRD currently publishes FY 2083/84 natural-person and payment-withholding rate material; this was used only to remove stale publication-status wording, **not** to claim every configured number has been professionally reconciled.
- The former TDS note's specific NPR 50,000 threshold wording was removed rather than leaving an unverified trigger amount in a prominent public note.
- The TDS note now tells users that recipient status, VAT/PAN status, payment nature, thresholds, exemptions and current law can affect treatment.
- `docs/OWNER_REVIEW.md` remains the control list for rate/slab/deduction/SSF verification.

## SEO

Default calculator metadata now uses:

- Title: `Financial Calculators Nepal | Income Tax, VAT, TDS & EMI | Maven Consultancy`
- Description: planning calculators for Nepal covering salary income tax, VAT, TDS and loan EMI, with transparent assumptions, breakdowns and clear estimate-only guidance.

This keeps the page focused on calculator/tool intent rather than trying to rank as a tax-advice landing page.

## Responsive / motion treatment

- Hero uses the existing responsive `calculators-hero-bg` 640 / 960 / original image family.
- Desktop shows the four-row Calculation Desk panel; mobile intentionally hides that repeated panel so users reach the workbench sooner.
- Calculator tabs collapse cleanly into a 2 x 2 arrangement on small screens.
- Existing result cards and breakdown tables remain readable on mobile without horizontal page overflow.
- Existing reveal motion is reused and respects `prefers-reduced-motion`.
- No animation framework or runtime dependency was added.

## Validation

Clean/source validation during the premium pass:

- JavaScript syntax after the new regression file: **124 / 124 passed**
- Cumulative premium-page regression suite: **87 / 87 passed**
- New Calculators regression file: **8 / 8 passed**

Temporary QA build (local dependency placeholders only; removed before packaging):

- Production build completed, including responsive image generation
- Full Node source / SEO / unit suite: **157 / 157 passed**
- Generated Calculators page: **1 H1**
- Duplicate IDs: **0**
- Active default income-tax FY in live browser QA: **FY 2083/84 · 2026/27**
- Tool tabs: **4**
- Scope cards: **4**
- Verification workflow steps: **4**
- Desktop horizontal overflow: **0px**
- Mobile horizontal overflow at 390px: **0px**

Live browser interaction checks confirmed:

- Income Tax recalculates and shows the configured slab breakdown
- VAT recalculates with amount / VAT / total output
- TDS recalculates category rate and withholding amount
- Loan EMI recalculates and enables the amortization schedule control

The environment blocks ordinary local-site navigation in the managed Chromium instance, so final browser QA used the generated production HTML/CSS/JS in an isolated local QA shell. Temporary `node_modules`, generated `dist`, QA screenshots and dependency placeholders are removed before packaging.
