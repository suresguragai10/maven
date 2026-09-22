const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages2.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('Services page uses the premium three-chapter finance architecture', () => {
  assert.match(pages, /id: 'establish-and-comply'/);
  assert.match(pages, /id: 'run-your-finance-function'/);
  assert.match(pages, /id: 'advise-and-report-better'/);
  assert.match(pages, /categories: \[registration, tax, payroll\]/);
  assert.match(pages, /categories: \[bookkeeping, reporting\]/);
  assert.match(pages, /categories: \[advisory, nfrsIfrs\]/);
});

test('Services page keeps specialist and international continuation paths', () => {
  assert.match(pages, /bookkeeping: \{ href: 'outsourced-accounting\.html'/);
  assert.match(pages, /'nfrs-ifrs': \{ href: 'nfrs-ifrs\.html'/);
  assert.match(pages, /international-accounting\.html/);
  assert.match(pages, /virtual-cfo\.html/);
  assert.match(pages, /global-outsourcing\.html/);
});

test('Services hero uses the same responsive image tiers as the build preload strategy', () => {
  assert.match(css, /services-hero-bg-640w\.jpg/);
  assert.match(css, /services-hero-bg-960w\.jpg/);
  assert.match(css, /services-hero-bg\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.services-hero/);
});

test('Services page has dedicated mobile composition and no horizontal-width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.services-hero-actions/);
  assert.match(css, /\.services-detail-scope ul \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /\.services-[^\n{]+\{[^}]*width:\s*100vw/);
});

test('Services positioning and SEO reflect finance, tax, accounting, advisory and international delivery', () => {
  assert.match(yaml, /eyebrow: Finance · Tax · Accounting · Advisory/);
  assert.match(yaml, /title: Connected finance support from setup to reporting/);
  assert.match(yaml, /remote finance delivery/);
  assert.match(build, /Finance, Tax, Accounting & Advisory Services \| Maven Consultancy Nepal/);
  assert.match(build, /remote international finance delivery/);
});
