const data = require('./data');
const { icon, stampMark } = require('./icons');
const { button, sectionHead, pageHero, ctaBand } = require('./ui');
const { esc, safeUrl } = require('./escape');

// Build initials (max 2) from a name for the avatar placeholder.
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function teamCard(m) {
  const loc = m.location ? `<p class="team-card-loc">${icon('mapPin')}<span>${esc(m.location)}</span></p>` : '';
  const bio = m.bio ? `<p class="team-card-bio">${esc(m.bio)}</p>` : '';
  const avatar = m.photo
    ? `<div class="team-card-avatar"><img src="${esc(safeUrl(m.photo))}" alt="${esc(m.name)}" loading="lazy"></div>`
    : `<div class="team-card-avatar" aria-hidden="true">${initials(m.name)}</div>`;
  // Task 08: h3, not h2 -- team() now renders a real sectionHead() (its
  // own h2, "Our Team") above this grid, so each member's name correctly
  // nests one level under it. (Handbook Task 26 originally made this h2
  // specifically because no such h2 existed yet; that reason no longer
  // applies now that one does.) .team-card-name is styled by class, not
  // tag, so this changes no visual output.
  return `<article class="team-card reveal">
    ${avatar}
    <h3 class="team-card-name">${esc(m.name)}</h3>
    ${m.role ? `<p class="team-card-role">${esc(m.role)}</p>` : ''}
    ${loc}
    ${bio}
  </article>`;
}

// Task 08: a fixed 3-column grid looked broken with exactly one real member
// (one card, two empty tracks of dead space) and wouldn't have looked much
// better with two. The layout now adapts to the actual team size instead of
// assuming a large team from the start -- 1 gets a centered, slightly
// larger featured treatment; 2 gets a centered pair; 3+ gets the normal
// grid (which already scales fine to a larger future team, no changes
// needed there). teamCard() itself -- and its photo/initials fallback --
// is completely unchanged by this, so real photography can still replace
// the initials avatar later with no layout change.
function teamGridFor(members) {
  if (members.length === 0) {
    return `<div class="info-note text-center reveal" style="max-width:520px;margin:0 auto">Team profiles are being prepared — check back soon.</div>`;
  }
  if (members.length === 1) {
    return `<div class="team-grid team-grid--solo reveal-stagger">${teamCard(members[0])}</div>`;
  }
  if (members.length === 2) {
    return `<div class="grid grid-2 team-grid team-grid--pair reveal-stagger">${members.map(teamCard).join('')}</div>`;
  }
  return `<div class="grid grid-3 team-grid reveal-stagger">${members.map(teamCard).join('')}</div>`;
}

function team() {
  const h = data.pageHeader('team');
  const members = data.teamMembers || [];

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/team-hero-bg.jpg')}
  <section class="section-pad">
    <div class="container">
      ${members.length ? sectionHead({ eyebrow: 'Our Team', title: 'The people behind Maven’s client work' }) : ''}
      ${teamGridFor(members)}
    </div>
  </section>
  ${ctaBand({
    eyebrow: 'Work With Maven',
    title: 'Let our team support your business',
    subtitle: 'Book a free initial consultation and we will confirm exactly what your business needs.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary')],
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

function notFound() {
  return `
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow eyebrow--on-dark">Error 404</p>
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

module.exports = { team, testimonials, privacy, notFound };
