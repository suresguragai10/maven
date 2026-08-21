# SEO Baseline and Search-Intent Map (Task 10)

This is a mapping/analysis document only — **no metadata, copy, or code was changed while producing it.** Its job is to define what each indexable URL should own before any later task rewrites titles, descriptions, or copy, so that work doesn't accidentally create keyword overlap or duplicate intent between pages that should each have one clear job.

## Method

The full indexable inventory below was read directly from `build.js`'s `pages` array (title/description as currently shipped) cross-checked against `data.isHidden()` for each page key. 18 URLs are currently indexable; `testimonials.html` and `blog.html` are `hidden: true` (noindexed, excluded from the sitemap) and are not included below — they carry no search intent to protect until real content exists (per standing rule: never published with placeholder/fake content). `404.html` is intentionally noindexed and excluded. This matches `test/seo.test.js`'s own indexable-page count.

## 1. Full URL inventory and primary intent

| URL | Current `<title>` | Primary job (one sentence) | Nepal/local | Global outsourcing | Informational | Conversion |
|---|---|---|---|---|---|---|
| `/` | Maven Consultancy \| Accounting, Tax & Financial Management | Brand + category entry point — "accounting firm in Nepal" navigational/commercial | Strong | Secondary (one dedicated section, Task 04) | Low | Primary |
| `/about` | About Maven Consultancy \| Business Consultancy in Kathmandu, Nepal | Trust/E-E-A-T — who Maven is, Kathmandu-based | Strong (explicit in title) | None | Medium | Soft |
| `/services` | Accounting, Tax, Registration & Compliance Services in Nepal \| Maven Consultancy | The services **hub** — broad "accounting services Nepal" umbrella, not any one narrow service | Strong | None | Low | Primary |
| `/outsourced-accounting` | Outsourced Accounting Services in Nepal \| Maven Consultancy | "Outsourced accounting Nepal" — for **Nepal-based businesses** who want to outsource their own books | Strong | None (deliberately Nepal-audience only) | Low | Primary |
| `/global-outsourcing` | International Accounting & Finance Support \| Maven Consultancy | The international **hub** — "finance/accounting outsourcing from Nepal," for foreign businesses/accounting firms | Weak (positions Maven as the Nepal-based provider) | Strong, primary | Low | Primary |
| `/international-accounting` | International Outsourced Accounting & Bookkeeping \| Maven Consultancy | Narrower bookkeeping-specific sub-page under the international story | Weak | Strong | Low | Primary |
| `/virtual-cfo` | Virtual CFO & Management Reporting \| Maven Consultancy | "Virtual CFO" — management reporting/forecasting, distinct from day-to-day bookkeeping | Weak | Strong | Low | Primary |
| `/nfrs-ifrs` | NFRS / IFRS Implementation & Financial Reporting Support \| Maven Consultancy | "NFRS" — the one page that owns this term exclusively | Strong | None | Medium (Task 07 restructure added real informational depth) | Primary |
| `/packages` | Accounting & Compliance Packages \| Maven Consultancy Nepal | Pricing/commercial intent — "how much does this cost" | Strong | None | Low | Primary |
| `/documents-needed` | Documents Checklist for Registration, PAN/VAT & Accounting \| Maven Consultancy | Practical tool/informational — "what documents do I need" | Strong | None | High | Secondary |
| `/industries` | Industries We Serve Across Nepal \| Maven Consultancy | Trust/relevance signal across 13 real industries (one page, not 13 doorway pages) | Strong | None | Medium | Soft |
| `/resources` | Resources — Guides, Calculators & Reference Links \| Maven Consultancy | Pure internal-linking hub — no keyword of its own, links to the 4 pages below | Weak | None | Low (hub only) | None |
| `/useful-links` | Useful Links — Nepal Government Portals \| Maven Consultancy | Authority/trust signal (real .gov.np links) + genuinely useful reference, not a ranking target itself | Strong | None | High | None |
| `/calculators` | Free Financial Calculators — EMI, Salary Tax & VAT Nepal \| Maven Consultancy | Tool intent — "EMI calculator Nepal," "income tax calculator Nepal," "VAT calculator" | Strong | None | High | Secondary |
| `/faq` | Frequently Asked Questions \| Maven Consultancy Services | Long-tail question intent, already has `FAQPage` structured data | Medium | Weak | High | Soft |
| `/contact` | Contact Maven Consultancy \| New Baneshwor, Kathmandu, Nepal | Navigational/conversion — bottom of funnel | Strong | None | None | Primary |
| `/team` | Our Team \| Maven Consultancy Services Nepal | Trust/E-E-A-T — a real named person behind the business | Strong | None | Low | None |
| `/privacy` | Privacy Policy \| Maven Consultancy Services Nepal | Legal/compliance page, near-zero commercial intent by design | — | — | — | None |

## 2. Topic-target map

One primary owner per topic from the task's list. Where a topic legitimately appears on more than one page, the split is by **audience or depth**, not duplication — noted explicitly.

