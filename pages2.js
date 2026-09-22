const data = require('./data');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, servicePhotoMeta, ctaBand,
  panelLabel, eyebrow, eyebrowOnDark, accordionItem,
} = require('./ui');
const { esc, internalHref } = require('./escape');

// Dedicated deep-dive destinations for services that already have a fuller
// specialist page. The Services page remains the architecture / discovery
// layer; these links let visitors continue without forcing every enquiry
// straight to Contact.
const SERVICE_DEEP_LINKS = {
  bookkeeping: { href: 'outsourced-accounting.html', ctaLabel: 'Explore Outsourced Accounting' },
  'nfrs-ifrs': { href: 'nfrs-ifrs.html', ctaLabel: 'Explore NFRS / IFRS Support' },
};

function servicesHero(h, groups) {
  return `<section class="services-hero">
    <div class="container services-hero-grid">
      <div class="services-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="services-hero-sub">${esc(h.subtitle)}</p>
        <div class="services-hero-actions">
          ${button('Book a Free Initial Consultation', 'contact.html', 'primary')}
          ${button('Explore International Support', 'global-outsourcing.html', 'ghost-light')}
        </div>
        <div class="services-hero-assurances" aria-label="Maven service model">
          <span>${stampMark('stamp-sm')} Nepal compliance expertise</span>
          <span>${stampMark('stamp-sm')} Ongoing finance support</span>
          <span>${stampMark('stamp-sm')} Remote international delivery</span>
        </div>
      </div>

      <aside class="services-map reveal" aria-label="Services overview">
        <div class="services-map-head">
          ${panelLabel('Service architecture')}
          <h2>Seven capabilities. One connected finance workflow.</h2>
          <p>Start with the support you need today and keep the finance work connected as the business grows.</p>
        </div>
        <nav class="services-map-list" aria-label="Jump to a service group">
          ${groups.map((group, i) => `<a href="#${esc(group.id)}">
            <span class="services-map-number">0${i + 1}</span>
            <span class="services-map-copy"><strong>${esc(group.title)}</strong><small>${esc(group.services)}</small></span>
            <span class="services-map-arrow" aria-hidden="true">${icon('arrowRight')}</span>
          </a>`).join('')}
        </nav>
        <div class="services-map-foot">Project-based · Monthly · Specialist support</div>
      </aside>
    </div>
  </section>`;
}

function serviceDetailEntry(cat, index, opts = {}) {
  const href = opts.href || 'contact.html';
  const ctaLabel = opts.ctaLabel || 'Discuss This Service';
  return `<article class="services-detail-card reveal" id="${esc(cat.key)}">
    <div class="services-detail-summary">
      <div class="services-detail-heading">
        <span class="service-icon">${icon(cat.icon)}</span>
        <span class="services-detail-index">${String(index).padStart(2, '0')}</span>
      </div>
      <h3>${esc(cat.title)}</h3>
      <p>${esc(cat.tagline)}</p>
      <a class="services-text-link" href="${internalHref(href)}" aria-label="${esc(ctaLabel + ' — ' + cat.title)}"><span>${esc(ctaLabel)}</span>${icon('arrowRight')}</a>
    </div>
    <div class="services-detail-scope">
      <span class="services-detail-scope-label">Typical support</span>
      <ul>
        ${cat.items.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
      </ul>
    </div>
  </article>`;
}

function servicesChapter({ id, number, eyebrowLabel, title, text, image, categories, startIndex, bg = '' }) {
  return `<section class="section-pad services-chapter${bg ? ' ' + bg : ''}" id="${esc(id)}">
    <div class="container services-chapter-layout">
      <div class="services-chapter-rail reveal">
        <div class="services-chapter-photo">
          <img src="/images/${esc(image.file)}.jpg" srcset="/images/${esc(image.file)}-640w.jpg 640w, /images/${esc(image.file)}-960w.jpg 960w" sizes="(min-width: 980px) 34vw, 100vw" alt="${esc(image.alt)}" loading="lazy" decoding="async">
          <span class="services-chapter-photo-shade" aria-hidden="true"></span>
          <span class="services-chapter-number" aria-hidden="true">${esc(number)}</span>
        </div>
        <div class="services-chapter-intro">
          ${eyebrow(eyebrowLabel)}
          <h2>${esc(title)}</h2>
          <p>${esc(text)}</p>
        </div>
      </div>
      <div class="services-detail-list">
        ${categories.map((cat, offset) => serviceDetailEntry(cat, startIndex + offset, SERVICE_DEEP_LINKS[cat.key])).join('')}
      </div>
    </div>
  </section>`;
}

