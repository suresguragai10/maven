# Finance / Legal / Professional Content Review (Handbook Task 29)

An inventory of every piece of public-site and Work Desk text/configuration that carries financial, tax, legal, regulatory, or professional-credential meaning. **This is an inventory, not a correction pass** — no rate, deadline, or legally sensitive wording was changed while producing this document, per this task's own instruction. Task 27 (proofreading) and Task 28 (business content review) already covered general copy quality and conversion clarity; this document exists specifically so nothing legally sensitive gets touched "because it reads better a different way."

**Ground rule this document itself follows**: every recommendation below is *keep*, *clarify after approval*, *update source*, or *retire* — never a rewritten rate, deadline, or legal claim. Where a primary source isn't already recorded, that's stated as a gap, not filled in with anything looked up here.

---

## How to read the tables

- **Sensitive because** — the specific financial/legal/regulatory reason this needs care.
- **Primary source recorded?** — is there an in-repo record of *where this number/claim came from and who verified it*, or is it a bare value with no provenance trail?
- **Verification needed** — what an owner or licensed professional would need to confirm before this could ever change.
- **Recommended action** — **Keep** (accurate as far as this review can tell, no action), **Clarify after approval** (wording could be tightened but only with owner sign-off), **Update source** (the underlying primary-source record itself needs strengthening, independent of whether the value is currently correct), or **Retire** (not applicable here — nothing found warrants removal).

---

## 1. Tax rate / slab claims

All tax-slab data lives in exactly one place: `content/site.yaml`'s `calculators.taxTables` block (lines 1439–1492), consumed by `tax-calc.js`'s pure slab-math engine and rendered in `calculators.html`'s Income Tax panel. Nothing outside this block contains slab numbers.

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| `content/site.yaml:1446-1459` — FY 2082/83 single-filer bands | 0–500k @1% (SST), +200k @10%, +300k @20%, +1M @30%, +3M @36%, remainder @39% | Directly computes a visible "Total Annual Tax" figure a visitor may treat as filing-ready | **No formal record.** Disclaimer text says "Finance Act 2082" (`taxTables[0].disclaimer`, line 1443-1445) but there is no dated, named, linkable citation anywhere in the repo — compare to Work Desk's `deadline_rules`, which requires `source_title`+`verified_date`+`verified_by` for every rule (see §9). | Owner/professional confirmation these bands still match the enacted Finance Act 2082, not a superseded draft. | **Update source** — record what was actually checked and when (see §9 recommendation), independent of whether the numbers themselves are currently right. |
| `content/site.yaml:1460-1473` — FY 2082/83 couple bands | 0–600k @1% (SST), +200k @10%, +300k @20%, +900k @30%, +3M @36%, remainder @39% | Same as above | Same as above | Same as above | Same as above |
| `content/site.yaml:1480-1492` — FY 2083/84 single-filer bands (no couple table: `couple: []`) | 0–1M @1% (SST), +500k @10%, +1M @20%, +1.5M @27%, remainder @29% | Same as above | **The site's own copy already self-flags this one as unconfirmed**: `incomeTaxFYHint` (line 1433-1435) says "FY 2083/84 slabs are per the **Budget** of Jestha 2083 — verify against the **gazetted Finance Act**" — i.e. this is explicitly sourced from a Budget proposal, not yet confirmed against enacted law, in the site's own words. | **Highest-priority item in this review**: confirm the FY 2083/84 gazetted Finance Act matches the Budget figures currently configured, before this FY becomes the active filing year. | **Clarify after approval / update source** — this is the one rate set this document actively flags as self-admitted-unverified, not just "no formal record." Needs an owner/professional check against the gazetted Act, then a recorded verification (see §9). |
| `content/site.yaml:1436-1438` — deduction caps (Retirement NPR 500,000, Life NPR 40,000, Health NPR 20,000) | Fixed NPR amounts | Directly reduces the computed taxable income | No formal record — `admin.js:1034-1036` hints say "usually... check the Finance Act" but nothing records that anyone did. | Confirm caps against current Finance Act. | Update source. |
| `test/tax-calc.test.js` (18 tests) | N/A — validates arithmetic, not law | **Important distinction this task asked for explicitly**: these tests prove `computeSlabs()` correctly applies whatever bands it's given (e.g. "income spans 3 slabs" math is right) — they say nothing about whether the *configured* FY 2082/83 / FY 2083/84 bands themselves are the legally correct current rates. A green test suite is not evidence of rate accuracy. | N/A (engine, not data) | N/A | **Keep** — the tests are doing their actual job correctly (engine correctness). No action; this row exists to make the distinction explicit, per this task's own instruction. |

