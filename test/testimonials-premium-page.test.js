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

function testimonialsFunctionSource() {
  const start = pages.indexOf('function testimonials()');
  const end = pages.indexOf('\nfunction privacy()', start);
  return pages.slice(start, end);
}

test('Testimonials keeps the existing public CMS-managed testimonial records intact', () => {
  assert.match(pages, /const items = data\.testimonials \|\| \[\]/);
  assert.match(pages, /items\.map\(testimonialFeatureCard\)/);
  assert.match(yaml, /name: Anil Nepal/);
  assert.match(yaml, /business: Uphaar Nepal Pvt\. Ltd\./);
  assert.match(yaml, /name: Laxman Khadka/);
  assert.match(yaml, /business: Adhika Consultancy Pvt\. Ltd\./);
});

test('Testimonials renders supplied quote text and attribution without rewriting it into ratings', () => {
  assert.match(pages, /<blockquote>\$\{esc\(t\.quote\)\}<\/blockquote>/);
  assert.match(pages, /t\.name \? `<strong>\$\{esc\(t\.name\)\}<\/strong>`/);
  assert.match(pages, /const meta = \[t\.role, t\.business\]\.filter\(Boolean\)\.map\(esc\)/);
  assert.doesNotMatch(testimonialsFunctionSource(), /star rating|five-star|5-star|aggregateRating/i);
});

test('Testimonials hero is a dedicated premium attributed-feedback composition', () => {
  assert.match(pages, /testimonials-premium-hero/);
  assert.match(pages, /Published Client Voices/);
  assert.match(pages, /Read Client Feedback/);
  assert.match(pages, /Named client attribution/);
  assert.match(pages, /Full published quote text/);
});

test('Testimonials keeps a safe no-content fallback instead of inventing social proof', () => {
  assert.match(pages, /Client feedback is published only when Maven has genuine, approved material to show/);
  assert.match(pages, /No client testimonials are currently published/);
  assert.doesNotMatch(testimonialsFunctionSource(), /placeholder testimonial/i);
});

test('Testimonials adds only themes directly supported by the current published feedback', () => {
  assert.match(pages, /Themes in Current Feedback/);
  assert.match(pages, /Accounting & records/);
  assert.match(pages, /Tax & compliance/);
  assert.match(pages, /Financial management/);
  assert.match(pages, /Working relationship/);
});

test('Testimonials connects the page to services and contact without adding client logos or counts beyond the live dataset', () => {
  assert.match(pages, /View All Services/);
  assert.match(pages, /Start a Conversation/);
  assert.match(pages, /Book a Free Initial Consultation/);
  assert.match(pages, /publicCount = items\.length/);
  assert.doesNotMatch(testimonialsFunctionSource(), /client logo|clients served|businesses served/i);
});

test('Testimonials retains the existing admin publishing guardrail and has page-specific SEO', () => {
  assert.match(admin, /Only publish real, approved client feedback/);
  assert.match(admin, /New testimonials start hidden/);
  assert.match(build, /Client Testimonials \| Accounting & Finance Support \| Maven Consultancy/);
  assert.match(build, /published client feedback about Maven Consultancy accounting, tax compliance and financial management support/);
  assert.doesNotMatch(build, /file: 'testimonials\.html'[\s\S]{0,500}breadcrumbs:/);
});

test('Testimonials has dedicated responsive and reduced-motion styles without viewport-width hacks', () => {
  assert.match(css, /\.testimonials-premium-hero/);
  assert.match(css, /\.testimonial-feature-grid \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:820px\)[\s\S]*?\.testimonial-feature-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.testimonial-feature-card/);
  assert.doesNotMatch(css, /\.testimonials-[^\n{]+\{[^}]*width:\s*100vw/);
});
