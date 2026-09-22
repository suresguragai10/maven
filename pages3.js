const data = require('./data');
const { esc, safeUrl } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, accordionItem, industryCard, industryDetail, ctaBand, bulletList, panelLabel, eyebrow, eyebrowOnDark,
} = require('./ui');

function documentsNeeded() {
  const h = data.pageHeader('documents-needed');
  const readinessSteps = [
    ['01', 'Choose the service', 'Registration, PAN/VAT, monthly accounting, tax support, and project or loan reporting need different records.'],
    ['02', 'Confirm the exact list', 'Maven narrows the checklist around your entity, ownership, location, service scope, and current record position.'],
    ['03', 'Organize before sharing', 'Group records by period or purpose where possible so missing items and exceptions are easier to identify.'],
    ['04', 'Use the agreed transfer method', 'Sensitive banking, payroll, tax, and identity documents should not be sent through general website chat or enquiry forms.'],
  ];
  const preparationStandards = [
    ['check', 'Send only what is relevant', 'Start with the confirmed checklist rather than forwarding every record you have.'],
    ['ledger', 'Keep records identifiable', 'Clear file names, dates, periods, and supporting context make review and follow-up more efficient.'],
    ['shield', 'Protect confidential records', 'Maven will confirm an appropriate document-sharing method after the service requirement is understood.'],
  ];
  const groupIcons = ['building', 'percent', 'ledger', 'shield', 'barChart'];
  const groupLabels = ['Registration & ownership', 'Tax registration', 'Recurring finance', 'Tax & returns', 'Finance & lending'];
  const groupsHtml = data.documentGroups.map((g, i) => accordionItem({
    id: `doc-${i}`,
    headingHtml: `<span class="documents-checklist-heading"><span class="documents-checklist-number">${String(i + 1).padStart(2, '0')}</span><span class="documents-checklist-icon">${icon(groupIcons[i] || 'ledger')}</span><span class="documents-checklist-heading-copy"><small>${esc(groupLabels[i] || 'Document checklist')}</small><strong>${esc(g.title)}</strong></span></span>`,
    bodyHtml: `<div class="documents-checklist-body">${bulletList(g.items)}<p class="documents-checklist-body-note">General starting point only. Maven confirms the exact list before documents are submitted.</p></div>`,
    open: false,
    headingLevel: 'h3',
  })).join('');

  return `
  <section class="documents-premium-hero">
    <picture class="documents-premium-hero-photo" aria-hidden="true">
      <source media="(max-width: 767px)" srcset="/images/documents-needed-hero-bg-640w.jpg">
      <source media="(max-width: 1279px)" srcset="/images/documents-needed-hero-bg-960w.jpg">
      <img src="/images/documents-needed-hero-bg.jpg" alt="" decoding="async">
    </picture>
    <div class="documents-premium-hero-shade" aria-hidden="true"></div>
    <div class="container documents-premium-hero-grid">
      <div class="documents-premium-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="documents-premium-hero-sub">${esc(h.subtitle)}</p>
        <div class="documents-premium-hero-actions">
          ${button('View Common Checklists', '#document-checklists', 'primary')}
          ${button('Ask for an Exact Checklist', 'contact.html#inquiry', 'ghost-light')}
        </div>
        <div class="documents-premium-hero-assurances" aria-label="Document checklist approach">
          <span>${stampMark('stamp-sm')} ${data.documentGroups.length} common starting checklists</span>
          <span>${stampMark('stamp-sm')} Exact list confirmed first</span>
          <span>${stampMark('stamp-sm')} Confidential files shared only after scope is clear</span>
        </div>
      </div>

      <aside class="documents-readiness-panel reveal" aria-label="Before you send documents">
        <div class="documents-readiness-panel-head">
          ${panelLabel('Before You Send Anything')}
          <h2>Prepare the right records, not every record.</h2>
          <p>The checklist should follow the service requirement. Confirm what applies before sharing confidential material.</p>
        </div>
        <div class="documents-readiness-list">
          ${readinessSteps.map(([number, title, text]) => `<div class="documents-readiness-row">
            <span>${number}</span>
            <div><strong>${esc(title)}</strong><small>${esc(text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="documents-readiness-panel-foot">
          ${icon('shield')}
          <span>Do not send sensitive financial or identity documents through general website chat.</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad documents-preparation-section">
    <div class="container documents-preparation-grid">
      <div class="documents-preparation-copy reveal">
        ${eyebrow('Start With the Requirement')}
        <h2>A document checklist should narrow the work, not create more work.</h2>
        <p>${esc(data.documentsTopNote)}</p>
        <p>The checklists below are practical starting points. They help you understand the type of records that may be relevant before Maven confirms the final list for your case.</p>
      </div>
      <div class="documents-preparation-standards reveal-stagger" aria-label="Document preparation standards">
        ${preparationStandards.map(([iconName, title, text]) => `<article class="documents-preparation-standard">
          <span>${icon(iconName)}</span>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad documents-checklists-section" id="document-checklists">
    <div class="container documents-checklists-container">
      <div class="documents-checklists-intro reveal">
        <div>
          ${eyebrow('Common Checklists')}
          <h2>Five starting points for common finance and registration needs.</h2>
        </div>
        <p>Open the checklist closest to the work you need. Items can change depending on business type, ownership, record condition, government-office requirements, and the exact scope agreed with Maven.</p>
      </div>
      <div class="documents-checklist-accordion accordion">
        ${groupsHtml}
      </div>
    </div>
  </section>

  <section class="section-pad documents-security-section">
    <div class="container documents-security-grid">
      <div class="documents-security-copy reveal">
        ${eyebrowOnDark('Confidential Document Handling')}
        <h2>Know what to prepare before deciding how to share it.</h2>
        <p>Accounting and tax work can involve bank records, payroll data, identity documents, tax records, agreements, and other confidential information. The public website is for starting the conversation — not for sending sensitive files.</p>
        <div class="documents-security-actions">
          ${button('Review Privacy Policy', 'privacy.html', 'outline')}
          ${button('Start a Secure-Scope Conversation', 'contact.html#inquiry', 'primary')}
        </div>
      </div>
      <div class="documents-security-rules reveal-stagger">
        <article>
          <span>01</span>
          <div><strong>Confirm the scope first</strong><p>Tell Maven the business type and service requirement so the requested records can be narrowed before transfer.</p></div>
        </article>
        <article>
          <span>02</span>
          <div><strong>Avoid sensitive files in chat</strong><p>Do not use website live chat or the general enquiry form for banking, payroll, tax, or identity documents.</p></div>
        </article>
        <article>
          <span>03</span>
          <div><strong>Use the agreed sharing method</strong><p>Once the work is understood, Maven can confirm an appropriate way to exchange the records needed for the engagement.</p></div>
        </article>
      </div>
    </div>
  </section>

  <section class="section-pad documents-custom-section">
    <div class="container documents-custom-grid">
      <div class="documents-custom-copy reveal">
        ${eyebrow('Need a Different Checklist?')}
        <h2>Tell us the business type and what you are trying to complete.</h2>
        <p>${esc(data.documentsBottomNote)}</p>
      </div>
      <div class="documents-custom-panel reveal">
        ${panelLabel('Good information to include')}
        <div class="documents-custom-items">
          <div><span>01</span><strong>Business or entity type</strong></div>
          <div><span>02</span><strong>Service or filing you need help with</strong></div>
          <div><span>03</span><strong>Current stage or deadline</strong></div>
          <div><span>04</span><strong>Whether records already exist</strong></div>
        </div>
        <p>Describe the situation first. Maven can then confirm the relevant document list before you send confidential material.</p>
        <div class="documents-custom-actions">
          ${button('Request a Customized Checklist', 'contact.html#inquiry', 'primary')}
          ${button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like a customized document checklist for my business.'), 'whatsapp', 'target="_blank" rel="noopener"')}
        </div>
      </div>
    </div>
  </section>
  `;
}

function industries() {
  const h = data.pageHeader('industries');
  const industryLens = [
    ['01', 'How revenue is earned', 'Invoices, retail sales, fees, projects, bookings or platform settlements.'],
    ['02', 'Where costs accumulate', 'Stock, materials, people, suppliers, delivery, platforms or program spend.'],
    ['03', 'How cash moves', 'Collections, payables, advances, deposits, retentions and seasonal timing.'],
    ['04', 'What reporting must explain', 'Profitability, cash, projects, outlets, donors, lenders or management priorities.'],
  ];
  const contextFactors = [
    ['01', 'ledger', 'Transaction flow', 'Invoice-led, retail, project, donor, booking, marketplace and recurring-fee businesses all create different recordkeeping patterns.'],
    ['02', 'barChart', 'Cost & margin structure', 'Inventory, materials, labour, supplier costs, platform fees and operating overheads need different views to explain performance.'],
    ['03', 'trendUp', 'Cash & working capital', 'Receivables, payables, advances, deposits, retentions and seasonal cycles shape how cash should be monitored.'],
    ['04', 'briefcase', 'Reporting audience', 'Owners, lenders, donors, management teams and external reviewers often need different levels of financial visibility.'],
  ];
  const financeStandards = [
    ['01', 'ledger', 'Organized source records', 'The accounting process starts with complete, traceable working records rather than month-end guesswork.'],
    ['02', 'check', 'Consistent reconciliation', 'Cash, bank, receivables, payables and other key balances are checked against the underlying records.'],
    ['03', 'shield', 'Defined responsibility', 'Scope, access, deadlines and professional boundaries are agreed so finance work has clear ownership.'],
    ['04', 'barChart', 'Useful management visibility', 'Reports should help decision-makers understand what happened, what is outstanding, and where attention is needed.'],
  ];

  return `
  <section class="industries-hero-premium">
    <div class="container industries-hero-grid">
      <div class="industries-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="industries-hero-sub">${esc(h.subtitle)}</p>
        <div class="industries-hero-actions">
          ${button('Explore Industry Profiles', '#industry-profiles', 'primary')}
          ${button('View Finance Services', 'services.html', 'ghost-light')}
        </div>
        <div class="industries-hero-assurances" aria-label="Industry support highlights">
          <span>${stampMark('stamp-sm')} ${data.industries.length} industry profiles</span>
          <span>${stampMark('stamp-sm')} Nepal-wide business support</span>
          <span>${stampMark('stamp-sm')} Scope shaped around how the business operates</span>
        </div>
      </div>

      <aside class="industries-hero-panel reveal" aria-label="Industry lens">
        <div class="industries-hero-panel-head">
          ${eyebrowOnDark('Industry Lens')}
          <h2>Start with the operating model, not an accounting template.</h2>
          <p>Before defining the work, Maven looks at how money moves through the business and what management actually needs to see.</p>
        </div>
        <div class="industries-hero-panel-list">
          ${industryLens.map(([number, title, text]) => `<div class="industries-hero-panel-row">
            <span>${number}</span>
            <div><strong>${esc(title)}</strong><small>${esc(text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="industries-hero-panel-foot">
          ${icon('compass')}
          <span>Industry context shapes the bookkeeping, tax, payroll and reporting scope.</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad industries-context-section">
    <div class="container industries-context-grid">
      <div class="industries-context-copy reveal">
        ${eyebrow('Why Industry Context Matters')}
        <h2>The same set of accounts does not answer every business question.</h2>
        <p>Good finance support has to reflect the underlying business model. A construction company needs project and retention visibility; a restaurant needs daily sales and cost discipline; an NGO needs project or donor reporting; an online business needs settlement and platform reconciliation.</p>
        <p>That industry context helps determine what should be recorded, reconciled, reviewed and reported each month.</p>
      </div>
      <div class="industries-context-factors reveal-stagger" aria-label="Industry finance factors">
        ${contextFactors.map(([number, iconName, title, text]) => `<article class="industries-context-factor">
          <div class="industries-context-factor-top"><span>${number}</span><span class="industries-context-factor-icon">${icon(iconName)}</span></div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad industries-profiles-section" id="industry-profiles">
    <div class="container">
      <div class="industries-profile-intro reveal">
        <div>
          ${eyebrow('Industry Profiles')}
          <h2>Find the business model closest to yours.</h2>
        </div>
        <p>Each profile highlights the finance issues that usually deserve attention and where Maven can support the accounting, compliance and reporting process.</p>
      </div>

      <div class="industry-explorer">
        <div class="industry-picker-wrap">
          <div class="industry-picker-head">
            <span>${data.industries.length} profiles</span>
            <strong>Select a business type</strong>
            <p>Choose the closest match. Exact scope is confirmed after we understand your records, systems and transaction flow.</p>
          </div>
          <ul class="industry-list" aria-label="Select an industry">
            ${data.industries.map(industryCard).join('')}
          </ul>
        </div>
        <div class="industry-detail-stage" id="industry-detail-stage" aria-live="polite">
          <div class="industry-detail-placeholder" id="industry-detail-placeholder">
            <span class="industry-detail-placeholder-icon">${icon('compass')}</span>
            ${panelLabel('Choose a profile')}
            <h2>Select the business model closest to yours.</h2>
            <p>The finance attention points and Maven support scope will appear here without expanding or shifting the selector list.</p>
          </div>
          ${data.industries.map(industryDetail).join('')}
        </div>
      </div>
      <p class="industries-unlisted-note">Do not see your exact business type? <a href="/contact#inquiry">Tell us how your business operates</a> and we can map the closest finance-support scope.</p>
    </div>
  </section>

  <section class="section-pad industries-standards-section">
    <div class="container">
      <div class="industries-standards-intro reveal">
        ${eyebrowOnDark('Across Every Sector')}
        <h2>The industry changes. The finance discipline stays consistent.</h2>
        <p>Sector knowledge matters, but dependable accounting still rests on clear records, reconciliation, defined responsibilities and useful reporting.</p>
      </div>
      <div class="industries-standards-grid reveal-stagger">
        ${financeStandards.map(([number, iconName, title, text]) => `<article class="industries-standard-card">
          <div class="industries-standard-card-top"><span>${number}</span><span class="industries-standard-icon">${icon(iconName)}</span></div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
      </div>
      <div class="industries-boundary-note reveal">
        <span class="industries-boundary-icon">${icon('shield')}</span>
        <p><strong>Professional boundaries remain the same in every industry.</strong> Where statutory audit, legal, certification, valuation, regulated financial advice or other licensed work is required, that work remains with appropriately authorized independent professionals.</p>
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Tell Us About Your Business',
    title: 'Start with how the business operates, then define the finance scope',
    subtitle: 'Tell us what you sell, how money moves, which records you keep and what management needs to see. We can then shape a practical accounting, compliance or reporting starting point.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html#inquiry', 'primary'), button('View Finance Services', 'services.html', 'ghost-light')],
  })}
  `;
}

function faq() {
  const h = data.pageHeader('faq');
  const items = data.faqs.map((f, i) => accordionItem({
    id: `faq-${i}`,
    headingHtml: esc(f.q),
    bodyHtml: `<p>${esc(f.a)}</p>`,
    open: false,
    // Handbook Task 26: same reasoning as documentsNeeded() above -- no
    // preceding h2 on this page.
    headingLevel: 'h2',
  })).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/faq-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      <div class="accordion">${items}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Still Have Questions?',
    title: "We're happy to talk it through",
    subtitle: 'Book a free consultation or send us a message on WhatsApp.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I have a question about your services.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function contact() {
  const h = data.pageHeader('contact');
  const b = data.brand;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(b.mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const phoneHref = safeUrl(`tel:${b.mobile.replace(/[^\d+]/g, '')}`);
  const mailHref = safeUrl(`mailto:${b.email}`);

  const responseSteps = [
    ['01', 'Review the inquiry', 'We read the context first so the conversation starts with the right service area.'],
    ['02', 'Clarify scope', 'We confirm what is needed, who is responsible for what, and whether any specialist input is required.'],
    ['03', 'Confirm document method', 'Only after scope is clear do we agree the appropriate way to exchange working documents.'],
    ['04', 'Begin with defined next steps', 'You receive a practical starting point rather than a vague hand-off.'],
  ];

  return `
  <section class="contact-hero-premium">
    <div class="container contact-hero-grid">
      <div class="contact-hero-copy">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="contact-hero-sub">${esc(h.subtitle)}</p>
        <div class="contact-hero-actions">
          ${button('Start a Detailed Inquiry', '#inquiry', 'primary')}
          <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to discuss accounting, tax, finance or outsourced support.')}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp Maven</a>
        </div>
        <div class="contact-hero-assurances" aria-label="Inquiry assurances">
          <span>${stampMark('stamp-sm')} Free initial conversation</span>
          <span>${stampMark('stamp-sm')} No documents needed to start</span>
          <span>${stampMark('stamp-sm')} Nepal + international enquiries</span>
        </div>
      </div>

      <aside class="contact-hero-panel reveal" aria-label="Ways to start a conversation">
        <div class="contact-hero-panel-head">
          ${panelLabel('Start here')}
          <h2>Choose the channel that fits the question.</h2>
          <p>Detailed requirements are best through the inquiry form. Short questions can start by WhatsApp or live chat.</p>
        </div>
        <div class="contact-channel-list">
          <a class="contact-channel-row" href="#inquiry">
            <span class="contact-channel-index">01</span>
            <span><strong>Detailed inquiry</strong><small>Scope, business context and service need</small></span>
            ${icon('arrowRight')}
          </a>
          <a class="contact-channel-row" href="${data.whatsappHref('Hello Maven, I have a quick question about your services.')}" target="_blank" rel="noopener">
            <span class="contact-channel-index">02</span>
            <span><strong>WhatsApp</strong><small>Useful for a short first question</small></span>
            ${icon('arrowRight')}
          </a>
          <div class="contact-channel-row contact-channel-row--static">
            <span class="contact-channel-index">03</span>
            <span><strong>Live chat</strong><small>Use the website chat bubble when the team is available</small></span>
            ${icon('messageCircle')}
          </div>
        </div>
        <div class="contact-hero-panel-foot">
          ${icon('mapPin')} <span>${esc(b.addressLine)}</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="contact-proof-strip" aria-label="Contact service standards">
    <div class="container contact-proof-grid">
      <div class="contact-proof-item"><strong>Within one business day</strong><span>Typical response target for website inquiries.</span></div>
      <div class="contact-proof-item"><strong>Kathmandu based</strong><span>Direct access to the Maven team in New Baneshwor.</span></div>
      <div class="contact-proof-item"><strong>Confidential by default</strong><span>General inquiry first; sensitive records only through an agreed method.</span></div>
      <div class="contact-proof-item"><strong>Cross-border friendly</strong><span>Remote accounting and finance conversations welcomed internationally.</span></div>
    </div>
  </section>

  <section class="section-pad contact-routing-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Where You Are Starting',
        title: 'Tell us the business problem before the paperwork',
        subtitle: 'A useful first conversation starts with context. Choose the closest route below, then use the inquiry form to describe what is happening.',
      })}
      <div class="contact-routing-grid reveal-stagger">
        <a class="contact-route-card" href="#inquiry">
          <span class="contact-route-icon">${icon('building')}</span>
          <span class="contact-route-kicker">Nepal businesses</span>
          <h3>Setup, tax, payroll & accounting</h3>
          <p>For registrations, routine compliance, bookkeeping, payroll, reporting and practical finance support in Nepal.</p>
          <span class="contact-route-link">Start the inquiry ${icon('arrowRight')}</span>
        </a>
        <a class="contact-route-card" href="#inquiry">
          <span class="contact-route-icon">${icon('globe')}</span>
          <span class="contact-route-kicker">International support</span>
          <h3>Remote accounting & finance delivery</h3>
          <p>For international businesses or accounting firms looking for bookkeeping, reconciliation, reporting or Virtual CFO support.</p>
          <span class="contact-route-link">Discuss the scope ${icon('arrowRight')}</span>
        </a>
        <a class="contact-route-card" href="#inquiry">
          <span class="contact-route-icon">${icon('compass')}</span>
          <span class="contact-route-kicker">Not sure yet</span>
          <h3>Start with the situation, not a service name</h3>
          <p>Describe what you are trying to fix, prepare or understand. We can help identify the most relevant starting point.</p>
          <span class="contact-route-link">Ask for guidance ${icon('arrowRight')}</span>
        </a>
      </div>
    </div>
  </section>

  <section class="section-pad contact-inquiry-section" id="inquiry">
    <div class="container contact-inquiry-grid">
      <div class="contact-form-shell reveal">
        <div class="contact-form-intro">
          ${panelLabel('Detailed inquiry')}
          <h2>Tell us what you need help with</h2>
          <p>Share enough context for us to understand the problem. You do not need to prepare files or financial records before this first conversation.</p>
        </div>
        <div class="service-card contact-form-card">
          <div id="formError" class="form-error" role="alert" tabindex="-1" hidden></div>
          <form id="inquiryForm" novalidate>
            <!-- Honeypot: hidden from humans, tempting to bots. Real users leave it empty. -->
            <div class="hp-field" aria-hidden="true">
              <label for="f-company-website">Company website</label>
              <input id="f-company-website" name="company_website" type="text" tabindex="-1" autocomplete="off">
            </div>
            <div class="form-grid">
              <div class="form-field">
                <label for="f-name">Full Name</label>
                <input id="f-name" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="form-field">
                <label for="f-business">Business Name <span class="optional">(if any)</span></label>
                <input id="f-business" name="business" type="text" autocomplete="organization">
              </div>
              <div class="form-field">
                <label for="f-phone">Phone Number</label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel" required>
              </div>
              <div class="form-field">
                <label for="f-email">Email <span class="optional">(optional)</span></label>
                <input id="f-email" name="email" type="email" autocomplete="email">
              </div>
              <div class="form-field">
                <label for="f-service">Service Required</label>
                <select id="f-service" name="service" required>
                  <option value="">Select a service</option>
                  ${data.serviceOptions.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label for="f-type">Business Type</label>
                <select id="f-type" name="businessType">
                  <option value="">Select business type</option>
                  ${data.businessTypeOptions.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field full">
                <label for="f-message">Message</label>
                <textarea id="f-message" name="message" required placeholder="Briefly describe the business situation, deadline or finance support you need..."></textarea>
              </div>
            </div>
            <p class="form-hint contact-sensitive-note">${icon('shield')} <span><strong>Do not send sensitive financial records through this form.</strong> Please keep identification documents, bank statements, payroll files, tax records and other confidential business information out of the initial message. After understanding your requirements, Maven will confirm the appropriate method for document exchange.</span></p>
            <div class="form-actions contact-form-actions">
              <button type="submit" class="btn btn-primary">${icon('send')} Send Inquiry</button>
              <span class="contact-response-note">We typically respond within one business day.</span>
            </div>
          </form>

          <div id="formResult" class="form-result" hidden>
            <h3>Your inquiry is ready to send</h3>
            <p class="tag-note">We couldn't confirm your inquiry was delivered automatically. Please send it using one of the options below so we don't miss it.</p>
            <div class="form-result-summary" id="formSummaryText"></div>
            <div class="form-result-actions">
              <a id="sendEmailLink" class="btn btn-outline" href="#">${icon('mail')} Send via Email</a>
              <a id="sendWhatsAppLink" class="btn btn-whatsapp" href="#" target="_blank" rel="noopener">${icon('whatsapp')} Send via WhatsApp</a>
            </div>
          </div>
        </div>
      </div>

      <aside class="contact-next-panel reveal" aria-label="What happens after an inquiry">
        ${panelLabel('What happens next')}
        <h2>A controlled start, before document exchange.</h2>
        <p class="contact-next-intro">The first message is for context. Maven then confirms the working scope and the right handling method for any documents that may be needed.</p>
        <div class="contact-next-steps">
          ${responseSteps.map(([n, title, text]) => `<div class="contact-next-step"><span>${n}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></div>`).join('')}
        </div>
        <div class="contact-next-boundary">
          ${icon('shield')}
          <div><strong>Confidentiality starts with the inquiry.</strong><p>Maven's general website channels are for initial communication, not unrestricted transfer of sensitive finance or identity documents.</p></div>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad contact-direct-section">
    <div class="container contact-direct-grid">
      <div class="contact-direct-copy reveal">
        ${sectionHead({ eyebrow: 'Direct Contact', title: 'Prefer to speak with the team directly?', subtitle: 'Use the channel that is most practical for you. For a detailed scope, the inquiry form remains the clearest starting point.', align: 'left' })}
        <div class="contact-info-list contact-info-list--premium">
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('phone')}</span>
            <div><h3>Call / WhatsApp</h3><p><a href="${esc(phoneHref)}">${esc(b.mobile)}</a>${b.landline ? `<br>${esc(b.landline)} (office)` : ''}</p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('mail')}</span>
            <div><h3>Email</h3><p><a href="${esc(mailHref)}">${esc(b.email)}</a></p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('clock')}</span>
            <div><h3>Office Hours</h3><p>${esc(b.hours)}</p></div>
          </div>
        </div>
        <div class="contact-direct-actions">
          <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to send an inquiry.')}" target="_blank" rel="noopener">${icon('whatsapp')} Chat on WhatsApp</a>
          <a class="btn btn-outline" href="${esc(mailHref)}">${icon('mail')} Email Maven</a>
        </div>
      </div>

      <div class="contact-office-panel reveal">
        <div class="contact-office-head">
          ${panelLabel('Kathmandu office')}
          <h2>${esc(b.addressLine)}</h2>
          <p>${esc(b.addressNote)}</p>
        </div>
        <div class="contact-map">
          <iframe src="${mapSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Maven Consultancy location map"></iframe>
        </div>
        <div class="contact-office-foot">
          ${icon('mapPin')} <span>Meetings and document visits should be coordinated with the team in advance.</span>
        </div>
      </div>
    </div>
  </section>

  <section class="contact-close-band">
    <div class="container contact-close-inner reveal">
      <div>
        ${eyebrowOnDark('Not sure where to begin?')}
        <h2>Start with a short description of the situation.</h2>
        <p>You do not need to diagnose the accounting or tax problem yourself. Tell us what is happening and what outcome or deadline you are working toward.</p>
      </div>
      <div class="contact-close-actions">
        ${button('Start the Inquiry', '#inquiry', 'primary')}
        ${button('Explore Services', 'services.html', 'ghost-light')}
      </div>
    </div>
  </section>
  `;
}

module.exports = { documentsNeeded, industries, faq, contact };