## 2. VAT / TDS treatment

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| `content/site.yaml:1390` — `vatRate: 13` | 13% | Nepal's standard VAT rate, used in every VAT calculation shown | No formal record — `admin.js:1041` hint: "Currently 13% in Nepal. Update if the Finance Act changes it." | Confirm still the standard rate. | Update source. |
| `content/site.yaml:1394-1427` — 11 TDS types with rates (10%, 0%, 1.5%, 15% ×5, 5% ×2, 25%) | See table in yaml | Determines how much a visitor is told to withhold from a real payment — an incorrect rate here has real compliance consequences for whoever acts on it | No formal record — `tdsNote` (line 1428-1432) cites "Income Tax Act 2058 / Finance Act 2082" collectively, not per-type. | Confirm each of the 11 rates individually against current law — some (e.g. the NPR 50,000 cumulative-payment contract-TDS threshold mentioned in `tdsNote`) are threshold rules, not flat rates, and need separate confirmation. | Update source — and consider whether per-type sourcing (not just one blanket note) is warranted given 11 distinct rates are being asserted at once. |
| `content/site.yaml:1400` — "rent to an individual landlord is generally exempt (local rent tax may still apply separately)" | Qualified/hedged claim | A visitor could misapply this if their situation differs from "individual landlord" | Same blanket `tdsNote` sourcing as above | Confirm the exemption condition is stated precisely enough (e.g. does "individual" exclude sole proprietorships?). | Clarify after approval — professional review of the precise wording, not a rewrite here. |

## 3. Filing / statutory deadline claims

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| Work Desk `deadline_rules` table (`supabase/migrations/20260824090000_deadline_governance.sql`) | **No hardcoded value exists anywhere in code.** Every filing deadline used by generation traces to a `deadline_rules` row requiring `source_title`, `verified_date`, `verified_by` — enforced server-side by `add_deadline_rule()`, not just a UI convention. If no verified rule exists for a service, the computed date is left `NULL` and visibly flagged "Requires verification," never guessed. | This is the one area of the whole site/app that was *already* built exactly the way this task asks everything to be. | **Yes, by construction** — the mechanism itself IS the source-recording system. | This review cannot confirm the **current live data state** (which templates have an active rule vs. still show "Requires verification") from a static repo checkout — that's a live-database question. | **Keep the mechanism as-is.** **Owner action needed**: check the Templates page live and confirm every service flagged `requires_external_deadline` actually has a current, correctly-sourced active rule — this was flagged as unconfirmed after Task 12 shipped and remains unconfirmed here. See `docs/FINANCE_RULE_GOVERNANCE.md` for the full mechanism. |
| Public FAQ, `content/site.yaml:1109-1113` — "Typically around 7 working days" for company registration | ~7 working days, hedged ("depends on government office processing time") | Not a *statutory* deadline (it's Maven's own service-delivery estimate of government processing time), so it sits just outside this document's core scope — flagged in `docs/BUSINESS_CONTENT_REVIEW.md` (Task 28) instead, cross-referenced here for completeness. | N/A — operational estimate, not a legal claim | Confirm the estimate is still realistic. | See Task 28's report — not duplicated as a Finance/legal item here since it isn't one. |

