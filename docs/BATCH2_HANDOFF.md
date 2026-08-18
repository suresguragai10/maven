# Batch 2 Handoff - Footer, Motion and Public Visual Polish

## Result

**PARTIAL - source implementation complete; real dependency/browser and owner localhost visual verification remain.**

Batch 2 stays deliberately narrow. It does not change Finance/tax/legal content, Supabase schema/RLS, Work Desk business rules, public Team data, or Website Admin publishing rules.

## Implemented

- Rebalanced the shared footer into a wider Maven/company column plus four clear footer navigation groups.
- Reduced excessive footer vertical rhythm, constrained disclaimer measure, and tightened the bottom copyright row.
- Added semantic footer navigation and removed the inline address spacing style in favor of shared CSS.
- Added dynamic footer clearance for WhatsApp and Back-to-Top so fixed controls move above the visible footer instead of covering it.
- Added mobile safe-area handling and kept Back-to-Top secondary with a meaningful scroll threshold.
- Refined reveal motion to a calm 12px / 420ms progressive enhancement.
- Reveal content remains visible when JavaScript is unavailable, reduced motion is requested, IntersectionObserver is unavailable, or observer setup fails.
- Synchronized accordion visual state with `aria-hidden`, retained `inert` while closed, and refined restrained open/close feedback.
- Kept the sticky-header scroll treatment subtle and added restrained button active feedback.
- Added/updated regression coverage for footer structure, floating-control clearance, reveal fail-open/reduced-motion behavior and accordion state.
- Added `docs/IMPLEMENTATION_BATCH_ROADMAP.md` to group the remaining handbook work into controlled future batches.

## Files changed

- `client.js`
- `layout.js`
- `styles.css`
- `ui.js`
- `tests/ui/public/accessibility.spec.js`
- `tests/ui/public/professional-design.spec.js`
- `test/batch2-source.test.js` (new)
- `docs/DESIGN_SYSTEM.md`
- `docs/HANDBOOK_IMPLEMENTATION_STATUS.md`
- `docs/IMPLEMENTATION_BATCH_ROADMAP.md` (new)
- `docs/BATCH2_HANDOFF.md` (new)

## Database / RLS / RPC changes

None.

## Dependency-free verification completed here

- `npm run test:syntax` -> **89 passed / 0 failed**
- `node --test test/batch2-source.test.js test/calc-utils.test.js test/tax-calc.test.js` -> **23 passed / 0 failed**

## Environment-limited verification

This execution environment could not complete a real npm dependency installation within the available network/execution window. A temporary ignored local shim was used only to inspect generated-output compatibility during development; it has been removed and is **not** part of this handoff. Therefore a clean real-dependency `npm test`, `npm run build` and Playwright run are not certified here.

System Chromium also blocked localhost/file rendering by policy, so visual screenshot verification could not be completed here.

## Owner workstation gate before any Batch 2 push

Run the real project dependencies/tests/build on the owner workstation, then inspect localhost at desktop and mobile widths. Specifically verify:

- footer height/composition and legal/disclaimer readability;
- WhatsApp + Back-to-Top never cover footer/form/content;
- Home, Services, Industries, FAQ, About, International and Contact visual rhythm;
- disclosures remain collapsed initially and Industries master/detail remains stable;
- reduced-motion behavior and keyboard focus;
- no horizontal overflow.

Do not push or merge because this source handoff exists. Fix visual/test failures first, then checkpoint only to `professional-update`. Keep `main` untouched until the final release gate.
