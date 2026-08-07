const data = require('./data');
const { icon } = require('./icons');
const { button, pageHero, ctaBand } = require('./ui');
const { esc, internalHref } = require('./escape');

// Calculator-specific styles kept here so only this page carries them.
const calcStyles = `<style>
.calc-tabs{display:flex;gap:2px;border-bottom:2px solid var(--border);margin-bottom:28px;overflow-x:auto;}
.calc-tab{padding:12px 22px;font-weight:700;font-size:.95rem;color:var(--ink-soft);border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;}
.calc-tab.active{color:var(--navy-950);border-bottom-color:var(--gold-500);}
.calc-panel{display:none;}
.calc-panel.active{display:block;}

.calc-split{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm);}
.calc-inputs{background:#fff;padding:30px;}
.calc-output{background:var(--navy-950);color:#fff;padding:30px;}
@media(max-width:860px){.calc-split{grid-template-columns:1fr;}}

.calc-seg{display:grid;border:1.5px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:12px;}
.calc-seg button{padding:11px 10px;font-weight:700;font-size:.88rem;background:#fff;color:var(--ink-soft);}
.calc-seg button.active{background:var(--gold-500);color:var(--navy-950);}
.calc-hint{font-size:.78rem;color:var(--ink-soft);margin:-4px 0 14px;display:block;}
.calc-hint a{color:var(--gold-700);font-weight:700;}
.calc-sec-label{font-size:.75rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--gold-700);margin:20px 0 12px;padding-top:18px;border-top:1px solid var(--border);}
.calc-inputs .form-field{margin-bottom:14px;}
.calc-check{display:flex;align-items:flex-start;gap:9px;font-weight:700;font-size:.92rem;color:var(--navy-900);cursor:pointer;margin-bottom:4px;}
.calc-check input{width:auto;margin-top:3px;}

.calc-fy-badge{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.12);color:var(--gold-500);padding:5px 11px;border-radius:6px;margin-bottom:18px;}
.calc-big-label{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:4px;}
.calc-big{font-family:var(--font-display);font-size:2.4rem;font-weight:700;color:var(--gold-500);line-height:1.1;}
.calc-big-sub{font-size:.86rem;color:rgba(255,255,255,.6);margin:4px 0 20px;}
.calc-out-row{display:flex;justify-content:space-between;gap:14px;padding:10px 0;font-size:.92rem;border-bottom:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.75);}
.calc-out-row strong{color:#fff;font-weight:700;}
.calc-out-row.gold strong{color:var(--gold-500);font-size:1.02rem;}
.calc-slabs{width:100%;border-collapse:collapse;margin-top:20px;font-size:.82rem;}
.calc-slabs th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.2);}
.calc-slabs td{padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.8);}
.calc-slabs th:last-child,.calc-slabs td:last-child{text-align:right;}
.calc-empty{color:rgba(255,255,255,.45);font-size:.86rem;text-align:center;padding:16px 4px;}
.calc-out-note{font-size:.76rem;color:rgba(255,255,255,.45);font-style:italic;margin:18px 0;}
.calc-out-note a{color:var(--gold-500);}

.calc-simple{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:30px;box-shadow:var(--shadow-sm);}
.calc-simple h2{font-size:1.25rem;margin-bottom:4px;}
.calc-simple .calc-desc{font-size:.92rem;color:var(--ink-soft);margin:0 0 20px;}
.calc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media(max-width:640px){.calc-grid2{grid-template-columns:1fr;}}
.calc-results{margin-top:20px;background:var(--mist);border:1px solid var(--mist-dark);border-radius:var(--radius-sm);padding:18px 22px;}
.calc-result-row{display:flex;justify-content:space-between;gap:14px;padding:7px 0;font-size:.95rem;border-bottom:1px dashed var(--border);}
.calc-result-row:last-child{border-bottom:none;}
.calc-result-row strong{color:var(--navy-900);}
.calc-result-row.total strong{color:var(--gold-700);font-size:1.1rem;}
.calc-note{font-size:.8rem;color:var(--ink-soft);margin-top:14px;}
.calc-note a{color:var(--gold-700);font-weight:700;}

/* EMI amortization schedule */
.emi-sched-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;}
.emi-sched-wrap{margin-top:18px;}
.emi-sched-scroll{max-height:460px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm);}
.emi-sched-table{width:100%;border-collapse:collapse;font-size:.86rem;}
.emi-sched-table th,.emi-sched-table td{padding:9px 12px;text-align:right;white-space:nowrap;}
.emi-sched-table th:first-child,.emi-sched-table td:first-child{text-align:center;}
.emi-sched-table thead th{position:sticky;top:0;background:var(--navy-950);color:#fff;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;z-index:1;}
.emi-sched-table tbody tr:nth-child(even){background:var(--mist);}
.emi-sched-table tbody tr:hover{background:var(--mist-dark);}
.emi-sched-table td{border-bottom:1px solid var(--border);color:var(--navy-900);}
.emi-sched-table tfoot td{font-weight:700;background:#fff;border-top:2px solid var(--border);color:var(--navy-900);}
</style>`;

