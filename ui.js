const { icon, stampMark } = require('./icons');
const { esc, internalHref } = require('./escape');
const data = require('./data');

const SERVICE_PHOTO_META = {
  registration: { file: 'registration', alt: 'Business registration documents prepared for review' },
  bookkeeping: { file: 'bookkeeping', alt: 'Accounting records and bookkeeping working papers' },
  tax: { file: 'tax', alt: 'Tax and compliance documents arranged for review' },
  payroll: { file: 'payroll', alt: 'Payroll records and employee payment documentation' },
  reporting: { file: 'reporting', alt: 'Financial reports and management reporting documents' },
  advisory: { file: 'advisory', alt: 'Business advisory notes and financial planning materials' },
  'nfrs-ifrs': { file: 'reporting', alt: 'Financial reporting materials used for NFRS and IFRS support' },
};

function servicePhotoMeta(cat) {
  return SERVICE_PHOTO_META[cat.key] || { file: 'reporting', alt: cat.title + ' service supporting documents' };
}

function button(label, href, variant = 'primary', extra = '') {
  // label may legitimately contain code-built markup (e.g. an icon), so it is
  // NOT escaped here. href comes from code, not the CMS.
  return `<a class="btn btn-${variant}" href="${internalHref(href)}" ${extra}>${label}</a>`;
}

function eyebrow(text) {
  return `<p class="eyebrow">${esc(text)}</p>`;
}

function sectionHead({ eyebrow: eb, title, subtitle, align = 'center' }) {
  return `<div class="section-head section-head--${align} reveal">
    ${eb ? eyebrow(eb) : ''}
    <h2>${esc(title)}</h2>
    ${subtitle ? `<p class="section-sub">${esc(subtitle)}</p>` : ''}
  </div>`;
}

// bgImage is an optional /images/... path — omitted, every page renders
// exactly as before (plain navy). Being rolled out one page at a time (see
// the homepage .hero for the same gradient-over-photo technique); when
// supplied, the gradient is inlined here since each page's photo differs, so
// there's no reason to add a new CSS class per page as more get one.
function pageHero(kicker, title, sub, bgImage) {
  const style = bgImage
    ? ` style="background-image: linear-gradient(180deg, rgba(10,31,58,0.6) 0%, rgba(16,42,76,0.72) 100%), url('${esc(bgImage)}')"`
    : '';
  return `<section class="page-hero${bgImage ? ' page-hero--photo' : ''}"${style}>
    <div class="container">
      <p class="eyebrow eyebrow--on-dark">${esc(kicker)}</p>
      <h1>${esc(title)}</h1>
      ${sub ? `<p class="page-hero-sub">${esc(sub)}</p>` : ''}
    </div>
  </section>`;
}

function bulletList(items, cls = 'stamp-list') {
  return `<ul class="${cls}">${items.map(i => `<li>${stampMark('stamp-sm')}<span>${esc(i)}</span></li>`).join('')}</ul>`;
}

function serviceCard(cat, index = 0) {
  // Full Services page: use an editorial image/content row instead of
  // repeating another generic bordered card grid. Existing approved Maven
  // service imagery is reused locally (no third-party dependency). NFRS/IFRS
  // intentionally shares the reporting image until a dedicated approved
  // photo is supplied.
  const photo = servicePhotoMeta(cat);
  const reverse = index % 2 ? ' service-editorial--reverse' : '';
  return `<article class="service-editorial reveal${reverse}" id="${esc(cat.key)}">
    <div class="service-editorial-photo">
      <img src="/images/card-${esc(photo.file)}.jpg" alt="${esc(photo.alt)}" loading="lazy" decoding="async">
      <span class="service-editorial-photo-shade" aria-hidden="true"></span>
      <span class="service-editorial-icon" aria-hidden="true">${icon(cat.icon)}</span>
    </div>
    <div class="service-editorial-body">
      <span class="service-letter">Category ${esc(cat.letter)}</span>
      <h2>${esc(cat.title)}</h2>
      <p class="service-tagline">${esc(cat.tagline)}</p>
      ${bulletList(cat.items)}
      <div class="service-editorial-actions"><a class="btn btn-outline btn-sm" href="${internalHref('contact.html')}">Discuss This Service</a></div>
    </div>
  </article>`;
}

