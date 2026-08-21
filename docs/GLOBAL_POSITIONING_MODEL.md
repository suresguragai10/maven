# Global Positioning Model — Nepal → Global Delivery (Task 14)

This is the **one approved positioning model** for how Maven's Nepal-based work relates to its international/remote offering. Its job is to stop claims from drifting between pages — every page that touches the international story should be consistent with the tiers and terminology defined here, not invent its own framing. Cross-reference `docs/SEO_INTENT_MAP.md` (Task 10) for the search-intent side of this same set of pages.

## The model: one foundation, two international tiers, one umbrella term

```
Nepal Foundation (always true, never varies)
  Kathmandu-based team. Real office. No overseas branch.
        │
        ├── Domestic: Nepal Outsourced Accounting
        │   /outsourced-accounting — Nepal-based businesses outsourcing their own books.
        │   Not part of the "international" story below; a separate, Nepal-only audience.
        │
        └── International: "Global Finance Delivery" (the umbrella term for everything below)
            /global-outsourcing — the hub page presenting both tiers together
                │
                ├── Tier 1 — "Remote Accounting Support" /
                │   "Finance & Accounting Outsourcing from Nepal"
                │   /international-accounting
                │   Routine, transactional work: bookkeeping, reconciliation,
                │   accounts payable/receivable, monthly reporting.
                │
                └── Tier 2 — Virtual CFO ("higher-skill," knowledge-process /
                    KPO-adjacent work)
                    /virtual-cfo
                    Analytical, judgment-based work built ON TOP of Tier 1's
                    accounting foundation: management reporting, budgets,
                    cash-flow forecasting, scenario modelling.
```

The real, already-published content on `/international-accounting` (`internationalAccounting.process`, step 6, "Scale When Needed") already states this exact progression — start with Tier 1, expand into Tier 2 — so this model documents an existing, real positioning, not a new one.

## Approved terminology and which page owns it

| Term | Meaning | Owned by | Why substantiated |
|---|---|---|---|
| **Global Finance Delivery** | The umbrella phrase for the whole international offering (both tiers together) | `/global-outsourcing` (hub eyebrow), Home's international section (eyebrow: "Global Finance Delivery from Nepal") | Describes the real structure of the offering (two tiers delivered remotely from one Nepal base); not a claim about scale or credentials |
| **Remote Accounting Support** | Tier 1 specifically — bookkeeping/reconciliation/reporting delivered remotely | `/international-accounting` (eyebrow) | Matches the page's own real, detailed service list (`internationalAccounting.services`) |
| **Finance & Accounting Outsourcing from Nepal** | Broad category phrase for Tier 1 + the hub concept together (also this page's assigned SEO topic target, see `docs/SEO_INTENT_MAP.md`) | `/global-outsourcing` | Matches Task 10's topic-target assignment; describes real geography (Nepal) and real service category (finance/accounting), nothing more |
| **KPO (Knowledge Process Outsourcing)** | Reserved specifically for Tier 2 (Virtual CFO) — analytical/judgment-based work, not routine data processing | `/global-outsourcing` (one clarifying paragraph, hedged), implied by `/virtual-cfo`'s own copy | Virtual CFO's real, already-published scope (management reporting, forecasting, budgets, scenario modelling — see `data.virtualCfo`) is genuinely knowledge-process work, not transactional bookkeeping. **Deliberately not used for Tier 1** — routine bookkeeping/reconciliation is more accurately BPO-style work, and calling it "KPO" would overstate it |

**Deliberate scoping decision**: the word "KPO" was added in exactly one place — a single clarifying paragraph on `/global-outsourcing` that explicitly ties it to the Virtual CFO tier only. It was not added to `/virtual-cfo`'s or `/international-accounting`'s own body copy, since both already have carefully-written, well-hedged copy from earlier tasks; repeating "KPO" on every page would drift toward keyword-stuffing rather than genuine consistency. Consistency here means the *tier model* stays the same everywhere, not that a specific keyword must appear on every page.

## Guardrails (from this task's own DO-NOT list, and already true across the audited pages)

Confirmed already true in every audited page's actual copy — nothing below was added or needed correcting, this section exists to prevent future drift:
- **No overseas offices** — `internationalAccounting.faqs` explicitly states "Our team is based in Kathmandu, Nepal," with international engagements handled via asynchronous communication and scheduled meetings, not a second physical location.
- **No 24/7 coverage claim** — nowhere on any of the four pages.
- **No unsupported jurisdictions claimed** — `internationalAccounting.scopeBoundary` explicitly states Maven does not represent itself as a "locally licensed CPA, tax agent, statutory auditor, attorney, investment adviser or regulated professional in the client's jurisdiction," and that jurisdiction-specific statutory tax filing is the client's own local professional's responsibility.
- **No foreign regulatory authority claimed** — same `scopeBoundary` text.
- **No audit opinions claimed** — same `scopeBoundary` text, plus the site-wide footer disclaimer.
- **No ICAN/GAIN or similar professional-body participation claimed** — not mentioned anywhere; do not add unless Maven genuinely holds that membership/participation and it can be verified.

Any future edit to these four pages should be checked against this table before publishing, not just proofread for tone.

## What changed in Task 14 (for the record)

- `content/site.yaml`: `global-outsourcing.eyebrow` → "Global Finance Delivery"; `international-accounting.eyebrow` → "Remote Accounting Support".
- `pages1.js`: Home's international-section eyebrow → "Global Finance Delivery from Nepal" (was "Nepal Expertise, Global Delivery" — same meaning, now uses the exact approved umbrella term instead of a one-off phrasing).
- `pages2.js`: `globalOutsourcing()` gained one clarifying paragraph distinguishing the two tiers (using existing real facts only) and its CTA-band eyebrow now matches the approved "Global Finance Delivery" term instead of the old "International Services."
- No changes to `virtual-cfo.html` or `international-accounting.html` body copy — both were already accurate and well-hedged; only their eyebrow labels changed for terminology consistency.
