const { icon } = require('./icons');
const data = require('./data');
const { esc } = require('./escape');

function faviconDataUri() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="#102A4C"/><text x="32" y="43" font-family="Georgia,serif" font-size="30" font-weight="700" fill="#C79A3E" text-anchor="middle">M</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderDesktopNav(activeKey) {
  const items = data.nav.map((item) => {
    const isActive = item.key === activeKey || (item.children && item.children.some((c) => c.key === activeKey));
    if (item.children) {
      return `<li class="nav-item">
        <a class="nav-link" href="${item.href}" ${isActive ? 'aria-current="page"' : ''}>${item.label} ${icon('chevronDown', 'ic-chevron')}</a>
        <div class="dropdown">
          ${item.children.map((c) => `<a href="${c.href}">${c.label}</a>`).join('')}
        </div>
      </li>`;
    }
    return `<li class="nav-item"><a class="nav-link" href="${item.href}" ${isActive ? 'aria-current="page"' : ''}>${item.label}</a></li>`;
  }).join('');
  return `<nav class="main-nav" aria-label="Primary"><ul>${items}</ul></nav>`;
}

function renderMobileNav(activeKey) {
  const items = data.nav.map((item) => {
    const isActive = item.key === activeKey || (item.children && item.children.some((c) => c.key === activeKey));
    let sub = '';
    if (item.children) {
      sub = `<div class="mobile-sub">${item.children.map((c) => `<a href="${c.href}">${c.label}</a>`).join('')}</div>`;
    }
    return `<li><a href="${item.href}" ${isActive ? 'aria-current="page"' : ''}>${item.label}</a>${sub}</li>`;
  }).join('');
  return `<div class="mobile-nav" id="mobileNav">
    <div class="mobile-nav-top">
      <span class="brand-name" style="color:#fff">${esc(data.brand.shortName)}</span>
      <button class="mobile-nav-close" aria-label="Close menu">${icon('close')}</button>
    </div>
    <ul>${items}</ul>
    <div class="mobile-nav-cta">
      <a class="btn btn-primary" href="contact.html">Book Free Consultation</a>
      <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to ask about your services.')}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp Us</a>
    </div>
  </div>`;
}

function renderHeader(activeKey) {
  return `<div class="topbar">
    <div class="container topbar-inner">
      <div class="topbar-links">
        <span class="topbar-item">${icon('phone')} ${esc(data.brand.mobile)}</span>
        <span class="topbar-item">${icon('mail')} ${esc(data.brand.email)}</span>
        <span class="topbar-item">${icon('mapPin')} ${esc(data.brand.addressLine)}</span>
      </div>
      <a class="topbar-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to ask about your services.')}" target="_blank" rel="noopener">${icon('whatsapp')} Chat on WhatsApp</a>
    </div>
  </div>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="index.html">
        <span class="brand-mark">M</span>
        <span class="brand-text">
          <span class="brand-name">${data.brand.shortName}</span>
          <span class="brand-sub">Accounting · Tax · Compliance</span>
        </span>
      </a>
      ${renderDesktopNav(activeKey)}
      <div class="header-cta">
        <a class="btn btn-outline btn-sm" href="tel:${data.brand.mobile.replace(/[^+\d]/g, '')}">${icon('phone')} Call</a>
        <a class="btn btn-primary btn-sm" href="contact.html">Book Free Consultation</a>
      </div>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">${icon('menu')}</button>
    </div>
  </header>
  ${renderMobileNav(activeKey)}`;
}

