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

function testimonialCard(t) {
  const meta = [t.name, t.role, t.business].filter(Boolean).map(esc);
  const who = meta.length
    ? `<figcaption class="testimonial-who">
        <span class="testimonial-name">${meta[0] || ''}</span>
        ${meta.slice(1).length ? `<span class="testimonial-detail">${meta.slice(1).join(' · ')}</span>` : ''}
      </figcaption>`
    : '';
  return `<figure class="testimonial-card reveal">
    <span class="testimonial-quote-mark" aria-hidden="true">&ldquo;</span>
    <blockquote class="testimonial-text">${esc(t.quote)}</blockquote>
    ${who}
  </figure>`;
}

// Same reasoning as teamGridFor() (pages6.js Task 08): a fixed 3-column
// grid leaves an awkward empty gap when there are fewer than 3 real
// testimonials. Layout adapts to the actual count instead.
function testimonialGridFor(items) {
  if (items.length === 0) {
    return `<div class="info-note text-center reveal" style="max-width:520px;margin:0 auto">Client stories are on the way — we publish feedback only with client permission.</div>`;
  }
  if (items.length === 1) {
    return `<div class="testimonial-grid testimonial-grid--solo">${testimonialCard(items[0])}</div>`;
  }
  if (items.length === 2) {
    return `<div class="grid grid-2 testimonial-grid testimonial-grid--pair">${items.map(testimonialCard).join('')}</div>`;
  }
  return `<div class="grid grid-3 testimonial-grid">${items.map(testimonialCard).join('')}</div>`;
}

function testimonials() {
  const h = data.pageHeader('testimonials');
  const items = data.testimonials || [];
  const grid = testimonialGridFor(items);

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}
  <section class="section-pad">
    <div class="container">
      ${grid}
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Become A Client',
    title: 'Ready for practical, reliable support?',
    subtitle: 'Book a free initial consultation — no obligation, just clear next steps.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')],
  })}
  `;
}

function privacy() {
  const h = data.pageHeader('privacy');
  const intro = data.privacyIntro
    ? `<p class="privacy-intro">${esc(data.privacyIntro)}</p>`
    : '';
  const sections = (data.privacySections || []).map((s) => `
    <div class="privacy-section reveal">
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.text)}</p>
    </div>`).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/privacy-hero-bg.jpg')}
  <section class="section-pad">
    <div class="container" style="max-width:760px">
      ${intro}
      ${sections}
      ${data.privacyLastReviewed ? `<p class="tag-note" style="margin-top:28px">Last reviewed: ${esc(data.privacyLastReviewed)}.</p>` : ''}
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Questions?',
    title: 'Want to know how we handle your information?',
    buttons: [button('Contact Maven', 'contact.html', 'primary')],
  })}
  `;
}

function terms() {
  const h = data.pageHeader('terms');
  const intro = data.termsIntro
    ? `<p class="privacy-intro">${esc(data.termsIntro)}</p>`
    : '';
  const sections = (data.termsSections || []).map((s) => `
    <div class="privacy-section reveal">
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.text)}</p>
    </div>`).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/privacy-hero-bg.jpg')}
  <section class="section-pad">
    <div class="container" style="max-width:760px">
      ${intro}
      ${sections}
      ${data.termsLastReviewed ? `<p class="tag-note" style="margin-top:28px">Last reviewed: ${esc(data.termsLastReviewed)}.</p>` : ''}
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
  return `
  <section class="page-hero">
    <div class="container">
      ${eyebrowOnDark('Error 404')}
      <h1>Page not found</h1>
      <p class="page-hero-sub">The page you were looking for doesn't exist, may have moved, or is not yet published.</p>
    </div>
  </section>
  <section class="section-pad">
    <div class="container text-center">
      <p style="margin-bottom:26px">Let's get you back on track:</p>
      <div class="hero-actions" style="justify-content:center">
        ${button('Go to Homepage', 'index.html', 'primary')}
        ${button('View Services', 'services.html', 'outline')}
        ${button('Contact Us', 'contact.html', 'outline')}
      </div>
    </div>
  </section>
  `;
}

module.exports = { team, testimonials, privacy, terms, notFound };
