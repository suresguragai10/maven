(function () {
  'use strict';

  function motionReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function scrollElementIntoView(target, block) {
    if (!target || typeof target.scrollIntoView !== 'function') return;
    target.scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: block || 'center' });
  }

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
    // Return focus to whatever opened the menu — without this, a keyboard
    // user closing the menu (Escape, or the close button) lands nowhere,
    // effectively losing their place on the page.
    if (navToggle) navToggle.focus();
  }
  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.add('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
    // Move focus into the panel on open — the overlay covers the whole
    // viewport so background content can't be clicked, but without this a
    // keyboard user's focus would stay stranded on the (now hidden) toggle.
    if (mobileClose) mobileClose.focus();
  }
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', openMobileNav);
  }
  if (mobileClose) mobileClose.addEventListener('click', closeMobileNav);
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMobileNav);
    });
    // Per-submenu expand/collapse — same aria-expanded/aria-controls +
    // max-height technique as the accordion below, kept collapsed by
    // default so opening the menu doesn't dump every dropdown's children
    // into one long flat list at once. Handbook Task 25: also toggles
    // `inert` — the submenu starts inert (see layout.js) so its links are
    // out of Tab order while collapsed; removed on open, restored on
    // close, so the visible/focusable state and the visual state never
    // disagree.
    mobileNav.querySelectorAll('.mobile-sub-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sub = document.getElementById(btn.getAttribute('aria-controls'));
        if (!sub) return;
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) {
          sub.removeAttribute('inert');
          sub.style.maxHeight = sub.scrollHeight + 'px';
        } else {
          sub.style.maxHeight = '0px';
          sub.setAttribute('inert', '');
        }
      });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!mobileNav || !mobileNav.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeMobileNav(); return; }
    // Trap Tab focus inside the open menu — without this, tabbing past the
    // last link would leave the visible panel and land on content sitting
    // behind the (fixed, full-viewport) overlay. Handbook Task 25: the
    // candidate list now excludes anything inert (a collapsed submenu's
    // links) — those were never really reachable by a real Tab press once
    // `inert` was added, but calling .focus() on one here would silently
    // fail and could strand the wrap-around logic, so they're filtered
    // out up front rather than relied on to just not match.
    if (e.key === 'Tab') {
      var focusable = Array.prototype.slice.call(mobileNav.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return !el.closest('[inert]'); });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
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
      window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' });
    });
    onScrollTop();
  }

  // ---- Accordions (FAQ + Documents Needed + Support Areas + every other
  // FAQ-shaped block — all render through ui.js's one accordionItem(), so
  // one fix here covers every instance) ----
  // Handbook Task 25: the server already renders a pre-opened item's panel
  // at its real height (style="max-height:none", see ui.js) so it's
  // genuinely visible before this script even runs. `none` can't be
  // CSS-transitioned from, though, so on load it's converted to the
  // equivalent pixel value here — a no-op visually, but it means the
  // FIRST click on that item (closing it) actually animates instead of
  // jumping. This is also where the old "first click looks like nothing
  // happened" bug lived: previously the server sent NO inline style for
  // an open panel, leaving it at the CSS default (max-height:0) despite
  // is-open/aria-expanded="true" already being set — so the first click
  // read the (wrong) already-open state and "closed" an already-invisible
  // panel. Kept out of the shared accordionOpenPanels() helper below
  // (documented there) since this pass only ever runs once, at load.
  var openAccordionPanelsAtLoad = document.querySelectorAll('.accordion-item.is-open .accordion-panel');
  openAccordionPanelsAtLoad.forEach(function (panel) {
    panel.style.maxHeight = panel.scrollHeight + 'px';
  });

  document.querySelectorAll('.accordion-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.accordion-item');
      var panel = item.querySelector('.accordion-panel');
      var isOpen = item.classList.contains('is-open');
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        panel.removeAttribute('inert');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = '0px';
        panel.setAttribute('inert', '');
      }
    });
  });

  // ---- Industries master/detail selector ----
  // Detail no longer expands inside a CSS-grid card. A single full-width
  // stage below the card grid prevents the tall-card/empty-sibling bug and
  // keeps scanning stable on desktop and mobile.
  var industrySelectButtons = document.querySelectorAll('.industry-card-select');
  var industryDetails = document.querySelectorAll('[data-industry-detail]');
  var industryPlaceholder = document.getElementById('industry-detail-placeholder');
  function selectIndustry(index, shouldScroll) {
    var target = document.querySelector('[data-industry-detail="' + index + '"]');
    if (!target) return;
    industryDetails.forEach(function (panel) { panel.hidden = panel !== target; });
    industrySelectButtons.forEach(function (btn) {
      var selected = btn.getAttribute('data-industry-index') === String(index);
      btn.setAttribute('aria-expanded', String(selected));
      var card = btn.closest('.industry-card');
      if (card) card.classList.toggle('is-selected', selected);
    });
    if (industryPlaceholder) industryPlaceholder.hidden = true;
    if (history && history.replaceState) history.replaceState(null, '', '#industry-' + index);
    if (shouldScroll) {
      scrollElementIntoView(target, 'start');
    }
  }
  industrySelectButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { selectIndustry(btn.getAttribute('data-industry-index'), true); });
  });
  if (location.hash.indexOf('#industry-') === 0) {
    var industryIndex = location.hash.replace('#industry-', '');
    if (/^\d+$/.test(industryIndex)) selectIndustry(industryIndex, false);
  }

  // ---- Recalculate open accordion/industry-card panel heights on resize
  // (Handbook Task 25) ----
  // An open panel's max-height is a snapshot (panel.scrollHeight) taken at
  // the moment it was opened. If the viewport is resized or rotated after
  // that — a phone going portrait->landscape, a window being resized —
  // the content can reflow to a different height (text rewrapping changes
  // line count) while the stale inline max-height stays put, clipping
  // content or leaving dead space. Debounced (resize/orientationchange
  // both fire in bursts) and only ever touches panels that are actually
  // open right now — closed panels stay at max-height:0 regardless.
  var recalcOpenPanelsTimer = null;
  function recalcOpenPanelsNow() {
    document.querySelectorAll('.accordion-item.is-open .accordion-panel').forEach(function (panel) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    });
  }
  window.addEventListener('resize', function () {
    if (recalcOpenPanelsTimer) clearTimeout(recalcOpenPanelsTimer);
    recalcOpenPanelsTimer = setTimeout(recalcOpenPanelsNow, 150);
  });
  window.addEventListener('orientationchange', recalcOpenPanelsNow);

  // ---- Desktop nav dropdowns (Handbook Task 25) ----
  // The dropdown parent link (.nav-link) still navigates straight to its
  // own href — that "clear Overview destination" is untouched. This adds
  // an explicit, independent toggle (the .nav-dropdown-toggle button next
  // to it — see layout.js) so a tap/click/keyboard user gets real
  // aria-expanded state instead of relying only on :hover/:focus-within
  // (still present in CSS as a fine-pointer enhancement, guarded by
  // `(hover: hover)` — see styles.css). Previously the parent link tried
  // to both navigate AND be the only way to reveal the dropdown, which on
  // a touch device is ambiguous: a tap just navigates away immediately,
  // with no way to see the children first.
  function closeAllNavDropdowns(except) {
    document.querySelectorAll('.nav-item.is-open').forEach(function (item) {
      if (item === except) return;
      item.classList.remove('is-open');
      var t = item.querySelector('.nav-dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }
  document.querySelectorAll('.nav-item').forEach(function (item) {
    var toggle = item.querySelector('.nav-dropdown-toggle');
    var dropdown = item.querySelector('.dropdown');
    if (!toggle || !dropdown) return;
    function setDropdownOpen(open) {
      item.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !item.classList.contains('is-open');
      // Only one dropdown open at a time — a click on a different item's
      // toggle calls stopPropagation, so the document-level "click
      // outside" listener below never sees it and would otherwise leave
      // multiple dropdowns open simultaneously.
      if (willOpen) closeAllNavDropdowns(item);
      setDropdownOpen(willOpen);
    });
  });
  // Click outside any open dropdown closes it — without this, a JS-opened
  // (tapped) dropdown would only ever close via its own toggle button.
  document.addEventListener('click', function (e) {
    var openItem = document.querySelector('.nav-item.is-open');
    if (openItem && !openItem.contains(e.target)) closeAllNavDropdowns(null);
  });
  // Escape closes whichever dropdown is open and returns focus to its
  // toggle — same "don't strand keyboard focus" principle as the mobile
  // nav's own Escape handling above.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openItem = document.querySelector('.nav-item.is-open');
    if (!openItem) return;
    var toggle = openItem.querySelector('.nav-dropdown-toggle');
    closeAllNavDropdowns(null);
    if (toggle) toggle.focus();
  });
  // Tabbing out of an open dropdown entirely (not just moving between its
  // own links) should close it — otherwise it can stay visually open,
  // detached from focus, after a keyboard user has moved on.
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (item.classList.contains('is-open') && !item.contains(document.activeElement)) {
          item.classList.remove('is-open');
          var toggle = item.querySelector('.nav-dropdown-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
      }, 0);
    });
  });

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
    if (!motionReduced() && docTabs.length) {
      docCycleTimer = setInterval(function () {
        setActiveDocTab((docActiveIndex + 1) % docTabs.length);
      }, 3000);
    }
  }

  // ---- Scroll reveal ----
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      document.documentElement.classList.add('reveal-enabled');
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

    var showFallback = function (summary) {
      var cfg = window.MAVEN || {};
      var subject = encodeURIComponent('Website Inquiry');
      var body = encodeURIComponent(summary);
      var mailLink = document.getElementById('sendEmailLink');
      var waLink = document.getElementById('sendWhatsAppLink');
      if (mailLink && cfg.email) mailLink.href = 'mailto:' + cfg.email + '?subject=' + subject + '&body=' + body;
      if (waLink && cfg.whatsapp) waLink.href = 'https://wa.me/' + cfg.whatsapp + '?text=' + body;
      var summaryBox = document.getElementById('formSummaryText');
      if (summaryBox) summaryBox.textContent = summary;
      var resultBox = document.getElementById('formResult');
      if (resultBox) {
        resultBox.hidden = false;
        scrollElementIntoView(resultBox, 'center');
      }
    };

    var showSuccess = function () {
      var resultBox = document.getElementById('formResult');
      if (resultBox) {
        resultBox.innerHTML = '<h3>✓ Inquiry sent — thank you!</h3><p class="tag-note">We\'ve received your message and will get back to you within one business day. If it\'s urgent, feel free to call or WhatsApp us directly.</p>';
        resultBox.hidden = false;
        scrollElementIntoView(resultBox, 'center');
      }
      form.reset();
    };

    // Handbook Task 26: errorEl already has role="alert" (see pages3.js)
    // so setting its text announces it to a screen reader as soon as
    // it's revealed -- but that alone left a keyboard/screen-reader
    // user's focus sitting wherever it was (usually the Send button),
    // with no programmatic link from the message back to which
    // field(s) it's about. clearFieldErrors()/markFieldsInvalid() add
    // aria-invalid + aria-describedby to the actual offending field(s)
    // and errorEl.focus() moves focus to the (now-associated) message
    // itself, so both a screen-reader announcement AND a sensible next
    // Tab stop happen on a blocked submission, not just a visual cue.
    var invalidatableIds = ['f-name', 'f-phone', 'f-service', 'f-message', 'f-email'];
    var clearFieldErrors = function () {
      invalidatableIds.forEach(function (id) {
        var fieldEl = document.getElementById(id);
        if (fieldEl) { fieldEl.removeAttribute('aria-invalid'); fieldEl.removeAttribute('aria-describedby'); }
      });
    };
    var markFieldsInvalid = function (ids) {
      ids.forEach(function (id) {
        var fieldEl = document.getElementById(id);
        if (fieldEl) { fieldEl.setAttribute('aria-invalid', 'true'); fieldEl.setAttribute('aria-describedby', 'formError'); }
      });
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var get = function (k) { return (fd.get(k) || '').toString().trim(); };

      // Honeypot: if this hidden field is filled, it's almost certainly a bot.
      // Pretend success and silently drop the submission.
      if (get('company_website')) { showSuccess(); return; }

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
          clearFieldErrors();
          markFieldsInvalid([!name && 'f-name', !phone && 'f-phone', !service && 'f-service', !message && 'f-message'].filter(Boolean));
          errorEl.focus({ preventScroll: true });
          scrollElementIntoView(errorEl, 'center');
        }
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorEl) {
          errorEl.textContent = 'That email address doesn\'t look valid. Please check it or leave it blank.';
          errorEl.hidden = false;
          clearFieldErrors();
          markFieldsInvalid(['f-email']);
          errorEl.focus({ preventScroll: true });
          scrollElementIntoView(errorEl, 'center');
        }
        return;
      }
      if (errorEl) errorEl.hidden = true;
      clearFieldErrors();

      var summary = buildSummary(get);
      var cfg = window.MAVEN || {};

      // If a Formspree form ID is configured, submit directly.
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
          if (res.ok) { showSuccess(); } else { showFallback(summary); }
        }).catch(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Send Inquiry'; }
          showFallback(summary);
        });
        return;
      }

      // No Formspree configured — fall back to email/WhatsApp handoff.
      showFallback(summary);
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

  // ---- Tab switching (Handbook Task 26: complete WAI-ARIA Tabs pattern —
  // role="tablist" existed before this task with no matching tab/tabpanel
  // roles, aria-selected, or keyboard support, which is worse than plain
  // buttons since AT announcing "tab list" implies arrow-key navigation
  // that didn't exist. Roving tabindex + Left/Right/Home/End now match
  // what the existing click behavior already does: immediate activation.) ----
  var tabBar = document.querySelector('.calc-tabs');
  if (tabBar) {
    var calcTabs = Array.prototype.slice.call(tabBar.querySelectorAll('.calc-tab'));
    var activateCalcTab = function (tab) {
      calcTabs.forEach(function (t) {
        var isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', String(isActive));
        t.tabIndex = isActive ? 0 : -1;
      });
      document.querySelectorAll('.calc-panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = document.getElementById(tab.getAttribute('data-target'));
      if (panel) panel.classList.add('active');
    };
    calcTabs.forEach(function (tab) {
      tab.addEventListener('click', function () { activateCalcTab(tab); });
      tab.addEventListener('keydown', function (e) {
        var idx = calcTabs.indexOf(tab);
        var newIdx = null;
        if (e.key === 'ArrowRight') newIdx = (idx + 1) % calcTabs.length;
        else if (e.key === 'ArrowLeft') newIdx = (idx - 1 + calcTabs.length) % calcTabs.length;
        else if (e.key === 'Home') newIdx = 0;
        else if (e.key === 'End') newIdx = calcTabs.length - 1;
        if (newIdx !== null) {
          e.preventDefault();
          var newTab = calcTabs[newIdx];
          activateCalcTab(newTab);
          newTab.focus();
        }
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
        if (toggleBtn) { toggleBtn.disabled = true; toggleBtn.setAttribute('aria-expanded', 'false'); }
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
          toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
          schedWrap.hidden = true;
          if (exportBtn) exportBtn.hidden = true;
          toggleBtn.textContent = 'Show Full Schedule';
          toggleBtn.setAttribute('aria-expanded', 'false');
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
