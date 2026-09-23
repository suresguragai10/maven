const data = require('./data');
const { esc, safeUrl, internalHref } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, pageHero, ctaBand, panelLabel, eyebrow, eyebrowOnDark,
} = require('./ui');

function usefulLinksCard(link, index) {
  const number = String(index + 1).padStart(2, '0');
  const href = esc(safeUrl(link.url));
  return `<article class="useful-link-card reveal">
    <div class="useful-link-card-top">
      <span class="useful-link-index">${number}</span>
      <span class="useful-link-icon">${icon('external')}</span>
    </div>
    <span class="useful-link-label">Official external reference</span>
    <h3>${esc(link.name)}</h3>
    <p>${esc(link.description)}</p>
    <a class="useful-link-visit" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${esc('Visit ' + link.name + ' website (opens in a new tab)')}">
      <span>Visit Website</span>${icon('external')}
    </a>
  </article>`;
}

function relatedResourceCard({ iconName, label, title, text, href, cta }) {
  return `<article class="useful-links-related-card reveal">
    <span class="useful-links-related-icon">${icon(iconName)}</span>
    <span class="useful-links-related-label">${esc(label)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    <a href="${internalHref(href)}"><span>${esc(cta)}</span>${icon('arrowRight')}</a>
  </article>`;
}

