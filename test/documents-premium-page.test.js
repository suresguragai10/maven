const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages3.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('Documents page is positioned as a preparation and secure-sharing guide rather than an upload page', () => {
  assert.match(yaml, /title: Prepare the Right Documents for the Work Ahead/);
  assert.match(pages, /Before You Send Anything/);
  assert.match(pages, /Prepare the right records, not every record/);
  assert.match(pages, /Do not send sensitive financial or identity documents through general website chat/);
  assert.match(pages, /The public website is for starting the conversation — not for sending sensitive files/);
});

test('Documents page preserves all five CMS-managed checklist groups and items', () => {
  assert.match(pages, /data\.documentGroups\.map\(\(g, i\) => accordionItem/);
  assert.match(pages, /bulletList\(g\.items\)/);
  assert.match(pages, /\$\{data\.documentGroups\.length\} common starting checklists/);
  assert.match(yaml, /For Company Registration Support/);
  assert.match(yaml, /For PAN\/VAT Registration Support/);
  assert.match(yaml, /For Monthly Accounting Support/);
  assert.match(yaml, /For Tax Clearance \/ Return Support/);
  assert.match(yaml, /For Project Report \/ Loan Report/);
});

test('Documents page explains a four-step readiness path before the detailed checklists', () => {
  assert.match(pages, /Choose the service/);
  assert.match(pages, /Confirm the exact list/);
  assert.match(pages, /Organize before sharing/);
  assert.match(pages, /Use the agreed transfer method/);
  assert.match(pages, /Start With the Requirement/);
});

test('Documents checklists remain accessible collapsed accordions under a real section heading', () => {
  assert.match(pages, /id="document-checklists"/);
  assert.match(pages, /headingLevel: 'h3'/);
  assert.match(pages, /id: `doc-\$\{i\}`/);
  assert.match(pages, /open: false/);
  assert.match(pages, /General starting point only/);
});

test('Documents page has a visible confidentiality section and a customized-checklist path', () => {
  assert.match(pages, /Confidential Document Handling/);
  assert.match(pages, /Avoid sensitive files in chat/);
  assert.match(pages, /Use the agreed sharing method/);
  assert.match(pages, /Need a Different Checklist/);
  assert.match(pages, /Request a Customized Checklist/);
  assert.match(pages, /Review Privacy Policy/);
});

test('Documents SEO reflects practical checklists and secure-sharing guidance', () => {
  assert.match(build, /Business & Accounting Document Checklists Nepal \| Maven Consultancy/);
  assert.match(build, /secure-sharing guidance/);
  assert.match(build, /company registration, PAN\/VAT, monthly accounting/);
});

test('Documents premium layout uses responsive hero variants and avoids viewport hacks', () => {
  assert.match(pages, /documents-needed-hero-bg-640w\.jpg/);
  assert.match(pages, /documents-needed-hero-bg-960w\.jpg/);
  assert.match(css, /\.documents-premium-hero/);
  assert.match(css, /\.documents-checklist-accordion/);
  assert.match(css, /\.documents-security-section/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.doesNotMatch(css, /\.documents-[^\n{]+\{[^}]*width:\s*100vw/);
});
