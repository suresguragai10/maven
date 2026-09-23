# Team Premium Pass

Date: 2026-09-22  
Scope: `team.html` only, plus Team-specific SEO, documentation and regression coverage.

## Positioning

The Team page is now a professional-services trust page rather than a simple people grid. It presents Maven as a Kathmandu-based finance and accounting team with complementary experience across accounting, tax, audit, banking, risk, compliance, reporting and business advisory.

The page keeps Maven's operating base explicit. A team member may be personally located outside Nepal, but the page does not treat that location as a Maven overseas office.

## Page architecture

1. Premium hero with team-operating model and clear Kathmandu/remote-delivery facts
2. Three complementary capability perspectives: accounting/compliance delivery, audit/risk/control perspective, and business/management perspective
3. Founders section based only on published role fields
4. Wider Advisory & Client Delivery profile grid
5. Full supplied biographies preserved in accessible native `details` disclosures
6. Working Standards section covering scope, review, exception handling and access discipline
7. Kathmandu operating-base / remote-collaboration section
8. Consultation CTA

## Profile handling

- All 7 visible Team profiles from `content/site.yaml` are retained.
- The premium pass does not invent qualifications, certifications, locations or experience claims.
- Four profiles currently use real supplied photographs.
- Profiles without photography use the existing initials fallback; no stock portraits were added.
- Long biographies show a concise first-sentence lead and preserve the remaining supplied text in an expandable `details` element.
- Display numbering follows visual order `01` through `07`; it is not a ranking.

## Claim / governance safeguards

- Maven's operating office remains stated as Kathmandu, Nepal.
- Remote advisor/client collaboration is not described as an overseas office network.
- No 24/7, guaranteed-outcome or global-office claims were added.
- Existing qualification/certification wording remains owner-supplied content and should be supported by current records before future edits are published.
- `docs/BUSINESS_CONTENT_REVIEW.md` and `docs/FINANCE_CONTENT_REVIEW.md` were updated because their older one-member/no-credential notes no longer matched the current seven published profiles.

## Responsive / motion treatment

- Hero follows the existing 640px / 960px / original desktop image strategy.
- Founder cards become one-column on tablet/mobile.
- Wider profile grid collapses from 3 columns to 2 and then 1.
- Profile-image hover motion, disclosure arrows and text-link movement respect `prefers-reduced-motion`.
- No animation library or new runtime dependency was added.

## Validation

Clean source checks before temporary QA dependencies:

- JavaScript syntax: 121 / 121 passed
- Premium-page targeted regression suite: 63 / 63 passed
- New Team regression file: 8 / 8 passed

Temporary QA build (local dependency placeholders only; not for production packaging):

- Full Node source / SEO / unit suite: 133 / 133 passed
- Production build completed and generated responsive image variants
- Generated Team page: 1 H1
- Heading-level skips: 0
- Duplicate IDs: 0
- Published profile cards: 7
- Founder cards: 2
- Profile disclosures: 7
- Display indexes: 01 through 07
- Missing production local image references: 0
- Desktop overflow at 1440px: 0px
- Mobile overflow at 390px: 0px

Temporary `node_modules`, generated `dist`, local QA HTML/screenshots and validation shims are removed before packaging.
