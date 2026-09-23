const data = require('./data');
const { icon, stampMark } = require('./icons');
const { button, sectionHead, pageHero, ctaBand, eyebrow, eyebrowOnDark, panelLabel } = require('./ui');
const { esc, safeUrl, internalHref } = require('./escape');

// Build initials (max 2) from a name for the avatar placeholder.
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function splitTeamBio(bio) {
  const text = String(bio || '').trim().replace(/\r\n/g, '\n');
  if (!text) return { lead: '', rest: [] };

  // Keep the first complete sentence visible so the grid stays scannable,
  // while preserving the rest of every supplied bio inside an accessible
  // native details element. This avoids silently truncating credentials or
  // experience simply to make the cards the same height.
  const sentence = text.match(/^(.+?[.!?])(?:\s|$)/s);
  let lead = sentence ? sentence[1].trim() : text;
  let remainder = sentence ? text.slice(sentence[1].length).trim() : '';

  if (!sentence && lead.length > 280) {
    const cut = lead.lastIndexOf(' ', 270);
    const splitAt = cut > 120 ? cut : 270;
    remainder = lead.slice(splitAt).trim();
    lead = `${lead.slice(0, splitAt).trim()}…`;
  }

  const rest = remainder ? remainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
  return { lead, rest };
}

function teamProfileCard(member, index, featured = false) {
  const bio = splitTeamBio(member.bio);
  const photo = member.photo
    ? `<img src="${esc(safeUrl(member.photo))}" alt="${esc(member.name)}" loading="lazy" decoding="async">`
    : `<span class="team-profile-initials" aria-hidden="true">${esc(initials(member.name))}</span>`;
  const location = member.location
    ? `<span class="team-profile-location">${icon('mapPin')}<span>${esc(member.location)}</span></span>`
    : '';
  const details = bio.rest.length
    ? `<details class="team-profile-details">
        <summary>Read full profile <span aria-hidden="true">${icon('chevronDown')}</span></summary>
        <div class="team-profile-details-copy">${bio.rest.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}</div>
      </details>`
    : '';

  return `<article class="team-profile-card${featured ? ' team-profile-card--featured' : ''} reveal">
    <div class="team-profile-media">
      ${photo}
      <span class="team-profile-index">${String(index + 1).padStart(2, '0')}</span>
    </div>
    <div class="team-profile-body">
      ${member.role ? `<p class="team-profile-role">${esc(member.role)}</p>` : ''}
      <h3>${esc(member.name)}</h3>
      ${location}
      ${bio.lead ? `<p class="team-profile-lead">${esc(bio.lead)}</p>` : ''}
      ${details}
    </div>
  </article>`;
}

function teamHero(h, members) {
  const operatingBase = data.brand && data.brand.addressLine ? data.brand.addressLine : 'Kathmandu, Nepal';
  return `<section class="team-premium-hero">
    <div class="container team-premium-hero-grid">
      <div class="team-premium-hero-copy reveal-stagger">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="team-premium-hero-sub">${esc(h.subtitle)}</p>
        <div class="team-premium-hero-actions">
          ${button('Meet the Team', '#team-profiles', 'primary')}
          ${button('Discuss Your Needs', 'contact.html', 'ghost-light')}
        </div>
        <div class="team-premium-hero-facts" aria-label="Maven team overview">
          <span><strong>${members.length}</strong><small>Public team profiles</small></span>
          <span><strong>Kathmandu</strong><small>Operating base</small></span>
          <span><strong>Nepal + Remote</strong><small>Client delivery</small></span>
        </div>
      </div>

      <aside class="team-premium-model reveal" aria-label="How Maven's team works">
        <div class="team-premium-model-head">
          ${panelLabel('How the team works')}
          <h2>Different experience. One controlled client relationship.</h2>
          <p>Client work is scoped around the people and review input it actually needs, rather than adding layers for appearance.</p>
        </div>
        <div class="team-premium-model-list">
          <div><span>01</span><strong>Hands-on delivery</strong><small>Day-to-day accounting, compliance and reporting work stays close to the records.</small></div>
          <div><span>02</span><strong>Relevant review</strong><small>Senior or specialist input can be brought in where the assignment calls for it.</small></div>
          <div><span>03</span><strong>Direct communication</strong><small>Questions, exceptions and missing information are surfaced clearly instead of being hidden in process.</small></div>
          <div><span>04</span><strong>Confidential handling</strong><small>Access to client information should match the agreed work and remain controlled.</small></div>
        </div>
        <p class="team-premium-model-foot">Operating office: ${esc(operatingBase)}</p>
      </aside>
    </div>
  </section>`;
}

