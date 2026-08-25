const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const pages = require('../tests/ui/support/pages');

const EXPECTED_PUBLIC_QA_PAGES = [
  '/', '/about', '/services', '/outsourced-accounting', '/global-outsourcing',
  '/international-accounting', '/virtual-cfo', '/nfrs-ifrs', '/packages',
  '/documents-needed', '/industries', '/resources', '/useful-links',
  '/calculators', '/faq', '/contact', '/team', '/testimonials', '/privacy', '/terms', '/blog',
];
const EXPECTED_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440];

test('Batch 2C overflow gate covers every generated public route at the agreed width matrix', () => {
  assert.deepEqual(pages.PUBLIC_QA_PAGES, EXPECTED_PUBLIC_QA_PAGES);
  assert.deepEqual(pages.OVERFLOW_PAGES, EXPECTED_PUBLIC_QA_PAGES);
  assert.deepEqual(pages.OVERFLOW_WIDTHS, EXPECTED_WIDTHS);
});

test('Batch 2C dynamic responsive gate exercises the fragile interaction states', () => {
  const spec = read('tests/ui/public/responsive-gate.spec.js');
  for (const token of [
    '.mobile-sub-toggle',
    '[data-industry-index="0"]',
    '#trigger-faq-0',
    '#inquiryForm button[type="submit"]',
    '#emi-toggle-sched',
    '.whatsapp-float',
    '.back-to-top',
  ]) {
    assert.match(spec, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Batch 2C runtime gate checks uncaught errors and broken same-origin assets', () => {
  const spec = read('tests/ui/public/responsive-gate.spec.js');
  assert.match(spec, /page\.on\('pageerror'/);
  assert.match(spec, /response\.status\(\) >= 400/);
  assert.match(spec, /localhost/);
});

test('Batch 2C remains a verification-only public pass', () => {
  const doc = read('docs/BATCH2C_VERIFICATION_GATE.md');
  assert.match(doc, /verification-only/i);
  assert.match(doc, /does not change business rules/i);
  assert.match(doc, /professional-update/);
  assert.match(doc, /main.*remains untouched/i);
});
