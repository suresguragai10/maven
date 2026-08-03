// Pure math for the EMI and VAT calculators (calculators.html), shared
// between the browser (inlined alongside client.js and tax-calc.js — see
// build.js) and the Node test suite (test/calc-utils.test.js). Same
// dual-environment export pattern as tax-calc.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CalcUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Builds the full month-by-month loan amortization schedule.
  // P: principal (loan amount). annual: annual interest rate, percent (e.g. 10.5). n: number of months.
  function buildSchedule(P, annual, n) {
    var r = annual / 12 / 100;
    var emi;
    if (annual === 0) {
      emi = P / n;
    } else {
      var pow = Math.pow(1 + r, n);
      emi = (P * r * pow) / (pow - 1);
    }
    var rows = [];
    var balance = P;
    for (var m = 1; m <= n; m++) {
      var interest = balance * r;
      var principal = emi - interest;
      var opening = balance;
      balance = balance - principal;
      // Absorb tiny rounding drift on the final row so the loan closes at exactly zero.
      if (m === n) { principal += balance; balance = 0; }
      rows.push({
        month: m,
        opening: opening,
        principal: principal,
        interest: interest,
        emi: emi,
        closing: balance < 0 ? 0 : balance,
      });
    }
    return { emi: emi, rows: rows };
  }

  // mode: 'add' (amt is VAT-exclusive, add VAT) or 'extract' (amt is VAT-inclusive, back out VAT).
  // vatRate: decimal (e.g. 0.13 for 13%).
  function computeVat(amt, vatRate, mode) {
    var base, vat, total;
    if (mode === 'add') {
      base = amt; vat = amt * vatRate; total = amt + vat;
    } else {
      total = amt; base = amt / (1 + vatRate); vat = total - base;
    }
    return { base: base, vat: vat, total: total };
  }

  return { buildSchedule: buildSchedule, computeVat: computeVat };
});
