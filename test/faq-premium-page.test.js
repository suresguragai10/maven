const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages3.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');

test('FAQ page is positioned as a pre-engagement question desk rather than a single accordion list', () => {
  assert.match(yaml, /eyebrow: Client Questions/);
  assert.match(yaml, /title: Answers Before You Engage Maven/);
  assert.match(pages, /Question Desk/);
  assert.match(pages, /Browse Questions by Topic/);
  assert.match(pages, /Find the Right Starting Point/);
});

test('FAQ page preserves the existing CMS-managed question and answer dataset', () => {
  assert.match(pages, /const questionCount = data\.faqs\.length/);
  assert.match(pages, /const allFaqEntries = data\.faqs\.map\(\(item, faqIndex\)/);
  assert.match(pages, /headingHtml: esc\(item\.q\)/);
  assert.match(pages, /bodyHtml: `<p>\$\{esc\(item\.a\)\}<\/p>`/);
});

test('FAQ questions are grouped into four practical topics while keeping future CMS additions visible', () => {
  assert.match(pages, /Services & Scope/);
  assert.match(pages, /Coverage & Setup/);
  assert.match(pages, /Fees & Confidentiality/);
  assert.match(pages, /Reporting & Advisory/);
  assert.match(pages, /const allFaqEntries = data\.faqs\.map/);
  assert.match(pages, /entries: allFaqEntries\.filter/);
  assert.match(pages, /return 'services-scope';/);
  assert.doesNotMatch(pages, /indexes: \[/);
});

test('FAQ accordions retain stable ids and accessible section-level heading hierarchy', () => {
  assert.match(pages, /id: `faq-\$\{faqIndex\}`/);
  assert.match(pages, /headingLevel: 'h3'/);
  assert.match(pages, /<section class="faq-category-section" id="faq-\$\{cat\.id\}">/);
  assert.match(pages, /<h2>\$\{esc\(cat\.label\)\}<\/h2>/);
});

test('FAQ page makes professional boundaries and case-specific review explicit', () => {
  assert.match(pages, /General website answers are informative starting points/);
  assert.match(pages, /audit, legal, certification, investment or other regulated work/);
  assert.match(pages, /Rates, deadlines, filing obligations, reporting treatment, legal requirements and professional opinions/);
  assert.match(pages, /confirm the position that applies to your case/);
});

test('FAQ page provides deeper paths into services, international delivery, documents, and contact', () => {
  assert.match(pages, /View Services/);
  assert.match(pages, /Global Outsourcing/);
  assert.match(pages, /Documents Checklist/);
  assert.match(pages, /Start a Detailed Inquiry/);
});

test('FAQ SEO and CMS guidance reflect the new grouped help-center presentation', () => {
  assert.match(build, /Accounting, Tax & Finance FAQ \| Maven Consultancy Nepal/);
  assert.match(build, /pricing, confidentiality, Nepal service coverage, reporting support, and professional boundaries/);
  assert.match(admin, /public FAQ page automatically groups these same entries into fixed topic sections/);
});

test('FAQ premium layout has responsive and reduced-motion treatment without viewport hacks', () => {
  assert.match(pages, /faq-hero-bg-640w\.jpg/);
  assert.match(pages, /faq-hero-bg-960w\.jpg/);
  assert.match(css, /\.faq-premium-hero/);
  assert.match(css, /\.faq-library-layout/);
  assert.match(css, /\.faq-related-grid/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.faq-[^\n{]+\{[^}]*width:\s*100vw/);
});
