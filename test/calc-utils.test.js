// Tests for the EMI amortization and VAT math (calc-utils.js), which drive
// the live calculators on calculators.html. Run with: node --test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchedule, computeVat } = require('../calc-utils');

test('EMI: zero-interest loan splits principal evenly across months', () => {
  const { emi, rows } = buildSchedule(120000, 0, 12);
  assert.equal(emi, 10000);
  assert.equal(rows.length, 12);
  assert.equal(rows[0].principal, 10000);
  assert.equal(rows[0].interest, 0);
  assert.equal(rows[11].closing, 0);
});

test('EMI: standard interest-bearing loan amortizes to exactly zero', () => {
  const { rows } = buildSchedule(1000000, 10, 24);
  const last = rows[rows.length - 1];
  // The final row must always close the loan out exactly, absorbing any
  // floating-point rounding drift — this is the whole point of the "final
  // row adjustment" in buildSchedule.
  assert.equal(last.closing, 0);
  assert.equal(rows.length, 24);
});

test('EMI: interest portion decreases and principal portion increases each month', () => {
  const { rows } = buildSchedule(500000, 12, 36);
  // Classic amortization behavior: as the balance shrinks, less of each
  // fixed EMI payment goes to interest and more goes to principal.
  assert.ok(rows[1].interest < rows[0].interest);
  assert.ok(rows[1].principal > rows[0].principal);
});

test('EMI: monthly EMI amount is constant across all rows except the final rounding adjustment', () => {
  const { emi, rows } = buildSchedule(2000000, 8.5, 60);
  rows.slice(0, -1).forEach((row) => {
    assert.ok(Math.abs(row.emi - emi) < 1e-9);
  });
});

test('EMI: opening balance of each row equals closing balance of the previous row', () => {
  const { rows } = buildSchedule(800000, 9, 12);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(Math.abs(rows[i].opening - rows[i - 1].closing) < 1e-6);
  }
});

test('VAT: "add" mode computes VAT on top of a VAT-exclusive amount', () => {
  const result = computeVat(100000, 0.13, 'add');
  assert.equal(result.base, 100000);
  assert.equal(result.vat, 13000);
  assert.equal(result.total, 113000);
});

test('VAT: "extract" mode backs the VAT portion out of a VAT-inclusive total', () => {
  const result = computeVat(113000, 0.13, 'extract');
  assert.equal(result.total, 113000);
  assert.ok(Math.abs(result.base - 100000) < 1e-9);
  assert.ok(Math.abs(result.vat - 13000) < 1e-9);
});

test('VAT: add and extract are inverses of each other', () => {
  const added = computeVat(50000, 0.13, 'add');
  const extracted = computeVat(added.total, 0.13, 'extract');
  assert.ok(Math.abs(extracted.base - 50000) < 1e-9);
});
