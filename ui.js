const { icon, stampMark } = require('./icons');
const { esc, internalHref } = require('./escape');

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

function pageHero(kicker, title, sub) {
  return `<section class="page-hero">
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

function serviceCard(cat) {
  return `<article class="service-card reveal" id="${esc(cat.key)}">
    <div class="service-card-head">
      <span class="service-icon">${icon(cat.icon)}</span>
      <div>
        <span class="service-letter">Category ${esc(cat.letter)}</span>
        <h3>${esc(cat.title)}</h3>
      </div>
    </div>
    <p class="service-tagline">${esc(cat.tagline)}</p>
    ${bulletList(cat.items)}
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

function industryBadge(ind) {
  return `<div class="industry-badge reveal">
    <span class="industry-icon">${icon(ind.icon)}</span>
    <span>${esc(ind.name)}</span>
  </div>`;
}

function packageCard(pkg, i) {
  const highlight = i === 1;
  return `<article class="package-card reveal${highlight ? ' package-card--highlight' : ''}">
    <span class="package-index">0${i + 1}</span>
    <h3>${esc(pkg.name)}</h3>
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

function accordionItem({ id, headingHtml, bodyHtml, open = false }) {
  // headingHtml/bodyHtml are assembled by the caller; callers pass already-escaped
  // CMS text (see pages3.js faq) or code-built markup.
  return `<div class="accordion-item${open ? ' is-open' : ''}">
    <button class="accordion-trigger" aria-expanded="${open}" aria-controls="panel-${id}" id="trigger-${id}">
      <span>${headingHtml}</span>
      ${icon('chevronDown', 'ic-chevron')}
    </button>
    <div class="accordion-panel" id="panel-${id}" role="region" aria-labelledby="trigger-${id}" ${open ? '' : 'style="max-height:0"'}>
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
  industryBadge, packageCard, processStep, accordionItem, ctaBand, trustBar,
};
