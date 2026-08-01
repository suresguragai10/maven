// Pure income-tax slab math, shared between the browser calculator
// (calculators.html, inlined alongside client.js — see build.js) and the
// Node test suite (test/tax-calc.test.js). Exports as a CommonJS module in
// Node, or a plain global (window.TaxCalc) in the browser, since client.js
// has no bundler/module system to `require()` this with.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TaxCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // bands: [{ width: number|null, rate: number, sst?: boolean }, ...]
  //   width === null means "the rest of income" (the top/unlimited band).
  //   sst: this band is the 1% Social Security Tax slab, waived for SSF contributors.
  // income: taxable income (NPR). isSSF: whether the 1% SST waiver applies.
  function computeSlabs(bands, income, isSSF) {
    var remaining = income;
    var lower = 0;
    var rows = [];
    var total = 0;
    for (var i = 0; i < bands.length && remaining > 0; i++) {
      var b = bands[i];
      var slabAmt = b.width === null ? remaining : Math.min(remaining, b.width);
      var rate = (b.sst && isSSF) ? 0 : b.rate;
      var tax = (slabAmt * rate) / 100;
      var upper = b.width === null ? lower + slabAmt : lower + b.width;
      rows.push({
        label: b.width === null
          ? 'Above ' + lower.toLocaleString('en-IN')
          : lower.toLocaleString('en-IN') + ' – ' + upper.toLocaleString('en-IN'),
        rate: rate + '%' + (b.sst && isSSF ? '*' : ''),
        tax: tax,
      });
      total += tax;
      remaining -= slabAmt;
      lower = upper;
    }
    return { rows: rows, total: total };
  }

  return { computeSlabs: computeSlabs };
});