function renderFooter() {
  const b = data.brand;
  const social = b.social || {};
  // Only show an icon when a URL is actually set (blank = hidden).
  const socialLinks = [
    { key: 'facebook', label: 'Facebook', url: social.facebook },
    { key: 'instagram', label: 'Instagram', url: social.instagram },
    { key: 'tiktok', label: 'TikTok', url: social.tiktok },
    { key: 'linkedin', label: 'LinkedIn', url: social.linkedin },
  ].filter((s) => s.url && String(s.url).trim());
  const socialHtml = socialLinks.length
    ? `<div class="footer-social">
          ${socialLinks.map((s) => `<a href="${s.url}" aria-label="${s.label}" target="_blank" rel="noopener noreferrer">${icon(s.key)}</a>`).join('')}
        </div>`
    : '';
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="brand">
          <span class="brand-mark">M</span>
          <span class="brand-text"><span class="brand-name" style="color:#fff">${esc(b.shortName)}</span></span>
        </div>
        <p>${esc(b.legalName)}. A practical consultancy and outsourced accounting/compliance partner for businesses across Nepal.</p>
        ${socialHtml}
      </div>
      <div class="footer-col">
        <h4>Quick Links</h4>
        <ul>
          ${data.footerQuickLinks.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
        </ul>
      </div>
      <div class="footer-col">
        <h4>Services</h4>
        <ul>
          <li><a href="services.html#registration">Registration & Setup</a></li>
          <li><a href="outsourced-accounting.html">Outsourced Accounting</a></li>
          <li><a href="services.html#tax">Tax & Compliance</a></li>
          <li><a href="services.html#payroll">Payroll Support</a></li>
          <li><a href="services.html#reporting">Financial Reporting</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <address>
          <span class="footer-addr-item">${icon('mapPin')}<span>${esc(b.addressLine)}</span></span>
          <span class="footer-addr-item">${icon('phone')}<span>${esc(b.mobile)}</span></span>
          <span class="footer-addr-item">${icon('mail')}<span>${esc(b.email)}</span></span>
          <span class="footer-addr-item">${icon('clock')}<span>${esc(b.hours)}</span></span>
        </address>
      </div>
    </div>
    <div class="container footer-disclaimer">
      <p>${esc(data.footerDisclaimer)}</p>
    </div>
    <div class="container footer-bottom">
      <p>© <span id="year">${b.year}</span> ${esc(b.legalName)} All rights reserved.</p>
      <p>Designed for practical, compliant business support in Nepal.</p>
    </div>
  </footer>
  <a class="whatsapp-float" href="${data.whatsappHref('Hello Maven, I would like to ask about your services.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${icon('whatsapp')}</a>
  <button class="back-to-top" aria-label="Back to top">${icon('arrowUp')}</button>`;
}

function jsonLd() {
  const b = data.brand;
  const base = siteBase();
  const social = b.social || {};
  const sameAs = ['facebook', 'instagram', 'tiktok', 'linkedin']
    .map((k) => social[k])
    .filter((u) => u && String(u).trim());
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: b.legalName,
    description: 'Accounting, tax, business registration, payroll, financial reporting, and compliance consultancy services for startups, SMEs, and growing businesses across Nepal.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kathmandu',
      addressCountry: 'NP',
      streetAddress: b.addressLine,
    },
    areaServed: 'Nepal',
    telephone: b.mobile,
    email: b.email,
  };
  if (base) obj.url = base + '/';
  if (sameAs.length) obj.sameAs = sameAs;
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

// Normalise the configured site URL (strip a trailing slash) so we can build
// clean absolute URLs for canonical + Open Graph tags. Only used when set.
function siteBase() {
  const u = (data.brand.siteUrl || '').trim();
  return u ? u.replace(/\/+$/, '') : '';
}

function renderPage({ activeKey, file, title, description, bodyHtml, css, clientJs, extraHead = '', noindex = false }) {
  const cfgScript = `<script>window.MAVEN=${JSON.stringify({
    email: data.brand.email,
    whatsapp: data.brand.whatsappDigits,
    brandName: data.brand.shortName,
    formspree: data.brand.formspreeId || '',
    calc: data.calculators,
  })};</script>`;

  const base = siteBase();
  // index.html canonicalises to the domain root, everything else to /file.
  const pageUrl = base ? (file === 'index.html' ? base + '/' : base + '/' + file) : '';
  const canonicalTag = pageUrl ? `<link rel="canonical" href="${pageUrl}">` : '';
  const ogUrlTag = pageUrl ? `<meta property="og:url" content="${pageUrl}">` : '';
  const robotsTag = noindex ? '<meta name="robots" content="noindex, nofollow">' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#102A4C">
<link rel="icon" type="image/svg+xml" href="${faviconDataUri()}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&display=swap">
${robotsTag}
${canonicalTag}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(data.brand.shortName)}">
${ogUrlTag}
<meta name="twitter:card" content="summary">
${file === 'index.html' ? jsonLd() : ''}
${extraHead}
<style>${css}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${renderHeader(activeKey)}
<main id="main">
${bodyHtml}
</main>
${renderFooter()}
${cfgScript}
<script>${clientJs}</script>
</body>
</html>`;
}

module.exports = { renderPage };
