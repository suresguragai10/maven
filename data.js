const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const raw = fs.readFileSync(path.join(__dirname, 'content', 'site.yaml'), 'utf8');
const content = yaml.load(raw);

const brand = Object.assign({}, content.brand, { year: new Date().getFullYear() });

const whatsappHref = (text) =>
  `https://wa.me/${brand.whatsappDigits}${text ? '?text=' + encodeURIComponent(text) : ''}`;

// --- Page visibility ---------------------------------------------------------
// content/site.yaml -> pages: [{ key, label, href, hidden }]
// Single source of truth for what appears in navigation/footer and what gets
// noindexed. The page HTML is still generated regardless (see build.js), so
// hiding a page never creates a dead link from an existing button.
const pageConfig = Array.isArray(content.pages) ? content.pages : [];
const pageByKey = {};
pageConfig.forEach((p) => { if (p && p.key) pageByKey[p.key] = p; });

function isHidden(key) {
  const p = pageByKey[key];
  return !!(p && p.hidden === true);
}
function isVisible(key) {
  return !isHidden(key);
}

// --- Navigation --------------------------------------------------------------
// Structure (grouping/dropdowns) stays in code because it maps to real page
// filenames. Visibility is driven by the CMS `pages` config. A parent with no
// visible children (and not itself a visible page) is dropped.
const navStructure = [
  { key: 'home', label: 'Home', href: 'index.html' },
  {
    key: 'about', label: 'About', href: 'about.html',
    children: [
      { key: 'about', label: 'About Maven', href: 'about.html' },
      { key: 'team', label: 'Our Team', href: 'team.html' },
      { key: 'testimonials', label: 'Testimonials', href: 'testimonials.html' },
    ],
  },
  {
    key: 'services', label: 'Services', href: 'services.html',
    children: [
      { key: 'services', label: 'All Services', href: 'services.html' },
      { key: 'outsourced-accounting', label: 'Outsourced Accounting', href: 'outsourced-accounting.html' },
      { key: 'packages', label: 'Packages', href: 'packages.html' },
    ],
  },
  { key: 'global-outsourcing', label: 'Global Outsourcing', href: 'global-outsourcing.html' },
  { key: 'industries', label: 'Industries', href: 'industries.html' },
  {
    key: 'resources', label: 'Resources', href: 'useful-links.html',
    children: [
      { key: 'documents-needed', label: 'Documents Checklist', href: 'documents-needed.html' },
      { key: 'useful-links', label: 'Useful Links', href: 'useful-links.html' },
      { key: 'calculators', label: 'Financial Calculators', href: 'calculators.html' },
      { key: 'blog', label: 'Blog', href: 'blog.html' },
    ],
  },
  { key: 'faq', label: 'FAQ', href: 'faq.html' },
  { key: 'contact', label: 'Contact', href: 'contact.html' },
];

function labelFor(key, fallback) {
  const p = pageByKey[key];
  return (p && p.label) ? p.label : fallback;
}

function buildNav() {
  const out = [];
  navStructure.forEach((item) => {
    if (item.children) {
      const kids = item.children.filter((c) => isVisible(c.key)).map((c) => ({
        key: c.key, href: c.href, label: labelFor(c.key, c.label),
      }));
      if (kids.length === 0) return;
      const parentHref = kids.some((k) => k.href === item.href) ? item.href : kids[0].href;
      out.push({ key: item.key, label: item.label, href: parentHref, children: kids });
    } else {
      if (!isVisible(item.key)) return;
      out.push({ key: item.key, href: item.href, label: labelFor(item.key, item.label) });
    }
  });
  return out;
}

const nav = buildNav();

const footerQuickOrder = [
  'about', 'services', 'global-outsourcing', 'packages', 'documents-needed',
  'useful-links', 'calculators', 'team', 'testimonials', 'blog', 'faq', 'privacy',
];
const footerQuickLinks = footerQuickOrder
  .filter((key) => isVisible(key))
  .map((key) => {
    const p = pageByKey[key] || {};
    return { key, href: p.href || (key + '.html'), label: p.label || key };
  });

const pageHeaders = content.pageHeaders || {};
function pageHeader(key, fallback) {
  fallback = fallback || {};
  const h = pageHeaders[key] || {};
  return {
    eyebrow: h.eyebrow != null ? h.eyebrow : (fallback.eyebrow || ''),
    title: h.title != null ? h.title : (fallback.title || ''),
    subtitle: h.subtitle != null ? h.subtitle : (fallback.subtitle || ''),
  };
}

const teamMembers = (content.teamMembers || []).filter((m) => m && m.hidden !== true);
const testimonials = (content.testimonials || []).filter((t) => t && t.hidden !== true);

module.exports = {
  brand,
  whatsappHref,
  nav,
  footerQuickLinks,
  isHidden,
  isVisible,
  pageHeader,
  pageHeaders,
  seo: content.seo || {},
  teamMembers,
  testimonials,
  privacyIntro: content.privacyIntro || '',
  privacySections: content.privacySections || [],
  trustPoints: content.trustPoints,
  aboutText: content.aboutText,
  aboutFacts: content.aboutFacts,
  aboutClosing: content.aboutClosing,
  values: content.values,
  serviceCategories: content.serviceCategories,
  partnerNote: content.partnerNote,
  outsourced: content.outsourced,
  globalOutsourcing: content.globalOutsourcing,
  packages: content.packages,
  packagesFeeNote: content.packagesFeeNote,
  documentsTopNote: content.documentsTopNote,
  documentGroups: content.documentGroups,
  documentsBottomNote: content.documentsBottomNote,
  industries: content.industries,
  usefulLinks: content.usefulLinks || [],
  whyChoose: content.whyChoose,
  process: content.process,
  faqs: content.faqs,
  footerDisclaimer: content.footerDisclaimer,
  serviceOptions: content.serviceOptions,
  businessTypeOptions: content.businessTypeOptions,
  calculators: content.calculators || {},
};
