const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages2.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

// Packages is deliberately not a good/better/best pricing ladder. The three
// CMS package records are common business situations used to begin scoping.
test('Packages page is positioned as flexible engagement starting points rather than fixed tiers', () => {
  assert.match(yaml, /eyebrow: Packages & Engagements/);
  assert.match(yaml, /title: Structured Finance Support, Scoped to Your Business/);
  assert.match(pages, /Engagement Starting Points/);
  assert.match(pages, /They are not rigid tiers/);
  assert.doesNotMatch(pages, /most popular|recommended package|best value/i);
});

test('Packages hero explains how a quotation is scoped before showing the three options', () => {
  assert.match(pages, /How a quote is scoped/);
  assert.match(pages, /Pricing follows the work involved/);
  assert.match(pages, /Transaction volume/);
  assert.match(pages, /People & payroll/);
  assert.match(pages, /Accounts & entities/);
  assert.match(pages, /Record quality/);
  assert.match(pages, /Reporting needs/);
  assert.match(pages, /Timing & urgency/);
});

test('Packages page preserves all CMS-managed package names, audiences, situations, and inclusion lists', () => {
  assert.match(pages, /data\.packages\.map\(\(pkg, i\) => packageEngagement\(pkg, i\)\)/);
  assert.match(pages, /pkg\.name/);
  assert.match(pages, /pkg\.tagline/);
  assert.match(pages, /pkg\.audience/);
  assert.match(pages, /pkg\.situation/);
  assert.match(pages, /pkg\.items/);
  assert.match(pages, /Quote after review/);
});

test('Packages page makes fee drivers and separately charged items explicit', () => {
  assert.match(pages, /Scope & Fee/);
  assert.match(pages, /data\.packagesFeeNote/);
  assert.match(pages, /Government fees, penalties, official charges, and third-party professional charges/);
  assert.match(pages, /Employee count/);
  assert.match(pages, /Reporting complexity/);
  assert.match(pages, /Urgency & timing/);
});

test('Packages page explains the quotation process and responsibility boundaries before conversion', () => {
  assert.match(pages, /From Enquiry to Quote/);
  assert.match(pages, /Understand the need/);
  assert.match(pages, /Review the scope drivers/);
  assert.match(pages, /Confirm inclusions/);
  assert.match(pages, /Start with an agreed quote/);
  assert.match(pages, /what remains with your team/);
});

test('Packages page supports custom combinations instead of forcing every client into one package', () => {
  assert.match(pages, /Need a mix of services rather than a named package/);
  assert.match(pages, /Monthly accounting \+ VAT \/ TDS coordination/);
  assert.match(pages, /Monthly accounting \+ management reporting/);
  assert.match(pages, /Examples describe possible combinations only/);
  assert.match(pages, /View All Services/);
});

test('Packages SEO reflects custom quote and commercial intent without publishing fixed pricing', () => {
  assert.match(build, /Accounting Support Packages & Custom Quotes \| Maven Consultancy Nepal/);
  assert.match(build, /custom quotes based on scope, volume, records, reporting needs, and timing/);
  assert.doesNotMatch(pages, /NPR\s*[\d,]+|Rs\.?\s*[\d,]+|starting at\s+\d/i);
});

test('Packages premium layout has responsive composition and reduced-motion handling without viewport hacks', () => {
  assert.match(css, /\.packages-premium-hero/);
  assert.match(css, /\.packages-engagement \{/);
  assert.match(css, /\.packages-fee-grid/);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*?\.packages-engagement-scope ul \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.packages-engagement-link/);
  assert.doesNotMatch(css, /\.packages-[^\n{]+\{[^}]*width:\s*100vw/);
});
