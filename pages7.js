const data = require('./data');
const { icon } = require('./icons');
const {
  button, sectionHead, pageHero, bulletList, whyCard, processStep, accordionItem, ctaBand,
} = require('./ui');
const { esc } = require('./escape');

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

module.exports = { nfrsIfrs };
