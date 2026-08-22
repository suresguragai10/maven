const data = require('./data');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, serviceEntry, capabilityChapter, servicePhotoMeta, packageCard, ctaBand,
} = require('./ui');
const { esc, internalHref } = require('./escape');

// Task 16: Outsourced Accounting & Bookkeeping and NFRS/IFRS each have their
// own dedicated deep-dive page -- their entry's CTA should go there instead
// of skipping straight to Contact, so the Services page actually connects
// to those specialist pages in its own body content, not only via the
// chapter-level image composition above each entry group.
const SERVICE_DEEP_LINKS = {
  bookkeeping: { href: 'outsourced-accounting.html', ctaLabel: 'Explore Outsourced Accounting' },
  'nfrs-ifrs': { href: 'nfrs-ifrs.html', ctaLabel: 'Explore NFRS / IFRS Support' },
};

// Task 05: one chapter intro (shared editorial image + copy, via the same
// capabilityChapter() primitive Home uses) followed by the chapter's real
// individual services as typography-led entries — replaces the old
// seven-row repeated photo-left/photo-right pattern. Every service keeps
// its own anchor, full item list and "Discuss This Service" link; only the
// per-row photo is gone (each chapter already carries one editorial image).
function serviceChapterSection({ variant, bg, reverse, id, chapterLabel, title, text, image, categories }) {
  return `<section class="section-pad${bg ? ' ' + bg : ''}">
    <div class="container">
      ${capabilityChapter({ variant, reverse, id, chapterLabel, title, text, image })}
      <div class="grid grid-auto service-entry-grid">
        ${categories.map((cat) => serviceEntry(cat, SERVICE_DEEP_LINKS[cat.key])).join('')}
      </div>
    </div>
  </section>`;
}