function incomeTaxPanel() {
  const calc = data.calculators || {};
  const tables = calc.taxTables || [];
  const fyHint = esc(calc.incomeTaxFYHint || '');
  const capLife = calc.deductionCapLife != null ? calc.deductionCapLife.toLocaleString('en-IN') : '40,000';
  const capHealth = calc.deductionCapHealth != null ? calc.deductionCapHealth.toLocaleString('en-IN') : '20,000';
  const capRetirement = calc.deductionCapRetirement != null ? calc.deductionCapRetirement.toLocaleString('en-IN') : '5,00,000';

  // Build FY toggle buttons from YAML — auto-sizes the grid to the number of FYs
  const fyButtons = tables.map((t, i) =>
    `<button type="button" data-fy="${esc(t.key)}"${i === 0 ? ' class="active"' : ''}>${esc(t.label)}</button>`
  ).join('');
  const fyCount = tables.length;

  return `<div class="calc-panel active" id="calc-tab-tax">
    <div class="calc-split">
      <div class="calc-inputs">
        <div class="calc-seg" id="tax-fy-seg" style="grid-template-columns:repeat(${fyCount},1fr)">
          ${fyButtons}
        </div>
        <span class="calc-hint" id="tax-fy-hint">${fyHint}</span>

        <div class="calc-seg" id="tax-status-seg" style="grid-template-columns:1fr 1fr">
          <button type="button" data-status="single" class="active">Individual</button>
          <button type="button" data-status="couple">Married Couple</button>
        </div>
        <span class="calc-hint" id="tax-status-hint"></span>

        <div class="calc-seg" id="tax-gender-seg" style="grid-template-columns:1fr 1fr">
          <button type="button" data-gender="other" class="active">Male / Other</button>
          <button type="button" data-gender="female">Female</button>
        </div>
        <span class="calc-hint">Resident women with employment income only, filing individually, get a 10% rebate on computed tax. Not available with married-couple joint filing.</span>

        <div class="form-field">
          <label for="tax-monthly-salary">Monthly Salary (NPR)</label>
          <input id="tax-monthly-salary" type="number" min="0" inputmode="numeric" placeholder="e.g. 80000">
        </div>
        <div class="form-field">
          <label for="tax-months">Months</label>
          <input id="tax-months" type="number" min="1" max="14" step="1" value="12" inputmode="numeric">
          <span class="calc-hint" style="margin-top:5px">Use 13 if you receive a Dashain/festival bonus as an extra month.</span>
        </div>
        <div class="form-field">
          <label for="tax-bonus">Annual Bonus / Other Income (NPR)</label>
          <input id="tax-bonus" type="number" min="0" inputmode="numeric" value="0">
        </div>

        <p class="calc-sec-label">Deductions</p>
        <span class="calc-hint" style="margin:-4px 0 12px">Caps below are the same across all fiscal years shown here (per the Finance Act in effect when last confirmed) — they may change in a future Finance Act, so double-check before relying on them for filing.</span>
        <label class="calc-check"><input id="tax-ssf" type="checkbox"> I contribute to SSF (Social Security Fund)
          <span style="font-weight:400;color:var(--ink-soft);font-size:.82rem;display:block">Waives only the 1% Social Security Tax on the first income slab below. This is separate from the retirement contribution deduction field further down — fill in both if they apply to you.</span>
        </label>
        <div class="form-field" style="margin-top:12px">
          <label for="tax-retirement">Retirement Contribution — SSF / EPF / CIT, Annual (NPR)</label>
          <input id="tax-retirement" type="number" min="0" inputmode="numeric" value="0">
          <span class="calc-hint" style="margin-top:5px">A separate deduction from the 1% SST waiver above. Combined cap: NPR ${capRetirement} or 1/3 of income, whichever is lower.</span>
        </div>
        <div class="form-field">
          <label for="tax-life">Life Insurance Premium — Annual (NPR)</label>
          <input id="tax-life" type="number" min="0" inputmode="numeric" value="0">
          <span class="calc-hint" style="margin-top:5px">Capped at NPR ${capLife}.</span>
        </div>
        <div class="form-field">
          <label for="tax-health">Health Insurance Premium — Annual (NPR)</label>
          <input id="tax-health" type="number" min="0" inputmode="numeric" value="0">
          <span class="calc-hint" style="margin-top:5px">Capped at NPR ${capHealth}.</span>
        </div>
      </div>

      <div class="calc-output">
        <span class="calc-fy-badge" id="tax-out-fy"></span>
        <p class="calc-big-label">Total Annual Tax</p>
        <div class="calc-big" id="tax-out-annual">NPR 0</div>
        <p class="calc-big-sub" id="tax-out-monthly">NPR 0 / month</p>

        <div class="calc-out-row"><span>Gross annual income</span><strong id="tax-out-gross">NPR 0</strong></div>
        <div class="calc-out-row"><span>Total deductions</span><strong id="tax-out-deductions">NPR 0</strong></div>
        <div class="calc-out-row"><span>Taxable income</span><strong id="tax-out-taxable">NPR 0</strong></div>
        <div class="calc-out-row"><span>Effective tax rate</span><strong id="tax-out-effective">0%</strong></div>
        <div class="calc-out-row" id="tax-out-rebate-row" style="display:none"><span>Female rebate (10%)</span><strong id="tax-out-rebate">− NPR 0</strong></div>
        <div class="calc-out-row gold"><span>Net income after tax / year</span><strong id="tax-out-net">NPR 0</strong></div>

        <table class="calc-slabs" aria-label="Tax breakdown by slab">
          <thead><tr><th>Slab</th><th>Rate</th><th>Tax</th></tr></thead>
          <tbody id="tax-out-slabs"><tr><td colspan="3" class="calc-empty">Enter your salary to see the breakdown.</td></tr></tbody>
        </table>

        <p class="calc-out-note" id="tax-out-disclaimer"></p>
        <a class="btn btn-primary" href="${internalHref('contact.html')}">Need help with tax filing?</a>
      </div>
    </div>
  </div>`;
}

