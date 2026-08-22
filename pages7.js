const data = require('./data');
const { icon } = require('./icons');
const {
  button, sectionHead, pageHero, bulletList, whyCard, processStep, accordionItem, ctaBand,
} = require('./ui');
const { esc, internalHref } = require('./escape');

function supportAreaAccordion(area, i) {
  const output = area.output && area.output.length
    ? `<p class="service-letter" style="margin-top:18px;display:block">Typical Output</p>${bulletList(area.output, 'stamp-list stamp-list--pkg')}`
    : '';
  const note = area.note ? `<p class="tag-note" style="margin-top:14px">${esc(area.note)}</p>` : '';
  return accordionItem({
    id: `nfrs-area-${i}`,
    headingHtml: esc(area.title),
    bodyHtml: `<p>${esc(area.intro)}</p>${bulletList(area.items, 'stamp-list stamp-list--pkg')}${output}${note}`,
    open: false,
  });
}

// Task 07: the four sections below (statement prep, policies, management
// reporting, deliverables, why-choose) used to render as always-visible
// intro+bullet-list+note blocks in the main reading path. Nothing in them
// changed — they're now collapsed accordion items instead, same pattern as
// supportAreaAccordion() above, just generalized since these don't all
// share supportAreaAccordion's optional "output" field.
function technicalDetailAccordion({ id, title, intro, items, note }) {
  const body = `${intro ? `<p>${esc(intro)}</p>` : ''}${bulletList(items || [], 'stamp-list stamp-list--pkg')}${note ? `<p class="tag-note" style="margin-top:14px">${esc(note)}</p>` : ''}`;
  return accordionItem({ id, headingHtml: esc(title), bodyHtml: body, open: false });
}

// Audit prep keeps its own function because its disclaimer ("Defined
// Professional Boundaries" -- Maven does not issue statutory audit
// opinions) is compliance-sensitive and stays in the same visually
// distinct .partner-note treatment it always had, not demoted to a plain
// .tag-note, even though it now sits inside a collapsed accordion body.
function auditPrepAccordion(auditPrep) {
  const body = `<p>${esc(auditPrep.intro || '')}</p>${bulletList(auditPrep.items || [], 'stamp-list stamp-list--pkg')}<div class="partner-note reveal" style="margin-top:20px"><h3 class="partner-note-title">Defined Professional Boundaries</h3><p>${esc(auditPrep.note || '')}</p></div>`;
  return accordionItem({ id: 'nfrs-audit-prep', headingHtml: 'Audit Preparation Support', bodyHtml: body, open: false });
}

// Related Services: real, existing service categories only (Financial
// Management & Reporting, Business Advisory, Outsourced Accounting) --
// title/tagline pulled straight from data.serviceCategories, not written
// fresh here, so this can never drift from or duplicate the Services page's
// own copy.
function relatedServiceCard(cat) {
  const href = cat.key === 'bookkeeping' ? 'outsourced-accounting.html' : `services.html#${cat.key}`;
  return `<article class="service-card reveal">
    <div class="service-card-head">
      <span class="service-icon">${icon(cat.icon)}</span>
      <h3>${esc(cat.title)}</h3>
    </div>
    <p class="service-tagline">${esc(cat.tagline)}</p>
    <div style="margin-top:16px">${button('Learn More', href, 'outline', `aria-label="${esc('Learn more about ' + cat.title)}"`)}</div>
  </article>`;
}

