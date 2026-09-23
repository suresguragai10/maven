# Documents Checklist Premium Pass

Date: 2026-09-22  
Scope: `documents-needed.html` only, plus page-specific metadata, accessibility expectations, documentation and regression coverage.

## Positioning

The Documents Checklist page now works as a **document-preparation and secure-sharing guide** rather than a plain accordion or an implied upload page.

The five existing CMS-managed checklists remain the source of truth:

1. Company Registration Support
2. PAN/VAT Registration Support
3. Monthly Accounting Support
4. Tax Clearance / Return Support
5. Project Report / Loan Report

No checklist item was silently removed or expanded as part of the design pass.

## Page architecture

1. Custom premium photo hero using the existing Documents photography
2. Desktop "Before You Send Anything" readiness panel:
   - Choose the service
   - Confirm the exact list
   - Organize before sharing
   - Use the agreed transfer method
3. "Start With the Requirement" preparation section explaining why the checklist should be narrowed first
4. Three preparation standards:
   - Send only what is relevant
   - Keep records identifiable
   - Protect confidential records
5. Five accessible, collapsed service-specific checklist accordions
6. Dark "Confidential Document Handling" section with a visible website-chat/form warning
7. Final customized-checklist section explaining what information to provide before confidential material is shared

## Confidentiality safeguards

The page now makes the public-site boundary explicit:

- The website is for starting the conversation, not for sending sensitive files.
- Banking, payroll, tax and identity documents should not be sent through general live chat or the general enquiry form.
- Maven should first understand the business/service requirement and confirm the exact list.
- An appropriate transfer method can then be confirmed for the records actually needed.

This is aligned with the existing Contact and Privacy wording and does not promise a specific secure-document platform that is not currently documented in the repo.

## Accessibility

Because the redesigned page now has a real checklist-section `h2`, each accordion item correctly uses an `h3` heading. The shared WAI-ARIA accordion behavior remains intact:

- all five groups start collapsed
- `aria-expanded` changes on the trigger
- `aria-hidden` and `inert` match the panel state
- one click opens and one click closes
- no heading-level skips are introduced

## SEO

Default metadata now uses:

- Title: `Business & Accounting Document Checklists Nepal | Maven Consultancy`
- Description: practical checklists for registration, PAN/VAT, monthly accounting, tax or return support, and project or loan reporting, with secure-sharing guidance.

The page keeps narrow "what documents do I need" intent and remains a spoke under the broader Resources hub.

## Responsive / motion treatment

- Hero uses the existing `documents-needed-hero-bg` 640 / 960 / original image family.
- Desktop shows the four-step readiness panel; mobile intentionally omits that repeated panel so visitors reach the preparation/checklist content sooner.
- Checklist rows preserve icon, category label, title and disclosure control without horizontal overflow.
- Existing reveal motion is reused and respects `prefers-reduced-motion`.
- No animation framework or runtime dependency was added.

## Validation

Clean/source validation during the premium pass:

- JavaScript syntax: **125 / 125 passed**
- Cumulative premium-page regression suite: **94 / 94 passed**
- New Documents-specific regression file: **7 / 7 passed**

Temporary QA build (local dependency placeholders only; removed before packaging):

- Public production build completed
- Full Node source / SEO / unit suite after removing a temporary QA HTML artifact: **164 / 164 passed**
- Generated Documents page: **1 H1**
- Heading-level skips: **0**
- Duplicate IDs: **0**
- Checklist groups: **5**
- Readiness steps: **4**
- Confidential-handling rules: **3**
- Desktop horizontal overflow at 1440px: **0px**
- Mobile horizontal overflow at 390px: **0px**

Live browser interaction QA confirmed the first checklist opens and closes in one click with the correct `aria-expanded`, panel height and `inert` state.

The environment blocks ordinary local-site navigation in the managed Chromium instance, so final browser QA used the generated production HTML/CSS/JS in an isolated local QA shell. Temporary `node_modules`, generated `dist`, QA screenshots, PDFs and dependency placeholders are removed before packaging.