function vatPanel() {
  const calc = data.calculators || {};
  const vatRate = calc.vatRate != null ? calc.vatRate : 13;
  const vatNote = esc(calc.vatNote || "Nepal's standard VAT rate is " + vatRate + "%.");
  return `<div class="calc-panel" id="calc-tab-vat">
    <div class="calc-simple">
      <h2>VAT Calculator (${vatRate}%)</h2>
      <p class="calc-desc">Add VAT to a base amount, or extract the VAT portion from a VAT-inclusive total. Updates as you type.</p>
      <div class="calc-grid2">
        <div class="form-field">
          <label for="vat-amount">Amount (NPR)</label>
          <input id="vat-amount" type="number" min="0" inputmode="decimal" placeholder="e.g. 100000">
        </div>
        <div class="form-field">
          <label>Calculation</label>
          <div class="calc-seg" style="grid-template-columns:1fr 1fr;margin-bottom:0" id="vat-mode-seg">
            <button type="button" data-mode="add" class="active">Add VAT</button>
            <button type="button" data-mode="extract">Extract VAT</button>
          </div>
        </div>
      </div>
      <div class="calc-results">
        <div class="calc-result-row"><span>Amount excluding VAT</span><strong id="vat-base">NPR 0</strong></div>
        <div class="calc-result-row"><span>VAT (${vatRate}%)</span><strong id="vat-tax">NPR 0</strong></div>
        <div class="calc-result-row total"><span>Amount including VAT</span><strong id="vat-total">NPR 0</strong></div>
      </div>
      <p class="calc-note">${vatNote}</p>
    </div>
  </div>`;
}

