const { icon } = require('./icons');
const data = require('./data');
const { esc, safeUrl, internalHref } = require('./escape');

// Handbook Task 25: the chevron used to live INSIDE .nav-link, so the same
// element both navigated immediately (its href) and was the only visual
// dropdown affordance — ambiguous on a touch device, where a tap has no way
// to "just peek" at the submenu before committing to navigation. Split into
// two elements: .nav-link still navigates straight to the section's own
// page (its "clear Overview destination" is unchanged), and a dedicated
// .nav-dropdown-toggle button (real aria-expanded/aria-controls, same
// pattern the mobile submenu button already used) explicitly opens/closes
// the dropdown via client.js — with click-outside/Escape handling and one
// dropdown open at a time. Hover/:focus-within stays as a CSS-only
// enhancement for fine-pointer devices (see styles.css's `(hover: hover)`
// guard) — never the only way in.
function renderDesktopNav(activeKey) {
  const items = data.nav.map((item) => {
    const exactActive = item.key === activeKey;
    const sectionActive = exactActive || (item.children && item.children.some((c) => c.key === activeKey));
    if (item.children) {
      const dropdownId = `dropdown-${item.key}`;
      return `<li class="nav-item">
        <a class="nav-link${sectionActive ? ' is-section-active' : ''}" href="${item.href}" ${exactActive ? 'aria-current="page"' : ''}>${item.label}</a>
        <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="${dropdownId}" aria-label="Show ${esc(item.label)} menu">${icon('chevronDown', 'ic-chevron')}</button>
        <div class="dropdown" id="${dropdownId}">
          ${item.children.map((c) => `<a href="${c.href}" ${c.key === activeKey ? 'aria-current="page"' : ''}>${c.label}</a>`).join('')}
        </div>
      </li>`;
    }
    return `<li class="nav-item"><a class="nav-link" href="${item.href}" ${exactActive ? 'aria-current="page"' : ''}>${item.label}</a></li>`;
  }).join('');
  return `<nav class="main-nav" aria-label="Primary"><ul>${items}</ul></nav>`;
}

