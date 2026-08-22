const data = require('./data');
const { esc, safeUrl, internalHref } = require('./escape');
const { icon } = require('./icons');
const { button, sectionHead, pageHero, ctaBand } = require('./ui');

function usefulLinksCard(link) {
  return `<article class="service-card reveal" style="display:flex;flex-direction:column;">
    <div class="service-card-head">
      <span class="service-icon">${icon('external')}</span>
      <div><h2 style="margin-top:2px;font-size:1.18rem">${esc(link.name)}</h2></div>
    </div>
    <p class="service-tagline" style="flex:1">${esc(link.description)}</p>
    <a class="btn btn-outline" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">Visit Website ${icon('external')}</a>
  </article>`;
}

function usefulLinks() {
  const links = (data.usefulLinks || []);
  const h = data.pageHeader('useful-links');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/useful-links-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container" style="max-width:960px">
      <div class="info-note reveal" style="margin-bottom:32px">These are official third-party government websites — Maven doesn't operate or control them. Always double check current requirements directly on the relevant portal, or contact us and we'll help confirm what applies to your case.</div>
      <div class="grid grid-3 reveal-stagger">
        ${links.map(usefulLinksCard).join('')}
      </div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Need Help Instead?',
    title: 'Not sure which office or portal applies to you?',
    subtitle: 'We can point you in the right direction, or handle the registration and filing work for you.',
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
