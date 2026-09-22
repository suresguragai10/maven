const data = require('./data');
const { icon } = require('./icons');
const { button, ctaBand } = require('./ui');
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

/* Brief highlight when a result value actually changes -- see setText()
   in client.js, which only adds this class on a real text change. */
@keyframes calc-pulse{0%{opacity:.5;transform:translateY(-2px);}100%{opacity:1;transform:translateY(0);}}
.calc-pulse{animation:calc-pulse 300ms ease-out;}
@media(prefers-reduced-motion:reduce){.calc-pulse{animation:none;}}

/* Premium calculator hub */
.calculators-premium-hero{position:relative;isolation:isolate;overflow:hidden;background:var(--navy-950);color:#fff;}
.calculators-premium-hero-photo,.calculators-premium-hero-photo img,.calculators-premium-hero-shade{position:absolute;inset:0;width:100%;height:100%;}
.calculators-premium-hero-photo img{object-fit:cover;object-position:62% center;}
.calculators-premium-hero-shade{z-index:0;background:linear-gradient(90deg,rgba(5,19,36,.96) 0%,rgba(7,25,47,.92) 48%,rgba(7,25,47,.72) 100%);}
.calculators-premium-hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.82fr);gap:64px;align-items:center;min-height:650px;padding-top:82px;padding-bottom:82px;}
.calculators-premium-hero-copy{max-width:790px;}
.calculators-premium-hero-copy .eyebrow{margin-bottom:20px;}
.calculators-premium-hero h1{max-width:12ch;color:#fff;font-size:clamp(3.2rem,5.4vw,5.45rem);line-height:.96;letter-spacing:-.045em;}
.calculators-premium-hero-sub{max-width:720px;margin:24px 0 0;color:rgba(255,255,255,.76);font-size:clamp(1.05rem,1.5vw,1.22rem);line-height:1.72;}
.calculators-premium-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px;}
.calculators-premium-hero .btn-outline{border-color:rgba(255,255,255,.42);color:#fff;background:rgba(255,255,255,.04);}
.calculators-premium-hero .btn-outline:hover{border-color:#fff;background:rgba(255,255,255,.1);}
.calculators-premium-hero-assurances{display:flex;flex-wrap:wrap;gap:11px 22px;margin-top:32px;}
.calculators-premium-hero-assurances span{display:inline-flex;align-items:center;gap:8px;color:rgba(255,255,255,.65);font-size:var(--fs-xs);}
.calculators-premium-hero-assurances .stamp{width:18px;height:18px;color:var(--gold-500);flex:0 0 auto;}
.calculators-hero-desk{border:1px solid rgba(255,255,255,.18);border-radius:22px;background:rgba(7,25,47,.78);box-shadow:0 28px 70px rgba(0,0,0,.24);backdrop-filter:blur(10px);overflow:hidden;}
.calculators-hero-desk-head{padding:28px 28px 22px;border-bottom:1px solid rgba(255,255,255,.12);}
.calculators-hero-desk-head .eyebrow{margin-bottom:12px;}
.calculators-hero-desk-head h2{margin:0;color:#fff;font-size:1.45rem;line-height:1.25;}
.calculators-hero-desk-head p:last-child{margin:12px 0 0;color:rgba(255,255,255,.64);font-size:.91rem;line-height:1.65;}
.calculators-hero-tool-list{display:grid;}
.calculators-hero-tool{display:grid;grid-template-columns:34px 34px minmax(0,1fr);gap:12px;align-items:start;padding:17px 28px;border-bottom:1px solid rgba(255,255,255,.09);}
.calculators-hero-tool:last-child{border-bottom:0;}
.calculators-hero-tool-no{padding-top:2px;color:rgba(255,255,255,.38);font-size:.7rem;font-weight:800;letter-spacing:.1em;}
.calculators-hero-tool-icon{display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(199,154,62,.38);border-radius:8px;color:var(--gold-500);}
.calculators-hero-tool-icon .ic{width:16px;height:16px;}
.calculators-hero-tool strong{display:block;color:#fff;font-size:.9rem;}
.calculators-hero-tool small{display:block;margin-top:3px;color:rgba(255,255,255,.57);font-size:.77rem;line-height:1.45;}

.calculators-workbench-section{background:linear-gradient(180deg,#fff 0%,#f7f9fb 100%);scroll-margin-top:110px;}
.calculators-workbench-container{max-width:1120px;}
.calculators-workbench-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.72fr);gap:52px;align-items:end;margin-bottom:34px;}
.calculators-workbench-head h2{max-width:720px;margin:0;font-size:clamp(2rem,3.3vw,3rem);}
.calculators-workbench-note{display:flex;gap:14px;align-items:flex-start;padding:18px 20px;border:1px solid var(--border);border-radius:var(--radius);background:#fff;box-shadow:var(--shadow-sm);}
.calculators-workbench-note .ic{width:24px;height:24px;flex:0 0 auto;color:var(--gold-700);}
.calculators-workbench-note p{margin:0;color:var(--ink-soft);font-size:.86rem;line-height:1.55;}
.calculators-workbench-note strong{display:block;margin-bottom:3px;color:var(--navy-950);}
.calc-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border:0;margin:0 0 18px;overflow:visible;}
.calc-tab{display:flex;align-items:center;justify-content:center;gap:9px;padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink-soft);font-weight:800;font-size:.9rem;box-shadow:0 4px 14px rgba(8,31,58,.035);margin:0;transition:border-color var(--motion-ui) var(--motion-ease),background var(--motion-ui) var(--motion-ease),color var(--motion-ui) var(--motion-ease),transform var(--motion-ui) var(--motion-ease);}
.calc-tab span{color:var(--gold-700);font-size:.67rem;letter-spacing:.08em;}
.calc-tab:hover{transform:translateY(-1px);border-color:rgba(199,154,62,.55);color:var(--navy-950);}
.calc-tab.active{border-color:var(--navy-950);background:var(--navy-950);color:#fff;}
.calc-tab.active span{color:var(--gold-500);}
.calc-tab:focus-visible{outline:3px solid rgba(199,154,62,.35);outline-offset:3px;}
.calc-split{border-radius:18px;border-color:rgba(16,42,76,.14);box-shadow:0 18px 50px rgba(8,31,58,.08);}
.calc-inputs{padding:34px;background:#fff;}
.calc-output{padding:34px;background:linear-gradient(155deg,var(--navy-950),#102f56);}
.calc-simple{border-radius:18px;padding:34px;border-color:rgba(16,42,76,.14);box-shadow:0 18px 50px rgba(8,31,58,.08);}
.calc-simple h2{font-size:1.55rem;}
.calc-results{border-color:rgba(16,42,76,.1);background:linear-gradient(180deg,#f5f7fa,#eef3f6);}
.calculators-workbench-disclaimer{margin-top:22px;padding:18px 20px;border-left:3px solid var(--gold-500);background:#fff;color:var(--ink-soft);font-size:.83rem;line-height:1.6;box-shadow:var(--shadow-sm);}

.calculators-scope-section{background:#fff;}
.calculators-section-intro{max-width:820px;margin-bottom:36px;}
.calculators-section-intro h2{max-width:760px;}
.calculators-scope-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;}
.calculators-scope-card{position:relative;padding:28px;border:1px solid var(--border);border-radius:16px;background:#fff;box-shadow:var(--shadow-sm);overflow:hidden;}
.calculators-scope-card::after{content:"";position:absolute;right:-34px;bottom:-34px;width:105px;height:105px;border:1px solid rgba(199,154,62,.15);border-radius:50%;}
.calculators-scope-no{display:block;margin-bottom:28px;color:var(--gold-700);font-size:.7rem;font-weight:800;letter-spacing:.1em;}
.calculators-scope-card h3{margin:0 0 18px;font-size:1.28rem;}
.calculators-scope-card p{margin:0;padding:12px 0;border-top:1px solid var(--border);color:var(--ink-soft);font-size:.88rem;line-height:1.6;}
.calculators-scope-card p strong{display:block;margin-bottom:4px;color:var(--navy-950);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;}

.calculators-use-section{padding:88px 0;background:var(--navy-950);color:#fff;}
.calculators-use-grid{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:74px;align-items:start;}
.calculators-use-copy h2{max-width:570px;color:#fff;font-size:clamp(2.1rem,3.5vw,3.35rem);}
.calculators-use-copy>p:last-of-type{max-width:590px;color:rgba(255,255,255,.66);line-height:1.7;}
.calculators-use-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;}
.calculators-use-section .btn-outline{border-color:rgba(255,255,255,.4);color:#fff;}
.calculators-use-steps{display:grid;}
.calculators-use-step{display:grid;grid-template-columns:52px minmax(0,1fr);gap:18px;padding:21px 0;border-bottom:1px solid rgba(255,255,255,.12);}
.calculators-use-step:first-child{padding-top:0;}
.calculators-use-step>span{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(199,154,62,.42);border-radius:50%;color:var(--gold-500);font-size:.72rem;font-weight:800;letter-spacing:.07em;}
.calculators-use-step h3{margin:0;color:#fff;font-size:1.02rem;}
.calculators-use-step p{margin:6px 0 0;color:rgba(255,255,255,.59);font-size:.87rem;line-height:1.58;}

@media(max-width:960px){
  .calculators-premium-hero-grid{grid-template-columns:1fr;gap:38px;min-height:0;padding-top:76px;padding-bottom:76px;}
  .calculators-premium-hero-copy{max-width:820px;}
  .calculators-hero-desk{max-width:760px;}
  .calculators-workbench-head{grid-template-columns:1fr;gap:22px;align-items:start;}
  .calculators-workbench-note{max-width:720px;}
  .calculators-use-grid{grid-template-columns:1fr;gap:48px;}
}
@media(max-width:720px){
  .calculators-premium-hero-photo img{object-position:70% center;}
  .calculators-premium-hero-shade{background:linear-gradient(180deg,rgba(5,19,36,.97) 0%,rgba(7,25,47,.92) 58%,rgba(7,25,47,.79) 100%);}
  .calculators-premium-hero-grid{padding-top:60px;padding-bottom:60px;}
  .calculators-premium-hero h1{max-width:11ch;font-size:clamp(2.55rem,12vw,4rem);}
  .calculators-premium-hero-sub{font-size:var(--fs-md);}
  .calculators-premium-hero-actions{display:grid;grid-template-columns:1fr;}
  .calculators-premium-hero-actions .btn{width:100%;justify-content:center;}
  .calculators-premium-hero-assurances{flex-direction:column;gap:9px;}
  .calculators-hero-desk{display:none;}
  .calculators-hero-desk-head{padding:24px 20px 18px;}
  .calculators-hero-tool{grid-template-columns:28px 30px minmax(0,1fr);gap:10px;padding:15px 20px;}
  .calculators-hero-tool small{font-size:.74rem;}
  .calc-tabs{grid-template-columns:repeat(2,minmax(0,1fr));}
  .calc-tab{padding:13px 10px;font-size:.82rem;}
  .calc-inputs,.calc-output,.calc-simple{padding:24px 20px;}
  .calculators-scope-grid{grid-template-columns:1fr;}
  .calculators-use-section{padding:72px 0;}
  .calculators-use-actions{display:grid;grid-template-columns:1fr;}
  .calculators-use-actions .btn{width:100%;justify-content:center;}
}
@media(max-width:480px){
  .calc-tabs{grid-template-columns:1fr 1fr;gap:7px;}
  .calc-tab{justify-content:flex-start;}
  .calc-big{font-size:2.05rem;}
  .calc-out-row,.calc-result-row{align-items:flex-start;}
  .calc-out-row strong,.calc-result-row strong{text-align:right;}
}
@media(prefers-reduced-motion:reduce){
  .calc-tab{transition:none;}
  .calc-tab:hover{transform:none;}
}
</style>`;

function incomeTaxPanel() {
  const calc = data.calculators || {};
  const tables = calc.taxTables || [];
  const fyHint = esc(calc.incomeTaxFYHint || '');
  const capLife = calc.deductionCapLife != null ? calc.deductionCapLife.toLocaleString('en-IN') : '40,000';
  const capHealth = calc.deductionCapHealth != null ? calc.deductionCapHealth.toLocaleString('en-IN') : '20,000';
  const capRetirement = calc.deductionCapRetirement != null ? calc.deductionCapRetirement.toLocaleString('en-IN') : '5,00,000';

  // Build FY toggle buttons from YAML — auto-sizes the grid to the number of FYs.
  // The latest configured schedule is the default; older years remain selectable.
  const fyCount = tables.length;
  const activeFyIndex = Math.max(0, fyCount - 1);
  const fyButtons = tables.map((t, i) =>
    `<button type="button" data-fy="${esc(t.key)}"${i === activeFyIndex ? ' class="active"' : ''}>${esc(t.label)}</button>`
  ).join('');

  return `<div class="calc-panel active" id="calc-tab-tax" role="tabpanel" aria-labelledby="tab-calc-tab-tax" tabindex="0">
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
        <div class="calc-big" id="tax-out-annual" aria-live="polite">NPR 0</div>
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
  return `<div class="calc-panel" id="calc-tab-vat" role="tabpanel" aria-labelledby="tab-calc-tab-vat" tabindex="0">
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
        <div class="calc-result-row total"><span>Amount including VAT</span><strong id="vat-total" aria-live="polite">NPR 0</strong></div>
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
  return `<div class="calc-panel" id="calc-tab-tds" role="tabpanel" aria-labelledby="tab-calc-tab-tds" tabindex="0">
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
        <div class="calc-result-row"><span>TDS to deduct &amp; deposit</span><strong id="tds-tax" aria-live="polite">NPR 0</strong></div>
        <div class="calc-result-row total"><span>Net payable to recipient</span><strong id="tds-net">NPR 0</strong></div>
      </div>
      <p class="calc-note">${tdsNote} <a href="${internalHref('contact.html')}">Confirm the right treatment with Maven</a> before deducting.</p>
    </div>
  </div>`;
}

function emiPanel() {
  return `<div class="calc-panel" id="calc-tab-emi" role="tabpanel" aria-labelledby="tab-calc-tab-emi" tabindex="0">
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
        <div class="calc-result-row total"><span>Monthly EMI</span><strong id="emi-monthly" aria-live="polite">NPR 0</strong></div>
        <div class="calc-result-row"><span>Total Interest Payable</span><strong id="emi-interest">NPR 0</strong></div>
        <div class="calc-result-row"><span>Total Payment (Principal + Interest)</span><strong id="emi-total">NPR 0</strong></div>
      </div>

      <div class="emi-sched-actions">
        <button type="button" id="emi-toggle-sched" class="btn btn-outline btn-sm" aria-expanded="false" aria-controls="emi-sched-wrap" disabled>Show Full Schedule</button>
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

function calculatorHero(h) {
  const tools = [
    { iconName: 'percent', title: 'Salary Income Tax', text: 'Estimate annual salary tax and inspect the slab-by-slab calculation.' },
    { iconName: 'ledger', title: 'VAT', text: 'Add VAT to a base amount or extract VAT from an inclusive total.' },
    { iconName: 'briefcase', title: 'TDS', text: 'Test common withholding scenarios before confirming the statutory treatment.' },
    { iconName: 'trendUp', title: 'Loan EMI', text: 'Model monthly installments and review a full amortization schedule.' },
  ];

  return `<section class="calculators-premium-hero">
    <picture class="calculators-premium-hero-photo" aria-hidden="true">
      <source media="(max-width:640px)" srcset="/images/calculators-hero-bg-640w.jpg">
      <source media="(max-width:960px)" srcset="/images/calculators-hero-bg-960w.jpg">
      <img src="/images/calculators-hero-bg.jpg" alt="" loading="eager" fetchpriority="high">
    </picture>
    <div class="calculators-premium-hero-shade" aria-hidden="true"></div>
    <div class="container calculators-premium-hero-grid">
      <div class="calculators-premium-hero-copy reveal-stagger">
        <p class="eyebrow">${esc(h.eyebrow)}</p>
        <h1>${esc(h.title)}</h1>
        <p class="calculators-premium-hero-sub">${esc(h.subtitle)}</p>
        <div class="calculators-premium-hero-actions">
          ${button('Start Calculating', '#calculator-workbench', 'primary')}
          ${button('Official Reference Links', 'useful-links.html', 'outline')}
        </div>
        <div class="calculators-premium-hero-assurances" aria-label="Calculator approach">
          <span>${icon('check', 'stamp')} 4 live tools</span>
          <span>${icon('check', 'stamp')} Transparent breakdowns</span>
          <span>${icon('check', 'stamp')} Planning estimates</span>
        </div>
      </div>
      <aside class="calculators-hero-desk reveal" aria-label="Calculator desk">
        <div class="calculators-hero-desk-head">
          <p class="eyebrow">Calculation Desk</p>
          <h2>Choose the question, then review the assumptions.</h2>
          <p>These tools are designed to help you plan and understand the mechanics. A result is not the same as a filing position, tax opinion, or lending decision.</p>
        </div>
        <div class="calculators-hero-tool-list">
          ${tools.map((tool, i) => `<div class="calculators-hero-tool">
            <span class="calculators-hero-tool-no">0${i + 1}</span>
            <span class="calculators-hero-tool-icon">${icon(tool.iconName)}</span>
            <span><strong>${esc(tool.title)}</strong><small>${esc(tool.text)}</small></span>
          </div>`).join('')}
        </div>
      </aside>
    </div>
  </section>`;
}

function calculatorScopeGuide() {
  const items = [
    { title: 'Income Tax', best: 'Salary planning and understanding slab mechanics.', limit: 'Does not capture every allowance, exemption, income type, residency issue, or filing fact.' },
    { title: 'VAT', best: 'Quickly adding or extracting the configured standard VAT rate.', limit: 'Does not determine whether a transaction is taxable, exempt, zero-rated, or subject to special treatment.' },
    { title: 'TDS', best: 'Testing common withholding-rate scenarios on a VAT-exclusive payment amount.', limit: 'The correct rate can depend on recipient status, payment nature, thresholds, exemptions, and current law.' },
    { title: 'Loan EMI', best: 'Planning installment size and viewing an indicative repayment schedule.', limit: 'A bank may use different compounding, fees, reset terms, insurance, or approval criteria.' },
  ];
  return `<section class="section-pad calculators-scope-section">
    <div class="container">
      <div class="section-intro calculators-section-intro reveal">
        <p class="eyebrow">Know the Boundary</p>
        <h2>What each calculator can — and cannot — tell you.</h2>
        <p>Use the tools to organize a question and understand direction. Confirm anything that affects a filing, deduction, statutory payment, payroll decision, financing application, or material business decision.</p>
      </div>
      <div class="calculators-scope-grid reveal-stagger">
        ${items.map((item, i) => `<article class="calculators-scope-card">
          <span class="calculators-scope-no">0${i + 1}</span>
          <h3>${esc(item.title)}</h3>
          <p><strong>Useful for</strong>${esc(item.best)}</p>
          <p><strong>Does not determine</strong>${esc(item.limit)}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>`;
}

function calculatorUseSection() {
  const steps = [
    ['01', 'Choose the right period', 'For tax calculations, select the fiscal-year table that matches the period you are reviewing.'],
    ['02', 'Enter the actual facts', 'Use the real income, payment, contribution, loan, rate, or tenure information relevant to the scenario.'],
    ['03', 'Read the breakdown', 'Do not rely only on the headline number. Review the assumptions, slabs, rates and notes shown with the result.'],
    ['04', 'Confirm before acting', 'Where money will be filed, deducted, paid, reported or borrowed, verify the current treatment or obtain professional review.'],
  ];
  return `<section class="calculators-use-section">
    <div class="container calculators-use-grid">
      <div class="calculators-use-copy reveal">
        <p class="eyebrow">Use the Tools Well</p>
        <h2>Estimate first. Confirm before the number becomes an obligation.</h2>
        <p>Good financial tools make assumptions visible. They should help you ask a better question — not hide the judgement that still needs to happen.</p>
        <div class="calculators-use-actions">
          ${button('Review Official Links', 'useful-links.html', 'outline')}
          ${button('Discuss Your Calculation', 'contact.html', 'primary')}
        </div>
      </div>
      <div class="calculators-use-steps reveal-stagger">
        ${steps.map(([no, title, text]) => `<div class="calculators-use-step"><span>${no}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></div>`).join('')}
      </div>
    </div>
  </section>`;
}

function calculators() {
  const h = data.pageHeader('calculators');
  return `
  ${calcStyles}
  ${calculatorHero(h)}

  <section class="section-pad calculators-workbench-section" id="calculator-workbench">
    <div class="container calculators-workbench-container">
      <div class="calculators-workbench-head reveal">
        <div>
          <p class="eyebrow">Financial Tools</p>
          <h2>Choose a calculator and work through the assumptions.</h2>
        </div>
        <div class="calculators-workbench-note">
          ${icon('shield')}
          <p><strong>Estimate, then verify.</strong> Tax, withholding and compliance rules can change. The configured rates support planning; confirm current treatment before filing or deducting.</p>
        </div>
      </div>

      <!-- Complete WAI-ARIA Tabs pattern: roving tabindex, arrow-key navigation,
      aria-selected/aria-controls on each tab and matching tabpanel labelling. -->
      <div class="calc-tabs" role="tablist" aria-label="Calculator type">
        <button type="button" role="tab" id="tab-calc-tab-tax" class="calc-tab active" data-target="calc-tab-tax" aria-selected="true" aria-controls="calc-tab-tax" tabindex="0"><span>01</span> Income Tax</button>
        <button type="button" role="tab" id="tab-calc-tab-vat" class="calc-tab" data-target="calc-tab-vat" aria-selected="false" aria-controls="calc-tab-vat" tabindex="-1"><span>02</span> VAT</button>
        <button type="button" role="tab" id="tab-calc-tab-tds" class="calc-tab" data-target="calc-tab-tds" aria-selected="false" aria-controls="calc-tab-tds" tabindex="-1"><span>03</span> TDS</button>
        <button type="button" role="tab" id="tab-calc-tab-emi" class="calc-tab" data-target="calc-tab-emi" aria-selected="false" aria-controls="calc-tab-emi" tabindex="-1"><span>04</span> Loan EMI</button>
      </div>

      ${incomeTaxPanel()}
      ${vatPanel()}
      ${tdsPanel()}
      ${emiPanel()}

      <div class="calculators-workbench-disclaimer reveal">These tools provide planning estimates only. They do not constitute tax, legal, audit, investment, lending, or other regulated financial advice. Confirm current law, rates, facts and professional requirements before acting on a result.</div>
    </div>
  </section>

  ${calculatorScopeGuide()}
  ${calculatorUseSection()}

  ${ctaBand({
    eyebrow: 'Beyond the Estimate',
    title: 'Need the number checked for your actual situation?',
    subtitle: 'Maven can review the facts behind a tax, payroll, compliance, reporting or loan-planning question and help define the next practical step.',
    buttons: [button('Book an Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I used your calculator and would like help reviewing the result for my situation.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

module.exports = { calculators };