## 4. SSF / payroll statutory claims

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| `content/site.yaml` calculator: `tax-ssf` checkbox / `isSSF` waiver logic | "I contribute to SSF (Social Security Fund)... Waives only the 1% Social Security Tax on the first income slab" (`pages5.js:121-123`) | Asserts a specific tax-mechanics rule (SSF contribution waives the 1% SST band) | Same blanket sourcing as the tax tables (§1) — no dedicated citation for this specific waiver rule. | Confirm the waiver rule and its scope (e.g. does partial-year SSF contribution still waive it?) against current law. | Update source. |
| `content/site.yaml:8-10` — Useful Links SSF entry: "Mandatory employer and employee registration for payroll and social security benefits" | Describes the SSF portal's purpose, not a Maven-asserted rate | Low sensitivity — this describes what the *government* portal does, not a Maven claim about a rate or obligation amount | N/A (factual description of a third-party portal) | None beyond confirming the portal description is still accurate. | Keep. |
| No SSF/payroll contribution *percentage* (e.g. an employer/employee SSF contribution rate) is asserted anywhere on the public site or in Work Desk seed data (confirmed by repo-wide search — none found). | — | — | — | — | Keep — nothing to source because nothing is claimed. |

## 5. NFRS / IFRS claims

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| `nfrs-ifrs.html` page (`content/site.yaml` NFRS block, ~lines 182-437) | Extensive service-description content (assessment, transition, technical accounting, statement prep, policy documentation, audit-prep coordination) | Could be read as implying Maven certifies NFRS/IFRS compliance | **Explicitly self-limited, repeatedly**: "Defined Professional Boundaries" (`whyChoose`, line 411-415) and `auditPrep.note` (line 333-338) both state Maven does not issue statutory audit opinions or represent itself as an audit firm; `whoForNote` (line 391-393) states framework applicability "depends on the entity and applicable regulatory requirements and should be assessed for each engagement" — no blanket applicability claim is made. | None — this page does not assert *which* entities are legally required to report under NFRS/IFRS, it correctly defers that to case-by-case assessment. | **Keep** — this is a well-hedged page; no unsupported claim found. |

## 6. Audit / assurance wording

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| `content/site.yaml:1140-1145` — **site-wide footer disclaimer** (every page) | "Maven is not a licensed audit firm, bank, lender, or investment adviser, and does not provide statutory audit, legal, certification, or investment advice." | The single most-repeated regulatory-positioning statement on the site — appears on every one of the 18 indexable pages via the shared footer | N/A — this is a negative/disclaiming statement (what Maven does *not* do), not a factual claim requiring a primary source. | Confirm it remains an accurate description of Maven's actual service scope (i.e. Maven still does not perform statutory audits). | Keep. |
| `content/site.yaml:576-586` — International Accounting "Clear Professional Scope" | "Maven does not represent itself as a locally licensed CPA, tax agent, statutory auditor, attorney, investment adviser or regulated professional in the client's jurisdiction." | The most detailed scope-boundary statement on the site, aimed at foreign clients | Same as above (disclaiming statement) | Same as above | Keep — see also `docs/BUSINESS_CONTENT_REVIEW.md`'s cross-cutting finding #1: this is a genuine strength worth preserving verbatim. |
| `content/site.yaml:333-338` (NFRS auditPrep.note), `content/site.yaml:1098-1101` (FAQ Q1) | "Maven does not present itself as a statutory audit firm... Where licensed audit or certification is required, clients must work with an independent licensed professional." | Same disclaiming pattern, repeated for consistency across pages | N/A | Confirm consistency across all instances (spot-checked in this review — all instances found are consistent with each other; no contradiction found anywhere on the site). | Keep. |
| `pages2.js:27` | "Maven positions itself as a business consultancy and outsourced accounts/compliance partner — not as a statutory audit firm or CA firm." | Hardcoded in JS (not CMS-editable via admin panel, unlike most copy) | N/A | If this wording ever needs to change, note it requires a code change, not an admin-panel edit — flagging the location for whoever next touches it. | Keep — correct as a disclaiming statement; noting only that it's not CMS-editable like its YAML-sourced counterparts. |

