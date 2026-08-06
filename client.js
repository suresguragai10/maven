(function () {
  'use strict';

  // ---- Footer year ----
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Mobile nav ----
  var navToggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');
  var mobileClose = document.querySelector('.mobile-nav-close');
  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }
  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.add('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
  }
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', openMobileNav);
  }
  if (mobileClose) mobileClose.addEventListener('click', closeMobileNav);
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMobileNav);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav && mobileNav.classList.contains('is-open')) closeMobileNav();
  });

  // ---- Header scroll shadow ----
  var header = document.querySelector('.site-header');
  if (header) {
    var onScrollHeader = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScrollHeader, { passive: true });
    onScrollHeader();
  }

  // ---- Back to top ----
  var backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    var onScrollTop = function () {
      backToTop.classList.toggle('is-visible', window.scrollY > 480);
    };
    window.addEventListener('scroll', onScrollTop, { passive: true });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    onScrollTop();
  }

  // ---- Accordions (FAQ + Documents Needed) ----
  document.querySelectorAll('.accordion-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.accordion-item');
      var panel = item.querySelector('.accordion-panel');
      var isOpen = item.classList.contains('is-open');
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = '0px';
      }
    });
  });

  // ---- Industry card expand (Industries page) ----
  // Same expand/collapse technique as the accordion above, kept separate
  // (distinct classes/state target) because the trigger here is a card
  // footer, not a full-width question row, and lives inside a grid rather
  // than a single stacked list.
  function setIndustryCardOpen(card, open) {
    var btn = card.querySelector('.industry-card-toggle');
    var panel = card.querySelector('.industry-card-panel');
    if (!btn || !panel) return;
    card.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
  }
  document.querySelectorAll('.industry-card-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.industry-card');
      setIndustryCardOpen(card, !card.classList.contains('is-open'));
    });
  });
  // Homepage/About industry badges link here as #industry-N (see ui.js
  // industryBadge) — a visitor clicking "Startups" on the homepage wants to
  // land ON that industry's detail, not back on a page of collapsed cards
  // they have to re-find it on. Opens the matching card and scrolls to it.
  if (location.hash.indexOf('#industry-') === 0) {
    var panelId = 'panel-' + location.hash.slice(1);
    var panelEl = document.getElementById(panelId);
    var cardEl = panelEl ? panelEl.closest('.industry-card') : null;
    if (cardEl) {
      setIndustryCardOpen(cardEl, true);
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ---- Hero mockup card (Registration/Accounting/Tax/Payroll/Reports) ----
  // Purely decorative: auto-cycles through the tabs, and clicking a tab jumps
  // there and stops the auto-cycle (once a visitor engages, don't yank their
  // choice away). Each tab reveals its own panel of 3 real service items
  // (rendered server-side from content/site.yaml — see pages1.js docCardArt).
  var docCard = document.querySelector('.doc-card');
  if (docCard) {
    var docTabs = docCard.querySelectorAll('.doc-card-tab');
    var docPanels = docCard.querySelectorAll('.doc-card-panel');
    var docActiveIndex = 0;
    var docCycleTimer = null;

    var setActiveDocTab = function (idx) {
      docActiveIndex = idx;
      docTabs.forEach(function (tab, i) {
        tab.classList.toggle('is-active', i === idx);
        tab.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
      });
      docPanels.forEach(function (panel, i) {
        panel.classList.toggle('is-active', i === idx);
      });
    };

    var stopDocCycle = function () {
      if (docCycleTimer) { clearInterval(docCycleTimer); docCycleTimer = null; }
    };

    docTabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        stopDocCycle();
        setActiveDocTab(i);
      });
    });

    setActiveDocTab(0);
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && docTabs.length) {
      docCycleTimer = setInterval(function () {
        setActiveDocTab((docActiveIndex + 1) % docTabs.length);
      }, 3000);
    }
  }

  // ---- Scroll reveal ----
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );
      revealEls.forEach(function (el) { obs.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  // ---- Contact / inquiry form ----
  var form = document.getElementById('inquiryForm');
  if (form) {
    var buildSummary = function (get) {
      return [
        'New website inquiry — ' + (window.MAVEN && window.MAVEN.brandName ? window.MAVEN.brandName : 'Maven Consultancy'),
        'Name: ' + get('name'),
        'Business name: ' + (get('business') || '-'),
        'Phone: ' + get('phone'),
        'Email: ' + (get('email') || '-'),
        'Service required: ' + get('service'),
        'Business type: ' + (get('businessType') || '-'),
        'Message: ' + get('message'),
      ].join('\n');
    };

    var showFallback = function (summary, hadFile) {
      var cfg = window.MAVEN || {};
      var subject = encodeURIComponent('Website Inquiry');
      var body = encodeURIComponent(summary);
      var mailLink = document.getElementById('sendEmailLink');
      var waLink = document.getElementById('sendWhatsAppLink');
      if (mailLink && cfg.email) mailLink.href = 'mailto:' + cfg.email + '?subject=' + subject + '&body=' + body;
      if (waLink && cfg.whatsapp) waLink.href = 'https://wa.me/' + cfg.whatsapp + '?text=' + body;
      var summaryBox = document.getElementById('formSummaryText');
      if (summaryBox) summaryBox.textContent = summary;
      var fileNote = document.getElementById('formFileNote');
      if (fileNote) fileNote.hidden = !hadFile;
      var resultBox = document.getElementById('formResult');
      if (resultBox) {
        resultBox.hidden = false;
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // hadFile: Formspree's free plan doesn't accept file uploads, so any file
    // chosen in the form is never actually sent — the success message must say
    // so explicitly rather than let the user believe it went through.
    var showSuccess = function (hadFile) {
      var resultBox = document.getElementById('formResult');
      if (resultBox) {
        var fileNote = hadFile
          ? ' <strong>Note: the file you attached was not included</strong> — please send it to us directly by email or WhatsApp so we have it.'
          : '';
        resultBox.innerHTML = '<h3>✓ Inquiry sent — thank you!</h3><p class="tag-note">We\'ve received your message and will get back to you within one business day. If it\'s urgent, feel free to call or WhatsApp us directly.' + fileNote + '</p>';
        resultBox.hidden = false;
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      form.reset();
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var get = function (k) { return (fd.get(k) || '').toString().trim(); };

      var fileInput = document.getElementById('f-file');
      var hasFile = !!(fileInput && fileInput.files && fileInput.files.length);

      // Honeypot: if this hidden field is filled, it's almost certainly a bot.
      // Pretend success and silently drop the submission.
      if (get('company_website')) { showSuccess(hasFile); return; }

      var name = get('name');
      var phone = get('phone');
      var service = get('service');
      var message = get('message');
      var email = get('email');
      var errorEl = document.getElementById('formError');

      if (!name || !phone || !service || !message) {
        if (errorEl) {
          errorEl.textContent = 'Please fill in your name, phone, service required, and message before sending.';
          errorEl.hidden = false;
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorEl) {
          errorEl.textContent = 'That email address doesn\'t look valid. Please check it or leave it blank.';
          errorEl.hidden = false;
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      if (errorEl) errorEl.hidden = true;

      var summary = buildSummary(get);
      var cfg = window.MAVEN || {};

      // If a Formspree form ID is configured, submit directly (attachments excluded —
      // they aren't supported on Formspree's free plan; users can email files separately).
      if (cfg.formspree) {
        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
        var payload = new FormData();
        payload.append('name', name);
        payload.append('business', get('business'));
        payload.append('phone', phone);
        payload.append('email', get('email'));
        payload.append('service', service);
        payload.append('businessType', get('businessType'));
        payload.append('message', message);
        payload.append('_subject', 'Website Inquiry - ' + name);
        // Accept either a bare Formspree ID (e.g. "xgojnjby") or a full URL,
        // so a misconfigured value never doubles the endpoint.
        var fsId = String(cfg.formspree).trim();
        var fsUrl = /^https?:\/\//i.test(fsId) ? fsId : ('https://formspree.io/f/' + fsId);
        fetch(fsUrl, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
        }).then(function (res) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Send Inquiry'; }
          if (res.ok) { showSuccess(hasFile); } else { showFallback(summary, hasFile); }
        }).catch(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Send Inquiry'; }
          showFallback(summary, hasFile);
        });
        return;
      }

      // No Formspree configured — fall back to email/WhatsApp handoff.
      showFallback(summary, hasFile);
    });
  }

  // ==================== Calculators (calculators.html only) ====================
  var fmtNPR = function (n) {
    if (!isFinite(n) || isNaN(n)) return 'NPR 0';
    return 'NPR ' + Math.round(n).toLocaleString('en-IN');
  };
  var num = function (id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(el.value);
    return isFinite(v) && v > 0 ? v : 0;
  };
  var setText = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  // Wire a segmented-control group: buttons inside get .active on click, then cb(value).
  var wireSeg = function (segId, attr, cb) {
    var seg = document.getElementById(segId);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        cb(b.getAttribute(attr));
      });
    });
  };
  var liveInputs = function (ids, cb) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', cb);
        el.addEventListener('change', cb);
      }
    });
  };

  // ---- Tab switching ----
  var tabBar = document.querySelector('.calc-tabs');
  if (tabBar) {
    tabBar.querySelectorAll('.calc-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabBar.querySelectorAll('.calc-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.calc-panel').forEach(function (p) { p.classList.remove('active'); });
        var panel = document.getElementById(tab.getAttribute('data-target'));
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ---- Income tax calculator ----
  // Slab data comes from window.MAVEN.calc (injected at build time from content/site.yaml).
  // To update slabs: Admin Panel -> Tax & Calculator Rates. No code change needed.
  var _calc = (window.MAVEN && window.MAVEN.calc) || {};
  var _capRetirement = _calc.deductionCapRetirement != null ? _calc.deductionCapRetirement : 500000;
  var _capLife = _calc.deductionCapLife != null ? _calc.deductionCapLife : 40000;
  var _capHealth = _calc.deductionCapHealth != null ? _calc.deductionCapHealth : 20000;
  var TAX_TABLES = {};
  (_calc.taxTables || []).forEach(function (t) { TAX_TABLES[t.key] = t; });

  // Defined in tax-calc.js, inlined into the page just before this script
  // (see build.js) so it's a plain global here — also unit-tested directly
  // as a Node module in test/tax-calc.test.js.
  var computeSlabs = TaxCalc.computeSlabs;

  var taxPanel = document.getElementById('calc-tab-tax');
  if (taxPanel) {
    var taxState = { fy: '2082', status: 'single', gender: 'other' };

    var refreshStatusSeg = function () {
      var table = TAX_TABLES[taxState.fy];
      var seg = document.getElementById('tax-status-seg');
      var hint = document.getElementById('tax-status-hint');
      var coupleBtn = seg ? seg.querySelector('[data-status="couple"]') : null;
      if (!table.hasCouple) {
        taxState.status = 'single';
        if (seg) {
          seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
          seg.querySelector('[data-status="single"]').classList.add('active');
        }
        if (coupleBtn) coupleBtn.disabled = true;
        if (hint) hint.textContent = 'FY 2083/84 uses one unified schedule for all filers — no separate couple slabs.';
      } else {
        if (coupleBtn) coupleBtn.disabled = false;
        if (hint) hint.textContent = '';
      }
    };

    var recalcTax = function () {
      var table = TAX_TABLES[taxState.fy];
      var monthly = num('tax-monthly-salary');
      var months = Math.min(num('tax-months') || 12, 14);
      var bonus = num('tax-bonus');
      var gross = monthly * months + bonus;

      // Deduction caps
      var retirement = Math.min(num('tax-retirement'), _capRetirement, gross / 3);
      var life = Math.min(num('tax-life'), _capLife);
      var health = Math.min(num('tax-health'), _capHealth);
      var deductions = Math.min(gross, retirement + life + health);
      var taxable = Math.max(0, gross - deductions);

      var bands = (taxState.status === 'couple' && table.hasCouple) ? table.couple : table.single;
      var isSSF = document.getElementById('tax-ssf').checked;
      var result = computeSlabs(bands, taxable, isSSF);

      // Female rebate: 10% on computed tax, individual filing only
      var rebate = 0;
      var rebateRow = document.getElementById('tax-out-rebate-row');
      if (taxState.gender === 'female' && taxState.status === 'single' && result.total > 0) {
        rebate = result.total * 0.10;
        if (rebateRow) rebateRow.style.display = 'flex';
        setText('tax-out-rebate', '− ' + fmtNPR(rebate).replace('NPR ', 'NPR '));
      } else if (rebateRow) {
        rebateRow.style.display = 'none';
      }
      var finalTax = result.total - rebate;

      setText('tax-out-fy', table.label);
      setText('tax-out-annual', fmtNPR(finalTax));
      setText('tax-out-monthly', fmtNPR(finalTax / 12) + ' / month');
      setText('tax-out-gross', fmtNPR(gross));
      setText('tax-out-deductions', fmtNPR(deductions));
      setText('tax-out-taxable', fmtNPR(taxable));
      setText('tax-out-effective', taxable > 0 ? ((finalTax / taxable) * 100).toFixed(2) + '%' : '0%');
      setText('tax-out-net', fmtNPR(gross - finalTax));
      setText('tax-out-disclaimer', table.disclaimer);

      var tbody = document.getElementById('tax-out-slabs');
      if (tbody) {
        if (taxable <= 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="calc-empty">Enter your salary to see the breakdown.</td></tr>';
        } else {
          var html = result.rows.map(function (r) {
            return '<tr><td>' + r.label + '</td><td>' + r.rate + '</td><td>' + Math.round(r.tax).toLocaleString('en-IN') + '</td></tr>';
          }).join('');
          if (isSSF) html += '<tr><td colspan="3" style="font-size:.72rem;color:rgba(255,255,255,.45)">* 1% SST waived — SSF contributor</td></tr>';
          tbody.innerHTML = html;
        }
      }
    };

    wireSeg('tax-fy-seg', 'data-fy', function (v) { taxState.fy = v; refreshStatusSeg(); recalcTax(); });
    wireSeg('tax-status-seg', 'data-status', function (v) { taxState.status = v; recalcTax(); });
    wireSeg('tax-gender-seg', 'data-gender', function (v) { taxState.gender = v; recalcTax(); });
    liveInputs(['tax-monthly-salary', 'tax-months', 'tax-bonus', 'tax-retirement', 'tax-life', 'tax-health', 'tax-ssf'], recalcTax);
    refreshStatusSeg();
    recalcTax();
  }

  // ---- VAT calculator (live) ----
  var vatPanelEl = document.getElementById('calc-tab-vat');
  if (vatPanelEl) {
    var vatMode = 'add';
    var VAT_RATE = (_calc.vatRate != null ? _calc.vatRate : 13) / 100;
    var recalcVat = function () {
      var amt = num('vat-amount');
      var result = CalcUtils.computeVat(amt, VAT_RATE, vatMode);
      setText('vat-base', fmtNPR(result.base));
      setText('vat-tax', fmtNPR(result.vat));
      setText('vat-total', fmtNPR(result.total));
    };
    wireSeg('vat-mode-seg', 'data-mode', function (v) { vatMode = v; recalcVat(); });
    liveInputs(['vat-amount'], recalcVat);
    recalcVat();
  }

  // ---- TDS calculator (live) ----
  var tdsPanelEl = document.getElementById('calc-tab-tds');
  if (tdsPanelEl) {
    var recalcTds = function () {
      var sel = document.getElementById('tds-type');
      var rate = parseFloat(sel.value) || 0;
      var amt = num('tds-amount');
      var tds = (amt * rate) / 100;
      setText('tds-rate', rate + '%');
      setText('tds-tax', fmtNPR(tds));
      setText('tds-net', fmtNPR(amt - tds));
    };
    liveInputs(['tds-type', 'tds-amount'], recalcTds);
    recalcTds();
  }

  // ---- EMI calculator (live) ----
  var emiPanelEl = document.getElementById('calc-tab-emi');
  if (emiPanelEl) {
    // Holds the most recent computed schedule so the CSV export matches what's on screen.
    var emiSchedule = null;
    var emiLastInputs = null;

    // Plain-number formatter for the schedule table (no "NPR " prefix, keeps columns tight).
    var fmtNum = function (n) {
      if (!isFinite(n) || isNaN(n)) return '0';
      return Math.round(n).toLocaleString('en-IN');
    };

    // Build the full month-by-month amortization schedule from the loan inputs.
    // Defined in calc-utils.js (inlined just before this script — see build.js),
    // also unit-tested as a Node module in test/calc-utils.test.js.
    var buildSchedule = CalcUtils.buildSchedule;

    var renderScheduleTable = function (schedule) {
      var body = document.getElementById('emi-sched-body');
      if (!body) return;
      var html = '';
      var totalPrincipal = 0, totalInterest = 0, totalEmi = 0;
      schedule.rows.forEach(function (row) {
        totalPrincipal += row.principal;
        totalInterest += row.interest;
        totalEmi += row.emi;
        html += '<tr>'
          + '<td>' + row.month + '</td>'
          + '<td>' + fmtNum(row.opening) + '</td>'
          + '<td>' + fmtNum(row.principal) + '</td>'
          + '<td>' + fmtNum(row.interest) + '</td>'
          + '<td>' + fmtNum(row.emi) + '</td>'
          + '<td>' + fmtNum(row.closing) + '</td>'
          + '</tr>';
      });
      body.innerHTML = html;
      // Footer totals row.
      var table = body.parentNode;
      var oldFoot = table.querySelector('tfoot');
      if (oldFoot) oldFoot.parentNode.removeChild(oldFoot);
      var foot = document.createElement('tfoot');
      foot.innerHTML = '<tr>'
        + '<td>Total</td><td></td>'
        + '<td>' + fmtNum(totalPrincipal) + '</td>'
        + '<td>' + fmtNum(totalInterest) + '</td>'
        + '<td>' + fmtNum(totalEmi) + '</td>'
        + '<td></td></tr>';
      table.appendChild(foot);
    };

    var toggleBtn = document.getElementById('emi-toggle-sched');
    var exportBtn = document.getElementById('emi-export-sched');
    var schedWrap = document.getElementById('emi-sched-wrap');

    var recalcEmi = function () {
      var P = num('emi-amount');
      var annual = parseFloat(document.getElementById('emi-rate').value);
      var years = num('emi-years');
      var valid = (P > 0) && (years > 0) && Math.round(years * 12) >= 1 && isFinite(annual) && annual >= 0;

      if (!valid) {
        setText('emi-monthly', 'NPR 0'); setText('emi-interest', 'NPR 0'); setText('emi-total', 'NPR 0');
        emiSchedule = null; emiLastInputs = null;
        if (toggleBtn) { toggleBtn.disabled = true; }
        if (exportBtn) { exportBtn.hidden = true; }
        if (schedWrap) { schedWrap.hidden = true; }
        if (toggleBtn) { toggleBtn.textContent = 'Show Full Schedule'; }
        return;
      }

      var n = Math.round(years * 12);
      emiSchedule = buildSchedule(P, annual, n);
      emiLastInputs = { P: P, annual: annual, years: years, n: n };
      var emi = emiSchedule.emi;
      var total = emi * n;
      setText('emi-monthly', fmtNPR(emi));
      setText('emi-interest', fmtNPR(total - P));
      setText('emi-total', fmtNPR(total));

      if (toggleBtn) toggleBtn.disabled = false;
      // If the schedule is already open, refresh it live as inputs change.
      if (schedWrap && !schedWrap.hidden) {
        renderScheduleTable(emiSchedule);
        if (exportBtn) exportBtn.hidden = false;
      }
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (!emiSchedule) return;
        var isHidden = schedWrap.hidden;
        if (isHidden) {
          renderScheduleTable(emiSchedule);
          schedWrap.hidden = false;
          if (exportBtn) exportBtn.hidden = false;
          toggleBtn.textContent = 'Hide Full Schedule';
        } else {
          schedWrap.hidden = true;
          if (exportBtn) exportBtn.hidden = true;
          toggleBtn.textContent = 'Show Full Schedule';
        }
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!emiSchedule || !emiLastInputs) return;
        var lines = [];
        // A short header block so the file is self-explanatory when opened later.
        lines.push('Loan EMI Schedule - Maven Consultancy');
        lines.push('Loan Amount (NPR),' + Math.round(emiLastInputs.P));
        lines.push('Annual Interest Rate (%),' + emiLastInputs.annual);
        lines.push('Tenure (Years),' + emiLastInputs.years);
        lines.push('Number of Months,' + emiLastInputs.n);
        lines.push('Monthly EMI (NPR),' + Math.round(emiSchedule.emi));
        lines.push('');
        lines.push('Month,Opening Balance,Principal,Interest,EMI,Closing Balance');
        var tP = 0, tI = 0, tE = 0;
        emiSchedule.rows.forEach(function (row) {
          tP += row.principal; tI += row.interest; tE += row.emi;
          lines.push([
            row.month,
            Math.round(row.opening),
            Math.round(row.principal),
            Math.round(row.interest),
            Math.round(row.emi),
            Math.round(row.closing),
          ].join(','));
        });
        lines.push(['Total', '', Math.round(tP), Math.round(tI), Math.round(tE), ''].join(','));

        // Prepend a BOM so Excel opens the UTF-8 file with correct number formatting.
        var csv = '\ufeff' + lines.join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'emi-schedule.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }

    liveInputs(['emi-amount', 'emi-rate', 'emi-years'], recalcEmi);
    recalcEmi();
  }
})();
