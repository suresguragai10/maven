const data = require('./data');
const { esc, safeUrl, internalHref } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, valueCard, processStep, ctaBand, industryBadge,
  statRow, servicePhotoMeta, panelLabel, eyebrow, eyebrowOnDark,
} = require('./ui');

function homeFinancePanel() {
  const items = [
    {
      icon: 'shield',
      title: 'Tax & Compliance',
      text: 'VAT, TDS, income tax and routine compliance support.',
      href: 'services.html#tax',
    },
    {
      icon: 'ledger',
      title: 'Accounting Operations',
      text: 'Bookkeeping, reconciliations, monthly close and records.',
      href: 'outsourced-accounting.html',
    },
    {
      icon: 'users',
      title: 'Payroll & Finance Admin',
      text: 'Salary processing support and organized employee records.',
      href: 'services.html#payroll',
    },
    {
      icon: 'barChart',
      title: 'Reporting & Advisory',
      text: 'MIS, cash-flow visibility, planning and reporting support.',
      href: 'services.html#reporting',
    },
  ];

  return `<aside class="home-finance-panel reveal" aria-label="Maven finance support areas">
    <div class="home-finance-panel-head">
      ${panelLabel('Connected finance support')}
      <h2>A finance function you can scale.</h2>
      <p>One team connecting day-to-day records, compliance, payroll and management information.</p>
    </div>
    <div class="home-finance-panel-list">
      ${items.map((item, i) => `<a class="home-finance-panel-item" href="${internalHref(item.href)}">
        <span class="home-finance-panel-number">0${i + 1}</span>
        <span class="home-finance-panel-icon">${icon(item.icon)}</span>
        <span class="home-finance-panel-copy"><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></span>
        <span class="home-finance-panel-arrow" aria-hidden="true">${icon('arrowRight')}</span>
      </a>`).join('')}
    </div>
    <div class="home-finance-panel-foot">
      ${icon('globe')}
      <span>Kathmandu-based team · Remote delivery available</span>
    </div>
  </aside>`;
}

function homeCapabilityCard({ number, title, text, image, links, href, ctaLabel, featured = false }) {
  return `<article class="home-capability-card reveal${featured ? ' home-capability-card--featured' : ''}">
    <a class="home-capability-photo" href="${internalHref(href)}" aria-label="${esc(ctaLabel + ' — ' + title)}">
      <img src="/images/${esc(image.file)}.jpg" srcset="/images/${esc(image.file)}-640w.jpg 640w, /images/${esc(image.file)}-960w.jpg 960w" sizes="(min-width: 900px) 33vw, 100vw" alt="${esc(image.alt)}" loading="lazy" decoding="async">
      <span class="home-capability-photo-shade" aria-hidden="true"></span>
      <span class="home-capability-number">${esc(number)}</span>
    </a>
    <div class="home-capability-body">
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      <ul class="home-capability-links">
        ${links.map((link) => `<li><a href="${internalHref(link.href)}">${icon('chevronRight')}<span>${esc(link.label)}</span></a></li>`).join('')}
      </ul>
      <a class="home-text-link" href="${internalHref(href)}"><span>${esc(ctaLabel)}</span>${icon('arrowRight')}</a>
    </div>
  </article>`;
}

function homeResourceCard(tile) {
  return `<a class="home-resource-card reveal" href="${internalHref(tile.href)}">
    <span class="home-resource-icon">${icon(tile.icon)}</span>
    <div>
      <h3>${esc(tile.title)}</h3>
      <p>${esc(tile.text)}</p>
    </div>
    <span class="home-resource-link"><span>${esc(tile.cta)}</span>${icon('arrowRight')}</span>
  </a>`;
}

