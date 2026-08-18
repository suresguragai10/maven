const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const home = fs.readFileSync(path.join(root, 'pages1.js'), 'utf8');
const contact = fs.readFileSync(path.join(root, 'pages3.js'), 'utf8');

test('Batch 2B separates the homepage Industries section from the preceding mist section', () => {
  assert.match(home, /section-pad home-industries-section/);
  assert.match(styles, /\.home-industries-section\s*\{\s*background:\s*var\(--white\)/);
});

test('Batch 2B keeps the contact form visually stable instead of using clickable-card hover lift', () => {
  assert.match(contact, /service-card contact-form-card/);
  assert.match(styles, /\.contact-form-card:hover\s*\{\s*transform:\s*none/);
});

test('Batch 2B simplifies narrow-phone hero and CTA composition', () => {
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.hero-float-badge\s*\{\s*display:\s*none/);
  assert.match(styles, /\.cta-band-actions \.btn\s*\{\s*width:\s*100%/);
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*\.hero-actions \.btn/);
});
