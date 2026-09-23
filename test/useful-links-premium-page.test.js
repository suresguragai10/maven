const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages4.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');

test('Useful Links keeps the approved CMS-managed external source list intact', () => {
  assert.match(pages, /const links = \(data\.usefulLinks \|\| \[\]\)/);
  assert.match(pages, /links\.map\(usefulLinksCard\)/);
  assert.match(pages, /safeUrl\(link\.url\)/);
  assert.match(yaml, /name: Inland Revenue Department \(IRD\)/);
  assert.match(yaml, /name: Office of the Company Registrar \(OCR\)/);
  assert.match(yaml, /name: Social Security Fund \(SSF\)/);
  assert.match(yaml, /name: Nepal Rastra Bank \(NRB\)/);
  assert.match(yaml, /name: Institute of Chartered Accountants of Nepal \(ICAN\)/);
  assert.match(yaml, /name: Department of Industry \(DOI\)/);
  assert.match(yaml, /name: Nepal Government National Portal/);
});

test('Useful Links hero is a dedicated premium reference desk with responsive photography', () => {
  assert.match(pages, /useful-links-premium-hero/);
  assert.match(pages, /useful-links-hero-bg-640w\.jpg/);
  assert.match(pages, /useful-links-hero-bg-960w\.jpg/);
  assert.match(pages, /Reference Desk/);
  assert.match(pages, /Browse Official References/);
  assert.match(pages, /Back to Resource Hub/);
});

test('Useful Links makes the third-party boundary explicit near the primary interaction', () => {
  assert.match(pages, /Maven does not operate or control these external websites/);
  assert.match(pages, /Availability, content and requirements can change/);
  assert.match(pages, /External-source notice/);
  assert.match(pages, /Always double check current requirements directly on the relevant portal/);
});

test('Useful Links directory uses accessible external links and semantic card headings', () => {
  assert.match(pages, /<h3>\$\{esc\(link\.name\)\}<\/h3>/);
  assert.match(pages, /target="_blank" rel="noopener noreferrer"/);
  assert.match(pages, /opens in a new tab/);
  assert.match(pages, /Official external reference/);
  const cardFn = pages.split('function relatedResourceCard')[0];
  assert.doesNotMatch(cardFn, /<article class="service-card/);
});

test('Useful Links provides a four-step verify-before-acting workflow', () => {
  assert.match(pages, /Before You Rely on a Portal/);
  assert.match(pages, /Open the original source/);
  assert.match(pages, /Check the current context/);
  assert.match(pages, /Match it to your situation/);
  assert.match(pages, /Get confirmation where needed/);
});

test('Useful Links connects back to the three complementary resource-hub tasks', () => {
  assert.match(pages, /Documents Checklist/);
  assert.match(pages, /Financial Calculators/);
  assert.match(pages, /Frequently Asked Questions/);
  assert.match(pages, /documents-needed\.html/);
  assert.match(pages, /calculators\.html/);
  assert.match(pages, /faq\.html/);
});

test('Useful Links retains the existing Website Admin editor and has page-specific SEO', () => {
  assert.match(admin, /Official government portals shown on the Useful Links page/);
  assert.match(admin, /usefulLinksEditor\(c\.usefulLinks\)/);
  assert.match(build, /Official Nepal Finance & Compliance Links \| Maven Consultancy/);
  assert.match(build, /Official and institutional Nepal reference links/);
});

test('Useful Links has dedicated responsive and reduced-motion styles without viewport-width hacks', () => {
  assert.match(css, /\.useful-links-premium-hero/);
  assert.match(css, /\.useful-links-directory-grid \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*?\.useful-links-directory-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.useful-link-card/);
  assert.doesNotMatch(css, /\.useful-links-[^\n{]+\{[^}]*width:\s*100vw/);
});
