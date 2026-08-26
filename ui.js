const { icon, stampMark } = require('./icons');
const { esc, internalHref } = require('./escape');
const data = require('./data');

// file is the full /images/<file>.jpg path fragment (already including the
// "card-" prefix the actual asset files use) — callers use it as-is, no
// prefix is added anywhere else.
const SERVICE_PHOTO_META = {
  registration: { file: 'card-registration', alt: 'Business registration documents prepared for review' },
  bookkeeping: { file: 'card-bookkeeping', alt: 'Accounting records and bookkeeping working papers' },
  tax: { file: 'card-tax', alt: 'Tax and compliance documents arranged for review' },
  payroll: { file: 'card-payroll', alt: 'Payroll records and employee payment documentation' },
  reporting: { file: 'card-reporting', alt: 'Financial reports and management reporting documents' },
  advisory: { file: 'card-advisory', alt: 'Business advisory notes and financial planning materials' },
  'nfrs-ifrs': { file: 'card-reporting', alt: 'Financial reporting materials used for NFRS and IFRS support' },
};

function servicePhotoMeta(cat) {
  return SERVICE_PHOTO_META[cat.key] || { file: 'card-reporting', alt: cat.title + ' service supporting documents' };
}

function button(label, href, variant = 'primary', extra = '') {
  // label may legitimately contain code-built markup (e.g. an icon), so it is
  // NOT escaped here. href comes from code, not the CMS.
  return `<a class="btn btn-${variant}" href="${internalHref(href)}" ${extra}>${label}</a>`;
}

// Audit issues 6-8: uppercase is a label treatment, not a paragraph
// treatment. Rather than copy-editing 50 eyebrow strings (30 of which are
// 16+ characters, the longest 48), the helper decides by length: short
// tags keep the uppercase kicker, phrase-length labels fall back to bold
// gold sentence case. See .eyebrow / .eyebrow--caps in styles.css.
const LABEL_CAPS_MAX = 15; // beyond this, uppercase costs more than it signals

function eyebrow(text) {
  const cls = String(text).length <= LABEL_CAPS_MAX ? 'eyebrow eyebrow--caps' : 'eyebrow';
  return `<p class="${cls}">${esc(text)}</p>`;
}

// Same rule for the small panel labels previously written inline as
// <span class="service-letter">. That class was built for a single
// category letter ("Category A") and is now carrying phrases.
function eyebrowOnDark(text) {
  const caps = String(text).length <= LABEL_CAPS_MAX ? ' eyebrow--caps' : '';
  return `<p class="eyebrow eyebrow--on-dark${caps}">${esc(text)}</p>`;
}

function panelLabel(text, extra = '') {
  const cls = String(text).length <= LABEL_CAPS_MAX ? 'panel-label panel-label--caps' : 'panel-label';
  return `<span class="${cls}"${extra}>${esc(text)}</span>`;
}

function sectionHead({ eyebrow: eb, title, subtitle, align = 'center' }) {
  return `<div class="section-head section-head--${align} reveal">
    ${eb ? eyebrow(eb) : ''}
    <h2>${esc(title)}</h2>
    ${subtitle ? `<p class="section-sub">${esc(subtitle)}</p>` : ''}
  </div>`;
}

// Matches WIDTHS in scripts/generate-responsive-images.js -- keep in sync.
// Two generated tiers (mobile/tablet); the original file is the third,
// largest tier for wide desktop viewports.
const RESPONSIVE_WIDTHS = [640, 960];

// bgImage is a /images/<file>.jpg path -- inserts a "-<width>w" suffix
// before the extension to reach the resized variant scripts/generate-
// responsive-images.js produces at build time.
function responsiveVariant(bgImage, width) {
  return bgImage.replace(/\.jpg$/, `-${width}w.jpg`);
}

// bgImage is an optional /images/... path — omitted, every page renders
// exactly as before (plain navy). Being rolled out one page at a time (see
// the homepage .hero for the same gradient-over-photo technique); when
// supplied, a small scoped <style> block (not an inline style attribute,
// since only <style>/external CSS can hold @media queries) swaps in a
// smaller image on narrower viewports -- safe to scope by the shared
// .page-hero--photo class since each page is its own HTML document, so
// there's only ever one of these per document. Each page's photo differs,
// so the gradient+image declaration is generated per call rather than
// living in a shared CSS class.
function pageHero(kicker, title, sub, bgImage) {
  const gradient = 'linear-gradient(180deg, rgba(10,31,58,0.6) 0%, rgba(16,42,76,0.72) 100%)';
  const responsiveStyle = bgImage
    ? `<style>
      .page-hero--photo{background-image:${gradient},url('${esc(responsiveVariant(bgImage, 640))}')}
      @media (min-width:768px){.page-hero--photo{background-image:${gradient},url('${esc(responsiveVariant(bgImage, 960))}')}}
      @media (min-width:1280px){.page-hero--photo{background-image:${gradient},url('${esc(bgImage)}')}}
    </style>`
    : '';
  return `${responsiveStyle}<section class="page-hero${bgImage ? ' page-hero--photo' : ''}">
    <div class="container">
      ${eyebrowOnDark(kicker)}
      <h1>${esc(title)}</h1>
      ${sub ? `<p class="page-hero-sub">${esc(sub)}</p>` : ''}
    </div>
  </section>`;
}

