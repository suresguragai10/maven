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
