const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages7.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('NFRS IFRS page is positioned as a technical implementation and reporting page', () => {
  assert.match(yaml, /eyebrow: NFRS \/ IFRS Implementation/);
  assert.match(yaml, /title: NFRS \/ IFRS Implementation & Financial Reporting/);
  assert.match(yaml, /Structured support for readiness, transition, technical accounting, financial statements/);
  assert.match(build, /NFRS \/ IFRS Implementation & Financial Reporting \| Maven Consultancy/);
});

test('NFRS IFRS page exposes a clear readiness-to-handover reporting path', () => {
  assert.match(pages, /Reporting Readiness Map/);
  assert.match(pages, /Implementation, Not Formatting/);
  assert.match(pages, /The Implementation Path/);
  assert.match(pages, /Readiness & planning/);
  assert.match(pages, /Handover & year-end support/);
});

test('NFRS IFRS page keeps technical accounting scope and detailed editable content available', () => {
  assert.match(pages, /Core Implementation Work/);
  assert.match(pages, /Technical Accounting Areas/);
  assert.match(pages, /technicalArea\.items/);
  assert.match(pages, /supportAreas\.map\(supportAreaAccordion\)/);
  assert.match(pages, /nfrs-statement-prep/);
  assert.match(pages, /nfrs-policies/);
  assert.match(pages, /nfrs-mgmt-reporting/);
  assert.match(pages, /nfrs-audit-prep/);
});

test('NFRS IFRS page preserves applicability and audit professional boundaries', () => {
  assert.match(pages, /Defined Professional Boundaries/);
  assert.match(pages, /auditPrep/);
  assert.match(yaml, /Applicability of a particular reporting framework depends on the entity and applicable/);
  assert.match(yaml, /Maven can support the accounting team[\s\S]*Maven does not issue statutory audit opinions or represent itself as an[\s\S]*audit firm/);
  assert.doesNotMatch(pages, /mandatory for all|guaranteed compliance|statutory auditor|audit opinion by Maven|24\/7/i);
});

test('NFRS IFRS hero uses responsive reporting image tiers aligned with preload strategy', () => {
  assert.match(css, /card-reporting-640w\.jpg/);
  assert.match(css, /card-reporting-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.nfrs-hero/);
  assert.match(build, /file: 'nfrs-ifrs\.html'[\s\S]*?heroImage: '\/images\/card-reporting\.jpg'/);
});

test('NFRS IFRS page has dedicated mobile composition and no viewport-width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.nfrs-hero-actions/);
  assert.match(css, /\.nfrs-topic-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.nfrs-process-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.nfrs-package-groups \{ grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /\.nfrs-[^\n{]+\{[^}]*width:\s*100vw/);
});
