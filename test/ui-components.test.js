// Task 02: proves the new shared capabilityChapter() primitive renders a
// real, valid composition — image + chapter label + heading + service
// links + one CTA, as a single element, not a detached photo next to a
// separate card — without wiring it into any live page yet (that's later,
// page-specific work; see docs/ARCHITECTURE_MAP.md). Run with: node --test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { capabilityChapter } = require('../ui');

function sample(overrides) {
  return Object.assign({
    variant: 'structured',
    chapterLabel: 'Establish & Comply',
    title: 'Registration, tax, and payroll — handled correctly from day one',
    text: 'A calm, structured entry point into getting your business legally set up and compliant.',
    image: { file: 'card-registration', alt: 'Business registration documents prepared for review' },
    links: [
      { label: 'Business Registration', href: 'services.html#registration' },
      { label: 'Tax & Compliance', href: 'services.html#tax' },
      { label: 'Payroll & Salary Support', href: 'services.html#payroll' },
    ],
    cta: { label: 'Discuss This Chapter', href: 'contact.html' },
  }, overrides);
}

test('capabilityChapter renders a single <article> composition, not separate image/card elements', () => {
  const html = capabilityChapter(sample());
  const articleMatches = html.match(/<article\b/g) || [];
  assert.equal(articleMatches.length, 1, 'exactly one root element — image and body must live inside the same composition');
  assert.match(html, /class="capability-chapter reveal capability-chapter--structured"/);
});

test('capabilityChapter includes the image with real, non-empty alt text', () => {
  const html = capabilityChapter(sample());
  const imgMatches = html.match(/<img\b[^>]*>/g) || [];
  assert.equal(imgMatches.length, 1);
  assert.match(imgMatches[0], /src="\/images\/card-registration\.jpg"/);
  assert.match(imgMatches[0], /alt="Business registration documents prepared for review"/);
});

test('capabilityChapter includes the chapter label as a real eyebrow, and an h2 heading', () => {
  const html = capabilityChapter(sample());
  assert.match(html, /<p class="eyebrow">Establish &amp; Comply<\/p>/);
  assert.match(html, /<h2>Registration, tax, and payroll — handled correctly from day one<\/h2>/);
});

test('capabilityChapter renders real internal links for each service, not bullet text', () => {
  const html = capabilityChapter(sample());
  assert.match(html, /href="\/services#registration"/);
  assert.match(html, /href="\/services#tax"/);
  assert.match(html, /href="\/services#payroll"/);
  // Each link is a real <a>, not a plain <li> with text only.
  const linkListItems = html.match(/<li><a href=/g) || [];
  assert.equal(linkListItems.length, 3);
});

test('capabilityChapter renders exactly one CTA', () => {
  const html = capabilityChapter(sample());
  const ctaMatches = html.match(/class="btn btn-outline"/g) || [];
  assert.equal(ctaMatches.length, 1);
  assert.match(html, /href="\/contact"/);
});

test('capabilityChapter without links or cta omits those blocks cleanly (no empty wrapper markup)', () => {
  const html = capabilityChapter(sample({ links: [], cta: null }));
  assert.doesNotMatch(html, /capability-chapter-links/);
  assert.doesNotMatch(html, /capability-chapter-actions/);
});

test('all three capability chapter variants render their own distinct modifier class', () => {
  ['structured', 'feature', 'technical'].forEach((variant) => {
    const html = capabilityChapter(sample({ variant }));
    assert.match(html, new RegExp('capability-chapter--' + variant));
  });
});

test('reverse variant places the photo on the opposite side via a modifier class, not duplicated markup', () => {
  const html = capabilityChapter(sample({ reverse: true }));
  assert.match(html, /class="capability-chapter reveal capability-chapter--structured capability-chapter--reverse"/);
  const photoMatches = html.match(/capability-chapter-photo"/g) || [];
  assert.equal(photoMatches.length, 1);
});

test('an id, when supplied, is set on the root article for real anchor-link support', () => {
  const html = capabilityChapter(sample({ id: 'establish-and-comply' }));
  assert.match(html, /<article class="[^"]*" id="establish-and-comply">/);
});
