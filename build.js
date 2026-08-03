const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const data = require('./data');
const { internalHref } = require('./escape');
const { renderPage } = require('./layout');
const { home, about } = require('./pages1');
const { services, outsourcedAccounting, globalOutsourcing, packages } = require('./pages2');
const { documentsNeeded, industries, faq, contact } = require('./pages3');
const { usefulLinks, blogIndex, blogPost } = require('./pages4');
const { calculators } = require('./pages5');
const { team, testimonials, privacy, notFound } = require('./pages6');
const { loadPosts } = require('./blog');

const outDirs = [path.join(__dirname, 'dist')];
outDirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

// --- Shared CSS/JS: written once as content-hashed static files, linked from
// every page instead of inlined. Inlining meant every single page re-shipped
// the same ~58KB of CSS+JS with zero browser caching across navigation; a
// hashed filename lets these be cached forever (see _headers below) while
// still auto-busting whenever the content actually changes.
function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);
}

// Written under assets/ (not the dist root) so _headers can cache-bust-proof
// them with one simple "/assets/*" wildcard rule instead of a fragile
// mid-filename glob.
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const cssFile = `assets/styles.${contentHash(css)}.css`;

// window.MAVEN config is identical on every page (built from data.brand /
// data.calculators, not page-specific), so it's prepended into the shared
// bundle once here instead of as a per-page inline <script> — that also
// means script-src no longer needs 'unsafe-inline' in the CSP (see below).
const cfgJs = `window.MAVEN=${JSON.stringify({
  email: data.brand.email,
  whatsapp: data.brand.whatsappDigits,
  brandName: data.brand.shortName,
  formspree: data.brand.formspreeId || '',
  calc: data.calculators,
})};`;
// tax-calc.js and calc-utils.js come first so their globals (TaxCalc,
// CalcUtils) exist before client.js runs — see each file's header comment.
// Both are also unit-tested directly as Node modules (test/).
const taxCalcJs = fs.readFileSync(path.join(__dirname, 'tax-calc.js'), 'utf8');
const calcUtilsJs = fs.readFileSync(path.join(__dirname, 'calc-utils.js'), 'utf8');
const clientJs = [cfgJs, taxCalcJs, calcUtilsJs, fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')].join('\n');
const jsFile = `assets/client.${contentHash(clientJs)}.js`;

outDirs.forEach((d) => {
  fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(d, cssFile), css, 'utf8');
  fs.writeFileSync(path.join(d, jsFile), clientJs, 'utf8');
});
console.log('Wrote', cssFile, `(${(css.length / 1024).toFixed(1)} KB)`);
console.log('Wrote', jsFile, `(${(clientJs.length / 1024).toFixed(1)} KB)`);