// Each dropdown gets its own expand/collapse button (not just a parent link
// doing double duty) so a keyboard/screen-reader user gets a real toggle
// with aria-expanded/aria-controls — and so the menu doesn't dump every
// child of every dropdown into one long flat scroll on open. Submenus start
// collapsed; the parent link itself still navigates to that section's
// overview page as before.
function renderMobileNav(activeKey) {
  const items = data.nav.map((item) => {
    const exactActive = item.key === activeKey;
    const sectionActive = exactActive || (item.children && item.children.some((c) => c.key === activeKey));
    if (item.children) {
      const subId = `mobile-sub-${item.key}`;
      // Handbook Task 25: submenus always start collapsed, and inert
      // (removed by client.js on open) keeps their links out of Tab
      // order while visually hidden — previously they were fully
      // focusable even at max-height:0, so a keyboard user tabbing
      // through a closed mobile menu would stop on invisible links.
      const sub = `<div class="mobile-sub" id="${subId}" style="max-height:0" inert>${item.children.map((c) => `<a href="${c.href}" ${c.key === activeKey ? 'aria-current="page"' : ''}>${c.label}</a>`).join('')}</div>`;
      return `<li>
        <div class="mobile-nav-row">
          <a class="${sectionActive ? 'is-section-active' : ''}" href="${item.href}" ${exactActive ? 'aria-current="page"' : ''}>${item.label}</a>
          <button type="button" class="mobile-sub-toggle" aria-expanded="false" aria-controls="${subId}" aria-label="Show ${esc(item.label)} submenu">${icon('chevronDown', 'ic-chevron')}</button>
        </div>
        ${sub}
      </li>`;
    }
    return `<li><a href="${item.href}" ${exactActive ? 'aria-current="page"' : ''}>${item.label}</a></li>`;
  }).join('');
  return `<nav class="mobile-nav" id="mobileNav" aria-label="Mobile">
    <div class="mobile-nav-top">
      <span class="brand-name" style="color:#fff">${esc(data.brand.shortName)}</span>
      <button type="button" class="icon-btn mobile-nav-close" aria-label="Close menu">${icon('close')}</button>
    </div>
    <ul>${items}</ul>
    <div class="mobile-nav-cta">
      <a class="btn btn-primary" href="${internalHref('contact.html')}">Book Free Consultation</a>
      <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to ask about your services.')}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp Us</a>
    </div>
  </nav>`;
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
    <div class="container-wide header-inner">
      <a class="brand" href="${internalHref('index.html')}">
        <img class="brand-mark" src="/images/logo-icon.png" alt="" width="40" height="40">
        <span class="brand-text">
          <span class="brand-name">${data.brand.shortName}</span>
          <span class="brand-sub">Accounting · Tax · Compliance</span>
        </span>
      </a>
      ${renderDesktopNav(activeKey)}
      <div class="header-cta">
        <a class="btn btn-primary btn-sm" href="${internalHref('contact.html')}">Book Free Consultation</a>
      </div>
      <button type="button" class="icon-btn nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">${icon('menu')}</button>
    </div>
  </header>
  ${renderMobileNav(activeKey)}`;
}

// Footer nav columns are hand-curated (not derived from navStructure) because
// the footer intentionally exposes a different cut of the site than the
// header — e.g. individual Services anchors and a dedicated Contact info
// block that isn't part of the main nav at all. `hidden` pages (Testimonials,
// Blog until each has real content) are left out via data.isVisible().
function footerCol(title, links) {
  return `<div class="footer-col">
    <h2>${esc(title)}</h2>
    <ul>${links.map((l) => `<li><a href="${internalHref(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>
  </div>`;
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
          ${socialLinks.map((s) => `<a href="${esc(safeUrl(s.url))}" aria-label="${esc(s.label)}" target="_blank" rel="noopener noreferrer">${icon(s.key)}</a>`).join('')}
        </div>`
    : '';

  // Task 09: every one of these destinations is already fully reachable via
  // the header's own dropdowns (see navStructure in data.js) -- Services'
  // dropdown alone already lists all 7 individual service anchors plus
  // every dedicated service page, and Resources'/International's dropdowns
  // already mirror what used to be duplicated here in full. The footer no
  // longer tries to be a second complete sitemap; it keeps company
  // identity, essential contact, the small set of genuinely major routes,
  // and the legal/resource links a visitor specifically expects to find in
  // a footer (privacy policy chief among them) -- roughly 12-14 total
  // links, not ~19. Nothing here is unreachable elsewhere: it's all still
  // in the header nav and/or linked from within the relevant hub pages
  // (services.html, resources.html, global-outsourcing.html).
  const companyLinks = [
    { href: 'about.html', label: 'About Maven' },
    { href: 'team.html', label: 'Our Team' },
    { href: 'industries.html', label: 'Industries' },
    { href: 'contact.html', label: 'Contact' },
  ];
  const servicesLinks = [
    { href: 'services.html', label: 'All Services' },
    { href: 'outsourced-accounting.html', label: 'Outsourced Accounting — Nepal' },
    { href: 'nfrs-ifrs.html', label: 'NFRS / IFRS Implementation' },
    { href: 'packages.html', label: 'Packages' },
  ];
  const internationalLinks = [
    { href: 'global-outsourcing.html', label: 'International Services' },
    { href: 'international-accounting.html', label: 'International Accounting' },
    { href: 'virtual-cfo.html', label: 'Virtual CFO / Management Reporting' },
  ];
  const resourceLinks = [
    { href: 'resources.html', label: 'Resources' },
    { href: 'documents-needed.html', label: 'Documents Checklist' },
    { href: 'faq.html', label: 'FAQ' },
    { href: 'privacy.html', label: 'Privacy Policy' },
    { href: 'terms.html', label: 'Terms of Service' },
  ];

  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="brand">
          <img class="brand-mark" src="/images/logo-icon.png" alt="" width="40" height="40" loading="lazy">
          <span class="brand-text"><span class="brand-name" style="color:#fff">${esc(b.shortName)}</span></span>
        </div>
        <p>${esc(b.legalName)} A practical consultancy and outsourced accounting/compliance partner for businesses across Nepal.</p>
        ${socialHtml}
        <address class="footer-address">
          <span class="footer-addr-item">${icon('mapPin')}<span>${esc(b.addressLine)}</span></span>
          <span class="footer-addr-item">${icon('phone')}<span>${esc(b.mobile)}</span></span>
          <span class="footer-addr-item">${icon('mail')}<span>${esc(b.email)}</span></span>
          <span class="footer-addr-item">${icon('clock')}<span>${esc(b.hours)}</span></span>
        </address>
      </div>
      <nav class="footer-links" aria-label="Footer">
        ${footerCol('Company', companyLinks)}
        ${footerCol('Services', servicesLinks)}
        ${footerCol('International', internationalLinks)}
        ${footerCol('Resources & Legal', resourceLinks)}
      </nav>
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
  <button type="button" class="icon-btn back-to-top" aria-label="Back to top">${icon('arrowUp')}</button>
  <div class="cookie-notice" id="cookie-notice" role="region" aria-label="Cookie notice">
    <p>This site uses a few essential third-party services (Google Fonts, our contact form, and the map on our Contact page). See our <a href="${internalHref('privacy.html')}">Privacy Policy</a> for details.</p>
    <button type="button" class="btn btn-primary btn-sm" id="cookie-notice-accept">Got it</button>
  </div>`;
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
    // AccountingService is a more specific schema.org subtype than the
    // generic ProfessionalService — matches what Maven actually offers
    // (bookkeeping/tax/compliance, not statutory audit).
    '@type': 'AccountingService',
    name: b.legalName,
    // A specific legal name + founding year + Nepal address together are
    // real, verifiable disambiguating facts -- "Maven" alone is a common
    // word other, unrelated organizations also use; this ties search
    // engines' understanding of the entity to the one concrete Nepal
    // business those facts actually describe, not a generic label.
    description: 'Accounting, tax, business registration, payroll, financial management and reporting, and compliance consultancy services for startups, SMEs, and growing businesses across Nepal.',
    // Task 13: streetAddress now also carries addressNote (the real
    // landmark shown on the actual Contact page, e.g. "Eyeplex Mall") —
    // it was previously only in addressLine, so structured data was less
    // complete than the visible page. Both fields are the same
    // CMS-editable brand data used everywhere else; nothing invented.
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kathmandu',
      addressCountry: 'NP',
      streetAddress: [b.addressNote, b.addressLine].filter((v) => v && String(v).trim()).join(', '),
    },
    areaServed: 'Nepal',
    telephone: b.mobile,
    email: b.email,
    ...(b.foundedYear ? { foundingDate: String(b.foundedYear) } : {}),
    // Matches brand.hours ("Sunday – Friday · 10:00 AM – 5:00 PM (Saturday
    // closed)") — this is hand-written, not parsed from that free-text field,
    // so if hours ever change via the admin panel, update this too.
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '10:00',
      closes: '17:00',
    },
  };
  // Task 13: a stable @id ties every page's AccountingService block to the
  // same one entity (a "#organization" fragment is a common, standard
  // convention -- it need not resolve to a real fetchable resource), so
  // Google/other consumers can recognize this as one coherent business
  // across the whole site instead of independent per-page graphs.
  if (base) { obj['@id'] = base + '/#organization'; obj.url = base + '/'; obj.image = base + '/images/og-image.png'; }
  if (sameAs.length) obj.sameAs = sameAs;
  // Service-level schema for the real 7 service categories, using only
  // their already-published title/tagline (same source Services and the
  // homepage capability chapters already render) -- nothing invented, no
  // pricing/Offer availability claims, just a structured list of what
  // AccountingService actually covers.
  if ((data.serviceCategories || []).length) {
    obj.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Accounting, Tax, and Compliance Services',
      itemListElement: data.serviceCategories.map((c) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: c.title, description: c.tagline },
      })),
    };
  }
  // Every value here ultimately traces back to admin-entered CMS text (brand
  // name, address, social URLs). A value containing "</script>" would close
  // this tag early and let anything after it run as HTML/script — escaping
  // "<" as a JSON unicode escape (valid inside a JSON string, invisible to
  // JSON.parse) neutralizes that without touching the visible content.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

