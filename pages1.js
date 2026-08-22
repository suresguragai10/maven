const data = require('./data');
const { esc, internalHref } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, valueCard, whyCard, processStep, ctaBand, trustBar, accordionItem, industryBadge,
  statRow, servicePhotoMeta, capabilityChapter,
} = require('./ui');

// Decorative Kathmandu skyline: generic building silhouettes plus three
// recognizable landmarks. At 90px tall and 22% opacity (see .hero-skyline in
// styles.css), fine detail wouldn't read at all — so each landmark is told
// apart by overall silhouette shape, not iconographic detail.
function heroSkyline() {
  const heights = [46, 68, 40, 78, 52, 60, 38, 70, 48, 66, 42, 58, 50, 74, 44, 62, 36, 56, 48, 40];
  let x = 0;
  const buildings = heights.map((h, i) => {
    const w = 52 + (i % 3) * 8;
    const rect = `<rect x="${x}" y="${140 - h}" width="${w}" height="${h}" fill="currentColor"/>`;
    x += w + 9;
    return rect;
  }).join('');
  // Pashupatinath — a tiered pagoda tower with flared, overhanging eaves.
  const pashupatinath = `<g transform="translate(150,0)">
    <rect x="10" y="100" width="30" height="40" fill="currentColor"/>
    <path d="M-6 100 L46 100 L36 84 L4 84 Z" fill="currentColor"/>
    <rect x="14" y="60" width="22" height="24" fill="currentColor"/>
    <path d="M0 60 L50 60 L38 44 L12 44 Z" fill="currentColor"/>
    <rect x="20" y="30" width="10" height="14" fill="currentColor"/>
    <path d="M25 14 L31 30 L19 30 Z" fill="currentColor"/>
  </g>`;
  // Boudhanath — a large stupa dome, the biggest landmark in the skyline.
  const boudhanath = `<g transform="translate(560,0)">
    <path d="M-8 140 L60 140 L48 116 L4 116 Z" fill="currentColor"/>
    <circle cx="26" cy="86" r="30" fill="currentColor"/>
    <rect x="12" y="54" width="28" height="22" fill="currentColor"/>
    <path d="M12 54 L40 54 L26 12 Z" fill="currentColor"/>
    <circle cx="26" cy="8" r="5" fill="currentColor"/>
  </g>`;
  // Swayambhunath — a smaller stupa on a hill mound (its defining feature).
  const swayambhunath = `<g transform="translate(1000,0)">
    <path d="M-20 140 L72 140 L52 96 L0 96 Z" fill="currentColor"/>
    <rect x="16" y="76" width="18" height="20" fill="currentColor"/>
    <path d="M4 76 L46 76 L36 62 L14 62 Z" fill="currentColor"/>
    <rect x="21" y="44" width="8" height="18" fill="currentColor"/>
    <path d="M25 30 L30 44 L20 44 Z" fill="currentColor"/>
  </g>`;
  return `<svg class="hero-skyline" viewBox="0 0 1200 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${buildings}${pashupatinath}${boudhanath}${swayambhunath}</svg>`;
}