function home() {
  const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
  const registration = byKey('registration');
  const bookkeeping = byKey('bookkeeping');
  const tax = byKey('tax');
  const payroll = byKey('payroll');
  const reporting = byKey('reporting');
  const advisory = byKey('advisory');
  const nfrsIfrs = byKey('nfrs-ifrs');

  const standards = [
    data.whyChoose[1], // clear communication
    data.whyChoose[2], // confidentiality
    data.whyChoose[3], // deadline reminders
    data.whyChoose[5], // professional review
  ].filter(Boolean);

  const resources = (data.resourcesHub && data.resourcesHub.tiles ? data.resourcesHub.tiles : []).slice(0, 3);

  return `
  <section class="hero home-hero">
    <div class="container hero-inner home-hero-grid">
      <div class="home-hero-copy reveal-stagger">
        ${eyebrowOnDark('Finance · Tax · Accounting · Global Outsourcing')}
        <h1>Finance clarity for growing businesses — in Nepal and beyond.</h1>
        <p class="hero-sub">Maven brings bookkeeping, tax compliance, payroll, financial reporting and outsourced finance support into one disciplined workflow — so owners and finance teams get cleaner records, clearer reporting and dependable follow-through.</p>
        <div class="hero-actions">
          ${button('Book a Free Initial Consultation', 'contact.html', 'primary')}
          ${button('Explore Our Services', 'services.html', 'ghost-light')}
        </div>
        <div class="home-hero-assurances" aria-label="Service coverage">
          <span>${stampMark('stamp-sm')} Kathmandu-based</span>
          <span>${stampMark('stamp-sm')} Across Nepal</span>
          <span>${stampMark('stamp-sm')} Remote international support</span>
        </div>
      </div>
      ${homeFinancePanel()}
    </div>
  </section>

  <section class="home-proof-strip" aria-label="Maven at a glance">
    <div class="container">
      ${statRow([
        { value: data.brand.foundedYear, label: 'Established in Kathmandu' },
        { value: data.brand.clientsServed, label: 'Clients served' },
        { value: String(data.serviceCategories.length), label: 'Connected service areas' },
        { value: 'Remote', label: 'International delivery available' },
      ])}
    </div>
  </section>

  <section class="section-pad home-capabilities-premium">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Core Capabilities',
        title: 'One finance partner. Three layers of support.',
        subtitle: 'From local compliance and monthly accounting to management reporting and international delivery, the work stays connected instead of being handled in separate silos.',
        align: 'left',
      })}
      <div class="home-capability-grid">
        ${registration && tax && payroll ? homeCapabilityCard({
          number: '01',
          title: 'Establish & Stay Compliant',
          text: 'Set up correctly, keep routine filings organized, and reduce the last-minute pressure around recurring compliance work.',
          image: servicePhotoMeta(tax),
          links: [
            { label: registration.title, href: `services.html#${registration.key}` },
            { label: tax.title, href: `services.html#${tax.key}` },
            { label: payroll.title, href: `services.html#${payroll.key}` },
          ],
          href: 'services.html',
          ctaLabel: 'Explore compliance services',
        }) : ''}
        ${bookkeeping && reporting ? homeCapabilityCard({
          number: '02',
          title: 'Run Your Finance Function',
          text: 'Keep books current, close the month with more discipline, and maintain the schedules management needs to understand the business.',
          image: servicePhotoMeta(bookkeeping),
          links: [
            { label: bookkeeping.title, href: 'outsourced-accounting.html' },
            { label: reporting.title, href: `services.html#${reporting.key}` },
          ],
          href: 'outsourced-accounting.html',
          ctaLabel: 'Explore outsourced accounting',
          featured: true,
        }) : ''}
        ${advisory && nfrsIfrs ? homeCapabilityCard({
          number: '03',
          title: 'Report, Plan & Scale',
          text: 'Move beyond recordkeeping with management information, forecasting and structured financial reporting support as complexity increases.',
          image: servicePhotoMeta(reporting || advisory),
          links: [
            { label: advisory.title, href: `services.html#${advisory.key}` },
            { label: nfrsIfrs.title, href: 'nfrs-ifrs.html' },
          ],
          href: 'services.html#reporting',
          ctaLabel: 'Explore reporting support',
        }) : ''}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist home-standard-section">
    <div class="container home-standard-layout">
      <div class="home-standard-intro reveal">
        ${eyebrow('How We Work')}
        <h2>Professional finance support should feel calm, clear and controlled.</h2>
        <p>We structure each engagement around defined responsibilities, organized records, practical communication and an internal review process. The aim is not to add complexity — it is to give management more confidence in the information behind the business.</p>
        <div class="home-standard-actions">${button('How Maven Works', 'about.html', 'outline')}</div>
      </div>
      <div class="home-standard-grid reveal-stagger">
        ${standards.map((item, i) => `<article class="home-standard-item">
          <span class="home-standard-number">0${i + 1}</span>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad home-global-premium">
    <div class="container home-global-grid">
      <div class="home-global-copy reveal">
        ${eyebrowOnDark('Global Outsourced Finance')}
        <h2>Reliable finance capacity for international businesses and accounting firms.</h2>
        <p>Maven supports remote accounting workflows from Kathmandu with defined scopes, structured written communication and the flexibility to work within existing systems. Start with a focused engagement and expand only when the working model proves useful.</p>
        <div class="home-global-actions">
          ${button('Explore International Services', 'global-outsourcing.html', 'primary')}
          ${button('International Accounting', 'international-accounting.html', 'ghost-light')}
        </div>
      </div>
      <div class="home-global-proof reveal" aria-label="International delivery strengths">
        <p class="home-global-proof-label">Built for remote collaboration</p>
        ${data.internationalAccounting.benefits.slice(0, 4).map((b, i) => `<article class="home-global-proof-item">
          <span>0${i + 1}</span>
          <div><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad home-deliverables-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Management Information',
        title: 'Good accounting should end in information you can use.',
        subtitle: 'Depending on scope, Maven can turn routine accounting work into a clearer monthly view of performance, obligations, cash and next actions.',
        align: 'left',
      })}
      <div class="grid grid-4 reveal-stagger home-deliverables-grid">
        ${[
          { icon: 'ledger', title: 'Monthly Accounting Pack', text: 'Organized books, reconciliations and supporting schedules kept current for the period.' },
          { icon: 'shield', title: 'Tax & Compliance Status', text: 'A clearer view of VAT, TDS and filing obligations against real deadlines and available records.' },
          { icon: 'trendUp', title: 'Cash-Flow & Working Capital View', text: 'Visibility into cash movement, receivables and payables so pressure points are easier to see.' },
          { icon: 'barChart', title: 'Management Reporting & Action Points', text: 'Decision-focused reporting that helps management discuss performance and the next practical steps.' },
        ].map((d) => `<article class="deliverable-card home-deliverable-card">
          <span class="service-icon">${icon(d.icon)}</span>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist home-process-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Engagement Process',
        title: 'A clear path from first conversation to ongoing support.',
        subtitle: 'The process is deliberately straightforward: understand the work, define the scope, organize the records, then deliver and support consistently.',
        align: 'left',
      })}
      <div class="process-list process-list--row process-list--row-4 process-list--connected" data-process-progress>
        ${[
          { title: 'Understand', text: 'We learn how the business operates, what records exist, and where the immediate priorities are.' },
          { title: 'Scope', text: 'We define responsibilities, required information, timing and the exact work to be delivered.' },
          { title: 'Organize & Deliver', text: 'The agreed accounting, tax, payroll or reporting work is prepared and internally reviewed.' },
          { title: 'Report & Support', text: 'You receive the agreed output, key points are explained, and ongoing support can continue within scope.' },
        ].map((p, i, arr) => processStep({ ...p, step: String(i + 1).padStart(2, '0') }, i === arr.length - 1)).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad home-industries-premium">
    <div class="container">
      <div class="home-section-split">
        ${sectionHead({
          eyebrow: 'Industries',
          title: 'Finance support that adapts to how your business actually operates.',
          subtitle: 'Different businesses create different accounting, cash-flow and compliance pressures. Our work starts with understanding that operating reality.',
          align: 'left',
        })}
        <div class="home-section-split-action reveal">${button('View All Industries', 'industries.html', 'outline')}</div>
      </div>
      <div class="home-industry-grid reveal-stagger">
        ${data.industries.slice(0, 8).map(industryBadge).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist home-knowledge-section">
    <div class="container">
      <div class="home-section-split">
        ${sectionHead({
          eyebrow: 'Knowledge & Tools',
          title: 'Useful finance information before you even become a client.',
          subtitle: data.resourcesHub ? data.resourcesHub.intro : 'Practical tools and reference material for finance, tax and compliance planning.',
          align: 'left',
        })}
        <div class="home-section-split-action reveal">${button('Explore Resources', 'resources.html', 'outline')}</div>
      </div>
      <div class="home-resource-grid">
        ${resources.map(homeResourceCard).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Start a Conversation',
    title: 'Need a clearer, more dependable finance function?',
    subtitle: 'Tell us where the pressure is today — compliance, bookkeeping, reporting, or additional remote accounting capacity — and we will help define the right starting scope.',
    buttons: [
      button('Book a Free Initial Consultation', 'contact.html', 'primary'),
      button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to discuss finance, tax, accounting, or outsourced support.'), 'whatsapp', 'target="_blank" rel="noopener"'),
    ],
  })}
  `;
}
function aboutTeamPreviewCard(member, index) {
  const firstSentence = (member.bio || '').split(/(?<=[.!?])\s+/)[0] || '';
  const avatar = member.photo
    ? `<img src="${esc(safeUrl(member.photo))}" alt="${esc(member.name)}" loading="lazy" decoding="async">`
    : `<span class="about-team-initials" aria-hidden="true">${esc((member.name || 'M').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase())}</span>`;

  return `<article class="about-team-card reveal">
    <div class="about-team-photo">${avatar}<span class="about-team-index">0${index + 1}</span></div>
    <div class="about-team-body">
      <h3>${esc(member.name)}</h3>
      ${member.role ? `<p class="about-team-role">${esc(member.role)}</p>` : ''}
      ${firstSentence ? `<p class="about-team-note">${esc(firstSentence)}</p>` : ''}
    </div>
  </article>`;
}

function about() {
  const h = data.pageHeader('about');
  const leaders = (data.teamMembers || []).slice(0, 3);
  const operatingControls = [
    {
      iconName: 'compass',
      title: 'Define the scope first',
      text: 'We clarify the work, information needed, responsibilities and quotation before an engagement moves into delivery.',
    },
    {
      iconName: 'ledger',
      title: 'Keep records organized',
      text: 'Checklists, schedules and working files are structured so recurring work is easier to review, explain and hand over.',
    },
    {
      iconName: 'shield',
      title: 'Review before delivery',
      text: 'Maven uses an internal review step before completed work is delivered or supported for submission.',
    },
    {
      iconName: 'users',
      title: 'Communicate clearly',
      text: 'Questions, missing information and next steps are raised in plain language so clients can see what is moving and what is waiting.',
    },
  ];

  const connectedScope = [
    {
      number: '01',
      iconName: 'building',
      title: 'Setup, tax & compliance',
      text: 'Business setup support and recurring tax, payroll and compliance work for businesses operating in Nepal.',
      href: 'services.html#tax',
    },
    {
      number: '02',
      iconName: 'ledger',
      title: 'Accounting operations',
      text: 'Bookkeeping, reconciliations, month-end support and the records required to keep the finance function dependable.',
      href: 'outsourced-accounting.html',
    },
    {
      number: '03',
      iconName: 'barChart',
      title: 'Reporting & outsourced finance',
      text: 'Management reporting, Virtual CFO support and structured remote accounting capacity for Nepal and international teams.',
      href: 'global-outsourcing.html',
    },
  ];

  return `
  <section class="about-hero-premium">
    <div class="container about-hero-grid">
      <div class="about-hero-copy">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="about-hero-sub">${esc(h.subtitle)}</p>
        <div class="about-hero-actions">
          ${button('Explore Our Services', 'services.html', 'primary')}
          ${button('Meet the Team', 'team.html', 'ghost-light')}
        </div>
        <div class="about-hero-assurances" aria-label="Maven firm profile highlights">
          <span>${stampMark('stamp-sm')} Kathmandu-based firm</span>
          <span>${stampMark('stamp-sm')} Nepal-wide client support</span>
          <span>${stampMark('stamp-sm')} Remote international delivery</span>
        </div>
      </div>

      <aside class="about-hero-profile" aria-label="Maven firm profile">
        <div class="about-hero-profile-head">
          ${panelLabel('Firm profile')}
          <h2>A focused team with a connected finance scope.</h2>
        </div>
        <div class="about-hero-profile-list">
          <div><span>Established</span><strong>${esc(data.brand.foundedYear)}</strong></div>
          <div><span>Clients served</span><strong>${esc(data.brand.clientsServed)}</strong></div>
          <div><span>Base</span><strong>New Baneshwor, Kathmandu</strong></div>
          <div><span>Delivery</span><strong>Nepal + remote international support</strong></div>
        </div>
        <div class="about-hero-profile-foot">
          ${icon('building')}
          <span>${esc(data.brand.legalName)}</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad about-story-section">
    <div class="container about-story-layout">
      <div class="about-story-copy reveal">
        ${eyebrow('Who We Are')}
        <h2>A practical finance and business support firm built to stay close to the work.</h2>
        <p>${esc(data.aboutText)}</p>
        <p>${esc(data.aboutClosing)}</p>
        <div class="about-story-actions">
          ${button('View All Services', 'services.html', 'outline')}
        </div>
      </div>
      <div class="about-scope-list reveal-stagger" aria-label="Maven connected service scope">
        ${connectedScope.map((item) => `<a class="about-scope-item" href="${internalHref(item.href)}">
          <span class="about-scope-number">${item.number}</span>
          <span class="about-scope-icon">${icon(item.iconName)}</span>
          <span class="about-scope-copy"><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></span>
          <span class="about-scope-arrow" aria-hidden="true">${icon('arrowRight')}</span>
        </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad about-values-section">
    <div class="container about-values-layout">
      <div class="about-values-intro reveal">
        ${eyebrowOnDark('How We Work')}
        <h2>Professional standards should be visible in the day-to-day work.</h2>
        <p>Our values are practical working standards: careful work, controlled handling of information, deadline discipline, straightforward communication and honest scoping.</p>
      </div>
      <div class="about-values-list reveal-stagger">
        ${data.values.map((value, i) => `<article class="about-value-row">
          <span class="about-value-number">${String(i + 1).padStart(2, '0')}</span>
          <div><h3>${esc(value.title)}</h3><p>${esc(value.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad about-controls-section bg-mist">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Engagement Discipline',
        title: 'A controlled working process without unnecessary layers.',
        subtitle: 'The aim is to make finance work easier to follow: clear scope, organized records, review before delivery and direct communication when something needs attention.',
      })}
      <div class="about-control-grid reveal-stagger">
        ${operatingControls.map((item, i) => `<article class="about-control-card">
          <div class="about-control-card-top"><span>0${i + 1}</span><span class="about-control-icon">${icon(item.iconName)}</span></div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
        </article>`).join('')}
      </div>
      <div class="about-confidentiality-note reveal">
        <span class="about-confidentiality-icon">${icon('shield')}</span>
        <div>
          <strong>Confidentiality is part of the working model.</strong>
          <p>Client information is handled on a confidential basis and shared internally only with the people working on the engagement. For more detail, see our <a href="${internalHref('privacy.html')}">Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  </section>

  ${leaders.length ? `<section class="section-pad about-team-section">
    <div class="container">
      <div class="about-team-head">
        ${sectionHead({
          eyebrow: 'People Behind the Work',
          title: 'A team shaped by hands-on accounting, reporting and advisory experience.',
          subtitle: 'Maven combines day-to-day client delivery with experience across accounting, audit, banking, financial reporting and business support.',
          align: 'left',
        })}
        <div class="about-team-head-action reveal">${button('Meet the Full Team', 'team.html', 'outline')}</div>
      </div>
      <div class="about-team-grid reveal-stagger">
        ${leaders.map(aboutTeamPreviewCard).join('')}
      </div>
    </div>
  </section>` : ''}

  <section class="section-pad about-reach-section">
    <div class="container about-reach-grid">
      <article class="about-reach-card about-reach-card--local reveal">
        <span class="about-reach-icon">${icon('mapPin')}</span>
        ${eyebrow('Kathmandu Base')}
        <h2>Local context for businesses operating in Nepal.</h2>
        <p>Maven is based in New Baneshwor, Kathmandu and supports businesses across Nepal with accounting, tax, compliance, payroll, reporting and advisory work.</p>
        <a class="about-reach-link" href="${internalHref('contact.html')}"><span>Contact the Kathmandu team</span>${icon('arrowRight')}</a>
      </article>
      <article class="about-reach-card about-reach-card--global reveal">
        <span class="about-reach-icon">${icon('globe')}</span>
        ${eyebrowOnDark('International Delivery')}
        <h2>Remote finance capacity for international teams.</h2>
        <p>For overseas businesses and accounting firms, Maven provides defined remote accounting and management-reporting support from Kathmandu, working within existing systems where practical.</p>
        <a class="about-reach-link" href="${internalHref('global-outsourcing.html')}"><span>Explore Global Outsourcing</span>${icon('arrowRight')}</a>
      </article>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Start a Conversation',
    title: 'Looking for a finance partner that stays close to the work?',
    subtitle: 'Tell us what your business needs today — compliance, accounting, reporting or additional remote finance capacity — and we will help define a practical starting scope.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to learn more about working with your team.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

module.exports = { home, about };