function tdsPanel() {
  const calc = data.calculators || {};
  const types = calc.tdsTypes || [];
  const tdsNote = esc(calc.tdsNote || 'Common TDS rates. Rates change with each Finance Act — confirm with Maven before deducting.');
  const options = types.map((t) =>
    `<option value="${esc(String(t.rate))}" data-label="${esc(t.note || t.label)}">${esc(t.label)}</option>`
  ).join('');
  return `<div class="calc-panel" id="calc-tab-tds">
    <div class="calc-simple">
      <h2>TDS Calculator</h2>
      <p class="calc-desc">Estimate tax deducted at source on common payment types. TDS is calculated on the VAT-exclusive amount.</p>
      <div class="calc-grid2">
        <div class="form-field">
          <label for="tds-type">Payment Type</label>
          <select id="tds-type">
            ${options}
          </select>
        </div>
        <div class="form-field">
          <label for="tds-amount">Payment Amount, excluding VAT (NPR)</label>
          <input id="tds-amount" type="number" min="0" inputmode="decimal" placeholder="e.g. 50000">
        </div>
      </div>
      <div class="calc-results">
        <div class="calc-result-row"><span>TDS rate applied</span><strong id="tds-rate">—</strong></div>
        <div class="calc-result-row"><span>TDS to deduct &amp; deposit</span><strong id="tds-tax">NPR 0</strong></div>
        <div class="calc-result-row total"><span>Net payable to recipient</span><strong id="tds-net">NPR 0</strong></div>
      </div>
      <p class="calc-note">${tdsNote} <a href="${internalHref('contact.html')}">Confirm the right treatment with Maven</a> before deducting.</p>
    </div>
  </div>`;
}

function emiPanel() {
  return `<div class="calc-panel" id="calc-tab-emi">
    <div class="calc-simple">
      <h2>Loan EMI Calculator</h2>
      <p class="calc-desc">Estimate your equal monthly installment for a bank loan. Updates as you type.</p>
      <div class="calc-grid2">
        <div class="form-field">
          <label for="emi-amount">Loan Amount (NPR)</label>
          <input id="emi-amount" type="number" min="0" inputmode="numeric" placeholder="e.g. 2000000">
        </div>
        <div class="form-field">
          <label for="emi-rate">Annual Interest Rate (%)</label>
          <input id="emi-rate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 10.5">
        </div>
        <div class="form-field">
          <label for="emi-years">Loan Tenure (Years)</label>
          <input id="emi-years" type="number" min="0" step="0.5" inputmode="decimal" placeholder="e.g. 10">
        </div>
      </div>
      <div class="calc-results">
        <div class="calc-result-row total"><span>Monthly EMI</span><strong id="emi-monthly">NPR 0</strong></div>
        <div class="calc-result-row"><span>Total Interest Payable</span><strong id="emi-interest">NPR 0</strong></div>
        <div class="calc-result-row"><span>Total Payment (Principal + Interest)</span><strong id="emi-total">NPR 0</strong></div>
      </div>

      <div class="emi-sched-actions">
        <button type="button" id="emi-toggle-sched" class="btn btn-outline btn-sm" disabled>Show Full Schedule</button>
        <button type="button" id="emi-export-sched" class="btn btn-primary btn-sm" hidden>Export to CSV</button>
      </div>

      <div id="emi-sched-wrap" class="emi-sched-wrap" hidden>
        <div class="emi-sched-scroll">
          <table class="emi-sched-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Opening Balance</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>EMI</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody id="emi-sched-body"></tbody>
          </table>
        </div>
      </div>

      <p class="calc-note">Indicative only — actual EMI may differ based on your bank's method, fees, and rate changes. Preparing a bank loan file? <a href="${internalHref('contact.html')}">We prepare project reports and projected financials</a> for loan applications.</p>
    </div>
  </div>`;
}

function calculators() {
  const h = data.pageHeader('calculators');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/calculators-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container" style="max-width:960px">
      ${calcStyles}

      <div class="calc-tabs" role="tablist">
        <button type="button" class="calc-tab active" data-target="calc-tab-tax">Income Tax</button>
        <button type="button" class="calc-tab" data-target="calc-tab-vat">VAT</button>
        <button type="button" class="calc-tab" data-target="calc-tab-tds">TDS</button>
        <button type="button" class="calc-tab" data-target="calc-tab-emi">Loan EMI</button>
      </div>

      ${incomeTaxPanel()}
      ${vatPanel()}
      ${tdsPanel()}
      ${emiPanel()}

      <div class="info-note reveal" style="margin-top:34px">These tools give quick estimates for planning purposes only — they are not tax, legal, or financial advice. Rates and rules change with each fiscal year's Finance Act. Maven can prepare exact calculations for your business or salary situation.</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Beyond Estimates',
    title: 'Need exact figures for your taxes, payroll, or loan file?',
    subtitle: 'We prepare precise computations, salary sheets, and bank-ready project reports.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} Ask on WhatsApp`, data.whatsappHref('Hello Maven, I used your calculator and would like exact figures for my situation.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

module.exports = { calculators };
