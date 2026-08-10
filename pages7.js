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
    open: i === 0,
  });
}

function nfrsIfrs() {
  const h = data.pageHeader('nfrs-ifrs');
  const n = data.nfrsIfrs || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(n.intro)}</p>
      <div style="margin-top:24px">${button('Book an Initial Consultation', 'contact.html', 'primary')}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Our Approach', title: n.introHeading })}
      <p class="reveal">${esc(n.introBody)}</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'How We Can Support You', title: 'Assessment, transition, and technical accounting support' })}
      <div class="accordion">
        ${(n.supportAreas || []).map(supportAreaAccordion).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Financial Statements', title: (n.statementPrep || {}).heading || 'More Than Preparing The Numbers' })}
      <p class="reveal">${esc((n.statementPrep || {}).intro)}</p>
      ${bulletList((n.statementPrep || {}).items || [], 'stamp-list stamp-list--pkg')}
      <div class="info-note reveal" style="margin-top:24px">${esc((n.statementPrep || {}).note)}</div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Accounting Policies & Documentation', title: 'Consistent practices, not just year-end adjustments' })}
      <p class="reveal">${esc((n.policies || {}).intro)}</p>
      ${bulletList((n.policies || {}).items || [], 'stamp-list stamp-list--pkg')}
      <div class="info-note reveal" style="margin-top:24px">${esc((n.policies || {}).note)}</div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Management Reporting', title: 'Connecting statutory reporting to decision-making' })}
      <p class="reveal">${esc((n.managementReporting || {}).intro)}</p>
      ${bulletList((n.managementReporting || {}).items || [], 'stamp-list stamp-list--pkg')}
      <div class="info-note reveal" style="margin-top:24px">${esc((n.managementReporting || {}).note)}</div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container" style="max-width:820px">
      ${sectionHead({ eyebrow: 'Audit Preparation', title: 'Coordination support for year-end audit' })}
      <p class="reveal">${esc((n.auditPrep || {}).intro)}</p>
      ${bulletList((n.auditPrep || {}).items || [], 'stamp-list stamp-list--pkg')}
      <div class="partner-note reveal" style="margin-top:24px">
        <h4>Defined Professional Boundaries</h4>
        <p>${esc((n.auditPrep || {}).note)}</p>
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Our Implementation Approach', title: 'From understanding your business to handover' })}
      <div class="process-list process-list--row">
        ${(n.process || []).map((p, i, arr) => processStep({ step: i + 1, title: p.title, text: p.text }, i === arr.length - 1)).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Typical Deliverables', title: 'What an engagement can produce', align: 'left' })}
        ${bulletList(n.deliverables || [], 'stamp-list stamp-list--pkg')}
        <p class="tag-note" style="margin-top:16px">${esc(n.deliverablesNote)}</p>
      </div>
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Who This Service Is For', title: 'Is this the right fit for your business?', align: 'left' })}
        ${bulletList(n.whoFor || [], 'stamp-list stamp-list--pkg')}
        <p class="tag-note" style="margin-top:16px">${esc(n.whoForNote)}</p>
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Why Work With Maven', title: 'Practical implementation, clearly communicated' })}
      <div class="grid grid-4">
        ${(n.whyChoose || []).map(whyCard).join('')}
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
          open: i === 0,
        })).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Improve Your Financial Reporting Before Year-End',
    title: 'Build a practical NFRS / IFRS implementation plan',
    subtitle: n.cta,
    buttons: [button('Book an NFRS / IFRS Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} Talk to Maven`, data.whatsappHref('Hello Maven, I would like to talk about NFRS / IFRS implementation support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function internationalAccounting() {
  const h = data.pageHeader('international-accounting');
  const a = data.internationalAccounting || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

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
      <div class="grid grid-4">
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
        <h4>Data Security &amp; Confidentiality</h4>
        <p>${esc(a.securityNote)}</p>
      </div>
      <div class="partner-note reveal" style="margin-top:24px">
        <h4>Clear Professional Scope</h4>
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
          open: i === 0,
        })).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'International Outsourced Accounting',
    title: 'Ready to hand off your bookkeeping?',
    subtitle: a.cta,
    buttons: [button('Book a Free Discovery Call', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about outsourcing our bookkeeping.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function virtualCfo() {
  const h = data.pageHeader('virtual-cfo');
  const v = data.virtualCfo || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(v.intro)}</p>
      <div style="margin-top:24px">${button('Book a Free Discovery Call', 'contact.html', 'primary')}</div>
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
          open: i === 0,
        })).join('')}
      </div>
      <p class="text-center tag-note" style="margin-top:24px">Looking for day-to-day bookkeeping instead? See <a href="${internalHref('international-accounting.html')}" style="color:var(--gold-700);font-weight:700">International Outsourced Accounting</a>.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Virtual CFO & Management Reporting',
    title: 'Build the right finance support for your business',
    subtitle: v.cta,
    buttons: [button('Book a Free Discovery Call', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about Virtual CFO and management reporting support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function resourceTile(tile) {
  return `<article class="service-card reveal">
    <div class="service-card-head">
      <span class="service-icon">${icon(tile.icon)}</span>
      <h3>${esc(tile.title)}</h3>
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
      <div class="grid grid-2">
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