function nfrsIfrs() {
  const h = data.pageHeader('nfrs-ifrs');
  const n = data.nfrsIfrs || {};
  const technicalArea = (n.supportAreas || [])[2] || {};
  const boundaryEntry = (n.whyChoose || []).find((w) => w.title === 'Defined Professional Boundaries') || {};
  const boundaryNote = boundaryEntry.text || '';
  const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
  const relatedCategories = [byKey('reporting'), byKey('advisory'), byKey('bookkeeping')].filter(Boolean);

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/card-reporting.jpg')}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(n.intro)}</p>
      <div style="margin-top:24px">${button('Book a Free Initial Consultation', 'contact.html', 'primary')}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Who This Service Is For', title: 'Is this the right fit for your business?' })}
      ${bulletList(n.whoFor || [], 'stamp-list stamp-list--pkg')}
      <p class="tag-note" style="margin-top:16px">${esc(n.whoForNote)}</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Major Reporting Considerations', title: 'Where deeper technical analysis may be needed' })}
      <p class="reveal">${esc(technicalArea.intro || '')}</p>
      <div class="topic-chip-list reveal">
        ${(technicalArea.items || []).map((t) => `<span class="topic-chip">${esc(t)}</span>`).join('')}
      </div>
      <p class="reveal" style="margin-top:16px">${esc((n.statementPrep || {}).note || '')} ${esc((n.policies || {}).note || '')} ${esc((n.managementReporting || {}).note || '')}</p>
      <p class="tag-note" style="margin-top:16px">${esc(technicalArea.note || '')}</p>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'How Maven Supports You', title: n.introHeading })}
      <p class="reveal">${esc(n.introBody)}</p>
      <p class="reveal" style="margin-top:14px">Support can extend across readiness assessment, transition planning, technical accounting analysis, financial statement preparation, policy documentation, management reporting, and audit-preparation coordination — covered area by area below.</p>
      ${(n.whyChoose || []).slice(0, 3).map((w) => `<p class="reveal" style="margin-top:14px"><strong>${esc(w.title)}.</strong> ${esc(w.text)}</p>`).join('')}
      <div class="info-note reveal" style="margin-top:20px">${esc(boundaryNote)}</div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Our Implementation Approach', title: 'From understanding your business to handover' })}
      <div class="process-list process-list--row">
        ${(n.process || []).map((p, i, arr) => processStep({ step: i + 1, title: p.title, text: p.text }, i === arr.length - 1)).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Technical Detail', title: 'Full scope, area by area' })}
      <div class="accordion">
        ${(n.supportAreas || []).map(supportAreaAccordion).join('')}
        ${technicalDetailAccordion({ id: 'nfrs-statement-prep', title: (n.statementPrep || {}).heading || 'Financial Statement Preparation', intro: (n.statementPrep || {}).intro, items: (n.statementPrep || {}).items, note: (n.statementPrep || {}).note })}
        ${technicalDetailAccordion({ id: 'nfrs-policies', title: 'Accounting Policies & Documentation', intro: (n.policies || {}).intro, items: (n.policies || {}).items, note: (n.policies || {}).note })}
        ${technicalDetailAccordion({ id: 'nfrs-mgmt-reporting', title: 'Management Reporting Connection', intro: (n.managementReporting || {}).intro, items: (n.managementReporting || {}).items, note: (n.managementReporting || {}).note })}
        ${auditPrepAccordion(n.auditPrep || {})}
        ${technicalDetailAccordion({ id: 'nfrs-deliverables', title: 'Typical Deliverables', intro: null, items: n.deliverables, note: n.deliverablesNote })}
        ${technicalDetailAccordion({ id: 'nfrs-why-choose', title: 'Why Work With Maven', intro: null, items: (n.whyChoose || []).map((w) => `${w.title}: ${w.text}`), note: null })}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'NFRS / IFRS Implementation FAQ' })}
      <div class="accordion">
        ${(n.faqs || []).map((f, i) => accordionItem({
          id: `nfrs-faq-${i}`,
          headingHtml: esc(f.q),
          bodyHtml: `<p>${esc(f.a)}</p>`,
          open: false,
        })).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Related Services', title: 'Often paired with NFRS / IFRS support' })}
      <div class="grid grid-3 reveal-stagger">
        ${relatedCategories.map(relatedServiceCard).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Improve Your Financial Reporting Before Year-End',
    title: 'Build a practical NFRS / IFRS implementation plan',
    subtitle: n.cta,
    buttons: [button('Book an NFRS / IFRS Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about NFRS / IFRS implementation support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function internationalAccounting() {
  const h = data.pageHeader('international-accounting');
  const a = data.internationalAccounting || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/global-outsourcing-hero-bg.jpg')}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(a.intro)}</p>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'What We Support', title: 'Bookkeeping, reconciliation, and reporting — done for you' })}
      ${bulletList(a.services || [], 'stamp-list stamp-list--pkg')}
      <div class="info-note reveal" style="margin-top:24px">${esc(a.scopeNote)}</div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Why Businesses Outsource To Maven', title: 'Built for reliable remote finance capacity' })}
      <div class="grid grid-4 reveal-stagger">
        ${(a.benefits || []).map(whyCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'How Outsourced Accounting Works', title: 'From discovery call to ongoing support' })}
      <div class="process-list process-list--row">
        ${(a.process || []).map((p, i, arr) => processStep({ step: i + 1, title: p.title, text: p.text }, i === arr.length - 1)).join('')}
      </div>
      <p class="text-center tag-note" style="margin-top:24px">Ready for more than bookkeeping? See <a href="${internalHref('virtual-cfo.html')}" style="color:var(--gold-700);font-weight:700">Virtual CFO &amp; Management Reporting</a>.</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'The Work Cycle', title: 'How a period of accounting work actually flows' })}
      <div class="flow-diagram reveal-stagger">
        ${[
          'Client Accounting System', 'Bookkeeping & Reconciliation', 'Internal Review',
          'Queries / Exception List', 'Reporting', 'Client Review',
        ].map((step, i, arr) => `<div class="flow-step"><span>${esc(step)}</span></div>${i < arr.length - 1 ? `<span class="flow-arrow" aria-hidden="true">${icon('chevronRight')}</span>` : ''}`).join('')}
      </div>
      <p class="text-center tag-note" style="margin-top:20px">The same cycle repeats each period — work starts from your own accounting system and ends with you reviewing what was done, not with figures disappearing into a black box.</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Support For Accounting Firms', title: 'Back-office capacity for your practice', align: 'left' })}
        <p>${esc((a.firmSupport || {}).intro)}</p>
        ${bulletList((a.firmSupport || {}).items || [], 'stamp-list stamp-list--pkg')}
        <p class="tag-note" style="margin-top:16px">${esc((a.firmSupport || {}).note)}</p>
      </div>
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Tools & Working Environment', title: 'We work inside the systems you already use', align: 'left' })}
        <p>${esc((a.tools || {}).intro)}</p>
        ${bulletList((a.tools || {}).items || [], 'stamp-list stamp-list--pkg')}
        <p class="tag-note" style="margin-top:16px">${esc((a.tools || {}).note)}</p>
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      <div class="partner-note reveal">
        <h2 class="partner-note-title">Data Security &amp; Confidentiality</h2>
        <p>${esc(a.securityNote)}</p>
      </div>
      <div class="partner-note reveal" style="margin-top:24px">
        <h2 class="partner-note-title">Clear Professional Scope</h2>
        <p>${esc(a.scopeBoundary)}</p>
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      ${sectionHead({ eyebrow: 'Working With Maven', title: 'Start Small' })}
      <p class="text-center reveal">${esc((a.startSmall || {}).intro)}</p>
      ${bulletList((a.startSmall || {}).items || [], 'stamp-list stamp-list--pkg')}
      <div class="info-note reveal" style="margin-top:24px">${esc((a.startSmall || {}).note)}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:760px">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'About working with Maven internationally' })}
      <div class="accordion">
        ${(a.faqs || []).map((f, i) => accordionItem({
          id: `intl-faq-${i}`,
          headingHtml: esc(f.q),
          bodyHtml: `<p>${esc(f.a)}</p>`,
          open: false,
        })).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'International Bookkeeping & Reconciliation',
    title: 'Ready to hand off your bookkeeping?',
    subtitle: a.cta,
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about outsourcing our bookkeeping.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function virtualCfo() {
  const h = data.pageHeader('virtual-cfo');
  const v = data.virtualCfo || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/card-advisory.jpg')}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(v.intro)}</p>
      <div style="margin-top:24px">${button('Book a Free Initial Consultation', 'contact.html', 'primary')}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Virtual CFO Support Can Include', title: 'From monthly reports to scenario planning' })}
      <div class="accordion">
        ${(v.supportAreas || []).map(supportAreaAccordion).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'A Flexible Finance Model', title: 'Start at the level your business needs' })}
      <div class="grid grid-4">
        ${(v.levels || []).map((l) => `<div class="value-card reveal"><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></div>`).join('')}
      </div>
      <div class="info-note reveal" style="max-width:820px;margin:32px auto 0">${esc(v.levelsNote)}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:760px">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'Virtual CFO & Management Reporting FAQ' })}
      <div class="accordion">
        ${(v.faqs || []).map((f, i) => accordionItem({
          id: `cfo-faq-${i}`,
          headingHtml: esc(f.q),
          bodyHtml: `<p>${esc(f.a)}</p>`,
          open: false,
        })).join('')}
      </div>
      <p class="text-center tag-note" style="margin-top:24px">Looking for day-to-day bookkeeping instead? See <a href="${internalHref('international-accounting.html')}" style="color:var(--gold-700);font-weight:700">International Bookkeeping & Reconciliation</a>.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Virtual CFO & Management Reporting',
    title: 'Build the right finance support for your business',
    subtitle: v.cta,
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about Virtual CFO and management reporting support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function resourceTile(tile) {
  return `<article class="service-card reveal">
    <div class="service-card-head">
      <span class="service-icon">${icon(tile.icon)}</span>
      <h2>${esc(tile.title)}</h2>
    </div>
    <p>${esc(tile.text)}</p>
    <div style="margin-top:20px">${button(esc(tile.cta), tile.href, 'outline')}</div>
  </article>`;
}

function resources() {
  const h = data.pageHeader('resources');
  const hub = data.resourcesHub || {};
  const tiles = (hub.tiles || []).slice();
  if (data.isVisible('blog')) {
    tiles.push({
      title: 'Blog', text: 'Practical notes on accounting, tax, and compliance for businesses in Nepal.',
      cta: 'Read the Blog', href: 'blog.html', icon: 'send',
    });
  }

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:760px">
      <p class="reveal">${esc(hub.intro)}</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      <div class="grid grid-2 reveal-stagger">
        ${tiles.map(resourceTile).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Need Something Specific?',
    title: "Can't find what you're looking for?",
    subtitle: 'Send us a message and we will point you in the right direction.',
    buttons: [button('Contact Maven', 'contact.html', 'primary')],
  })}
  `;
}

module.exports = { nfrsIfrs, internationalAccounting, virtualCfo, resources };