function services() {
  const h = data.pageHeader('services');
  const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
  const registration = byKey('registration');
  const tax = byKey('tax');
  const payroll = byKey('payroll');
  const bookkeeping = byKey('bookkeeping');
  const reporting = byKey('reporting');
  const advisory = byKey('advisory');
  const nfrsIfrs = byKey('nfrs-ifrs');

  const groups = [
    {
      id: 'establish-and-comply',
      title: 'Establish & Stay Compliant',
      services: 'Registration · Tax · Payroll',
    },
    {
      id: 'run-your-finance-function',
      title: 'Run Your Finance Function',
      services: 'Accounting · Reporting',
    },
    {
      id: 'advise-and-report-better',
      title: 'Advise, Report & Scale',
      services: 'Advisory · NFRS / IFRS',
    },
  ];

  const engagementModels = [
    {
      number: '01',
      title: 'Project-based support',
      text: 'For registrations, accounting clean-up, implementation work, financial statements, planning assignments, and clearly defined one-off needs.',
    },
    {
      number: '02',
      title: 'Ongoing monthly support',
      text: 'For businesses that need recurring bookkeeping, payroll, tax compliance, reconciliations, management reporting, and deadline follow-through.',
    },
    {
      number: '03',
      title: 'Specialist finance support',
      text: 'For reporting complexity, NFRS / IFRS implementation, budgeting, forecasting, finance-process improvement, and management decision support.',
    },
  ];

  return `
  ${servicesHero(h, groups)}

  <section class="services-intro-strip">
    <div class="container services-intro-grid reveal-stagger">
      <div class="services-intro-point"><strong>One connected scope</strong><span>Accounting, compliance and reporting designed to work together.</span></div>
      <div class="services-intro-point"><strong>Built around your stage</strong><span>From first registration to a more structured finance function.</span></div>
      <div class="services-intro-point"><strong>Local + international</strong><span>Nepal-based delivery with remote support for international teams.</span></div>
      <div class="services-intro-point"><strong>Clear responsibility</strong><span>Defined deliverables, document needs and communication from the start.</span></div>
    </div>
  </section>

  <section class="section-pad services-architecture-intro">
    <div class="container services-architecture-grid">
      <div class="reveal">
        ${eyebrow('Finance Service Architecture')}
        <h2>Support that stays connected as your finance needs change.</h2>
      </div>
      <div class="services-architecture-copy reveal">
        <p>Finance work becomes harder to control when registration, bookkeeping, tax, payroll and reporting are treated as unrelated tasks. Maven structures them as connected parts of the same finance workflow.</p>
        <p>Choose a focused service, an ongoing monthly scope, or a broader outsourced finance relationship. The work can expand as your transaction volume, reporting requirements and management needs become more complex.</p>
      </div>
    </div>
  </section>

  ${servicesChapter({
    id: 'establish-and-comply',
    number: '01',
    eyebrowLabel: 'Establish & Stay Compliant',
    title: 'Build the right foundation and keep routine obligations under control.',
    text: 'For businesses setting up, formalizing operations, or needing a more dependable rhythm around recurring tax, payroll and compliance work.',
    image: servicePhotoMeta(tax),
    categories: [registration, tax, payroll],
    startIndex: 1,
    bg: 'bg-mist',
  })}

  ${servicesChapter({
    id: 'run-your-finance-function',
    number: '02',
    eyebrowLabel: 'Run Your Finance Function',
    title: 'Keep the books current and turn monthly accounting into useful management information.',
    text: 'A practical outsourced finance layer for businesses that need organized records, reconciliations, clearer month-end reporting and more visibility without building a full in-house team.',
    image: servicePhotoMeta(bookkeeping),
    categories: [bookkeeping, reporting],
    startIndex: 4,
  })}

  ${servicesChapter({
    id: 'advise-and-report-better',
    number: '03',
    eyebrowLabel: 'Advise, Report & Scale',
    title: 'Add deeper finance thinking as decisions and reporting requirements become more complex.',
    text: 'Move beyond routine recordkeeping with planning, forecasting, process improvement and structured financial reporting support for management, lenders and other stakeholders.',
    image: servicePhotoMeta(reporting),
    categories: [advisory, nfrsIfrs],
    startIndex: 6,
    bg: 'bg-mist',
  })}

  <section class="section-pad services-global-section">
    <div class="container services-global-grid">
      <div class="services-global-copy reveal">
        ${eyebrowOnDark('Global Outsourced Finance')}
        <h2>Knowledge-led finance support for international businesses and accounting firms.</h2>
        <p>For teams outside Nepal, Maven provides remote accounting support from Kathmandu across day-to-day bookkeeping, reconciliations, reporting and higher-skill management finance work. Engagements are scoped around the work you want to hand off and the systems you already use.</p>
        <div class="services-global-actions">
          ${button('Explore International Services', 'global-outsourcing.html', 'primary')}
          ${button('Discuss a Remote Finance Scope', 'contact.html', 'ghost-light')}
        </div>
      </div>
      <div class="services-global-paths reveal-stagger">
        <a href="${internalHref('international-accounting.html')}" class="services-global-path">
          <span class="services-global-path-index">01</span>
          <div><h3>Remote Accounting Support</h3><p>Bookkeeping, reconciliations, accounting schedules and recurring reporting support.</p></div>
          ${icon('arrowRight')}
        </a>
        <a href="${internalHref('virtual-cfo.html')}" class="services-global-path">
          <span class="services-global-path-index">02</span>
          <div><h3>Virtual CFO & Management Reporting</h3><p>Budgets, forecasts, management packs and finance insight built on reliable accounting records.</p></div>
          ${icon('arrowRight')}
        </a>
      </div>
    </div>
  </section>

  <section class="section-pad services-engagement-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Engagement Model',
        title: 'Start with the scope you need. Expand when it becomes useful.',
        subtitle: 'We define responsibilities, information requirements, timing and deliverables before recurring work begins.',
        align: 'left',
      })}
      <div class="services-engagement-grid reveal-stagger">
        ${engagementModels.map((item) => `<article class="services-engagement-card">
          <span class="services-engagement-number">${item.number}</span>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
        </article>`).join('')}
      </div>
      <div class="services-boundary-note reveal">
        <div>
          ${panelLabel('Professional boundaries')}
          <h2 class="partner-note-title">Support Through Partners</h2>
          <p class="services-boundary-lead">Specialist regulated work stays with the appropriately licensed professional.</p>
        </div>
        <p>${esc(data.partnerNote)} Maven positions itself as a business consultancy and outsourced accounts/compliance partner — not as a statutory audit firm or CA firm.</p>
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Build The Right Finance Scope',
    title: 'Tell us what is taking time, creating risk, or limiting financial visibility.',
    subtitle: 'We will help map the right starting scope — from one focused requirement to ongoing outsourced finance support.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('See Documents You May Need', 'documents-needed.html', 'ghost-light')],
  })}
  `;
}

