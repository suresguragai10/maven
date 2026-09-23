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
6. **[RESOLVED 2026-09-22] Team depth and plural framing.** The Team page now has seven published profiles, so the earlier mismatch between plural "team" language and a single configured profile no longer exists. The page now separates founders from wider advisory/client-delivery roles while keeping Maven's Kathmandu operating base explicit.

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

**Current purpose**: establish trust in Maven as a focused professional finance and accounting firm before a prospect moves into Services, Team or Contact.

1. **Intended visitor**: someone already interested in Maven who wants to understand the firm, its working standards, people and delivery model before making contact.
2. **Problem/question**: "Who is Maven, how does the team work, and can I trust them with recurring finance information?"
3. **What Maven offers**: the page now summarizes three connected capability layers — setup/tax/compliance, accounting operations, and reporting/outsourced finance — while leaving the detailed catalogue to Services.
4. **Evidence/trust present**: established year and client count from existing brand data; New Baneshwor/Kathmandu base; existing five values (Accuracy, Confidentiality, Timely service, Professional communication, Ethical practice); explicit internal-review/confidentiality process; and a preview of real Team profiles with a full Team-page path.
5. **Delivery model**: Nepal-wide support and remote international finance delivery are shown as separate, explicit paths. The page does not imply foreign offices or regulated services outside Maven's stated scope.
6. **Next action**: Services, Team, Global Outsourcing, Contact, or WhatsApp depending on the visitor's intent.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| No structural content issue identified in the 2026-09-22 premium pass. Future improvement would be authentic Maven office/team photography if the owner supplies higher-quality approved images. | P3 | Optional photography upgrade only; current layout is already designed to accept real imagery without a structural rewrite. | Owner-approved photos. |

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
| **[RESOLVED — corrected 2026-08-21]** ~~No CTA/link exists directly on any individual service card.~~ Every `serviceEntry()` card (`ui.js:74-89`) now renders its own "Discuss This Service" button (or a deep-link CTA for Outsourced Accounting/NFRS-IFRS via `SERVICE_DEEP_LINKS`, `pages2.js:13-16`) — confirmed live in `services.html`. Shipped as part of the same rearchitecture that added `capabilityChapter()`/`serviceEntry()`; this review item was never marked done. | — (closed) | Already implemented, no further action. | none |

---

## 4. Packages (`packages.html`)

**Current purpose**: explain three common engagement starting points and how Maven scopes a quotation without presenting a rigid good/better/best price ladder.

1. **Intended visitor**: someone who understands Maven's services and now wants to know what a practical starting engagement could look like and what affects the fee.
2. **Problem/question**: "Which starting point is closest to my situation, what would normally be included, and how will Maven price it?"
3. **What Maven offers**: 3 clearly differentiated starting points (Startup Setup / Monthly Compliance / Business Growth), each preserving its CMS-managed audience, situation and inclusion list. The page explicitly says the options are not rigid tiers and shows custom combinations.
4. **Evidence/trust present**: quotation drivers are visible before the packages (volume, payroll, accounts/entities, record quality, reporting and timing); the fee section separates Maven's service fee from government fees, penalties, official charges and third-party professional charges; the four-step quotation process clarifies inclusions and what remains with the client.
5. **Next action**: discuss the closest starting point, request a custom scope, or return to the full Services architecture.

**Issues / owner-governed wording**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Package bullet wording is intentionally shorter than the Services page's fuller category wording (for example, "PAN/VAT guidance" here vs. separate registration-support lines on Services). | P2 / scope-sensitive | Keep the current wording unless Maven wants the commercial package to promise the fuller service wording. Changing "guidance" to "registration support" could change the apparent scope of a paid engagement. | **Owner input required** — not changed in the premium pass. |
| No fixed price is published. | — | Keep "Quote after review" until Maven has a defensible, maintained public-pricing policy. Do not invent starting prices for design purposes. | Owner decision required before any price is published. |

---

## 5. Industries (`industries.html`)

**Current purpose**: show that Maven shapes accounting, tax, payroll and reporting support around how a business actually operates rather than applying one generic finance template.

1. **Intended visitor**: someone who wants to see their own business model reflected back and understand which finance issues tend to matter in that context.
2. **Problem/question**: "Does Maven understand how money, costs, working capital and reporting needs differ in a business like mine?"
3. **What Maven offers**: a business-model lens (revenue, cost/margin structure, cash/working capital, reporting audience) followed by 13 real industry profiles. Each profile keeps its tailored description, finance-attention list and Maven-support list, including specific concepts such as construction retentions, restaurant payment-channel reconciliation, donor/project reporting and marketplace settlement reconciliation.
4. **Evidence/trust present**: specificity of the profile content, a consistent-finance-discipline section (records, reconciliation, responsibility, management visibility), and an explicit professional-boundary statement rather than unsupported credentials.
5. **Next action**: discuss the selected business type, ask a quick WhatsApp question, view the broader finance services, or start a consultation through Contact.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found after the premium pass. The page remains specific without turning the 13 industries into thin standalone doorway pages or inventing sector credentials. | — | — | — |

---

