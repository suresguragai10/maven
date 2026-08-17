# Maven Professional Quality Pass — August 2026

This repository contains the first implementation batch from the owner-approved professional redesign. It supersedes earlier product rules wherever they conflict with the decisions below.

## Owner-approved product direction

- Visual direction: premium/traditional consultancy; preserve Maven's existing navy/gold brand palette from the logo/design tokens.
- Market priority: Nepal first. International services remain important but secondary to the Nepal offer on the public home page.
- Disclosures: FAQ, Documents and comparable informational accordions start collapsed.
- Industries: stable card selectors with a separate full-width detail area; no expanding grid cards.
- Dates: Gregorian/English dates only for the Work Desk for now.
- Work Desk: one central **My Tasks** view with All / Client / Firm scope while Client Work and Firm Work keep different business rules.
- Attendance: Punch In, Punch Out, own attendance calendar, monthly summary, CSV export, admin correction with audit reason.
- Attendance privacy: employees and reviewers see only their own attendance; admins can see all. No GPS/location, IP, device, screenshot, presence or productivity tracking.
- Staff: internal Staff Directory + My Profile. Public Team content remains a separate website content model and is not linked to operational staff profiles.
- Admin: public website content remains GitHub-backed; sensitive operational staff/access/attendance administration remains in the Supabase Work Desk. The two admin surfaces are cross-linked, not merged into one data store.
- Blog and testimonials stay hidden until the owner deliberately publishes approved content.
- Dependencies: no paid services required for the redesign. Prefer native CSS/JS and existing project dependencies.

## Brand palette lock

Use the repository's established tokens as the source of truth unless the owner supplies an updated brand guide:

- Navy Ink: `#102A4C`
- Navy 950: `#0A1F3A`
- Harbor Blue: `#26507E`
- Warm Gold: `#C79A3E`
- Deep Gold: `#8F6B22`
- Mist: `#F4F6F8`
- White: `#FFFFFF`

Do not introduce unrelated accent colors for cosmetic novelty. Semantic status colors inside Work Desk are allowed where necessary for errors/success/warnings.

## Implemented in this quality-pass branch

### Public website

- Industries component changed from expandable cards inside a three-column grid to a stable master/detail layout. This removes the tall-row/empty-neighbour defect.
- Main FAQ, Documents and detailed service-support accordions now start collapsed.
- Services page uses alternating editorial photo/content rows with existing local Maven service images rather than another repetitive card grid.
- Home/About composition receives a dark proof panel to reduce empty white-space and improve visual hierarchy.
- Home International section is rebalanced into a two-column showcase with compact proof cards.
- NFRS/IFRS, International Accounting and Virtual CFO heroes reuse appropriate existing local approved images so major service pages do not feel unfinished.
- Reveal-on-scroll is progressive enhancement: content is visible by default and is only hidden for animation after JavaScript successfully enables the reveal system.
- Back-to-top smooth scrolling respects reduced-motion preference.
- Navigation `aria-current` is now assigned to the exact child destination rather than incorrectly claiming the parent overview link is the current page.
- Heading-level corrections were made for standalone Packages, Resources and Useful Links card collections.

### Work Desk

- Sidebar reorganized around Workspace, Client Delivery, Team, Personal, Insights and Administration instead of implementation history.
- `#search` was added to the known route list; the previous sidebar Search route could fall back to Dashboard because it was missing from the route allow-list.
- My Work is presented as **My Tasks**, preserving All / Client / Firm scope.
- New Attendance screen with own Punch In/Punch Out, month selector, metrics, Gregorian calendar, records and CSV export.
- Admin Attendance adds all-staff filtering, monthly summary and correction/add-missing-record UI.
- New internal Staff Directory and My Profile screens.
- Staff & Access page now includes profile fields: full name, designation, work email, phone, Gregorian join date and profile photo URL.
- Public Team and internal staff are explicitly kept separate.
- Website Content Admin is cross-linked from the Work Desk admin section.

### Database

New migration: `supabase/migrations/20260902090000_attendance_and_staff_profiles.sql`

It adds:

- optional staff profile fields;
- self-profile RPC limited to non-privileged fields;
- one attendance entry per user per Gregorian work date;
- server-side Nepal business-date derivation for live punches;
- admin-only attendance correction RPC with mandatory reason;
- immutable correction-history rows;
- RLS so employees/reviewers can read only their own attendance and admins can read all.

No location, IP, device, screenshot or productivity data is stored.

### Admin CMS

- Sidebar regrouped into Site Foundation, Services, International, Trust & Resources and Governance.
- Added section search and active-state treatment.
- Added direct Work Desk link.
- Detailed NFRS/IFRS support areas, statement preparation, policies, management reporting, audit preparation and implementation process are now editable.
- International Accounting firm-support, tools/work environment and start-small blocks are now editable.
- Virtual CFO support areas are now editable.
- Industries Common Needs and How Maven Helps lists are now editable.

## Verification completed in this environment

- `node --check` passed for every project/test JavaScript file after the patch.
- Focused calculator/tax tests: **18 passed, 0 failed**.
- Browser, generated-output and database integration tests could not be fully executed here because the clean `npm ci` dependency install did not complete in this container. This is an environment verification gap, not permission to skip those gates before production.

## Required before deployment

1. On a normal development machine, run `npm ci` successfully from a clean checkout.
2. Run `npm test` and `npm run build`.
3. Install Playwright browsers if needed and run `npm run test:ui` plus the target cross-browser suite.
4. Run `npm run test:db` against the disposable/local DB harness. The new attendance matrix is included in `tests/db/run.js`.
5. Apply the new attendance migration to a test Supabase project first; verify RLS/RPC behavior with employee, reviewer, admin and inactive users.
6. Perform mobile/desktop visual QA at the agreed viewports before production.
7. Only then apply the migration and deploy the tested commit to production.

The replacement implementation handbook delivered with this repository contains the full audit, remaining task sequence, exact Claude/VS Code prompts and release gates.
