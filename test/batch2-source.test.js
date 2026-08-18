const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Batch 2 footer preserves four navigation groups in one footer landmark', () => {
  const layout = read('layout.js');
  assert.match(layout, /<nav class="footer-links" aria-label="Footer">/);
  const block = layout.slice(layout.indexOf('<nav class="footer-links"'), layout.indexOf('</nav>', layout.indexOf('<nav class="footer-links"')));
  const groups = block.match(/footerCol\('/g) || [];
  assert.equal(groups.length, 4);
  assert.match(layout, /<address class="footer-address">/);
});

test('Batch 2 floating controls use dynamic footer clearance and safe-area CSS', () => {
  const client = read('client.js');
  const css = read('styles.css');
  assert.match(client, /--floating-footer-clearance/);
  assert.match(client, /siteFooter\.getBoundingClientRect\(\)/);
  assert.match(css, /var\(--floating-footer-clearance, 0px\)/);
  assert.match(css, /env\(safe-area-inset-bottom, 0px\)/);
});

test('Batch 2 reveal motion fails open and skips waiting for reduced motion', () => {
  const client = read('client.js');
  assert.match(client, /if \(motionReduced\(\) \|\| !\('IntersectionObserver' in window\)\)/);
  assert.match(client, /document\.documentElement\.classList\.remove\('reveal-enabled'\)/);
  assert.match(client, /catch \(err\) \{\s*revealImmediately\(\);/s);
});

test('Accordion rendered state includes aria-hidden in addition to inert', () => {
  const ui = read('ui.js');
  const client = read('client.js');
  assert.match(ui, /aria-hidden="\$\{open \? 'false' : 'true'\}"/);
  assert.match(client, /panel\.setAttribute\('aria-hidden', String\(isOpen\)\)/);
});

test('Controlled future batch roadmap is present', () => {
  const roadmap = read('docs/IMPLEMENTATION_BATCH_ROADMAP.md');
  assert.match(roadmap, /Batch 2 - Footer, restrained motion and public visual polish/);
  assert.match(roadmap, /Batch 8 - Release candidate and final GitHub gate/);
});


test('Batch 2A footer navigation labels use h2 rather than skipped h4 headings', () => {
  const layout = read('layout.js');
  const css = read('styles.css');
  assert.match(layout, /<h2>\$\{esc\(title\)\}<\/h2>/);
  assert.doesNotMatch(layout, /<h4>\$\{esc\(title\)\}<\/h4>/);
  assert.match(css, /\.footer-col h2 \{/);
});

test('Batch 2A removes known public h2-to-h4 skips in partner notes', () => {
  const pages2 = read('pages2.js');
  const pages7 = read('pages7.js');
  const css = read('styles.css');
  assert.doesNotMatch(pages2 + pages7, /<h4>/);
  assert.match(pages2, /<h2 class="partner-note-title">Support Through Partners<\/h2>/);
  assert.match(pages7, /<h3 class="partner-note-title">Defined Professional Boundaries<\/h3>/);
  assert.match(pages7, /<h2 class="partner-note-title">Data Security &amp; Confidentiality<\/h2>/);
  assert.match(css, /\.partner-note-title \{/);
});

test('Batch 2A staff photos accept only controlled sources that match staff CSP', () => {
  const staff = read('staff/staff.js');
  const build = read('build.js');
  assert.match(staff, /function allowedStaffPhotoUrl\(value\)/);
  assert.match(staff, /\/storage\/v1\/object\/public\//);
  assert.match(staff, /v\.indexOf\('\/images\/'\) === 0/);
  assert.match(staff, /replaceChild\(profilePhotoFallback/);
  assert.match(build, /img-src 'self' https:\/\/moqmgyniwytwmlcdthzy\.supabase\.co/);
  assert.doesNotMatch(build.slice(build.indexOf('const staffCsp'), build.indexOf('const headers')), /img-src 'self' data: https:/);
});

test('Batch 2A admin branch is explicit and never silently defaults to main', () => {
  const html = read('admin/index.html');
  const admin = read('admin/admin.js');
  assert.doesNotMatch(html, /id="in-branch"[^>]*value="main"/);
  assert.match(html, /professional-update/);
  assert.doesNotMatch(admin, /branch \|\| 'main'/);
  assert.match(admin, /Please fill in username, repository, branch, and token/);
  assert.match(admin, /sessionStorage\.setItem\('maven_admin_branch'/);
  assert.doesNotMatch(admin, /localStorage\.setItem\('maven_admin_branch'/);
});