function bulletList(items, cls = 'stamp-list') {
  return `<ul class="${cls}">${items.map(i => `<li>${stampMark('stamp-sm')}<span>${esc(i)}</span></li>`).join('')}</ul>`;
}

// Task 05: individual service entry within a Services-page capability
// chapter — typography + a restrained icon marker (the same .service-icon
// badge already used for internationalTile()/pages2,4,7 service tiles), not
// a forced photo per service. The chapter it belongs to already carries the
// one shared editorial image (see capabilityChapter() below); this keeps
// each of the 7 real services fully described (tagline + full item list)
// without repeating a detached photo box next to every one of them.
// Task 16: two of the seven services (Outsourced Accounting & Bookkeeping,
// NFRS/IFRS) have their own dedicated deep-dive page -- their entry's CTA
// should go there, not skip straight to Contact like the other five
// (which have no page of their own to link to). Callers pass an optional
// { href, ctaLabel } override; the default stays "Discuss This Service" -> contact.html.
function serviceEntry(cat, opts = {}) {
  const href = opts.href || 'contact.html';
  const ctaLabel = opts.ctaLabel || 'Discuss This Service';
  return `<article class="service-card reveal" id="${esc(cat.key)}">
    <div class="service-card-head">
      <span class="service-icon">${icon(cat.icon)}</span>
      <div>
        ${panelLabel('Category ' + cat.letter)}
        <h3>${esc(cat.title)}</h3>
      </div>
    </div>
    <p class="service-tagline">${esc(cat.tagline)}</p>
    ${bulletList(cat.items)}
    <div style="margin-top:20px">${button(ctaLabel, href, 'outline', `aria-label="${esc(ctaLabel + ' — ' + cat.title)}"`)}</div>
  </article>`;
}

