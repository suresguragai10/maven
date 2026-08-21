# Owner Review List (Task 38)

A short, actionable list of technical finance/legal/regulatory statements on the public site and in Work Desk that need an owner or licensed professional's confirmation — produced as part of Task 38's full proofreading pass. **Nothing on this list was changed or rewritten while producing it** — per this task's own instruction, tax, statutory, NFRS/IFRS, qualification, and legal meaning is left untouched here; this is a request for sign-off, not a correction.

Most of these items were already identified in `docs/FINANCE_CONTENT_REVIEW.md` (Task 29) and remain open and unchanged — re-checked against the current `content/site.yaml` while producing this list, confirmed still accurate as descriptions of what's currently published. Two new items (10–11) come from this task's own pass over Work Desk.

## How to use this list

For each item: either (a) confirm the figure/claim is still correct and tell your team so it can be recorded as verified, or (b) supply the correction and the source it came from (Finance Act section, IRD notice, etc.) so it can be recorded, not just fixed silently.

---

1. **FY 2083/84 income tax slabs** (`content/site.yaml` `calculators.taxTables`, key `2083`) — **highest priority**. The site's own text already flags this: sourced from the *Budget* of Jestha 2083, not yet confirmed against the *gazetted* Finance Act. Needs checking before this becomes the active filing year.
2. **FY 2082/83 income tax slabs** (single and couple bands, same block, key `2082`) — no formal record of who verified these against the enacted Finance Act 2082, or when.
3. **Deduction caps** — Retirement NPR 500,000, Life Insurance NPR 40,000, Health Insurance NPR 20,000 (`calculators.deductionCapRetirement/Life/Health`) — confirm against the current Finance Act.
4. **VAT rate — 13%** (`calculators.vatRate`) — confirm this is still the standard rate.
5. **The 11 TDS rates and categories** (`calculators.tdsTypes`) — rent (10%/0%), VAT-registered service (1.5%), PAN-only service (15%), consultancy (15%), commission (15%), royalty (15%), dividend (5%), bank interest (5%), entity interest (15%), windfall/lottery (25%). Each should be individually confirmed against current law, not just as a group.
6. **The NPR 50,000 cumulative-payment contract-TDS threshold** mentioned in `calculators.tdsNote` — a specific rule, not a rate; confirm it's still the correct trigger amount.
7. **The SSF contribution waiver rule** — "contributing to SSF waives only the 1% Social Security Tax on the first income slab" (calculator logic + `pages5.js`) — confirm the rule and whether partial-year contribution still qualifies.
8. **Company registration turnaround estimate** — "Typically around 7 working days once all required documents are provided" (`content/site.yaml` FAQ) — an operational estimate of government processing time, not a legal claim, but worth reconfirming it still matches current OCR practice.
9. **Founder bio tenure claim** — "almost two years providing remote financial reporting support to US-based clients" (`content/site.yaml` `teamMembers`) — confirm the figure is still accurate as time passes.
10. **Attendance page's data-collection claim** (Work Desk, `staff/staff.js`) — "No location, IP, device, screenshot, or presence tracking language appears anywhere on the page" is enforced and regression-tested (Task 30/35/36), but the underlying operational promise — that Work Desk genuinely collects none of that — is a standing commitment to staff, not just a UI label. Worth an owner sanity check that no future integration (e.g. a analytics/monitoring tool) quietly contradicts it.
11. **Client credential vault access claim** — "Portal logins for this client (IRD, OCR, banking, etc.) — visible only to admins and reviewers" (`staff/staff.js`, client detail page). Unlike most items on this list, this one has already been verified at the database level, not just asserted in the UI: Task 37's full DB/RLS regression (`docs/PERMISSION_BASELINE.md`, `client_credentials` section, 13 checks) confirmed this access boundary holds under direct query, role by role. Listed here only so the owner is aware the claim exists and what backs it — no action needed unless the intended access model changes.

## Items checked and found already well-hedged (no owner action needed, listed for completeness)

- The site-wide footer disclaimer and every "not a licensed audit firm / not a CPA / not an investment adviser" statement (repeated consistently across the site) — these are disclaiming statements, not assertions requiring a source.
- NFRS/IFRS applicability language — explicitly says applicability "depends on the entity... and should be assessed for each engagement," makes no blanket claim.
- No CA/ACCA/CPA or other professional-credential claim was found anywhere on the site or in Work Desk (confirmed by repo-wide search, unchanged since Task 29) — flagged as a guardrail: any future copy that adds one needs a real credential behind it first.
- Calculator disclaimers ("estimates only, not tax/legal/financial advice") — correctly worded on all four calculators.

## Structural note carried over from Task 29 (still open, not part of this task's scope to fix)

The public calculators' tax/VAT/TDS figures have no `deadline_rules`-style provenance record (who verified this value, against what source, when) the way Work Desk's statutory deadline system does. This document doesn't change that — noted here as background for whoever picks up items 1–7 above, since recording the answer somewhere durable (not just fixing the number) is the actual gap.

---

No file's tax, statutory, NFRS/IFRS, qualification, or legal content was changed while producing this list.