## 7. CA / accountant / professional-qualification wording

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| Repo-wide search for CA/ACCA/CPA/"chartered accountant"/"qualified accountant" claims | **No instance found anywhere that claims Maven or any team member holds a CA/ACCA/CPA credential.** Every match found (`content/site.yaml:579`, `pages2.js:27`) is a *disclaiming* statement ("not a... CA firm," "does not represent itself as a locally licensed CPA"), never a credential claim. | This is a genuinely clean result — worth recording explicitly so a future edit doesn't accidentally introduce an unverifiable credential claim (e.g. adding "Our CA-qualified team..." to Team bios without an actual credential to back it). | N/A | None currently — this is a "nothing to flag" finding. | **Keep.** Recorded here as a guardrail: any future Team-page or marketing copy that adds a professional-credential claim (CA/ACCA/CPA/etc.) must have an actual, verifiable credential behind it before publishing — this document is the place to update if that ever happens. |
| Team page bio (`content/site.yaml:1334-1344`) — "almost two years providing remote financial reporting support to US-based clients" | Experience narrative, not a credential claim | Specific, unverifiable-by-a-visitor tenure claim | Team content — explicitly out of scope for this task to edit (per Task 28's handling of the same finding) | Owner confirmation the tenure description is accurate. | Not a Finance/legal item per se (no rate/regulatory content) — cross-referenced from `docs/BUSINESS_CONTENT_REVIEW.md`, not duplicated as an action item here. |

## 8. Regulatory authority claims

| File/field | Current value | Sensitive because | Primary source recorded? | Verification needed | Recommended action |
|---|---|---|---|---|---|
| No instance found anywhere on the public site or Work Desk of Maven claiming to *be* a regulator, or claiming authority to approve/certify/license something on a government body's behalf. | — | Would be a serious overreach if it existed | — | — | Keep — nothing to flag. All "regulatory" mentions found (`content/site.yaml` industry cards, FAQ, disclaimers) consistently describe Maven *coordinating with* or *deferring to* regulators/licensed professionals, never claiming their authority. |
| `content/site.yaml:1-16` — Useful Links page descriptions of IRD/OCR/SSF/NRB | Factual descriptions of what each government body does | Low sensitivity — describes external bodies' roles, not Maven's | These are publicly known government-agency mandates | Spot-check the descriptions remain accurate if any of these bodies' mandates change | Keep. |

## 9. Finance Act / Budget year references

Every Finance Act/Budget/Income Tax Act year citation on the entire site is contained within the `calculators` YAML block (`content/site.yaml:1428-1492`) — confirmed by a repo-wide search, nothing found outside this block:

| Reference | Location | Recommended action |
|---|---|---|
| "Finance Act 2082" | `taxTables[0].disclaimer` (line 1443-1445), `tdsNote` (line 1429) | Update source (§1, §2) |
| "Income Tax Act 2058" | `tdsNote` (line 1429) | Update source (§2) |
| "Budget of Jestha 2083" | `incomeTaxFYHint` (line 1434), `taxTables[1].disclaimer` (line 1478) | **Highest priority** — this is the self-flagged "verify against the gazetted Finance Act" item (§1) |

**This containment is itself a positive finding**: legally-sensitive year citations are not scattered across marketing copy — they live in exactly one governed data block, making a future annual update a single, findable place to work from (`content/site.yaml`'s `calculators:` key, or the admin panel's "Tax & Calculator Rates" section).

## 10. Calculator legal assumptions / disclaimers

| Disclaimer | Location | Assessment |
|---|---|---|
| "These tools give quick estimates for planning purposes only — they are not tax, legal, or financial advice." | `pages5.js:312` (bottom of Calculators page) | Correctly worded, but see the visual-hierarchy concern already raised in `docs/BUSINESS_CONTENT_REVIEW.md` (Task 28): a large, prominent computed number sits far above this small-print disclaimer — a design issue, not a wording issue, so not duplicated as an action item here. |
| Per-FY disclaimers ("Estimate only, based on FY 2082/83 resident salary slabs... For accurate filing, get in touch.") | `taxTables[*].disclaimer` | Correctly hedged. |
| VAT note: "Whether VAT applies depends on registration status and the nature of goods/services." | `content/site.yaml:1391-1393` | Correctly hedged — doesn't assert VAT universally applies. |
| TDS note: rates change with each Finance Act, confirm with Maven before deducting | `content/site.yaml:1428-1432` | Correctly hedged. |
| EMI note: "Indicative only — actual EMI may differ based on your bank's method, fees, and rate changes." | `pages5.js:278` | Correctly hedged — EMI math is pure arithmetic (not statutory), lowest-risk of the four calculators. |

**Distinguishing "engine correctness" from "data correctness" (explicitly requested by this task)**:
- `tax-calc.js` (income tax slab math) and `calc-utils.js` (VAT add/extract, EMI amortization) are pure functions — given a set of bands/rates, they compute correctly. `test/tax-calc.test.js` (11 tests) and `test/calc-utils.test.js` (7 tests) — 18 total, all passing — verify exactly this: the **arithmetic** is right for whatever numbers it's fed.
- **None of those 18 tests, and nothing else in this repo, verifies that the currently-configured FY 2082/83 / FY 2083/84 tax bands, the 13% VAT rate, the 11 TDS rates, or the 3 deduction caps are themselves the legally correct figures for their respective periods.** That is a fact about the world (Nepal tax law), not about the code, and this document's own instructions correctly prohibit treating a green test suite — or this review's own research — as authority for that fact.
- **Recommendation**: before each new fiscal year's calculators go live (or whenever a Finance Act changes a rate this site uses), an owner or licensed professional should verify the specific configured values against the gazetted Finance Act and record that verification somewhere durable — see the next section for why this doesn't yet exist for calculator data the way it does for Work Desk deadlines.

---

## The one structural gap this review found

**Work Desk's `deadline_rules` table (Task 12) requires a `source_title` and `verified_date`/`verified_by` for every statutory deadline before it can be used — enforced by the database, not just process. The public calculators' tax/VAT/TDS rates (`content/site.yaml`'s `calculators` block) have no equivalent mechanism** — they're plain YAML numbers, editable via the admin panel's "Tax & Calculator Rates" section with only a text hint reminding whoever edits them to "check the Finance Act." Nothing records *whether* anyone did, *when*, or *against what source*.

This is a real asymmetry: the calculators are arguably the highest-visibility financial content on the site (a visitor sees a large computed "your tax" number), yet carry the weakest provenance trail of anything reviewed in this document.

**This document does not implement a fix** — that would mean either building new governance tooling (a scope decision, not a proofreading-adjacent task) or asserting values are "verified" without an actual owner/professional check (exactly what this task prohibits). Recommending it as a candidate for a future task: e.g. a simple dated `# Verified against <source>, <date>, by <name>` comment convention directly above each `taxTables`/`vatRate`/`tdsTypes` block in `content/site.yaml`, reviewed each time the Finance Act changes — lighter-weight than a full `deadline_rules`-style table (site.yaml isn't a live database), but still gives every rate a visible, checkable provenance trail the way deadline rules already have.

---

## Summary table (every item, one line each)

| # | Category | Item | Source recorded? | Action |
|---|---|---|---|---|
| 1 | Tax slabs | FY 2082/83 single/couple bands | No formal record | Update source |
| 1 | Tax slabs | FY 2083/84 single bands | **Self-flagged unverified** (Budget, not gazetted Act) | **Clarify/update source — highest priority** |
| 1 | Tax slabs | Deduction caps (retirement/life/health) | No formal record | Update source |
| 1 | Engine | `tax-calc.js` + 18 passing unit tests | N/A (engine, not data) | Keep |
| 2 | VAT | 13% rate | No formal record | Update source |
| 2 | TDS | 11 rate types | Blanket citation only, not per-type | Update source |
| 3 | Deadlines | Work Desk `deadline_rules` mechanism | **Yes, by construction** | Keep mechanism; owner must confirm live data state |
| 4 | SSF | 1% SST waiver rule | No formal record | Update source |
| 5 | NFRS/IFRS | Applicability + scope claims | Self-hedged, case-by-case | Keep |
| 6 | Audit | Footer + page disclaimers ("not an audit firm") | N/A (disclaiming, not asserting) | Keep |
| 7 | CA/credentials | No credential claims found anywhere | N/A | Keep (guardrail recorded) |
| 8 | Regulatory authority | No overreach claims found anywhere | N/A | Keep |
| 9 | Finance Act refs | All contained in one YAML block | See §1/§2 | See §1/§2 |
| 10 | Calculator disclaimers | All four calculators correctly hedged | N/A | Keep (visual-hierarchy note cross-referenced to Task 28) |
| — | **Structural gap** | Calculator rates lack `deadline_rules`-style provenance | **No** | **Candidate for a future task** — not implemented here |

No file was edited to produce this document.
