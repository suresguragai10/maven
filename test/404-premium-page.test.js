const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages6.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');

function notFoundFunctionSource() {
  const start = pages.indexOf('function notFound()');
  const end = pages.indexOf('\nmodule.exports', start);
  return pages.slice(start, end);
}

test('404 keeps a single clear page-not-found heading and branded error marker', () => {
  const source = notFoundFunctionSource();
  assert.match(source, /eyebrowOnDark\('Error 404'\)/);
  assert.match(source, /<h1>Page not found<\/h1>/);
  assert.match(source, /class="not-found-premium-number" aria-hidden="true">404<\/div>/);
});

test('404 preserves the established homepage recovery action required by navigation smoke tests', () => {
  const source = notFoundFunctionSource();
  assert.match(source, /button\('Go to Homepage', 'index\.html', 'primary'\)/);
  assert.match(source, /button\('Contact Maven', 'contact\.html', 'ghost-light'\)/);
});

test('404 offers only established public recovery destinations and does not expose hidden Blog', () => {
  const source = notFoundFunctionSource();
  for (const href of ['services.html', 'resources.html', 'faq.html', 'contact.html']) {
    assert.match(source, new RegExp(`href: '${href.replace('.', '\\.')}'`));
  }
  assert.doesNotMatch(source, /blog\.html|Blog/);
  assert.match(yaml, /key: blog[\s\S]*?hidden: true/);
});

test('404 recovery navigation uses escaped labels and normalized internal links', () => {
  const source = notFoundFunctionSource();
  assert.match(source, /href="\$\{internalHref\(item\.href\)\}"/);
  assert.match(source, /<strong>\$\{esc\(item\.label\)\}<\/strong>/);
  assert.match(source, /<small>\$\{esc\(item\.detail\)\}<\/small>/);
  assert.match(source, /aria-label="Useful destinations after a page-not-found error"/);
});

test('404 removes old inline presentation styles in favor of scoped page classes', () => {
  const source = notFoundFunctionSource();
  assert.doesNotMatch(source, /style=/);
  assert.match(source, /class="not-found-premium"/);
  assert.match(source, /class="not-found-premium-panel reveal"/);
  assert.match(source, /class="section-pad not-found-premium-help"/);
});

test('404 build contract remains noindex and uses the dedicated 404 output file', () => {
  assert.match(build, /activeKey: '', file: '404\.html'/);
  assert.match(build, /title: 'Page Not Found \| Maven Consultancy'/);
  assert.match(build, /bodyHtml: notFound\(\), cssFile, jsFile, noindex: true/);
  assert.match(build, /writeFileSync\(path\.join\(d, '404\.html'\), notFoundHtml/);
});

test('Cloudflare still serves the generated 404 page for unknown routes', () => {
  assert.match(wrangler, /"not_found_handling"\s*:\s*"404-page"/);
});

test('404 has dedicated responsive and reduced-motion styles without viewport-width hacks', () => {
  assert.match(css, /\.not-found-premium-grid \{[\s\S]*?grid-template-columns: minmax\(0,1\.04fr\) minmax\(360px,\.74fr\)/);
  assert.match(css, /@media \(max-width:960px\)[\s\S]*?\.not-found-premium-grid \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*?\.not-found-premium-actions \{ display: grid; grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.not-found-premium-nav a/);
  assert.doesNotMatch(css, /\.not-found-premium[^\n{]*\{[^}]*width:\s*100vw/);
});
