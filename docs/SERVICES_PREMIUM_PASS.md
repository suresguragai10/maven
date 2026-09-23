# Services Premium Pass

Scope: Services page only. The homepage premium pass, Tawk integration, shared navigation, CMS architecture, admin/staff apps, and all other public page layouts remain intact.

## Positioning

The Services page now presents Maven as a connected finance-services firm rather than a catalogue of unrelated tasks. The page is organized around three client needs:

1. Establish & Stay Compliant — registration, tax, payroll
2. Run Your Finance Function — outsourced accounting, bookkeeping, management reporting
3. Advise, Report & Scale — advisory and NFRS / IFRS reporting support

International outsourced finance is presented as a full capability, with clear continuation paths into Remote Accounting Support and Virtual CFO / Management Reporting.

## Visual direction

- Custom two-column finance-led hero with a service architecture navigator
- Responsive hero photography aligned to the existing 640 / 960 / desktop preload strategy
- Editorial chapter layout with one strong image per service group
- Detailed service rows that preserve every existing service item without repeating seven large image cards
- Dark global-outsourcing section to create hierarchy and reinforce international capability
- Cleaner engagement-model section for project, monthly, and specialist work
- Existing reveal motion is reused; no new animation library or scroll-jacking behavior was introduced
- `prefers-reduced-motion` remains respected

## Content / SEO

The Services page header and build metadata were updated to cover finance, tax, accounting, advisory, NFRS / IFRS, and remote international finance delivery while keeping Nepal relevance.

## Professional boundaries

The existing partner / licensing disclosure remains present. The page continues to distinguish Maven's business consultancy and outsourced accounts/compliance role from statutory audit or other regulated professional work.

## Verification performed in this pass

- `node scripts/check-syntax.js`: 111 / 111 passed
- Source/security regression set: 20 / 20 passed
- Services-specific regression tests added
- Generated public `services.html` inspected at desktop and mobile viewports
- Browser layout check: body width equals viewport width at 1440px and 390px (no horizontal overflow)
- Service chapter images verified to load with valid natural dimensions

A complete dependency-backed `npm test` / `npm run build` still requires the repository's npm dependencies. Temporary local review shims used for visual rendering are not part of the final repository.