function faqJsonLd() {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

const pages = [
  {
    file: 'index.html', activeKey: 'home', bodyHtml: home(),
    title: `${data.brand.legalName} | Accounting, Tax & Compliance Services in Nepal`,
    description: 'Maven Consultancy Services Pvt. Ltd. provides accounting, tax, registration, PAN/VAT, payroll, and compliance support for startups and SMEs across Nepal.',
  },
  {
    file: 'about.html', activeKey: 'about', bodyHtml: about(),
    title: 'About Maven Consultancy | Business Consultancy in Kathmandu, Nepal',
    description: 'Maven Consultancy Services Pvt. Ltd. is a Nepal-based consultancy providing business setup, accounting, tax, compliance, and advisory services.',
  },
  {
    file: 'services.html', activeKey: 'services', bodyHtml: services(),
    title: 'Accounting, Tax, Registration & Compliance Services in Nepal | Maven Consultancy',
    description: 'Business registration, PAN/VAT registration, bookkeeping, tax and compliance support, payroll, financial reporting, and business advisory services in Nepal.',
  },
  {
    file: 'outsourced-accounting.html', activeKey: 'outsourced-accounting', bodyHtml: outsourcedAccounting(),
    title: 'Outsourced Accounting Services in Nepal | Maven Consultancy',
    description: 'Outsourced bookkeeping, tax, payroll, and compliance support for growing businesses in Nepal — a practical alternative to hiring a full-time accountant.',
  },
  {
    file: 'global-outsourcing.html', activeKey: 'global-outsourcing', bodyHtml: globalOutsourcing(),
    title: 'Global Outsourcing — Remote Bookkeeping for International Businesses | Maven Consultancy',
    description: 'Maven provides remote bookkeeping, reconciliation, and financial reporting support for businesses and accounting firms abroad, from a Kathmandu-based team.',
  },
  {
    file: 'packages.html', activeKey: 'packages', bodyHtml: packages(),
    title: 'Accounting & Compliance Packages | Maven Consultancy Nepal',
    description: 'Startup Setup, Monthly Compliance, and Business Growth packages for accounting, tax, and compliance support in Nepal. Custom quotes after a short review.',
  },
  {
    file: 'documents-needed.html', activeKey: 'documents-needed', bodyHtml: documentsNeeded(),
    title: 'Document Checklist for Registration, PAN/VAT & Accounting | Maven Consultancy',
    description: 'General document checklists for company registration, PAN/VAT registration, monthly accounting, tax clearance, and project reports in Nepal.',
  },
  {
    file: 'industries.html', activeKey: 'industries', bodyHtml: industries(),
    title: 'Industries We Serve Across Nepal | Maven Consultancy',
    description: 'Maven supports startups, SMEs, traders, restaurants, service companies, construction, online businesses, freelancers, schools, NGOs, and more across Nepal.',
  },
  {
    file: 'useful-links.html', activeKey: 'useful-links', bodyHtml: usefulLinks(),
    title: 'Useful Links — Nepal Government Portals | Maven Consultancy',
    description: 'Official Nepal government portals for tax (IRD), company registration (OCR), social security (SSF), and banking (NRB) — curated by Maven Consultancy.',
  },
  {
    file: 'calculators.html', activeKey: 'calculators', bodyHtml: calculators(),
    title: 'Free Financial Calculators — EMI, Salary Tax & VAT Nepal | Maven Consultancy',
    description: 'Free online calculators for Nepal: loan EMI calculator, salary income tax calculator with FY 2082/83 and 2083/84 slabs, and 13% VAT calculator.',
  },
  {
    file: 'faq.html', activeKey: 'faq', bodyHtml: faq(), extraHead: faqJsonLd(),
    title: 'Frequently Asked Questions | Maven Consultancy Services',
    description: 'Answers about Maven Consultancy Services Pvt. Ltd. — accounting, tax, compliance, pricing, coverage across Nepal, and data confidentiality.',
  },
  {
    file: 'contact.html', activeKey: 'contact', bodyHtml: contact(),
    title: 'Contact Maven Consultancy | New Baneshwor, Kathmandu, Nepal',
    description: 'Contact Maven Consultancy Services Pvt. Ltd. in New Baneshwor, Kathmandu for accounting, tax, registration, and compliance support across Nepal.',
  },
  {
    file: 'team.html', activeKey: 'team', bodyHtml: team(),
    title: 'Our Team | Maven Consultancy Services Nepal',
    description: 'Meet the team behind Maven Consultancy Services Pvt. Ltd. — practical accounting, tax, and compliance support for businesses across Nepal.',
  },
  {
    file: 'testimonials.html', activeKey: 'testimonials', bodyHtml: testimonials(),
    title: 'Client Testimonials | Maven Consultancy Services Nepal',
    description: 'Feedback from businesses supported by Maven Consultancy Services Pvt. Ltd. across Nepal.',
  },
  {
    file: 'privacy.html', activeKey: 'privacy', bodyHtml: privacy(),
    title: 'Privacy Policy | Maven Consultancy Services Nepal',
    description: 'How Maven Consultancy Services Pvt. Ltd. collects, uses, and protects the information you share through this website.',
  },
];

// --- Blog: always built; visibility (nav link + noindex) controlled by CMS ---
// The blog index + posts share activeKey 'blog'. When the Blog page is hidden in
// content/site.yaml, it stays out of navigation and is marked noindex below.
const posts = loadPosts();
const seenSlugs = new Map();
posts.forEach((post) => {
  if (seenSlugs.has(post.slug)) {
    throw new Error(`Duplicate blog slug "${post.slug}" — posts "${seenSlugs.get(post.slug)}" and "${post.title}" both build to ${post.file}. Rename one file or set a distinct "slug:" in its frontmatter.`);
  }
  seenSlugs.set(post.slug, post.title);
});
pages.push({
  file: 'blog.html', activeKey: 'blog', bodyHtml: blogIndex(posts),
  title: 'Blog | Maven Consultancy',
  description: 'Practical notes on accounting, tax, and compliance for businesses in Nepal, from Maven Consultancy Services Pvt. Ltd.',
});
posts.forEach((post) => {
  pages.push({
    file: post.file, activeKey: 'blog', bodyHtml: blogPost(post),
    title: `${post.title} | Maven Consultancy Blog`,
    description: post.excerpt || post.title,
    date: post.date, // used for a more accurate sitemap <lastmod> below
  });
});

const today = new Date().toISOString().slice(0, 10);
const generatedFiles = []; // track visible, indexable pages (+ lastmod) for the sitemap

// Per-page SEO overrides from the CMS (content/site.yaml -> seo).
// If a title/description is set there, it wins; otherwise the built-in
// default defined in the `pages` array above is used. Blog posts use
// their own title/excerpt and are not overridden here.
const seoOverrides = data.brand && data.brand.seo ? data.brand.seo : (data.seo || {});

for (const p of pages) {
  // A page is noindexed when its page key is hidden in the CMS.
  const noindex = data.isHidden(p.activeKey);
  const ov = seoOverrides[p.file] || {};
  const seoTitle = (ov.title && String(ov.title).trim()) ? String(ov.title).trim() : p.title;
  const seoDesc = (ov.description && String(ov.description).trim()) ? String(ov.description).trim() : p.description;
  const html = renderPage({
    activeKey: p.activeKey,
    file: p.file,
    title: seoTitle,
    description: seoDesc,
    bodyHtml: p.bodyHtml,
    cssFile,
    jsFile,
    extraHead: p.extraHead || '',
    noindex,
  });
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, p.file), html, 'utf8'));
  // Blog posts have a real publish date to use as <lastmod>; everything else
  // falls back to today's build date, since we don't track per-page content history.
  if (!noindex) generatedFiles.push({ file: p.file, lastmod: p.date || today });
  console.log('Wrote', p.file, `(${(html.length / 1024).toFixed(1)} KB)`, noindex ? '[noindex]' : '');
}

