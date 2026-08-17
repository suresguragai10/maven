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

## Photography

- Production imagery is local under `/images/`; no random hot-linked web images.
- Service photography is supporting editorial content, not an arbitrary thumbnail decoration.
- Images use stable mappings by service category.
- NFRS/IFRS intentionally uses the reporting image until an approved dedicated asset is supplied.
- Team photos are added only when the owner supplies real staff imagery; public Team data never comes from Work Desk profiles automatically.

## Motion

- Native CSS + IntersectionObserver only; no paid animation dependency.
- Entrance motion is restrained: opacity plus roughly 8-16px translation.
- No scroll-jacking, cursor-follow effects, or continuously bouncing/floating hero objects.
- All important content is visible when JavaScript fails.
- CSS and JavaScript both respect `prefers-reduced-motion`.

## Responsive rules

- No horizontal overflow from 320px through desktop widths.
- Floating WhatsApp/Back-to-Top controls must respect mobile safe areas and must not cover form actions.
- Service editorial rows collapse to image-above-copy on narrow screens.
- Industry detail renders outside the selector grid so selecting one industry cannot stretch sibling cards.
