# International Accounting Premium Pass

Scope: **International Accounting / Remote Accounting Support page only**. The premium Home, Services and Global Outsourcing pages, Tawk integration, shared navigation, CMS architecture, and admin/staff areas remain intact.

## Positioning

This page is now the operational proof page for Maven's international accounting offer.

- **Remote Accounting Support** remains the service label.
- The page is aimed at **international businesses and accounting/bookkeeping firms** that need recurring accounting capacity.
- Maven remains explicitly **Kathmandu-based**.
- The page focuses on bookkeeping, reconciliations, schedules, month-end support and recurring reporting rather than broad outsourced-finance positioning already owned by `/global-outsourcing`.
- Virtual CFO / Management Reporting remains the next-level analytical service rather than being blended into day-to-day bookkeeping.

## What changed

1. Replaced the generic shared sub-page hero with a dedicated remote-accounting hero and recurring-accounting-cycle panel.
2. Added a concise proof strip covering recurring work, visible review points, existing systems and the two client audiences.
3. Rebuilt the service scope into three operating groups: keep the books current, support the operating cycle, and close/report the period.
4. Added a dedicated monthly-delivery section separating source system, processing, internal review, exceptions, reporting and client review.
5. Separated **monthly work cycle** from **relationship onboarding** so visitors do not see two conflicting step-by-step stories.
6. Added a clear onboarding model covering current setup, scope, access, first cycle and later expansion.
7. Added distinct pathways for international businesses and accounting/bookkeeping firms.
8. Added a dedicated systems, access, confidentiality and professional-responsibility section.
9. Kept the existing regulated-professional boundary text intact and prominent.
10. Added a “start with a defined scope” section plus a clear continuation path into Virtual CFO / Management Reporting.
11. Updated the H1/subtitle and meta description to strengthen remote-accounting and Kathmandu positioning without duplicating the Global Outsourcing hub.

## Visual direction

- Premium navy/gold hero with an operational accounting-cycle panel rather than a generic marketing card.
- Editorial two-column scope and onboarding sections.
- Dark monthly-cycle section to make the delivery process feel controlled and deliberate.
- Restrained bordered matrices, numbered steps and small finance icons instead of a wall of identical service cards.
- Existing reveal/stagger motion only; no new animation library or dependency.
- Mobile layout reviewed as a separate composition, with all multi-column matrices collapsing cleanly.
- Hero image tiers match the site's existing 640 / 960 / desktop preload strategy.

## Professional guardrails retained

The redesign does **not** claim:

- an overseas office or branch;
- 24/7 coverage;
- foreign CPA / tax-agent status;
- statutory audit authority;
- jurisdiction-specific tax, legal, investment or other regulated-professional authority.

The page keeps Maven's current statement that jurisdiction-specific regulated work remains with appropriately authorized professionals in the client's jurisdiction.

## Validation

- JavaScript syntax check passes.
- Dedicated page regression tests cover positioning, workflow separation, responsibility boundaries, responsive image tiers and mobile composition.
- Visual QA was performed at 1440px desktop and 390px mobile widths using the generated page markup and production CSS.
- Both reviewed widths had `scrollWidth === clientWidth` (no horizontal overflow).
- The generated page contains exactly one H1.