## 6. Outsourced Accounting (`outsourced-accounting.html`)

**Current purpose**: the **Nepal-domestic** monthly finance-function page — distinct from the international-facing accounting and outsourcing pages.

1. **Intended visitor**: a Nepal-based growing business deciding how to create a more dependable monthly accounting routine without building a larger in-house finance team too early.
2. **Problem/question**: "How can we make bookkeeping, reconciliations, compliance follow-through and monthly reporting more structured, and what should stay in-house?"
3. **What Maven offers**: a defined monthly scope covering bookkeeping, reconciliations, selected payables/receivables support, payroll accounting support, VAT/TDS and tax coordination, and monthly reporting, with a five-step recurring operating cycle.
4. **Evidence/trust present**: explicit scope language, review and exception handling, confidentiality guidance, management-responsibility wording, professional boundaries, and a visible statement that outsourcing is not the right answer for every finance role.
5. **Next action**: "Discuss Monthly Accounting" with a secondary path into Virtual CFO support or accounting packages as the business grows.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| This page and `international-accounting.html` continue to do two different jobs: Nepal domestic finance operations vs. remote support for foreign businesses/accounting firms. The premium pass strengthened that distinction rather than merging the pages. | — | Keep both audience framings explicit in future edits. | — |
| **[RESOLVED — 2026-09-22]** The page previously had no FAQ section. | — | Four FAQs are now included and editable in the admin CMS, covering outsourced vs. in-house accounting, existing software, connected bookkeeping/payroll/VAT-TDS scope, and recurring document needs. | — |
| **[RESOLVED — 2026-09-22]** The old benefits list included the blanket claim "Lower cost than full-time accounting staff." | — | Replaced with more defensible scope/flexibility language; the page now explains when outsourced support may or may not be the right operating model. | — |

---

## 7. Global Outsourcing (`global-outsourcing.html`)

**Current purpose**: a hub/router page — "Maven supports foreign businesses two ways; here's which one you want."

1. **Intended visitor**: a foreign business or accounting firm landing here (likely via search or a referral) trying to figure out if Maven is relevant to them at all.
2. **Problem/question**: "Does a Kathmandu-based firm actually make sense for my international business, and what's the difference between the two options I'm being shown?"
3. **What Maven offers**: exactly two clearly differentiated paths — day-to-day bookkeeping (→ International Accounting) vs. higher-level financial visibility (→ Virtual CFO) — a genuinely useful triage, not a false choice.
4. **Evidence/trust present**: the hub now explains the delivery model directly — Kathmandu base, existing-system workflow, defined scope, direct communication, controlled access, professional boundaries, and accounting-firm support — while still routing visitors into the two specialist pages for full detail.
5. **Next action**: "Book a Free Discovery Call" remains the primary action, with clear continuation paths to Remote Accounting Support and Virtual CFO / Management Reporting.

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

1. **Intended visitor**: a business owner or management team in Nepal or an international team that already has bookkeeping handled but wants management reporting, forecasting, cash-flow visibility, and a more structured finance-management rhythm.
2. **Problem/question**: "I have my books done — now what? Do I need a full-time CFO, or is there a lighter option?"
3. **What Maven offers**: a clean 4-level ladder (Bookkeeping Support → Monthly Accounting → Management Reporting → Virtual CFO Support) that lets a visitor self-place without needing a sales call first.
4. **Evidence/trust present**: two direct disclaimers — "Does Maven make business or investment decisions for us? No... We do not provide investment advice or make decisions on behalf of the business" and the Scenario & Decision Support note ("not investment, lending or regulated financial advice"). Same honest-scoping strength as International Accounting.
5. **Next action**: the hero invites visitors to “Discuss Your Reporting Needs,” with a closing “Book a Free Initial Consultation” CTA — clear and consistent with the page’s advisory positioning.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| ~~Unlike International Accounting, this page has zero Nepal-vs-international framing in its own copy.~~ | **Resolved 2026-09-22** | The page header and fit section now state that Virtual CFO / Management Reporting can support growing businesses in Nepal and international teams, while keeping Kathmandu-based delivery and professional-scope guardrails consistent with the international hub. | Implemented in the Virtual CFO premium page pass. |

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

**Current purpose**: a practical preparation and secure-sharing guide — reduce "what do I need to bring" friction without encouraging visitors to send confidential records through the public website.

1. **Intended visitor**: someone close to engaging, gathering paperwork for registration, tax, monthly accounting, return support, or finance/reporting work.
2. **Problem/question**: "Which records should I prepare, and what should I confirm before I send anything?"
3. **What Maven offers**: 5 CMS-managed document groups (Company Registration / PAN-VAT / Monthly Accounting / Tax Clearance / Project-Loan Report), now presented inside a preparation flow rather than as a standalone accordion.
4. **Evidence/trust present**: the page keeps the variable-requirements disclaimer, explains that the exact list should be confirmed first, and visibly warns against sending banking, payroll, tax or identity documents through general chat/forms.
5. **Next action**: request a customized checklist after describing the business/entity type, service need, current stage/deadline, and whether records already exist.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found. | — | — | — |

---

## 12. Resources (`resources.html`)

