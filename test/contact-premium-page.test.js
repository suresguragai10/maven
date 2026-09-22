const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages3.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');

test('Contact page is positioned as a conversation-first inquiry experience', () => {
  assert.match(yaml, /title: Start a Conversation With Maven/);
  assert.match(yaml, /before asking you for documents/);
  assert.match(pages, /Start a Detailed Inquiry/);
  assert.match(pages, /Tell us the business problem before the paperwork/);
});

test('Contact page routes Nepal, international and uncertain inquiries without duplicating service pages', () => {
  assert.match(pages, /Nepal businesses/);
  assert.match(pages, /International support/);
  assert.match(pages, /Not sure yet/);
  assert.match(pages, /Remote accounting & finance delivery/);
  assert.match(pages, /Start with the situation, not a service name/);
});

test('Contact page preserves inquiry form hooks and confidentiality warning', () => {
  for (const id of ['inquiryForm', 'formError', 'f-name', 'f-phone', 'f-email', 'f-service', 'f-type', 'f-message', 'formResult', 'formSummaryText', 'sendEmailLink', 'sendWhatsAppLink']) {
    assert.match(pages, new RegExp(`id=\\"${id}\\"`));
  }
  assert.match(pages, /Do not send sensitive financial records through this form/);
  assert.match(pages, /bank statements, payroll files, tax records/);
  assert.match(client, /Contact \/ inquiry form/);
});

test('Contact page coordinates form, WhatsApp, live chat and Kathmandu office', () => {
  assert.match(pages, /Detailed inquiry/);
  assert.match(pages, /WhatsApp/);
  assert.match(pages, /Live chat/);
  assert.match(pages, /website chat bubble when the team is available/);
  assert.match(pages, /Kathmandu office/);
  assert.match(pages, /contact-map/);
});

test('Contact hero uses responsive image tiers aligned with preload strategy', () => {
  assert.match(css, /contact-hero-bg-640w\.jpg/);
  assert.match(css, /contact-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.contact-hero-premium/);
  assert.match(build, /file: 'contact\.html'[\s\S]*?heroImage: '\/images\/contact-hero-bg\.jpg'/);
});

test('Contact page has dedicated mobile composition and no width hacks', () => {
  assert.match(css, /@media \(max-width:640px\)[\s\S]*?\.contact-hero-actions/);
  assert.match(css, /\.contact-proof-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.contact-inquiry-grid, \.contact-direct-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\.contact-[^\n{]+\{[^}]*width:\s*100vw/);
});
