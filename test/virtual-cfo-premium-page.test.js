const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages7.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('Virtual CFO page is positioned as a management-finance layer for Nepal and international teams', () => {
  assert.match(yaml, /eyebrow: Virtual CFO & Management Reporting/);
  assert.match(yaml, /Management reporting, cash-flow forecasting and finance planning for growing businesses in Nepal and international teams/);
  assert.match(build, /Virtual CFO and management reporting from Kathmandu/);
});

test('Virtual CFO page separates management reporting from recurring bookkeeping', () => {
  assert.match(pages, /From Accounting to Finance Insight/);
  assert.match(pages, /Move up the finance stack only when the business needs it/);
  assert.match(pages, /international-accounting\.html/);
  assert.match(pages, /Start with Remote Accounting Support/);
});

test('Virtual CFO page exposes management pack, finance cycle and detailed support scope', () => {
  assert.match(pages, /Management Information That Connects/);
  assert.match(pages, /Performance view/);
  assert.match(pages, /Budget & variance/);
  assert.match(pages, /Cash & working capital/);
  assert.match(pages, /The Management Cycle/);
  assert.match(pages, /vcfo-area-/);
  assert.match(pages, /supportAreas/);
});

test('Virtual CFO page keeps decision responsibility and regulated-advice boundaries explicit', () => {
  assert.match(pages, /Management remains responsible for business decisions/);
  assert.match(pages, /does not provide investment advice or make decisions on behalf of the business/);
  assert.match(yaml, /not\s+investment,\s+lending\s+or\s+regulated\s+financial\s+advice/);
  assert.doesNotMatch(pages, /guaranteed growth|guaranteed savings|24\/7|overseas office|global office network/i);
});

test('Virtual CFO hero uses responsive reporting image tiers aligned with preload strategy', () => {
  assert.match(css, /card-reporting-640w\.jpg/);
  assert.match(css, /card-reporting-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.vcfo-hero/);
  assert.match(build, /file: 'virtual-cfo\.html'[\s\S]*?heroImage: '\/images\/card-reporting\.jpg'/);
});

test('Virtual CFO page has dedicated mobile composition and no viewport-width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.vcfo-hero-actions/);
  assert.match(css, /\.vcfo-cycle-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.vcfo-pack-grid \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /\.vcfo-[^\n{]+\{[^}]*width:\s*100vw/);
});
