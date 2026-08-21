# Content Authority / Resource Strategy (Task 17)

This is a **planning document only** — no blog posts were written, and the Blog page (`content/blog/`, `blog.html`) stays hidden (`content.pages` → `blog.hidden: true`, confirmed unchanged in this task; `test/seo.test.js` protects this). Nothing here should be treated as ready-to-publish copy. Per this task's own instruction, the strategy is **fewer, strong resources — not mass AI SEO publishing**: one flagship brief per topic area below, not a list of thin variations to churn out.

## How to read a brief

Each brief specifies, in order:
- **User question** — the real question a visitor is trying to answer (not a keyword phrase).
- **Search intent** — informational, tool, or commercial, and where it sits in the funnel.
- **Supporting service page** — the one real, already-existing Maven page the post should link to as its natural next step. A brief with no genuine supporting page is a sign the topic doesn't belong on this site yet.
- **Primary authoritative sources needed** — real, named, verifiable sources (mostly the same government/institutional bodies already vetted and linked from `/useful-links`, per Task 08's web-search verification). "None identified yet" is a valid, honest answer where it applies — never filled in with a guessed source.
- **Facts requiring professional verification** — the specific claims in this topic area that must be checked against a primary source (or a licensed professional) before a single word is published. This section exists because of this task's own "do not publish regulatory content without source verification" instruction.
- **Suggested shape** — a rough structural outline, not a draft. Deliberately short.

When any brief below is eventually turned into a real post, follow `content/blog/README.md`'s exact frontmatter format and either the admin panel's "Blog Posts" section or a manual file — both already fully built and working, just currently unlinked from navigation while hidden.

---

## 1. Starting a Business in Nepal

- **User question**: "What do I need to register a company in Nepal, and what's the process?"
- **Search intent**: Informational, early-funnel — someone gathering requirements before they've chosen who to work with.
- **Supporting service page**: `/documents-needed` (the existing checklist page already answers much of this directly) and `/services#establish-and-comply` (the Establish & Comply chapter — registration, tax, payroll).
- **Primary authoritative sources needed**:
  - Office of the Company Registrar (OCR) — `ocr.gov.np` — company registration itself.
  - Inland Revenue Department (IRD) — `ird.gov.np` — PAN/VAT registration.
  - Department of Industry (DOI) — `doind.gov.np` — only if the post covers foreign-investment company setup specifically.
  (All three already verified real and linked from `/useful-links`, Task 08.)
- **Facts requiring professional verification before publishing**: current OCR registration fees, current typical processing time (the site's own existing FAQ estimate — "~7 working days" — is already explicitly hedged as an operational estimate, not a statutory deadline; any blog restatement must keep that same hedge or be re-verified, not stated as fact), which documents are required varies by company type and must not be flattened into one universal list, any recent change to OCR's online filing process.
- **Suggested shape**: what OCR/PAN/VAT registration actually involves in practice, a plain-language walk-through of the general document categories (linking to `/documents-needed` for the real checklist rather than duplicating it), and where Maven's own registration support fits in — not a step-by-step "how to file it yourself" guide, since that would compete with, not support, the actual service.

## 2. Accounting & Bookkeeping

- **User question**: "What accounting records does a small business in Nepal actually need to keep, and how often?"
- **Search intent**: Informational, mid-funnel — a business owner realizing ad hoc record-keeping isn't sustainable.
- **Supporting service page**: `/outsourced-accounting` (Nepal-domestic bookkeeping support).
- **Primary authoritative sources needed**: IRD (`ird.gov.np`) for any record-keeping requirement tied to tax law. Institute of Chartered Accountants of Nepal (ICAN, `en.ican.org.np`) may be cited as general context for professional accounting standards — as a reference only, never implying Maven holds ICAN membership or accreditation (Maven does not represent itself as a CA firm, per the site's existing, unchanged positioning).
- **Facts requiring professional verification before publishing**: any statutory record-retention period, any claim about minimum bookkeeping standards required under the Income Tax Act or VAT Act — none of these are currently sourced anywhere in this codebase and would need real citation before publishing, not assumption.
- **Suggested shape**: practical categories of records a small business should keep (sales, purchases, bank, payroll) in plain language, why monthly (not year-end-only) bookkeeping avoids the most common problems Maven already describes elsewhere on the site (cleanup/catch-up work), and a link into `/outsourced-accounting` for readers who want it handled for them.

## 3. Tax & Compliance

- **User question**: "How is income tax/VAT/TDS calculated in Nepal, and when are they due?"
- **Search intent**: Informational + tool intent — this is exactly what `/calculators` already serves for the computation side.
- **Supporting service page**: `/services#establish-and-comply` (Tax & Compliance) and, critically, `/calculators` — a reader asking "how is my tax calculated" should land on the real, already-built, tested calculator, not a static article trying to restate the same numbers.
- **Primary authoritative sources needed**: IRD (`ird.gov.np`) is the sole authority for VAT/TDS/Income Tax rates and deadlines. This is the **highest-verification-risk topic on this list**.
- **Facts requiring professional verification before publishing**: **every single rate, slab, threshold, and deadline.** `docs/FINANCE_CONTENT_REVIEW.md` (Task 29) already found the site's own FY 2083/84 tax slabs are self-flagged as sourced from a Budget proposal, not yet confirmed against the gazetted Finance Act — a blog post must never restate a number this codebase doesn't already treat as verified, and must never introduce a new number (e.g., a specific TDS rate) that doesn't already exist in `content/site.yaml`'s calculator config. If a rate needs to be quoted, the post should describe it in relation to the live calculator ("see current rates in our calculator") rather than hardcoding a number that can drift out of sync.
- **Suggested shape**: a plain-language explanation of *what* VAT/TDS/Income Tax are and *why* they apply, deliberately avoiding restating specific rates in prose — driving the reader to `/calculators` for the actual numbers, which are the one place on the site with tested, traceable figures.

## 4. Financial Reporting / NFRS

- **User question**: "What is NFRS, how is it different from IFRS, and does my company need to follow it?"
- **Search intent**: Informational, higher-intent — typically a mid/large business or one preparing statements for lenders or investors.
- **Supporting service page**: `/nfrs-ifrs` (already extensively built out, Task 07).
- **Primary authoritative sources needed**: Institute of Chartered Accountants of Nepal (ICAN) — the body responsible for NFRS in Nepal. The IFRS Foundation (`ifrs.org`) as a legitimate, globally recognized reference for what IFRS itself is, since NFRS is based on it — cited as general public information only, with no implied Maven affiliation with either body.
- **Facts requiring professional verification before publishing**: which specific entity types or size thresholds are legally required to adopt NFRS. The site's own existing content deliberately does not state this ("applicability of a particular reporting framework depends on the entity and applicable regulatory requirements and should be assessed for each engagement" — `nfrsIfrs.whoForNote`) — any blog post on this topic must preserve that exact same hedge, not invent a threshold to sound more definitive.
- **Suggested shape**: what NFRS/IFRS implementation actually changes in practice (already well-described in the existing service page's real content — reuse that framing, don't reinvent it), when a business typically starts needing it (lenders, investors, growth — matching the existing site's own framing), and a link into `/nfrs-ifrs` for the full service.

## 5. Finance Management (Virtual CFO / Management Reporting)

- **User question**: "What is a Virtual CFO, and how do I know if my business needs one?"
- **Search intent**: Informational + consideration-stage commercial.
- **Supporting service page**: `/virtual-cfo`.
- **Primary authoritative sources needed**: this is the one topic on this list that is **not** primarily regulatory — it's financial-management practice, not law. No government source is required to describe what management reporting/cash-flow forecasting/budgeting are in general terms.
- **Facts requiring professional verification before publishing**: nothing regulatory, but any specific *statistic* (e.g. "businesses that use management reporting grow X% faster," typical cost-savings figures) must not be invented for this post — either cite a real, checkable source or omit the claim entirely and describe the real service instead.
- **Suggested shape**: the difference between bookkeeping (what happened) and management reporting (what it means going forward) — reusing the site's own existing framing (`virtualCfo.intro` already states this distinction well) — and the four-level model already published on `/virtual-cfo` (bookkeeping → monthly accounting → management reporting → Virtual CFO), which doubles as a natural content outline.

## 6. Finance & Accounting Outsourcing from Nepal

- **User question**: "Why outsource accounting/bookkeeping work to a team in Nepal?"
- **Search intent**: Informational + international B2B commercial — a foreign business or accounting firm researching Nepal as a delivery location.
- **Supporting service page**: `/global-outsourcing` (hub), linking onward to `/international-accounting` and `/virtual-cfo`.
- **Primary authoritative sources needed**: **none identified yet** — this is the one brief on this list without a ready-made authoritative citation. A credible version of this post would likely want to reference real, current data about Nepal's outsourcing/IT-enabled-services sector (talent pool, English proficiency, time-zone position), but no such source has been verified in the course of this task, and per this task's own "do not publish without source verification" instruction, none is guessed here. Before this brief is written, real sourcing research is a prerequisite step, not an assumption to skip.
- **Facts requiring professional verification before publishing**: any claim about Nepal's outsourcing industry size, growth, wage-cost comparison, or talent statistics needs a real, citable source; absent one, the post should stick to describing Maven's own real, already-published capability and client-type framing (`internationalHub`/`internationalAccounting` data — already carefully hedged, e.g. explicitly serving "businesses and accounting firms") rather than making an industry-wide claim.
- **Suggested shape**: framed around Maven's own real, demonstrated capability (the existing "Global Finance Delivery" positioning model, `docs/GLOBAL_POSITIONING_MODEL.md`, Task 14) rather than generic "why Nepal" industry claims this task cannot yet source — the safest version of this brief is Maven-specific, not market-wide.

---

## What this task deliberately did not do

- No blog posts were drafted or published.
- Blog stays hidden (`content.pages` → `blog.hidden: true`) — confirmed unchanged, protected by the existing `test/seo.test.js` "hidden Blog/Testimonials... stay noindexed" test.
- No new external sources were added to `/useful-links` or anywhere else — the sources named above are either already-verified (Task 08) or explicitly flagged as needing research before use (Brief 6).
- No numeric tax/regulatory content was written or implied — Brief 3 explicitly routes around this risk by pointing to the existing tested calculator instead of restating numbers in prose.
