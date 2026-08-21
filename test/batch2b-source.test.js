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
  assert.match(styles, /\.cta-band-actions \.btn\s*\{\s*width:\s*100%/);
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*\.hero-actions \.btn/);
});

// Task 04: the hero's "100+ Clients Served" floating badge duplicated the same
// stat already shown in the credibility stat row below the hero — a prior
// developer's own comment on the old .hero-float-badge mobile-hide rule had
// already flagged this. Task 04 removed the badge (markup and CSS) outright
// instead of continuing to just hide it on narrow screens.
test('Task 04 removes the redundant hero floating badge instead of only hiding it on mobile', () => {
  assert.doesNotMatch(home, /hero-float-badge/);
  assert.doesNotMatch(styles, /\.hero-float-badge/);
});