function team() {
  const h = data.pageHeader('team');
  const members = data.teamMembers || [];
  const founders = members.filter((member) => /founder/i.test(member.role || ''));
  const widerTeam = members.filter((member) => !/founder/i.test(member.role || ''));
  const capabilityAreas = [
    {
      number: '01',
      iconName: 'ledger',
      title: 'Accounting & compliance delivery',
      text: 'Hands-on experience across bookkeeping, financial statements, tax support, payroll-related accounting and recurring finance administration.',
    },
    {
      number: '02',
      iconName: 'shield',
      title: 'Audit, risk & control perspective',
      text: 'Experience across audit, banking, internal controls, regulatory compliance, risk management and financial governance strengthens the review perspective available to engagements.',
    },
    {
      number: '03',
      iconName: 'trendUp',
      title: 'Business & management perspective',
      text: 'Advisory experience adds commercial, operational, reporting and strategic context when a client needs more than routine transaction processing.',
    },
  ];
  const workingStandards = [
    ['Scope before activity', 'Responsibilities, expected outputs and professional boundaries should be clear before recurring work settles into a routine.'],
    ['Review where it matters', 'Review is matched to the work being delivered, with senior or specialist input used where the subject matter requires it.'],
    ['Explain exceptions early', 'Missing records, unclear transactions and reporting issues should be raised while they can still be resolved efficiently.'],
    ['Keep access disciplined', 'Client systems and documents should be accessed only to the extent needed for the agreed assignment.'],
  ];

  if (!members.length) {
    return `
      ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/team-hero-bg.jpg')}
      <section class="section-pad"><div class="container"><div class="info-note text-center reveal" style="max-width:620px;margin:0 auto">Team profiles are being prepared — check back soon.</div></div></section>
      ${ctaBand({ eyebrow: 'Work With Maven', title: 'Let Maven support your business', buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')] })}
    `;
  }

  return `
  ${teamHero(h, members)}

  <section class="section-pad team-capability-section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'One Firm, Complementary Experience',
        title: 'A broader finance perspective without losing day-to-day accountability.',
        subtitle: 'Maven combines practical client delivery with experience from accounting, audit, banking, risk, compliance, reporting and business advisory environments.',
      })}
      <div class="team-capability-grid reveal-stagger">
        ${capabilityAreas.map((area) => `<article class="team-capability-card">
          <div class="team-capability-top"><span>${esc(area.number)}</span><span class="team-capability-icon">${icon(area.iconName)}</span></div>
          <h3>${esc(area.title)}</h3>
          <p>${esc(area.text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad team-profiles-section bg-mist" id="team-profiles">
    <div class="container">
      ${founders.length ? `<div class="team-profile-group team-profile-group--founders">
        <div class="team-profile-group-head reveal">
          ${eyebrow('Founders')}
          <h2>Leadership that stays connected to the client work.</h2>
          <p>The founders' profiles below are shown exactly from the firm's published team information; detailed experience remains available in each profile.</p>
        </div>
        <div class="team-profile-grid team-profile-grid--founders reveal-stagger">
          ${founders.map((member, i) => teamProfileCard(member, i, true)).join('')}
        </div>
      </div>` : ''}

      ${widerTeam.length ? `<div class="team-profile-group${founders.length ? ' team-profile-group--secondary' : ''}">
        <div class="team-profile-group-head reveal">
          ${eyebrow(founders.length ? 'Advisory & Client Delivery' : 'Our Team')}
          <h2>${founders.length ? 'Specialist perspective and hands-on finance support.' : 'The people behind Maven’s client work.'}</h2>
          <p>Roles and biographies are presented from Maven's current published team information. Some advisors contribute from locations outside Nepal; Maven's operating office remains in Kathmandu.</p>
        </div>
        <div class="team-profile-grid reveal-stagger">
          ${widerTeam.map((member, i) => teamProfileCard(member, i + founders.length)).join('')}
        </div>
      </div>` : ''}
    </div>
  </section>

  <section class="section-pad team-standards-section">
    <div class="container team-standards-layout">
      <div class="team-standards-copy reveal">
        ${eyebrowOnDark('Working Standards')}
        <h2>Professional capability matters most when the working process is dependable.</h2>
        <p>Experience is only useful to a client when responsibilities, review, communication and information handling remain clear throughout the engagement.</p>
        <a class="team-standards-link" href="${internalHref('about.html')}"><span>See how Maven works</span>${icon('arrowRight')}</a>
      </div>
      <div class="team-standards-list reveal-stagger">
        ${workingStandards.map((item, i) => `<article>
          <span>0${i + 1}</span>
          <div><h3>${esc(item[0])}</h3><p>${esc(item[1])}</p></div>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad team-reach-section">
    <div class="container team-reach-grid">
      <article class="team-reach-card reveal">
        <span class="team-reach-icon">${icon('mapPin')}</span>
        ${eyebrow('Kathmandu Operating Base')}
        <h2>Client delivery is anchored in Nepal.</h2>
        <p>Maven's operating office is in ${esc(data.brand.addressLine || 'Kathmandu, Nepal')}. The team supports accounting, tax, compliance, reporting and advisory engagements for businesses across Nepal.</p>
        <a href="${internalHref('contact.html')}"><span>Contact the Kathmandu team</span>${icon('arrowRight')}</a>
      </article>
      <article class="team-reach-card team-reach-card--global reveal">
        <span class="team-reach-icon">${icon('globe')}</span>
        ${eyebrowOnDark('Remote Collaboration')}
        <h2>International support without pretending every location is an office.</h2>
        <p>International client work is delivered remotely, and advisors may contribute from other locations when relevant. Maven does not present those locations as separate overseas offices.</p>
        <a href="${internalHref('global-outsourcing.html')}"><span>Explore Global Outsourcing</span>${icon('arrowRight')}</a>
      </article>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Work With Maven',
    title: 'Need a finance team that stays close to the work?',
    subtitle: 'Tell us what you need help with — accounting, compliance, reporting, advisory or additional remote finance capacity — and we will help define the right starting scope.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Explore Services', 'services.html', 'ghost-light')],
  })}
  `;
}

function testimonialSourceRow(t, index) {
  const primary = t.name || t.business || `Client ${index + 1}`;
  const secondary = [t.role, t.business && t.business !== primary ? t.business : ''].filter(Boolean).map(esc);
  return `<div class="testimonials-source-row">
    <span>${String(index + 1).padStart(2, '0')}</span>
    <div>
      <strong>${esc(primary)}</strong>
      ${secondary.length ? `<small>${secondary.join(' · ')}</small>` : ''}
    </div>
  </div>`;
}

function testimonialFeatureCard(t, index) {
  const meta = [t.role, t.business].filter(Boolean).map(esc);
  return `<figure class="testimonial-feature-card reveal">
    <div class="testimonial-feature-card-top">
      <span class="testimonial-feature-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="testimonial-feature-icon">${icon('messageCircle')}</span>
    </div>
    <span class="testimonial-feature-label">Published client feedback</span>
    <span class="testimonial-feature-quote-mark" aria-hidden="true">&ldquo;</span>
    <blockquote>${esc(t.quote)}</blockquote>
    ${(t.name || meta.length) ? `<figcaption>
      ${t.name ? `<strong>${esc(t.name)}</strong>` : ''}
      ${meta.length ? `<span>${meta.join(' · ')}</span>` : ''}
    </figcaption>` : ''}
  </figure>`;
}

function testimonialGridFor(items) {
  if (items.length === 0) {
    return `<div class="info-note text-center reveal" style="max-width:620px;margin:0 auto">Client feedback is published only when Maven has genuine, approved material to show.</div>`;
  }
  const modifier = items.length === 1 ? ' testimonial-feature-grid--solo' : '';
  return `<div class="testimonial-feature-grid${modifier} reveal-stagger">${items.map(testimonialFeatureCard).join('')}</div>`;
}

function testimonialsHero(h, items) {
  const publicCount = items.length;
  const publicCountLabel = `${publicCount} published testimonial${publicCount === 1 ? '' : 's'}`;
  const sourceRows = items.length
    ? items.map(testimonialSourceRow).join('')
    : `<div class="testimonials-source-empty">No client testimonials are currently published.</div>`;

  return `<section class="testimonials-premium-hero">
    <div class="container testimonials-premium-hero-grid">
      <div class="testimonials-premium-hero-copy page-hero-animate">
        ${eyebrowOnDark(h.eyebrow)}
        <h1>${esc(h.title)}</h1>
        <p class="testimonials-premium-hero-sub">${esc(h.subtitle)}</p>
        <div class="testimonials-premium-hero-actions">
          ${button('Read Client Feedback', '#client-feedback', 'primary')}
          ${button('Explore Services', 'services.html', 'ghost-light')}
        </div>
        <div class="testimonials-premium-hero-assurances" aria-label="Testimonials page publishing principles">
          <span>${stampMark('stamp-sm')} ${esc(publicCountLabel)}</span>
          <span>${stampMark('stamp-sm')} Named client attribution</span>
          <span>${stampMark('stamp-sm')} Full published quote text</span>
        </div>
      </div>

      <aside class="testimonials-source-panel reveal" aria-label="Published testimonial sources">
        <div class="testimonials-source-panel-head">
          ${panelLabel('Published Client Voices')}
          <h2>Feedback shown with clear attribution.</h2>
          <p>The client statements on this page are drawn from Maven's current published testimonial records, with the supplied name, role and business context kept alongside each quote.</p>
        </div>
        <div class="testimonials-source-list">
          ${sourceRows}
        </div>
        <div class="testimonials-source-panel-foot">
          ${icon('shield')}<span>Only testimonials marked visible in Maven's content system are rendered on the public page.</span>
        </div>
      </aside>
    </div>
  </section>`;
}

function testimonials() {
  const h = data.pageHeader('testimonials');
  const items = data.testimonials || [];
  const grid = testimonialGridFor(items);
  const themes = [
    {
      iconName: 'ledger',
      title: 'Accounting & records',
      text: 'The published feedback refers to accounting support, accurate financial management and keeping financial records in order.',
    },
    {
      iconName: 'percent',
      title: 'Tax & compliance',
      text: 'Clients specifically mention tax support, tax compliance and meeting day-to-day compliance responsibilities.',
    },
    {
      iconName: 'trendUp',
      title: 'Financial management',
      text: 'Financial management appears in the published feedback as part of the ongoing support around normal business operations.',
    },
    {
      iconName: 'messageCircle',
      title: 'Working relationship',
      text: 'The client wording describes Maven as reliable, professional and responsive, with practical or timely support.',
    },
  ];

  return `
  ${testimonialsHero(h, items)}

  <section class="section-pad testimonials-feedback-section" id="client-feedback">
    <div class="container">
      <div class="testimonials-feedback-intro">
        <div class="reveal">
          ${eyebrow('Client Voices')}
          <h2>Read the published feedback in full.</h2>
        </div>
        <p class="reveal">These statements are presented as complete client testimonials rather than reduced to star scores or anonymous marketing claims. Names, roles and business names are shown from the same published testimonial records.</p>
      </div>
      ${grid}
    </div>
  </section>

  ${items.length ? `<section class="section-pad testimonials-themes-section">
    <div class="container testimonials-themes-layout">
      <div class="testimonials-themes-copy reveal">
        ${eyebrowOnDark('Themes in Current Feedback')}
        <h2>The client comments stay focused on practical finance work.</h2>
        <p>The two current published testimonials refer to recurring accounting, tax, compliance and financial-management support in the context of running their businesses.</p>
        <a class="testimonials-themes-link" href="${internalHref('services.html')}"><span>Explore Maven services</span>${icon('arrowRight')}</a>
      </div>
      <div class="testimonials-themes-grid reveal-stagger">
        ${themes.map((theme, index) => `<article class="testimonials-theme-card">
          <div class="testimonials-theme-card-top"><span>0${index + 1}</span><span class="testimonials-theme-icon">${icon(theme.iconName)}</span></div>
          <h3>${esc(theme.title)}</h3>
          <p>${esc(theme.text)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <section class="section-pad testimonials-next-section">
    <div class="container testimonials-next-grid">
      <article class="testimonials-next-card reveal">
        <span class="testimonials-next-icon">${icon('ledger')}</span>
        ${eyebrow('Service Scope')}
        <h2>See the finance, tax and accounting support behind the client relationships.</h2>
        <p>Review Maven's service areas, from bookkeeping and tax support through reporting, compliance and business advisory.</p>
        <a href="${internalHref('services.html')}"><span>View All Services</span>${icon('arrowRight')}</a>
      </article>
      <article class="testimonials-next-card testimonials-next-card--dark reveal">
        <span class="testimonials-next-icon">${icon('messageCircle')}</span>
        ${eyebrowOnDark('Your Requirement')}
        <h2>Need to understand whether Maven fits your situation?</h2>
        <p>Use the initial consultation to describe the work you need help with. Maven can then clarify scope, responsibilities and an appropriate starting point.</p>
        <a href="${internalHref('contact.html')}"><span>Start a Conversation</span>${icon('arrowRight')}</a>
      </article>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Work With Maven',
    title: 'Looking for practical finance support that stays close to the work?',
    subtitle: 'Tell us what you need help with — accounting, tax, compliance, reporting or ongoing finance support — and we will help define the right starting scope.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('Explore Services', 'services.html', 'ghost-light')],
  })}
  `;
}

function privacySectionId(title, index) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `privacy-${slug || `section-${index + 1}`}`;
}

function privacy() {
  const h = data.pageHeader('privacy');
  const policySections = data.privacySections || [];
  const intro = data.privacyIntro
    ? `<div class="privacy-document-intro reveal">
        ${panelLabel('Policy overview')}
        <p>${esc(data.privacyIntro)}</p>
      </div>`
    : '';
  const sectionNav = policySections.length
    ? `<nav class="privacy-document-nav" aria-label="Privacy Policy sections">
        <ol>
          ${policySections.map((s, index) => `<li><a href="#${privacySectionId(s.title, index)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(s.title)}</strong>${icon('chevronRight')}</a></li>`).join('')}
        </ol>
      </nav>`
    : '';
  const sections = policySections.map((s, index) => `
    <section class="privacy-document-section reveal" id="${privacySectionId(s.title, index)}">
      <div class="privacy-document-section-head">
        <span class="privacy-document-section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h2>${esc(s.title)}</h2>
      </div>
      <p>${esc(s.text)}</p>
    </section>`).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/privacy-hero-bg.jpg')}
  <section class="section-pad privacy-document-shell">
    <div class="container privacy-document-layout">
      <aside class="privacy-document-aside reveal" aria-label="Privacy Policy navigation">
        ${panelLabel('Policy contents')}
        ${sectionNav}
        ${data.privacyLastReviewed ? `<div class="privacy-document-reviewed"><span>Last reviewed</span><strong>${esc(data.privacyLastReviewed)}</strong></div>` : ''}
      </aside>

      <article class="privacy-document-main" aria-label="Privacy Policy">
        ${intro}
        <div class="privacy-document-sections">
          ${sections}
        </div>
      </article>
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Questions?',
    title: 'Want to know how we handle your information?',
    buttons: [button('Contact Maven', 'contact.html', 'primary')],
  })}
  `;
}

function termsSectionId(title, index) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `terms-${slug || `section-${index + 1}`}`;
}

function terms() {
  const h = data.pageHeader('terms');
  const termsSections = data.termsSections || [];
  const intro = data.termsIntro
    ? `<div class="terms-document-intro reveal">
        ${panelLabel('Terms overview')}
        <p>${esc(data.termsIntro)}</p>
      </div>`
    : '';
  const sectionNav = termsSections.length
    ? `<nav class="terms-document-nav" aria-label="Terms of Service sections">
        <ol>
          ${termsSections.map((s, index) => `<li><a href="#${termsSectionId(s.title, index)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(s.title)}</strong>${icon('chevronRight')}</a></li>`).join('')}
        </ol>
      </nav>`
    : '';
  const sections = termsSections.map((s, index) => `
    <section class="terms-document-section reveal" id="${termsSectionId(s.title, index)}">
      <div class="terms-document-section-head">
        <span class="terms-document-section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h2>${esc(s.title)}</h2>
      </div>
      <p>${esc(s.text)}</p>
    </section>`).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/privacy-hero-bg.jpg')}
  <section class="section-pad terms-document-shell">
    <div class="container terms-document-layout">
      <aside class="terms-document-aside reveal" aria-label="Terms of Service navigation">
        ${panelLabel('Terms contents')}
        ${sectionNav}
        ${data.termsLastReviewed ? `<div class="terms-document-reviewed"><span>Last reviewed</span><strong>${esc(data.termsLastReviewed)}</strong></div>` : ''}
      </aside>

      <article class="terms-document-main" aria-label="Terms of Service">
        ${intro}
        <div class="terms-document-sections">
          ${sections}
        </div>
      </article>
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Questions?',
    title: 'Have a question about these terms?',
    buttons: [button('Contact Maven', 'contact.html', 'primary')],
  })}
  `;
}

function notFound() {
  const recoveryLinks = [
    { label: 'Services', href: 'services.html', detail: 'Review Maven service areas.', iconName: 'briefcase' },
    { label: 'Resources', href: 'resources.html', detail: 'Browse guides, tools and reference pages.', iconName: 'compass' },
    { label: 'FAQ', href: 'faq.html', detail: 'Check common questions about working with Maven.', iconName: 'messageCircle' },
    { label: 'Contact', href: 'contact.html', detail: 'Send a general enquiry to Maven.', iconName: 'mail' },
  ];

  return `
  <section class="not-found-premium">
    <div class="not-found-premium-number" aria-hidden="true">404</div>
    <div class="container not-found-premium-grid">
      <div class="not-found-premium-copy reveal-stagger">
        ${eyebrowOnDark('Error 404')}
        <h1>Page not found</h1>
        <p class="not-found-premium-sub">The address may be outdated, mistyped, or no longer available. Use a known route below to continue.</p>
        <div class="not-found-premium-actions">
          ${button('Go to Homepage', 'index.html', 'primary')}
          ${button('Contact Maven', 'contact.html', 'ghost-light')}
        </div>
      </div>

      <aside class="not-found-premium-panel reveal" aria-label="404 recovery navigation">
        ${panelLabel('Useful destinations')}
        <h2>Continue from a known page.</h2>
        <nav class="not-found-premium-nav" aria-label="Useful destinations after a page-not-found error">
          ${recoveryLinks.map((item) => `<a href="${internalHref(item.href)}">
            <span class="not-found-premium-nav-icon">${icon(item.iconName)}</span>
            <span class="not-found-premium-nav-copy"><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span>
            ${icon('chevronRight', 'not-found-premium-nav-arrow')}
          </a>`).join('')}
        </nav>
      </aside>
    </div>
  </section>

  <section class="section-pad not-found-premium-help">
    <div class="container not-found-premium-help-inner reveal">
      <div>
        ${eyebrow('Need a route?')}
        <h2>Start from the site structure.</h2>
        <p>The main navigation and footer remain available on this page, so you can also move directly to any published section from there.</p>
      </div>
      ${button(`View Services ${icon('arrowRight')}`, 'services.html', 'outline')}
    </div>
  </section>
  `;
}

module.exports = { team, testimonials, privacy, terms, notFound };
