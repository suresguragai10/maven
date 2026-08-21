# Maven Public Website Design System

This is the visual source of truth for the August 2026 professional-quality pass. The direction is a premium/traditional consultancy: calm navy, restrained warm gold, editorial whitespace, clear typography, and subtle native motion.

## Brand palette

- Navy Ink: `#102A4C`
- Navy 950: `#0A1F3A`
- Harbor Blue: `#26507E`
- Warm Gold: `#C79A3E`
- Deep Gold: `#8F6B22`
- Mist: `#F4F6F8`
- White: `#FFFFFF`

Gold is an accent for emphasis, icons, key actions, and small proof details. It is not a default section background. Work Desk status colors remain semantic and are not introduced into public marketing sections.

**Surface usage (Task 02)** — every section background on the public site should be a deliberate choice from exactly these four, never a one-off value:
- **White** (`--white`) — the default page/card surface. Most sections.
- **Navy** (`--navy-950`, via `.bg-navy`) — reserved for high-contrast emphasis bands (hero, CTA bands, the International showcase) — never more than one or two per page, or it stops reading as emphasis.
- **Warm-neutral** (`--mist`/`--mist-dark`, via `.bg-mist`) — the quiet alternate-section background used to separate adjacent white sections without a hard border or a shadow; also `--gold-100` for small warm accents (badges, stat highlights), not full sections.
- **Gold** — accent only, as above; a full gold section background does not occur anywhere on the site and should not be introduced.

## Typography

- Display/headings: Source Serif 4, with Georgia/Times fallback.
- Body/UI: Source Sans 3, with system sans-serif fallbacks.
- One `h1` per public page. Section headings use `h2`; card/detail headings use `h3` unless a page's outline requires otherwise.
- Avoid decorative all-caps body copy. Eyebrows are the deliberate exception.

## Spacing and containers

CSS tokens in `styles.css` are authoritative:

- `--space-1` 8px
- `--space-2` 12px
- `--space-3` 16px
- `--space-4` 24px
- `--space-5` 32px
- `--space-6` 48px
- `--space-7` 64px
- `--section-y` 88px desktop
- `--section-y-mobile` 56px mobile
- Main content container: 1180px
- Header wide container: 1400px

Whitespace must communicate hierarchy. Do not keep a large empty grid column simply to make a section taller.

## Radius and elevation

- Standard radius: 12px
- Small controls: 8px
- Large editorial/proof surfaces: 18px
- `--shadow-sm`: quiet separation
- `--shadow-md`: hover/detail elevation
- `--shadow-lg`: rare hero/proof emphasis

Avoid placing every section inside a shadowed card. Use cards only when the content is genuinely a discrete object.

## Capability chapter component (Task 02)

`capabilityChapter()` in `ui.js` — a shared primitive for grouping multiple service categories into one integrated composition (image + chapter label + heading + a short list of real service links + one CTA), instead of a detached photo next to a separate white card.

Three variants, matching the three capability chapters and their distinct visual weights:
- `structured` (Establish & Comply — Business Registration, Tax & Compliance, Payroll): calm, moderate image, plain entry point.
- `feature` (Run Your Finance Function — Outsourced Accounting & Bookkeeping, Financial Management & Reporting): the largest, most prominent treatment.
- `technical` (Advise & Report Better — Business Advisory, NFRS/IFRS Implementation & Financial Reporting): typography-led, most restrained image.

**Wired into Home and Services (Tasks 04–05).** Home uses it as a linked teaser (image + heading + a short list of service links + one CTA per chapter). The full Services page (Task 05) uses it as a chapter intro with no links/cta — each chapter's real individual services follow immediately below as typography-led `serviceEntry()` cards (icon marker + title + tagline + full item list + "Discuss This Service" link, no forced photo per service), preserving every original `services.html#anchor`. The old one-photo-per-service `.service-editorial` row pattern was removed; `serviceCard()` no longer exists.

Image slots use `object-fit: cover` over a flexible-height container, not a fixed crop baked into markup — swapping the current editorial/stock photography for real Maven office/team/working-session photography later only means changing the `image.file` path, never the component or its layout.

## Photography

- Production imagery is local under `/images/`; no random hot-linked web images.
- Service photography is supporting editorial content, not an arbitrary thumbnail decoration.
- Images use stable mappings by service category.
- NFRS/IFRS intentionally uses the reporting image until an approved dedicated asset is supplied.
- Team photos are added only when the owner supplies real staff imagery; public Team data never comes from Work Desk profiles automatically.

## Motion

- Native CSS + IntersectionObserver only; no paid animation dependency.
- Entrance motion is restrained: opacity plus roughly 8-16px translation, currently 12px / 420ms with a calm deceleration curve.
- No scroll-jacking, cursor-follow effects, or continuously bouncing/floating hero objects.
- All important content is visible by default. The reveal CSS is enabled only after observer construction succeeds; initialization failure must fail open.
- Reduced-motion users skip the reveal wait entirely; CSS and JavaScript both respect `prefers-reduced-motion`.
- Micro-interactions belong on real controls (buttons, links, disclosure toggles) and remain small enough not to change layout.

## Footer and responsive rules

- The footer keeps one Maven/company area plus four navigation groups. On desktop the company area has deliberately more reading width; navigation reflows to 4, 2 and 1 columns as space reduces.
- Footer legal/disclaimer wording is not casually rewritten for layout. Constrain readable measure and reduce surrounding dead space instead.
- No horizontal overflow from 320px through desktop widths.
- Floating WhatsApp/Back-to-Top controls respect mobile safe areas and dynamically clear the visible footer instead of covering footer text/actions.
- Service editorial rows collapse to image-above-copy on narrow screens.
- Industry detail renders outside the selector grid so selecting one industry cannot stretch sibling cards.
