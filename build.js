const fs = require('fs');
const path = require('path');

const data = require('./data');
const { renderPage } = require('./layout');
const { home, about } = require('./pages1');
const { services, outsourcedAccounting, globalOutsourcing, packages } = require('./pages2');
const { documentsNeeded, industries, faq, contact } = require('./pages3');
const { usefulLinks, blogIndex, blogPost } = require('./pages4');
const { calculators } = require('./pages5');
const { team, testimonials, privacy, notFound } = require('./pages6');
const { loadPosts } = require('./blog');

const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');

const outDirs = [path.join(__dirname, 'dist')];
outDirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

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
    description: 'Maven Consultancy Services Pvt. Ltd. provides accounting, tax, business registration, PAN/VAT, payroll, and compliance support for startups, SMEs, and growing businesses across Nepal.',
  },
  {
    file: 'about.html', activeKey: 'about', bodyHtml: about(),
    title: 'About Maven Consultancy | Business Consultancy in Kathmandu, Nepal',
    description: 'Maven Consultancy Services Pvt. Ltd. is a Nepal-based consultancy providing business setup, accounting, tax, compliance, and advisory services with practical, organized support.',
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
    description: 'Official Nepal government portals for tax (IRD), company registration (OCR), social security (SSF), and banking (Nepal Rastra Bank), curated by Maven Consultancy.',
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
  });
});

const generatedFiles = []; // track visible, indexable HTML files for the sitemap

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
    css,
    clientJs,
    extraHead: p.extraHead || '',
    noindex,
  });
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, p.file), html, 'utf8'));
  if (!noindex) generatedFiles.push(p.file);
  console.log('Wrote', p.file, `(${(html.length / 1024).toFixed(1)} KB)`, noindex ? '[noindex]' : '');
}

// --- 404 page ---------------------------------------------------------------
// Served by Cloudflare Workers via wrangler.jsonc "not_found_handling":"404-page".
const notFoundHtml = renderPage({
  activeKey: '', file: '404.html',
  title: 'Page Not Found | Maven Consultancy',
  description: 'The page you were looking for could not be found.',
  bodyHtml: notFound(), css, clientJs, noindex: true,
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
  const today = new Date().toISOString().slice(0, 10);
  const urls = generatedFiles.map((file) => {
    const loc = file === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${file}`;
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`;
  }).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  outDirs.forEach((d) => fs.writeFileSync(path.join(d, 'sitemap.xml'), sitemap, 'utf8'));
  console.log(`Wrote sitemap.xml (${generatedFiles.length} URLs)`);
} else {
  console.log('Skipped sitemap.xml — set brand.siteUrl in content/site.yaml to enable it.');
}

// Copy admin panel into dist so Cloudflare Workers serves it at /admin/
const adminSrc = path.join(__dirname, 'admin', 'index.html');
const adminDest = path.join(__dirname, 'dist', 'admin');
fs.mkdirSync(adminDest, { recursive: true });
fs.copyFileSync(adminSrc, path.join(adminDest, 'index.html'));
console.log('Copied admin/index.html to dist/admin/index.html');

console.log('\nDone. Files written to', outDirs.join(' and '));
