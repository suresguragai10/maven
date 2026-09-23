# Resources / Knowledge Hub Premium Pass

Date: 2026-09-22  
Scope: `resources.html` only, plus Resources-specific SEO, CMS guidance, documentation and regression coverage.

## Positioning

The Resources page is now a professional knowledge hub rather than a plain four-card links page. It helps a visitor choose the right kind of resource for the question they have, while keeping a clear boundary between general information and engagement-specific professional judgement.

The public workflow is deliberately simple:

**Prepare -> Calculate -> Verify -> Understand / Discuss**

No new tax rates, filing deadlines, statutory thresholds or legal conclusions were introduced in this pass.

## Page architecture

1. Custom typographic premium hero with a "Resource Desk" panel
2. Four CMS-managed resource destinations mapped to clear use cases:
   - Documents Checklist -> Prepare
   - Financial Calculators -> Calculate
   - Useful Links -> Verify
   - FAQ -> Understand
3. Knowledge Library with "Best for" context and a short limitation note for each destination
4. Dark "How to Use the Hub" workflow: Prepare -> Calculate -> Verify -> Discuss
5. "General Information vs Professional Judgement" section showing when self-service resources are enough and when business-specific context matters
6. Consultation CTA

## CMS preservation

`content.resourcesHub.intro` and all four primary resource tiles remain editable through the existing Website Admin Resources section.

The following stay fixed in code because they are page-governance framing rather than marketing content:

- knowledge workflow labels
- general-information / professional-judgement boundary
- the four fixed internal destinations and their icon mapping

The existing optional Blog behavior is preserved. If Blog remains hidden, no Knowledge Notes card appears. This pass does not publish or unhide Blog content.

## Content safeguards

- Calculators are described as **indicative**, not authoritative determinations.
- The page directs users to official portals where an official source matters.
- Current rates, deadlines, filing obligations and entity-specific treatment are explicitly framed as matters that may need confirmation.
- NFRS / IFRS judgement and cross-border questions are routed toward professional discussion rather than simplified into generic guidance.
- The Resources hero intentionally remains non-photographic; the structured typographic treatment distinguishes the knowledge hub from service pages and does not require a stock image.

## SEO

Default Resources metadata now targets the hub role more directly:

- Title: `Finance, Tax & Accounting Resources Nepal | Maven Consultancy`
- Description: practical finance, tax and accounting resources for Nepal businesses, covering checklists, indicative calculators, official portals and Maven service FAQs

The child resource pages retain their narrower search intent, so the hub does not replace their individual topics.

## Responsive / motion treatment

- Two-column hero becomes one column on tablet/mobile.
- Four resource cards render 2 x 2 on desktop and one column on mobile.
- Four-step workflow collapses from four columns to two and then one.
- Professional-boundary section becomes a single-column reading flow on smaller screens.
- Hover movement and arrow transitions respect `prefers-reduced-motion`.
- No animation library, new photo asset or runtime dependency was added.

## Validation

Clean-source checks before temporary QA dependencies:

- JavaScript syntax: **121 / 121 passed**
- Cumulative premium-page regression suite: **71 / 71 passed**
- New Resources regression file: **8 / 8 passed**

Temporary QA build (local dependency placeholders only; removed before packaging):

- Production build completed, including responsive image generation
- Full Node source / SEO / unit suite: **141 / 141 passed**
- Generated Resources page: **1 H1**
- Heading-level skips: **0**
- Duplicate IDs: **0**
- Primary resource cards: **4**
- Hero resource rows: **4**
- Workflow steps: **4**
- Hidden Blog card leaked into Resources: **0**
- Missing local links from generated Resources page: **0**
- Desktop overflow at 1440px: **0px**
- Mobile overflow at 390px: **0px**

The system-managed browser blocks local navigation in this environment, so the visual QA render used the generated production HTML with its production CSS inlined into an isolated QA shell. External scripts were intentionally not executed for that layout-only pass. Temporary `node_modules`, generated `dist`, QA HTML/screenshots and dependency placeholders are removed before packaging.
