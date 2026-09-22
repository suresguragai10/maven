const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages7.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin', 'admin.js'), 'utf8');

test('Resources page is positioned as a practical finance knowledge hub for Nepal businesses', () => {
  assert.match(yaml, /eyebrow: Knowledge & Resources/);
  assert.match(yaml, /title: Practical Finance Resources for Nepal Businesses/);
  assert.match(yaml, /Prepare documents, test indicative calculations, reach official portals/);
  assert.match(build, /Finance, Tax & Accounting Resources Nepal \| Maven Consultancy/);
  assert.match(build, /document checklists, indicative calculators, official portals and Maven service FAQs/);
});

test('Resources hero directs visitors by question type rather than showing a generic card grid', () => {
  assert.match(pages, /Resource Desk/);
  assert.match(pages, /Start with the kind of question you have/);
  assert.match(pages, /Prepare/);
  assert.match(pages, /Calculate/);
  assert.match(pages, /Verify/);
  assert.match(pages, /Understand/);
  assert.match(pages, /Explore the Resource Library/);
});

test('Resources page preserves the four CMS-managed destinations and optional hidden blog behavior', () => {
  assert.match(pages, /const tiles = \(hub\.tiles \|\| \[\]\)\.slice\(\)/);
  assert.match(pages, /data\.isVisible\('blog'\)/);
  assert.match(yaml, /- title: Documents Checklist/);
  assert.match(yaml, /- title: Financial Calculators/);
  assert.match(yaml, /- title: Useful Links/);
  assert.match(yaml, /- title: FAQ/);
});

test('Resources library explains purpose and limits of each resource', () => {
  assert.match(pages, /Best for/);
  assert.match(pages, /Registration, onboarding, monthly accounting and compliance preparation/);
  assert.match(pages, /Indicative salary tax, VAT, TDS and loan EMI calculations/);
  assert.match(pages, /Official Nepal portals and institutional reference points/);
  assert.match(pages, /Maven scope, process, pricing approach, coverage and confidentiality/);
});

test('Resources workflow makes the safe research-to-advice sequence explicit', () => {
  assert.match(pages, /How to Use the Hub/);
  assert.match(pages, /Prepare the facts, test the numbers, verify the source/i);
  assert.match(pages, /Bring entity-specific, judgement-heavy or higher-risk questions into a proper advisory conversation/);
});

test('Resources page clearly separates general information from professional judgement', () => {
  assert.match(pages, /General Information vs Professional Judgement/);
  assert.match(pages, /A rule must be applied to your specific entity or transaction/);
  assert.match(pages, /A current deadline, rate or filing obligation needs confirmation/);
  assert.match(pages, /NFRS \/ IFRS judgement or reporting treatment is involved/);
  assert.match(pages, /general resources support preparation and planning; they do not replace engagement-specific professional advice/i);
});

test('Resources CMS editor remains focused on the four primary library cards', () => {
  assert.match(admin, /Edit the Resources hub intro and its four primary library cards/);
  assert.match(admin, /The surrounding knowledge-workflow and professional-boundary framing stays fixed/);
});

test('Resources page has dedicated responsive and reduced-motion treatment without viewport hacks', () => {
  assert.match(css, /\.resources-premium-hero/);
  assert.match(css, /\.resources-library-grid \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*?\.resources-library-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.resources-library-card/);
  assert.doesNotMatch(css, /\.resources-[^\n{]+\{[^}]*width:\s*100vw/);
});
