const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { internalHref } = require('./escape');

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
//
// "Home" is intentionally not a nav item — the logo already links there (see
// layout.js renderHeader), and a separate "Home" link was redundant.
//
// Anchor-only children (registration/tax/payroll/reporting/advisory) point at
// sections of services.html rather than standalone pages, so there's no
// content/site.yaml `pages` entry for them to look up visibility from. Their
// `visibilityKey: 'services'` tells buildNav() to check the *parent* page's
// visibility instead of their own (nonexistent) key.
const navStructure = [
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
      { key: 'registration', label: 'Business Registration & Setup', href: 'services.html#registration', visibilityKey: 'services' },
      { key: 'outsourced-accounting', label: 'Outsourced Accounting & Bookkeeping', href: 'outsourced-accounting.html' },
      { key: 'tax', label: 'Tax & Compliance Support', href: 'services.html#tax', visibilityKey: 'services' },
      { key: 'payroll', label: 'Payroll & Salary Support', href: 'services.html#payroll', visibilityKey: 'services' },
      { key: 'reporting', label: 'Financial Management & Reporting', href: 'services.html#reporting', visibilityKey: 'services' },
      { key: 'advisory', label: 'Business Advisory', href: 'services.html#advisory', visibilityKey: 'services' },
      { key: 'nfrs-ifrs', label: 'NFRS / IFRS Implementation', href: 'nfrs-ifrs.html' },
      { key: 'packages', label: 'Packages', href: 'packages.html' },
    ],
  },
  { key: 'industries', label: 'Industries', href: 'industries.html' },
  {
    key: 'global-outsourcing', label: 'International', href: 'global-outsourcing.html',
    children: [
      { key: 'global-outsourcing', label: 'International Services', href: 'global-outsourcing.html' },
      { key: 'international-accounting', label: 'Outsourced Accounting & Bookkeeping', href: 'international-accounting.html' },
      { key: 'virtual-cfo', label: 'Virtual CFO & Management Reporting', href: 'virtual-cfo.html' },
    ],
  },
  {
    key: 'resources', label: 'Resources', href: 'resources.html',
    children: [
      { key: 'resources', label: 'Resources Overview', href: 'resources.html' },
      { key: 'documents-needed', label: 'Documents Checklist', href: 'documents-needed.html' },
      { key: 'calculators', label: 'Financial Calculators', href: 'calculators.html' },
      { key: 'useful-links', label: 'Useful Links', href: 'useful-links.html' },
      { key: 'faq', label: 'FAQ', href: 'faq.html' },
      { key: 'blog', label: 'Blog', href: 'blog.html' },
    ],
  },
  { key: 'contact', label: 'Contact', href: 'contact.html' },
];

// Nav labels come from navStructure itself, not from content.pages[].label.
// The admin panel's "Hide / Show Pages" list displays that CMS label as
// read-only text (no input field), so it was never actually user-editable —
// letting it silently override the nav's own wording only produced label
// collisions (e.g. a "Resources" parent opening to a child also called
// "Resources", instead of "Resources Overview") with no compensating benefit.
function buildNav() {
  const out = [];
  navStructure.forEach((item) => {
    const itemHref = internalHref(item.href);
    if (item.children) {
      const kids = item.children.filter((c) => isVisible(c.visibilityKey || c.key)).map((c) => ({
        key: c.key, href: internalHref(c.href), label: c.label,
      }));
      if (kids.length === 0) return;
      const parentHref = kids.some((k) => k.href === itemHref) ? itemHref : kids[0].href;
      out.push({ key: item.key, label: item.label, href: parentHref, children: kids });
    } else {
      if (!isVisible(item.key)) return;
      out.push({ key: item.key, href: itemHref, label: item.label });
    }
  });
  return out;
}

const nav = buildNav();

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
  isHidden,
  isVisible,
  pageHeader,
  pageHeaders,
  seo: content.seo || {},
  teamMembers,
  testimonials,
  privacyIntro: content.privacyIntro || '',
  privacySections: content.privacySections || [],
  privacyLastReviewed: content.privacyLastReviewed || '',
  trustPoints: content.trustPoints,
  aboutText: content.aboutText,
  aboutFacts: content.aboutFacts,
  aboutClosing: content.aboutClosing,
  values: content.values,
  serviceCategories: content.serviceCategories,
  partnerNote: content.partnerNote,
  outsourced: content.outsourced,
  nfrsIfrs: content.nfrsIfrs,
  internationalHub: content.internationalHub,
  internationalAccounting: content.internationalAccounting,
  virtualCfo: content.virtualCfo,
  resourcesHub: content.resourcesHub,
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
