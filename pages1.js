const data = require('./data');
const { esc, internalHref } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, valueCard, whyCard, processStep, ctaBand, trustBar, accordionItem, industryBadge,
} = require('./ui');

function heroSkyline() {
  const heights = [46, 68, 40, 78, 52, 60, 38, 70, 48, 66, 42, 58, 50, 74, 44, 62, 36, 56, 48, 40];
  let x = 0;
  const buildings = heights.map((h, i) => {
    const w = 52 + (i % 3) * 8;
    const rect = `<rect x="${x}" y="${140 - h}" width="${w}" height="${h}" fill="currentColor"/>`;
    x += w + 9;
    return rect;
  }).join('');
  const pagoda = `<g transform="translate(420,0)">
    <path d="M0 140 L0 100 L34 100 L34 140 Z" fill="currentColor"/>
    <path d="M-10 100 L44 100 L34 86 L0 86 Z" fill="currentColor"/>
    <path d="M-4 86 L38 86 L30 74 L4 74 Z" fill="currentColor"/>
    <rect x="13" y="50" width="8" height="24" fill="currentColor"/>
    <path d="M17 34 L23 50 L11 50 Z" fill="currentColor"/>
  </g>`;
  const stupa = `<g transform="translate(830,0)">
    <circle cx="26" cy="120" r="24" fill="currentColor"/>
    <rect x="18" y="72" width="16" height="28" fill="currentColor"/>
    <path d="M18 72 L34 72 L26 42 Z" fill="currentColor"/>
    <circle cx="26" cy="38" r="4" fill="currentColor"/>
  </g>`;
  return `<svg class="hero-skyline" viewBox="0 0 1200 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${buildings}${pagoda}${stupa}</svg>`;
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

function homeServiceCard(cat) {
  const preview = cat.items.slice(0, 3);
  return `<article class="service-card reveal">
    <div class="service-card-head">
      <span class="service-icon">${icon(cat.icon)}</span>
      <div>
        <span class="service-letter">Category ${esc(cat.letter)}</span>
        <h3>${esc(cat.title)}</h3>
      </div>
    </div>
    <p class="service-tagline">${esc(cat.tagline)}</p>
    <ul class="stamp-list">
      ${preview.map((i) => `<li>${stampMark('stamp-sm')}<span>${esc(i)}</span></li>`).join('')}
      <li>${stampMark('stamp-sm')}<span>+ ${cat.items.length - preview.length} more</span></li>
    </ul>
  </article>`;
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
      <div class="reveal">
        <p class="eyebrow eyebrow--on-dark">Business Consultancy · Kathmandu, Nepal</p>
        <h1>Reliable Accounting, Tax, Registration &amp; Compliance Support for Businesses in Nepal</h1>
        <p class="hero-sub">Maven Consultancy Services Pvt. Ltd. helps startups, SMEs, traders, service companies, and growing businesses stay organized, compliant, and financially clear through practical consultancy and outsourced accounting support.</p>
        <div class="hero-actions">
          ${button('Book Free Consultation', 'contact.html', 'primary')}
          ${button('View Services', 'services.html', 'ghost-light')}
          ${button(`${icon('whatsapp')} Send Inquiry on WhatsApp`, data.whatsappHref('Hello Maven, I would like to send an inquiry about your services.'), 'whatsapp', 'target="_blank" rel="noopener"')}
        </div>
      </div>
      ${docCardArt()}
    </div>
    <div class="container">${trustBar(data.trustPoints)}</div>
    ${heroSkyline()}
  </section>

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'About Maven', title: 'A practical consultancy partner, not a large impersonal firm', align: 'left' })}
        <p>${esc(data.aboutText)}</p>
        <div style="margin-top:22px">${button('Learn More About Us', 'about.html', 'outline')}</div>
      </div>
      <ul class="stamp-list">
        ${data.aboutFacts.map((f) => `<li>${stampMark('stamp-sm')}<span>${esc(f)}</span></li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'What We Do', title: 'Services built around what Nepali businesses actually need', subtitle: 'From first registration to monthly compliance, Maven supports each stage with clear, practical work.' })}
      <div class="grid grid-3">
        ${data.serviceCategories.map(homeServiceCard).join('')}
      </div>
      <div class="text-center" style="margin-top:36px">${button('View All Services', 'services.html', 'primary')}</div>
    </div>
  </section>

  <section class="section-pad bg-navy">
    <div class="container two-col">
      <div class="reveal">
        <p class="eyebrow eyebrow--on-dark">Global Outsourcing</p>
        <h2>${esc(data.pageHeader('global-outsourcing').title)}</h2>
        <p style="margin-top:14px">${esc(data.globalOutsourcing.intro)}</p>
        <div style="margin-top:26px">${button(esc(data.globalOutsourcing.cta), 'global-outsourcing.html', 'primary')}</div>
      </div>
      <ul class="stamp-list reveal">
        ${data.globalOutsourcing.benefits.slice(0, 6).map((b) => `<li>${stampMark('stamp-sm')}<span style="color:rgba(255,255,255,0.85)">${esc(b)}</span></li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Packages', title: 'Choose the level of support your business needs', subtitle: 'Every package is scoped to your business after a short review — no fixed one-size-fits-all pricing.' })}
      <div class="grid grid-3">
        ${data.packages.map(homePackageCard).join('')}
      </div>
      <div class="text-center" style="margin-top:36px">${button('Compare All Packages', 'packages.html', 'outline')}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Why Choose Maven', title: 'Practical support, clearly communicated' })}
      <div class="grid grid-4">
        ${data.whyChoose.slice(0, 6).map(whyCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'How It Works', title: 'A clear, step-by-step process from inquiry to file closing' })}
      <div class="process-list process-list--row">
        ${(() => {
          // Homepage teaser: the full 9-step breakdown lives only in this data
          // (there's no separate process page), so we hand-pick steps that still
          // span the whole arc — inquiry, scoping, requirements, delivery, closing —
          // rather than truncating to the first N and cutting off before any work
          // actually gets done.
          const teaserSteps = data.process.filter((p) => [1, 2, 3, 6, 8, 9].includes(p.step));
          // Renumber 1-5 for display so the badges read as a clean sequence
          // instead of showing the underlying step's real number (which would
          // jump 1, 3, 4, 6, 9 and look like steps are missing).
          return teaserSteps.map((p, i) => processStep({ ...p, step: i + 1 }, i === teaserSteps.length - 1)).join('');
        })()}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Industries We Serve', title: 'Built for the businesses that keep Nepal running' })}
      <div class="grid grid-4">
        ${data.industries.slice(0, 8).map(industryBadge).join('')}
      </div>
      <div class="text-center" style="margin-top:36px">${button('See All Industries', 'industries.html', 'outline')}</div>
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
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Who We Are', title: 'Practical support, organized records, clear communication', align: 'left' })}
        <p>${esc(data.aboutText)}</p>
        <p style="margin-top:16px">${esc(data.aboutClosing)}</p>
      </div>
      <ul class="stamp-list reveal">
        ${data.aboutFacts.map((f) => `<li>${stampMark('stamp-sm')}<span>${esc(f)}</span></li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'What We Value', title: 'The principles behind every engagement' })}
      <div class="grid grid-3">
        ${data.values.map(valueCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Where We Work', title: 'Kathmandu-based, working with clients across Nepal' })}
      <div class="grid grid-4">
        ${data.industries.slice(0, 8).map(industryBadge).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Talk To Maven',
    title: 'Have a question about how we can help your business?',
    subtitle: 'Book a free initial consultation — no obligation, just clear next steps.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Contact Maven Today', 'contact.html', 'outline')],
  })}
  `;
}

module.exports = { home, about };
