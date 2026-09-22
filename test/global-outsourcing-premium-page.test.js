const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages2.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('Global outsourcing hub owns the approved Nepal-to-global positioning', () => {
  assert.match(yaml, /eyebrow: Global Finance Delivery/);
  assert.match(yaml, /title: Finance & Accounting Outsourcing from Nepal/);
  assert.match(yaml, /Kathmandu-based team providing remote bookkeeping/);
  assert.match(build, /Finance & Accounting Outsourcing from Nepal \| Maven Consultancy/);
});

test('Global hub clearly separates the two international support levels', () => {
  assert.match(pages, /Remote Accounting Support/);
  assert.match(pages, /Virtual CFO &amp; Management Reporting/);
  assert.match(pages, /international-accounting\.html/);
  assert.match(pages, /virtual-cfo\.html/);
  assert.match(pages, /knowledge-process \(KPO\) layer/);
});

test('Global hub keeps international guardrails explicit', () => {
  assert.match(pages, /Kathmandu-based delivery/);
  assert.match(pages, /Controlled access/);
  assert.match(pages, /Defined professional scope/);
  assert.match(pages, /Jurisdiction-specific tax filing, statutory audit, legal opinions and other regulated services remain with appropriately authorized professionals/);
  assert.doesNotMatch(pages, /24\/7|overseas office|global office network/i);
});

test('Global hub supports accounting firms and a controlled starting scope', () => {
  assert.match(pages, /Support for Accounting Firms/);
  assert.match(pages, /Back-office finance capacity/);
  assert.match(pages, /Start With a Controlled Scope/);
  assert.match(pages, /Good first engagement examples/);
});

test('Global hero uses responsive image tiers matching preload strategy', () => {
  assert.match(css, /global-outsourcing-hero-bg-640w\.jpg/);
  assert.match(css, /global-outsourcing-hero-bg-960w\.jpg/);
  assert.match(css, /global-outsourcing-hero-bg\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.global-hub-hero/);
});

test('Global hub includes dedicated mobile composition without viewport-width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.global-hub-hero-actions/);
  assert.match(css, /\.global-support-track-list \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /\.global-[^\n{]+\{[^}]*width:\s*100vw/);
});