// --- 404 page ---------------------------------------------------------------
// Served by Cloudflare Workers via wrangler.jsonc "not_found_handling":"404-page".
const notFoundHtml = renderPage({
  activeKey: '', file: '404.html',
  title: 'Page Not Found | Maven Consultancy',
  description: 'The page you were looking for could not be found.',
  bodyHtml: notFound(), cssFile, jsFile, noindex: true,
});
outDirs.forEach((d) => fs.writeFileSync(path.join(d, '404.html'), notFoundHtml, 'utf8'));
console.log('Wrote 404.html [noindex]');

// --- robots.txt -------------------------------------------------------------
const siteUrl = (data.brand.siteUrl || '').trim().replace(/\/+$/, '');
const robots = siteUrl
  ? `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
  : `User-agent: *\nAllow: /\nDisallow: /admin/\n`;
outDirs.forEach((d) => fs.writeFileSync(path.join(d, 'robots.txt'), robots, 'utf8'));
console.log('Wrote robots.txt');

// --- sitemap.xml (only when a site URL is configured) -----------------------
if (siteUrl) {
  const urls = generatedFiles.map(({ file, lastmod }) => {
    // Extensionless — matches what Cloudflare actually serves (it redirects
    // *.html -> extensionless by default), same reasoning as canonical URLs.
    const loc = `${siteUrl}${internalHref(file)}`;
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  }).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, 'sitemap.xml'), sitemap, 'utf8'));
  console.log(`Wrote sitemap.xml (${generatedFiles.length} URLs)`);
} else {
  console.log('Skipped sitemap.xml — set brand.siteUrl in content/site.yaml to enable it.');
}

// --- _headers ----------------------------------------------------------------
// Cloudflare Workers static assets reads this file the same way Cloudflare
// Pages does. CSP is scoped to what this site actually loads: Google Fonts,
// the Google Maps embed on the Contact page, Formspree form submission, and
// admin-entered team-photo URLs (which can point anywhere over https).
// Cloudflare Web Analytics is enabled (manual snippet, see layout.js head) —
// static.cloudflareinsights.com is allow-listed below for its script + beacon.
// script-src has no 'unsafe-inline': CSS/JS are external files (cssFile/
// jsFile) now, not inlined, so no inline <script> exists to require it.
// style-src still needs 'unsafe-inline' — the codebase uses inline style="..."
// attributes throughout, which is a separate, much larger cleanup.
const csp = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://formspree.io https://cloudflareinsights.com",
  "frame-src https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://formspree.io",
  "frame-ancestors 'self'",
].join('; ');
const headers = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: ${csp}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=604800
`;
outDirs.forEach((d) => fs.writeFileSync(path.join(d, '_headers'), headers, 'utf8'));
console.log('Wrote _headers');

// Copy static assets (e.g. images/og-image.png) into dist/ verbatim.
const imagesSrc = path.join(__dirname, 'images');
if (fs.existsSync(imagesSrc)) {
  const imagesDest = path.join(__dirname, 'dist', 'images');
  fs.mkdirSync(imagesDest, { recursive: true });
  for (const file of fs.readdirSync(imagesSrc)) {
    fs.copyFileSync(path.join(imagesSrc, file), path.join(imagesDest, file));
  }
  console.log('Copied images/ to dist/images/');
}

// Copy admin panel into dist so Cloudflare Workers serves it at /admin/
const adminSrc = path.join(__dirname, 'admin', 'index.html');
const adminDest = path.join(__dirname, 'dist', 'admin');
fs.mkdirSync(adminDest, { recursive: true });
fs.copyFileSync(adminSrc, path.join(adminDest, 'index.html'));
console.log('Copied admin/index.html to dist/admin/index.html');

console.log('\nDone. Files written to', outDirs.join(' and '));