function valueCard(v) {
  return `<div class="value-card reveal">
    <h3>${esc(v.title)}</h3>
    <p>${esc(v.text)}</p>
  </div>`;
}

function whyCard(v) {
  return `<div class="why-card reveal">
    <span class="why-mark">${stampMark()}</span>
    <h3>${esc(v.title)}</h3>
    <p>${esc(v.text)}</p>
  </div>`;
}

// A plain, unlinked <div> here had a hover highlight (border/shadow) with
// nothing behind it — every hover cue on this site otherwise means "click
// me," so this was a real "looks clickable, does nothing" trap. Links to the
// matching card on the Industries page, which auto-opens on arrival (see the
// hash-handling in client.js) instead of dumping the visitor on a page they
// have to re-find their own industry on.
function industryBadge(ind, i) {
  return `<a class="industry-badge reveal" href="${internalHref('industries.html')}#industry-${i}">
    <span class="industry-icon">${icon(ind.icon)}</span>
    <span>${esc(ind.name)}</span>
  </a>`;
}

// Richer version of industryBadge, for the dedicated Industries page only —
// the homepage/About teasers stay as compact badges (no description) so this
// doesn't reintroduce the crowding a fuller card would add there.
// Click-to-expand: the short description is always visible; needs/howWeHelp
// (the fuller detail from the source content, too much to show on every card
// at once) reveal on click, same pattern as the FAQ/documents accordions but
// wired independently (see .industry-card-toggle in client.js) since the
// trigger here is a card footer, not a full-width question row.
function industryCard(ind, i) {
  const id = `industry-${i}`;
  // The old design expanded detail inside one item of a three-column CSS
  // grid. That made the entire row inherit the tallest card's height and
  // produced the large empty white blocks visible in the reported bug.
  // Cards are now stable selectors; rich detail renders in a dedicated
  // full-width stage below the grid instead of changing one grid row's
  // geometry.
  return `<article class="industry-card reveal" id="${id}">
    <span class="industry-card-icon">${icon(ind.icon)}</span>
    <h2>${esc(ind.name)}</h2>
    ${ind.description ? `<p>${esc(ind.description)}</p>` : ''}
    <button type="button" class="industry-card-select" aria-expanded="false" aria-controls="detail-${id}" data-industry-index="${i}">
      <span>View common needs &amp; support</span>
      ${icon('arrowRight')}
    </button>
  </article>`;
}

function industryDetail(ind, i) {
  const id = `industry-${i}`;
  return `<section class="industry-detail-panel" id="detail-${id}" data-industry-detail="${i}" hidden aria-labelledby="detail-title-${id}">
    <div class="industry-detail-heading">
      <span class="industry-detail-icon">${icon(ind.icon)}</span>
      <div><span class="service-letter">Industry support</span><h2 id="detail-title-${id}">${esc(ind.name)}</h2></div>
    </div>
    ${ind.description ? `<p class="industry-detail-intro">${esc(ind.description)}</p>` : ''}
    <div class="industry-detail-grid">
      <div>
        <h3>Common needs</h3>
        ${bulletList(ind.needs || [], 'stamp-list stamp-list--pkg')}
      </div>
      <div>
        <h3>How Maven helps</h3>
        ${bulletList(ind.howWeHelp || [], 'stamp-list stamp-list--pkg')}
      </div>
    </div>
    <div class="industry-detail-actions">
      <a class="btn btn-primary btn-sm" href="${data.whatsappHref(`Hello Maven, I would like to ask about accounting support for my business (${ind.name}).`)}" target="_blank" rel="noopener">${icon('whatsapp')} Ask About This Industry</a>
      <a class="btn btn-outline btn-sm" href="${internalHref('contact.html')}">Book a Consultation</a>
    </div>
  </section>`;
}

function packageCard(pkg, i) {
  const highlight = i === 1;
  return `<article class="package-card reveal${highlight ? ' package-card--highlight' : ''}">
    <span class="package-index">0${i + 1}</span>
    <h2>${esc(pkg.name)}</h2>
    <p class="package-audience">${esc(pkg.audience)}</p>
    <p class="package-price">Quote after review</p>
    ${bulletList(pkg.items, 'stamp-list stamp-list--pkg')}
    <a class="btn btn-outline btn-block" href="${internalHref('contact.html')}">Enquire About This Package</a>
  </article>`;
}

