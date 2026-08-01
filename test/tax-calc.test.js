// Tests for the income-tax slab math (tax-calc.js), which drives the live
// calculator on calculators.html. Run with: node --test
//
// Expected totals below are hand-computed against the actual slab data in
// content/site.yaml (FY 2082/83 and FY 2083/84 resident salary tables) —
// if a future edit to those slabs changes the real tax owed, these tests
// should fail, catching it before it misinforms a client.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeSlabs } = require('../tax-calc');

// FY 2082/83 — single: 1%(SST,500k) / 10%(200k) / 20%(300k) / 30%(1M) / 36%(3M) / 39%(rest)
const FY2082_SINGLE = [
  { width: 500000, rate: 1, sst: true },
  { width: 200000, rate: 10 },
  { width: 300000, rate: 20 },
  { width: 1000000, rate: 30 },
  { width: 3000000, rate: 36 },
  { width: null, rate: 39 },
];
// FY 2082/83 — couple: same as single but first slab is 600k, and 30% band is 900k wide
const FY2082_COUPLE = [
  { width: 600000, rate: 1, sst: true },
  { width: 200000, rate: 10 },
  { width: 300000, rate: 20 },
  { width: 900000, rate: 30 },
  { width: 3000000, rate: 36 },
  { width: null, rate: 39 },
];
// FY 2083/84 — unified (no couple split): 1%(SST,1M) / 10%(500k) / 20%(1M) / 27%(1.5M) / 29%(rest)
const FY2083_SINGLE = [
  { width: 1000000, rate: 1, sst: true },
  { width: 500000, rate: 10 },
  { width: 1000000, rate: 20 },
  { width: 1500000, rate: 27 },
  { width: null, rate: 29 },
];

test('zero income produces zero tax and no rows', () => {
  const result = computeSlabs(FY2082_SINGLE, 0, false);
  assert.equal(result.total, 0);
  assert.deepEqual(result.rows, []);
});

test('FY 2082/83 single, income exactly fills the first slab (500,000)', () => {
  const result = computeSlabs(FY2082_SINGLE, 500000, false);
  assert.equal(result.total, 5000); // 500,000 * 1%
});

test('FY 2082/83 single, income spans 3 slabs (1,000,000), no SSF', () => {
  const result = computeSlabs(FY2082_SINGLE, 1000000, false);
  // 500k@1% + 200k@10% + 300k@20% = 5,000 + 20,000 + 60,000
  assert.equal(result.total, 85000);
});

test('FY 2082/83 single, SSF contributor waives the 1% first-slab tax', () => {
  const result = computeSlabs(FY2082_SINGLE, 1000000, true);
  // 500k@0%(waived) + 200k@10% + 300k@20% = 0 + 20,000 + 60,000
  assert.equal(result.total, 80000);
  assert.match(result.rows[0].rate, /^0%/);
});

test('FY 2082/83 single, income spans all 6 slabs including the unlimited top band (10,000,000)', () => {
  const result = computeSlabs(FY2082_SINGLE, 10000000, false);
  // 500k@1%=5,000 + 200k@10%=20,000 + 300k@20%=60,000 + 1M@30%=300,000
  // + 3M@36%=1,080,000 + 5M(remainder)@39%=1,950,000
  assert.equal(result.total, 3415000);
  assert.equal(result.rows.length, 6);
  assert.match(result.rows[5].label, /^Above/); // unlimited top band
});

test('FY 2082/83 couple, first slab is 600,000 not 500,000', () => {
  const result = computeSlabs(FY2082_COUPLE, 700000, false);
  // 600k@1%=6,000 + 100k(remainder)@10%=10,000
  assert.equal(result.total, 16000);
});

test('FY 2083/84 unified, income exactly fills the first slab (1,000,000)', () => {
  const result = computeSlabs(FY2083_SINGLE, 1000000, false);
  assert.equal(result.total, 10000); // 1,000,000 * 1%
});

test('FY 2083/84 unified, SSF contributor waives the 1% first-slab tax', () => {
  const result = computeSlabs(FY2083_SINGLE, 1000000, true);
  assert.equal(result.total, 0);
});

test('FY 2083/84 unified, income spans all 5 slabs (5,000,000)', () => {
  const result = computeSlabs(FY2083_SINGLE, 5000000, false);
  // 1M@1%=10,000 + 500k@10%=50,000 + 1M@20%=200,000 + 1.5M@27%=405,000
  // + 1M(remainder)@29%=290,000
  assert.equal(result.total, 955000);
});

test('SSF waiver never affects a non-SST band, even when isSSF is true', () => {
  const result = computeSlabs(FY2082_SINGLE, 700000, true);
  // 500k@0%(waived) + 200k(remainder)@10% — the 10% band must stay 10%, not 0%
  assert.equal(result.total, 20000);
  assert.match(result.rows[1].rate, /^10%/);
});
