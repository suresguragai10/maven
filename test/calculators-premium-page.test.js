const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages5.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

// The page is a planning tool, not a substitute for filing or professional judgement.
test('Calculators page is positioned as a premium planning desk with clear professional boundaries', () => {
  assert.match(yaml, /eyebrow: Finance Tools/);
  assert.match(yaml, /title: Financial Calculators for Practical Planning/);
  assert.match(pages, /Calculation Desk/);
  assert.match(pages, /A result is not the same as a filing position, tax opinion, or lending decision/);
  assert.match(pages, /Estimate, then verify/);
  assert.match(pages, /do not constitute tax, legal, audit, investment, lending, or other regulated financial advice/);
});

test('Calculators hero exposes all four existing calculator tools without adding new engines', () => {
  assert.match(pages, /Salary Income Tax/);
  assert.match(pages, /VAT/);
  assert.match(pages, /TDS/);
  assert.match(pages, /Loan EMI/);
  assert.match(pages, /incomeTaxPanel\(\)/);
  assert.match(pages, /vatPanel\(\)/);
  assert.match(pages, /tdsPanel\(\)/);
  assert.match(pages, /emiPanel\(\)/);
});

test('Existing calculator DOM hooks and accessible tab pattern are preserved', () => {
  for (const id of [
    'calc-tab-tax', 'calc-tab-vat', 'calc-tab-tds', 'calc-tab-emi',
    'tax-monthly-salary', 'tax-out-annual', 'vat-amount', 'vat-total',
    'tds-type', 'tds-tax', 'emi-amount', 'emi-monthly', 'emi-toggle-sched',
  ]) assert.match(pages, new RegExp(`id=["']${id}["']`));
  assert.match(pages, /role="tablist"/);
  assert.match(pages, /aria-selected="true"/);
  assert.match(pages, /role="tabpanel"/);
  assert.match(client, /ArrowRight/);
  assert.match(client, /ArrowLeft/);
});

test('Income tax opens on the latest configured fiscal-year table while keeping older tables selectable', () => {
  assert.match(pages, /const activeFyIndex = Math\.max\(0, fyCount - 1\)/);
  assert.match(pages, /i === activeFyIndex/);
  assert.match(client, /_calc\.taxTables\[_calc\.taxTables\.length - 1\]/);
  assert.match(client, /latestTaxTable \? latestTaxTable\.key/);
  assert.match(yaml, /- key: '2082'/);
  assert.match(yaml, /- key: '2083'/);
});

test('Statutory notes avoid stale Finance Act 2082 positioning and keep rate accuracy owner-governed', () => {
  assert.match(yaml, /Common configured withholding rates for typical payment categories/);
  assert.match(yaml, /recipient status, VAT\/PAN status, payment nature, thresholds, exemptions, and current/);
  assert.match(yaml, /latest configured fiscal-year schedule is selected by default/);
  assert.match(yaml, /confirm the current statutory treatment before filing/);
  assert.doesNotMatch(yaml, /tdsNote: >-\n    Common rates under the Income Tax Act 2058 \/ Finance Act 2082/);
});

test('Calculator page explains tool-specific scope and a safe estimate-to-confirm workflow', () => {
  assert.match(pages, /What each calculator can — and cannot — tell you/);
  assert.match(pages, /Useful for/);
  assert.match(pages, /Does not determine/);
  assert.match(pages, /Choose the right period/);
  assert.match(pages, /Enter the actual facts/);
  assert.match(pages, /Read the breakdown/);
  assert.match(pages, /Confirm before acting/);
});

test('Calculator SEO uses durable planning language instead of hard-coded statutory rates', () => {
  assert.match(build, /Financial Calculators Nepal \| Income Tax, VAT, TDS & EMI \| Maven Consultancy/);
  assert.match(build, /transparent assumptions, breakdowns and clear estimate-only guidance/);
  assert.doesNotMatch(build, /description: 'Free online calculators for Nepal:.*13% VAT/);
});

test('Premium calculator layout is responsive and keeps reduced-motion handling without viewport hacks', () => {
  assert.match(pages, /\.calculators-premium-hero/);
  assert.match(pages, /calculators-hero-bg-640w\.jpg/);
  assert.match(pages, /calculators-hero-bg-960w\.jpg/);
  assert.match(pages, /@media\(max-width:720px\)/);
  assert.match(pages, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(pages, /\.calculators-[^\n{]+\{[^}]*width:\s*100vw/);
});
