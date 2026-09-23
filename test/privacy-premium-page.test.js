const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages6.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');

function privacyFunctionSource() {
  const start = pages.indexOf('function privacy()');
  const end = pages.indexOf('\nfunction terms()', start);
  return pages.slice(start, end);
}

test('Privacy Policy remains driven by the existing CMS-managed intro, sections and reviewed date', () => {
  assert.match(pages, /const policySections = data\.privacySections \|\| \[\]/);
  assert.match(pages, /data\.privacyIntro/);
  assert.match(pages, /data\.privacyLastReviewed/);
  assert.match(admin, /Privacy Policy/);
  assert.match(admin, /c\.privacySections/);
  assert.match(admin, /c\.privacyIntro/);
  assert.match(admin, /c\.privacyLastReviewed/);
});

test('Privacy Policy keeps the existing legal copy in content rather than hard-coding provider disclosures into the renderer', () => {
  assert.match(yaml, /Contact form submissions are delivered to us through Formspree/);
  assert.match(yaml, /website live chat is\s+provided through Tawk\.to/);
  assert.match(yaml, /Please do not send financial\s+records, identification documents, banking information, payroll files/);
  assert.doesNotMatch(privacyFunctionSource(), /Formspree|Tawk\.to|banking information|record-keeping obligations/);
});

test('Privacy Policy keeps its photographic legal hero and Privacy-specific document structure', () => {
  assert.match(privacyFunctionSource(), /pageHero\(h\.eyebrow, h\.title, h\.subtitle, '\/images\/privacy-hero-bg\.jpg'\)/);
  assert.match(privacyFunctionSource(), /class="container privacy-document-layout"/);
  assert.doesNotMatch(privacyFunctionSource(), /terms-document-/);
});

test('Privacy Policy adds a navigable document index generated from the same section titles', () => {
  assert.match(pages, /function privacySectionId\(title, index\)/);
  assert.match(privacyFunctionSource(), /aria-label="Privacy Policy sections"/);
  assert.match(privacyFunctionSource(), /policySections\.map\(\(s, index\) => `<li><a href="#\$\{privacySectionId\(s\.title, index\)\}"/);
  assert.match(privacyFunctionSource(), /id="\$\{privacySectionId\(s\.title, index\)\}"/);
});

test('Privacy Policy renders every CMS section heading and body without paraphrasing', () => {
  assert.match(privacyFunctionSource(), /<h2>\$\{esc\(s\.title\)\}<\/h2>/);
  assert.match(privacyFunctionSource(), /<p>\$\{esc\(s\.text\)\}<\/p>/);
  assert.match(privacyFunctionSource(), /<p>\$\{esc\(data\.privacyIntro\)\}<\/p>/);
});

test('Privacy Policy keeps review metadata explicit and owner-controlled', () => {
  assert.match(privacyFunctionSource(), /<span>Last reviewed<\/span><strong>\$\{esc\(data\.privacyLastReviewed\)\}<\/strong>/);
  assert.doesNotMatch(privacyFunctionSource(), /new Date\(|Date\.now\(/);
  assert.match(admin, /Update this only when you actually re-read and confirm the policy/);
});

test('Privacy Policy retains its contact path and established page metadata', () => {
  assert.match(privacyFunctionSource(), /Want to know how we handle your information\?/);
  assert.match(privacyFunctionSource(), /button\('Contact Maven', 'contact\.html', 'primary'\)/);
  assert.match(build, /Privacy Policy \| Maven Consultancy Services Nepal/);
  assert.match(build, /collects, uses, and protects the information you share through this website/);
});

test('Privacy Policy has dedicated responsive and reduced-motion styles without viewport-width hacks', () => {
  assert.match(css, /\.privacy-document-layout \{[\s\S]*?grid-template-columns: minmax\(250px, \.34fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width:960px\)[\s\S]*?\.privacy-document-layout \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*?\.privacy-document-nav ol \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.privacy-document-nav a/);
  assert.doesNotMatch(css, /\.privacy-document-[^\n{]+\{[^}]*width:\s*100vw/);
});
