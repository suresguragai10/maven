const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages6.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

function termsFunctionSource() {
  const start = pages.indexOf('function terms()');
  const end = pages.indexOf('\nfunction notFound()', start);
  return pages.slice(start, end);
}

test('Terms of Service remains driven by the existing content intro, sections and reviewed date', () => {
  const source = termsFunctionSource();
  assert.match(source, /const termsSections = data\.termsSections \|\| \[\]/);
  assert.match(source, /data\.termsIntro/);
  assert.match(source, /data\.termsLastReviewed/);
  assert.match(yaml, /termsLastReviewed: August 2026/);
  assert.match(yaml, /termsSections:/);
});

test('Terms keeps substantive legal positions in content rather than hard-coding them into the renderer', () => {
  assert.match(yaml, /Maven is not a licensed audit firm, bank, lender, or investment adviser/);
  assert.match(yaml, /These terms are governed by the laws of Nepal/);
  assert.match(yaml, /Work begins only after we have agreed the scope of services and fees with you in writing/);
  assert.doesNotMatch(termsFunctionSource(), /licensed audit firm|governed by the laws of Nepal|signed proposal|statutory audit, legal proceedings/);
});

test('Terms uses the established legal hero while keeping a Terms-specific document structure', () => {
  const source = termsFunctionSource();
  assert.match(source, /pageHero\(h\.eyebrow, h\.title, h\.subtitle, '\/images\/privacy-hero-bg\.jpg'\)/);
  assert.match(source, /class="container terms-document-layout"/);
  assert.doesNotMatch(source, /privacy-document-/);
});

test('Terms adds a navigable document index generated from the same section titles', () => {
  const source = termsFunctionSource();
  assert.match(pages, /function termsSectionId\(title, index\)/);
  assert.match(source, /aria-label="Terms of Service sections"/);
  assert.match(source, /termsSections\.map\(\(s, index\) => `<li><a href="#\$\{termsSectionId\(s\.title, index\)\}"/);
  assert.match(source, /id="\$\{termsSectionId\(s\.title, index\)\}"/);
});

test('Terms renders every content section heading and body without paraphrasing', () => {
  const source = termsFunctionSource();
  assert.match(source, /<h2>\$\{esc\(s\.title\)\}<\/h2>/);
  assert.match(source, /<p>\$\{esc\(s\.text\)\}<\/p>/);
  assert.match(source, /<p>\$\{esc\(data\.termsIntro\)\}<\/p>/);
});

test('Terms keeps review metadata explicit and source-controlled', () => {
  const source = termsFunctionSource();
  assert.match(source, /<span>Last reviewed<\/span><strong>\$\{esc\(data\.termsLastReviewed\)\}<\/strong>/);
  assert.doesNotMatch(source, /new Date\(|Date\.now\(/);
});

test('Terms retains its contact path and established page metadata', () => {
  const source = termsFunctionSource();
  assert.match(source, /Have a question about these terms\?/);
  assert.match(source, /button\('Contact Maven', 'contact\.html', 'primary'\)/);
  assert.match(build, /Terms of Service \| Maven Consultancy Services Nepal/);
  assert.match(build, /The terms that apply when you use the Maven Consultancy Services Pvt\. Ltd\. website or engage us/);
});

test('Terms has dedicated responsive and reduced-motion styles without viewport-width hacks', () => {
  assert.match(css, /\.terms-document-layout \{[\s\S]*?grid-template-columns: minmax\(250px, \.34fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width:960px\)[\s\S]*?\.terms-document-layout \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*?\.terms-document-nav ol \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.terms-document-nav a/);
  assert.doesNotMatch(css, /\.terms-document-[^\n{]+\{[^}]*width:\s*100vw/);
});