// Normalise the configured site URL (strip a trailing slash) so we can build
// clean absolute URLs for canonical + Open Graph tags. Only used when set.
function siteBase() {
  const u = (data.brand.siteUrl || '').trim();
  return u ? u.replace(/\/+$/, '') : '';
}

// Task 15: BreadcrumbList structured data must match visible content
// exactly -- breadcrumbNav() (the visible trail) and breadcrumbJsonLd()
// (the matching schema) are both built from the same `items` array passed
// in by the caller, so there is no way for one to drift from the other.
// Only wired up for pages that are genuinely nested under a hub in the
// real nav hierarchy (see navStructure in data.js) -- top-level pages
// don't get one, since "Home > About" adds no real navigation/hierarchy
// value there. Each item is { label, href }; the last item is the current
// page (rendered as plain text, not a self-link, but still included with
// its own href in the JSON-LD, which is standard BreadcrumbList practice).
function breadcrumbNav(items) {
  if (!items || !items.length) return '';
  const lis = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const inner = isLast
      ? `<span aria-current="page">${esc(item.label)}</span>`
      : `<a href="${internalHref(item.href)}">${esc(item.label)}</a>`;
    return `<li${isLast ? ' class="is-current"' : ''}>${inner}</li>`;
  }).join('');
  return `<nav class="breadcrumb-nav" aria-label="Breadcrumb"><div class="container"><ol>${lis}</ol></div></nav>`;
}