function usefulLinks() {
  const links = (data.usefulLinks || []);
  const h = data.pageHeader('useful-links');
  const verifySteps = [
    ['01', 'Open the original source', 'Use the relevant authority or institution itself for portal access, forms, notices and published guidance.'],
    ['02', 'Check the current context', 'Confirm dates, periods, forms and instructions on the source you are using rather than relying on an old copy or summary.'],
    ['03', 'Match it to your situation', 'A public portal can explain a process without resolving every entity-specific tax, accounting, payroll or reporting question.'],
    ['04', 'Get confirmation where needed', 'If the next step affects a filing, payment, registration or professional judgement, confirm what applies before acting.'],
  ];
  const relatedResources = [
    {
      iconName: 'ledger',
      label: 'Prepare',
      title: 'Documents Checklist',
      text: 'See common starting records for registration, tax, accounting and reporting work before Maven confirms the exact list.',
      href: 'documents-needed.html',
      cta: 'View Checklists',
    },
    {
      iconName: 'percent',
      label: 'Calculate',
      title: 'Financial Calculators',
      text: 'Use indicative salary tax, VAT, TDS and EMI tools for planning, then verify anything that affects a real filing or payment.',
      href: 'calculators.html',
      cta: 'Open Calculators',
    },
    {
      iconName: 'messageCircle',
      label: 'Understand',
      title: 'Frequently Asked Questions',
      text: 'Review practical answers about Maven services, scope, coverage, fees, confidentiality and reporting support.',
      href: 'faq.html',
      cta: 'Read the FAQ',
    },
  ];

  return `
  <section class="useful-links-premium-hero">
    <picture class="useful-links-premium-hero-photo" aria-hidden="true">
      <source media="(max-width: 767px)" srcset="/images/useful-links-hero-bg-640w.jpg">
      <source media="(max-width: 1279px)" srcset="/images/useful-links-hero-bg-960w.jpg">
      <img src="/images/useful-links-hero-bg.jpg" alt="" decoding="async">
    </picture>
    <div class="useful-links-premium-hero-shade" aria-hidden="true"></div>
    <div class="container useful-links-hero-grid">
      <div class="useful-links-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="useful-links-hero-sub">${esc(h.subtitle)}</p>
        <div class="useful-links-hero-actions">
          ${button('Browse Official References', '#official-reference-links', 'primary')}
          ${button('Back to Resource Hub', 'resources.html', 'ghost-light')}
        </div>
        <div class="useful-links-hero-assurances" aria-label="Useful links directory principles">
          <span>${stampMark('stamp-sm')} ${links.length} curated reference links</span>
          <span>${stampMark('stamp-sm')} Third-party websites</span>
          <span>${stampMark('stamp-sm')} Verify current requirements at source</span>
        </div>
      </div>

      <aside class="useful-links-reference-panel reveal" aria-label="How to use the reference directory">
        <div class="useful-links-reference-panel-head">
          ${panelLabel('Reference Desk')}
          <h2>Go to the source, then check what applies.</h2>
          <p>The directory is for finding the relevant official or institutional website quickly without turning a general link into case-specific advice.</p>
        </div>
        <div class="useful-links-reference-panel-list">
          <div class="useful-links-reference-row"><span>01</span><div><strong>Find the right source</strong><small>Use the description to identify the relevant authority or institution.</small></div></div>
          <div class="useful-links-reference-row"><span>02</span><div><strong>Review the live portal</strong><small>Check the source itself for current forms, notices, processes and instructions.</small></div></div>
          <div class="useful-links-reference-row"><span>03</span><div><strong>Apply with context</strong><small>Get confirmation when the rule or process depends on your entity, transaction or reporting facts.</small></div></div>
        </div>
        <div class="useful-links-reference-panel-foot">
          ${icon('shield')}<span>Maven does not operate or control these external websites. Availability, content and requirements can change.</span>
        </div>
      </aside>
    </div>
  </section>

  <section class="section-pad useful-links-directory-section" id="official-reference-links">
    <div class="container">
      <div class="useful-links-directory-intro">
        <div class="reveal">
          ${eyebrow('Official Reference Directory')}
          <h2>Use the description to choose the right source.</h2>
        </div>
        <p class="reveal">These links take you away from Maven to the listed authority or institution. Open the relevant website, check its current information, and return to Maven when the next step needs accounting, tax, reporting or compliance context.</p>
      </div>
      <div class="useful-links-directory-grid reveal-stagger">
        ${links.map(usefulLinksCard).join('')}
      </div>
      <div class="useful-links-source-note reveal">
        <span>${icon('external')}</span>
        <p><strong>External-source notice:</strong> Maven provides this directory for convenience and does not control third-party website availability or content. Always double check current requirements directly on the relevant portal.</p>
      </div>
    </div>
  </section>

  <section class="section-pad useful-links-verify-section">
    <div class="container">
      <div class="useful-links-verify-intro reveal">
        ${eyebrowOnDark('Before You Rely on a Portal')}
        <h2>A source is strongest when the context is current.</h2>
        <p>Official and institutional websites are the right place to start for source material. Before a link becomes a filing, payment or reporting decision, make sure the information is current and relevant to the facts in front of you.</p>
      </div>
      <div class="useful-links-verify-grid reveal-stagger">
        ${verifySteps.map(([number, title, text]) => `<article class="useful-links-verify-step">
          <div class="useful-links-verify-step-top"><span>${esc(number)}</span>${stampMark('stamp-sm')}</div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad useful-links-related-section">
    <div class="container">
      <div class="useful-links-related-head">
        <div class="reveal">
          ${eyebrow('Continue in the Resource Hub')}
          <h2>Prepare, calculate or understand before you move forward.</h2>
        </div>
        <p class="reveal">Useful Links is the verification step in Maven's resource library. The other tools help you prepare records, test indicative numbers, and understand common service questions.</p>
      </div>
      <div class="useful-links-related-grid reveal-stagger">
        ${relatedResources.map(relatedResourceCard).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Need Help After the Source?',
    title: 'Bring the portal, notice or question into context.',
    subtitle: 'Maven can help you work through the accounting, tax, compliance or reporting context once you know which official source or process is relevant.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('View Services', 'services.html', 'ghost-light')],
  })}
  `;
}

function blogIndex(posts) {
  const hasPosts = posts && posts.length > 0;
  const list = hasPosts
    ? `<div class="grid grid-3">
        ${posts.map((p) => `<article class="service-card reveal">
          <p class="tag-note" style="margin-bottom:6px">${esc(p.dateDisplay)}</p>
          <h3 style="margin-bottom:10px">${esc(p.title)}</h3>
          <p class="service-tagline" style="flex:1">${esc(p.excerpt)}</p>
          <a class="btn btn-outline" href="${internalHref(p.file)}">Read More ${icon('arrowRight', 'btn-arrow')}</a>
        </article>`).join('')}
      </div>`
    : `<div class="info-note text-center reveal" style="max-width:520px;margin:0 auto">No posts published yet — check back soon.</div>`;

  return `
  ${pageHero('Blog', 'Insights & Updates', 'Practical notes on accounting, tax, and compliance for businesses in Nepal.')}
  <section class="section-pad">
    <div class="container">${list}</div>
  </section>
  ${ctaBand({
    eyebrow: 'Have A Question?',
    title: 'Get advice specific to your business',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')],
  })}
  `;
}

function blogPost(post) {
  return `
  ${pageHero('Blog', post.title, post.dateDisplay)}
  <section class="section-pad">
    <div class="container" style="max-width:720px">
      <div class="reveal" style="font-size:1.02rem;line-height:1.75;color:var(--ink)">${post.contentHtml}</div>
      <div class="divider"></div>
      <a class="btn btn-outline" href="${internalHref('blog.html')}">${icon('arrowRight')} Back to Blog</a>
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Have A Question?',
    title: 'Get advice specific to your business',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')],
  })}
  `;
}

module.exports = { usefulLinks, blogIndex, blogPost };
