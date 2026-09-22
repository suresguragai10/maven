const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages3.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'ui.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');

test('Industries page is positioned around the business model rather than a generic sector list', () => {
  assert.match(yaml, /eyebrow: Industries & Business Models/);
  assert.match(yaml, /title: Finance Support Built Around Your Business Model/);
  assert.match(pages, /Start with the operating model, not an accounting template/);
  assert.match(pages, /Why Industry Context Matters/);
});

test('Industries page preserves all real profiles and gives each one finance-attention and Maven-support detail', () => {
  assert.match(pages, /data\.industries\.length/);
  assert.match(pages, /data\.industries\.map\(industryCard\)/);
  assert.match(pages, /data\.industries\.map\(industryDetail\)/);
  assert.match(ui, /Finance attention/);
  assert.match(ui, /What typically needs attention/);
  assert.match(ui, /Maven support/);
  assert.match(ui, /Where Maven can help/);
});

test('Industries explorer keeps deep-link, keyboard and master-detail hooks intact', () => {
  assert.match(ui, /id="\$\{id\}" aria-expanded="false" aria-controls="detail-\$\{id\}" data-industry-index="\$\{i\}"/);
  assert.match(ui, /data-industry-detail="\$\{i\}" hidden/);
  assert.match(client, /location\.hash\.indexOf\('#industry-'\)/);
  assert.match(client, /scrollElementIntoView\(target, 'start'\)/);
  assert.match(css, /\.industry-detail-placeholder\[hidden\], \.industry-detail-panel\[hidden\] \{ display: none !important; \}/);
});

test('Industries page makes consistent finance discipline and professional boundaries visible', () => {
  assert.match(pages, /The industry changes\. The finance discipline stays consistent/);
  assert.match(pages, /Organized source records/);
  assert.match(pages, /Consistent reconciliation/);
  assert.match(pages, /Defined responsibility/);
  assert.match(pages, /Useful management visibility/);
  assert.match(pages, /Professional boundaries remain the same in every industry/);
  assert.match(pages, /appropriately authorized independent professionals/);
});

test('Industries hero uses responsive image tiers aligned with preload strategy and updated SEO', () => {
  assert.match(css, /industries-hero-bg-640w\.jpg/);
  assert.match(css, /industries-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*?\.industries-hero-premium/);
  assert.match(build, /file: 'industries\.html'[\s\S]*?Industry-Specific Accounting & Finance Support/);
  assert.match(build, /heroImage: '\/images\/industries-hero-bg\.jpg'/);
});

test('Industries page has dedicated mobile composition and no width hacks', () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.industries-hero-actions/);
  assert.match(css, /\.industries-context-factors \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.industries-standards-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.industry-detail-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.industries-[^\n{]+\{[^}]*width:\s*100vw/);
});