function processStep(p, isLast) {
  return `<div class="process-step reveal">
    <div class="process-step-marker"><span>${esc(p.step)}</span></div>
    ${!isLast ? '<div class="process-step-line" aria-hidden="true"></div>' : ''}
    <div class="process-step-body">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.text)}</p>
    </div>
  </div>`;
}

// Big-number trust signals (Founded/Clients/Industries/Services) instead of
// the checkmark-claim style trustBar() above — numbers read as more concrete
// evidence than adjectives. Industries/service-category counts are computed
// by the caller from the real data arrays (not hand-typed) so they can't
// drift out of sync if one gets added or removed later.
function statRow(stats) {
  return `<div class="stat-row reveal">
    ${stats.map((s) => `<div class="stat-item">
      <span class="stat-value">${esc(s.value)}</span>
      <span class="stat-label">${esc(s.label)}</span>
    </div>`).join('')}
  </div>`;
}

function accordionItem({
  id, headingHtml, bodyHtml, open = false, headingLevel = 'h3',
}) {
  // headingHtml/bodyHtml are assembled by the caller; callers pass already-escaped
  // CMS text (see pages3.js faq) or code-built markup.
  //
  // Handbook Task 25: the panel's INITIAL rendered state now always
  // matches its class/aria-expanded state, server-side, with no
  // dependency on client.js having run yet. Previously an open panel
  // got no inline style at all (relying on a CSS override that never
  // existed), so it rendered visually collapsed despite is-open/aria-
  // expanded="true" -- the root cause of the "first click closes an
  // already-invisible panel, second click actually opens it" bug.
  // max-height:none (not a hardcoded pixel guess) so arbitrarily long
  // answer text is never clipped. client.js converts this to a real
  // pixel value on load so later toggles can still animate (a CSS
  // transition can't interpolate from `none`).
  //
  // inert on a closed panel keeps its contents (any links inside an
  // answer) out of Tab order while visually hidden -- collapsed
  // descendants must not be keyboard-focusable.
  //
  // Handbook Task 26: the trigger button is now wrapped in a real heading
  // element (the standard WAI-ARIA accordion pattern) so a screen-reader
  // user browsing by heading can find each question/item directly,
  // instead of jumping straight from the page's h1 to whatever heading
  // happens to follow the accordion. headingLevel is caller-supplied
  // because the correct level depends on what precedes the accordion on
  // that particular page (h2 when there's no other h2 yet, e.g. FAQ; h3
  // when a sectionHead() already provided one, e.g. every NFRS/IFRS-style
  // support-area accordion).
  const Heading = headingLevel;
  return `<div class="accordion-item${open ? ' is-open' : ''}">
    <${Heading} class="accordion-heading">
      <button type="button" class="accordion-trigger" aria-expanded="${open}" aria-controls="panel-${id}" id="trigger-${id}">
        <span>${headingHtml}</span>
        ${icon('chevronDown', 'ic-chevron')}
      </button>
    </${Heading}>
    <div class="accordion-panel" id="panel-${id}" role="region" aria-labelledby="trigger-${id}" style="max-height:${open ? 'none' : '0'}"${open ? '' : ' inert'}>
      <div class="accordion-panel-inner">${bodyHtml}</div>
    </div>
  </div>`;
}

function ctaBand({ eyebrow: eb, title, subtitle, buttons }) {
  return `<section class="cta-band">
    <div class="container cta-band-inner reveal">
      ${eb ? `<p class="eyebrow eyebrow--on-dark">${esc(eb)}</p>` : ''}
      <h2>${esc(title)}</h2>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      <div class="cta-band-actions">${buttons.join('')}</div>
    </div>
  </section>`;
}

function trustBar(points) {
  return `<div class="trust-bar reveal">
    ${points.map(p => `<div class="trust-item">${icon('check', 'ic-trust')}<span>${esc(p)}</span></div>`).join('')}
  </div>`;
}

module.exports = {
  button, eyebrow, sectionHead, pageHero, bulletList, serviceCard, valueCard, whyCard,
  industryBadge, industryCard, industryDetail, packageCard, processStep, accordionItem, ctaBand, trustBar, statRow, servicePhotoMeta,
};
