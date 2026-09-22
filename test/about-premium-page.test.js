const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages1.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('About page is positioned as a Kathmandu finance and accounting firm profile', () => {
  assert.match(yaml, /title: A focused finance and accounting partner from Kathmandu/);
  assert.match(yaml, /structured remote finance delivery for international teams/);
  assert.match(build, /About Maven Consultancy \| Finance & Accounting Team in Kathmandu/);
});

test('About page explains identity, connected scope and working standards', () => {
  assert.match(pages, /Who We Are/);
  assert.match(pages, /Setup, tax & compliance/);
  assert.match(pages, /Accounting operations/);
  assert.match(pages, /Reporting & outsourced finance/);
  assert.match(pages, /Professional standards should be visible in the day-to-day work/);
  assert.match(pages, /Engagement Discipline/);
});

test('About page makes confidentiality, internal review and team credibility visible', () => {
  assert.match(pages, /Review before delivery/);
  assert.match(pages, /Confidentiality is part of the working model/);
  assert.match(pages, /People Behind the Work/);
  assert.match(pages, /data\.teamMembers/);
  assert.match(pages, /privacy\.html/);
});

test('About page distinguishes Nepal delivery from remote international support', () => {
  assert.match(pages, /Kathmandu Base/);
  assert.match(pages, /International Delivery/);
  assert.match(pages, /New Baneshwor, Kathmandu/);
  assert.match(pages, /global-outsourcing\.html/);
  assert.doesNotMatch(pages, /global offices|overseas office|24\/7|guaranteed/i);
});

test('About hero uses responsive image tiers aligned with preload strategy', () => {
  assert.match(css, /about-hero-bg-640w\.jpg/);
  assert.match(css, /about-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.about-hero-premium/);
  assert.match(build, /file: 'about\.html'[\s\S]*?heroImage: '\/images\/about-hero-bg\.jpg'/);
});

test('About page has dedicated mobile composition and reduced-motion handling', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.about-hero-actions/);
  assert.match(css, /\.about-control-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.about-team-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\.about-[^\n{]+\{[^}]*width:\s*100vw/);
});