| Topic | Primary owner | Notes |
|---|---|---|
| Accounting services Nepal (broad) | `/services` | The umbrella hub; must not be out-competed by any single-service page for this broad phrase |
| Kathmandu accounting/advisory | `/about` | Reinforced site-wide via NAP in footer/contact/JSON-LD, but `/about` is the only page whose title explicitly carries "Kathmandu" |
| Outsourced accounting Nepal | `/outsourced-accounting` | Audience: Nepal-based businesses outsourcing their *own* books |
| Bookkeeping | Split by audience: `/outsourced-accounting` (Nepal clients), `/international-accounting` (foreign clients/accounting firms), `/services#bookkeeping` (umbrella mention only) | Legitimate 3-way split by *who's asking*, not duplication — but only safe if each page's on-page framing keeps stating who it's for |
| Tax & compliance | `/services` (Establish & Comply chapter) | No dedicated tax landing page exists, and per this task's own "do not create mass thin service pages" instruction, none is needed — the topic is real but not large enough to deserve its own URL |
| Business registration | `/services` (Establish & Comply chapter) | Same reasoning — covered, not a gap |
| Payroll | `/services` (Establish & Comply chapter) | Same reasoning — covered, not a gap |
| Financial reporting | 3-way split: `/services` (general/umbrella), `/nfrs-ifrs` (statutory/technical), `/virtual-cfo` (internal management reporting) | The least obvious split on the site — each page must keep its distinct framing (statutory vs. management vs. "we also do this as part of full service") or this becomes real cannibalization |
| NFRS | `/nfrs-ifrs` | Exclusive, no competition anywhere else on the site |
| Virtual CFO | `/virtual-cfo` | Exclusive |
| Finance/accounting outsourcing from Nepal | `/global-outsourcing` | Hub for this phrase |
| International bookkeeping & reconciliation | `/international-accounting` | Retitled in Task 12 to lead with its narrower job — see "Resolved" note below |

## 3. Cannibalization / overlap findings

**Primary finding — `/global-outsourcing` vs. `/international-accounting` — RESOLVED in Task 12.** Their titles used to be near-duplicates:
- `/global-outsourcing`: "International Accounting & Finance Support" (unchanged — this is the intended broad hub title)
- `/international-accounting`: was "International Outsourced Accounting & Bookkeeping" → now **"International Bookkeeping & Reconciliation Services"** (title, H1, cross-link anchor text, and the page's own CTA-band eyebrow all updated for consistency)

Their actual on-page content was never identical — the hub (`/global-outsourcing`) covers the full international story and links out to both `/international-accounting` (bookkeeping-specific) and `/virtual-cfo` (management-reporting-specific), a legitimate hub → spoke structure. The problem was narrower than the content itself: the titles didn't signal that difference to a search engine. Task 12 fixed this by retitling only `/international-accounting` to lead with its actual narrower job (bookkeeping/reconciliation) — no content restructuring, description barely changed (it already led with "bookkeeping, reconciliation").

**Everything else checked and found *not* to be a problem:**
- `/services` vs. `/outsourced-accounting`: standard hub → deep-dive relationship (services.html links out to the dedicated page for its highest-prominence chapter, per Task 05's design) — fine as long as `/services` never tries to independently rank for "outsourced accounting Nepal" specifically.
- `/resources` vs. its four linked pages (`/documents-needed`, `/calculators`, `/useful-links`, `/faq`): `/resources`' title is generic/hub-shaped and doesn't compete with any of their specific terms.
- The 3-way "financial reporting" split (`/services`, `/nfrs-ifrs`, `/virtual-cfo`): distinct enough by framing (general/statutory/management) to not be true cannibalization today, but flagged in the topic-target table above as the one to watch if any of the three ever drifts toward the others' framing.

## 4. KPO terminology guidance

**[STALE — corrected 2026-08-21]** ~~"KPO" is not currently used anywhere on the site.~~ It now appears in `pages2.js:173` (`/global-outsourcing` body copy: "...Virtual CFO support builds on that foundation with higher-skill, knowledge-process (KPO) work..."). This isn't a policy problem — it's exactly the scoped, Virtual-CFO-only usage this section's own guidance below says would be truthful and defensible — but the factual "not used anywhere" claim is now wrong. This section remains useful guidance for whether it could be used elsewhere; it does not currently add the term anywhere beyond that one already-scoped instance.

`/global-outsourcing`'s own existing copy (`data.internationalHub.intro`) already states Maven works with "businesses **and accounting firms**" needing additional finance capacity — serving other accounting firms as a white-label/offshore capacity partner is exactly the Finance & Accounting KPO business model, not an aspirational claim. On that basis, "KPO" or "F&A KPO/outsourcing" would be a **truthful, defensible category label** for `/global-outsourcing`, `/international-accounting`, and `/virtual-cfo` specifically (the three pages whose real, already-stated scope matches it).

It would **not** be honest to use "KPO" in any context that implies audit, assurance, legal process outsourcing, actuarial work, or other licensed/credentialed services — Maven's own existing "Defined Professional Boundaries" language (used consistently across `/nfrs-ifrs`, `/services`) already explicitly excludes those. Any future use of "KPO" must stay scoped to bookkeeping/reporting/management-reporting capacity, matching what those three pages actually describe today.

## 5. Local/entity-signal observation (forward-looking, not actioned here)

"Kathmandu accounting/advisory" local intent is currently carried mostly by `/about`'s title and the site-wide NAP (name/address/phone) in the footer, `/contact`, and the `AccountingService` JSON-LD block (`layout.js` `jsonLd()`). There is no dedicated `LocalBusiness`-flavored signal beyond that. This isn't a defect — the current `AccountingService` schema already includes address/areaServed/telephone — but strengthening local entity signals further (if a later SEO task takes it up) would mean confirming NAP consistency against any external listing (e.g. Google Business Profile) rather than adding new on-site claims. Noting this as an observation for whoever picks up local-SEO work next, not as something this task fixes.

## 6. What was explicitly avoided, per this task's own instructions

- No new pages were created for tax/compliance, business registration, or payroll individually — each is real content already covered within `/services`, and splitting them into separate thin pages would be exactly the "mass thin service pages" this task says not to create.
- No city/location doorway pages (e.g. a separate page per district) were created or suggested.
- No metadata was rewritten and no copy was keyword-stuffed — this document is a map for future work, not an implementation of it.