// Task 02: the shared "capability chapter" primitive — one integrated
// composition (image + chapter label + heading + a short list of real
// service links + one CTA), built to combine multiple service categories
// into a single feature-level story instead of one photo per category.
// NOT wired into any page yet (see docs/ARCHITECTURE_MAP.md — that's
// deliberately later, page-specific work); this only defines the
// reusable piece and proves it renders correctly (test/ui-components.test.js).
//
// variant: 'structured' | 'feature' | 'technical' — matches the three
// capability chapters (Establish & Comply / Run Your Finance Function /
// Advise & Report Better) and their distinct visual weights; see the
// .capability-chapter--* rules in styles.css for what each actually changes.
// image: { file, alt } — file is an /images/<file>.jpg path fragment,
// same convention as servicePhotoMeta(), so real photography can replace
// the current editorial/stock image by swapping the file, never the markup.
// links: [{ label, href }] — href should be a real internal anchor this
// chapter groups (e.g. 'services.html#tax'), not a new destination.
// cta: { label, href }
function capabilityChapter({
  variant, chapterLabel, title, text, image, links = [], cta, reverse = false, id,
}) {
  const modifier = variant ? ` capability-chapter--${esc(variant)}` : '';
  const reverseClass = reverse ? ' capability-chapter--reverse' : '';
  const idAttr = id ? ` id="${esc(id)}"` : '';
  // Audit issue 13: `text` used to be several service taglines joined into
  // one string, describing the same services listed immediately below it.
  // A link may now carry its own one-line `note` instead, which removes
  // both the wall of text and the duplication. `text` stays supported for
  // chapters that genuinely need a lead sentence.
  const linksHtml = links.length
    ? `<ul class="capability-chapter-links">${links.map((l) => `<li><a href="${internalHref(l.href)}">${icon('chevronRight')}<span>${esc(l.label)}</span></a>${l.note ? `<p class="capability-chapter-note">${esc(l.note)}</p>` : ''}</li>`).join('')}</ul>`
    : '';
  const ctaHtml = cta
    ? `<div class="capability-chapter-actions">${button(cta.label, cta.href, 'outline', 'aria-label="' + esc(cta.label + ' — ' + title) + '"')}</div>`
    : '';
  return `<article class="capability-chapter reveal${modifier}${reverseClass}"${idAttr}>
    <div class="capability-chapter-photo">
      <img src="/images/${esc(image.file)}.jpg" srcset="${RESPONSIVE_WIDTHS.map((w) => `/images/${esc(image.file)}-${w}w.jpg ${w}w`).join(', ')}" sizes="(min-width: 780px) 40vw, 100vw" alt="${esc(image.alt)}" loading="lazy" decoding="async">
      <span class="capability-chapter-photo-shade" aria-hidden="true"></span>
    </div>
    <div class="capability-chapter-body">
      ${eyebrow(chapterLabel)}
      <h2>${esc(title)}</h2>
      ${text ? `<p class="capability-chapter-text">${esc(text)}</p>` : ''}
      ${linksHtml}
      ${ctaHtml}
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
// Task 06: with 13 real industries, a grid of description-cards became a
// "many-industry selection problem" in its own right (too tall to scan, and
// the old design once expanded detail inside one grid card, which made the
// whole row inherit the tallest card's height — see the git history for
// that bug). Cards are now one compact selector row each (icon + name only;
// the description still lives in the matching detail panel below, so no
// content is lost, just not duplicated in the picker). Rich detail renders
// in a dedicated stage next to (desktop) or after (mobile) this list —
// never inside the list itself.
function industryCard(ind, i) {
  const id = `industry-${i}`;
  return `<li class="industry-list-item">
    <button type="button" class="industry-card reveal" id="${id}" aria-expanded="false" aria-controls="detail-${id}" data-industry-index="${i}">
      <span class="industry-card-icon">${icon(ind.icon)}</span>
      <span class="industry-card-name">${esc(ind.name)}</span>
      ${icon('chevronRight', 'industry-card-chevron')}
    </button>
  </li>`;
}

function industryDetail(ind, i) {
  const id = `industry-${i}`;
  return `<section class="industry-detail-panel" id="detail-${id}" data-industry-detail="${i}" hidden aria-labelledby="detail-title-${id}">
    <div class="industry-detail-heading">
      <span class="industry-detail-icon">${icon(ind.icon)}</span>
      <div>${panelLabel('Industry support')}<h2 id="detail-title-${id}">${esc(ind.name)}</h2></div>
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

// No "most popular"/highlight treatment -- all three packages serve
// genuinely different, equally valid situations (new setup / ongoing
// compliance / growth), not a tiered "better choice" ladder, and there's
// no real usage data behind a "most chosen" claim to justify singling
// one out visually. .package-price is a deliberately isolated, single-
// purpose slot ("Quote after review") so a real starting-price figure
// could replace just that one line cleanly if Maven ever publishes one --
// nothing else in the card structure would need to change.
function packageCard(pkg, i) {
  return `<article class="package-card reveal">
    <span class="package-index">0${i + 1}</span>
    <h2>${esc(pkg.name)}</h2>
    ${pkg.tagline ? `<p class="package-tagline">${esc(pkg.tagline)}</p>` : ''}
    <p class="package-audience"><strong>Best suited for:</strong> ${esc(pkg.audience)}</p>
    ${pkg.situation ? `<p class="package-situation"><strong>Typical situation:</strong> ${esc(pkg.situation)}</p>` : ''}
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
  // data-count-final keeps the exact original string ("100+", "2022") as
  // the source of truth; client.js's reveal observer animates the numeric
  // prefix up from 0 once when this row scrolls into view, then restores
  // this exact text -- the rendered value here is already correct without
  // JS (progressive enhancement, same fail-open principle as .reveal
  // itself), the animation is purely additive polish on top of it.
  return `<div class="stat-row reveal">
    ${stats.map((s) => `<div class="stat-item">
      <span class="stat-value" data-count-final="${esc(s.value)}">${esc(s.value)}</span>
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
    <div class="accordion-panel" id="panel-${id}" role="region" aria-labelledby="trigger-${id}" aria-hidden="${open ? 'false' : 'true'}" style="max-height:${open ? 'none' : '0'}"${open ? '' : ' inert'}>
      <div class="accordion-panel-inner">${bodyHtml}</div>
    </div>
  </div>`;
}

function ctaBand({ eyebrow: eb, title, subtitle, buttons }) {
  return `<section class="cta-band">
    <div class="container cta-band-inner reveal">
      ${eb ? eyebrowOnDark(eb) : ''}
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
  button, eyebrow, eyebrowOnDark, panelLabel, sectionHead, pageHero, bulletList, serviceEntry, capabilityChapter, valueCard, whyCard,
  industryBadge, industryCard, industryDetail, packageCard, processStep, accordionItem, ctaBand, trustBar, statRow, servicePhotoMeta,
};