**Current purpose**: a knowledge hub that helps visitors prepare records, test indicative calculations, verify official sources and understand common service questions before a matter becomes entity-specific or judgement-heavy.

1. **Intended visitor**: someone who needs a practical starting point before opening a finance, tax, accounting or compliance conversation.
2. **Problem/question**: "Which resource should I use, and when do I need professional context instead?"
3. **What Maven offers**: four CMS-managed primary destinations — Documents Checklist, Financial Calculators, Useful Links and FAQ — framed as Prepare / Calculate / Verify / Understand. The Blog remains correctly suppressed while hidden.
4. **Evidence/trust present**: the page distinguishes indicative tools from official sources and makes the general-information / professional-judgement boundary explicit.
5. **Next action**: use the relevant resource first, then contact Maven when a current rule, entity-specific treatment, reporting judgement or cross-border issue needs context.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| None found in the 2026-09-22 premium pass. The non-photographic hero is now an intentional typographic knowledge-hub treatment rather than an incomplete hero state. | — | Preserve the structured hub and keep Blog hidden until real publish-ready content exists. | — |

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

**Current purpose**: a professional planning-tools desk for salary income tax, VAT, TDS and loan EMI, with transparent assumptions, live breakdowns and clear boundaries around when an estimate needs current statutory or professional confirmation.

1. **Intended visitor**: someone who wants a practical estimate or scenario check before filing, paying, running payroll, or making a borrowing decision.
2. **Problem/question**: "What does the configured calculation indicate, what assumptions are being used, and when do I need to verify the result?"
3. **What Maven offers**: 4 functional live calculators with visible assumptions and breakdowns. The Income Tax tool defaults to the latest configured fiscal-year schedule rather than an older hard-coded year.
4. **Evidence/trust present**: the premium pass now places estimate-only guidance beside the workbench, adds tool-specific "Useful for / Does not determine" boundaries, and finishes with a four-step verify-before-acting workflow. Statutory rates and thresholds remain owner/professional-governed data rather than being treated as permanently correct.
5. **Next action**: use the relevant tool for planning, consult official reference links where appropriate, and contact Maven when the result affects a filing, payment, payroll decision, or entity-specific tax/accounting treatment.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| No visual-hierarchy issue remains from the earlier review: estimate-only guidance is now prominent and proximate to the tools. The remaining risk is data governance rather than presentation — configured tax/VAT/TDS values still need documented reconciliation to current official sources whenever they change. | P1 governance | Maintain a durable verified-by / verified-date / source record for statutory figures instead of relying on copy alone. | **Owner/professional input required** for the figures listed in `docs/OWNER_REVIEW.md`. |

---

## 15. FAQ (`faq.html`)

**Current purpose**: a grouped pre-engagement help center that lets visitors understand service scope, coverage, fees/confidentiality and reporting/advisory support before they send documents or request a quote.

1. **Intended visitor**: someone with a specific doubt (scope, pricing, coverage, data safety) blocking them from reaching out.
2. **Problem/question**: varies per question — the 9 questions cover audit scope, monthly accounting, geographic coverage, registration, pricing, data safety, and financial reporting/cash-flow support.
3. **What Maven offers**: answered honestly, including explicit "no, we don't do X" answers (statutory audit) rather than dodging.
4. **Evidence/trust present**: same honest-scoping pattern as the international pages — this page explicitly states what Maven does NOT do (statutory audit) as clearly as what it does.
5. **Next action**: browse a deeper Services / Global Outsourcing / Documents page, or start a detailed Contact / WhatsApp inquiry when the answer depends on the visitor’s actual facts.

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

**Current purpose**: establish who is behind Maven, how the team fits together, and what professional working standards clients can expect.

1. **Intended visitor**: a prospective client or partner who wants to understand the people, experience mix, review model and operating base behind the firm.
2. **Problem/question**: "Who will support the work, what experience does the team bring, and how is the engagement controlled?"
3. **What Maven offers**: seven published profiles across founder, advisor, accounting, consulting and strategic roles. The page keeps the full supplied biographies available while using shorter lead summaries for scanning.
4. **Evidence/trust present**: real names, roles, locations and supplied experience/qualification narratives; four real team photos; Kathmandu operating-base language; explicit working standards around scope, review, communication and access discipline.
5. **International framing**: one advisor is listed in the United Kingdom, but the page explicitly states that Maven's operating office remains in Kathmandu and does not present advisor locations as overseas offices.
6. **Next action**: Contact, Services, About, or Global Outsourcing depending on the visitor's need.

**Issues**:
| Issue | Severity | Recommended change | Proof/owner input needed |
|---|---|---|---|
| Several team biographies contain specific professional qualifications, certifications, tenure statements and sector-experience claims. | P1 governance | Keep the current wording only while the owner has supporting records and has confirmed each profile is current. Re-verify whenever a bio changes. | **Owner verification required** for credential/experience accuracy; no new credential was invented in the premium pass. |
| Three published profiles currently have no photo and use the intentional initials fallback. | P3 | Replace only with owner-approved real photography when available; do not use stock portraits. | Owner-approved photo assets. |

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
