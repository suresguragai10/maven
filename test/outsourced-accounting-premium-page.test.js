const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages2.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');

test('Outsourced Accounting page stays explicitly Nepal-domestic and finance-operations focused', () => {
  assert.match(yaml, /eyebrow: Outsourced Accounting · Nepal/);
  assert.match(yaml, /title: Outsourced Accounting for Growing Businesses in Nepal/);
  assert.match(yaml, /dependable finance function without building a full in-house team/);
  assert.match(build, /Outsourced Accounting Services in Nepal \| Maven Consultancy/);
  assert.match(build, /growing Nepal businesses that need an outsourced finance function/);
  assert.doesNotMatch(pages, /global offices|overseas office|24\/7|guaranteed/i);
});

test('Outsourced Accounting hero presents a clear monthly operating model', () => {
  assert.match(pages, /Monthly finance operating model/);
  assert.match(pages, /Source records/);
  assert.match(pages, /Record & reconcile/);
  assert.match(pages, /Review & resolve/);
  assert.match(pages, /Track & report/);
  assert.match(pages, /See the Monthly Scope/);
});

test('Outsourced Accounting page explains when the model fits and keeps in-house trade-offs credible', () => {
  assert.match(pages, /When Outsourcing Makes Sense/);
  assert.match(pages, /Outsourcing is not the right answer for every finance role/);
  assert.match(pages, /continuous on-site control/);
  assert.match(pages, /high-volume daily approvals/);
  assert.doesNotMatch(yaml, /Lower cost than full-time accounting staff/);
});

test('Outsourced Accounting page defines recurring monthly scope and cycle', () => {
  assert.match(pages, /Monthly Finance Scope/);
  assert.match(pages, /Bookkeeping & ledgers/);
  assert.match(pages, /Reconciliations & schedules/);
  assert.match(pages, /VAT \/ TDS & tax coordination/);
  assert.match(pages, /A Repeatable Monthly Cycle/);
  assert.match(pages, /Collect & organize/);
  assert.match(pages, /Report & follow through/);
  assert.match(pages, /\(o\.benefits \|\| \[\]\)\.map/);
});

test('Outsourced Accounting page makes confidentiality, review and responsibility boundaries visible', () => {
  assert.match(pages, /Controls, Handoffs & Responsibility/);
  assert.match(pages, /Sensitive banking, payroll, tax or identity documents should not be sent through website chat/);
  assert.match(pages, /Review before reporting/);
  assert.match(pages, /Management keeps business responsibility/);
  assert.match(pages, /Statutory audit, legal opinions and other regulated work remain with appropriately authorized professionals/);
});

test('Outsourced Accounting page has an intentional growth path and editable FAQs', () => {
  assert.match(pages, /Built to Grow With the Business/);
  assert.match(pages, /Core monthly books/);
  assert.match(pages, /Management reporting/);
  assert.match(pages, /Planning & Virtual CFO/);
  assert.match(pages, /outsourced-faq-/);
  assert.match(yaml, /How is outsourced accounting different from hiring an in-house accountant\?/);
  assert.match(admin, /Outsourced Accounting FAQ/);
  assert.match(admin, /Page FAQs/);
});

test('Outsourced Accounting hero uses responsive image tiers aligned with preload strategy', () => {
  assert.match(css, /outsourced-accounting-hero-bg-640w\.jpg/);
  assert.match(css, /outsourced-accounting-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.outsourced-nepal-hero/);
  assert.match(build, /file: 'outsourced-accounting\.html'[\s\S]*?heroImage: '\/images\/outsourced-accounting-hero-bg\.jpg'/);
});

test('Outsourced Accounting page has dedicated mobile composition and reduced-motion handling', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.outsourced-nepal-hero-actions/);
  assert.match(css, /\.outsourced-scope-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.outsourced-benefits-grid \{ grid-template-columns: 1fr; gap: 10px; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.outsourced-[^\n{]+\{[^}]*width:\s*100vw/);
});