function outsourcedNepalHero(h) {
  const operatingModel = [
    {
      title: 'Source records',
      text: 'Sales, purchases, bank records, payroll inputs and other agreed source documents are organized to a recurring schedule.',
    },
    {
      title: 'Record & reconcile',
      text: 'Transactions are posted, ledgers are kept current and agreed balance-sheet and bank accounts are reconciled.',
    },
    {
      title: 'Review & resolve',
      text: 'Missing documents, unusual balances and exceptions are surfaced for clarification before the monthly cycle is closed.',
    },
    {
      title: 'Track & report',
      text: 'Compliance dates, payroll/accounting handoffs and agreed monthly reporting are brought into one visible finance rhythm.',
    },
  ];

  return `<section class="outsourced-nepal-hero">
    <div class="container outsourced-nepal-hero-grid">
      <div class="outsourced-nepal-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="outsourced-nepal-hero-sub">${esc(h.subtitle)}</p>
        <div class="outsourced-nepal-hero-actions">
          ${button('Discuss Monthly Accounting', 'contact.html', 'primary')}
          ${button('See the Monthly Scope', '#monthly-scope', 'ghost-light')}
        </div>
        <div class="outsourced-nepal-hero-assurances" aria-label="Nepal outsourced accounting model">
          <span>${stampMark('stamp-sm')} Kathmandu-based team</span>
          <span>${stampMark('stamp-sm')} Recurring monthly workflow</span>
          <span>${stampMark('stamp-sm')} Accounting + compliance coordination</span>
        </div>
      </div>

      <aside class="outsourced-nepal-model reveal" aria-label="Monthly finance operating model">
        <div class="outsourced-nepal-model-head">
          ${panelLabel('Monthly finance operating model')}
          <h2>A dependable rhythm around the books.</h2>
          <p>Outsourcing works best when responsibilities, source records, review points and outputs are clear before the month begins.</p>
        </div>
        <div class="outsourced-nepal-model-list">
          ${operatingModel.map((item, i) => `<div class="outsourced-nepal-model-item">
            <span class="outsourced-nepal-model-index">0${i + 1}</span>
            <div><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="outsourced-nepal-model-foot">Bookkeeping · reconciliations · compliance tracking · reporting</div>
      </aside>
    </div>
  </section>`;
}

function outsourcedScopeItem({ iconName, title, text }) {
  return `<article class="outsourced-scope-item reveal">
    <span class="outsourced-scope-icon">${icon(iconName)}</span>
    <div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>
  </article>`;
}

function outsourcedAccounting() {
  const h = data.pageHeader('outsourced-accounting');
  const o = data.outsourced || {};

  const fitSignals = [
    'The owner or operations team is spending too much time following up bookkeeping and finance records.',
    'Transaction volume is growing faster than the current accounting routine can comfortably handle.',
    'VAT, TDS, payroll and other recurring finance deadlines need a more dependable monthly rhythm.',
    'Management needs regular financial visibility but a larger in-house finance department is not yet the right operating model.',
  ];

  const monthlyScope = [
    {
      iconName: 'ledger',
      title: 'Bookkeeping & ledgers',
      text: 'Routine transactions are recorded and organized so the accounting records stay current and usable.',
    },
    {
      iconName: 'link2',
      title: 'Reconciliations & schedules',
      text: 'Bank, selected balance-sheet accounts and supporting schedules are reconciled to help identify missing or unusual items.',
    },
    {
      iconName: 'briefcase',
      title: 'Payables & receivables support',
      text: 'Agreed supplier, customer and document follow-up can be built into the monthly accounting workflow where it is part of scope.',
    },
    {
      iconName: 'users',
      title: 'Payroll accounting support',
      text: 'Payroll inputs, payroll-related accounting records and recurring finance handoffs can be coordinated with the agreed service scope.',
    },
    {
      iconName: 'percent',
      title: 'VAT / TDS & tax coordination',
      text: 'Recurring tax and compliance requirements can be tracked alongside the books so accounting records and filing support stay connected.',
    },
    {
      iconName: 'barChart',
      title: 'Monthly reporting',
      text: 'Agreed financial summaries and reporting outputs give owners and management a clearer view of the month once the accounting cycle is complete.',
    },
  ];

  const monthlyCycle = [
    {
      title: 'Collect & organize',
      text: 'Agree the source documents, responsible people and cut-off dates needed for the month.',
    },
    {
      title: 'Record & reconcile',
      text: 'Post transactions, maintain ledgers and complete the agreed account reconciliations and schedules.',
    },
    {
      title: 'Review & query',
      text: 'Identify missing records, exceptions and unusual balances before reporting or compliance work moves forward.',
    },
    {
      title: 'Track obligations',
      text: 'Keep agreed VAT, TDS, payroll and other recurring finance deadlines visible alongside the accounting work.',
    },
    {
      title: 'Report & follow through',
      text: 'Deliver the agreed monthly outputs, surface open items and carry unresolved actions into the next cycle.',
    },
  ];

  const growthPath = [
    {
      number: '01',
      title: 'Core monthly books',
      text: 'Start with bookkeeping, reconciliations and cleaner source records.',
    },
    {
      number: '02',
      title: 'Compliance coordination',
      text: 'Connect VAT/TDS, payroll and recurring compliance responsibilities to the accounting cycle.',
    },
    {
      number: '03',
      title: 'Management reporting',
      text: 'Add more structured monthly reporting as owners and managers need better visibility.',
    },
    {
      number: '04',
      title: 'Planning & Virtual CFO',
      text: 'Layer in budgets, cash-flow forecasting, KPIs and decision support when the business is ready for deeper finance management.',
    },
  ];

  return `
  ${outsourcedNepalHero(h)}

  <section class="outsourced-proof-strip" aria-label="Outsourced accounting engagement principles">
    <div class="container outsourced-proof-grid reveal-stagger">
      <div class="outsourced-proof-item"><strong>Nepal businesses</strong><span>Built for growing local operations.</span></div>
      <div class="outsourced-proof-item"><strong>Monthly rhythm</strong><span>Recurring books, review and follow-through.</span></div>
      <div class="outsourced-proof-item"><strong>Connected scope</strong><span>Accounting, payroll and compliance can work together.</span></div>
      <div class="outsourced-proof-item"><strong>Scalable support</strong><span>Start focused and expand with the business.</span></div>
    </div>
  </section>

  <section class="section-pad outsourced-fit-section">
    <div class="container outsourced-fit-grid">
      <div class="outsourced-fit-copy reveal">
        ${eyebrow('When Outsourcing Makes Sense')}
        <h2>More structure than ad-hoc bookkeeping. Less overhead than building a full finance team too early.</h2>
        <p>${esc(o.paragraph || '')}</p>
        <p>For many growing businesses, the key question is not simply whether the books can be entered. It is whether the monthly finance routine is organized enough to support compliance, reporting and management follow-through.</p>
        <div class="outsourced-fit-note">
          <strong>Outsourcing is not the right answer for every finance role.</strong>
          <span>Businesses that need continuous on-site control, high-volume daily approvals or a larger internal finance structure may still need dedicated in-house staff. Maven can support a defined part of that wider model where appropriate.</span>
        </div>
      </div>
      <div class="outsourced-fit-signals reveal-stagger" aria-label="Common signs a business may benefit from outsourced accounting">
        ${fitSignals.map((item, i) => `<div class="outsourced-fit-signal">
          <span>0${i + 1}</span>
          <p>${esc(item)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad outsourced-scope-section bg-mist" id="monthly-scope">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Monthly Finance Scope',
        title: 'What an outsourced accounting relationship can cover',
        subtitle: 'The exact scope depends on transaction volume, systems, internal responsibilities and the level of support agreed. These are the recurring areas Maven can connect into one monthly workflow.',
      })}
      <div class="outsourced-scope-grid">
        ${monthlyScope.map(outsourcedScopeItem).join('')}
      </div>
      <p class="outsourced-scope-note reveal">Scope is agreed before recurring work begins. Tax filing, payroll processing and other compliance tasks are included only where specifically agreed and where they fall within Maven's professional service scope.</p>
      <div class="outsourced-benefits reveal" aria-label="Benefits of the outsourced accounting model">
        <span class="outsourced-benefits-label">Designed for a more dependable finance routine</span>
        <div class="outsourced-benefits-grid">
          ${(o.benefits || []).map((item) => `<div>${stampMark('stamp-sm')}<span>${esc(item)}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="section-pad outsourced-cycle-section">
    <div class="container outsourced-cycle-layout">
      <div class="outsourced-cycle-intro reveal">
        ${eyebrowOnDark('A Repeatable Monthly Cycle')}
        <h2>Consistency matters more than last-minute catch-up.</h2>
        <p>A strong outsourced model turns accounting from an occasional clean-up exercise into a visible monthly operating routine—with clear inputs, review points and outputs.</p>
        <div class="outsourced-cycle-actions">
          ${button('Discuss Your Current Process', 'contact.html', 'primary')}
        </div>
      </div>
      <div class="outsourced-cycle-list reveal-stagger">
        ${monthlyCycle.map((step, i) => `<article class="outsourced-cycle-step">
          <span class="outsourced-cycle-number">0${i + 1}</span>
          <div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad outsourced-controls-section">
    <div class="container">
      <div class="outsourced-controls-head reveal">
        ${eyebrow('Controls, Handoffs & Responsibility')}
        <h2>Outsourcing should make responsibilities clearer—not blur them.</h2>
        <p>The relationship works best when the business and Maven both know what information is required, who approves decisions, what gets reviewed, and what sits outside the agreed scope.</p>
      </div>
      <div class="outsourced-controls-grid reveal-stagger">
        <article class="outsourced-control-card">
          <span class="outsourced-control-icon">${icon('shield')}</span>
          <h3>Confidential information handling</h3>
          <p>Financial records should move through agreed channels with access limited to what the work requires. Sensitive banking, payroll, tax or identity documents should not be sent through website chat.</p>
          <a href="${internalHref('privacy.html')}" class="outsourced-text-link"><span>Read the Privacy Policy</span>${icon('arrowRight')}</a>
        </article>
        <article class="outsourced-control-card">
          <span class="outsourced-control-icon">${icon('check')}</span>
          <h3>Review before reporting</h3>
          <p>Open questions, missing documents and unusual balances should be surfaced and resolved as far as practical before agreed monthly reports or compliance outputs are finalized.</p>
          <a href="${internalHref('documents-needed.html')}" class="outsourced-text-link"><span>See Document Guidance</span>${icon('arrowRight')}</a>
        </article>
        <article class="outsourced-control-card outsourced-control-card--boundary">
          <span class="outsourced-control-icon">${icon('briefcase')}</span>
          <h3>Management keeps business responsibility</h3>
          <p>Maven provides accounting, compliance and finance support within the agreed engagement. Management remains responsible for business decisions, approvals and the completeness of information supplied. Statutory audit, legal opinions and other regulated work remain with appropriately authorized professionals.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section-pad outsourced-growth-section bg-mist">
    <div class="container outsourced-growth-grid">
      <div class="outsourced-growth-copy reveal">
        ${eyebrow('Built to Grow With the Business')}
        <h2>Start with reliable books. Add finance capability when it becomes useful.</h2>
        <p>The outsourced accounting relationship does not need to begin as a full finance department. A focused monthly scope can become broader over time as reporting requirements, transaction volume and management needs grow.</p>
        <div class="outsourced-growth-actions">
          ${button('Explore Virtual CFO Support', 'virtual-cfo.html', 'outline')}
          ${button('View Accounting Packages', 'packages.html', 'outline')}
        </div>
      </div>
      <div class="outsourced-growth-path reveal-stagger" aria-label="Outsourced finance growth path">
        ${growthPath.map((item) => `<article class="outsourced-growth-step">
          <span>${esc(item.number)}</span>
          <div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad outsourced-faq-section">
    <div class="container outsourced-faq-wrap">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'Outsourced accounting for Nepal businesses' })}
      <div class="accordion">
        ${(o.faqs || []).map((f, i) => accordionItem({
          id: `outsourced-faq-${i}`,
          headingHtml: esc(f.q),
          bodyHtml: `<p>${esc(f.a)}</p>`,
          open: false,
        })).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Monthly Accounting Support',
    title: 'Ready to make the monthly finance routine more dependable?',
    subtitle: o.cta || 'Tell us how your monthly accounting process works today. We can help define a practical starting scope.',
    buttons: [button('Discuss Monthly Accounting', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to discuss outsourced accounting support for our Nepal business.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function globalHubHero(h) {
  return `<section class="global-hub-hero">
    <div class="container global-hub-hero-grid">
      <div class="global-hub-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="global-hub-hero-sub">${esc(h.subtitle)}</p>
        <div class="global-hub-hero-actions">
          ${button('Book a Free Discovery Call', 'contact.html', 'primary')}
          ${button('Explore Remote Accounting', 'international-accounting.html', 'ghost-light')}
        </div>
        <div class="global-hub-hero-assurances" aria-label="International delivery model">
          <span>${stampMark('stamp-sm')} Kathmandu-based delivery</span>
          <span>${stampMark('stamp-sm')} Direct team communication</span>
          <span>${stampMark('stamp-sm')} Defined professional scope</span>
        </div>
      </div>

      <aside class="global-hub-brief reveal" aria-label="International finance support overview">
        <div class="global-hub-brief-head">
          ${panelLabel('International delivery model')}
          <h2>Two levels of support. One connected finance workflow.</h2>
          <p>Start with the accounting capacity you need today, then add deeper management-finance support when it creates value.</p>
        </div>
        <div class="global-hub-brief-paths">
          <a href="${internalHref('international-accounting.html')}" class="global-hub-brief-path">
            <span class="global-hub-brief-index">01</span>
            <span><strong>Remote Accounting Support</strong><small>Bookkeeping · reconciliations · month-end · reporting</small></span>
            ${icon('arrowRight')}
          </a>
          <a href="${internalHref('virtual-cfo.html')}" class="global-hub-brief-path">
            <span class="global-hub-brief-index">02</span>
            <span><strong>Virtual CFO &amp; Management Reporting</strong><small>Budgets · forecasts · KPIs · decision support</small></span>
            ${icon('arrowRight')}
          </a>
        </div>
        <div class="global-hub-brief-foot">
          <span>${icon('mapPin')} Kathmandu, Nepal</span>
          <span>${icon('globe')} Remote international delivery</span>
        </div>
      </aside>
    </div>
  </section>`;
}

function globalSupportTrack({ number, iconName, eyebrowLabel, title, text, items, href, cta, note }) {
  return `<article class="global-support-track reveal">
    <div class="global-support-track-head">
      <span class="global-support-track-number">${esc(number)}</span>
      <span class="global-support-track-icon">${icon(iconName)}</span>
    </div>
    ${eyebrow(eyebrowLabel)}
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    <ul class="global-support-track-list">
      ${items.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
    </ul>
    ${note ? `<p class="global-support-track-note">${esc(note)}</p>` : ''}
    <a class="global-support-track-link" href="${internalHref(href)}"><span>${esc(cta)}</span>${icon('arrowRight')}</a>
  </article>`;
}

function globalOutsourcing() {
  const h = data.pageHeader('global-outsourcing');
  const hub = data.internationalHub || {};
  const accounting = data.internationalAccounting || {};

  const deliveryStandards = [
    {
      iconName: 'users',
      title: 'Direct communication',
      text: 'Work with the people responsible for the agreed finance scope rather than unnecessary account-management layers.',
    },
    {
      iconName: 'laptop',
      title: 'Work inside existing systems',
      text: 'Where practical, Maven works within the accounting, spreadsheet, cloud and task-management tools your team already uses.',
    },
    {
      iconName: 'clock',
      title: 'Structured remote workflow',
      text: 'Responsibilities, response expectations, review points and recurring deadlines are agreed so work can move across time zones predictably.',
    },
    {
      iconName: 'shield',
      title: 'Controlled access',
      text: 'Financial information is handled on a confidential basis, with access limited to the people and permissions needed for the engagement.',
    },
  ];

  const process = [
    {
      title: 'Understand the current finance setup',
      text: 'We start with your existing team, accounting software, monthly volume, reporting needs and the work that is consuming capacity today.',
    },
    {
      title: 'Define a practical starting scope',
      text: 'Responsibilities, outputs, access requirements and review points are written down before recurring work begins.',
    },
    {
      title: 'Connect to the tools already in use',
      text: 'Where practical, work stays inside your current accounting and cloud environment rather than forcing an unnecessary system migration.',
    },
    {
      title: 'Deliver, review and resolve exceptions',
      text: 'Completed work, missing information, questions and exceptions move through an agreed communication and review workflow.',
    },
    {
      title: 'Expand only when the workflow is proven',
      text: 'A defined initial scope can grow into recurring accounting, reporting or Virtual CFO support once both teams are comfortable with delivery.',
    },
  ];

  const firmItems = ((accounting.firmSupport || {}).items || []).slice(0, 6);
  const startItems = ((accounting.startSmall || {}).items || []).slice(0, 6);
  const tools = ((accounting.tools || {}).items || []).slice(0, 6);

  return `
  ${globalHubHero(h)}

  <section class="global-proof-strip" aria-label="International engagement principles">
    <div class="container global-proof-grid reveal-stagger">
      <div class="global-proof-item"><strong>Nepal-based team</strong><span>Kathmandu delivery, stated clearly.</span></div>
      <div class="global-proof-item"><strong>Your systems</strong><span>Work within existing tools where practical.</span></div>
      <div class="global-proof-item"><strong>Defined scope</strong><span>Responsibilities and outputs agreed first.</span></div>
      <div class="global-proof-item"><strong>Two audiences</strong><span>Businesses and accounting firms.</span></div>
    </div>
  </section>

  <section class="section-pad global-operating-section">
    <div class="container global-operating-grid">
      <div class="global-operating-intro reveal">
        ${eyebrow('Cross-Border Finance Operations')}
        <h2>Outsourcing should add finance capacity without adding confusion.</h2>
        <p>${esc(hub.intro || '')}</p>
        <p>The operating model matters as much as the task list: clear ownership, controlled access, written communication and a scope that can expand only after the working rhythm is reliable.</p>
      </div>
      <div class="global-standard-list reveal-stagger" aria-label="International delivery standards">
        ${deliveryStandards.map((item, i) => `<article class="global-standard-item">
          <span class="global-standard-index">0${i + 1}</span>
          <span class="global-standard-icon">${icon(item.iconName)}</span>
          <div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad global-support-section bg-mist">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Two Levels of International Support',
        title: 'Start with reliable accounting. Add deeper finance insight when you need it.',
        subtitle: 'The two service levels are designed to connect: accurate records first, then management reporting, forecasting and decision support on top of that foundation.',
      })}
      <div class="global-support-grid">
        ${globalSupportTrack({
          number: '01',
          iconName: 'ledger',
          eyebrowLabel: 'Remote Accounting Support',
          title: 'Day-to-day finance operations',
          text: 'For businesses and accounting firms that need dependable recurring capacity around bookkeeping, reconciliations, account schedules and month-end work.',
          items: [
            'Bookkeeping and transaction categorization',
            'Bank and credit-card reconciliation',
            'Accounts payable and receivable support',
            'Month-end accounting support',
            'Monthly financial reporting',
            'Busy-period capacity for accounting firms',
          ],
          href: 'international-accounting.html',
          cta: 'Explore Remote Accounting Support',
        })}
        ${globalSupportTrack({
          number: '02',
          iconName: 'barChart',
          eyebrowLabel: 'Virtual CFO & Management Reporting',
          title: 'Higher-skill management finance',
          text: 'For management teams that already have reliable accounting records but need better visibility into cash, performance, budgets, forecasts and financial decisions.',
          items: [
            'Monthly management reporting',
            'Cash-flow forecasting',
            'Budgets and rolling forecasts',
            'KPI and performance reporting',
            'Working-capital visibility',
            'Scenario and decision support',
          ],
          note: 'This is the knowledge-process (KPO) layer of the model: analytical finance work built on reliable accounting information, not a replacement for jurisdiction-specific regulated advice.',
          href: 'virtual-cfo.html',
          cta: 'Explore Virtual CFO Support',
        })}
      </div>
      <p class="global-support-bridge reveal">Many engagements can begin with a defined accounting scope and expand into management reporting or Virtual CFO support only when the accounting foundation and working process are ready.</p>
    </div>
  </section>

  <section class="section-pad global-process-section">
    <div class="container global-process-layout">
      <div class="global-process-intro reveal">
        ${eyebrow('A Controlled Delivery Model')}
        <h2>Designed for remote work that still needs clear ownership.</h2>
        <p>International finance support works best when the handoffs are visible. Maven's approach is to define the workflow first, then make the recurring work predictable.</p>
        <div class="global-process-actions">
          ${button('Discuss Your Current Workflow', 'contact.html', 'outline')}
        </div>
      </div>
      <div class="global-process-list reveal-stagger">
        ${process.map((step, i) => `<article class="global-process-step">
          <span class="global-process-number">0${i + 1}</span>
          <div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad global-partner-section">
    <div class="container global-partner-grid">
      <div class="global-partner-copy reveal">
        ${eyebrowOnDark('Support for Accounting Firms')}
        <h2>Back-office finance capacity that stays behind your client relationship.</h2>
        <p>${esc((accounting.firmSupport || {}).intro || '')}</p>
        <p class="global-partner-note">${esc((accounting.firmSupport || {}).note || '')}</p>
        <div class="global-partner-actions">
          ${button('Discuss Partner-Firm Support', 'contact.html', 'primary')}
          ${button('See Full Accounting Scope', 'international-accounting.html', 'ghost-light')}
        </div>
      </div>
      <div class="global-partner-scope reveal">
        ${panelLabel('Potential back-office scope')}
        <ul>
          ${firmItems.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
        </ul>
        <div class="global-tool-row" aria-label="Common working tools">
          ${tools.map((tool) => `<span>${esc(tool)}</span>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="section-pad global-controls-section bg-mist">
    <div class="container">
      <div class="global-controls-head reveal">
        ${eyebrow('Trust, Access & Responsibility')}
        <h2>Controls matter as much as capacity.</h2>
        <p>Finance work crosses company boundaries in an outsourced relationship, so access, confidentiality and professional responsibility need to be explicit from the beginning.</p>
      </div>
      <div class="global-controls-grid reveal-stagger">
        <article class="global-control-card">
          <span class="global-control-icon">${icon('shield')}</span>
          <h3>Confidential information handling</h3>
          <p>Client information is handled on a confidential basis. Maven is open to appropriate confidentiality or non-disclosure arrangements, and access should be limited to what the agreed work requires.</p>
        </article>
        <article class="global-control-card">
          <span class="global-control-icon">${icon('laptop')}</span>
          <h3>Controlled system access</h3>
          <p>Where practical, work stays inside the client's existing accounting and cloud environment. Credentials should not be shared through unsecured channels, and permissions should match the scope.</p>
        </article>
        <article class="global-control-card global-control-card--boundary">
          <span class="global-control-icon">${icon('briefcase')}</span>
          <h3>Clear professional boundaries</h3>
          <p>Maven provides accounting, reconciliation, management reporting and finance-support services. Jurisdiction-specific tax filing, statutory audit, legal opinions and other regulated services remain with appropriately authorized professionals in the client's jurisdiction.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section-pad global-start-section">
    <div class="container global-start-grid">
      <div class="global-start-copy reveal">
        ${eyebrow('Start With a Controlled Scope')}
        <h2>You do not need to outsource the whole finance function on day one.</h2>
        <p>A first engagement can focus on one defined accounting problem, giving both teams a practical way to test communication, workflow and work quality before expanding the scope.</p>
        <p class="global-start-note">${esc((accounting.startSmall || {}).note || '')}</p>
      </div>
      <div class="global-start-panel reveal">
        ${panelLabel('Good first engagement examples')}
        <div class="global-start-items">
          ${startItems.map((item, i) => `<div><span>0${i + 1}</span><strong>${esc(item)}</strong></div>`).join('')}
        </div>
        <div class="global-start-actions">
          ${button('Book a Free Discovery Call', 'contact.html', 'primary')}
        </div>
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Global Finance Delivery',
    title: 'Need dependable finance capacity across borders?',
    subtitle: hub.cta || 'Book a Free Discovery Call',
    buttons: [button('Book a Free Discovery Call', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about international accounting and finance support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function packagesHero(h) {
  const scopeRows = [
    ['Transaction volume', 'How much recurring accounting activity needs to be handled.'],
    ['People & payroll', 'Employee count and payroll-support requirements where relevant.'],
    ['Accounts & entities', 'The number of bank accounts, entities, or records in scope.'],
    ['Record quality', 'How complete, current, and organized the starting records are.'],
    ['Reporting needs', 'The level of monthly reporting, schedules, or management visibility required.'],
    ['Timing & urgency', 'Deadline pressure, catch-up work, or other time-sensitive requirements.'],
  ];

  return `<section class="packages-premium-hero">
    <picture class="packages-premium-hero-photo" aria-hidden="true">
      <source media="(max-width: 767px)" srcset="/images/packages-hero-bg-640w.jpg">
      <source media="(max-width: 1279px)" srcset="/images/packages-hero-bg-960w.jpg">
      <img src="/images/packages-hero-bg.jpg" alt="" decoding="async">
    </picture>
    <div class="packages-premium-hero-shade" aria-hidden="true"></div>
    <div class="container packages-premium-hero-grid">
      <div class="packages-premium-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="packages-premium-hero-sub">${esc(h.subtitle)}</p>
        <div class="packages-premium-hero-actions">
          ${button('Compare Starting Points', '#engagement-starting-points', 'primary')}
          ${button('Discuss Your Scope', 'contact.html#inquiry', 'ghost-light')}
        </div>
        <div class="packages-premium-hero-assurances" aria-label="Package approach">
          <span>${stampMark('stamp-sm')} 3 practical starting points</span>
          <span>${stampMark('stamp-sm')} Quote after scope review</span>
          <span>${stampMark('stamp-sm')} Custom combinations available</span>
        </div>
      </div>

      <aside class="packages-scope-panel reveal" aria-label="How Maven scopes a quotation">
        <div class="packages-scope-panel-head">
          ${panelLabel('How a quote is scoped')}
          <h2>Pricing follows the work involved.</h2>
          <p>There is no one-size-fits-all fee. Maven reviews only the factors relevant to your situation before confirming scope and price.</p>
        </div>
        <div class="packages-scope-panel-list">
          ${scopeRows.map((row, i) => `<div class="packages-scope-row">
            <span>${String(i + 1).padStart(2, '0')}</span>
            <div><strong>${esc(row[0])}</strong><small>${esc(row[1])}</small></div>
          </div>`).join('')}
        </div>
      </aside>
    </div>
  </section>`;
}

function packageEngagement(pkg, i) {
  const icons = ['rocket', 'ledger', 'trendUp'];
  const labels = ['Project starting point', 'Recurring starting point', 'Growth-stage starting point'];
  return `<article class="packages-engagement reveal">
    <div class="packages-engagement-summary">
      <div class="packages-engagement-topline">
        <span class="packages-engagement-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="packages-engagement-icon">${icon(icons[i] || 'briefcase')}</span>
      </div>
      <p class="packages-engagement-type">${esc(labels[i] || 'Engagement starting point')}</p>
      <h3>${esc(pkg.name)}</h3>
      ${pkg.tagline ? `<p class="packages-engagement-tagline">${esc(pkg.tagline)}</p>` : ''}
      <div class="packages-engagement-fit">
        <span>Best suited for</span>
        <strong>${esc(pkg.audience)}</strong>
      </div>
      ${pkg.situation ? `<p class="packages-engagement-situation"><strong>Typical situation:</strong> ${esc(pkg.situation)}</p>` : ''}
      <div class="packages-engagement-quote">
        <span>Pricing approach</span>
        <strong>Quote after review</strong>
      </div>
      <a class="packages-engagement-link" href="${internalHref('contact.html#inquiry')}"><span>Discuss this starting point</span>${icon('arrowRight')}</a>
    </div>
    <div class="packages-engagement-scope">
      ${panelLabel('Typical scope')}
      <ul>
        ${(pkg.items || []).map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
      </ul>
      <p class="packages-engagement-scope-note">Final inclusions depend on the agreed scope. A package name is a starting point, not a substitute for reviewing your actual requirements.</p>
    </div>
  </article>`;
}

function packages() {
  const h = data.pageHeader('packages');
  const feeFactors = [
    ['Transaction volume', 'Recurring entries, invoices, payments, reconciliations, and related monthly activity.'],
    ['Employee count', 'Payroll or employee-related accounting work where that support is included.'],
    ['Accounts & entities', 'The number of bank accounts, business entities, or separate records that must be maintained.'],
    ['Record quality', 'Whether records are current and organized or need cleanup, reconstruction, or catch-up work.'],
    ['Reporting complexity', 'The depth of schedules, management summaries, financial statements, or other reporting required.'],
    ['Urgency & timing', 'Compressed deadlines, backlog periods, or other time-sensitive work that affects delivery planning.'],
  ];
  const quoteSteps = [
    ['01', 'Understand the need', 'Tell us what the business is doing, what support you need, and what is not working today.'],
    ['02', 'Review the scope drivers', 'We clarify transaction volume, payroll, accounts, record condition, reporting needs, and deadlines where relevant.'],
    ['03', 'Confirm inclusions', 'The proposed scope identifies what Maven will handle, what remains with your team, and any separately charged items.'],
    ['04', 'Start with an agreed quote', 'Once the scope is clear, Maven can provide a customized quotation and practical starting point for the engagement.'],
  ];

  return `
  ${packagesHero(h)}

  <section class="section-pad packages-starting-section" id="engagement-starting-points">
    <div class="container">
      <div class="packages-starting-intro reveal">
        <div>
          ${eyebrow('Engagement Starting Points')}
          <h2>Choose the closest fit. Then scope the work properly.</h2>
        </div>
        <p>The three packages are designed to make the first conversation easier. They are not rigid tiers: each one represents a common business situation, and the final engagement can be adjusted around the work you actually need.</p>
      </div>
      <div class="packages-engagement-list">
        ${data.packages.map((pkg, i) => packageEngagement(pkg, i)).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad packages-fee-section">
    <div class="container packages-fee-layout">
      <div class="packages-fee-copy reveal">
        ${eyebrowOnDark('Scope & Fee')}
        <h2>A useful quote needs more than a package name.</h2>
        <p>${esc(data.packagesFeeNote)}</p>
        <div class="packages-fee-separate">
          <span>${icon('shield')}</span>
          <div>
            <strong>Separately charged where applicable</strong>
            <p>Government fees, penalties, official charges, and third-party professional charges are outside Maven's service fee unless expressly included in the agreed scope.</p>
          </div>
        </div>
      </div>
      <div class="packages-fee-grid reveal-stagger">
        ${feeFactors.map((factor, i) => `<article class="packages-fee-factor">
          <div><span>${String(i + 1).padStart(2, '0')}</span>${icon(i === 0 ? 'ledger' : i === 1 ? 'users' : i === 2 ? 'building' : i === 3 ? 'shield' : i === 4 ? 'barChart' : 'clock')}</div>
          <h3>${esc(factor[0])}</h3>
          <p>${esc(factor[1])}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad packages-quote-section">
    <div class="container">
      <div class="packages-quote-intro reveal">
        ${eyebrow('From Enquiry to Quote')}
        <h2>Four steps to a scope both sides can understand.</h2>
        <p>Pricing is most useful when the responsibilities, records, timing, and expected outputs are clear first.</p>
      </div>
      <div class="packages-quote-grid reveal-stagger">
        ${quoteSteps.map((step) => `<article class="packages-quote-step">
          <span>${esc(step[0])}</span>
          <h3>${esc(step[1])}</h3>
          <p>${esc(step[2])}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad packages-custom-section">
    <div class="container packages-custom-grid">
      <div class="packages-custom-copy reveal">
        ${eyebrow('Custom Scope')}
        <h2>Need a mix of services rather than a named package?</h2>
        <p>That is normal. A business may need monthly accounting plus payroll, compliance tracking, reporting, or a limited project without fitting neatly into one starting point.</p>
        <div class="packages-custom-actions">
          ${button('View All Services', 'services.html', 'outline')}
          ${button('Discuss a Custom Scope', 'contact.html#inquiry', 'primary')}
        </div>
      </div>
      <aside class="packages-custom-panel reveal">
        ${panelLabel('Common combinations')}
        <div class="packages-custom-list">
          <div><span>01</span><strong>Monthly accounting + VAT / TDS coordination</strong></div>
          <div><span>02</span><strong>Accounting + payroll support + compliance tracking</strong></div>
          <div><span>03</span><strong>Monthly accounting + management reporting</strong></div>
          <div><span>04</span><strong>Project cleanup + ongoing monthly support</strong></div>
        </div>
        <p>Examples describe possible combinations only; actual inclusions are confirmed during scoping.</p>
      </aside>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Start With Scope',
    title: 'Tell us what your finance function needs now',
    subtitle: 'We can identify the closest starting point, clarify inclusions, and prepare a customized quotation around the work involved.',
    buttons: [button('Get a Customized Quote', 'contact.html#inquiry', 'primary'), button('View All Services', 'services.html', 'ghost-light')],
  })}
  `;
}

module.exports = { services, outsourcedAccounting, globalOutsourcing, packages };