// Decorative international skyline for the Global Outsourcing section —
// same treatment as heroSkyline(), but Statue of Liberty + Tower Bridge in
// place of the Kathmandu landmarks, signalling the international client base.
function globalSkyline() {
  // 18 entries (not 12) so the buildings actually span the full 1200-unit
  // viewBox width — too few left a visible empty gap on the right side.
  const heights = [50, 70, 42, 60, 46, 66, 38, 56, 44, 62, 48, 40, 54, 68, 44, 58, 50, 42];
  let x = 0;
  const buildings = heights.map((h, i) => {
    const w = 58 + (i % 3) * 8;
    const rect = `<rect x="${x}" y="${140 - h}" width="${w}" height="${h}" fill="currentColor"/>`;
    x += w + 10;
    return rect;
  }).join('');
  // Statue of Liberty — pedestal, robed figure, crown, raised torch arm.
  const statueOfLiberty = `<g transform="translate(280,0)">
    <rect x="0" y="112" width="46" height="28" fill="currentColor"/>
    <rect x="6" y="104" width="34" height="10" fill="currentColor"/>
    <path d="M10 104 L36 104 L30 50 L16 50 Z" fill="currentColor"/>
    <circle cx="23" cy="44" r="7" fill="currentColor"/>
    <path d="M14 40 L18 30 L23 38 L28 30 L32 40 Z" fill="currentColor"/>
    <path d="M32 55 L48 34 L52 34 L38 58 Z" fill="currentColor"/>
    <circle cx="50" cy="27" r="6" fill="currentColor"/>
    <path d="M44 23 L50 8 L56 23 Z" fill="currentColor"/>
  </g>`;
  // Tower Bridge — twin towers, upper walkway, suspension cables to the deck.
  const towerBridge = `<g transform="translate(760,0)">
    <rect x="0" y="120" width="140" height="8" fill="currentColor"/>
    <rect x="10" y="60" width="22" height="60" fill="currentColor"/>
    <path d="M8 60 L21 40 L34 60 Z" fill="currentColor"/>
    <rect x="108" y="60" width="22" height="60" fill="currentColor"/>
    <path d="M106 60 L119 40 L132 60 Z" fill="currentColor"/>
    <rect x="32" y="70" width="76" height="8" fill="currentColor"/>
    <path d="M32 78 L0 120 M108 78 L140 120" stroke="currentColor" stroke-width="3" fill="none"/>
  </g>`;
  return `<svg class="hero-skyline" viewBox="0 0 1200 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${buildings}${statueOfLiberty}${towerBridge}</svg>`;
}