function services() {
  const h = data.pageHeader('services');
  const byKey = (key) => data.serviceCategories.find((c) => c.key === key);
  const registration = byKey('registration');
  const tax = byKey('tax');
  const payroll = byKey('payroll');
  const bookkeeping = byKey('bookkeeping');
  const reporting = byKey('reporting');
  const advisory = byKey('advisory');
  const nfrsIfrs = byKey('nfrs-ifrs');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/services-hero-bg.jpg')}

  ${serviceChapterSection({
    variant: 'structured',
    id: 'establish-and-comply',
    chapterLabel: '01 · Establish & Comply',
    title: 'A solid legal and compliance foundation',
    text: `${registration.tagline} ${tax.tagline} ${payroll.tagline}`,
    image: servicePhotoMeta(registration),
    categories: [registration, tax, payroll],
  })}

  ${serviceChapterSection({
    variant: 'feature',
    reverse: true,
    bg: 'bg-mist',
    id: 'run-your-finance-function',
    chapterLabel: '02 · Run Your Finance Function',
    title: 'Outsourced accounting, run like an in-house finance team',
    text: `${bookkeeping.tagline} ${reporting.tagline}`,
    image: servicePhotoMeta(bookkeeping),
    categories: [bookkeeping, reporting],
  })}

  ${serviceChapterSection({
    variant: 'technical',
    id: 'advise-and-report-better',
    chapterLabel: '03 · Advise & Report Better',
    title: 'Guidance and reporting that grow with your business',
    text: `${advisory.tagline} And as reporting needs become more complex — for lenders, investors, or growth — structured NFRS / IFRS implementation support.`,
    image: servicePhotoMeta(advisory),
    categories: [advisory, nfrsIfrs],
  })}

  <section class="section-pad-sm bg-mist">
    <div class="container" style="max-width:820px">
      <div class="partner-note reveal">
        <h2 class="partner-note-title">Support Through Partners</h2>
        <p>${esc(data.partnerNote)}</p>
      </div>
      <p class="tag-note text-center" style="margin-top:18px">Maven positions itself as a business consultancy and outsourced accounts/compliance partner — not as a statutory audit firm or CA firm.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Not Sure Where To Start?',
    title: 'Tell us about your business and we will recommend the right services',
    subtitle: 'Every engagement starts with a short, free conversation.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Get a Customized Document Checklist', 'documents-needed.html', 'ghost-light')],
  })}
  `;
}

function outsourcedAccounting() {
  const h = data.pageHeader('outsourced-accounting');
  return `
  ${pageHero(h.eyebrow, h.title || data.outsourced.title, h.subtitle, '/images/outsourced-accounting-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Why Outsource', title: 'Support that scales with your business', align: 'left' })}
        <p>${esc(data.outsourced.paragraph)}</p>
        <p style="margin-top:16px">This support is available through our <a href="${internalHref('packages.html')}" style="color:var(--gold-700);font-weight:700">Monthly Compliance and Business Growth packages</a>, scoped to your transaction volume and reporting needs.</p>
        <div style="margin-top:24px">${button(esc(data.outsourced.cta), 'contact.html', 'primary')}</div>
      </div>
      <div class="reveal">
        <ul class="stamp-list">
          ${data.outsourced.benefits.map((b) => `<li>${stampMark('stamp-sm')}<span>${esc(b)}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section class="section-pad bg-mist">
    <div class="container">
      ${sectionHead({ eyebrow: 'How It Works', title: 'A simple monthly rhythm' })}
      <div class="grid grid-4">
        <div class="value-card reveal"><h3>1. Share documents</h3><p>Send invoices, bills, and bank statements each month through the channel that works for you.</p></div>
        <div class="value-card reveal"><h3>2. We record &amp; reconcile</h3><p>Our team enters, organizes, and reconciles your books.</p></div>
        <div class="value-card reveal"><h3>3. Monthly report delivered</h3><p>You receive a clear financial summary and compliance status update.</p></div>
        <div class="value-card reveal"><h3>4. Ongoing tracking</h3><p>VAT, TDS, and tax deadlines are tracked so nothing is missed.</p></div>
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Monthly Accounting Support',
    title: 'Ready to hand off your bookkeeping?',
    subtitle: data.outsourced.cta,
    buttons: [button('Start Monthly Accounting Support', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about monthly accounting support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function internationalTile(tile) {
  return `<article class="service-card reveal">
    <div class="service-card-head">
      <span class="service-icon">${icon(tile.icon)}</span>
      <h3>${esc(tile.title)}</h3>
    </div>
    <p class="service-tagline">${esc(tile.tagline)}</p>
    <p>${esc(tile.text)}</p>
    <div style="margin-top:20px">${button(esc(tile.cta), tile.href, 'outline')}</div>
  </article>`;
}

function globalOutsourcing() {
  const h = data.pageHeader('global-outsourcing');
  const hub = data.internationalHub || {};

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/global-outsourcing-hero-bg.jpg')}

  <section class="section-pad-sm">
    <div class="container text-center" style="max-width:820px">
      <p class="reveal">${esc(hub.intro)}</p>
    </div>
  </section>

  <section class="section-pad">
    <div class="container">
      ${sectionHead({ eyebrow: 'Choose The Support You Need', title: 'Two ways to work with Maven internationally' })}
      <div class="grid grid-2 reveal-stagger">
        ${(hub.tiles || []).map(internationalTile).join('')}
      </div>
      <p class="text-center reveal" style="max-width:760px;margin:32px auto 0">Remote Accounting Support covers the day-to-day work of keeping your books accurate — bookkeeping, reconciliations, and monthly reporting. Virtual CFO support builds on that foundation with higher-skill, knowledge-process (KPO) work — turning accounting records into budgets, forecasts, and management reporting for decisions, not just compliance. Most engagements start with Remote Accounting Support and expand into Virtual CFO support once the accounting foundation is reliable.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Global Finance Delivery',
    title: 'Ready to build the right finance support for your business?',
    subtitle: hub.cta,
    buttons: [button('Book a Free Discovery Call', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like to talk about international accounting support.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function packages() {
  const h = data.pageHeader('packages');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/packages-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container">
      <div class="grid grid-3 reveal-stagger">
        ${data.packages.map((p, i) => packageCard(p, i)).join('')}
      </div>
      <div class="info-note reveal" style="margin-top:40px">${esc(data.packagesFeeNote)}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Get A Quote',
    title: 'Tell us about your business for a custom quotation',
    subtitle: 'No package fits perfectly? We can scope a custom mix of services.',
    buttons: [button('Get a Customized Quote', 'contact.html', 'primary'), button('View All Services', 'services.html', 'ghost-light')],
  })}
  `;
}

module.exports = { services, outsourcedAccounting, globalOutsourcing, packages };
