const data = require('./data');
const { icon, stampMark } = require('./icons');
const {
  button, eyebrow, eyebrowOnDark, sectionHead, pageHero, bulletList, processStep, accordionItem, ctaBand, panelLabel,
} = require('./ui');
const { esc, internalHref } = require('./escape');

function supportAreaAccordion(area, i) {
  const output = area.output && area.output.length
    ? `<p class="panel-label panel-label--caps" style="margin-top:18px;display:block">Typical Output</p>${bulletList(area.output, 'stamp-list stamp-list--pkg')}`
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
  const supportAreas = n.supportAreas || [];
  const technicalArea = supportAreas[2] || {};
  const boundaryEntry = (n.whyChoose || []).find((w) => w.title === 'Defined Professional Boundaries') || {};
  const boundaryNote = boundaryEntry.text || '';
  const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
  const relatedCategories = [byKey('reporting'), byKey('advisory'), byKey('bookkeeping')].filter(Boolean);

  const readinessFlow = [
    ['01', 'Assess', 'Current records, reporting framework, information gaps and significant reporting areas.'],
    ['02', 'Analyze', 'Accounting policies, recognition and measurement issues, supporting calculations and evidence.'],
    ['03', 'Adjust', 'Transition workings, reconciliations, accounting entries, schedules and documentation.'],
    ['04', 'Present', 'Financial statements, notes, disclosures, comparatives and cross-referenced support.'],
    ['05', 'Handover', 'Explain key adjustments, organize year-end files and improve the next reporting cycle.'],
  ];

  const fitGroups = [
    {
      number: '01',
      title: 'Growth or framework change',
      text: 'When reporting requirements are becoming more structured or the business is moving toward a different reporting framework.',
      items: (n.whoFor || []).slice(0, 3),
    },
    {
      number: '02',
      title: 'Stakeholder & group reporting',
      text: 'When lenders, investors, group reporting or more complex accounting and disclosures create additional reporting demands.',
      items: [(n.whoFor || [])[3], (n.whoFor || [])[4], (n.whoFor || [])[8]].filter(Boolean),
    },
    {
      number: '03',
      title: 'Year-end & finance-team capacity',
      text: 'When the accounting team needs extra implementation capacity, stronger year-end reporting or more organized audit support files.',
      items: [(n.whoFor || [])[5], (n.whoFor || [])[6], (n.whoFor || [])[7]].filter(Boolean),
    },
  ];

  const packageGroups = [
    { title: 'Readiness & planning', items: (n.deliverables || []).slice(0, 4) },
    { title: 'Adjustments & workings', items: (n.deliverables || []).slice(4, 8) },
    { title: 'Statements & documentation', items: (n.deliverables || []).slice(8, 12) },
    { title: 'Handover & year-end support', items: (n.deliverables || []).slice(12) },
  ];

  return `
  <section class="nfrs-hero">
    <div class="container nfrs-hero-grid">
      <div class="nfrs-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="nfrs-hero-sub">${esc(h.subtitle)}</p>
        <div class="nfrs-hero-actions">
          ${button('Discuss Reporting Readiness', 'contact.html', 'primary')}
          ${button('See the Implementation Path', '#implementation-path', 'ghost-light')}
        </div>
        <div class="nfrs-hero-assurances" aria-label="NFRS and IFRS engagement principles">
          <span>${stampMark('stamp-sm')}Structured implementation</span>
          <span>${stampMark('stamp-sm')}Traceable working papers</span>
          <span>${stampMark('stamp-sm')}Defined professional boundaries</span>
        </div>
      </div>

      <aside class="nfrs-hero-panel reveal" aria-label="Financial reporting readiness map">
        <div class="nfrs-hero-panel-head">
          ${panelLabel('Reporting Readiness Map')}
          <h2>Build a traceable route from accounting records to financial statements.</h2>
          <p>The work is organized around evidence, accounting analysis, adjustments, disclosures and a reporting package management can understand.</p>
        </div>
        <div class="nfrs-hero-panel-steps">
          ${[
            ['01', 'Readiness', 'Current records and reporting gaps'],
            ['02', 'Technical analysis', 'Policies, calculations and evidence'],
            ['03', 'Implementation', 'Adjustments, schedules and documentation'],
            ['04', 'Reporting', 'Statements, disclosures and handover'],
          ].map(([number, title, text]) => `<div class="nfrs-hero-panel-step">
            <span>${number}</span><div><strong>${esc(title)}</strong><small>${esc(text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="nfrs-hero-panel-foot">
          <span>${icon('ledger')}Financial reporting</span>
          <span>${icon('shield')}Audit coordination</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="nfrs-proof-strip" aria-label="NFRS and IFRS support areas">
    <div class="container nfrs-proof-grid reveal-stagger">
      <div class="nfrs-proof-item"><strong>Readiness assessment</strong><span>Understand gaps before implementation work begins.</span></div>
      <div class="nfrs-proof-item"><strong>Transition & adjustments</strong><span>Organize workings, reconciliations and accounting changes.</span></div>
      <div class="nfrs-proof-item"><strong>Financial statements</strong><span>Connect records, schedules, policies and disclosures.</span></div>
      <div class="nfrs-proof-item"><strong>Year-end coordination</strong><span>Prepare support files and organize audit queries.</span></div>
    </div>
  </section>

  <section class="section-pad nfrs-foundation-section">
    <div class="container nfrs-foundation-layout">
      <div class="nfrs-foundation-copy reveal">
        ${eyebrow('Implementation, Not Formatting')}
        <h2>Reporting standards affect the accounting process behind the statements.</h2>
        <p>${esc(n.intro)}</p>
        <p>${esc(n.introBody)}</p>
      </div>
      <div class="nfrs-reporting-chain reveal" aria-label="Financial reporting implementation chain">
        ${readinessFlow.map(([number, title, text], i) => `<div class="nfrs-chain-step">
          <span class="nfrs-chain-number">${number}</span>
          <div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>
          ${i < readinessFlow.length - 1 ? `<span class="nfrs-chain-arrow" aria-hidden="true">${icon('arrowRight')}</span>` : ''}
        </div>`).join('')}
        <p class="nfrs-framework-note">${esc(n.whoForNote || '')}</p>
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-fit-section bg-mist">
    <div class="container">
      ${sectionHead({
        eyebrow: 'When This Support Becomes Useful',
        title: 'Add technical reporting capacity when complexity starts to outgrow the normal close.',
        subtitle: 'The reporting framework that applies to a particular entity should be assessed for that engagement. These are common situations in which structured implementation or reporting support may become useful.',
      })}
      <div class="nfrs-fit-grid reveal-stagger">
        ${fitGroups.map((group) => `<article class="nfrs-fit-card">
          <div class="nfrs-fit-card-head"><span>${group.number}</span><h3>${esc(group.title)}</h3></div>
          <p>${esc(group.text)}</p>
          ${bulletList(group.items, 'stamp-list stamp-list--pkg')}
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-core-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Core Implementation Work',
        title: 'Three layers take the work from readiness through technical reporting.',
        subtitle: 'The exact scope depends on the entity, available records and applicable reporting requirements. The detailed scope remains available further below.',
      })}
      <div class="nfrs-core-grid reveal-stagger">
        ${supportAreas.map((area, i) => `<article class="nfrs-core-card">
          <div class="nfrs-core-card-top"><span>0${i + 1}</span><span class="nfrs-core-icon">${icon(i === 0 ? 'compass' : i === 1 ? 'link2' : 'ledger')}</span></div>
          <h3>${esc(area.title)}</h3>
          <p>${esc(area.intro || '')}</p>
          <div class="nfrs-core-focus">
            <span>Typical focus</span>
            ${(area.items || []).slice(0, 3).map((item) => `<small>${esc(item)}</small>`).join('')}
          </div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-technical-section">
    <div class="container nfrs-technical-layout">
      <div class="nfrs-technical-copy reveal">
        ${eyebrowOnDark('Technical Accounting Areas')}
        <h2>Some transactions need deeper analysis before they reach the financial statements.</h2>
        <p>${esc(technicalArea.intro || '')}</p>
        <div class="nfrs-technical-note">${esc(technicalArea.note || '')}</div>
      </div>
      <div class="nfrs-topic-grid reveal-stagger" aria-label="Technical accounting focus areas">
        ${(technicalArea.items || []).map((item, i) => `<span><small>${String(i + 1).padStart(2, '0')}</small>${esc(item)}</span>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-process-section" id="implementation-path">
    <div class="container">
      ${sectionHead({
        eyebrow: 'The Implementation Path',
        title: 'Move from understanding the current position to a documented reporting handover.',
        subtitle: 'A staged process keeps information requests, technical issues, accounting adjustments and final reporting connected rather than treating year-end as one large correction exercise.',
      })}
      <div class="nfrs-process-grid reveal-stagger">
        ${(n.process || []).map((p, i) => `<article class="nfrs-process-step">
          <span class="nfrs-process-number">${String(i + 1).padStart(2, '0')}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-package-section bg-mist">
    <div class="container nfrs-package-layout">
      <div class="nfrs-package-intro reveal">
        ${eyebrow('A Traceable Reporting Package')}
        <h2>Leave behind more than a set of year-end numbers.</h2>
        <p>Good implementation creates a clear trail between the accounting records, calculations, adjustments, policies, financial statements and the support files used to explain them.</p>
        <p class="nfrs-package-note">${esc(n.deliverablesNote || '')}</p>
      </div>
      <div class="nfrs-package-groups reveal-stagger">
        ${packageGroups.map((group, i) => `<article class="nfrs-package-card">
          <div class="nfrs-package-card-head"><span>0${i + 1}</span><h3>${esc(group.title)}</h3></div>
          ${bulletList(group.items, 'stamp-list stamp-list--pkg')}
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-boundary-section">
    <div class="container nfrs-boundary-layout">
      <div class="nfrs-boundary-icon reveal">${icon('shield')}</div>
      <div class="nfrs-boundary-copy reveal">
        ${eyebrow('Defined Professional Boundaries')}
        <h2>Technical accounting support should make responsibilities clearer, not blur them.</h2>
        <p>${esc(boundaryNote)}</p>
        <div class="nfrs-boundary-note"><strong>Audit and specialist services.</strong> ${esc((n.auditPrep || {}).note || '')}</div>
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-scope-section bg-mist">
    <div class="container nfrs-scope-layout">
      <div class="nfrs-scope-intro reveal">
        ${eyebrow('Full Technical Scope')}
        <h2>Open the areas that matter to your reporting situation.</h2>
        <p>Use the detailed sections to review readiness, transition work, technical accounting, statement preparation, policies, management reporting and year-end coordination.</p>
      </div>
      <div class="nfrs-scope-accordion accordion">
        ${supportAreas.map(supportAreaAccordion).join('')}
        ${technicalDetailAccordion({ id: 'nfrs-statement-prep', title: (n.statementPrep || {}).heading || 'Financial Statement Preparation', intro: (n.statementPrep || {}).intro, items: (n.statementPrep || {}).items, note: (n.statementPrep || {}).note })}
        ${technicalDetailAccordion({ id: 'nfrs-policies', title: 'Accounting Policies & Documentation', intro: (n.policies || {}).intro, items: (n.policies || {}).items, note: (n.policies || {}).note })}
        ${technicalDetailAccordion({ id: 'nfrs-mgmt-reporting', title: 'Management Reporting Connection', intro: (n.managementReporting || {}).intro, items: (n.managementReporting || {}).items, note: (n.managementReporting || {}).note })}
        ${auditPrepAccordion(n.auditPrep || {})}
        ${technicalDetailAccordion({ id: 'nfrs-why-choose', title: 'Why Work With Maven', intro: null, items: (n.whyChoose || []).map((w) => `${w.title}: ${w.text}`), note: null })}
      </div>
    </div>
  </section>

  <section class="section-pad nfrs-faq-section">
    <div class="container" style="max-width:800px">
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

  <section class="section-pad nfrs-related-section bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'Related Finance Support', title: 'Strengthen the accounting process around the reporting work.' })}
      <div class="grid grid-3 reveal-stagger">
        ${relatedCategories.map(relatedServiceCard).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'NFRS / IFRS Implementation & Financial Reporting',
    title: 'Build a practical reporting plan before year-end pressure takes over.',
    subtitle: n.cta,
    buttons: [button('Book an NFRS / IFRS Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about NFRS / IFRS implementation support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function internationalAccounting() {
  const h = data.pageHeader('international-accounting');
  const a = data.internationalAccounting || {};
  const services = a.services || [];
  const keep = (labels) => labels.filter((label) => services.includes(label));
  const scopeGroups = [
    {
      number: '01',
      iconName: 'ledger',
      title: 'Keep the books current',
      text: 'Recurring transaction and reconciliation work that keeps the accounting file usable throughout the month.',
      items: keep([
        'Bookkeeping and transaction categorization',
        'Bank reconciliation',
        'Credit card reconciliation',
        'Cleanup and catch-up bookkeeping',
        'Accounting file organization',
      ]),
    },
    {
      number: '02',
      iconName: 'link2',
      title: 'Support the operating cycle',
      text: 'Defined finance-admin tasks that support collections, payments, payroll inputs and the schedules behind them.',
      items: keep([
        'Accounts payable support',
        'Accounts receivable support',
        'Payroll data processing support',
        'Supporting schedules and reconciliations',
      ]),
    },
    {
      number: '03',
      iconName: 'barChart',
      title: 'Close and report the period',
      text: 'Month-end support that turns maintained records into practical schedules and recurring reporting outputs.',
      items: keep([
        'Month-end accounting support',
        'Monthly financial reporting and MIS',
        'Excel and spreadsheet reporting',
        'Overflow capacity for accounting firms during busy periods',
      ]),
    },
  ];

  const monthlyCycle = [
    {
      title: 'Client accounting system',
      text: 'The cycle starts from the agreed source system, records and documents rather than a separate shadow process.',
    },
    {
      title: 'Bookkeeping & reconciliation',
      text: 'Transactions, bank activity, cards and supporting schedules are processed within the agreed scope.',
    },
    {
      title: 'Internal review',
      text: 'Completed work moves through the agreed review point before the period is treated as ready for reporting.',
    },
    {
      title: 'Queries & exceptions',
      text: 'Missing information, unusual items and open questions are surfaced so they remain visible instead of being buried.',
    },
    {
      title: 'Reporting outputs',
      text: 'Agreed schedules, MIS or monthly reports are prepared from the maintained accounting information.',
    },
    {
      title: 'Client review',
      text: 'Your team keeps visibility over what was completed, what remains open and what should happen next.',
    },
  ];

  const onboarding = [
    {
      title: 'Understand the current setup',
      text: 'We review the existing team, software, transaction volume, reporting needs and the specific work creating pressure.',
    },
    {
      title: 'Define responsibilities and outputs',
      text: 'The starting scope, access requirements, recurring outputs and review responsibilities are agreed before work begins.',
    },
    {
      title: 'Connect to the working environment',
      text: 'Where practical, Maven works inside the systems, cloud tools and task workflow already used by your team.',
    },
    {
      title: 'Run the first accounting cycle',
      text: 'The initial period gives both teams a real workflow to test communication, exceptions, deadlines and review handoffs.',
    },
    {
      title: 'Stabilize, then expand if useful',
      text: 'Once the recurring process is working reliably, the scope can grow into more accounting activities or management reporting.',
    },
  ];

  const firmItems = ((a.firmSupport || {}).items || []).slice(0, 7);
  const toolItems = ((a.tools || {}).items || []).slice(0, 6);
  const startItems = ((a.startSmall || {}).items || []).slice(0, 6);

  return `
  <section class="intl-accounting-hero">
    <div class="container intl-accounting-hero-grid">
      <div class="intl-accounting-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="intl-accounting-hero-sub">${esc(h.subtitle)}</p>
        <div class="intl-accounting-hero-actions">
          ${button('Discuss Your Monthly Scope', 'contact.html', 'primary')}
          ${button('View the Delivery Workflow', '#monthly-cycle', 'ghost-light')}
        </div>
        <div class="intl-accounting-hero-assurances" aria-label="Remote accounting principles">
          <span>${stampMark('stamp-sm')}Kathmandu-based delivery</span>
          <span>${stampMark('stamp-sm')}Defined recurring scope</span>
          <span>${stampMark('stamp-sm')}Work in existing systems where practical</span>
        </div>
      </div>

      <aside class="intl-accounting-cycle-card reveal" aria-label="Recurring accounting cycle overview">
        <div class="intl-accounting-cycle-head">
          ${panelLabel('Recurring Accounting Cycle')}
          <h2>From source records to a reviewed monthly output.</h2>
          <p>A visible operating rhythm for the work you choose to hand off.</p>
        </div>
        <div class="intl-accounting-cycle-steps">
          ${[
            ['01', 'Receive & organize', 'Records, source data and agreed inputs'],
            ['02', 'Process & reconcile', 'Bookkeeping, banks, cards and schedules'],
            ['03', 'Review & query', 'Exceptions, missing items and open questions'],
            ['04', 'Report & hand back', 'Agreed outputs for client review'],
          ].map(([number, title, text]) => `<div class="intl-accounting-cycle-step">
            <span>${number}</span><div><strong>${esc(title)}</strong><small>${esc(text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="intl-accounting-cycle-foot">
          <span>${icon('clock')}Across time zones</span>
          <span>${icon('users')}Direct communication</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="intl-accounting-proof-strip" aria-label="Remote accounting engagement principles">
    <div class="container intl-accounting-proof-grid reveal-stagger">
      <div class="intl-accounting-proof-item"><strong>Recurring finance work</strong><span>Bookkeeping, reconciliations, schedules and month-end support.</span></div>
      <div class="intl-accounting-proof-item"><strong>Visible review points</strong><span>Questions and exceptions stay part of the workflow.</span></div>
      <div class="intl-accounting-proof-item"><strong>Existing tools</strong><span>Work within your current environment where practical.</span></div>
      <div class="intl-accounting-proof-item"><strong>Businesses & firms</strong><span>Direct client support or defined back-office capacity.</span></div>
    </div>
  </section>

  <section class="section-pad intl-accounting-scope-section">
    <div class="container intl-accounting-scope-layout">
      <div class="intl-accounting-scope-intro reveal">
        ${eyebrow('What You Can Hand Off')}
        <h2>Move recurring accounting work without losing visibility.</h2>
        <p>${esc(a.intro)}</p>
        <div class="intl-accounting-scope-note">${esc(a.scopeNote)}</div>
      </div>
      <div class="intl-accounting-scope-groups reveal-stagger">
        ${scopeGroups.map((group) => `<article class="intl-accounting-scope-group">
          <div class="intl-accounting-scope-group-head">
            <span class="intl-accounting-scope-number">${group.number}</span>
            <span class="intl-accounting-scope-icon">${icon(group.iconName)}</span>
            <div><h3>${esc(group.title)}</h3><p>${esc(group.text)}</p></div>
          </div>
          <ul>
            ${group.items.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
          </ul>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-cycle-section" id="monthly-cycle">
    <div class="container">
      <div class="intl-accounting-cycle-title reveal">
        ${eyebrowOnDark('The Monthly Delivery Rhythm')}
        <h2>A repeatable accounting cycle, not a black box.</h2>
        <p>Remote delivery works best when each handoff is visible. The work cycle below separates processing, review, exceptions and client review so everyone knows where the period stands.</p>
      </div>
      <div class="intl-accounting-monthly-grid reveal-stagger">
        ${monthlyCycle.map((step, i) => `<article class="intl-accounting-monthly-step">
          <span class="intl-accounting-monthly-number">0${i + 1}</span>
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.text)}</p>
        </article>`).join('')}
      </div>
      <div class="intl-accounting-monthly-note reveal">
        <span>${icon('shield')}</span>
        <p>Scope, review responsibility and timing are agreed for each engagement. The objective is dependable finance capacity with clear ownership — not removing the client from its own accounting process.</p>
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-onboarding-section">
    <div class="container intl-accounting-onboarding-layout">
      <div class="intl-accounting-onboarding-intro reveal">
        ${eyebrow('How the Relationship Starts')}
        <h2>Define the operating model before recurring work begins.</h2>
        <p>A good outsourced accounting relationship starts with scope clarity, access discipline and a first cycle that both teams can evaluate.</p>
        <div class="intl-accounting-onboarding-actions">
          ${button('Discuss Your Current Workflow', 'contact.html', 'outline')}
        </div>
      </div>
      <div class="intl-accounting-onboarding-list reveal-stagger">
        ${onboarding.map((step, i) => `<article class="intl-accounting-onboarding-step">
          <span>0${i + 1}</span>
          <div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-audience-section bg-mist">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Built for Two International Use Cases',
        title: 'Add finance capacity without rebuilding the whole function.',
        subtitle: 'Maven can support an international business directly or operate within a defined back-office scope for an accounting or bookkeeping firm.',
      })}
      <div class="intl-accounting-audience-grid">
        <article class="intl-accounting-audience-card reveal">
          <div class="intl-accounting-audience-head">
            <span class="intl-accounting-audience-icon">${icon('building')}</span>
            <div>${panelLabel('International Businesses')}<h3>Extend your finance team remotely.</h3></div>
          </div>
          <p>Useful when recurring bookkeeping and month-end work is consuming internal time, but you still want the accounting process to remain inside your existing systems and review structure.</p>
          <ul>
            ${[
              'Recurring bookkeeping and reconciliations',
              'Accounts payable / receivable support',
              'Month-end schedules and reporting support',
              'Cleanup or backlog processing',
            ].map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
          </ul>
        </article>

        <article class="intl-accounting-audience-card intl-accounting-audience-card--firm reveal">
          <div class="intl-accounting-audience-head">
            <span class="intl-accounting-audience-icon">${icon('briefcase')}</span>
            <div>${panelLabel('Accounting & Bookkeeping Firms')}<h3>Add controlled back-office capacity.</h3></div>
          </div>
          <p>${esc((a.firmSupport || {}).intro || '')}</p>
          <ul>
            ${firmItems.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
          </ul>
          <p class="intl-accounting-audience-note">${esc((a.firmSupport || {}).note || '')}</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-controls-section">
    <div class="container intl-accounting-controls-layout">
      <div class="intl-accounting-controls-copy reveal">
        ${eyebrow('Systems, Access & Confidentiality')}
        <h2>Finance outsourcing needs operating controls, not just task capacity.</h2>
        <p>${esc((a.tools || {}).intro || '')}</p>
        <div class="intl-accounting-tool-row" aria-label="Common accounting and reporting tools">
          ${toolItems.map((tool) => `<span>${esc(tool)}</span>`).join('')}
        </div>
        <p class="intl-accounting-tools-note">${esc((a.tools || {}).note || '')}</p>
      </div>
      <div class="intl-accounting-controls-stack reveal-stagger">
        <article class="intl-accounting-control-card">
          <span class="intl-accounting-control-icon">${icon('shield')}</span>
          <div><h3>Confidential information handling</h3><p>${esc(a.securityNote)}</p></div>
        </article>
        <article class="intl-accounting-control-card intl-accounting-control-card--boundary">
          <span class="intl-accounting-control-icon">${icon('briefcase')}</span>
          <div><h3>Clear professional responsibility</h3><p>${esc(a.scopeBoundary)}</p></div>
        </article>
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-start-section bg-mist">
    <div class="container intl-accounting-start-layout">
      <div class="intl-accounting-start-copy reveal">
        ${eyebrow('Start With a Defined Scope')}
        <h2>Prove the workflow before you expand it.</h2>
        <p>${esc((a.startSmall || {}).intro || '')}</p>
        <p class="intl-accounting-start-note">${esc((a.startSmall || {}).note || '')}</p>
        <div class="intl-accounting-start-actions">
          ${button('Book a Free Discovery Call', 'contact.html', 'primary')}
          ${button('View International Delivery Model', 'global-outsourcing.html', 'outline')}
        </div>
      </div>
      <div class="intl-accounting-start-panel reveal">
        ${panelLabel('Good first engagement examples')}
        <div class="intl-accounting-start-items">
          ${startItems.map((item, i) => `<div><span>0${i + 1}</span><strong>${esc(item)}</strong></div>`).join('')}
        </div>
        <a class="intl-accounting-next-layer" href="${internalHref('virtual-cfo.html')}">
          <span><small>When the accounting foundation is ready</small><strong>Move into Virtual CFO &amp; Management Reporting</strong></span>
          ${icon('arrowRight')}
        </a>
      </div>
    </div>
  </section>

  <section class="section-pad intl-accounting-faq-section">
    <div class="container" style="max-width:780px">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'Working with Maven internationally' })}
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
    eyebrow: 'Remote Accounting Support',
    title: 'Ready to create dependable monthly finance capacity?',
    subtitle: 'Start with the recurring work that is consuming time today. We can define the scope, workflow, access and review responsibilities before the first cycle begins.',
    buttons: [button('Book a Free Discovery Call', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to discuss remote accounting support for our business or accounting firm.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function virtualCfo() {
  const h = data.pageHeader('virtual-cfo');
  const v = data.virtualCfo || {};
  const supportAreas = v.supportAreas || [];
  const levels = v.levels || [];

  const financeCycle = [
    {
      title: 'Close & validate',
      text: 'Start from reliable period accounting, reconciliations and the schedules needed to explain the numbers.',
    },
    {
      title: 'Report & explain',
      text: 'Bring performance, balance-sheet movements, cash and selected KPIs into a management-ready view.',
    },
    {
      title: 'Forecast & test',
      text: 'Update cash expectations, budgets and scenarios as actual results and business assumptions change.',
    },
    {
      title: 'Discuss & refine',
      text: 'Use the reporting cycle to surface questions, clarify drivers and improve the next planning round.',
    },
  ];

  const managementPack = [
    {
      iconName: 'barChart',
      title: 'Performance view',
      text: 'Profit and loss, balance-sheet movements, revenue and expense trends, and selected operating KPIs.',
    },
    {
      iconName: 'trendUp',
      title: 'Budget & variance',
      text: 'Actual performance compared with plan, material variances, updated assumptions and rolling forecasts.',
    },
    {
      iconName: 'ledger',
      title: 'Cash & working capital',
      text: 'Cash position, receivables, payables, collection trends and upcoming payment requirements.',
    },
    {
      iconName: 'compass',
      title: 'Forward view',
      text: 'Cash-flow forecasts and scenario analysis that help management understand possible financial effects before acting.',
    },
  ];

  const fitSignals = [
    'The books are maintained, but management still lacks a clear monthly financial picture.',
    'Cash, receivables or upcoming commitments need more structured forward visibility.',
    'Budgets exist, but actual-versus-plan review is inconsistent or too slow.',
    'The business needs finance input for growth decisions without adding a full-time senior finance role immediately.',
  ];

  return `
  <section class="vcfo-hero">
    <div class="container vcfo-hero-grid">
      <div class="vcfo-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="vcfo-hero-sub">${esc(h.subtitle)}</p>
        <div class="vcfo-hero-actions">
          ${button('Discuss Your Reporting Needs', 'contact.html', 'primary')}
          ${button('See the Management Cycle', '#management-cycle', 'ghost-light')}
        </div>
        <div class="vcfo-hero-assurances" aria-label="Virtual CFO engagement principles">
          <span>${stampMark('stamp-sm')}Built on reliable accounting</span>
          <span>${stampMark('stamp-sm')}Management-focused reporting</span>
          <span>${stampMark('stamp-sm')}Decisions remain with management</span>
        </div>
      </div>

      <aside class="vcfo-hero-panel reveal" aria-label="Management finance cycle overview">
        <div class="vcfo-hero-panel-head">
          ${panelLabel('Management Finance Cycle')}
          <h2>Turn the monthly close into a forward-looking conversation.</h2>
          <p>Reporting becomes more useful when actual results, cash, forecasts and management questions connect in one recurring rhythm.</p>
        </div>
        <div class="vcfo-hero-panel-steps">
          ${[
            ['01', 'Close', 'Reliable accounting and schedules'],
            ['02', 'Explain', 'Performance, cash and key movements'],
            ['03', 'Forecast', 'Budget, runway and changing assumptions'],
            ['04', 'Discuss', 'Questions, scenarios and next actions'],
          ].map(([number, title, text]) => `<div class="vcfo-hero-panel-step">
            <span>${number}</span><div><strong>${esc(title)}</strong><small>${esc(text)}</small></div>
          </div>`).join('')}
        </div>
        <div class="vcfo-hero-panel-foot">
          <span>${icon('barChart')}Monthly reporting</span>
          <span>${icon('compass')}Forward planning</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="vcfo-proof-strip" aria-label="Virtual CFO focus areas">
    <div class="container vcfo-proof-grid reveal-stagger">
      <div class="vcfo-proof-item"><strong>Management reporting</strong><span>Structured monthly financial visibility.</span></div>
      <div class="vcfo-proof-item"><strong>Cash-flow visibility</strong><span>Expected receipts, payments and pressure points.</span></div>
      <div class="vcfo-proof-item"><strong>Forecast discipline</strong><span>Budgets, rolling forecasts and variance review.</span></div>
      <div class="vcfo-proof-item"><strong>Decision support</strong><span>Scenario analysis for management's own decisions.</span></div>
    </div>
  </section>

  <section class="section-pad vcfo-ladder-section">
    <div class="container vcfo-ladder-layout">
      <div class="vcfo-ladder-intro reveal">
        ${eyebrow('From Accounting to Finance Insight')}
        <h2>Move up the finance stack only when the business needs it.</h2>
        <p>${esc(v.intro)}</p>
        <div class="vcfo-ladder-note">${esc(v.levelsNote || '')}</div>
      </div>
      <div class="vcfo-ladder-list reveal-stagger">
        ${levels.map((level, i) => `<article class="vcfo-ladder-step${i === levels.length - 1 ? ' vcfo-ladder-step--senior' : ''}">
          <span class="vcfo-ladder-number">0${i + 1}</span>
          <div><h3>${esc(level.title.replace(/^Level\s+\d+\s+—\s+/, ''))}</h3><p>${esc(level.text)}</p></div>
          <span class="vcfo-ladder-marker" aria-hidden="true"></span>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad vcfo-pack-section bg-mist">
    <div class="container">
      ${sectionHead({
        eyebrow: 'Management Information That Connects',
        title: 'A reporting pack should help explain the business, not just display numbers.',
        subtitle: 'The exact format depends on the business. The aim is a focused set of information management can actually review, question and use.',
      })}
      <div class="vcfo-pack-grid reveal-stagger">
        ${managementPack.map((item, i) => `<article class="vcfo-pack-card">
          <div class="vcfo-pack-card-top"><span>0${i + 1}</span><span class="vcfo-pack-icon">${icon(item.iconName)}</span></div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
        </article>`).join('')}
      </div>
      <p class="vcfo-pack-note reveal">Reporting is customized around useful management information rather than adding dashboards or metrics that do not support a real management question.</p>
    </div>
  </section>

  <section class="section-pad vcfo-cycle-section" id="management-cycle">
    <div class="container">
      <div class="vcfo-cycle-head reveal">
        ${eyebrowOnDark('The Management Cycle')}
        <h2>Review actuals, look forward, then update the assumptions.</h2>
        <p>A Virtual CFO engagement works best as a recurring management rhythm. The objective is not a one-off report; it is a repeatable process for understanding performance and improving financial visibility over time.</p>
      </div>
      <div class="vcfo-cycle-grid reveal-stagger">
        ${financeCycle.map((step, i) => `<article class="vcfo-cycle-step">
          <span class="vcfo-cycle-number">0${i + 1}</span>
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.text)}</p>
        </article>`).join('')}
      </div>
      <div class="vcfo-cycle-boundary reveal">
        <span>${icon('shield')}</span>
        <p>Management remains responsible for business decisions. Maven organizes agreed financial information, prepares analysis and supports financial-management discussions; it does not provide investment advice or make decisions on behalf of the business.</p>
      </div>
    </div>
  </section>

  <section class="section-pad vcfo-scope-section">
    <div class="container vcfo-scope-layout">
      <div class="vcfo-scope-intro reveal">
        ${eyebrow('Detailed Finance Support')}
        <h2>Choose the reporting and planning depth that creates value.</h2>
        <p>The detailed scope can be built around the decisions and visibility gaps that matter to management. Each area below can be included independently or combined into a recurring finance-management engagement.</p>
        <div class="vcfo-scope-link">Already need recurring bookkeeping and reconciliations first? <a href="${internalHref('international-accounting.html')}">Start with Remote Accounting Support</a>.</div>
      </div>
      <div class="vcfo-scope-accordion accordion">
        ${supportAreas.map((area, i) => {
          const note = area.note ? `<p class="tag-note" style="margin-top:14px">${esc(area.note)}</p>` : '';
          return accordionItem({
            id: `vcfo-area-${i}`,
            headingHtml: esc(area.title),
            bodyHtml: `<p>${esc(area.intro || '')}</p>${bulletList(area.items || [], 'stamp-list stamp-list--pkg')}${note}`,
            open: false,
          });
        }).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad vcfo-fit-section bg-mist">
    <div class="container vcfo-fit-layout">
      <div class="vcfo-fit-copy reveal">
        ${eyebrow('When This Layer Becomes Useful')}
        <h2>You may not need a full-time CFO to need better financial management.</h2>
        <p>This service can support growing businesses in Nepal and international teams when reliable bookkeeping already exists but management needs a clearer view of performance, cash and the financial effect of future plans.</p>
      </div>
      <div class="vcfo-fit-panel reveal">
        ${panelLabel('Common signals')}
        <ul>
          ${fitSignals.map((item) => `<li>${stampMark('stamp-sm')}<span>${esc(item)}</span></li>`).join('')}
        </ul>
        <a class="vcfo-fit-next" href="${internalHref('contact.html')}">
          <span><small>Not sure where your finance function sits?</small><strong>Talk through the current reporting process</strong></span>
          ${icon('arrowRight')}
        </a>
      </div>
    </div>
  </section>

  <section class="section-pad vcfo-faq-section">
    <div class="container" style="max-width:800px">
      ${sectionHead({ eyebrow: 'Common Questions', title: 'Virtual CFO & Management Reporting FAQ' })}
      <div class="accordion">
        ${(v.faqs || []).map((f, i) => accordionItem({
          id: `cfo-faq-${i}`,
          headingHtml: esc(f.q),
          bodyHtml: `<p>${esc(f.a)}</p>`,
          open: false,
        })).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Virtual CFO & Management Reporting',
    title: 'Build a management reporting rhythm around the decisions that matter.',
    subtitle: 'Start with the reporting, cash-flow or planning gap that is most useful today. The engagement can expand only when additional finance support creates value.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about Virtual CFO and management reporting support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function resourceMeta(tile, index) {
  const profiles = [
    {
      number: '01',
      label: 'Prepare',
      bestFor: 'Registration, onboarding, monthly accounting and compliance preparation',
      note: 'Use the checklist to organize information before a filing, setup task or finance handover.',
    },
    {
      number: '02',
      label: 'Calculate',
      bestFor: 'Indicative salary tax, VAT, TDS and loan EMI calculations',
      note: 'Use the tools to test an estimate, then confirm the treatment and current rules that apply to your situation.',
    },
    {
      number: '03',
      label: 'Verify',
      bestFor: 'Official Nepal portals and institutional reference points',
      note: 'Go directly to the relevant authority or institution when a source, filing portal or official notice matters.',
    },
    {
      number: '04',
      label: 'Understand',
      bestFor: 'Maven scope, process, pricing approach, coverage and confidentiality',
      note: 'Use the FAQ to understand how an engagement works before you start a conversation.',
    },
  ];
  return profiles[index] || {
    number: String(index + 1).padStart(2, '0'),
    label: 'Learn',
    bestFor: 'Practical finance and compliance context',
    note: 'Use this resource as a starting point, then verify the facts that apply to your business.',
  };
}

function resourceLibraryCard(tile, index) {
  const meta = resourceMeta(tile, index);
  return `<article class="resources-library-card reveal">
    <div class="resources-library-card-top">
      <span class="resources-library-index">${esc(meta.number)}</span>
      <span class="resources-library-icon">${icon(tile.icon)}</span>
    </div>
    <span class="resources-library-label">${esc(meta.label)}</span>
    <h3>${esc(tile.title)}</h3>
    <p>${esc(tile.text)}</p>
    <div class="resources-library-best">
      <span>Best for</span>
      <strong>${esc(meta.bestFor)}</strong>
    </div>
    <p class="resources-library-note">${esc(meta.note)}</p>
    <a class="resources-library-link" href="${internalHref(tile.href)}" aria-label="${esc(tile.cta + ': ' + tile.title)}">
      <span>${esc(tile.cta)}</span>${icon('arrowRight')}
    </a>
  </article>`;
}

function resources() {
  const h = data.pageHeader('resources');
  const hub = data.resourcesHub || {};
  const tiles = (hub.tiles || []).slice();
  if (data.isVisible('blog')) {
    tiles.push({
      title: 'Knowledge Notes', text: 'Practical notes on accounting, tax, reporting and compliance for businesses in Nepal.',
      cta: 'Read Knowledge Notes', href: 'blog.html', icon: 'send',
    });
  }

  const heroTiles = tiles.slice(0, 4);
  const workflow = [
    ['01', 'Prepare', 'Organize the documents, records and questions that matter before a task begins.'],
    ['02', 'Calculate', 'Use an indicative tool to understand the size or direction of a number before acting on it.'],
    ['03', 'Verify', 'Check the relevant official portal, current rule or professional interpretation when accuracy depends on context.'],
    ['04', 'Discuss', 'Bring entity-specific, judgement-heavy or higher-risk questions into a proper advisory conversation.'],
  ];

  return `
  <section class="resources-premium-hero">
    <div class="container resources-hero-grid">
      <div class="resources-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="resources-hero-sub">${esc(h.subtitle)}</p>
        <div class="resources-hero-actions">
          ${button('Explore the Resource Library', '#resource-library', 'primary')}
          ${button('Ask Maven', 'contact.html', 'ghost-light')}
        </div>
        <div class="resources-hero-assurances" aria-label="Resource hub principles">
          <span>${stampMark('stamp-sm')}Practical preparation</span>
          <span>${stampMark('stamp-sm')}Indicative tools</span>
          <span>${stampMark('stamp-sm')}Official sources where available</span>
        </div>
      </div>

      <aside class="resources-hero-panel reveal" aria-label="Resource desk">
        <div class="resources-hero-panel-head">
          ${panelLabel('Resource Desk')}
          <h2>Start with the kind of question you have.</h2>
          <p>Each resource has a different job. Use the hub to prepare, estimate, verify or understand before moving into entity-specific advice.</p>
        </div>
        <div class="resources-hero-panel-list">
          ${heroTiles.map((tile, i) => {
            const meta = resourceMeta(tile, i);
            return `<a class="resources-hero-row" href="${internalHref(tile.href)}">
              <span class="resources-hero-row-index">${esc(meta.number)}</span>
              <span class="resources-hero-row-icon">${icon(tile.icon)}</span>
              <span class="resources-hero-row-copy"><strong>${esc(meta.label)}</strong><small>${esc(tile.title)}</small></span>
              ${icon('arrowRight')}
            </a>`;
          }).join('')}
        </div>
        <div class="resources-hero-panel-foot">
          ${icon('shield')}<span>General resources support preparation and planning; they do not replace engagement-specific professional advice.</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad resources-library-section" id="resource-library">
    <div class="container">
      <div class="resources-library-intro">
        <div class="reveal">
          ${eyebrow('Knowledge Library')}
          <h2>Use the right resource for the question.</h2>
        </div>
        <p class="reveal">${esc(hub.intro)}</p>
      </div>
      <div class="resources-library-grid reveal-stagger">
        ${tiles.map(resourceLibraryCard).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad resources-workflow-section">
    <div class="container">
      <div class="resources-workflow-intro reveal">
        ${eyebrowOnDark('How to Use the Hub')}
        <h2>A resource is most useful when you know what it can — and cannot — answer.</h2>
        <p>For finance, tax and compliance work, the safest workflow is to prepare the facts, test the numbers, verify the source and then apply professional judgement where the situation requires it.</p>
      </div>
      <div class="resources-workflow-grid reveal-stagger">
        ${workflow.map(([number, title, text]) => `<article class="resources-workflow-step">
          <div class="resources-workflow-step-top"><span>${esc(number)}</span>${stampMark('stamp-sm')}</div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad resources-boundary-section">
    <div class="container resources-boundary-grid">
      <div class="resources-boundary-copy reveal">
        ${eyebrow('General Information vs Professional Judgement')}
        <h2>Know when a resource is enough — and when context matters.</h2>
        <p>Checklists, calculators and official links can make a finance task easier to prepare. They cannot determine every entity-specific tax treatment, reporting judgement, filing obligation or cross-border issue.</p>
        <div class="resources-boundary-actions">
          ${button('Discuss Your Situation', 'contact.html', 'primary')}
          ${button('View Our Services', 'services.html', 'outline')}
        </div>
      </div>
      <div class="resources-boundary-panels reveal">
        <article class="resources-boundary-panel">
          <span class="resources-boundary-panel-icon">${icon('check')}</span>
          <div>
            <span class="panel-label panel-label--caps">Use the hub for</span>
            <ul>
              <li>Preparing common documents and records</li>
              <li>Testing indicative calculations</li>
              <li>Finding official portals and reference links</li>
              <li>Understanding Maven's service process and scope</li>
            </ul>
          </div>
        </article>
        <article class="resources-boundary-panel resources-boundary-panel--accent">
          <span class="resources-boundary-panel-icon">${icon('compass')}</span>
          <div>
            <span class="panel-label panel-label--caps">Talk to Maven when</span>
            <ul>
              <li>A rule must be applied to your specific entity or transaction</li>
              <li>A current deadline, rate or filing obligation needs confirmation</li>
              <li>NFRS / IFRS judgement or reporting treatment is involved</li>
              <li>The issue crosses tax, accounting, payroll or international boundaries</li>
            </ul>
          </div>
        </article>
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Need More Than a Reference?',
    title: 'Bring the facts. We can help you work through the context.',
    subtitle: 'Start with the resource that helps you prepare, then speak with Maven when the next step depends on your business, records or reporting requirements.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')],
  })}
  `;
}

module.exports = { nfrsIfrs, internationalAccounting, virtualCfo, resources };
