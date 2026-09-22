const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages7.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('International Accounting page is positioned as operational remote accounting support', () => {
  assert.match(yaml, /eyebrow: Remote Accounting Support/);
  assert.match(yaml, /title: Reliable remote accounting for international teams/);
  assert.match(yaml, /Bookkeeping, reconciliations, month-end and reporting support from Kathmandu/);
  assert.match(build, /International Bookkeeping & Reconciliation Services \| Maven Consultancy/);
});

test('International Accounting page separates service scope, monthly workflow and onboarding', () => {
  assert.match(pages, /What You Can Hand Off/);
  assert.match(pages, /The Monthly Delivery Rhythm/);
  assert.match(pages, /How the Relationship Starts/);
  assert.match(pages, /Client accounting system/);
  assert.match(pages, /Queries & exceptions/);
  assert.match(pages, /Run the first accounting cycle/);
});

test('International Accounting page supports businesses and accounting firms without blurring responsibility', () => {
  assert.match(pages, /International Businesses/);
  assert.match(pages, /Accounting & Bookkeeping Firms/);
  assert.match(pages, /Clear professional responsibility/);
  assert.match(pages, /scopeBoundary/);
  assert.match(pages, /firmSupport/);
  assert.doesNotMatch(pages, /24\/7|overseas office|global office network/i);
});

test('International Accounting page exposes systems, confidentiality and a controlled starting scope', () => {
  assert.match(pages, /Systems, Access & Confidentiality/);
  assert.match(pages, /Confidential information handling/);
  assert.match(pages, /Start With a Defined Scope/);
  assert.match(pages, /Good first engagement examples/);
  assert.match(pages, /virtual-cfo\.html/);
  assert.match(pages, /global-outsourcing\.html/);
});

test('International Accounting hero uses responsive image tiers matching preload strategy', () => {
  assert.match(css, /global-outsourcing-hero-bg-640w\.jpg/);
  assert.match(css, /global-outsourcing-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.intl-accounting-hero/);
});

test('International Accounting page has dedicated mobile composition and no viewport-width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.intl-accounting-hero-actions/);
  assert.match(css, /\.intl-accounting-monthly-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.intl-accounting-start-items \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /\.intl-accounting-[^\n{]+\{[^}]*width:\s*100vw/);
});
