const data = require('./data');
const { esc, internalHref } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, valueCard, whyCard, processStep, ctaBand, trustBar, accordionItem, industryBadge,
  statRow, servicePhotoMeta,
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

  return `<div class="hero-art reveal">
    <div class="hero-float-badge">
      ${icon('users')}
      <div><strong>${esc(data.brand.clientsServed)}</strong><span>Clients Served</span></div>
    </div>
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

// Photo header + icon badge, matching the object-photo language used
// throughout the hero-photo rollout (see [[maven_hero_photo_rollout]] in
// memory) — deliberately objects, not people, for consistency with every
// other photo on the site and to avoid the trust risk of AI-generated fake
// "staff" photos. Image path is derived from cat.key (images/card-<key>.jpg)
// so adding a 7th category needs only a new image file, no code change.
// Dropped the old bullet-list preview: with a photo now providing visual
// interest, repeating 3 of the category's items just crowded the card.
// The whole card is the link (not just "See Full List" at the bottom) —
// .service-card's hover lift/shadow applies to the full card area, so a
// card that only *looked* fully clickable but wasn't would be the same
// "looks clickable, does nothing" trap fixed earlier for industry badges.
function homeServiceCard(cat) {
  const photo = servicePhotoMeta(cat);
  return `<a class="service-card service-card--photo reveal" href="${internalHref(`services.html#${cat.key}`)}">
    <div class="service-card-photo">
      <img src="/images/card-${esc(photo.file)}.jpg" alt="" loading="lazy" decoding="async">
      <span class="service-card-photo-shade" aria-hidden="true"></span>
      <span class="service-card-photo-badge" aria-hidden="true">${icon(cat.icon)}</span>
    </div>
    <div class="service-card-body">
      <span class="service-letter">Category ${esc(cat.letter)}</span>
      <h3>${esc(cat.title)}</h3>
      <p class="service-tagline">${esc(cat.tagline)}</p>
      <span class="service-card-link">See Full List ${icon('arrowRight')}</span>
    </div>
  </a>`;
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
        <h1>Reliable Accounting, Tax, Compliance &amp; Financial Management Support for Businesses in Nepal</h1>
        <p class="hero-sub">Maven Consultancy Services Pvt. Ltd. helps startups, SMEs, traders, service companies, and growing businesses maintain accurate records, manage cash flow, meet compliance requirements, and understand financial performance through practical consultancy and outsourced accounting support.</p>
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

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'What We Do', title: 'Services built around what Nepali businesses actually need', subtitle: 'From first registration to monthly compliance, Maven supports each stage with clear, practical work.' })}
      <div class="grid grid-3">
        ${data.serviceCategories.filter((c) => c.key !== 'nfrs-ifrs').map(homeServiceCard).join('')}
        <div class="service-cta-tile reveal">
          <div>
            <h3>Not sure which service fits?</h3>
            <p>Tell us about your business — we'll recommend the right mix, no obligation.</p>
          </div>
          ${button('Book a Free Initial Consultation', 'contact.html', 'primary')}
        </div>
      </div>
      <div class="hero-actions" style="justify-content:center;margin-top:36px">
        ${button('View All Services', 'services.html', 'outline')}
        ${button('NFRS / IFRS Implementation Support', 'nfrs-ifrs.html', 'outline')}
      </div>
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
      <div style="margin-top:56px">
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

  <section class="section-pad bg-navy skyline-section international-showcase">
    <div class="container international-showcase-grid">
      <div class="reveal international-showcase-copy">
        <p class="eyebrow eyebrow--on-dark">International Services</p>
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
        <p>${esc(data.aboutText)}</p>
        <p style="margin-top:16px">${esc(data.aboutClosing)}</p>
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
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Contact Maven Today', 'contact.html', 'ghost-light')],
  })}
  `;
}

module.exports = { home, about };