function breadcrumbJsonLd(items) {
  const base = siteBase();
  if (!items || !items.length || !base) return '';
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: base + internalHref(item.href),
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

// Cloudflare Web Analytics beacon — only emitted once brand.cloudflareAnalyticsToken
// is set (via the admin panel), so nothing loads until it's actually configured.
function analyticsScript() {
  const token = (data.brand.cloudflareAnalyticsToken || '').trim();
  if (!token) return '';
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>`;
}

// Task 19: Google Search Console's HTML-tag verification method. This value
// is NOT a secret -- Google's own docs say it's designed to sit in public
// page source (view-source already shows it to anyone) -- it only proves
// "whoever can edit this site's HTML owns it," it grants no access to
// anything on its own. Still owner-configured via the CMS rather than
// hardcoded, same pattern as cloudflareAnalyticsToken above, so it's never
// baked into the repo for a domain this codebase doesn't actually run on.
// DNS TXT verification (done entirely at the DNS provider, no code
// involved) is the preferred method -- see docs/SEARCH_CONSOLE_CHECKLIST.md
// -- this tag exists as the safe fallback when DNS access isn't available.
function googleSiteVerificationTag() {
  const token = (data.brand.googleSiteVerification || '').trim();
  if (!token) return '';
  return `<meta name="google-site-verification" content="${esc(token)}">`;
}

function renderPage({ activeKey, file, title, description, bodyHtml, cssFile, jsFile, extraHead = '', noindex = false, breadcrumbs = null, heroImage = null }) {
  const base = siteBase();
  // Canonicalises to the extensionless path Cloudflare actually serves (it
  // redirects *.html -> extensionless by default) — index.html -> "/",
  // everything else -> "/file" — so the canonical URL never points at a
  // page that immediately redirects elsewhere.
  const pageUrl = base ? base + internalHref(file) : '';
  const canonicalTag = pageUrl ? `<link rel="canonical" href="${pageUrl}">` : '';
  const ogUrlTag = pageUrl ? `<meta property="og:url" content="${pageUrl}">` : '';
  const robotsTag = noindex ? '<meta name="robots" content="noindex, nofollow">' : '';
  // Task 18: measured (Playwright + CDP, throttled mobile) that every page's
  // hero background photo is the actual LCP element -- Home via the
  // external stylesheet's .hero rule, sub-pages via pageHero()'s <style>
  // block. Neither is discoverable by the browser as "high priority" by
  // default the way a plain <img fetchpriority=high> would be, so a
  // same-URL preload hint closes that gap without moving the image out of
  // CSS (which works and isn't being changed). Only emitted when the
  // caller actually knows this page's hero image (see heroImage in each
  // build.js pages[] entry). Three media-scoped links, not one, matching
  // the same 640w/960w/original tiers and 768px/1280px breakpoints the CSS
  // itself swaps on (.hero in styles.css, .page-hero--photo in ui.js's
  // pageHero()) -- a single unconditional preload of the full-resolution
  // file would defeat the point of the responsive images by always
  // fetching the largest variant regardless of viewport.
  const heroPreloadTag = heroImage ? [
    { media: '(max-width: 767px)', href: heroImage.replace(/\.jpg$/, '-640w.jpg') },
    { media: '(min-width: 768px) and (max-width: 1279px)', href: heroImage.replace(/\.jpg$/, '-960w.jpg') },
    { media: '(min-width: 1280px)', href: heroImage },
  ].map((v) => `<link rel="preload" as="image" href="${esc(v.href)}" media="${v.media}" fetchpriority="high">`).join('\n') : '';
  // Social share preview image — only emitted once a site URL is set, since
  // og:image/twitter:image need a real absolute URL to be fetchable.
  const ogImageUrl = base ? `${base}/images/og-image.png` : '';
  const ogImageTags = ogImageUrl ? `
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="${ogImageUrl}">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#102A4C">
<link rel="icon" type="image/png" href="/images/logo-icon.png">
${heroPreloadTag}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&display=swap">
${robotsTag}
${canonicalTag}
${googleSiteVerificationTag()}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(data.brand.shortName)}">
${ogUrlTag}${ogImageTags}
<meta name="twitter:card" content="${ogImageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${jsonLd()}
${breadcrumbJsonLd(breadcrumbs)}
${extraHead}
<link rel="stylesheet" href="/${cssFile}">
${analyticsScript()}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${renderHeader(activeKey)}
<main id="main">
${breadcrumbNav(breadcrumbs)}
${bodyHtml}
</main>
${renderFooter()}
<script src="/${jsFile}" defer></script>
</body>
</html>`;
}

module.exports = { renderPage };
