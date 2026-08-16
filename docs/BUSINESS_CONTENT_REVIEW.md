# Business Content Review (Handbook Task 28)

A page-by-page review of all 18 indexable public pages, read as a prospective customer and as the owner of an accounting/consultancy firm. This is a conversion/content map, not a copy-editing pass — Task 27 already handled objective proofreading; this task looks at whether each page's *content* does its job.

**Excluded** (not indexable): `testimonials.html` and `blog.html` are both CMS-flagged `hidden` (noindex, no nav link) because they have no real content yet — correctly left alone, not reviewed here. `404.html` is a system page.

**Severity scale**: **P0** — actively confusing or risks a wrong impression; fix soon. **P1** — a real gap or inconsistency worth closing. **P2** — worth polishing, not urgent. **P3** — cosmetic/minor.

**What this task implemented directly** (small, unquestionably safe, no substantive-claim changes — see "Fixes implemented this task" at the end) vs. **what it only flags** (anything touching a claim, a number, Team/Testimonial content, or Finance/legal wording — per this task's own DO NOT list, those are proposed here for owner approval, not changed).

---

## Cross-cutting findings (apply across multiple pages)

1. **International-outsourcing scope-of-work language is a genuine strength, not a gap.** `international-accounting.html`, `virtual-cfo.html`, and `nfrs-ifrs.html` all carry explicit, repeated "this is what Maven does, this is what your own licensed local professional retains" disclaimers (`international-accounting.html`'s "Clear Professional Scope" block, `virtual-cfo.html`'s "we do not provide investment advice or make decisions on behalf of the business," `nfrs-ifrs.html`'s "Defined Professional Boundaries"). This is exactly the kind of trust-building precision a foreign client evaluating an outsourced Nepal-based team needs, and it's already well-built. No action needed — flagged here so the owner knows it's a strength worth preserving verbatim in future edits, not trimming as "too much legal boilerplate."
2. **Internal consistency between nav/footer labels — one real duplication found and fixed.** `data.js`'s nav had two different dropdown items (`outsourced-accounting.html` and `international-accounting.html`) both literally labeled "Outsourced Accounting & Bookkeeping." Fixed this task by reusing the footer's own already-established "International Accounting" label for the second one — no new wording invented, just made two already-existing labels agree instead of three different labels for one page. See "Fixes implemented."
3. **Contact-page phone/email were not clickable.** Fixed this task — pure `tel:`/`mailto:` markup, no visible text changed. See "Fixes implemented."
4. **Services page said "six core areas" but renders seven service categories.** A stale count left over from before the 7th category (NFRS/IFRS) was added. Fixed this task — the Home page's own stat row already independently confirms "7 · Service categories," so "seven" is the objectively correct number, not a new claim.
5. **Specific, memorable numbers appear in a few places that are Finance/legal-adjacent and were deliberately NOT touched, per this task's own rules**: FAQ's "typically around 7 working days" for company registration, the Team page's "almost two years providing remote financial reporting support to US-based clients," and Privacy Policy's "stored securely" (no stated security measure). These are flagged per-page below with **owner input required**, not edited.
6. **Team page's "team" (plural) framing vs. one configured member.** The hero subtitle says "A grounded, Kathmandu-based **team** supporting businesses..." while exactly one team member is currently configured. This may be intentional (more members planned), so — per this task's explicit instruction not to touch Team content planned for later admin updates — this is flagged only, not changed.

---

## 1. Home (`index.html`)

**Current purpose**: the front door — establish who Maven is, what it does, and route visitors into the right service/page fast.

1. **Intended visitor**: any prospective client landing cold — a startup founder, an SME owner, or (via the International section) a foreign business/accounting firm.
2. **Problem/question**: "Who is Maven and can they handle my accounting/compliance/tax needs in Nepal?"
3. **What Maven offers**: correctly summarized across 6 core service categories + a dedicated International section + Packages + Industries — a genuinely representative front-page menu, not oversimplified.
4. **Evidence/trust present**: `trustBar` (5 checkmark claims, all provable/verifiable, e.g. "Registered private limited consultancy," "Based in Kathmandu"), a stat row (Founded 2022 / 100+ clients / 13 industries / 7 service categories), and an 8-item "Why Choose Maven" list (6 shown). All of this is consistent with what's stated on About and elsewhere — no contradiction found.
5. **Next action**: extremely clear — "Book Free Consultation" / "View Services" / WhatsApp, repeated at nearly every section boundary. No ambiguity.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None structural. The page does its job — it's long but every section earns its place (each maps to a real page, not filler). | — | — | — |
| Packages section subtitle ("no fixed one-size-fits-all pricing") reads slightly defensive/generic. | P3 | Optional: could be tightened, but it's accurate and not misleading. Leaving as-is is fine. | none — style preference only |

---

## 2. About (`about.html`)

**Current purpose**: build trust in the "who" behind the services — humanize a small consultancy, differentiate from "a large impersonal firm."

1. **Intended visitor**: someone who's already interested (from Home/Services) and wants to know if Maven is credible/trustworthy before reaching out.
2. **Problem/question**: "Is this a real, established, trustworthy business, or a one-person side hustle?"
3. **What Maven offers**: this page under-lists services compared to Services page — `aboutText` describes them in prose ("business setup, accounting, tax, compliance, financial management and reporting, payroll, project report, and advisory services") rather than the 7 named categories. That's fine for an About page (it's not meant to be the service catalog) but worth noting for internal consistency purposes only.
4. **Evidence/trust present**: same `aboutFacts` stamp list as Home (founding year, clients served, coverage) plus a 5-item Values list (Accuracy, Confidentiality, Timely service, Professional communication, Ethical practice) with specific, non-generic supporting text for each (e.g. Confidentiality: "shared only with the people directly working on your file"). This is good — values claims are backed by a concrete behavioral description, not just adjectives.
5. **Next action**: "Book a Free Initial Consultation" / "Contact Maven Today" — clear.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| No structural issues found. Page is honest about scale ("We are a focused, growing consultancy — not a large firm, and we don't try to be") — this reads as a strength (sets accurate expectations) rather than a weakness. | — | — | — |

---

## 3. Services (`services.html`)

**Current purpose**: the actual service catalog — the page every other page's service links point back to.

1. **Intended visitor**: someone actively comparing "does Maven do X" against their specific need.
2. **Problem/question**: "What exactly does Maven do, in enough detail that I can tell if it fits my situation?"
3. **What Maven offers**: all 7 categories with taglines and 5-8 bullet items each — appropriately detailed, not vague.
4. **Evidence/trust present**: a partner-note disclaimer ("For services requiring licensed legal, audit, or specialized professional approval, Maven can help clients organize documents and coordinate with independent licensed professionals") — same honest-scoping pattern as the international pages. Good consistency.
5. **Next action**: "Book a Free Initial Consultation" / "Get a Customized Document Checklist" — clear, and the second CTA is a smart bridge to a genuinely useful next step rather than just repeating "contact us."

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Subtitle said "six core areas," page renders seven categories. | **P1** | Fixed this task (`content/site.yaml`: "six" → "seven"). | none — objective count correction, already implemented |
| No CTA/link exists directly on any individual service card (cards are static on this page, unlike Home's clickable version). A visitor reading the "Payroll & Salary Support" card, say, has no direct "ask about this" path except scrolling to the bottom CTA band. | P2 | Consider a per-card link/anchor, matching the pattern already used on Industries cards ("Ask About This Industry"). This is a real, defensible UX improvement but changes page structure — proposing for owner approval, not implementing (borderline "small fix" but touches every one of 7 cards' markup and is closer to a design decision than a copy correction). | Owner approval to add per-card CTAs (no new claims involved, just an interaction-design change) |

---

## 4. Packages (`packages.html`)

**Current purpose**: give a shape to "how much" without publishing fixed prices — 3 tiers to anchor expectations.

1. **Intended visitor**: someone past "does Maven do this" and now asking "roughly what tier am I."
2. **Problem/question**: "What would I actually get, and how do the options differ?"
3. **What Maven offers**: 3 clearly differentiated tiers (Startup Setup / Monthly Compliance / Business Growth) with 5-8 bullets each, escalating in scope logically.
4. **Evidence/trust present**: a fee-transparency note ("Government fees, penalties, official charges, and third-party professional charges are billed separately") — this is good, prevents a bill-shock complaint later. No pricing numbers are shown anywhere, consistently.
5. **Next action**: "Enquire About This Package" per card, "Get a Customized Quote" at the bottom — clear.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Package bullet wording drifts from the Services page's fuller category names for the same underlying work (e.g. "PAN/VAT guidance" here vs. "PAN registration support" + "VAT registration support" as two separate Services-page bullets; "VAT/TDS support" here vs. "VAT return preparation support"/"TDS/e-TDS support" on Services). | P2 | Align package bullet wording with Services-page terminology where they describe the same deliverable, OR keep package bullets deliberately shorter by design (packages are meant to summarize, not itemize). Not obviously wrong either way. | **Owner input required** — this is a scope/wording judgment call, not a proofreading fix: "guidance" reads lighter-touch than "registration support," and changing it could imply a scope change to a paid package. Flagged, not touched. |

---

## 5. Industries (`industries.html`)

**Current purpose**: let a visitor self-identify ("that's my kind of business") and see industry-specific proof Maven understands their situation.

1. **Intended visitor**: someone who wants to see their own business type reflected back, not generic accounting-firm language.
2. **Problem/question**: "Does Maven actually understand businesses like mine, or is this generic?"
3. **What Maven offers**: 13 industries, each with a tailored description + expandable "common needs" and "how Maven helps" lists using industry-specific vocabulary (e.g. Construction: "retention tracking"; Restaurants: "daily sales and payment-channel reconciliation"). This is genuinely well done — it does NOT read as generic boilerplate reworded 13 times.
4. **Evidence/trust present**: implicit only, via specificity of the industry knowledge shown — no stat row or trust bar on this page, which is fine (Home/About already carry those).
5. **Next action**: "Book a Free Initial Consultation" / "View Services," plus a per-card WhatsApp CTA once expanded — good, industry-specific enough to feel personal.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. This is one of the stronger pages on the site — specific without inventing unverifiable claims. | — | — | — |

---

## 6. Outsourced Accounting (`outsourced-accounting.html`)

**Current purpose**: the **Nepal-domestic** "hire us instead of a full-time in-house accountant" pitch — distinct from the international-facing outsourcing pages.

1. **Intended visitor**: a Nepal-based business owner weighing outsourced monthly bookkeeping vs. hiring staff.
2. **Problem/question**: "Is outsourcing actually cheaper/easier than hiring, and what does the month-to-month process look like?"
3. **What Maven offers**: a clear 4-step monthly rhythm (Share documents → We record & reconcile → Monthly report delivered → Ongoing tracking) — concrete and easy to picture.
4. **Evidence/trust present**: a 6-item benefit list ("Lower cost than full-time accounting staff," "VAT/TDS and tax deadline tracking," etc.) — reasonable, not oversold.
5. **Next action**: "Talk to us about monthly accounting support" / "Start Monthly Accounting Support" — clear, though slightly different button wording for essentially the same action (see below).

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| This page (Nepal-domestic) and `international-accounting.html` ("International Outsourced Accounting & Bookkeeping") are two genuinely different pages doing two genuinely different jobs (local staffing alternative vs. remote support for foreign accounting firms/businesses) — confirmed NOT a duplication despite similar-sounding names. Worth stating explicitly since the names alone could suggest overlap. | — | No content change needed. The nav-label fix (item 2 in cross-cutting findings) reduces the naming confusion between them. | — |
| No FAQ section on this page (every comparable service page — International Accounting, Virtual CFO, NFRS/IFRS — has one). | P2 | Consider adding 2-3 FAQs (e.g. "How is this different from hiring an accountant?", "What if I already use an accounting software?"). | **Owner input required** — new FAQ content is new copy, not a correction; proposing, not writing/implementing. |

---

## 7. Global Outsourcing (`global-outsourcing.html`)

**Current purpose**: a hub/router page — "Maven supports foreign businesses two ways; here's which one you want."

1. **Intended visitor**: a foreign business or accounting firm landing here (likely via search or a referral) trying to figure out if Maven is relevant to them at all.
2. **Problem/question**: "Does a Kathmandu-based firm actually make sense for my international business, and what's the difference between the two options I'm being shown?"
3. **What Maven offers**: exactly two clearly differentiated paths — day-to-day bookkeeping (→ International Accounting) vs. higher-level financial visibility (→ Virtual CFO) — a genuinely useful triage, not a false choice.
4. **Evidence/trust present**: minimal by design (it's a router page, not a pitch) — just the "Kathmandu-based team" framing, which is honest and not oversold.
5. **Next action**: "Book a Free Discovery Call" — appropriate for an international/higher-consideration audience (vs. the more transactional "Book Free Consultation" used domestically).

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. This hub/spoke structure (1 router + 2 detail pages) is good information architecture, not duplication. | — | — | — |

---

## 8. International Accounting (`international-accounting.html`)

**Current purpose**: the detailed pitch for remote day-to-day bookkeeping/reconciliation/reporting support to foreign businesses and accounting firms.

1. **Intended visitor**: a foreign SME, startup, or accounting-firm owner evaluating Maven as an outsourced bookkeeping capacity extension.
2. **Problem/question**: "Can I trust a remote Nepal-based team with my books, and exactly where does their responsibility end and mine begin?"
3. **What Maven offers**: a detailed 13-item service list (bookkeeping, reconciliation, AP/AR, monthly reporting, cleanup work, overflow capacity for accounting firms) — specific and credible, not vague "we do accounting" language.
4. **Evidence/trust present**: this page has the **most thorough scope-of-work boundary language on the entire site** — see cross-cutting finding #1. It explicitly states Maven does NOT represent itself as a locally licensed CPA/tax agent/auditor/attorney in the client's jurisdiction, and that the client's own local professional remains responsible for anything requiring local authorization. This is exactly right for the audience and risk profile.
5. **Next action**: "Book a Free Discovery Call" / WhatsApp — appropriate.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. This is the best-executed page on the site for its specific job (managing a foreign client's trust and expectations). | — | — | — |

---

## 9. Virtual CFO (`virtual-cfo.html`)

**Current purpose**: the higher-tier "financial visibility beyond bookkeeping" offer — explicitly positioned as a step up from International Accounting, not a replacement.

1. **Intended visitor**: a business owner (domestic or international — this page doesn't specify jurisdiction) who already has bookkeeping handled but wants management reporting/forecasting/cash-flow visibility.
2. **Problem/question**: "I have my books done — now what? Do I need a full-time CFO, or is there a lighter option?"
3. **What Maven offers**: a clean 4-level ladder (Bookkeeping Support → Monthly Accounting → Management Reporting → Virtual CFO Support) that lets a visitor self-place without needing a sales call first.
4. **Evidence/trust present**: two direct disclaimers — "Does Maven make business or investment decisions for us? No... We do not provide investment advice or make decisions on behalf of the business" and the Scenario & Decision Support note ("not investment, lending or regulated financial advice"). Same honest-scoping strength as International Accounting.
5. **Next action**: "Book a Free Discovery Call" (appears twice — intro and closing) — clear.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Unlike International Accounting, this page has zero Nepal-vs-international framing in its own copy — a visitor arriving directly here (not via Global Outsourcing) has no cue whether this is a Nepal-only or international service. | P2 | Consider one sentence early on this page (e.g. in the intro) clarifying availability to both domestic and international clients, matching the framing already established on the sibling page. | **Owner input required** — this is new copy, not a correction, and touches how the service is positioned; proposing only. |

---

## 10. NFRS/IFRS (`nfrs-ifrs.html`)

**Current purpose**: the most technical/specialized page on the site — financial reporting standards implementation for growing/investor-facing companies.

1. **Intended visitor**: a finance team or business owner facing a specific trigger (lender/investor requirement, growth, group reporting) that requires a more rigorous reporting framework than basic bookkeeping.
2. **Problem/question**: "Do I actually need this, and can Maven help without replacing my existing accountant or claiming to be an audit firm?"
3. **What Maven offers**: a genuinely comprehensive page — assessment, implementation, technical accounting, statement prep, policy documentation, management-reporting linkage, audit-prep coordination — the most complete single-service page on the site.
4. **Evidence/trust present**: repeated, explicit "Defined Professional Boundaries" language (does NOT issue statutory audit opinions, does NOT represent itself as an audit firm) — consistent with the other specialized pages. A `whoFor` list (9 items) helps a visitor self-qualify rather than guess.
5. **Next action**: "Book an Initial Consultation" / "Book an NFRS / IFRS Consultation" — clear, appropriately weightier framing ("Consultation" not "Free Consultation") matching the technical nature of the service.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. This page's length is justified by genuine content density (12 distinct sections, all substantive), not padding. | — | — | — |

---

## 11. Documents Needed / Documents Checklist (`documents-needed.html`)

**Current purpose**: a practical reference tool — reduce "what do I need to bring" friction before a visitor commits to reaching out.

1. **Intended visitor**: someone close to engaging, gathering paperwork.
2. **Problem/question**: "What exactly do I need to prepare?"
3. **What Maven offers**: 5 document groups (Company Registration / PAN-VAT / Monthly Accounting / Tax Clearance / Project-Loan Report) with 7-11 items each — genuinely useful, not a marketing page pretending to be a checklist.
4. **Evidence/trust present**: appropriately hedged ("Document requirements may vary depending on business type... contact Maven before submitting documents") — honest about the checklist being general, not exhaustive.
5. **Next action**: "Get a Customized Document Checklist" — smart, converts a self-service tool into a lead without being pushy.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. | — | — | — |

---

## 12. Resources (`resources.html`)

**Current purpose**: a hub page linking to Documents Checklist, Calculators, Useful Links, FAQ.

1. **Intended visitor**: someone browsing rather than searching for one specific thing.
2. **Problem/question**: "What self-service tools does Maven have?"
3. **What Maven offers**: correctly summarized 4-tile menu (Blog tile correctly suppressed while hidden/empty, per the CMS visibility flag — good, this confirms "unfinished Finance content clearly left alone" for the Blog specifically).
4. **Evidence/trust present**: none needed — pure navigation hub.
5. **Next action**: "Contact Maven" at the bottom, plus each tile's own CTA — fine.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| This is the only one of the 18 pages with no hero background photo (renders as plain navy). Minor visual inconsistency, not a content issue. | P3 | Add a hero background image matching the other pages' convention, once a suitable photo/asset exists. | **Owner input required** — needs an actual image asset; not something to implement without one. |

---

## 13. Useful Links (`useful-links.html`)

**Current purpose**: a curated directory of official Nepal government portals (IRD, OCR, SSF, NRB, national portal).

1. **Intended visitor**: someone who needs an official source directly, not Maven's interpretation of it.
2. **Problem/question**: "Where do I find the actual government site for X?"
3. **What Maven offers**: 5 correctly-named, accurate government bodies with one-line descriptions of what each handles.
4. **Evidence/trust present**: an explicit disclaimer that these are third-party sites Maven doesn't control, and to verify current requirements directly — this is exactly right, protects Maven from being blamed if a government site's requirements change.
5. **Next action**: "Visit Website" per card (external), plus a bottom CTA back to Maven — good balance of being genuinely useful (not just a lead-gen trick) while still converting.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. | — | — | — |

---

## 14. Calculators (`calculators.html`)

**Current purpose**: interactive tools (Income Tax, VAT, TDS, Loan EMI) that demonstrate expertise while generating leads.

1. **Intended visitor**: someone who wants a quick number before deciding whether to engage Maven for the real calculation.
2. **Problem/question**: "Roughly what will I owe / what's my EMI?"
3. **What Maven offers**: 4 genuinely functional live calculators with slab-by-slab breakdowns — a real utility, not a gimmick.
4. **Evidence/trust present**: disclaimers are present and correctly worded ("estimate only... not tax, legal, or financial advice," "rates change with each fiscal year's Finance Act") — but see the issue below.
5. **Next action**: "Need help with tax filing?" / "Book a Free Initial Consultation" / WhatsApp — clear.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| The disclaimer ("estimate only... not tax, legal, or financial advice") is a single small-print line below a visually prominent, large computed number (`.calc-big`, 2.4rem font). A visitor could reasonably treat the headline figure as filing-ready rather than an estimate. | **P1** | Consider making the "estimate only" disclaimer more visually proximate to the result itself (e.g. directly under the big number, not just at the page bottom) — a design change, not a copy rewrite (the wording itself is already correct and doesn't need to change). | **Owner input required** — this is a visual-hierarchy/design change, not a text correction; proposing only, not implemented (would need a CSS/layout decision, arguably belongs with a future design-polish task rather than a "small unquestionably safe" fix here). |

---

## 15. FAQ (`faq.html`)

**Current purpose**: pre-empt objections/questions before they become a reason not to contact Maven.

1. **Intended visitor**: someone with a specific doubt (scope, pricing, coverage, data safety) blocking them from reaching out.
2. **Problem/question**: varies per question — the 9 questions cover audit scope, monthly accounting, geographic coverage, registration, pricing, data safety, and financial reporting/cash-flow support.
3. **What Maven offers**: answered honestly, including explicit "no, we don't do X" answers (statutory audit) rather than dodging.
4. **Evidence/trust present**: same honest-scoping pattern as the international pages — this page explicitly states what Maven does NOT do (statutory audit) as clearly as what it does.
5. **Next action**: "Contact Maven Today" / WhatsApp — clear.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Q5's answer states "Typically around 7 working days" for company registration — a specific, memorable number, hedged but still concrete. | P2 | Confirm this figure is still accurate before relying on it as evergreen copy — timelines for government processing can shift. Not changed (Finance/legal-adjacent service-delivery claim, out of scope for this task to alter). | **Owner input required**: is "~7 working days" still accurate? |
| Q7's answer ("Is my business data safe? Yes...") is a fairly generic reassurance without specifics beyond "access is limited to the people working on your file." | P3 | Could be strengthened with a concrete detail if one exists (e.g. how records are stored) — but only with something true and provable, not invented language. | **Owner input required**: is there a specific, statable data-handling practice worth adding? Not invented here. |

---

## 16. Contact (`contact.html`)

**Current purpose**: convert interest into an actual inquiry — the page every CTA on the site points to.

1. **Intended visitor**: anyone who has decided to reach out.
2. **Problem/question**: "How do I actually contact Maven, and what happens after I do?"
3. **What Maven offers**: 5 channels (form, WhatsApp, phone, email, office address+map) plus stated hours and a response-time expectation ("within one business day").
4. **Evidence/trust present**: a security-conscious note discouraging visitors from attaching sensitive documents to the form ("please don't attach financial records, IDs, or other sensitive documents... we'll confirm a secure way to share them") — this is a genuinely good trust signal, protects both Maven and the visitor.
5. **Next action**: multiple paths, all clear — form (4 required fields: Name, Phone, Service, Message; 3 optional), WhatsApp, and (previously) plain-text phone/email.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Phone number and email were displayed as plain, non-clickable text — a mobile visitor couldn't tap-to-call or tap-to-email. | **P1** | Fixed this task: wrapped both in `tel:`/`mailto:` links. No visible text changed. | none — implemented |
| This is the only page of the 18 with no closing CTA band — the two-column contact section is the entire page body. | P3 | Not actually a problem — a Contact page doesn't need a "contact us" CTA at its own bottom; flagging only because every other page has one, for completeness of the internal-consistency check. | none — no change recommended |
| No social media links render anywhere on the site (`brand.social.*` are all empty in the CMS). Not a defect — just confirms there's currently no social presence to link to. | P3 | If Maven has (or gets) active social accounts, add them via the admin panel's existing Brand fields — the template already supports it, nothing to build. | **Owner input required**: are there social accounts to add? Not assumed here. |

---

## 17. Team (`team.html`)

**Current purpose**: put a face (or faces) to the business — the second-most direct trust-building page after About.

1. **Intended visitor**: someone deciding whether to trust a person, not just a company name.
2. **Problem/question**: "Who am I actually going to be working with?"
3. **What Maven offers**: currently one profile — Sures Guragai, Founder & Lead Consultant, with a substantive bio (bookkeeping/tax/reporting/compliance experience across engineering, hospitality, nonprofit, service-sector clients, plus international remote-reporting experience).
4. **Evidence/trust present**: the bio is specific rather than generic ("almost two years providing remote financial reporting support to US-based clients") but unverifiable as written (no client names, no certification cited) — noted as **DO NOT CHANGE per this task's own rules** (Team content), flagged for the owner's awareness only.
5. **Next action**: "Book a Free Initial Consultation" — clear.

**Issues** (all flagged only — Team content is explicitly out of scope for direct edits this task):
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Hero subtitle says "team" (plural) while exactly 1 member is configured. | P2 | If more team members are planned soon, this is fine as forward-looking copy. If not, consider softening to singular framing until more profiles are added. | **Owner input required**: are more team members being added soon? Not changed either way. |
| No photo for the one configured member (falls back to initials avatar). | P3 | Add a photo when available. | **Owner input required**: photo asset needed, not something to fabricate. |

---

## 18. Privacy Policy (`privacy.html`)

**Current purpose**: legal/data-handling disclosure — required, not a conversion page.

1. **Intended visitor**: someone checking data-handling practices before submitting the contact form, or a regulator/reviewer.
2. **Problem/question**: "What happens to my information if I fill out the form?"
3. **What Maven offers**: 7 sections (Information collected / How used / How shared / Retention / Confidentiality / Your choices / Contact about privacy) — appropriately structured for a small consultancy's website (not over-engineered with clauses that don't apply).
4. **Evidence/trust present**: names the actual third-party processor used (Formspree) rather than a vague "we may share with partners" — good, specific, honest.
5. **Next action**: "Contact Maven" for privacy questions — appropriate, no separate DPO/complex process needed at this scale.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| "Client financial and business records are stored securely" (Confidentiality section) states a security posture without naming any specific measure/standard. | P2 | If there's a concrete practice worth naming (encrypted storage, access logging, etc.), add it. Otherwise leave as a general statement. | **Owner input required / professional legal review** — this is explicitly legal-adjacent copy this task must not rewrite unilaterally. Flagged only. |
| No reference to any specific Nepal data-protection law/framework. | P3 | Optional: cite the applicable framework if the owner/legal counsel wants to strengthen the policy's specificity. | **Owner/professional input required** — legal content, not to be drafted here. |
| "Last reviewed: August 2026" — confirm this stays current going forward. | P3 | Update the review date whenever the policy text actually changes. | Process note for the owner, not a content issue. |

---

## Fixes implemented this task

Three small, unambiguous, non-substantive changes — each verified against the built site before and after, full Playwright suite re-run clean:

1. **`data.js`** — the `international-accounting.html` nav dropdown item's label changed from "Outsourced Accounting & Bookkeeping" (a literal duplicate of the *different* `outsourced-accounting.html` nav item) to "International Accounting" — reusing the label the footer already uses for this exact page. No new wording invented; resolves a real navigation-consistency defect.
2. **`content/site.yaml`** — Services page subtitle "six core areas" → "seven core areas," matching the 7 categories actually rendered (and matching Home's own stat row, which already independently states "7 · Service categories"). An objective count correction, not a new claim.
3. **`pages3.js`** — Contact page's phone number and email address are now real `tel:`/`mailto:` links (previously plain text). No visible copy changed; pure functionality fix removing real mobile-visitor friction.

## Everything else in this document

Every other item above is a **proposal or a flagged inconsistency for owner review** — none of it was changed, per this task's explicit instructions not to alter substantive claims, Finance/legal wording, or Team/Testimonial content without owner or professional sign-off.