function docCardArt() {
  // Purely decorative mockup — tabs auto-cycle and are also clickable (see
  // client.js). Not aria-hidden since the tabs are real, focusable buttons.
  // Tab labels and their 3-item previews are pulled straight from the real
  // service categories (content/site.yaml) so this can't drift out of sync
  // with what the Services section actually lists.
  const tabOrder = [
    ['registration', 'Registration'],
    ['bookkeeping', 'Accounting'],
    ['tax', 'Tax'],
    ['payroll', 'Payroll'],
    ['reporting', 'Reports'],
  ];
  const tabs = tabOrder
    .map(([key, label]) => ({ label, cat: data.serviceCategories.find((c) => c.key === key) }))
    .filter((t) => t.cat);

  // Task 04: the "Clients Served" figure used to also float here, right
  // next to the hero — but the credibility/proof section immediately
  // below already states it twice (the about-facts sentence and the
  // stat row), so a third instance in the very first viewport was exactly
  // the "mechanical repetition in adjacent sections" this task's own
  // instruction rules out. The number still appears, just once, where a
  // visitor reaches it in the actual reading order instead of before
  // they've read anything else.
  return `<div class="hero-art reveal">
    <div class="doc-card">
      <div class="doc-card-tabs">
        ${tabs.map((t, i) => `<button type="button" class="doc-card-tab${i === 0 ? ' is-active' : ''}" aria-pressed="${i === 0}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="doc-card-panels">
        ${tabs.map((t, i) => `
        <ul class="doc-card-panel${i === 0 ? ' is-active' : ''}">
          ${t.cat.items.slice(0, 3).map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
        </ul>`).join('')}
      </div>
      <div class="doc-card-stamp">${stampMark()}</div>
    </div>
  </div>`;
}

function homePackageCard(pkg) {
  return `<article class="package-card reveal">
    <h3>${esc(pkg.name)}</h3>
    <p class="package-audience">${esc(pkg.audience)}</p>
    <p class="package-price">Quote after review</p>
    <ul class="stamp-list stamp-list--pkg">
      ${pkg.items.slice(0, 3).map((i) => `<li>${stampMark('stamp-sm')}<span>${esc(i)}</span></li>`).join('')}
    </ul>
    <a class="btn btn-outline btn-block" href="${internalHref('packages.html')}">See Full Package</a>
  </article>`;
}

function home() {
  return `
  <section class="hero">
    <div class="container hero-inner">
      <div class="reveal-stagger">
        <p class="eyebrow eyebrow--on-dark">Business Consultancy · Kathmandu, Nepal</p>
        <h1>Your Outsourced Finance Team in Nepal</h1>
        <p class="hero-sub">Accounting, tax compliance, payroll, financial reporting, and management support for growing businesses — organized under one dependable team, for startups, SMEs, traders, and service companies alike.</p>
        <div class="hero-actions">
          ${button('Book Free Consultation', 'contact.html', 'primary')}
          ${button('View Services', 'services.html', 'ghost-light')}
        </div>
      </div>
      ${docCardArt()}
    </div>
    <div class="container">${trustBar(data.trustPoints)}</div>
    ${heroSkyline()}
  </section>

  <section class="section-pad home-about-section">
    <div class="container about-snapshot">
      <div class="about-snapshot-copy reveal">
        ${sectionHead({ eyebrow: 'About Maven', title: 'A practical consultancy partner, not a large impersonal firm', align: 'left' })}
        <p>${esc(data.aboutText)}</p>
        <div style="margin-top:22px">${button('Learn More About Us', 'about.html', 'outline')}</div>
      </div>
      <aside class="proof-panel reveal" aria-label="Maven at a glance">
        <span class="service-letter">Maven at a glance</span>
        <ul class="stamp-list">
          ${data.aboutFacts.map((f) => `<li>${stampMark('stamp-sm')}<span>${esc(f)}</span></li>`).join('')}
        </ul>
      </aside>
    </div>
    <div class="container">
      ${statRow([
        { value: data.brand.foundedYear, label: 'Founded' },
        { value: data.brand.clientsServed, label: 'Clients served' },
        { value: String(data.industries.length), label: 'Industries served' },
        { value: String(data.serviceCategories.length), label: 'Service categories' },
      ])}
    </div>
  </section>

  <section class="section-pad bg-mist home-capabilities-section">
    <div class="container">
      ${sectionHead({ eyebrow: 'What We Do', title: 'Three ways Maven supports your business', subtitle: 'From first registration to reporting that stands up to lenders and investors — one connected system, not a list of unrelated services.' })}
      <div class="service-editorial-list">
        ${(() => {
          const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
          const registration = byKey('registration');
          const tax = byKey('tax');
          const payroll = byKey('payroll');
          const bookkeeping = byKey('bookkeeping');
          const reporting = byKey('reporting');
          const advisory = byKey('advisory');
          const nfrsIfrs = byKey('nfrs-ifrs');
          const chapters = [];
          if (registration && tax && payroll) {
            chapters.push(capabilityChapter({
              variant: 'structured',
              id: 'establish-and-comply',
              chapterLabel: '01 · Establish & Comply',
              title: 'A solid legal and compliance foundation',
              text: `${registration.tagline} ${tax.tagline} ${payroll.tagline}`,
              image: servicePhotoMeta(registration),
              links: [
                { label: registration.title, href: `services.html#${registration.key}` },
                { label: tax.title, href: `services.html#${tax.key}` },
                { label: payroll.title, href: `services.html#${payroll.key}` },
              ],
              cta: { label: 'Discuss Your Compliance Needs', href: 'contact.html' },
            }));
          }
          if (bookkeeping && reporting) {
            chapters.push(capabilityChapter({
              variant: 'feature',
              reverse: true,
              id: 'run-your-finance-function',
              chapterLabel: '02 · Run Your Finance Function',
              title: 'Outsourced accounting, run like an in-house finance team',
              text: `${bookkeeping.tagline} ${reporting.tagline}`,
              image: servicePhotoMeta(bookkeeping),
              links: [
                { label: bookkeeping.title, href: 'outsourced-accounting.html' },
                { label: reporting.title, href: `services.html#${reporting.key}` },
              ],
              cta: { label: 'Explore Outsourced Accounting', href: 'outsourced-accounting.html' },
            }));
          }
          if (advisory && nfrsIfrs) {
            chapters.push(capabilityChapter({
              variant: 'technical',
              id: 'advise-and-report-better',
              chapterLabel: '03 · Advise & Report Better',
              title: 'Guidance and reporting that grow with your business',
              text: `${advisory.tagline} And as reporting needs become more complex — for lenders, investors, or growth — structured NFRS / IFRS implementation support.`,
              image: servicePhotoMeta(advisory),
              links: [
                { label: advisory.title, href: `services.html#${advisory.key}` },
                { label: nfrsIfrs.title, href: 'nfrs-ifrs.html' },
              ],
              cta: { label: 'Discuss Advisory & Reporting Needs', href: 'contact.html' },
            }));
          }
          return chapters.join('');
        })()}
      </div>
      <div class="text-center" style="margin-top:36px">${button('View All Services', 'services.html', 'outline')}</div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Packages', title: 'Choose the level of support your business needs', subtitle: 'Every package is scoped to your business after a short review — no fixed one-size-fits-all pricing.' })}
      <div class="grid grid-3 reveal-stagger">
        ${data.packages.map(homePackageCard).join('')}
      </div>
      <div class="text-center" style="margin-top:36px">${button('Compare All Packages', 'packages.html', 'outline')}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Why Choose Maven', title: 'Practical support, clearly communicated' })}
      <div class="grid grid-4 reveal-stagger">
        ${data.whyChoose.slice(0, 6).map(whyCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad home-industries-section">
    <div class="container">
      ${sectionHead({ eyebrow: 'Industries We Serve', title: 'Built for the businesses that keep Nepal running' })}
      <div class="grid grid-4 reveal-stagger">
        ${data.industries.slice(0, 8).map(industryBadge).join('')}
      </div>
      <div class="text-center" style="margin-top:36px">${button('See All Industries', 'industries.html', 'outline')}</div>
    </div>
  </section>

  <section class="section-pad bg-navy skyline-section international-showcase">
    <div class="container international-showcase-grid">
      <div class="reveal international-showcase-copy">
        <p class="eyebrow eyebrow--on-dark">Global Finance Delivery from Nepal</p>
        <h2>${esc(data.pageHeader('global-outsourcing').title)}</h2>
        <p style="margin-top:14px">${esc(data.internationalHub.intro)}</p>
        <div style="margin-top:26px">${button(esc(data.internationalHub.cta), 'global-outsourcing.html', 'primary')}</div>
      </div>
      <div class="international-proof-grid reveal" aria-label="International service strengths">
        ${data.internationalAccounting.benefits.slice(0, 6).map((b) => `<div class="international-proof-item">${stampMark('stamp-sm')}<span>${esc(b.title)}</span></div>`).join('')}
      </div>
    </div>
    ${globalSkyline()}
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'How Maven Works', title: 'A clear process from first conversation to ongoing support' })}
      <div class="process-list process-list--row process-list--row-4">
        ${(() => {
          // A client-facing 4-stage summary of the real 9-step operational
          // process in content/site.yaml's process: array (Inquiry ->
          // ... -> Final payment and file closing) -- that full list stays
          // accurate and unchanged, it's just the wrong altitude for a
          // homepage marketing section. Deliberately does not end on
          // payment/closing (step 5 and step 9 in the real list) as the
          // narrative's emotional conclusion -- "ongoing support" is.
          const stages = [
            { title: 'Understand', text: 'Understand the business, current records, requirements, priorities, and scope.' },
            { title: 'Organize', text: 'Identify the accounting, tax, compliance, reporting, and document requirements.' },
            { title: 'Manage', text: 'Prepare, coordinate, and internally review the agreed work.' },
            { title: 'Report & Support', text: 'Deliver the agreed work, explain key points, and provide practical next steps or ongoing support within scope.' },
          ];
          return stages.map((p, i) => processStep({ ...p, step: String(i + 1).padStart(2, '0') }, i === stages.length - 1)).join('');
        })()}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'What You Receive', title: 'Reporting that keeps you informed, not guessing', subtitle: 'Real deliverables from real service work — which of these apply to you depends on your engagement scope, not every client receives every item below.' })}
      <div class="grid grid-3 deliverables-grid reveal-stagger">
        ${[
          { icon: 'barChart', title: 'Monthly Profit & Loss Summary', text: 'A clear read on income and expenses for the period, not just a raw transaction dump.' },
          { icon: 'ledger', title: 'Balance Sheet Snapshot', text: 'What the business owns and owes as of a given date, kept current as records are updated.' },
          { icon: 'trendUp', title: 'Cash-Flow Overview', text: 'Visibility into money moving in and out, so shortfalls are visible before they become a problem.' },
          { icon: 'users', title: 'Payroll Summary', text: 'Salary processing records and payroll-related compliance kept organized month to month.' },
          { icon: 'shield', title: 'Tax & Compliance Status', text: 'Where VAT, TDS, and other filing obligations stand, tracked against real deadlines.' },
          { icon: 'compass', title: 'Management Reporting & Action Points', text: 'Reporting built for decisions, not just recordkeeping — with practical next steps, not raw numbers alone.' },
        ].map((d) => `<div class="deliverable-card">
          <span class="service-icon">${icon(d.icon)}</span>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.text)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Frequently Asked', title: 'Quick answers before you reach out' })}
      <div class="accordion" style="max-width:760px;margin:0 auto">
        ${data.faqs.slice(0, 3).map((f, i) => accordionItem({ id: `home-faq-${i}`, headingHtml: esc(f.q), bodyHtml: `<p>${esc(f.a)}</p>` })).join('')}
      </div>
      <div class="text-center" style="margin-top:32px">${button('View All FAQs', 'faq.html', 'outline')}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Get Started',
    title: 'Ready to get your business organized and compliant?',
    subtitle: 'Book a free initial consultation and we will confirm exactly what your business needs.',
    buttons: [
      button('Book a Free Initial Consultation', 'contact.html', 'primary'),
      button(`${icon('whatsapp')} Contact Maven Today`, data.whatsappHref('Hello Maven, I would like to book a free consultation.'), 'whatsapp', 'target="_blank" rel="noopener"'),
    ],
  })}
  `;
}

function about() {
  const h = data.pageHeader('about');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/about-hero-bg.jpg')}

  <section class="section-pad home-about-section">
    <div class="container about-snapshot">
      <div class="about-snapshot-copy reveal">
        ${sectionHead({ eyebrow: 'Who We Are', title: 'Practical support, organized records, clear communication', align: 'left' })}
        <p>${esc(data.aboutClosing)}</p>
        <div style="margin-top:22px">${button('Meet Our Team', 'team.html', 'outline')}</div>
      </div>
      <aside class="proof-panel reveal" aria-label="Maven facts">
        <span class="service-letter">Maven facts</span>
        <ul class="stamp-list">
          ${data.aboutFacts.map((f) => `<li>${stampMark('stamp-sm')}<span>${esc(f)}</span></li>`).join('')}
        </ul>
      </aside>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'What We Value', title: 'The principles behind every engagement' })}
      <div class="grid grid-3 reveal-stagger">
        ${data.values.map(valueCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Where We Work', title: 'Kathmandu-based, working with clients across Nepal' })}
      <div class="grid grid-4 reveal-stagger">
        ${data.industries.slice(0, 8).map(industryBadge).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Talk To Maven',
    title: 'Have a question about how we can help your business?',
    subtitle: 'Book a free initial consultation — no obligation, just clear next steps.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Contact Maven Today', 'contact.html', 'ghost-light')],
  })}
  `;
}

module.exports = { home, about };
