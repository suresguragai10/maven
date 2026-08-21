(function () {
  'use strict';

  // Publishable (anon) key — safe to be public, the real security boundary
  // is the RLS policies on the database, not this key. Never put a
  // service_role/secret key here.
  var SUPABASE_URL = 'https://moqmgyniwytwmlcdthzy.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_I_UocrZmQBSKmsDhivOs0g_nxc5j5Gi';
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // PWA V1 (see docs/PRODUCT_BOUNDARIES.md "PWA V1 scope"): install-first
  // and online-first only. sw.js caches nothing -- it exists purely to
  // satisfy the browser's installability requirement (a registered
  // service worker with a fetch handler), never to serve offline/cached
  // app or API data. Registered here rather than an inline <script> in
  // index.html because this app's CSP has no 'unsafe-inline' for
  // script-src.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/staff/sw.js').catch(function () {
        // Installability is a progressive enhancement, not a requirement
        // for the app to function -- a failed registration (e.g. an
        // unsupported browser edge case) should never block sign-in.
      });
    });
  }

  var STATUS_LABELS = {
    to_do: 'To Do',
    in_progress: 'In Progress',
    waiting_for_client: 'Waiting for Client',
    ready_for_review: 'Ready for Review',
    changes_required: 'Changes Required',
    approved: 'Approved',
    ready_to_submit: 'Ready to Submit',
    completed: 'Completed',
    // Firm Work's own two states (work_scope='firm') — added here for
    // forward compatibility (labels only) so a badge never falls back to
    // raw "blocked"/"review" text; no Firm Work UI reads/writes these
    // yet, that's a later task.
    blocked: 'Blocked',
    review: 'Review',
  };
  var SUBMISSION_STATUS_LABELS = {
    not_ready: 'Not Ready',
    ready_to_submit: 'Ready to Submit',
    submitted: 'Submitted',
    acknowledged: 'Acknowledged',
  };
  // Statuses an employee may set themselves — always available regardless
  // of which service template a work item follows. Everything past
  // "Ready for Review" requires a reviewer/admin, enforced both here (UI)
  // and in the guard_work_item_update() trigger (DB).
  var EMPLOYEE_STATUSES = ['to_do', 'in_progress', 'waiting_for_client', 'ready_for_review'];
  // Handbook Task 8: mirrors guard_work_item_update()'s transition map
  // (structural pairs only, not the checklist/submission gates, which
  // need a DB round trip to check reliably) so the status <select> only
  // ever offers a next status that's actually reachable — a reviewer
  // looking at a brand-new 'to_do' item no longer sees 'Completed' as an
  // option that would just error out. Reopening a completed item has no
  // normal path here at all (admin-override-only, see openOverrideStatusModal).
  function validClientNextStatuses(work) {
    var reviewRequired = work.review_required !== false; // column default true
    var submissionRequired = work.submission_required === true;
    switch (work.status) {
      case 'to_do': return ['to_do', 'in_progress', 'waiting_for_client'];
      case 'in_progress':
        var opts = ['in_progress', 'waiting_for_client', 'ready_for_review'];
        if (!reviewRequired && submissionRequired) opts.push('ready_to_submit');
        if (!reviewRequired && !submissionRequired) opts.push('completed');
        return opts;
      case 'waiting_for_client': return ['waiting_for_client', 'in_progress'];
      case 'ready_for_review': return ['ready_for_review', 'changes_required', 'approved', 'waiting_for_client'];
      case 'changes_required': return ['changes_required', 'in_progress', 'waiting_for_client'];
      case 'approved':
        var opts2 = ['approved', 'waiting_for_client'];
        opts2.push(submissionRequired ? 'ready_to_submit' : 'completed');
        return opts2;
      case 'ready_to_submit': return ['ready_to_submit', 'completed', 'waiting_for_client'];
      case 'completed': return ['completed'];
      default: return [work.status];
    }
  }
  var STAGE_LABELS = { preparation: 'Preparation', review: 'Review', submission: 'Submission' };
  var STAGES = ['preparation', 'review', 'submission'];
  var TEMPLATE_CATEGORIES = ['Bookkeeping', 'Tax', 'Payroll', 'Reporting', 'Registration', 'Advisory', 'NFRS/IFRS'];
  // Firm Work (work_scope='firm', see 20260816090000_firm_work_data_
  // model.sql) — internal team work, no client. Matches firm_category's
  // DB check constraint exactly; keep the two in sync if this ever changes.
  var FIRM_CATEGORIES = ['Business Development', 'Marketing', 'Website / Digital', 'Administration', 'Firm Setup', 'Research', 'Other'];
  var FIRM_STATUSES = ['to_do', 'in_progress', 'blocked', 'review', 'completed'];
  // Handbook Task 18: optional tag on a Firm Work update — deliberately
  // NOT a Decision Needed / Owner Approval hierarchy (the owner rejected
  // that shape in an earlier task). Matches work_comments.update_type's
  // check constraint exactly; keep the two in sync if this ever changes.
  var UPDATE_TYPE_LABELS = { progress: 'Progress', result: 'Result', blocker: 'Blocker', handoff: 'Handoff', note: 'Note' };
  // 'normal' deliberately has no label here — it never renders a badge
  // anywhere (see attentionBadge()), only the two flagged states do.
  var ATTENTION_LABELS = { needs_attention: 'Needs Attention', high_attention: 'High Attention' };

  // Workflow Settings (V2 Task 18) — day-count thresholds an admin can
  // tune from the Settings page instead of them being buried as literals
  // in this file. Defaults here are what a brand-new install falls back
  // to if app_settings doesn't have a row yet (shouldn't happen once the
  // migration has run, but loadWorkflowSettings() stays defensive about
  // it — a missing/blank/non-numeric setting silently falls back to its
  // default rather than breaking whatever reads it).
  var WORKFLOW_SETTING_DEFAULTS = {
    default_internal_offset_days: 3,
    waiting_followup_default_days: 2,
    waiting_stale_days: 7,
    review_attention_days: 2,
    upcoming_deadline_warning_days: 3,
  };
  var WORKFLOW_SETTING_LABELS = {
    default_internal_offset_days: 'Default Internal Deadline (days before filing deadline)',
    waiting_followup_default_days: 'Waiting-for-Client Follow-up Default (days after request)',
    waiting_stale_days: 'Waiting-for-Client Stale Threshold (days)',
    review_attention_days: 'Review Attention Threshold (days pending)',
    upcoming_deadline_warning_days: 'Upcoming Deadline Warning (days ahead)',
  };
  var WORKFLOW_SETTING_HELP = {
    default_internal_offset_days: 'Pre-fills a new template’s internal-offset field. Existing templates and already-generated work are never changed by this.',
    waiting_followup_default_days: 'Pre-fills the follow-up date when marking work Waiting for Client. Always editable per item.',
    waiting_stale_days: 'How long something can sit Waiting for Client before Operations Overview flags it as stale.',
    review_attention_days: 'How long something can sit in Ready for Review before Operations Overview flags it as taking too long.',
    upcoming_deadline_warning_days: 'How many days ahead Operations Overview’s "Due Within N Days" exception looks.',
  };

  var state = {
    user: null,
    profile: null,
    profiles: [],
    clients: [],
    templates: [],
    deadlineRules: [],
    projects: [],
    settings: Object.assign({}, WORKFLOW_SETTING_DEFAULTS),
    view: 'today',
    workId: null,
  };

  // ============================================================
  // DOM / UI helpers
  // ============================================================
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function qs(sel) { return document.querySelector(sel); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Small inline icon set (stroke-based, 24x24 viewBox) — self-contained so
  // the portal has no icon-font/CDN dependency, consistent with how the rest
  // of this codebase hand-rolls its SVG icons.
  var ICON_PATHS = {
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><line x1="8" y1="8" x2="8" y2="8"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="16" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="8" y2="12"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="16" y1="12" x2="16" y2="12"/><rect x="9" y="16" width="6" height="5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="10" r="3"/><circle cx="16" cy="10" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6"/><path d="M12 20c0-3 2.5-5 4.5-5s4.5 2 4.5 5" opacity="0.55"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="7" y1="3" x2="7" y2="7"/><line x1="17" y1="3" x2="17" y2="7"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    alert: '<path d="M12 3l9 16H3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 6l9 7 9-7"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 6a2 2 0 0 1 2-2z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    chevronRight: '<path d="M9 18l6-6-6-6"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="1"/><rect x="9" y="2" width="6" height="4" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/>',
    folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    flag: '<line x1="5" y1="3" x2="5" y2="21"/><path d="M5 4h11l-2.5 4L16 12H5z"/>',
    message: '<path d="M4 4h16v12H8l-4 4z"/>',
    idcard: '<rect x="2" y="5" width="20" height="14" rx="1"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="10" x2="19" y2="10"/><line x1="13" y1="14" x2="18" y2="14"/>',
    list: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/>',
    search: '<circle cx="10" cy="10" r="7"/><line x1="20" y1="20" x2="15.2" y2="15.2"/>',
    bell: '<path d="M12 3a5 5 0 0 0-5 5v3l-2 4h18l-2-4V8a5 5 0 0 0-5-5z"/><path d="M9.5 18.5a2.5 2.5 0 0 0 5 0"/>',
    chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="3" width="3" height="17"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="3" y1="13" x2="21" y2="13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  };
  function icon(name, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    svg.innerHTML = ICON_PATHS[name] || '';
    return svg;
  }

  function initials(name) {
    var parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avatar(name, cls) {
    var a = el('span', 'avatar' + (cls ? ' ' + cls : ''));
    a.textContent = initials(name);
    a.title = name || '';
    return a;
  }
  // Real profile photo everywhere a person's small avatar bubble already
  // shows up (Team, work list rows, Work Details meta grid, etc.) --
  // previously every one of these only ever rendered initials, since they
  // called avatar(name) with just a string and no way to reach photo_url.
  // Falls back to the same initials bubble whenever there's no id, no
  // matching profile, no photo set, or the image fails to load.
  function avatarFor(id, cls) {
    var p = id ? state.profiles.find(function (x) { return x.id === id; }) : null;
    if (!p) return avatar(id ? profileName(id) : '', cls);
    var src = allowedStaffPhotoUrl(p.photo_url);
    if (!src) return avatar(p.full_name, cls);
    var img = el('img', 'avatar' + (cls ? ' ' + cls : ''));
    img.src = src; img.alt = ''; img.loading = 'lazy';
    img.title = p.full_name || '';
    img.addEventListener('error', function () {
      if (img.parentNode) img.parentNode.replaceChild(avatar(p.full_name, cls), img);
    }, { once: true });
    return img;
  }

  // A human-set client flag, never algorithmically derived (see the
  // set_client_attention() migration note) — Normal renders nothing at
  // all, keeping the common case visually quiet; only an actual flag
  // shows a badge, wherever a client is referenced.
  function attentionBadge(c) {
    if (!c || !c.attention_level || c.attention_level === 'normal') return null;
    var b = el('span', 'badge badge-attention-' + c.attention_level);
    b.appendChild(icon('alert'));
    b.appendChild(document.createTextNode(ATTENTION_LABELS[c.attention_level] || c.attention_level));
    return b;
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var t = qs('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 4000);
  }

  // Catches anything the try/catch in enterApp() doesn't — an error thrown
  // inside an async view render (e.g. render(), renderWorkDetail()) becomes
  // an unhandled promise rejection, not a thrown exception, so it wouldn't
  // hit a normal try/catch around the call site. This is a blanket safety
  // net so "the page just went blank with no explanation" can't happen
  // silently while this is still a new, not-fully-battle-tested app.
  window.addEventListener('unhandledrejection', function (e) {
    toast('Something went wrong: ' + (e.reason && e.reason.message ? e.reason.message : 'unknown error'), true);
  });

  // Records a work item's Activity-tab entry for the handful of actions
  // that are still legitimately client-logged (checklist/waiting-item
  // toggles, follow-up records) — everything else material (status,
  // submission, assignment, due dates) is logged by
  // guard_work_item_update() itself as of Handbook Task 7, so it can
  // never be silently skipped by a failed/forgotten client call. source:
  // 'client' is required by work_activity_insert's own WITH CHECK, which
  // also restricts `action` to exactly this task's three allowed values
  // — this helper cannot be used to fabricate a system-looking entry.
  function logActivity(workItemId, action, detail) {
    sb.from('work_activity').insert({ work_item_id: workItemId, actor_id: state.user.id, action: action, detail: detail || null, source: 'client' });
  }
  // Checklist/waiting-item checkboxes deliberately skip a full page
  // re-render for snappy toggling — so unlike every other mutating action
  // here, the Activity tab (if already open) needs its DOM updated by
  // hand instead of picking up the change on next render.
  function prependActivityRow(pane, detail) {
    if (!pane) return;
    var placeholder = pane.querySelector('p.desc');
    if (placeholder) pane.removeChild(placeholder);
    var row = el('div', 'activity-row');
    var who = el('span', 'who'); who.textContent = state.profile.full_name || 'You';
    var when = el('span', 'when'); when.textContent = fmtDateTime(new Date().toISOString());
    who.appendChild(when);
    row.appendChild(who);
    var detailEl = el('div', 'detail'); detailEl.textContent = detail; row.appendChild(detailEl);
    pane.insertBefore(row, pane.firstChild);
  }

  // Handbook Task 26: openModal()/closeModal() are the single shared entry
  // point every "New Work"/"New Client"/etc. form in this app goes
  // through, so fixing focus behavior here once covers all of them.
  // Previously the modal had no role="dialog"/aria-modal (see
  // #modalCard in index.html), no focus trap, no Escape-to-close, and
  // never moved focus anywhere on open/close -- a keyboard user opening
  // a modal stayed focused on the trigger button behind it, and closing
  // it (click-outside was the only way) left focus wherever it happened
  // to be. modalReturnFocus restores focus to whatever opened the modal,
  // same "don't strand keyboard focus" principle used for the mobile nav
  // and desktop dropdowns on the public site.
  var modalReturnFocus = null;
  function modalFocusableEls(card) {
    return Array.prototype.slice.call(card.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  }
  function openModal(contentEl) {
    var card = qs('#modalCard');
    clear(card);
    card.appendChild(contentEl);
    // Every modal's content consistently starts with a
    // <div class="modal-head"><h2>Title</h2>...</div> (see the many
    // openXModal() functions below) -- reuse that h2 as the dialog's
    // accessible name instead of inventing a second, separately
    // maintained title string per modal.
    var heading = card.querySelector('h2, h3');
    if (heading) {
      if (!heading.id) heading.id = 'modal-heading-' + Date.now();
      card.setAttribute('aria-labelledby', heading.id);
    } else {
      card.removeAttribute('aria-labelledby');
    }
    qs('#modalOverlay').classList.remove('hidden');
    modalReturnFocus = document.activeElement;
    var focusable = modalFocusableEls(card);
    (focusable[0] || card).focus();
  }
  function closeModal() {
    qs('#modalOverlay').classList.add('hidden');
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
    modalReturnFocus = null;
  }
  qs('#modalOverlay').addEventListener('click', function (e) {
    if (e.target === qs('#modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (qs('#modalOverlay').classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    var card = qs('#modalCard');
    var focusable = modalFocusableEls(card);
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
  });

  // Task 35: every field() call site across this entire app (hundreds of
  // them, every modal and every filter row) used to produce a <label>
  // that was only a visual sibling of its input -- no `for`/`id`
  // relationship, so assistive tech had no guaranteed way to announce
  // the label as the input's accessible name even though it looked
  // correctly associated on screen. One fix here covers the whole app.
  // The one call site that passes something other than a real form
  // control (Templates' checklist editor, a <div> wrapper) just gets an
  // inert `for` attribute -- harmless, not a regression from before.
  var fieldIdCounter = 0;
  function field(labelText, inputEl) {
    var wrap = el('div', 'f');
    var label = el('label'); label.textContent = labelText;
    if (!inputEl.id) {
      fieldIdCounter += 1;
      inputEl.id = 'field-auto-' + fieldIdCounter;
    }
    label.setAttribute('for', inputEl.id);
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  // "Today" (or any date) as a plain YYYY-MM-DD string in the LOCAL
  // calendar day — new Date().toISOString() reports the UTC date, which
  // silently lands on the wrong day for any timezone ahead of UTC (e.g.
  // Nepal, UTC+5:45) during the first ~6 hours of each local day. That
  // made "Due Today"/"This Week"-style string-equality comparisons
  // miss or misfire right when someone opens the app first thing in the
  // morning — found while building the Manager Dashboard's Due Today/
  // Due Within 3 Days exceptions. effectiveDue()/isOverdue() already
  // sidestepped this by comparing via toDateString() instead; every
  // OTHER date-range comparison in this file should use this helper for
  // the same reason, not toISOString().
  function localDateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(d) {
    if (!d) return '—';
    var dt = new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '';
    var dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
      dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  // A work item can carry two due dates; the internal one is what actually
  // drives urgency day-to-day (it's meant to land before the real filing
  // deadline), so it wins when both are set.
  function effectiveDue(w) { return w.internal_due_date || w.external_due_date || null; }
  function isOverdue(w) {
    var due = effectiveDue(w);
    if (!due || w.status === 'completed') return false;
    return new Date(due + 'T00:00:00') < new Date(new Date().toDateString());
  }
  function daysOverdue(w) {
    var due = effectiveDue(w);
    if (!due) return 0;
    var ms = new Date(new Date().toDateString()) - new Date(due + 'T00:00:00');
    return Math.max(1, Math.round(ms / 86400000));
  }
  // Sorts by effective due date (internal, falling back to filing due) —
  // items with neither date set sort last, not first, matching what the
  // old DB-level "order by internal_due_date, nulls last" used to do
  // before it was replaced everywhere with this so an item with only a
  // filing due date wouldn't be treated as dateless.
  function compareByDue(a, b) {
    var da = effectiveDue(a), db = effectiveDue(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  }
  // Explicitly labeled so it's never ambiguous which date is which —
  // used everywhere a work item's due date shows in list form (Today,
  // My Work, All Work, Deadlines). Internal Target is the primary/urgency
  // date (see isOverdue/effectiveDue); External only appears when it's
  // set and actually different, so a work item with just one date
  // doesn't show a redundant second label.
  //
  // Handbook Task 12: a work item with NEITHER date set is no longer
  // just "No due date" — if its template is flagged requires_external_
  // deadline and no governed deadline_rules row has fired yet (or ever
  // existed), that's a real gap that should be visibly flagged, not
  // presented the same as ordinary work that genuinely has no deadline
  // (e.g. Firm Work, or a Client Work template with no filing deadline
  // at all).
  function dueDateText(w) {
    if (w.internal_due_date && w.external_due_date && w.internal_due_date !== w.external_due_date) {
      return 'Internal Target ' + fmtDate(w.internal_due_date) + ' · External ' + fmtDate(w.external_due_date);
    }
    if (w.internal_due_date) return 'Internal Target ' + fmtDate(w.internal_due_date);
    if (w.external_due_date) return 'External ' + fmtDate(w.external_due_date);
    var tmpl = templateById(w.service_template_id);
    if (tmpl && tmpl.requires_external_deadline) return 'Deadline requires verification';
    return 'No due date';
  }
  // Task 24: a Client Work row's own "what do I do next" label, same
  // convention as Today's attentionRow() action labels but covering every
  // status a row in My Work can be in, not just the three "needs
  // attention" reasons. Overdue always wins regardless of status -- an
  // overdue ready-for-review item is still first and foremost overdue.
  function nextActionLabel(w) {
    if (isOverdue(w)) return 'Open';
    switch (w.status) {
      case 'to_do': return 'Start';
      case 'in_progress': return 'Continue';
      case 'waiting_for_client': return 'Follow Up';
      case 'ready_for_review': return 'Awaiting Review';
      case 'changes_required': return 'Fix';
      case 'approved': return w.submission_required ? 'Submit' : 'Wrap Up';
      case 'ready_to_submit': return 'Submit';
      case 'completed': return 'View';
      default: return 'Open';
    }
  }
  // A waiting-on-client requirement counts as "waiting too long" once its
  // own scheduled follow-up date has passed, or — if no follow-up was ever
  // scheduled — once it's simply been sitting unreceived for a while.
  // Shared between Work Details (per-item flag) and the Manager Dashboard
  // (team-wide count) so the two can never disagree on the definition.
  function isStaleWaitingItem(wi) {
    if (wi.is_received) return false;
    var todayStr = localDateStr();
    if (wi.follow_up_date) return wi.follow_up_date < todayStr;
    if (!wi.requested_date) return false;
    var ageDays = (Date.now() - new Date(wi.requested_date + 'T00:00:00').getTime()) / 86400000;
    return ageDays >= state.settings.waiting_stale_days;
  }
  function clientName(id) {
    var c = state.clients.find(function (x) { return x.id === id; });
    return c ? c.name : '—';
  }
  function templateById(id) {
    return state.templates.find(function (t) { return t.id === id; }) || null;
  }
  // Handbook Task 12: the single currently-active deadline_rules row for
  // a template, or null if none exists yet — mirrors the DB's own
  // deadline_rules_one_active_per_template unique index (at most one
  // active row per template), so this lookup is never ambiguous.
  function activeDeadlineRuleFor(templateId) {
    return state.deadlineRules.find(function (r) { return r.service_template_id === templateId && r.status === 'active'; }) || null;
  }
  // Full history for a template (active first, then superseded newest
  // first — state.deadlineRules is already ordered by created_at desc),
  // for the Templates page's "trace this deadline to its approved
  // rule/version" history view.
  function deadlineRuleHistoryFor(templateId) {
    return state.deadlineRules.filter(function (r) { return r.service_template_id === templateId; });
  }
  function profileName(id) {
    var p = state.profiles.find(function (x) { return x.id === id; });
    return p ? p.full_name : '—';
  }
  function isAdmin() { return state.profile && state.profile.role === 'admin'; }
  function isReviewerOrAdmin() { return state.profile && (state.profile.role === 'admin' || state.profile.role === 'reviewer'); }

  // ============================================================
  // Auth
  // ============================================================
  qs('#loginBtn').addEventListener('click', handleLogin);
  ['in-email', 'in-password'].forEach(function (id) {
    document.getElementById(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleLogin();
    });
  });
  qs('#logoutBtn').addEventListener('click', handleLogout);

  // The topbar logo previously did nothing when clicked -- the only way
  // back to a known-good screen was a full browser refresh. Every other
  // app-shell nav button already routes through goto(), which just sets
  // location.hash (no page reload) -- this is the same one-line fix, just
  // on the one clickable-looking element that had never been wired up.
  qs('#brandHomeBtn').addEventListener('click', function () { goto('today'); });

  qs('#notifBellIconSlot').appendChild(icon('bell'));
  qs('#notifBellBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    var panel = qs('#notifPanel');
    if (panel.classList.contains('hidden')) openNotifPanel(); else panel.classList.add('hidden');
  });
  // Click-outside-to-close, same convention as #modalOverlay's own
  // click-to-close handler above.
  document.addEventListener('click', function (e) {
    var panel = qs('#notifPanel');
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || qs('#notifBellBtn').contains(e.target)) return;
    panel.classList.add('hidden');
  });

  // Task 22: Global Search moved out of the sidebar and into the topbar as
  // a prominent utility (always one click away from anywhere) rather than
  // competing with the primary workspace destinations for sidebar space.
  qs('#searchIconSlot').appendChild(icon('search'));
  qs('#globalSearchBtn').addEventListener('click', function () { goto('search'); });

  // Task 22: mobile nav drawer. Same open/close/focus-trap/return-focus
  // convention as the public site's .mobile-nav (client.js) — a toggle
  // button, a full-viewport panel, Escape or the close button or clicking
  // a nav item all close it, and focus never gets stranded on a
  // now-hidden element. Desktop is unaffected: the toggle/close buttons
  // are display:none above 820px and #sidebar just renders inline as
  // always (see index.html).
  qs('#menuIconSlot').appendChild(icon('menu'));
  qs('#closeIconSlot').appendChild(icon('close'));
  var navDrawerReturnFocus = null;
  function openNavDrawer() {
    document.body.classList.add('nav-drawer-open');
    qs('#navToggleBtn').setAttribute('aria-expanded', 'true');
    navDrawerReturnFocus = document.activeElement;
    qs('#navCloseBtn').focus();
  }
  function closeNavDrawer() {
    if (!document.body.classList.contains('nav-drawer-open')) return;
    document.body.classList.remove('nav-drawer-open');
    qs('#navToggleBtn').setAttribute('aria-expanded', 'false');
    if (navDrawerReturnFocus && typeof navDrawerReturnFocus.focus === 'function') navDrawerReturnFocus.focus();
    navDrawerReturnFocus = null;
  }
  qs('#navToggleBtn').addEventListener('click', openNavDrawer);
  qs('#navCloseBtn').addEventListener('click', closeNavDrawer);
  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('nav-drawer-open')) return;
    if (e.key === 'Escape') { closeNavDrawer(); return; }
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(qs('#sidebar').querySelectorAll('button')).concat([qs('#navCloseBtn')]);
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
  });

  async function handleLogin() {
    var email = qs('#in-email').value.trim();
    var password = qs('#in-password').value;
    var msgEl = qs('#loginMsg');
    clear(msgEl);
    if (!email || !password) {
      msgEl.appendChild(msgBox('Enter your email and password.', true));
      return;
    }
    var btn = qs('#loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    btn.disabled = false; btn.textContent = 'Sign In';
    if (res.error) {
      msgEl.appendChild(msgBox(res.error.message || 'Could not sign in.', true));
      return;
    }
    await enterApp();
  }

  function msgBox(text, isError) {
    var d = el('div', 'msg ' + (isError ? 'msg-error' : 'msg-ok'));
    d.textContent = text;
    return d;
  }

  async function handleLogout() {
    await sb.auth.signOut();
    state.user = null; state.profile = null;
    qs('#app').classList.add('hidden');
    qs('#loginScreen').classList.remove('hidden');
    qs('#in-password').value = '';
  }

  async function enterApp() {
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) return;
    state.user = session.user;

    var profRes = await sb.from('profiles').select('*').eq('id', state.user.id).single();
    if (profRes.error || !profRes.data) {
      toast('Could not load your profile. Contact an admin.', true);
      await handleLogout();
      return;
    }
    state.profile = profRes.data;
    if (!state.profile.is_active) {
      toast('Your account has been deactivated. Contact an admin.', true);
      await handleLogout();
      return;
    }

    qs('#loginScreen').classList.add('hidden');
    qs('#app').classList.remove('hidden');
    qs('#whoName').textContent = state.profile.full_name || state.user.email;
    qs('#whoRole').textContent = state.profile.role.charAt(0).toUpperCase() + state.profile.role.slice(1);

    // Once the shell is visible, a thrown error anywhere below would
    // otherwise fail silently (the header renders, then nothing) — this
    // surfaces it instead of leaving a blank page with no clue why.
    try {
      await Promise.all([loadProfiles(), loadClients(), loadTemplates(), loadDeadlineRules(), loadProjects(), loadWorkflowSettings()]);
      renderSidebar();
      routeFromHash();
      if (isAdmin()) runAutoGenerateOnOpen();
      initNotifications();
    } catch (err) {
      toast('Something went wrong loading the portal: ' + err.message, true);
      var main = qs('#main');
      clear(main);
      var errBox = el('div', 'card');
      errBox.textContent = 'The page hit an error and couldn\'t finish loading. Try refreshing — if it keeps happening, tell your admin what you were doing when it happened.';
      main.appendChild(errBox);
    }
  }

  // ============================================================
  // Data loading — profiles/clients/templates are small lists (a handful
  // to a few dozen rows at this org's size), so they're loaded once into
  // memory and looked up client-side rather than joined per-query. Work
  // items are loaded fresh per view since they change constantly.
  // ============================================================
  async function loadProfiles() {
    var res = await sb.from('profiles').select('*').order('full_name');
    if (res.error) { toast('Could not load staff list: ' + res.error.message, true); return; }
    state.profiles = res.data || [];
  }
  async function loadClients() {
    var res = await sb.from('clients').select('*').order('name');
    if (res.error) { toast('Could not load clients: ' + res.error.message, true); return; }
    state.clients = res.data || [];
  }
  async function loadTemplates() {
    var res = await sb.from('service_templates').select('*').order('title');
    if (res.error) { toast('Could not load service templates: ' + res.error.message, true); return; }
    state.templates = res.data || [];
  }
  // Handbook Task 12: the full deadline_rules table (active AND
  // superseded rows) — loaded once, like templates/clients/profiles.
  // Kept small deliberately (see docs/FINANCE_RULE_GOVERNANCE.md): one
  // row per service per verification event, not per work item. Superseded
  // rows are included so the Templates page can show a rule's full
  // history, satisfying "trace every statutory deadline to a specific
  // approved rule/version."
  async function loadDeadlineRules() {
    var res = await sb.from('deadline_rules').select('*').order('created_at', { ascending: false });
    if (res.error) { toast('Could not load deadline rules: ' + res.error.message, true); return; }
    state.deadlineRules = res.data || [];
  }
  // Handbook Task 15: Firm Work's project/initiative groupings — small,
  // loaded once like clients/templates. Every active teammate can read
  // and create these (see projects_read/projects_insert), matching Firm
  // Work's own open-collaboration model.
  async function loadProjects() {
    var res = await sb.from('projects').select('*').order('name');
    if (res.error) { toast('Could not load projects: ' + res.error.message, true); return; }
    state.projects = res.data || [];
  }
  function projectById(id) {
    return state.projects.find(function (p) { return p.id === id; }) || null;
  }
  // Loads into state.settings on top of WORKFLOW_SETTING_DEFAULTS (not
  // replacing it), so a missing row, a blank value, or a non-numeric
  // value left over from manual DB editing all silently fall back to a
  // safe default instead of producing NaN somewhere a threshold is used.
  async function loadWorkflowSettings() {
    state.settings = Object.assign({}, WORKFLOW_SETTING_DEFAULTS);
    var keys = Object.keys(WORKFLOW_SETTING_DEFAULTS);
    var res = await sb.from('app_settings').select('*').in('key', keys);
    if (res.error) { toast('Could not load workflow settings: ' + res.error.message, true); return; }
    (res.data || []).forEach(function (row) {
      var n = parseInt(row.value, 10);
      if (!isNaN(n) && n >= 0) state.settings[row.key] = n;
    });
  }
  // Runs when an admin opens Work Desk instead of a background scheduler —
  // no paid/external automation, and it's provably safe to run on every
  // login: generate_period_work_for_period is idempotent (real unique
  // constraint + ON CONFLICT DO NOTHING), so a day nothing's due is a
  // same-cost no-op, not a risk of duplicates. Deliberately fire-and-
  // forget (not awaited by enterApp) so a slow check never delays the
  // page the admin is actually trying to look at; only mentions itself
  // via a toast if it actually created something.
  function runAutoGenerateOnOpen() {
    (async function () {
      var keys = AUTO_GENERATE_KEYS.map(function (k) { return k[0]; });
      var res = await sb.from('app_settings').select('*').in('key', keys);
      var settings = {};
      (res.data || []).forEach(function (row) { settings[row.key] = row.value; });
      var totalCreated = 0;
      for (var i = 0; i < AUTO_GENERATE_KEYS.length; i++) {
        var periodType = AUTO_GENERATE_KEYS[i][0].replace('auto_generate_period_', '');
        // Handbook Task 11: the DB function now requires an explicit
        // Gregorian start/end alongside the label — a pre-Task-11 setting
        // (a bare label string, no dates yet) parses with empty
        // start/end and is skipped here, same as an unset field, until
        // an admin fills in the dates on the Templates page.
        var parsed = parseAutoGenerateValue(settings[AUTO_GENERATE_KEYS[i][0]]);
        if (!parsed.label || !parsed.start || !parsed.end) continue;
        var genRes = await sb.rpc('generate_period_work_for_period', {
          p_period: parsed.label, p_period_type: periodType,
          p_period_start: parsed.start, p_period_end: parsed.end,
        });
        if (!genRes.error) totalCreated += genRes.data || 0;
      }
      if (totalCreated > 0) toast(totalCreated + ' work item' + (totalCreated === 1 ? '' : 's') + ' auto-generated for the current period.');
    })();
  }

  // ============================================================
  // Notifications — computed from current work_items/work_waiting_items
  // state at login (no scheduler, no email/SMS/push/WhatsApp, zero
  // external cost), scoped entirely to the logged-in user's own work
  // (mirrors Today's own "mine"/"review" scoping — a notification is a
  // personal nudge, not a broadcast). Two shapes: a per-day SUMMARY row
  // ("3 work items are due today") deduped by day, and a per-item row
  // ("VAT Return for XYZ is overdue") deduped by the specific work item
  // (and, for follow-ups, the specific follow-up date) so the same
  // condition doesn't keep re-notifying every single login. The database
  // is the actual duplicate-prevention boundary (a unique index on
  // (user_id, dedup_key), same "let Postgres guarantee it" pattern as
  // recurring work generation's ON CONFLICT DO NOTHING) — upsert with
  // ignoreDuplicates just lets the app not care whether a given
  // notification already exists.
  // ============================================================
  function initNotifications() {
    refreshNotifBadge();
    // Fire-and-forget, same reasoning as runAutoGenerateOnOpen — never
    // delay the page someone actually opened Work Desk to look at.
    generateNotifications().then(function () {
      refreshNotifBadge();
      if (!qs('#notifPanel').classList.contains('hidden')) renderNotifPanel();
    });
  }

  async function generateNotifications() {
    var todayStr = localDateStr();
    var mine = await loadWork('mine');
    var open = mine.filter(function (w) { return w.status !== 'completed'; });
    var dueToday = open.filter(function (w) { return effectiveDue(w) === todayStr && !isOverdue(w); });
    var overdueItems = open.filter(isOverdue);
    var waitingItems = open.filter(function (w) { return w.status === 'waiting_for_client'; });
    var reviewItems = (await loadWork('review')).filter(function (w) { return w.reviewer_id === state.user.id; });

    var rows = [];
    if (dueToday.length) {
      rows.push({
        user_id: state.user.id, kind: 'due_today_summary', work_item_id: null,
        title: dueToday.length + ' work item' + (dueToday.length === 1 ? ' is' : 's are') + ' due today',
        dedup_key: 'due_today_summary:' + todayStr,
      });
    }
    if (reviewItems.length) {
      rows.push({
        user_id: state.user.id, kind: 'review_summary', work_item_id: null,
        title: reviewItems.length + ' review' + (reviewItems.length === 1 ? '' : 's') + ' assigned to you',
        dedup_key: 'review_summary:' + todayStr,
      });
    }
    overdueItems.forEach(function (w) {
      var tmpl = templateById(w.service_template_id);
      rows.push({
        user_id: state.user.id, kind: 'overdue_item', work_item_id: w.id,
        title: (tmpl ? tmpl.title : w.title) + ' for ' + clientName(w.client_id) + ' is overdue',
        dedup_key: 'overdue_item:' + w.id,
      });
    });
    if (waitingItems.length) {
      var waitRes = await sb.from('work_waiting_items').select('*')
        .in('work_item_id', waitingItems.map(function (w) { return w.id; }))
        .eq('follow_up_date', todayStr).eq('is_received', false);
      var seenWork = {};
      (waitRes.data || []).forEach(function (wi) {
        // One notification per work item's follow-up, not one per
        // still-outstanding requirement line on that item.
        if (seenWork[wi.work_item_id]) return;
        seenWork[wi.work_item_id] = true;
        var w = waitingItems.find(function (x) { return x.id === wi.work_item_id; });
        rows.push({
          user_id: state.user.id, kind: 'followup_item', work_item_id: w.id,
          title: clientName(w.client_id) + ' follow-up is due today',
          dedup_key: 'followup_item:' + w.id + ':' + wi.follow_up_date,
        });
      });
    }

    if (!rows.length) return;
    await sb.from('notifications').upsert(rows, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true });
  }

  async function refreshNotifBadge() {
    var res = await sb.from('notifications').select('id').eq('user_id', state.user.id).eq('is_read', false);
    var n = (res.data || []).length;
    var badge = qs('#notifBadge');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('hidden', n === 0);
  }

  async function openNotifPanel() {
    qs('#notifPanel').classList.remove('hidden');
    await renderNotifPanel();
  }

  async function renderNotifPanel() {
    var panel = qs('#notifPanel');
    clear(panel);
    var head = el('div', 'notif-head');
    var strong = el('strong'); strong.textContent = 'Notifications';
    var markAllBtn = el('button', 'btn btn-outline btn-sm'); markAllBtn.type = 'button'; markAllBtn.textContent = 'Mark all read';
    markAllBtn.addEventListener('click', async function () {
      markAllBtn.disabled = true;
      await sb.from('notifications').update({ is_read: true }).eq('user_id', state.user.id).eq('is_read', false);
      await renderNotifPanel();
      refreshNotifBadge();
    });
    head.appendChild(strong); head.appendChild(markAllBtn);
    panel.appendChild(head);
    // Task 29: this panel only ever generates from Client Work (see
    // generateNotifications' own header comment) — Firm Work has its own,
    // separate Catch-Up feed. Both are correct as two distinct systems
    // (a personal daily nudge vs. a team-wide since-you-last-reviewed
    // feed), not redundant with each other, but "Notifications" alone
    // gave no hint of that boundary. Stated explicitly here rather than
    // left for someone to discover by an item never showing up.
    var scopeNote = el('div', 'notif-scope-note');
    scopeNote.textContent = 'Client Work only — Firm Work has its own Catch-Up feed.';
    panel.appendChild(scopeNote);

    var res = await sb.from('notifications').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(30);
    var items = res.data || [];
    if (!items.length) {
      var empty = el('div', 'notif-empty'); empty.textContent = 'No notifications yet.';
      panel.appendChild(empty);
    } else {
      items.forEach(function (n) { panel.appendChild(notifRow(n)); });
    }
  }

  function notifRow(n) {
    var row = el('div', 'notif-row' + (n.is_read ? ' is-read' : ''));
    row.addEventListener('click', function () {
      if (!n.work_item_id) return;
      qs('#notifPanel').classList.add('hidden');
      gotoWork(n.work_item_id);
    });
    var body = el('div', 'notif-body');
    var title = el('div', 'notif-title'); title.textContent = n.title;
    var when = el('div', 'notif-when'); when.textContent = fmtDateTime(n.created_at);
    body.appendChild(title); body.appendChild(when);
    row.appendChild(body);
    var dismissBtn = el('button', 'notif-dismiss'); dismissBtn.type = 'button';
    dismissBtn.textContent = '×'; dismissBtn.title = 'Mark read';
    dismissBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (n.is_read) return;
      dismissBtn.disabled = true;
      var res = await sb.from('notifications').update({ is_read: true }).eq('id', n.id);
      dismissBtn.disabled = false;
      if (res.error) { toast('Could not update notification: ' + res.error.message, true); return; }
      n.is_read = true;
      row.classList.add('is-read');
      refreshNotifBadge();
    });
    row.appendChild(dismissBtn);
    return row;
  }

  // Handbook Task 20: My Work's Firm Work half. Deliberately a separate
  // function/query, not a branch inside loadWork() below -- loadWork()'s
  // whole reason to exist is "Client Work only, always" (see its own
  // comment), and this task's own "do not load all firm records then
  // client-filter in the browser" instruction means the assignee filter
  // has to be server-side here too, exactly like loadWork('mine') already
  // does for Client Work.
  async function loadMyFirmWork() {
    var res = await sb.from('work_items').select('*')
      .eq('work_scope', 'firm')
      .eq('assignee_id', state.user.id)
      .order('internal_due_date', { ascending: true, nullsFirst: false });
    if (res.error) { toast('Could not load Firm Work: ' + res.error.message, true); return []; }
    return res.data || [];
  }

  // Handbook Task 21: the Team page's Firm Work half — no assignee
  // filter at all, since Firm Work is all-team visible by design
  // (work_items_read grants unconditional read on work_scope='firm' to
  // any active teammate). Grouping by person happens client-side after
  // this one query returns, not via N per-person queries.
  async function loadAllFirmWork() {
    var res = await sb.from('work_items').select('*')
      .eq('work_scope', 'firm')
      .order('internal_due_date', { ascending: true, nullsFirst: false });
    if (res.error) { toast('Could not load Firm Work: ' + res.error.message, true); return []; }
    return res.data || [];
  }

  async function loadWork(mode) {
    // Every caller of loadWork() is a Client Work view (My Work, Review,
    // All Work, Today, Deadlines, Manager Dashboard, Period Summary,
    // notification generation) — Firm Work (work_scope='firm', added
    // alongside Client Work in the same work_items table) must never
    // silently show up in any of them, per the explicit "must not
    // contaminate client compliance reporting" requirement. This one
    // filter covers all of those call sites at once. (My Work's Firm
    // Work half comes from loadMyFirmWork() above, kept entirely
    // separate — see Handbook Task 20.)
    var q = sb.from('work_items').select('*').eq('work_scope', 'client').order('internal_due_date', { ascending: true, nullsFirst: false });
    if (mode === 'mine') q = q.eq('assignee_id', state.user.id);
    if (mode === 'review') {
      q = q.eq('status', 'ready_for_review');
      // A plain reviewer only sees work where they're the assigned
      // reviewer; admins see the whole review queue. This mirrors the
      // work_items_read RLS policy (see supabase/migrations) — the
      // filter here is for a tidy query, not the actual security
      // boundary, since RLS enforces the same rule even if this line
      // were removed or bypassed.
      if (!isAdmin()) q = q.eq('reviewer_id', state.user.id);
    }
    var res = await q;
    if (res.error) { toast('Could not load work: ' + res.error.message, true); return []; }
    return res.data || [];
  }
  // Returns { [work_item_id]: "unresolved item titles, comma joined" } for
  // display on Today's attention rows and the Client Page's Outstanding
  // section — the source of truth for "what are we waiting on" is the
  // work_waiting_items checklist, not the old single-text waiting_reason.
  async function loadWaitingSummaries(workItemIds) {
    if (!workItemIds.length) return {};
    var res = await sb.from('work_waiting_items').select('*').in('work_item_id', workItemIds);
    var byWork = {};
    (res.data || []).forEach(function (wi) {
      if (!byWork[wi.work_item_id]) byWork[wi.work_item_id] = [];
      byWork[wi.work_item_id].push(wi);
    });
    var summaries = {};
    Object.keys(byWork).forEach(function (workId) {
      var items = byWork[workId];
      var unresolved = items.filter(function (i) { return !i.is_received; });
      summaries[workId] = unresolved.length ? unresolved.map(function (i) { return i.title; }).join(', ') : null;
    });
    return summaries;
  }

  // ============================================================
  // Routing — minimal hash-based routing so the back button and page
  // refresh both land somewhere sensible, without a full router library.
  // ============================================================
  // Handbook Task 26: move focus to the new page's own <h1> after every
  // navigation. Every renderXPage()/renderWorkDetail()/etc. already
  // builds a real h1 (that part was already correct); what was missing
  // is that swapping #main's content never told anyone focus should move
  // there too — a screen-reader user clicking a sidebar item got no
  // indication their location in the app had changed at all. Given a
  // tabindex so it's programmatically focusable (an h1 isn't focusable
  // by default), same technique as errorEl on the public contact form.
  function focusMainHeading() {
    var h = qs('#main') && qs('#main').querySelector('h1');
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus();
  }
  window.addEventListener('hashchange', routeFromHash);
  function routeFromHash() {
    var hash = location.hash.replace(/^#/, '');
    // Real bug found during a manual audit: these three detail-page
    // branches call their own render function directly instead of going
    // through render() (which starts with renderSidebar()) -- landing on
    // a work/client/Firm Work item via a real link (gotoWork/gotoClient/
    // gotoFirmWork, used from Today, Search, Team, and elsewhere) left the
    // sidebar showing whichever section was active BEFORE, not the one
    // the item actually belongs to. renderSidebar() here matches what
    // render() already does for every other destination.
    if (hash.indexOf('work/') === 0) {
      state.view = 'work-detail';
      state.workId = hash.slice(5);
      renderSidebar();
      renderWorkDetail(state.workId).then(focusMainHeading);
      return;
    }
    if (hash.indexOf('client/') === 0) {
      state.view = 'client-detail';
      state.clientDetailId = hash.slice(7);
      renderSidebar();
      renderClientDetail(state.clientDetailId).then(focusMainHeading);
      return;
    }
    // Handbook Task 18: Firm Work gets its own detail page (not
    // renderWorkDetail — that page assumes client-scope fields like
    // client_id/service_template_id/waiting_for_client throughout).
    if (hash.indexOf('firmwork/') === 0) {
      state.view = 'firmwork-detail';
      state.workId = hash.slice(9);
      renderSidebar();
      renderFirmWorkDetail(state.workId).then(focusMainHeading);
      return;
    }
    // Search keeps its filters in the URL as a query string (?q=...&status=
    // ...) so a search is a shareable/reloadable link, not just in-memory
    // state — but renderSearchPage writes to it via history.replaceState
    // (see there), not by setting location.hash, so filtering doesn't
    // re-trigger this whole-page route/render on every keystroke.
    if (hash === 'search' || hash.indexOf('search?') === 0) {
      state.view = 'search';
      state.searchQuery = hash.indexOf('?') !== -1 ? hash.slice(hash.indexOf('?') + 1) : '';
      renderAndFocus();
      return;
    }
    // Task 25: Deadlines accepts an optional ?client=<id> the same way
    // Search accepts its own query string -- this is what makes "View
    // Deadlines" on a Clients-page card (or Client Detail) a real,
    // reloadable/shareable link into a pre-filtered Deadlines view rather
    // than just a jump to the unfiltered page. Consumed once by
    // renderDeadlinesPage and cleared immediately after, so a later plain
    // #deadlines navigation is never left stuck on someone else's filter.
    if (hash === 'deadlines' || hash.indexOf('deadlines?') === 0) {
      state.view = 'deadlines';
      var qIdx = hash.indexOf('?');
      state.deadlinesPrefillClient = qIdx !== -1 ? (new URLSearchParams(hash.slice(qIdx + 1)).get('client') || null) : null;
      renderAndFocus();
      return;
    }
    var known = ['today', 'search', 'my-work', 'team', 'since-last-seen', 'review', 'all-work', 'manager', 'reports', 'periods', 'todo', 'firm-work', 'clients', 'attendance', 'directory', 'profile', 'templates', 'staff', 'settings'];
    state.view = known.indexOf(hash) !== -1 ? hash : 'today';
    renderAndFocus();
  }
  // render() returns a Promise for most views (their renderXPage()
  // functions are async) but not all (e.g. renderClients/
  // renderSettingsPage are synchronous) — this only exists to bridge
  // that difference for routeFromHash's own navigation-focus call above;
  // render()'s many OTHER call sites (in-place refreshes after a save,
  // not real navigations) are deliberately untouched, since yanking
  // focus to the page heading after e.g. checking a checklist box would
  // be a regression, not a fix.
  function renderAndFocus() {
    var result = render();
    if (result && typeof result.then === 'function') result.then(focusMainHeading);
    else focusMainHeading();
  }
  function goto(view) { location.hash = view; }
  function gotoWork(id) { location.hash = 'work/' + id; }
  function gotoClient(id) { location.hash = 'client/' + id; }
  function gotoFirmWork(id) { location.hash = 'firmwork/' + id; }
  // Task 25: the Clients-page cross-link into a client-filtered Deadlines
  // view (see routeFromHash's own ?client= handling above).
  function gotoDeadlinesForClient(clientId) { location.hash = 'deadlines?client=' + encodeURIComponent(clientId); }

  // ============================================================
  // Sidebar
  // ============================================================
  // Task 22: information architecture redesign. Before this task the
  // sidebar was 18 flat destinations for a five-person team — every screen
  // was its own equal-weight nav entry. NAV_GROUPS collapses related
  // screens behind one primary destination (Client Work, Firm Work, Team,
  // Reports, Personal, Admin), each exposing its members as page-level
  // tabs (see renderGroupTabs()) instead of separate sidebar buttons.
  // Every existing hash route below is unchanged — this only changes how
  // they're reached from the sidebar, not what they are, so every
  // existing deep link (notifications, search links, bookmarks) still
  // resolves exactly where it always did.
  var NAV_GROUPS = {
    clientWork: {
      label: 'Client Work', icon: 'folder',
      tabs: [
        { view: 'all-work', label: 'All Work', guard: isReviewerOrAdmin },
        { view: 'review', label: 'Review Queue', guard: isReviewerOrAdmin },
        { view: 'deadlines', label: 'Deadlines' },
        { view: 'clients', label: 'Clients' }
      ]
    },
    firmWork: {
      label: 'Firm Work', icon: 'briefcase',
      tabs: [
        { view: 'firm-work', label: 'Work' },
        // Task 28: was "Recent Updates" — read on its own that sounded
        // like it could mean recent updates across everything (including
        // Client Work), and paired oddly with the page's own "Since Last
        // Seen" heading. "Catch-Up" matches the page's own framing
        // ("a catch-up feed") and needs no further scope explanation once
        // it's already a tab under Firm Work.
        { view: 'since-last-seen', label: 'Catch-Up' }
      ]
    },
    team: {
      label: 'Team', icon: 'users',
      tabs: [
        { view: 'team', label: 'Team Work' },
        { view: 'directory', label: 'Directory' },
        { view: 'attendance', label: 'Attendance' }
      ]
    },
    reports: {
      label: 'Reports', icon: 'chart',
      tabs: [
        { view: 'reports', label: 'Reports', guard: isReviewerOrAdmin },
        { view: 'manager', label: 'Operations Overview', guard: isReviewerOrAdmin },
        { view: 'periods', label: 'Period Summary' }
      ]
    },
    personal: {
      label: 'Personal', icon: 'user',
      tabs: [
        { view: 'profile', label: 'My Profile' },
        { view: 'todo', label: 'My To-Do' }
      ]
    },
    admin: {
      label: 'Admin', icon: 'settings', guard: isAdmin,
      tabs: [
        { view: 'staff', label: 'Staff & Access' },
        { view: 'templates', label: 'Templates' },
        { view: 'settings', label: 'Settings' }
      ]
    }
  };
  // Reverse lookup built once — view name -> the group it lives under, used
  // by render() to decide whether a page-level tab bar is needed at all.
  var VIEW_TO_GROUP = {};
  Object.keys(NAV_GROUPS).forEach(function (k) {
    NAV_GROUPS[k].tabs.forEach(function (t) { VIEW_TO_GROUP[t.view] = k; });
  });
  function groupVisibleTabs(groupKey) {
    return NAV_GROUPS[groupKey].tabs.filter(function (t) { return !t.guard || t.guard(); });
  }
  // A group's sidebar entry is "active" both when the current view is one
  // of its own tabs, and when it's the detail page reached by drilling into
  // one of them — same permissive either/or the flat sidebar always used
  // (e.g. a work-item detail page previously lit up both "My Tasks" and
  // "Client Work" at once; that's preserved here, not a new ambiguity).
  function groupIsActive(groupKey) {
    var tabViews = NAV_GROUPS[groupKey].tabs.map(function (t) { return t.view; });
    if (tabViews.indexOf(state.view) !== -1) return true;
    if (groupKey === 'clientWork' && (state.view === 'work-detail' || state.view === 'client-detail')) return true;
    if (groupKey === 'firmWork' && state.view === 'firmwork-detail') return true;
    return false;
  }
  function renderSidebar() {
    var nav = qs('#sidebar');
    clear(nav);
    function group(label) {
      var g = el('div', 'sidebar-group'); g.textContent = label; nav.appendChild(g);
    }
    function navButton(label, iconName, isActive, onClick) {
      var b = el('button');
      b.type = 'button';
      b.appendChild(icon(iconName));
      b.appendChild(document.createTextNode(label));
      b.classList.toggle('is-active', isActive);
      if (isActive) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.addEventListener('click', function () { closeNavDrawer(); onClick(); });
      nav.appendChild(b);
    }
    function item(view, label, iconName, isActiveOverride) {
      var isActive = typeof isActiveOverride === 'boolean' ? isActiveOverride : state.view === view;
      navButton(label, iconName, isActive, function () { goto(view); });
    }
    function groupNavItem(groupKey) {
      var g = NAV_GROUPS[groupKey];
      if (g.guard && !g.guard()) return;
      var tabs = groupVisibleTabs(groupKey);
      if (!tabs.length) return;
      navButton(g.label, g.icon, groupIsActive(groupKey), function () { goto(tabs[0].view); });
    }
    function externalItem(label, href, iconName) {
      var a = el('a', 'admin-link-btn'); a.href = href; a.target = '_blank'; a.rel = 'noopener';
      a.appendChild(icon(iconName)); a.appendChild(document.createTextNode(label)); nav.appendChild(a);
    }

    // Roughly the "Today, My Work, Client Work, Firm Work, Team, Reports,
    // Personal, Admin" hierarchy: 7 destinations for most roles, 8 for
    // admin — down from 18 flat entries, with nothing removed (every old
    // destination is still one click away, just as a page-level tab now).
    group('Workspace');
    item('today', 'Today', 'sun');
    item('my-work', 'My Work', 'clipboard', state.view === 'my-work' || state.view === 'work-detail');
    groupNavItem('clientWork');
    groupNavItem('firmWork');

    group('Team & Reporting');
    groupNavItem('team');
    groupNavItem('reports');

    group('Personal');
    groupNavItem('personal');

    if (isAdmin()) {
      group('Administration');
      groupNavItem('admin');
      externalItem('Website Content Admin', '/admin/', 'settings');
    }
  }

  // The page-level tab row for a grouped destination (Client Work, Firm
  // Work, Team, Reports, Personal, Admin) — appended into #main before the
  // group's active screen renders. Skipped entirely when a role can only
  // see one tab in the group (e.g. a plain employee's Reports group is
  // just Period Summary), so nobody sees a tab bar with nothing to switch
  // to.
  function renderGroupTabs(main, groupKey) {
    var g = NAV_GROUPS[groupKey];
    var tabs = groupVisibleTabs(groupKey);
    if (tabs.length < 2) return;
    var bar = el('div', 'subtabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', g.label + ' sections');
    tabs.forEach(function (t) {
      var b = el('button', 'subtab');
      b.type = 'button';
      b.textContent = t.label;
      var isActive = state.view === t.view;
      b.classList.toggle('is-active', isActive);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(isActive));
      b.addEventListener('click', function () { goto(t.view); });
      bar.appendChild(b);
    });
    main.appendChild(bar);
  }

  function render() {
    renderSidebar();
    var main = qs('#main');
    clear(main);
    var groupKey = VIEW_TO_GROUP[state.view];
    if (groupKey) renderGroupTabs(main, groupKey);
    if (state.view === 'today') return renderTodayPage(main);
    if (state.view === 'search') return renderSearchPage(main, state.searchQuery || '');
    if (state.view === 'my-work') return renderWorkListView(main, 'My Work', 'mine');
    if (state.view === 'team') return renderTeamPage(main);
    if (state.view === 'since-last-seen') return renderSinceLastSeenPage(main);
    if (state.view === 'review') return renderWorkListView(main, 'Review', 'review');
    if (state.view === 'all-work') return renderWorkListView(main, 'All Work', 'all');
    if (state.view === 'deadlines') return renderDeadlinesPage(main);
    if (state.view === 'manager') return renderManagerDashboard(main);
    if (state.view === 'reports') return renderReportsPage(main);
    if (state.view === 'periods') return renderPeriodSummaryPage(main);
    if (state.view === 'todo') return renderTodoPage(main);
    if (state.view === 'firm-work') return renderFirmWorkPage(main);
    if (state.view === 'clients') return renderClients(main);
    if (state.view === 'attendance') return renderAttendancePage(main);
    if (state.view === 'directory') return renderDirectoryPage(main);
    if (state.view === 'profile') return renderProfilePage(main);
    if (state.view === 'templates') return renderTemplates(main);
    if (state.view === 'staff') return renderStaff(main);
    if (state.view === 'settings') return renderSettingsPage(main);
  }

  // ============================================================
  // Today — the landing screen. Purpose: help the person decide what to
  // work on next, not show off charts. Pulls only "my work" plus (for
  // reviewers/admins) how many items are sitting in the review queue.
  // ============================================================
  // Task 23: compact punch in/out status, shown right on Today so the one
  // attendance action most people take once or twice a day never needs its
  // own page visit. Refreshes itself in place after a punch rather than a
  // full Today re-render — same "quick action, quiet UI" reasoning as the
  // checklist/waiting-item toggles elsewhere in this app. Deliberately not
  // a full metrics/calendar view (that's the Attendance destination) — an
  // action driving widget, not decorative analytics.
  async function renderTodayAttendanceBar(main) {
    var bar = el('div', 'today-attendance-bar');
    main.appendChild(bar);
    async function refresh() {
      clear(bar);
      bar.appendChild(icon('clock'));
      var stateText = el('span', 'state-text');
      var today = await loadTodayAttendance();
      if (!today) {
        stateText.textContent = 'Not punched in yet';
        bar.appendChild(stateText);
        var inBtn = el('button', 'btn btn-sm'); inBtn.type = 'button'; inBtn.textContent = 'Punch In';
        inBtn.addEventListener('click', async function () {
          inBtn.disabled = true;
          var r = await sb.rpc('attendance_punch_in');
          inBtn.disabled = false;
          if (r.error) { toast('Punch in failed: ' + r.error.message, true); return; }
          toast('Punched in.');
          refresh();
        });
        bar.appendChild(inBtn);
      } else if (!today.punched_out_at) {
        stateText.appendChild(document.createTextNode('Punched in '));
        var strongIn = el('strong'); strongIn.textContent = timeOnly(today.punched_in_at); stateText.appendChild(strongIn);
        stateText.appendChild(document.createTextNode(' · currently open'));
        bar.appendChild(stateText);
        var outBtn = el('button', 'btn btn-outline btn-sm'); outBtn.type = 'button'; outBtn.textContent = 'Punch Out';
        outBtn.addEventListener('click', async function () {
          outBtn.disabled = true;
          var r = await sb.rpc('attendance_punch_out');
          outBtn.disabled = false;
          if (r.error) { toast('Punch out failed: ' + r.error.message, true); return; }
          toast('Punched out.');
          refresh();
        });
        bar.appendChild(outBtn);
      } else {
        stateText.textContent = 'In ' + timeOnly(today.punched_in_at) + ' · Out ' + timeOnly(today.punched_out_at) + ' · ' + durationText(attendanceSeconds(today));
        bar.appendChild(stateText);
        var done = el('span', 'attendance-status-pill complete'); done.textContent = 'Completed';
        bar.appendChild(done);
      }
    }
    await refresh();
  }

  async function renderTodayPage(main) {
    var greeting = el('h1', 'greeting');
    var hour = new Date().getHours();
    greeting.textContent = (hour < 12 ? 'Good morning, ' : hour < 17 ? 'Good afternoon, ' : 'Good evening, ') + (state.profile.full_name || '').split(' ')[0];
    main.appendChild(greeting);
    var dateLine = el('div', 'greeting-date');
    dateLine.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    main.appendChild(dateLine);

    await renderTodayAttendanceBar(main);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var results = await Promise.all([loadWork('mine'), isReviewerOrAdmin() ? loadWork('review') : Promise.resolve([]), loadMyFirmWork()]);
    var mine = results[0];
    var reviewCount = results[1].length;
    var firmMine = results[2];
    // Guarded rather than a bare removeChild: if a hash navigation lands
    // (e.g. a direct/shared link, or a notification click) before this
    // page's own initial fetch resolves, a newer render may have already
    // cleared #main out from under this one -- an unguarded removeChild
    // on a node that's no longer main's child throws "not a child of
    // this node" (found via Handbook Task 18's direct-link Playwright
    // test, a real race, not new since only that test happened to await
    // an immediate post-login hash change and check for console errors).
    if (loading.parentNode) loading.parentNode.removeChild(loading);

    var open = mine.filter(function (w) { return w.status !== 'completed'; });
    var overdue = open.filter(isOverdue);
    var todayStr = localDateStr();
    var dueToday = open.filter(function (w) { return effectiveDue(w) === todayStr && !isOverdue(w); });
    var waiting = open.filter(function (w) { return w.status === 'waiting_for_client'; });

    var strip = el('div', 'today-strip');
    function stat(n, label, colorCls) {
      var s = el('div', 'today-stat');
      var num = el('div', 'n' + (colorCls ? ' ' + colorCls : '')); num.textContent = String(n);
      var l = el('div', 'l'); l.textContent = label;
      s.appendChild(num); s.appendChild(l);
      strip.appendChild(s);
    }
    stat(overdue.length, 'Overdue', 'n-red');
    stat(dueToday.length, 'Due Today');
    stat(waiting.length, 'Waiting', 'n-amber');
    if (isReviewerOrAdmin()) stat(reviewCount, 'Review', 'n-purple');
    main.appendChild(strip);

    // Needs Your Attention — overdue first, then anything I'm waiting on a
    // client for, then anything a reviewer sent back. An item never
    // appears twice even if it'd qualify for more than one reason.
    var seen = {};
    var attention = [];
    overdue.forEach(function (w) { attention.push({ w: w, reason: 'overdue' }); seen[w.id] = true; });
    waiting.forEach(function (w) { if (!seen[w.id]) { attention.push({ w: w, reason: 'waiting' }); seen[w.id] = true; } });
    open.filter(function (w) { return w.status === 'changes_required'; }).forEach(function (w) { if (!seen[w.id]) { attention.push({ w: w, reason: 'changes' }); seen[w.id] = true; } });

    if (attention.length) {
      var waitingSummaries = await loadWaitingSummaries(waiting.map(function (w) { return w.id; }));
      var h2a = el('div', 'section-h'); h2a.textContent = 'Needs Your Attention';
      main.appendChild(h2a);
      attention.forEach(function (a) { main.appendChild(attentionRow(a.w, a.reason, waitingSummaries[a.w.id])); });
    }

    // Upcoming — next 7 days, excluding anything already shown above.
    var horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
    var upcoming = open.filter(function (w) {
      if (seen[w.id]) return false;
      var due = effectiveDue(w);
      if (!due) return false;
      var dt = new Date(due + 'T00:00:00');
      return dt >= new Date(new Date().toDateString()) && dt <= horizon;
    }).sort(compareByDue);

    if (upcoming.length) {
      var h2b = el('div', 'section-h'); h2b.style.marginTop = '22px'; h2b.textContent = 'Upcoming (Next 7 Days)';
      main.appendChild(h2b);
      var wrap = el('div', 'task-group');
      upcoming.forEach(function (w) { wrap.appendChild(workRow(w)); });
      main.appendChild(wrap);
    }

    // Task 23: Firm Work's own "next actions" — clearly separated from
    // Client Work compliance urgency above, both by its own heading (with
    // the same gold FIRM badge used everywhere else Firm Work appears
    // alongside Client Work) and by never reusing isOverdue()/
    // attentionRow()'s red styling. A missed Firm target is a scheduling
    // signal, not a statutory breach — see firmWorkRow()'s own note on
    // this. Deliberately narrow (blocked + due this week only, not the
    // full Firm Work list) so Today stays a "what do I do next" screen,
    // not a second Firm Work list page.
    var firmOpen = firmMine.filter(function (w) { return w.status !== 'completed'; });
    var firmBlocked = firmOpen.filter(function (w) { return w.status === 'blocked'; });
    var firmHorizon = new Date(); firmHorizon.setDate(firmHorizon.getDate() + 7);
    var firmApproaching = firmOpen.filter(function (w) {
      if (w.status === 'blocked' || !w.internal_due_date) return false;
      var dt = new Date(w.internal_due_date + 'T00:00:00');
      return dt <= firmHorizon;
    }).sort(compareByDue);

    if (firmBlocked.length || firmApproaching.length) {
      var h2f = el('div', 'section-h section-h-firm'); h2f.style.marginTop = '22px';
      h2f.appendChild(document.createTextNode('Firm Work — Next Actions '));
      var firmTag = el('span', 'badge badge-scope-firm'); firmTag.textContent = 'FIRM';
      h2f.appendChild(firmTag);
      main.appendChild(h2f);
      if (firmBlocked.length) {
        var blockedWrap = el('div', 'task-group');
        var h3bl = el('h3'); h3bl.appendChild(document.createTextNode('Blocked '));
        var cbl = el('span', 'count'); cbl.textContent = String(firmBlocked.length); h3bl.appendChild(cbl);
        blockedWrap.appendChild(h3bl);
        firmBlocked.forEach(function (w) { blockedWrap.appendChild(firmWorkRow(w)); });
        main.appendChild(blockedWrap);
      }
      if (firmApproaching.length) {
        var approachWrap = el('div', 'task-group');
        var h3ap = el('h3'); h3ap.appendChild(document.createTextNode('Approaching Targets '));
        var cap = el('span', 'count'); cap.textContent = String(firmApproaching.length); h3ap.appendChild(cap);
        approachWrap.appendChild(h3ap);
        firmApproaching.forEach(function (w) { approachWrap.appendChild(firmWorkRow(w)); });
        main.appendChild(approachWrap);
      }
    }

    if (!attention.length && !upcoming.length && !firmBlocked.length && !firmApproaching.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('check')); empty.appendChild(document.createTextNode('Nothing needs your attention right now.'));
      main.appendChild(empty);
    }
  }

  function attentionRow(w, reason, waitingSummary) {
    var row = el('div', 'attention-row' + (reason === 'waiting' ? ' reason-waiting' : reason === 'changes' ? ' reason-changes' : ''));
    row.addEventListener('click', function () { gotoWork(w.id); });
    var body = el('div', 'body');
    var client = el('div', 'client'); client.textContent = clientName(w.client_id);
    var svc = el('div', 'svc');
    var tmpl = templateById(w.service_template_id);
    svc.textContent = (tmpl ? tmpl.title : w.title) + (w.period ? ' · ' + w.period : '');
    var reasonEl = el('div', 'reason');
    var actionLabel;
    if (reason === 'overdue') {
      var n = daysOverdue(w);
      reasonEl.textContent = 'OVERDUE ' + n + ' DAY' + (n === 1 ? '' : 'S') + ' — ' + dueDateText(w);
      actionLabel = 'Open →';
    } else if (reason === 'waiting') {
      reasonEl.textContent = waitingSummary ? ('Waiting for ' + waitingSummary + (w.waiting_since ? ', requested ' + fmtDate(w.waiting_since) : '')) : 'Waiting for client';
      actionLabel = 'Follow up →';
    } else {
      reasonEl.textContent = 'Reviewer requested changes';
      actionLabel = 'Fix →';
    }
    body.appendChild(client); body.appendChild(svc); body.appendChild(reasonEl);
    row.appendChild(body);
    var action = el('div', 'action'); action.textContent = actionLabel;
    row.appendChild(action);
    return row;
  }

  // ============================================================
  // Task 25: Client Work Hub connective strip — shown at the top of
  // every screen in the Client Work group (All Work, Review Queue,
  // Deadlines, Clients) so the four routes read as one coherent
  // compliance workflow even though each stays its own page. Every stat
  // is a real link into another one of these four screens, not a
  // decorative count -- clicking "Review Queue" from the Deadlines page
  // (or vice versa) is the actual point of this component. Deliberately
  // never touches Firm Work (loadWork() is Client-Work-only everywhere
  // it's used, see its own header comment) and never folds an internal
  // target into the statutory-deadline count below (external_due_date
  // only), matching this task's own "do not confuse internal targets
  // with statutory deadlines" instruction. A self-contained fetch (not
  // fed from the calling page's own query) so it stays a single,
  // reusable component regardless of which of the four pages calls it.
  async function renderClientWorkHubStrip(main) {
    var strip = el('div', 'hub-strip');
    main.appendChild(strip);

    function stat(label, n, view, colorCls) {
      var b = el('button', 'hub-stat' + (colorCls && n ? ' ' + colorCls : ''));
      b.type = 'button';
      var num = el('div', 'n'); num.textContent = String(n);
      var l = el('div', 'l'); l.textContent = label;
      b.appendChild(num); b.appendChild(l);
      b.addEventListener('click', function () { goto(view); });
      strip.appendChild(b);
    }

    var items = await loadWork(isReviewerOrAdmin() ? 'all' : 'mine');
    var open = items.filter(function (w) { return w.status !== 'completed'; });
    var weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
    var weekStr = localDateStr(weekOut);
    var statutorySoon = open.filter(function (w) { return w.external_due_date && w.external_due_date <= weekStr; });

    if (isReviewerOrAdmin()) {
      var actionRequired = open.filter(function (w) {
        return isOverdue(w) || w.status === 'waiting_for_client' || w.status === 'changes_required';
      });
      var reviewItems = await loadWork('review');
      stat('Action Required', actionRequired.length, 'all-work', 'n-red');
      stat('Review Queue', reviewItems.length, 'review', 'n-purple');
    }
    stat('Statutory Deadlines (7d)', statutorySoon.length, 'deadlines', 'n-amber');
    stat('Active Clients', state.clients.filter(function (c) { return c.is_active; }).length, 'clients', null);
  }

  // ============================================================
  // Work list views (My Work / Review / All Work)
  // ============================================================
  async function renderWorkListView(main, title, mode) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = title;
    head.appendChild(h1);
    // My Tasks spans two genuinely different workflows. Keep creation choices
    // explicit instead of a vague "New Work" button that silently opens only
    // the Client Work form.
    var headActions = el('div', 'page-head-actions');
    var addClientBtn = el('button', 'btn btn-sm');
    addClientBtn.type = 'button'; addClientBtn.appendChild(icon('plus'));
    addClientBtn.appendChild(document.createTextNode(mode === 'mine' ? 'New Client Work' : 'New Work'));
    addClientBtn.addEventListener('click', function () { openNewWorkModal(); });
    headActions.appendChild(addClientBtn);
    if (mode === 'mine') {
      var addFirmBtn = el('button', 'btn btn-outline btn-sm');
      addFirmBtn.type = 'button'; addFirmBtn.appendChild(icon('briefcase')); addFirmBtn.appendChild(document.createTextNode('New Firm Work'));
      addFirmBtn.addEventListener('click', function () { openFirmWorkModal(function (newId) { if (newId) gotoFirmWork(newId); else render(); }); });
      headActions.appendChild(addFirmBtn);
    }
    head.appendChild(headActions);
    main.appendChild(head);

    // Task 25: the Client Work Hub strip belongs on Review Queue and All
    // Work (both members of the Client Work group) — not on My Work,
    // which is its own separate top-level destination, not part of this
    // group (see Task 22's NAV_GROUPS).
    if (mode !== 'mine') await renderClientWorkHubStrip(main);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    // Handbook Task 20: My Work is the one view that spans both scopes —
    // fetch Client and Firm Work in parallel, each with its own
    // server-side assignee_id filter (never a client-side download-then-
    // filter of every Firm Work row), and hand off to the combined
    // renderer entirely. Review/All Work are untouched below — both stay
    // exactly the single-scope, Client-Work-only views they always were.
    if (mode === 'mine') {
      var results = await Promise.all([loadWork('mine'), loadMyFirmWork()]);
      var clientItems = results[0].slice().sort(compareByDue);
      var firmItems = results[1].slice().sort(compareByDue);
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      renderMyWorkCombined(main, clientItems, firmItems);
      return;
    }

    var items = await loadWork(mode);
    // The DB query orders by internal_due_date alone, which pushes a work
    // item that only has a filing due date set to the bottom as if it had
    // no due date at all. Re-sort client-side by effective due date
    // (internal, falling back to filing) so it lands where it actually
    // belongs.
    items = items.slice().sort(compareByDue);
    // Guarded rather than a bare removeChild: if a hash navigation lands
    // (e.g. a direct/shared link, or a notification click) before this
    // page's own initial fetch resolves, a newer render may have already
    // cleared #main out from under this one -- an unguarded removeChild
    // on a node that's no longer main's child throws "not a child of
    // this node" (found via Handbook Task 18's direct-link Playwright
    // test, a real race, not new since only that test happened to await
    // an immediate post-login hash change and check for console errors).
    if (loading.parentNode) loading.parentNode.removeChild(loading);

    if (mode === 'all') renderWorkloadSummary(main, items);
    renderFlatWorkList(main, items, mode === 'all' && isReviewerOrAdmin());
  }

  // opts (Handbook Task 20, both optional, both default to the original
  // Client Work behavior so every pre-existing call site is unaffected):
  //   rowRenderer(w) -- defaults to plain workRow(w); the combined My
  //     Work view passes `function (w) { return workRow(w, true); }` to
  //     add the CLIENT scope tag.
  //   suppressEmpty -- when true, skip this function's own "no work"
  //     message; the combined My Work view shows one message covering
  //     both scopes instead of a possible duplicate/wrong one here.
  function renderGroupedWork(main, items, opts) {
    opts = opts || {};
    var rowRenderer = opts.rowRenderer || workRow;
    var groups = [
      { key: 'overdue', label: 'Overdue', filter: function (w) { return isOverdue(w); } },
      { key: 'ready_for_review', label: 'Ready for Review', filter: function (w) { return w.status === 'ready_for_review' && !isOverdue(w); } },
      { key: 'changes_required', label: 'Changes Required', filter: function (w) { return w.status === 'changes_required' && !isOverdue(w); } },
      { key: 'in_progress', label: 'In Progress', filter: function (w) { return w.status === 'in_progress' && !isOverdue(w); } },
      { key: 'waiting_for_client', label: 'Waiting for Client', filter: function (w) { return w.status === 'waiting_for_client' && !isOverdue(w); } },
      { key: 'approved', label: 'Approved', filter: function (w) { return w.status === 'approved' && !isOverdue(w); } },
      { key: 'ready_to_submit', label: 'Ready to Submit', filter: function (w) { return w.status === 'ready_to_submit' && !isOverdue(w); } },
      { key: 'to_do', label: 'To Do', filter: function (w) { return w.status === 'to_do' && !isOverdue(w); } },
      { key: 'completed', label: 'Recently Completed', filter: function (w) { return w.status === 'completed'; } },
    ];
    var shown = 0, completedHidden = 0;
    groups.forEach(function (g) {
      var rows = items.filter(g.filter);
      if (g.key === 'completed') {
        // Task 24: hidden by default (same "Show completed" convention as
        // the Team page) so the actionable groups above it aren't pushed
        // down the page/off a mobile screen by a status that, by
        // definition, needs nothing further from anyone.
        if (opts.hideCompleted) { completedHidden = rows.length; return; }
        rows = rows.slice(0, 10);
      }
      if (!rows.length) return;
      shown += rows.length;
      var wrap = el('div', 'task-group');
      var h3 = el('h3');
      h3.appendChild(document.createTextNode(g.label + ' '));
      var count = el('span', 'count'); count.textContent = String(rows.length);
      h3.appendChild(count);
      wrap.appendChild(h3);
      rows.forEach(function (w) { wrap.appendChild(rowRenderer(w)); });
      main.appendChild(wrap);
    });
    if (!shown && !completedHidden && !opts.suppressEmpty) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No work assigned to you yet.'));
      main.appendChild(empty);
    }
    return { shown: shown, completedHidden: completedHidden };
  }

  // Handbook Task 20: Firm Work's own grouped section within the
  // combined My Work view. Mirrors renderGroupedWork's shape (status
  // groups, "Recently Completed" capped at 10) but with Firm's own
  // 5-status set and no overdue/urgency grouping -- Blocked is listed
  // first as the operationally-most-attention-needed state, not because
  // it's styled as urgent the way an overdue Client item is.
  function renderFirmWorkGroups(main, items, opts) {
    opts = opts || {};
    var groups = [
      { key: 'blocked', label: 'Blocked', filter: function (w) { return w.status === 'blocked'; } },
      { key: 'in_progress', label: 'In Progress', filter: function (w) { return w.status === 'in_progress'; } },
      { key: 'review', label: 'In Review', filter: function (w) { return w.status === 'review'; } },
      { key: 'to_do', label: 'To Do', filter: function (w) { return w.status === 'to_do'; } },
      { key: 'completed', label: 'Recently Completed', filter: function (w) { return w.status === 'completed'; } },
    ];
    var shown = 0, completedHidden = 0;
    groups.forEach(function (g) {
      var rows = items.filter(g.filter);
      if (g.key === 'completed') {
        if (opts.hideCompleted) { completedHidden = rows.length; return; }
        rows = rows.slice(0, 10);
      }
      if (!rows.length) return;
      shown += rows.length;
      var wrap = el('div', 'task-group');
      var h3 = el('h3');
      h3.appendChild(document.createTextNode(g.label + ' '));
      var count = el('span', 'count'); count.textContent = String(rows.length);
      h3.appendChild(count);
      wrap.appendChild(h3);
      rows.forEach(function (w) { wrap.appendChild(firmWorkRow(w)); });
      main.appendChild(wrap);
    });
    return { shown: shown, completedHidden: completedHidden };
  }

  // Handbook Task 20: "one view of work assigned to them" spanning both
  // Client and Firm Work, without merging their very different urgency
  // semantics. Client Work's existing grouped sections (Overdue/Ready
  // for Review/etc, unchanged) always render before any Firm Work
  // section -- a Firm target due tomorrow must never visually outrank an
  // overdue Client compliance item, which a single date-sorted list
  // would risk. The "All/Client/Firm" scope filter only toggles which
  // of the two ALREADY-LOADED sets render; both were fetched with their
  // own server-side assignee_id filter (see renderWorkListView), never a
  // client-side download-then-filter of every Firm Work row.
  function renderMyWorkCombined(main, clientItems, firmItems) {
    var intro = el('p', 'workspace-intro');
    intro.textContent = 'One place for work assigned to you. Client Work keeps compliance urgency and deadlines; Firm Work keeps lighter internal target dates.';
    main.appendChild(intro);

    var filterCard = el('div', 'card my-tasks-filter');
    var filterLabel = el('span', 'scope-tabs-label'); filterLabel.textContent = 'Task scope';
    var tabs = el('div', 'scope-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Filter My Work by scope');
    var currentScope = 'all';
    var buttons = {};
    [
      ['all', 'All', clientItems.length + firmItems.length],
      ['client', 'Client', clientItems.length],
      ['firm', 'Firm', firmItems.length]
    ].forEach(function (entry) {
      var b = el('button', 'scope-tab'); b.type = 'button'; b.dataset.scope = entry[0];
      b.textContent = entry[1] + ' (' + entry[2] + ')';
      b.addEventListener('click', function () { currentScope = entry[0]; apply(); });
      buttons[entry[0]] = b; tabs.appendChild(b);
    });
    filterCard.appendChild(filterLabel); filterCard.appendChild(tabs);
    // Task 24: "improve filters only where they reduce time-to-action" --
    // completed work needs nothing further from anyone, so hiding it by
    // default keeps the still-actionable groups above it closer to the
    // top of the page/screen. Same "Show completed" convention already
    // established on the Team page, not a new pattern.
    var completedLabel = el('label', 'my-tasks-completed-toggle');
    var completedCb = el('input'); completedCb.type = 'checkbox'; completedCb.style.width = 'auto';
    completedLabel.appendChild(completedCb); completedLabel.appendChild(document.createTextNode('Show completed'));
    filterCard.appendChild(completedLabel);
    completedCb.addEventListener('change', apply);
    main.appendChild(filterCard);

    var listWrap = el('div');
    main.appendChild(listWrap);

    function apply() {
      Object.keys(buttons).forEach(function (key) {
        var active = key === currentScope;
        buttons[key].classList.toggle('is-active', active);
        buttons[key].setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      clear(listWrap);
      var shownClient = 0, shownFirm = 0, hideCompleted = !completedCb.checked;

      if (currentScope !== 'firm') {
        if (clientItems.length) {
          var clientHead = el('div', 'scope-section-head');
          var clientTitle = el('h2'); clientTitle.textContent = 'Client Work'; clientHead.appendChild(clientTitle);
          var clientNote = el('p'); clientNote.textContent = 'Compliance work — filing/internal deadlines and review states remain priority signals.'; clientHead.appendChild(clientNote);
          listWrap.appendChild(clientHead);
        }
        var clientResult = renderGroupedWork(listWrap, clientItems, { rowRenderer: function (w) { return workRow(w, true); }, suppressEmpty: true, hideCompleted: hideCompleted });
        shownClient = clientResult.shown;
      }
      if (currentScope !== 'client' && firmItems.length) {
        var firmHead = el('div', 'scope-section-head scope-section-head--firm');
        var firmTitle = el('h2'); firmTitle.textContent = 'Firm Work'; firmHead.appendChild(firmTitle);
        var firmNote = el('p'); firmNote.textContent = 'Internal Maven work — targets, blockers and next action without statutory-risk styling.'; firmHead.appendChild(firmNote);
        listWrap.appendChild(firmHead);
        var firmResult = renderFirmWorkGroups(listWrap, firmItems, { hideCompleted: hideCompleted });
        shownFirm = firmResult.shown;
      }

      if (!shownClient && !shownFirm) {
        var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard'));
        empty.appendChild(document.createTextNode(
          currentScope === 'client' ? 'No Client Work assigned to you.' :
          currentScope === 'firm' ? 'No Firm Work assigned to you.' :
          'No work assigned to you yet.'
        ));
        listWrap.appendChild(empty);
      }
    }
    apply();
  }

  // ============================================================
  // Team — Handbook Task 21: "who currently owns what and what is the
  // next move?", open to every active teammate (not gated by role, see
  // the sidebar entry) — deliberately NOT the Manager Dashboard
  // (reviewer/admin-only workload counts + exceptions, unchanged and
  // untouched by this task). No productivity score, ranking, hours,
  // presence/online status, or utilization metric of any kind — every
  // number here is either a plain item list or absent entirely.
  //
  // SECURITY: both queries below are unfiltered by assignee_id (grouping
  // by person happens client-side after the fact) and rely ENTIRELY on
  // work_items_read RLS to decide what actually comes back — exactly the
  // same pattern Manager Dashboard's loadWork('all') already uses for
  // Client Work. A plain employee's query for work_scope='client' still
  // only returns rows where they're the assignee or reviewer (RLS), so
  // teammates' Client Work sections legitimately render empty for them
  // except any items they specifically review — that's the real
  // permission boundary working as intended, not a bug to route around.
  // Firm Work has no such restriction (all-team visible since Task 6/16),
  // so every teammate's Firm Work section is fully populated for everyone.
  // ============================================================
  async function renderTeamPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Team'; head.appendChild(h1);
    main.appendChild(head);

    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'What everyone currently owns, across Client and Firm Work — for coordination, not performance tracking.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var filterCard = el('div', 'card');
    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;';

    var personSel = el('select'); personSel.style.width = 'auto';
    personSel.appendChild(new Option('All Team Members', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { personSel.appendChild(new Option(p.full_name, p.id)); });
    filterRow.appendChild(personSel);

    var scopeSel = el('select'); scopeSel.style.width = 'auto';
    scopeSel.appendChild(new Option('All', 'all'));
    scopeSel.appendChild(new Option('Client', 'client'));
    scopeSel.appendChild(new Option('Firm', 'firm'));
    filterRow.appendChild(scopeSel);

    var completedLabel = el('label'); completedLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--ink-soft);cursor:pointer;';
    var completedCb = el('input'); completedCb.type = 'checkbox'; completedCb.style.width = 'auto';
    completedLabel.appendChild(completedCb); completedLabel.appendChild(document.createTextNode('Show completed'));
    filterRow.appendChild(completedLabel);

    filterCard.appendChild(filterRow);
    main.appendChild(filterCard);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);

    // Both queries are a single round trip each (no per-person looping);
    // work_items_read RLS is what actually scopes the Client Work half —
    // see this function's own header comment.
    var results = await Promise.all([loadWork('all'), loadAllFirmWork()]);
    var clientItems = results[0];
    var firmItems = results[1];

    // One batched latest-update query for Firm Work items with no
    // next_action set, same "load once, cheap at this org's size"
    // pattern renderFirmWorkPage's own list column already uses — never
    // a per-row query.
    var needCommentIds = firmItems.filter(function (w) { return !w.next_action; }).map(function (w) { return w.id; });
    var latestByItem = {};
    if (needCommentIds.length) {
      var commentsRes = await sb.from('work_comments').select('*').in('work_item_id', needCommentIds).order('created_at', { ascending: false });
      (commentsRes.data || []).forEach(function (c) { if (!latestByItem[c.work_item_id]) latestByItem[c.work_item_id] = c; });
    }

    clear(resultsWrap);

    function apply() {
      clear(resultsWrap);
      var scope = scopeSel.value;
      var people = state.profiles.filter(function (p) { return p.is_active; });
      if (personSel.value) people = people.filter(function (p) { return p.id === personSel.value; });

      if (!people.length) {
        var noPeople = el('div', 'empty-note'); noPeople.appendChild(icon('users')); noPeople.appendChild(document.createTextNode('No active team members.'));
        resultsWrap.appendChild(noPeople);
        return;
      }

      people.forEach(function (p) {
        var card = el('div', 'card'); card.style.marginBottom = '16px';
        var personHead = el('div'); personHead.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;';
        personHead.appendChild(avatarFor(p.id));
        var nameEl = el('div'); nameEl.style.cssText = 'font-weight:700;font-size:1.02rem;color:var(--navy-950);'; nameEl.textContent = p.full_name;
        personHead.appendChild(nameEl);
        card.appendChild(personHead);

        if (scope !== 'firm') {
          var pClient = clientItems.filter(function (w) {
            return w.assignee_id === p.id && (completedCb.checked || w.status !== 'completed');
          }).slice().sort(compareByDue);
          var clientSection = el('div'); clientSection.style.marginBottom = scope === 'all' ? '14px' : '0';
          var clientHead = el('h3'); clientHead.style.cssText = 'font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:8px;';
          clientHead.textContent = 'Client Work' + (pClient.length ? ' (' + pClient.length + ')' : '');
          clientSection.appendChild(clientHead);
          if (pClient.length) {
            pClient.forEach(function (w) { clientSection.appendChild(workRow(w, true)); });
          } else {
            var noClient = el('p', 'desc'); noClient.style.margin = '0 0 4px'; noClient.textContent = 'No open Client Work.';
            clientSection.appendChild(noClient);
          }
          card.appendChild(clientSection);
        }

        if (scope !== 'client') {
          var pFirm = firmItems.filter(function (w) {
            return w.assignee_id === p.id && (completedCb.checked || w.status !== 'completed');
          }).slice().sort(compareByDue);
          var firmSection = el('div');
          var firmHead = el('h3'); firmHead.style.cssText = 'font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:8px;';
          firmHead.textContent = 'Firm Work' + (pFirm.length ? ' (' + pFirm.length + ')' : '');
          firmSection.appendChild(firmHead);
          if (pFirm.length) {
            pFirm.forEach(function (w) { firmSection.appendChild(firmWorkRow(w, latestByItem[w.id] ? latestByItem[w.id].body : null)); });
          } else {
            var noFirm = el('p', 'desc'); noFirm.style.margin = '0'; noFirm.textContent = 'No open Firm Work.';
            firmSection.appendChild(noFirm);
          }
          card.appendChild(firmSection);
        }

        resultsWrap.appendChild(card);
      });
    }
    personSel.addEventListener('change', apply);
    scopeSel.addEventListener('change', apply);
    completedCb.addEventListener('change', apply);
    apply();
  }

  // Handbook Task 22: humanized labels for work_activity's `action`
  // values, shown on the Since Last Seen feed. 'completed' is special-
  // cased below (not here) since it's really status_changed with a
  // specific new status, not its own action value.
  var ACTIVITY_ACTION_LABELS = {
    created: 'Created', reassigned: 'Reassigned', due_date_changed: 'Target date changed',
    project_changed: 'Project changed', next_action_changed: 'Next action updated',
    blocker_changed: 'Blocker updated', status_changed: 'Status changed',
    checklist_toggled: 'Checklist updated',
  };
  // No "mark reviewed" ever clicked yet -- a bounded 14-day catch-up
  // window rather than an unbounded full history dump for a brand-new
  // user or one who hasn't opened this page in a long time.
  var SINCE_LAST_SEEN_DEFAULT_DAYS = 14;

  // ============================================================
  // Firm Work Catch-Up (internal view/function names kept as
  // renderSinceLastSeenPage / since_last_seen_at / mark_feed_seen from
  // Handbook Task 22 — only the user-facing label changed, Task 28): a
  // concise catch-up feed of Firm Work activity/updates since the caller
  // last marked it reviewed. Deliberately NOT chat, presence, or push
  // infrastructure -- no real-time delivery, no read receipts on other
  // people, nothing beyond "what changed since I was last here."
  //
  // CLIENT WORK is deliberately excluded (see this migration's own
  // header comment) -- Notifications already covers Client Work status/
  // due-date/reassignment changes, and duplicating that here would make
  // this "a second compliance notification system," which this task
  // explicitly warns against. Scoped by querying only work_scope='firm'
  // item ids before touching work_activity/work_comments at all.
  // ============================================================
  async function renderSinceLastSeenPage(main) {
    clear(main); // this function re-renders itself in place after "Mark Reviewed", not just on first navigation
    // The clear() above wipes out the Firm Work subtabs bar (Work/Catch-Up)
    // that render() already appended into main before calling this function
    // on a normal navigation -- restore it here so both the initial
    // navigation AND the post-"Mark Reviewed" self-refresh leave the tabs
    // in place, instead of only the initial one.
    var ownGroupKey = VIEW_TO_GROUP[state.view];
    if (ownGroupKey) renderGroupTabs(main, ownGroupKey);
    var head = el('div', 'page-head');
    // Task 28: renamed from "Since Last Seen" -- on its own that phrase
    // reads like it tracks when a PERSON was last online (exactly the
    // presence-monitoring impression this app has repeatedly and
    // deliberately avoided elsewhere, e.g. Attendance's own explicit no-
    // presence-tracking design). What this page actually tracks is when
    // YOU last reviewed it -- nothing about anyone else's activity or
    // whereabouts. The internal state field (`since_last_seen_at`) and
    // RPC (`mark_feed_seen`) keep their original names; this is a
    // user-facing copy fix only, not a schema change.
    var h1 = el('h1'); h1.textContent = 'Firm Work Catch-Up'; head.appendChild(h1);
    var markBtn = el('button', 'btn btn-sm'); markBtn.type = 'button'; markBtn.appendChild(icon('check')); markBtn.appendChild(document.createTextNode('Mark Reviewed'));
    head.appendChild(markBtn);
    main.appendChild(head);

    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'Firm Work only, and only what changed since you last clicked "Mark Reviewed" here — not a chat, not a notification stream, and not a record of when anyone was online. Client Work has its own status/deadline notifications; this page never duplicates them.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);
    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);

    var sinceIso = state.profile.since_last_seen_at
      || new Date(Date.now() - SINCE_LAST_SEEN_DEFAULT_DAYS * 86400000).toISOString();

    var firmItemsRes = await sb.from('work_items').select('id,title,status,assignee_id').eq('work_scope', 'firm');
    var firmItems = firmItemsRes.data || [];
    var itemById = {};
    firmItems.forEach(function (w) { itemById[w.id] = w; });
    var firmIds = firmItems.map(function (w) { return w.id; });

    var entries = [];
    if (firmIds.length) {
      var results = await Promise.all([
        sb.from('work_activity').select('*').in('work_item_id', firmIds).gt('created_at', sinceIso).neq('actor_id', state.user.id).order('created_at', { ascending: false }).limit(200),
        sb.from('work_comments').select('*').in('work_item_id', firmIds).gt('created_at', sinceIso).neq('author_id', state.user.id).order('created_at', { ascending: false }).limit(200),
      ]);
      (results[0].data || []).forEach(function (a) {
        entries.push({ type: 'activity', created_at: a.created_at, actor_id: a.actor_id, work_item_id: a.work_item_id, action: a.action, detail: a.detail });
      });
      (results[1].data || []).forEach(function (c) {
        entries.push({ type: 'comment', created_at: c.created_at, actor_id: c.author_id, work_item_id: c.work_item_id, body: c.body, update_type: c.update_type });
      });
      entries.sort(function (x, y) { return y.created_at.localeCompare(x.created_at); });
    }

    if (loading.parentNode) loading.parentNode.removeChild(loading);

    if (!entries.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('check'));
      empty.appendChild(document.createTextNode(state.profile.since_last_seen_at ? "You're all caught up." : 'Nothing on Firm Work in the last ' + SINCE_LAST_SEEN_DEFAULT_DAYS + ' days.'));
      resultsWrap.appendChild(empty);
    } else {
      var wrap = el('div', 'task-group');
      entries.forEach(function (entry) {
        var w = itemById[entry.work_item_id];
        var row = el('div', 'activity-row'); row.style.cssText = 'cursor:pointer;';
        row.addEventListener('click', function () { gotoFirmWork(entry.work_item_id); });
        var who = el('span', 'who'); who.textContent = profileName(entry.actor_id);
        var when = el('span', 'when'); when.textContent = fmtDateTime(entry.created_at);
        who.appendChild(when);
        row.appendChild(who);

        var summary = el('div');
        var titleText = w ? w.title : 'A Firm Work item';
        var line1 = el('div'); line1.style.fontWeight = '700'; line1.textContent = titleText;
        summary.appendChild(line1);
        var line2 = el('div'); line2.style.cssText = 'color:var(--ink-soft);font-size:.88rem;margin-top:2px;';
        if (entry.type === 'comment') {
          var typeLabel = entry.update_type ? (UPDATE_TYPE_LABELS[entry.update_type] || entry.update_type) + ' — ' : '';
          line2.textContent = typeLabel + truncateOneLine(entry.body, 90);
        } else {
          // "Completed" reads better than the generic "Status changed"
          // for the one status_changed case this task calls out by name.
          var label = (entry.action === 'status_changed' && /→ Completed$/.test(entry.detail || ''))
            ? 'Completed' : (ACTIVITY_ACTION_LABELS[entry.action] || entry.action);
          line2.textContent = label + (entry.detail ? ' — ' + truncateOneLine(entry.detail, 90) : '');
        }
        summary.appendChild(line2);
        row.appendChild(summary);
        wrap.appendChild(row);
      });
      resultsWrap.appendChild(wrap);
    }

    markBtn.addEventListener('click', async function () {
      markBtn.disabled = true;
      var res = await sb.rpc('mark_feed_seen');
      markBtn.disabled = false;
      if (res.error) { toast('Could not mark reviewed: ' + res.error.message, true); return; }
      state.profile.since_last_seen_at = new Date().toISOString();
      toast('Marked reviewed.');
      renderSinceLastSeenPage(main);
    });
  }

  // "Who has open work right now" — the one thing a flat list can't
  // answer at a glance. Counts open (non-completed) work per assignee,
  // with overdue count called out separately since that's the number
  // that actually matters day to day. Alphabetical by name, same as the
  // Manager Dashboard's Team Workload table -- no busiest-first ranking
  // (fixed 2026-08-13; this used to sort by open count, which is exactly
  // the kind of ranking that table was explicitly told not to do).
  function renderWorkloadSummary(main, items) {
    var open = items.filter(function (w) { return w.status !== 'completed'; });
    if (!open.length) return;
    var byAssignee = {};
    open.forEach(function (w) {
      var key = w.assignee_id || 'unassigned';
      if (!byAssignee[key]) byAssignee[key] = { open: 0, overdue: 0 };
      byAssignee[key].open++;
      if (isOverdue(w)) byAssignee[key].overdue++;
    });
    var rows = Object.keys(byAssignee).map(function (id) {
      return { id: id, name: id === 'unassigned' ? 'Unassigned' : profileName(id), open: byAssignee[id].open, overdue: byAssignee[id].overdue };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    var card = el('div', 'card');
    var h2 = el('h2'); h2.appendChild(icon('users')); h2.appendChild(document.createTextNode('Team Workload')); card.appendChild(h2);
    var wrap = el('div'); wrap.style.display = 'flex'; wrap.style.flexWrap = 'wrap'; wrap.style.gap = '10px'; wrap.style.marginTop = '12px';
    rows.forEach(function (r) {
      var chip = el('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:9px;background:var(--mist);border:1px solid var(--border);border-radius:10px;padding:9px 14px;';
      if (r.id !== 'unassigned') chip.appendChild(avatarFor(r.id, 'avatar-sm'));
      var text = el('div');
      var nameEl = el('div'); nameEl.style.cssText = 'font-size:.85rem;font-weight:700;color:var(--navy-950);'; nameEl.textContent = r.name;
      var countEl = el('div'); countEl.style.cssText = 'font-size:.78rem;color:var(--ink-soft);';
      countEl.textContent = r.open + ' open' + (r.overdue ? ' · ' + r.overdue + ' overdue' : '');
      if (r.overdue) countEl.style.color = 'var(--red)';
      text.appendChild(nameEl); text.appendChild(countEl);
      chip.appendChild(text);
      wrap.appendChild(chip);
    });
    card.appendChild(wrap);
    main.appendChild(card);
  }

  // enableBulkReassign is only ever true for mode==='all' + a reviewer/
  // admin viewer (see renderWorkListView) -- staff never see this, and a
  // plain reviewer only gets a checkbox on rows where they're ALREADY
  // the reviewer (matches guard_work_item_update()'s own bypass
  // condition exactly, so nothing selectable here could ever be
  // rejected by the DB). Admin gets a checkbox on every row.
  function renderFlatWorkList(main, items, enableBulkReassign) {
    if (!items.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No work here yet.'));
      main.appendChild(empty);
      return;
    }
    var selected = {};
    var reassignBtn, selectAllCb;
    if (enableBulkReassign) {
      var toolbar = el('div'); toolbar.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:10px;';
      var selectAllLabel = el('label'); selectAllLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--ink-soft);cursor:pointer;';
      selectAllCb = el('input'); selectAllCb.type = 'checkbox'; selectAllCb.style.width = 'auto';
      selectAllLabel.appendChild(selectAllCb); selectAllLabel.appendChild(document.createTextNode('Select all eligible'));
      reassignBtn = el('button', 'btn btn-sm'); reassignBtn.type = 'button'; reassignBtn.textContent = 'Reassign Selected'; reassignBtn.disabled = true;
      toolbar.appendChild(selectAllLabel); toolbar.appendChild(reassignBtn);
      main.appendChild(toolbar);
    }
    var wrap = el('div', 'task-group');
    items.forEach(function (w) {
      var eligible = enableBulkReassign && (isAdmin() || w.reviewer_id === state.user.id);
      if (!eligible) { wrap.appendChild(workRow(w)); return; }
      var rowWrap = el('div'); rowWrap.style.cssText = 'display:flex;align-items:center;gap:10px;';
      var cb = el('input'); cb.type = 'checkbox'; cb.style.cssText = 'width:auto;flex:0 0 auto;';
      cb.addEventListener('change', function () {
        if (cb.checked) selected[w.id] = w; else delete selected[w.id];
        reassignBtn.textContent = 'Reassign Selected' + (Object.keys(selected).length ? ' (' + Object.keys(selected).length + ')' : '');
        reassignBtn.disabled = !Object.keys(selected).length;
      });
      var rowInner = el('div'); rowInner.style.flex = '1'; rowInner.appendChild(workRow(w));
      rowWrap.appendChild(cb); rowWrap.appendChild(rowInner);
      wrap.appendChild(rowWrap);
    });
    main.appendChild(wrap);
    if (enableBulkReassign) {
      selectAllCb.addEventListener('change', function () {
        Array.from(wrap.querySelectorAll('input[type=checkbox]')).forEach(function (cb) {
          cb.checked = selectAllCb.checked;
          cb.dispatchEvent(new Event('change'));
        });
      });
      reassignBtn.addEventListener('click', function () {
        var list = Object.keys(selected).map(function (id) { return selected[id]; });
        if (!list.length) return;
        openBulkReassignModal(list, function () { render(); });
      });
    }
  }

  // Bulk reassignment: staff never reach this (no bulk-select UI is ever
  // shown to them); a reviewer could only have selected items where
  // they're already the reviewer (see renderFlatWorkList's eligibility
  // check above), so the loop below should never actually hit the DB's
  // own permission check -- but it's handled gracefully (partial
  // success reported) rather than assumed, since selection state is
  // just a client-side snapshot that could theoretically go stale
  // (e.g. someone else reassigns the reviewer mid-session). Reassignment
  // itself and its activity-log entry are both handled entirely by
  // guard_work_item_update() (see 20260811090400_work_items.sql) --
  // this is just a loop of ordinary work_items.update() calls, nothing
  // new to log or authorize here.
  function openBulkReassignModal(selectedItems, onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Reassign ' + selectedItems.length + ' Work Item' + (selectedItems.length === 1 ? '' : 's');
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var preview = el('p', 'desc');
    var names = selectedItems.slice(0, 5).map(function (w) { return w.title + (w.period ? ' (' + w.period + ')' : ''); });
    preview.textContent = names.join(', ') + (selectedItems.length > 5 ? ', +' + (selectedItems.length - 5) + ' more' : '');
    wrap.appendChild(preview);

    var assigneeSel = el('select');
    assigneeSel.appendChild(new Option('— Select new assignee —', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('New Assignee', assigneeSel));

    var reviewerSel = el('select');
    reviewerSel.appendChild(new Option('— Keep existing reviewer —', '__keep__'));
    reviewerSel.appendChild(new Option('— No reviewer —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
    reviewerSel.value = '__keep__';
    wrap.appendChild(field('New Reviewer (optional)', reviewerSel));

    var actions = el('div', 'modal-actions');
    var confirmBtn = el('button', 'btn'); confirmBtn.type = 'button'; confirmBtn.textContent = 'Confirm Reassignment';
    confirmBtn.addEventListener('click', async function () {
      if (!assigneeSel.value) { toast('Choose a new assignee.', true); return; }
      confirmBtn.disabled = true;
      var patch = { assignee_id: assigneeSel.value };
      if (reviewerSel.value !== '__keep__') patch.reviewer_id = reviewerSel.value || null;
      var okCount = 0, failCount = 0;
      for (var i = 0; i < selectedItems.length; i++) {
        var res = await sb.from('work_items').update(patch).eq('id', selectedItems[i].id);
        if (res.error) failCount++; else okCount++;
      }
      confirmBtn.disabled = false;
      closeModal();
      if (failCount) {
        toast(okCount + ' reassigned, ' + failCount + ' skipped (no longer permitted).', okCount === 0);
      } else {
        toast(okCount + ' work item' + (okCount === 1 ? '' : 's') + ' reassigned.');
      }
      onDone();
    });
    actions.appendChild(confirmBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // showScopeTag (Handbook Task 20): only the combined My Work view
  // passes this -- Review/All Work call workRow(w) with one argument and
  // are completely unaffected, since every row there is already known to
  // be Client Work (loadWork() is client-scope-only for those modes too).
  function workRow(w, showScopeTag) {
    var row = el('div', 'task-row');
    row.addEventListener('click', function () { gotoWork(w.id); });
    row.appendChild(avatarFor(w.assignee_id));
    var dot = el('span', 'priority-dot priority-dot-' + w.priority);
    dot.title = w.priority.charAt(0).toUpperCase() + w.priority.slice(1) + ' priority';
    row.appendChild(dot);
    var title = el('div', 'title');
    var tmpl = templateById(w.service_template_id);
    var strong = el('strong'); strong.textContent = w.title + (w.period ? ' · ' + w.period : '');
    var span = el('span');
    span.appendChild(icon('building'));
    span.appendChild(document.createTextNode(clientName(w.client_id) + (tmpl ? ' · ' + tmpl.title : '')));
    title.appendChild(strong); title.appendChild(span);
    row.appendChild(title);
    var due = el('span', 'due' + (isOverdue(w) ? ' overdue' : ''));
    due.appendChild(icon('calendar'));
    due.appendChild(document.createTextNode(dueDateText(w)));
    row.appendChild(due);
    var badge = el('span', 'badge badge-' + w.status);
    badge.textContent = STATUS_LABELS[w.status] || w.status;
    row.appendChild(badge);
    if (showScopeTag) {
      var scopeBadge = el('span', 'badge badge-scope-client'); scopeBadge.textContent = 'CLIENT';
      row.appendChild(scopeBadge);
    }
    // Task 24: an explicit "what do I do next" label on every row, not
    // just the ones Today already flags -- client/service/period/status/
    // both deadlines were already conveyed above; this is the missing
    // "and action" piece.
    var action = el('span', 'row-action'); action.textContent = nextActionLabel(w) + ' →';
    row.appendChild(action);
    return row;
  }

  // Task 28: how long a Firm Work item can sit untouched before it's
  // worth flagging as possibly needing a handoff -- about the WORK ITEM's
  // own updated_at, never about whether a person was online/active (see
  // firmWorkRow's own note on this below). Same 14-day order of
  // magnitude as the Catch-Up feed's own window, kept as a separate
  // constant since the two answer different questions.
  var FIRM_WORK_STALE_DAYS = 14;

  // Handbook Task 20: Firm Work's row in the combined My Work list.
  // Deliberately its OWN renderer, not a branch inside workRow() above --
  // Firm Work has no client/template/period/statutory-deadline concept,
  // and this task explicitly requires that a missed Firm target must
  // NOT be styled like a missed statutory filing (contrast: workRow's
  // `due.overdue` class, which this function never applies).
  // latestUpdateText (Handbook Task 21, optional): a fallback "what's the
  // next move" line when the item has no next_action set — the same
  // next_action-else-latest-update convention renderFirmWorkPage's own
  // list column already uses. My Work (Handbook Task 20) calls this with
  // one argument, so it only ever shows next_action there (unaffected).
  function firmWorkRow(w, latestUpdateText) {
    var row = el('div', 'task-row');
    row.addEventListener('click', function () { gotoFirmWork(w.id); });
    row.appendChild(avatarFor(w.assignee_id));
    var dot = el('span', 'priority-dot priority-dot-' + w.priority);
    dot.title = w.priority.charAt(0).toUpperCase() + w.priority.slice(1) + ' priority';
    row.appendChild(dot);
    var title = el('div', 'title');
    var project = w.project_id ? projectById(w.project_id) : null;
    var strong = el('strong'); strong.textContent = w.title;
    var catSpan = el('span');
    catSpan.appendChild(icon('folder'));
    catSpan.appendChild(document.createTextNode((w.firm_category || 'Uncategorized') + (project ? ' · ' + project.name : '')));
    title.appendChild(strong); title.appendChild(catSpan);
    // Task 24: the blocker reason itself, not just the "Blocked" status
    // badge -- a blocked row otherwise conveyed WHAT is stuck but not WHY,
    // which is the one piece of information someone actually needs before
    // they can help unblock it. Neutral styling (.blocker, amber -- the
    // same tone Today's own "Waiting" stat already uses), never the red
    // compliance-breach language reserved for Client Work.
    if (w.status === 'blocked' && w.blocker_reason) {
      var blockerSpan = el('span', 'blocker');
      blockerSpan.appendChild(icon('alert'));
      blockerSpan.appendChild(document.createTextNode(truncateOneLine(w.blocker_reason, 70)));
      title.appendChild(blockerSpan);
    }
    var nextText = w.next_action || latestUpdateText;
    if (nextText) {
      var naSpan = el('span');
      naSpan.appendChild(icon('flag'));
      naSpan.appendChild(document.createTextNode(truncateOneLine(nextText, 70)));
      title.appendChild(naSpan);
    }
    // Task 28: "what needs handoff" -- a plain, neutral note when nobody
    // has touched this item in a while. This reads updated_at on the WORK
    // ITEM only; it says nothing about whether the owner was online,
    // active, or working during that time (that kind of presence/activity
    // tracking is exactly what this task's own DO NOT rules out). A
    // blocked item already explains itself via the blocker reason above,
    // so this is skipped there to avoid stacking two separate "something's
    // wrong" notes on one row.
    if (w.status !== 'completed' && w.status !== 'blocked') {
      var daysSinceUpdate = Math.floor((Date.now() - new Date(w.updated_at).getTime()) / 86400000);
      if (daysSinceUpdate >= FIRM_WORK_STALE_DAYS) {
        var staleSpan = el('span', 'stale-note');
        staleSpan.appendChild(icon('clock'));
        staleSpan.appendChild(document.createTextNode('No update in ' + daysSinceUpdate + ' days — may need a handoff'));
        title.appendChild(staleSpan);
      }
    }
    row.appendChild(title);
    // Target date, plain -- never `.overdue`/red, per this task's own
    // "do not style a missed Firm target as if it were a statutory
    // filing breach" instruction.
    var due = el('span', 'due');
    due.appendChild(icon('calendar'));
    due.appendChild(document.createTextNode(w.internal_due_date ? fmtDate(w.internal_due_date) : 'No target date'));
    row.appendChild(due);
    var badge = el('span', 'badge badge-' + w.status);
    badge.textContent = STATUS_LABELS[w.status] || w.status;
    row.appendChild(badge);
    var scopeBadge = el('span', 'badge badge-scope-firm'); scopeBadge.textContent = 'FIRM';
    row.appendChild(scopeBadge);
    return row;
  }

  // ============================================================
  // Deadlines — a flat, date-grouped list (deliberately not a calendar
  // widget). Defaults to "My Deadlines"; reviewers/admins can switch to
  // "Team" and narrow by client or service.
  // ============================================================
  async function renderDeadlinesPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Deadlines'; head.appendChild(h1);
    main.appendChild(head);

    await renderClientWorkHubStrip(main);

    // Task 25: a "View Deadlines" link from the Clients page (or Client
    // Detail) arrives as #deadlines?client=<id> -- consumed once here,
    // then cleared immediately so a later plain #deadlines navigation is
    // never left stuck on someone else's filter (see routeFromHash).
    var prefillClient = state.deadlinesPrefillClient || null;
    state.deadlinesPrefillClient = null;

    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px;';
    var scopeSel = el('select'); scopeSel.style.width = 'auto';
    scopeSel.appendChild(new Option('My Deadlines', 'mine'));
    if (isReviewerOrAdmin()) scopeSel.appendChild(new Option('Team', 'all'));
    // A client-filtered link only makes sense against the full team's
    // work -- a reviewer/admin arriving from a client card almost never
    // means "just the pieces of this client that happen to be mine."
    if (prefillClient && isReviewerOrAdmin()) scopeSel.value = 'all';
    filterRow.appendChild(scopeSel);
    var clientSel = el('select'); clientSel.style.width = 'auto';
    clientSel.appendChild(new Option('All Clients', ''));
    state.clients.forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    if (prefillClient) clientSel.value = prefillClient;
    filterRow.appendChild(clientSel);
    var serviceSel = el('select'); serviceSel.style.width = 'auto';
    serviceSel.appendChild(new Option('All Services', ''));
    state.templates.forEach(function (t) { serviceSel.appendChild(new Option(t.title, t.id)); });
    filterRow.appendChild(serviceSel);
    // Task 25: "prioritize... upcoming external/statutory deadlines"
    // without ever confusing them with internal targets -- this filters
    // to only items with a real filing/external deadline set, and (when
    // checked) groups by THAT date specifically rather than the
    // internal-first effectiveDue() every other view uses, so an
    // internal-only target can never quietly stand in for a statutory one.
    var statutoryLabel = el('label'); statutoryLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--ink-soft);cursor:pointer;';
    var statutoryCb = el('input'); statutoryCb.type = 'checkbox'; statutoryCb.style.width = 'auto';
    statutoryLabel.appendChild(statutoryCb); statutoryLabel.appendChild(document.createTextNode('Statutory deadlines only'));
    filterRow.appendChild(statutoryLabel);
    main.appendChild(filterRow);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    async function refresh() {
      clear(resultsWrap);
      var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);
      var items = await loadWork(scopeSel.value === 'all' ? 'all' : 'mine');
      clear(resultsWrap);
      var statutoryOnly = statutoryCb.checked;
      var dateOf = statutoryOnly ? function (w) { return w.external_due_date; } : effectiveDue;
      items = items.filter(function (w) { return w.status !== 'completed' && (statutoryOnly ? w.external_due_date : effectiveDue(w)); });
      if (clientSel.value) items = items.filter(function (w) { return w.client_id === clientSel.value; });
      if (serviceSel.value) items = items.filter(function (w) { return w.service_template_id === serviceSel.value; });
      items.sort(function (a, b) { return (dateOf(a) || '').localeCompare(dateOf(b) || ''); });

      var todayStr = localDateStr();
      var weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
      var weekStr = localDateStr(weekOut);
      function isPastDate(w) {
        var d = dateOf(w);
        return !!d && new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
      }
      var groups = [
        { key: 'overdue', label: statutoryOnly ? 'Past Due (Statutory)' : 'Overdue', filter: function (w) { return isPastDate(w); } },
        { key: 'today', label: 'Today', filter: function (w) { return !isPastDate(w) && dateOf(w) === todayStr; } },
        { key: 'week', label: 'This Week', filter: function (w) { return !isPastDate(w) && dateOf(w) > todayStr && dateOf(w) <= weekStr; } },
        { key: 'later', label: 'Later', filter: function (w) { return !isPastDate(w) && dateOf(w) > weekStr; } },
      ];
      var shown = 0;
      groups.forEach(function (g) {
        var rows = items.filter(g.filter);
        if (!rows.length) return;
        shown += rows.length;
        var wrap = el('div', 'task-group');
        var h3 = el('h3');
        h3.appendChild(document.createTextNode(g.label + ' '));
        var count = el('span', 'count'); count.textContent = String(rows.length);
        h3.appendChild(count);
        wrap.appendChild(h3);
        rows.forEach(function (w) { wrap.appendChild(workRow(w)); });
        resultsWrap.appendChild(wrap);
      });
      if (!shown) {
        var empty = el('div', 'empty-note'); empty.appendChild(icon('calendar'));
        empty.appendChild(document.createTextNode(statutoryOnly ? 'No statutory deadlines set.' : 'Nothing due.'));
        resultsWrap.appendChild(empty);
      }
    }
    scopeSel.addEventListener('change', refresh);
    clientSel.addEventListener('change', refresh);
    serviceSel.addEventListener('change', refresh);
    statutoryCb.addEventListener('change', refresh);
    await refresh();
  }

  // ============================================================
  // Manager Dashboard — per-staff workload matrix plus a short list of
  // what needs a manager's attention. Deliberately no charts.
  // ============================================================
  async function renderManagerDashboard(main) {
    var head = el('div', 'page-head');
    // Task 33: heading brought in line with the sidebar/tab label
    // ("Operations Overview" since Task 22) -- was still "Manager
    // Dashboard" here, the same kind of nav-vs-heading mismatch Task 28
    // fixed for the Firm Work Catch-Up feed.
    var h1 = el('h1'); h1.textContent = 'Operations Overview'; head.appendChild(h1);
    main.appendChild(head);

    // Task 33: explicit scope statement -- Client Work only, real-time
    // exceptions/workload balancing, never a ranking. This was already
    // true (see Team Workload's own code comment below) but only stated
    // in a comment nobody using the page would ever read.
    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'Client Work only — real-time exceptions and team workload balancing for right now, not a staff performance ranking. Firm Work never appears here; for trends and completed-work analysis over a date range, see Reports instead.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var items = await loadWork('all');
    // Guarded rather than a bare removeChild: if a hash navigation lands
    // (e.g. a direct/shared link, or a notification click) before this
    // page's own initial fetch resolves, a newer render may have already
    // cleared #main out from under this one -- an unguarded removeChild
    // on a node that's no longer main's child throws "not a child of
    // this node" (found via Handbook Task 18's direct-link Playwright
    // test, a real race, not new since only that test happened to await
    // an immediate post-login hash change and check for console errors).
    if (loading.parentNode) loading.parentNode.removeChild(loading);

    var open = items.filter(function (w) { return w.status !== 'completed'; });
    var todayStr = localDateStr();
    var weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
    var weekStr = localDateStr(weekOut);
    var monthOut = new Date(); monthOut.setDate(monthOut.getDate() + 30);
    var monthStr = localDateStr(monthOut);

    // ---- Team Workload matrix — workload balancing, not a leaderboard:
    // staff stay in the order they were loaded (alphabetical by name, see
    // loadProfiles()), never sorted or re-ordered by how much work
    // someone has. Every number is a plain count of real work items —
    // no derived "productivity" or completion-rate metric of any kind.
    // 7 Days / 30 Days are cumulative (each includes Today's items, the
    // way "due within a week" naturally would), not separate buckets.
    var matrixCard = el('div', 'card');
    var mH2 = el('h2'); mH2.appendChild(icon('users')); mH2.appendChild(document.createTextNode('Team Workload')); matrixCard.appendChild(mH2);
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Staff', 'Overdue', 'Today', '7 Days', '30 Days', 'Review', 'Waiting'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');

    var resultsCard = el('div', 'card hidden');
    var resultsHead = el('div', 'page-head'); resultsHead.style.marginBottom = '10px';
    var resultsH2 = el('h2'); resultsHead.appendChild(resultsH2);
    var resultsCloseBtn = el('button', 'btn btn-outline btn-sm'); resultsCloseBtn.type = 'button'; resultsCloseBtn.textContent = 'Close';
    resultsCloseBtn.addEventListener('click', function () { resultsCard.classList.add('hidden'); });
    resultsHead.appendChild(resultsCloseBtn);
    resultsCard.appendChild(resultsHead);
    var resultsList = el('div');
    resultsCard.appendChild(resultsList);

    // Clicking a count shows the matching work items right on this page
    // instead of just linking to a generic list — a manager should see
    // exactly what's behind a number, not go hunting for it.
    function showFiltered(title, matchingItems) {
      resultsH2.textContent = title + ' (' + matchingItems.length + ')';
      clear(resultsList);
      matchingItems.slice().sort(compareByDue).forEach(function (w) { resultsList.appendChild(workRow(w)); });
      resultsCard.classList.remove('hidden');
      resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function countCell(n, matchingItems, title, isOverdueColumn) {
      var td = el('td'); td.textContent = String(n);
      if (isOverdueColumn && n) td.style.cssText = 'color:var(--red);font-weight:700;';
      if (n) {
        td.style.cursor = 'pointer';
        td.title = 'Show ' + title.toLowerCase();
        td.addEventListener('click', function () { showFiltered(title, matchingItems); });
      }
      return td;
    }

    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) {
      // Preparation/open workload (Overdue, Today, 7/30 Days, Waiting) is
      // the work this person is doing, so it's assignee-based. Review is
      // work waiting on THEM to check someone else's, so it has to be
      // counted against reviewer_id -- otherwise a reviewer's own
      // submissions (awaiting someone else's review) would inflate their
      // own Review column instead of showing up under whoever is
      // actually reviewing.
      var assigned = open.filter(function (w) { return w.assignee_id === p.id; });
      var reviewing = open.filter(function (w) { return w.reviewer_id === p.id && w.status === 'ready_for_review'; });
      var overdueItems = assigned.filter(isOverdue);
      var todayItems = assigned.filter(function (w) { return !isOverdue(w) && effectiveDue(w) === todayStr; });
      var days7Items = assigned.filter(function (w) { return !isOverdue(w) && effectiveDue(w) && effectiveDue(w) <= weekStr; });
      var days30Items = assigned.filter(function (w) { return !isOverdue(w) && effectiveDue(w) && effectiveDue(w) <= monthStr; });
      var waitingItems = assigned.filter(function (w) { return w.status === 'waiting_for_client'; });

      var tr = el('tr');
      var tdName = el('td'); tdName.textContent = p.full_name; tr.appendChild(tdName);
      tr.appendChild(countCell(overdueItems.length, overdueItems, p.full_name + ' — Overdue', true));
      tr.appendChild(countCell(todayItems.length, todayItems, p.full_name + ' — Due Today', false));
      tr.appendChild(countCell(days7Items.length, days7Items, p.full_name + ' — Due Within 7 Days', false));
      tr.appendChild(countCell(days30Items.length, days30Items, p.full_name + ' — Due Within 30 Days', false));
      tr.appendChild(countCell(reviewing.length, reviewing, p.full_name + ' — Review Queue', false));
      tr.appendChild(countCell(waitingItems.length, waitingItems, p.full_name + ' — Waiting for Client', false));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    matrixCard.appendChild(table);
    main.appendChild(matrixCard);
    main.appendChild(resultsCard);

    // ---- Needs Attention — real exceptions, not a dashboard. Every
    // category lists the actual clickable work items (workRow(), same
    // component every other list view already uses), capped at a
    // handful each, instead of a bare count linking to a generic page —
    // a manager should be able to click straight to the thing that needs
    // fixing. Computed entirely from `items`/`open`, already loaded
    // above — no extra queries, no charts. Categories with zero matches
    // are omitted so a healthy day shows almost nothing. "No assignee"
    // is deliberately not a category: assignee_id is NOT NULL at the
    // schema level, so it can never be true.
    // Both thresholds below come from Workflow Settings (V2 Task 18),
    // not a literal — an admin can tune them from the Settings page
    // without touching code, and this dashboard just re-reads
    // state.settings on every render, so a changed setting takes effect
    // on next load without rewriting any work_items row.
    var upcomingWarnDays = state.settings.upcoming_deadline_warning_days;
    var todayPlusWarn = new Date(); todayPlusWarn.setDate(todayPlusWarn.getDate() + upcomingWarnDays);
    var todayPlusWarnStr = localDateStr(todayPlusWarn);
    var EXCEPTION_CAP = 5;
    var exceptionCategories = [
      { label: 'Overdue', items: open.filter(isOverdue) },
      { label: 'Due Today', items: open.filter(function (w) { return !isOverdue(w) && effectiveDue(w) === todayStr; }) },
      { label: 'Due Within ' + upcomingWarnDays + ' Days', items: open.filter(function (w) { var due = effectiveDue(w); return !!due && due > todayStr && due <= todayPlusWarnStr; }) },
      {
        label: 'Review Pending Too Long', items: open.filter(function (w) {
          if (w.status !== 'ready_for_review' || !w.ready_for_review_at) return false;
          return (Date.now() - new Date(w.ready_for_review_at).getTime()) / 86400000 > state.settings.review_attention_days;
        }),
      },
      { label: 'Changes Required', items: open.filter(function (w) { return w.status === 'changes_required'; }) },
      {
        // Work-item-level (waiting_since), not per-requirement — a
        // single consolidated "this has been waiting too long" signal,
        // reusing the same waiting_stale_days threshold the per-item
        // "Follow-up overdue" flag on Work Details already uses.
        label: 'Waiting for Client Too Long', items: open.filter(function (w) {
          if (w.status !== 'waiting_for_client' || !w.waiting_since) return false;
          return (Date.now() - new Date(w.waiting_since + 'T00:00:00').getTime()) / 86400000 >= state.settings.waiting_stale_days;
        }),
      },
      { label: 'No Reviewer Assigned', items: open.filter(function (w) { return !w.reviewer_id; }) },
      { label: 'Missing Deadline', items: open.filter(function (w) { return !effectiveDue(w); }) },
      {
        label: 'Ready to Submit but Not Submitted', items: open.filter(function (w) {
          return w.submission_required && (w.status === 'ready_to_submit' || w.status === 'completed')
            && w.submission_status !== 'submitted' && w.submission_status !== 'acknowledged';
        }),
      },
    ];

    var attnCard = el('div', 'card');
    var aH2 = el('h2'); aH2.appendChild(icon('alert')); aH2.appendChild(document.createTextNode('Needs Attention')); attnCard.appendChild(aH2);
    if (!exceptionCategories.some(function (c) { return c.items.length; })) {
      var okLine = el('p', 'desc'); okLine.textContent = 'Nothing needs attention right now.'; attnCard.appendChild(okLine);
    } else {
      exceptionCategories.forEach(function (cat) {
        if (!cat.items.length) return;
        var catLabel = el('div', 'checklist-stage'); catLabel.textContent = cat.label + ' (' + cat.items.length + ')'; attnCard.appendChild(catLabel);
        cat.items.slice(0, EXCEPTION_CAP).forEach(function (w) { attnCard.appendChild(workRow(w)); });
        if (cat.items.length > EXCEPTION_CAP) {
          var moreLine = el('p', 'desc'); moreLine.style.margin = '4px 0 0'; moreLine.textContent = '+' + (cat.items.length - EXCEPTION_CAP) + ' more — see All Work.';
          attnCard.appendChild(moreLine);
        }
      });
    }
    main.appendChild(attnCard);

    // ---- Clients Needing Attention — a human-set flag (see
    // set_client_attention()), never algorithmically derived from
    // overdue counts or anything else. state.clients already carries
    // the attention_* columns (loaded once at login like every other
    // small lookup list in this app), so this needs no extra query.
    // High Attention sorts first — a severity order, not a staff ranking.
    var flaggedClients = state.clients.filter(function (c) { return c.is_active && c.attention_level && c.attention_level !== 'normal'; })
      .sort(function (a, b) {
        var order = { high_attention: 0, needs_attention: 1 };
        return order[a.attention_level] - order[b.attention_level];
      });
    var clientAttnCard = el('div', 'card');
    var caH2 = el('h2'); caH2.appendChild(icon('alert')); caH2.appendChild(document.createTextNode('Clients Needing Attention')); clientAttnCard.appendChild(caH2);
    if (!flaggedClients.length) {
      var caOk = el('p', 'desc'); caOk.textContent = 'No clients currently flagged.'; clientAttnCard.appendChild(caOk);
    } else {
      flaggedClients.forEach(function (c) {
        var row = el('div', 'attention-row' + (c.attention_level === 'needs_attention' ? ' reason-waiting' : ''));
        row.addEventListener('click', function () { gotoClient(c.id); });
        var body = el('div', 'body');
        var nameEl = el('div', 'client'); nameEl.textContent = c.name;
        var reasonEl = el('div', 'reason');
        reasonEl.textContent = (ATTENTION_LABELS[c.attention_level] || c.attention_level) + (c.attention_reason ? ' — ' + c.attention_reason : '');
        body.appendChild(nameEl); body.appendChild(reasonEl);
        row.appendChild(body);
        var action = el('div', 'action'); action.textContent = 'Open →';
        row.appendChild(action);
        clientAttnCard.appendChild(row);
      });
    }
    main.appendChild(clientAttnCard);
  }

  // ============================================================
  // Reports — admin/manager only. Firm operations and compliance
  // visibility, not staff surveillance: every report here breaks work
  // down by service/status/period/month, and NONE of them break it down
  // or rank by staff member — that's a deliberate, explicit omission
  // (same principle as Team Workload's "do not rank staff"), not an
  // oversight. No new SQL functions/views/paid BI tooling — every field
  // used below already exists on work_items; each report is a plain,
  // date-bounded Supabase query aggregated client-side, the same pattern
  // Period Summary/Operations Overview/Deadlines already use elsewhere in
  // this app. Three query shapes cover all 7 reports:
  //   - "active" (status <> completed): naturally small and always
  //     current regardless of the firm's total historical volume, used
  //     for the 3 reports that are inherently about right-now/right-
  //     ahead (Waiting for Client, Review Wait, Upcoming).
  //   - "created in range": everything opened within the selected
  //     window, used for Work by Service / Work by Status — "of what we
  //     opened in this window, how does it break down."
  //   - "completed in range": status = completed AND completed_at within
  //     the window, used for Work Completed by Month / Completed Work by
  //     Period. Depends on completed_at actually being set — see the fix
  //     alongside this task in the status-change handler above; historical
  //     items completed before that fix shipped won't have a completed_at
  //     and so won't appear here until backfilled (see the SQL note).
  //
  // Task 33: an "Overdue Work Items" report used to live here too — it
  // was removed as a genuine duplicate of Operations Overview's own
  // real-time overdue list (literally the same activeItems.filter(
  // isOverdue) computation, same row rendering), and it never actually
  // respected this page's own date-range picker in the first place
  // ("what's overdue right now" isn't a date-ranged question). The
  // remaining "active"-query reports (Waiting for Client, Review Wait,
  // Upcoming) are trend/aggregate views, not the same shape as Overview's
  // actionable exception lists, so they stay -- each says so in its own
  // description below rather than leaving the relationship unstated.
  // ============================================================
  var REPORT_RANGE_PRESETS = [
    ['this_month', 'This Month'],
    ['last_3', 'Last 3 Months'],
    ['last_12', 'Last 12 Months'],
    ['all_time', 'All Time'],
  ];
  function reportRangeFor(preset) {
    var now = new Date();
    var to = localDateStr(now);
    if (preset === 'all_time') return { from: null, to: null };
    var from;
    if (preset === 'this_month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (preset === 'last_3') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { from: localDateStr(from), to: to };
  }
  // A plain, dependency-free horizontal bar list — "using existing/free
  // code" per the task's own instruction, not a new charting library.
  // Deliberately just this one shape (no pie/line charts) everywhere a
  // report benefits from an at-a-glance comparison alongside its table.
  function simpleBarChart(rows) {
    var wrap = el('div');
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    rows.forEach(function (r) {
      var line = el('div'); line.style.marginBottom = '8px';
      var labelRow = el('div'); labelRow.style.cssText = 'display:flex;justify-content:space-between;gap:10px;font-size:.82rem;margin-bottom:3px;';
      var labelEl = el('span'); labelEl.textContent = r.label; labelEl.style.color = 'var(--ink-soft)';
      var valEl = el('span'); valEl.style.fontWeight = '700'; valEl.style.color = 'var(--navy-950)'; valEl.textContent = String(r.value);
      labelRow.appendChild(labelEl); labelRow.appendChild(valEl);
      var track = el('div'); track.style.cssText = 'background:var(--mist-dark);border-radius:6px;height:8px;overflow:hidden;';
      var bar = el('div'); bar.style.cssText = 'background:var(--gold-500);height:100%;width:' + Math.round(r.value / max * 100) + '%;';
      track.appendChild(bar);
      line.appendChild(labelRow); line.appendChild(track);
      wrap.appendChild(line);
    });
    return wrap;
  }
  function reportCard(iconName, titleText) {
    var card = el('div', 'card');
    var h2 = el('h2'); h2.appendChild(icon(iconName)); h2.appendChild(document.createTextNode(titleText));
    card.appendChild(h2);
    return card;
  }

  async function renderReportsPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Reports'; head.appendChild(h1);
    main.appendChild(head);

    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'Client Work only — trends and completed-work analysis across a date range, totals and breakdowns only, never a staff performance leaderboard. Firm Work never appears here. For real-time overdue/exception triage right now, see Operations Overview instead.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var filterCard = el('div', 'card');
    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    var currentPreset = 'last_12';
    var presetBtns = {};
    REPORT_RANGE_PRESETS.forEach(function (pair) {
      var btn = el('button', 'btn btn-outline btn-sm'); btn.type = 'button'; btn.textContent = pair[1];
      btn.addEventListener('click', function () { currentPreset = pair[0]; syncPresetButtons(); syncCustomInputs(); refresh(); });
      presetBtns[pair[0]] = btn;
      filterRow.appendChild(btn);
    });
    function syncPresetButtons() {
      // 'btn' is the base class every button needs regardless of state;
      // only 'btn-outline' toggles, to switch the active preset from
      // outlined to filled without losing its base padding/shape.
      Object.keys(presetBtns).forEach(function (k) { presetBtns[k].classList.toggle('btn-outline', k !== currentPreset); });
    }
    var fromInput = el('input'); fromInput.type = 'date'; fromInput.style.width = 'auto';
    var toInput = el('input'); toInput.type = 'date'; toInput.style.width = 'auto';
    var toLabel = el('span'); toLabel.textContent = 'to'; toLabel.style.cssText = 'font-size:.8rem;color:var(--ink-soft);';
    function syncCustomInputs() {
      var range = reportRangeFor(currentPreset);
      fromInput.value = range.from || ''; toInput.value = range.to || '';
    }
    fromInput.addEventListener('change', function () { currentPreset = null; syncPresetButtons(); refresh(); });
    toInput.addEventListener('change', function () { currentPreset = null; syncPresetButtons(); refresh(); });
    filterRow.appendChild(fromInput); filterRow.appendChild(toLabel); filterRow.appendChild(toInput);
    filterCard.appendChild(filterRow);
    var rangeNote = el('p', 'desc'); rangeNote.style.cssText = 'margin:8px 0 0;';
    filterCard.appendChild(rangeNote);
    main.appendChild(filterCard);
    syncPresetButtons(); syncCustomInputs();

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    async function refresh() {
      clear(resultsWrap);
      var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);

      var fromISO = fromInput.value || null;
      var toISO = toInput.value || null;
      rangeNote.textContent = fromISO || toISO
        ? 'Showing activity from ' + (fromISO ? fmtDate(fromISO) : 'the beginning') + ' to ' + (toISO ? fmtDate(toISO) : 'now') + '.'
        : 'Showing all-time activity.';

      // Firm Work (work_scope='firm') must never enter a compliance
      // report — explicit requirement from the Firm Work data-model task.
      var activeQ = sb.from('work_items').select('*').eq('work_scope', 'client').neq('status', 'completed');
      var createdQ = sb.from('work_items').select('*').eq('work_scope', 'client');
      if (fromISO) createdQ = createdQ.gte('created_at', fromISO);
      if (toISO) createdQ = createdQ.lte('created_at', toISO + 'T23:59:59');
      var completedQ = sb.from('work_items').select('*').eq('work_scope', 'client').eq('status', 'completed').not('completed_at', 'is', null);
      if (fromISO) completedQ = completedQ.gte('completed_at', fromISO);
      if (toISO) completedQ = completedQ.lte('completed_at', toISO + 'T23:59:59');

      var all = await Promise.all([activeQ, createdQ, completedQ]);
      clear(resultsWrap);
      if (all.some(function (r) { return r.error; })) {
        var errBox = el('div', 'empty-note'); errBox.textContent = 'Could not load reports.';
        resultsWrap.appendChild(errBox);
        return;
      }
      var activeItems = all[0].data || [];
      var createdItems = all[1].data || [];
      var completedItems = all[2].data || [];

      resultsWrap.appendChild(buildWaitingReport(activeItems));
      resultsWrap.appendChild(buildReviewWaitReport(activeItems));
      resultsWrap.appendChild(buildUpcomingReport(activeItems));
      resultsWrap.appendChild(buildCompletedByMonthReport(completedItems));
      resultsWrap.appendChild(buildCompletedByPeriodReport(completedItems));
      resultsWrap.appendChild(buildByServiceReport(createdItems));
      resultsWrap.appendChild(buildByStatusReport(createdItems));
    }

    // Task 33: buildOverdueReport() was removed from here -- see this
    // section's own header comment for why (a genuine duplicate of
    // Operations Overview's real-time overdue list).

    function buildWaitingReport(activeItems) {
      var waiting = activeItems.filter(function (w) { return w.status === 'waiting_for_client'; });
      var withAge = waiting.filter(function (w) { return !!w.waiting_since; })
        .map(function (w) { return (Date.now() - new Date(w.waiting_since + 'T00:00:00').getTime()) / 86400000; });
      var avgDays = withAge.length ? Math.round(withAge.reduce(function (a, b) { return a + b; }, 0) / withAge.length) : 0;
      var card = reportCard('clipboard', 'Waiting for Client');
      var strip = el('div', 'today-strip'); strip.style.marginBottom = '0';
      function tile(n, label) {
        var s = el('div', 'today-stat'); var num = el('div', 'n'); num.textContent = String(n); var l = el('div', 'l'); l.textContent = label;
        s.appendChild(num); s.appendChild(l); strip.appendChild(s);
      }
      tile(waiting.length, 'Currently Waiting');
      tile(avgDays, 'Avg. Days Waiting');
      card.appendChild(strip);
      // Task 33: distinguishes this aggregate trend metric from Operations
      // Overview's "Waiting for Client Too Long" exception list, which
      // this is NOT a duplicate of -- that one is a threshold-filtered,
      // actionable list; this is every currently-waiting item's average
      // age, an aggregate you can't get from a list of individual rows.
      var note = el('p', 'desc'); note.style.cssText = 'margin:8px 0 0;';
      note.textContent = 'An aggregate across every currently-waiting item, not the actionable list — see Operations Overview → Needs Attention → "Waiting for Client Too Long" for the specific items to follow up on.';
      card.appendChild(note);
      return card;
    }

    function buildReviewWaitReport(activeItems) {
      var pending = activeItems.filter(function (w) { return w.status === 'ready_for_review' && w.ready_for_review_at; });
      var days = pending.map(function (w) { return (Date.now() - new Date(w.ready_for_review_at).getTime()) / 86400000; });
      var avgDays = days.length ? (days.reduce(function (a, b) { return a + b; }, 0) / days.length) : 0;
      var card = reportCard('check', 'Average Review Waiting Time');
      var strip = el('div', 'today-strip'); strip.style.marginBottom = '0';
      function tile(text, label, colorCls) {
        var s = el('div', 'today-stat'); var num = el('div', 'n' + (colorCls ? ' ' + colorCls : '')); num.textContent = text; var l = el('div', 'l'); l.textContent = label;
        s.appendChild(num); s.appendChild(l); strip.appendChild(s);
      }
      tile(avgDays.toFixed(1) + 'd', 'Avg. Wait (Pending Reviews)');
      tile(String(pending.length), 'Currently In Review');
      card.appendChild(strip);
      var note = el('p', 'desc'); note.style.cssText = 'margin:8px 0 0;';
      note.textContent = 'Measures how long items currently sitting in review have been waiting so far — not a historical average across completed reviews. For the specific items, see Operations Overview → Needs Attention → "Review Pending Too Long".';
      card.appendChild(note);
      return card;
    }

    function buildUpcomingReport(activeItems) {
      var todayStr = localDateStr();
      var d7 = new Date(); d7.setDate(d7.getDate() + 7); var d7Str = localDateStr(d7);
      var d14 = new Date(); d14.setDate(d14.getDate() + 14); var d14Str = localDateStr(d14);
      var d30 = new Date(); d30.setDate(d30.getDate() + 30); var d30Str = localDateStr(d30);
      var open = activeItems.filter(function (w) { return effectiveDue(w) && effectiveDue(w) >= todayStr; });
      var buckets = [
        { label: 'This Week', items: open.filter(function (w) { return effectiveDue(w) <= d7Str; }) },
        { label: 'Next 2 Weeks', items: open.filter(function (w) { return effectiveDue(w) > d7Str && effectiveDue(w) <= d14Str; }) },
        { label: 'Rest of Month', items: open.filter(function (w) { return effectiveDue(w) > d14Str && effectiveDue(w) <= d30Str; }) },
      ];
      var card = reportCard('calendar', 'Upcoming Workload');
      // Task 33: firm-wide totals in fixed buckets -- a trend view, not a
      // substitute for Deadlines (the actual browsable, filterable list
      // of upcoming items) or Operations Overview's Team Workload (the
      // per-person breakdown of the same underlying dates).
      var desc = el('p', 'desc'); desc.textContent = 'Work not yet completed, due in the next 30 days, firm-wide. For a filterable, browsable list see Deadlines; for the per-person breakdown see Operations Overview → Team Workload.'; card.appendChild(desc);
      var strip = el('div', 'today-strip'); strip.style.marginBottom = '10px';
      var revealWrap = el('div');
      buckets.forEach(function (b) {
        var s = el('div', 'today-stat'); s.style.cursor = 'pointer';
        var num = el('div', 'n'); num.textContent = String(b.items.length); var l = el('div', 'l'); l.textContent = b.label;
        s.appendChild(num); s.appendChild(l);
        s.addEventListener('click', function () {
          clear(revealWrap);
          if (!b.items.length) return;
          b.items.slice().sort(compareByDue).forEach(function (w) { revealWrap.appendChild(workRow(w)); });
        });
        strip.appendChild(s);
      });
      card.appendChild(strip);
      card.appendChild(revealWrap);
      return card;
    }

    function buildCompletedByMonthReport(completedItems) {
      var byMonth = {};
      completedItems.forEach(function (w) {
        var d = new Date(w.completed_at);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        byMonth[key] = (byMonth[key] || 0) + 1;
      });
      var keys = Object.keys(byMonth).sort();
      var rows = keys.map(function (k) {
        var parts = k.split('-'); var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        return { label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), value: byMonth[k] };
      });
      var card = reportCard('chart', 'Work Completed by Month');
      if (!rows.length) { var empty = el('p', 'desc'); empty.style.margin = '0'; empty.textContent = 'No completed work with a completion date in this range.'; card.appendChild(empty); }
      else card.appendChild(simpleBarChart(rows));
      return card;
    }

    function buildCompletedByPeriodReport(completedItems) {
      var byPeriod = {};
      completedItems.forEach(function (w) {
        var key = w.period || 'No period set';
        byPeriod[key] = (byPeriod[key] || 0) + 1;
      });
      var keys = Object.keys(byPeriod).sort();
      var card = reportCard('flag', 'Completed Work by Period');
      if (!keys.length) { var empty = el('p', 'desc'); empty.style.margin = '0'; empty.textContent = 'No completed work with a completion date in this range.'; card.appendChild(empty); }
      else {
        var table = el('table');
        var thead = el('thead'); var trh = el('tr');
        ['Period', 'Completed'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
        thead.appendChild(trh); table.appendChild(thead);
        var tbody = el('tbody');
        keys.forEach(function (k) {
          var tr = el('tr'); tr.style.cursor = 'pointer';
          var tdP = el('td'); tdP.textContent = k; tr.appendChild(tdP);
          var tdC = el('td'); tdC.textContent = String(byPeriod[k]); tr.appendChild(tdC);
          tr.addEventListener('click', function () {
            if (k === 'No period set') return;
            location.hash = 'search?period=' + encodeURIComponent(k) + '&status=completed';
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        card.appendChild(table);
      }
      return card;
    }

    function buildByServiceReport(createdItems) {
      var byService = {};
      createdItems.forEach(function (w) {
        var key = w.service_template_id || '__adhoc__';
        byService[key] = (byService[key] || 0) + 1;
      });
      var rows = Object.keys(byService).map(function (key) {
        var tmpl = key === '__adhoc__' ? null : templateById(key);
        return { key: key, label: tmpl ? tmpl.title : 'Ad-hoc (no template)', value: byService[key] };
      }).sort(function (a, b) { return b.value - a.value; });
      var card = reportCard('idcard', 'Work by Service');
      var desc = el('p', 'desc'); desc.textContent = 'Of work opened in this range.'; card.appendChild(desc);
      if (!rows.length) { var empty = el('p', 'desc'); empty.style.margin = '0'; empty.textContent = 'No work opened in this range.'; card.appendChild(empty); }
      else {
        var chartRows = rows.map(function (r) { return { label: r.label, value: r.value }; });
        var chartEl = simpleBarChart(chartRows);
        Array.from(chartEl.children).forEach(function (line, i) {
          line.style.cursor = 'pointer';
          line.addEventListener('click', function () {
            var r = rows[i];
            location.hash = r.key === '__adhoc__' ? 'search' : 'search?service=' + encodeURIComponent(r.key);
          });
        });
        card.appendChild(chartEl);
      }
      return card;
    }

    function buildByStatusReport(createdItems) {
      var byStatus = {};
      createdItems.forEach(function (w) { byStatus[w.status] = (byStatus[w.status] || 0) + 1; });
      // Pipeline order (STATUS_LABELS' own key order), not sorted by
      // count — this is a workflow snapshot, not a ranking of any kind.
      var rows = Object.keys(STATUS_LABELS).filter(function (s) { return byStatus[s]; })
        .map(function (s) { return { key: s, label: STATUS_LABELS[s], value: byStatus[s] }; });
      var card = reportCard('list', 'Work by Status');
      // Task 33: firm-wide, of everything opened in this date range --
      // different scope from Period Summary's status cards, which are
      // scoped to whatever period/service/assignee/etc a person picked
      // (and to their own work only, for non-reviewer/admin staff).
      var desc = el('p', 'desc'); desc.textContent = 'Of work opened in this range, current status, firm-wide. For a filtered breakdown by period/service/staff, see Period Summary.'; card.appendChild(desc);
      if (!rows.length) { var empty = el('p', 'desc'); empty.style.margin = '0'; empty.textContent = 'No work opened in this range.'; card.appendChild(empty); }
      else {
        var chartEl = simpleBarChart(rows.map(function (r) { return { label: r.label, value: r.value }; }));
        Array.from(chartEl.children).forEach(function (line, i) {
          line.style.cursor = 'pointer';
          line.addEventListener('click', function () { location.hash = 'search?status=' + encodeURIComponent(rows[i].key); });
        });
        card.appendChild(chartEl);
      }
      return card;
    }

    await refresh();
  }

  // ============================================================
  // Period Summary — a filterable compliance snapshot: pick a period
  // (and optionally service/assignee/reviewer/status/client), see the
  // status breakdown, then the matching work items below. Managers/admin
  // see the whole team (mode 'all', same query All Work/Manager Dashboard
  // already use); normal staff only ever see their own work (mode
  // 'mine') — no new RLS needed, this reuses the same loadWork() scoping
  // every other list view already relies on. Cards are computed from
  // every filter EXCEPT status/overdue (a status breakdown of an
  // already-status-filtered set wouldn't mean anything); the list below
  // applies all of them, including status/overdue.
  // ============================================================
  async function renderPeriodSummaryPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Period Summary'; head.appendChild(h1);
    main.appendChild(head);

    // Task 33: this page had no scope statement at all before -- Client
    // Work only (Firm Work never appears here), and the audience differs
    // by role: everyone gets this page (not admin/reviewer-gated like
    // Operations Overview or Reports), but a plain employee only ever
    // sees their own work, never the whole team's.
    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = isReviewerOrAdmin()
      ? 'Client Work only. A filterable snapshot across the whole team, by period, service, staff or client.'
      : 'Client Work only. A filterable snapshot of your own work, by period, service or client.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var items = await loadWork(isReviewerOrAdmin() ? 'all' : 'mine');
    // Guarded rather than a bare removeChild: if a hash navigation lands
    // (e.g. a direct/shared link, or a notification click) before this
    // page's own initial fetch resolves, a newer render may have already
    // cleared #main out from under this one -- an unguarded removeChild
    // on a node that's no longer main's child throws "not a child of
    // this node" (found via Handbook Task 18's direct-link Playwright
    // test, a real race, not new since only that test happened to await
    // an immediate post-login hash change and check for console errors).
    if (loading.parentNode) loading.parentNode.removeChild(loading);

    var filters = { period: '', service: '', assignee: '', reviewer: '', status: '', client: '', overdueOnly: false };

    var filterCard = el('div', 'card');
    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

    var periodSel = el('select'); periodSel.style.width = 'auto';
    periodSel.appendChild(new Option('All Periods', ''));
    Array.from(new Set(items.map(function (w) { return w.period; }).filter(Boolean))).sort()
      .forEach(function (p) { periodSel.appendChild(new Option(p, p)); });

    var serviceSel = el('select'); serviceSel.style.width = 'auto';
    serviceSel.appendChild(new Option('All Services', ''));
    state.templates.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
      .forEach(function (t) { serviceSel.appendChild(new Option(t.title, t.id)); });

    var assigneeSel = el('select'); assigneeSel.style.width = 'auto';
    assigneeSel.appendChild(new Option('All Assignees', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });

    var reviewerSel = el('select'); reviewerSel.style.width = 'auto';
    reviewerSel.appendChild(new Option('All Reviewers', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });

    var statusSel = el('select'); statusSel.style.width = 'auto';
    statusSel.appendChild(new Option('All Statuses', ''));
    Object.keys(STATUS_LABELS).forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });

    var clientSel = el('select'); clientSel.style.width = 'auto';
    clientSel.appendChild(new Option('All Clients', ''));
    state.clients.filter(function (c) { return c.is_active; }).forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });

    [periodSel, serviceSel, assigneeSel, reviewerSel, statusSel, clientSel].forEach(function (sel) { filterRow.appendChild(sel); });
    filterCard.appendChild(filterRow);

    var statusLine = el('div'); statusLine.style.cssText = 'margin-top:10px;font-size:.85rem;color:var(--ink-soft);display:flex;align-items:center;gap:10px;';
    var statusText = el('span');
    var clearBtn = el('button', 'btn btn-outline btn-sm'); clearBtn.type = 'button'; clearBtn.textContent = 'Clear Filters';
    statusLine.appendChild(statusText); statusLine.appendChild(clearBtn);
    filterCard.appendChild(statusLine);
    main.appendChild(filterCard);

    var cardsWrap = el('div', 'today-strip');
    main.appendChild(cardsWrap);
    var listWrap = el('div');
    main.appendChild(listWrap);

    function matches(w, includeStatus) {
      if (filters.period && w.period !== filters.period) return false;
      if (filters.service && w.service_template_id !== filters.service) return false;
      if (filters.assignee && w.assignee_id !== filters.assignee) return false;
      if (filters.reviewer && w.reviewer_id !== filters.reviewer) return false;
      if (filters.client && w.client_id !== filters.client) return false;
      if (includeStatus && filters.status && w.status !== filters.status) return false;
      if (includeStatus && filters.overdueOnly && !isOverdue(w)) return false;
      return true;
    }

    function refresh() {
      var forCards = items.filter(function (w) { return matches(w, false); });
      var forList = items.filter(function (w) { return matches(w, true); });

      clear(cardsWrap);
      function statCard(n, label, color, onClick) {
        var s = el('div', 'today-stat'); s.style.cursor = 'pointer';
        var num = el('div', 'n'); if (color) num.style.color = color; num.textContent = String(n);
        var l = el('div', 'l'); l.textContent = label;
        s.appendChild(num); s.appendChild(l);
        s.addEventListener('click', onClick);
        cardsWrap.appendChild(s);
      }
      function setStatusFilter(status, overdue) {
        filters.status = status; filters.overdueOnly = !!overdue;
        statusSel.value = status;
        refresh();
      }
      statCard(forCards.length, 'Total Work', null, function () { setStatusFilter('', false); });
      statCard(forCards.filter(function (w) { return w.status === 'completed'; }).length, 'Completed', 'var(--green)', function () { setStatusFilter('completed'); });
      statCard(forCards.filter(function (w) { return w.status === 'in_progress'; }).length, 'In Progress', null, function () { setStatusFilter('in_progress'); });
      statCard(forCards.filter(function (w) { return w.status === 'waiting_for_client'; }).length, 'Waiting Client', 'var(--amber)', function () { setStatusFilter('waiting_for_client'); });
      statCard(forCards.filter(function (w) { return w.status === 'ready_for_review'; }).length, 'Review', '#6D28D9', function () { setStatusFilter('ready_for_review'); });
      statCard(forCards.filter(isOverdue).length, 'Overdue', 'var(--red)', function () { setStatusFilter('', true); });

      statusText.textContent = filters.overdueOnly ? 'Showing: Overdue only'
        : filters.status ? 'Showing: ' + STATUS_LABELS[filters.status]
        : 'Showing: all statuses';

      clear(listWrap);
      if (!forList.length) {
        var empty = el('div', 'empty-note'); empty.appendChild(icon('folder')); empty.appendChild(document.createTextNode('No work items match these filters.'));
        listWrap.appendChild(empty);
      } else {
        forList.slice().sort(compareByDue).forEach(function (w) { listWrap.appendChild(workRow(w)); });
      }
    }

    var fieldMap = [['period', periodSel], ['service', serviceSel], ['assignee', assigneeSel], ['reviewer', reviewerSel], ['client', clientSel]];
    fieldMap.forEach(function (pair) {
      pair[1].addEventListener('change', function () { filters[pair[0]] = pair[1].value; refresh(); });
    });
    statusSel.addEventListener('change', function () { filters.status = statusSel.value; filters.overdueOnly = false; refresh(); });
    clearBtn.addEventListener('click', function () {
      filters = { period: '', service: '', assignee: '', reviewer: '', status: '', client: '', overdueOnly: false };
      [periodSel, serviceSel, assigneeSel, reviewerSel, statusSel, clientSel].forEach(function (sel) { sel.value = ''; });
      refresh();
    });

    refresh();
  }

  // ============================================================
  // Search — a dedicated, server-filtered search across work items:
  // client/service/period/staff/status/submission reference in one free-
  // text box, plus structured filters (status/client/service/assignee/
  // reviewer/period/deadline range/Waiting for Client). Deliberately
  // queries Supabase directly here instead of reusing loadWork() (which
  // pulls every work item for a mode, unbounded, then filters in memory —
  // fine for the small per-view lists elsewhere in this app, but
  // work_items has no natural cap on how large it grows over years of
  // history, so a real search has to let Postgres do the filtering
  // instead of shipping the whole table to the browser first). Free-text
  // name matching (client/staff/service) still resolves against
  // state.clients/state.profiles/state.templates in memory — those stay
  // small forever (headcount/client/template count), so matching them
  // client-side to get an id list, then querying work_items with that
  // list, is the same "small lookup lists loaded once" pattern already
  // used everywhere else in this app, just applied to build a query
  // instead of a dropdown.
  // ============================================================
  // Strips PostgREST's or=(...) filter syntax characters ( , ( ) ) out of
  // free-text input before it's spliced into a raw filter string — not a
  // security boundary (RLS still applies regardless of what this query
  // returns), just avoids a stray character silently breaking the filter
  // into a malformed query that returns confusing/empty results.
  function stripOrSyntax(s) { return s.replace(/[,()]/g, ' ').trim(); }

  async function renderSearchPage(main, initialQuery) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Search'; head.appendChild(h1);
    main.appendChild(head);

    var initial = new URLSearchParams(initialQuery || '');
    var filters = {
      // Task 29: explicit All/Client/Firm scope, instead of Firm Work's
      // participation being an implicit side effect of "did you type a
      // search term" -- the actual old behavior, which meant the exact
      // same set of filters could silently include or exclude Firm Work
      // depending on whether the box was empty, with no visible control
      // for it anywhere on the page.
      scope: initial.get('scope') || 'all',
      q: initial.get('q') || '',
      status: initial.get('status') || '',
      client: initial.get('client') || '',
      service: initial.get('service') || '',
      assignee: initial.get('assignee') || '',
      reviewer: initial.get('reviewer') || '',
      period: initial.get('period') || '',
      dueFrom: initial.get('dueFrom') || '',
      dueTo: initial.get('dueTo') || '',
      waitingOnly: initial.get('waiting') === '1',
    };

    var card = el('div', 'card');
    var qInput = el('input'); qInput.type = 'text';
    qInput.placeholder = 'Search client, service, period, staff, status, reference number, or Firm Work…';
    qInput.value = filters.q;
    card.appendChild(field('Search', qInput));

    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;';

    // Task 29: explicit scope, first in the row since it governs how the
    // rest of the row behaves (see refreshScopeState below).
    var scopeSel = el('select'); scopeSel.style.width = 'auto';
    scopeSel.appendChild(new Option('All (Client + Firm)', 'all'));
    scopeSel.appendChild(new Option('Client Work only', 'client'));
    scopeSel.appendChild(new Option('Firm Work only', 'firm'));
    scopeSel.value = filters.scope;

    var statusSel = el('select'); statusSel.style.width = 'auto';
    statusSel.appendChild(new Option('All Statuses', ''));
    Object.keys(STATUS_LABELS).forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });
    statusSel.value = filters.status;

    var clientSel = el('select'); clientSel.style.width = 'auto';
    clientSel.appendChild(new Option('All Clients', ''));
    state.clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    clientSel.value = filters.client;

    var serviceSel = el('select'); serviceSel.style.width = 'auto';
    serviceSel.appendChild(new Option('All Services', ''));
    state.templates.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
      .forEach(function (t) { serviceSel.appendChild(new Option(t.title, t.id)); });
    serviceSel.value = filters.service;

    var assigneeSel = el('select'); assigneeSel.style.width = 'auto';
    assigneeSel.appendChild(new Option('All Assignees', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
    assigneeSel.value = filters.assignee;

    var reviewerSel = el('select'); reviewerSel.style.width = 'auto';
    reviewerSel.appendChild(new Option('All Reviewers', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
    reviewerSel.value = filters.reviewer;

    var periodInput = el('input'); periodInput.type = 'text'; periodInput.placeholder = 'Period, e.g. Shrawan 2083'; periodInput.style.cssText = 'width:170px;';
    periodInput.value = filters.period;

    var dueFromInput = el('input'); dueFromInput.type = 'date'; dueFromInput.style.width = 'auto'; dueFromInput.value = filters.dueFrom;
    var dueToInput = el('input'); dueToInput.type = 'date'; dueToInput.style.width = 'auto'; dueToInput.value = filters.dueTo;
    // Task 35: matches Firm Work's own due-date range wrap -- flex-wrap
    // lets the second date drop to its own line at narrow widths instead
    // of forcing the whole page wider.
    var dueWrap = el('div'); dueWrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;';
    var dueToLabel = el('span'); dueToLabel.textContent = 'to'; dueToLabel.style.cssText = 'font-size:.8rem;color:var(--ink-soft);';
    dueWrap.appendChild(dueFromInput); dueWrap.appendChild(dueToLabel); dueWrap.appendChild(dueToInput);

    var waitingLabel = el('label'); waitingLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--ink-soft);white-space:nowrap;';
    var waitingCb = el('input'); waitingCb.type = 'checkbox'; waitingCb.style.width = 'auto'; waitingCb.checked = filters.waitingOnly;
    waitingLabel.appendChild(waitingCb); waitingLabel.appendChild(document.createTextNode('Waiting for Client only'));

    filterRow.appendChild(scopeSel);
    [statusSel, clientSel, serviceSel, assigneeSel, reviewerSel, periodInput].forEach(function (elm) { filterRow.appendChild(elm); });
    filterRow.appendChild(dueWrap);
    filterRow.appendChild(waitingLabel);
    card.appendChild(filterRow);

    // Task 29: "if a filter only applies to Client Work, state that
    // rather than silently narrowing results." Status/Client/Service/
    // Reviewer/Period/"Waiting for Client" have no Firm Work equivalent
    // at all; Assignee and the due-date range are the two genuinely
    // shared concepts. Stated once here, and reinforced by actually
    // disabling the Client-only controls when Firm-only scope is picked
    // (see refreshScopeState) so it's never just a sentence someone has
    // to remember -- the form itself can't lie about what it's doing.
    var scopeNote = el('div'); scopeNote.style.cssText = 'font-size:.78rem;color:var(--ink-soft);margin-top:8px;';
    scopeNote.textContent = 'Status, Client, Service, Reviewer, Period, and "Waiting for Client" apply to Client Work only. Assignee and the due-date range apply to both Client and Firm Work.';
    card.appendChild(scopeNote);

    var clientOnlyControls = [statusSel, clientSel, serviceSel, reviewerSel, periodInput, waitingCb];
    function refreshScopeState() {
      var firmOnly = scopeSel.value === 'firm';
      clientOnlyControls.forEach(function (elm) { elm.disabled = firmOnly || (elm === statusSel && filters.waitingOnly); });
    }

    var statusLine = el('div'); statusLine.style.cssText = 'margin-top:12px;font-size:.85rem;color:var(--ink-soft);display:flex;align-items:center;gap:10px;';
    var statusText = el('span'); statusText.textContent = 'Searching…';
    var clearBtn = el('button', 'btn btn-outline btn-sm'); clearBtn.type = 'button'; clearBtn.textContent = 'Clear Filters';
    statusLine.appendChild(statusText); statusLine.appendChild(clearBtn);
    card.appendChild(statusLine);
    main.appendChild(card);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    var RESULT_CAP = 200;
    // Debounced free-text input can fire out of order (a fast typer's
    // earlier keystroke's query resolving after a later one's) — this
    // sequence guard drops the result of any search that isn't the most
    // recent one requested, so the list always reflects the latest input.
    var requestSeq = 0;

    function syncUrl() {
      var p = new URLSearchParams();
      if (filters.scope !== 'all') p.set('scope', filters.scope);
      if (filters.q) p.set('q', filters.q);
      if (filters.status) p.set('status', filters.status);
      if (filters.client) p.set('client', filters.client);
      if (filters.service) p.set('service', filters.service);
      if (filters.assignee) p.set('assignee', filters.assignee);
      if (filters.reviewer) p.set('reviewer', filters.reviewer);
      if (filters.period) p.set('period', filters.period);
      if (filters.dueFrom) p.set('dueFrom', filters.dueFrom);
      if (filters.dueTo) p.set('dueTo', filters.dueTo);
      if (filters.waitingOnly) p.set('waiting', '1');
      var str = p.toString();
      // history.replaceState, not location.hash= — setting location.hash
      // fires hashchange -> routeFromHash -> a full render() that would
      // rebuild this exact form (and drop input focus) on every keystroke.
      history.replaceState(null, '', '#search' + (str ? '?' + str : ''));
    }

    // Task 29: whether each side of the search is even eligible to run,
    // given the current scope and which filters are actually set. Client-
    // only filters never make the Firm side eligible (they can't --
    // they're disabled whenever scope is Firm-only, see refreshScopeState);
    // Assignee and the due-date range are shared, so either one alone is
    // enough to make Firm eligible too, closing the old gap where e.g.
    // filtering by Assignee with no search text silently returned zero
    // Firm Work results despite Assignee being a genuinely shared filter.
    function clientEligible() {
      return filters.scope !== 'firm' && !!(filters.q || filters.status || filters.client || filters.service || filters.assignee || filters.reviewer || filters.period || filters.dueFrom || filters.dueTo || filters.waitingOnly);
    }
    function firmEligible() {
      return filters.scope !== 'client' && !!(filters.q || filters.assignee || filters.dueFrom || filters.dueTo);
    }

    async function runSearch() {
      var seq = ++requestSeq;
      clear(resultsWrap);
      var wantClient = clientEligible();
      var wantFirm = firmEligible();
      // No query at all until there's something to filter by — an unbounded
      // select() the moment the page loads would be exactly the "download
      // the whole table just to search" this feature is meant to avoid.
      if (!wantClient && !wantFirm) {
        statusText.textContent = '';
        var prompt = el('div', 'empty-note'); prompt.appendChild(icon('search'));
        prompt.appendChild(document.createTextNode('Type a search term or choose a filter above.'));
        resultsWrap.appendChild(prompt);
        return;
      }
      var loading = el('div', 'empty-note'); loading.textContent = 'Searching…'; resultsWrap.appendChild(loading);

      var term = stripOrSyntax(filters.q);

      // The filter row (client/service/period/staff/status/submission
      // reference) is a Client Work vocabulary — none of it maps onto
      // Firm Work, so it only ever narrows this query. This does NOT
      // contaminate client compliance reporting: Today/Deadlines/Manager
      // Dashboard/Period Summary/Reports all route through loadWork() or
      // their own explicit work_scope='client' filter, none of which
      // this page touches.
      var queryPromise = Promise.resolve({ data: [] });
      if (wantClient) {
        var query = sb.from('work_items').select('*').eq('work_scope', 'client').order('internal_due_date', { ascending: true, nullsFirst: false }).limit(RESULT_CAP);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.client) query = query.eq('client_id', filters.client);
        if (filters.service) query = query.eq('service_template_id', filters.service);
        if (filters.assignee) query = query.eq('assignee_id', filters.assignee);
        if (filters.reviewer) query = query.eq('reviewer_id', filters.reviewer);
        if (filters.period) query = query.ilike('period', '%' + stripOrSyntax(filters.period) + '%');
        if (filters.waitingOnly) query = query.eq('status', 'waiting_for_client');
        // Filtered against internal_due_date only (the primary due date
        // used everywhere else in this app) — a work item with only an
        // external_due_date set won't match a deadline range here. That's
        // a deliberate simplification: a true either-column range needs a
        // nested and/or PostgREST expression, which isn't worth the
        // complexity for a range filter most templates won't even need
        // (see 20260811090300_service_templates.sql's own filing_deadline_
        // day comment on why external is the exception, not the rule).
        if (filters.dueFrom) query = query.gte('internal_due_date', filters.dueFrom);
        if (filters.dueTo) query = query.lte('internal_due_date', filters.dueTo);

        if (term) {
          var lowerTerm = term.toLowerCase();
          var matchingClientIds = state.clients.filter(function (c) { return c.name.toLowerCase().indexOf(lowerTerm) !== -1; }).map(function (c) { return c.id; });
          var matchingStaffIds = state.profiles.filter(function (p) { return (p.full_name || '').toLowerCase().indexOf(lowerTerm) !== -1; }).map(function (p) { return p.id; });
          var matchingStatuses = Object.keys(STATUS_LABELS).filter(function (s) { return STATUS_LABELS[s].toLowerCase().indexOf(lowerTerm) !== -1; });
          var matchingTemplateIds = state.templates.filter(function (t) { return t.title.toLowerCase().indexOf(lowerTerm) !== -1; }).map(function (t) { return t.id; });

          var orParts = ['title.ilike.%' + term + '%', 'period.ilike.%' + term + '%', 'submission_reference.ilike.%' + term + '%'];
          if (matchingClientIds.length) orParts.push('client_id.in.(' + matchingClientIds.join(',') + ')');
          if (matchingStaffIds.length) {
            orParts.push('assignee_id.in.(' + matchingStaffIds.join(',') + ')');
            orParts.push('reviewer_id.in.(' + matchingStaffIds.join(',') + ')');
          }
          if (matchingStatuses.length) orParts.push('status.in.(' + matchingStatuses.join(',') + ')');
          if (matchingTemplateIds.length) orParts.push('service_template_id.in.(' + matchingTemplateIds.join(',') + ')');
          query = query.or(orParts.join(','));
        }
        queryPromise = query;
      }

      // Handbook Task 23 / Task 29: Firm Work's own eligible fields —
      // title/description/next_action/project name for free text, plus
      // the two genuinely shared filters (assignee, due-date range).
      // Client/service/period/reviewer/submission/waiting have no Firm
      // Work meaning and are correctly never applied here.
      var firmQueryPromise = Promise.resolve({ data: [] });
      if (wantFirm) {
        var firmQuery = sb.from('work_items').select('*').eq('work_scope', 'firm')
          .order('internal_due_date', { ascending: true, nullsFirst: false }).limit(RESULT_CAP);
        if (term) {
          var firmLowerTerm = term.toLowerCase();
          var matchingProjectIds = state.projects.filter(function (p) { return p.name.toLowerCase().indexOf(firmLowerTerm) !== -1; }).map(function (p) { return p.id; });
          var firmOrParts = ['title.ilike.%' + term + '%', 'description.ilike.%' + term + '%', 'next_action.ilike.%' + term + '%'];
          if (matchingProjectIds.length) firmOrParts.push('project_id.in.(' + matchingProjectIds.join(',') + ')');
          firmQuery = firmQuery.or(firmOrParts.join(','));
        }
        if (filters.assignee) firmQuery = firmQuery.eq('assignee_id', filters.assignee);
        if (filters.dueFrom) firmQuery = firmQuery.gte('internal_due_date', filters.dueFrom);
        if (filters.dueTo) firmQuery = firmQuery.lte('internal_due_date', filters.dueTo);
        firmQueryPromise = firmQuery;
      }

      var results = await Promise.all([queryPromise, firmQueryPromise]);
      var res = results[0];
      var firmRes = results[1];
      if (seq !== requestSeq) return; // superseded by a newer search
      clear(resultsWrap);
      if (res.error) {
        var errBox = el('div', 'empty-note'); errBox.textContent = 'Search failed: ' + res.error.message;
        resultsWrap.appendChild(errBox);
        statusText.textContent = '';
        return;
      }
      var items = (res.data || []).slice().sort(compareByDue);
      var firmItems = (firmRes && firmRes.data ? firmRes.data : []).slice().sort(compareByDue);
      var totalCount = items.length + firmItems.length;
      var cappedNote = (items.length >= RESULT_CAP || firmItems.length >= RESULT_CAP)
        ? 'Showing the first matches — narrow your search to see more precisely.'
        : totalCount + ' match' + (totalCount === 1 ? '' : 'es') + (wantClient && wantFirm ? ' (' + items.length + ' Client, ' + firmItems.length + ' Firm)' : '') + '.';
      statusText.textContent = cappedNote;
      if (!totalCount) {
        var empty = el('div', 'empty-note'); empty.appendChild(icon('folder'));
        empty.appendChild(document.createTextNode('No work items match your search.'));
        resultsWrap.appendChild(empty);
        return;
      }
      // Client results first, unmistakably labeled CLIENT under their own
      // "Client Work" heading — Firm Work in its own separately-labeled
      // "Firm Work" section below, never interleaved into the same list
      // (Handbook Task 23's "clear FIRM label" requirement, Task 29's
      // symmetric heading so Client isn't the unlabeled implicit default
      // once both sections can appear together).
      if (items.length) {
        var clientHead = el('h2'); clientHead.style.cssText = 'font-size:1rem;margin:0 0 8px;';
        clientHead.appendChild(icon('building'));
        clientHead.appendChild(document.createTextNode('Client Work'));
        resultsWrap.appendChild(clientHead);
        items.forEach(function (w) { resultsWrap.appendChild(workRow(w, true)); });
      }
      if (firmItems.length) {
        var firmHead = el('h2'); firmHead.style.cssText = 'font-size:1rem;margin:' + (items.length ? '18px' : '0') + ' 0 8px;';
        firmHead.appendChild(icon('briefcase'));
        firmHead.appendChild(document.createTextNode('Firm Work'));
        resultsWrap.appendChild(firmHead);
        firmItems.forEach(function (w) { resultsWrap.appendChild(firmWorkRow(w)); });
      }
    }

    var debounceTimer = null;
    function onFilterChange(immediate) {
      syncUrl();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (immediate) { runSearch(); return; }
      debounceTimer = setTimeout(runSearch, 300);
    }

    scopeSel.addEventListener('change', function () {
      filters.scope = scopeSel.value;
      refreshScopeState();
      onFilterChange(true);
    });
    qInput.addEventListener('input', function () { filters.q = qInput.value; onFilterChange(false); });
    periodInput.addEventListener('input', function () { filters.period = periodInput.value; onFilterChange(false); });
    statusSel.addEventListener('change', function () { filters.status = statusSel.value; onFilterChange(true); });
    clientSel.addEventListener('change', function () { filters.client = clientSel.value; onFilterChange(true); });
    serviceSel.addEventListener('change', function () { filters.service = serviceSel.value; onFilterChange(true); });
    assigneeSel.addEventListener('change', function () { filters.assignee = assigneeSel.value; onFilterChange(true); });
    reviewerSel.addEventListener('change', function () { filters.reviewer = reviewerSel.value; onFilterChange(true); });
    dueFromInput.addEventListener('change', function () { filters.dueFrom = dueFromInput.value; onFilterChange(true); });
    dueToInput.addEventListener('change', function () { filters.dueTo = dueToInput.value; onFilterChange(true); });
    waitingCb.addEventListener('change', function () {
      filters.waitingOnly = waitingCb.checked;
      // "Waiting for Client only" is a shortcut for Status = Waiting for
      // Client, not an independent second status filter — kept mutually
      // exclusive with the Status dropdown so the two can't silently
      // contradict each other (e.g. Status=Completed + Waiting checked).
      if (waitingCb.checked) { filters.status = ''; statusSel.value = ''; }
      refreshScopeState();
      onFilterChange(true);
    });
    clearBtn.addEventListener('click', function () {
      // Scope is deliberately preserved through Clear Filters -- it's the
      // page's mode (which vocabulary of filters even applies), not one
      // of the filters themselves; someone who picked "Firm Work only"
      // almost certainly wants to stay there while clearing everything
      // else, not get silently switched back to "All."
      filters = { scope: filters.scope, q: '', status: '', client: '', service: '', assignee: '', reviewer: '', period: '', dueFrom: '', dueTo: '', waitingOnly: false };
      qInput.value = ''; periodInput.value = ''; dueFromInput.value = ''; dueToInput.value = '';
      statusSel.value = ''; clientSel.value = ''; serviceSel.value = ''; assigneeSel.value = ''; reviewerSel.value = '';
      waitingCb.checked = false;
      refreshScopeState();
      onFilterChange(true);
    });

    refreshScopeState();
    syncUrl();
    await runSearch();
  }

  // ============================================================
  // New Work modal
  // ============================================================
  // prefill (optional): { templateId, clientId, assigneeId, reviewerId } —
  // used by "Use This Template" (Templates page) and "Create This Period's
  // Work" (a client's Active Services) so recurring compliance work (VAT,
  // TDS, monthly close) doesn't have to be retyped by hand every time.
  function openNewWorkModal(prefill) {
    prefill = prefill || {};
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Work';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var clientSel = el('select');
    clientSel.appendChild(new Option('— Select client —', ''));
    state.clients.filter(function (c) { return c.is_active; }).forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    if (prefill.clientId) clientSel.value = prefill.clientId;
    wrap.appendChild(field('Client', clientSel));

    var templateSel = el('select');
    templateSel.appendChild(new Option('— No template (ad-hoc) —', ''));
    // Inactive templates are excluded here (they're retired for anything
    // NEW) but templateById() itself stays unfiltered — a prefill that
    // names an already-inactive template (e.g. re-running a client
    // service whose template was later retired) still needs to resolve.
    state.templates.filter(function (t) { return t.is_active; }).slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
      .forEach(function (t) { templateSel.appendChild(new Option(t.title + ' (' + t.category + ')', t.id)); });
    if (prefill.templateId && templateById(prefill.templateId) && !templateById(prefill.templateId).is_active) {
      var retired = templateById(prefill.templateId);
      templateSel.appendChild(new Option(retired.title + ' (' + retired.category + ') — Inactive', retired.id));
    }
    wrap.appendChild(field('Service Template', templateSel));

    var titleInput = el('input'); titleInput.type = 'text';
    wrap.appendChild(field('Title', titleInput));

    var periodInput = el('input'); periodInput.type = 'text'; periodInput.placeholder = 'e.g. Shrawan 2083';
    wrap.appendChild(field('Period (optional)', periodInput));

    var assigneeSel = el('select');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
    var assigneeField = field('Assignee', assigneeSel);
    if (!isReviewerOrAdmin()) {
      // Employees can create work for themselves, not hand it to
      // colleagues — that stays a reviewer/admin action.
      assigneeSel.value = state.user.id;
      assigneeSel.disabled = true;
      var lockedHint = el('span', 'f-hint'); lockedHint.textContent = 'Work you create is assigned to you.';
      assigneeField.appendChild(lockedHint);
    }
    wrap.appendChild(assigneeField);

    var reviewerSel = el('select');
    reviewerSel.appendChild(new Option('— No reviewer —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); })
      .forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('Reviewer', reviewerSel));

    var internalDueInput = el('input'); internalDueInput.type = 'date';
    wrap.appendChild(field('Internal Target', internalDueInput));
    var externalDueInput = el('input'); externalDueInput.type = 'date';
    wrap.appendChild(field('External / Filing Deadline (optional)', externalDueInput));

    var prioritySel = el('select');
    ['low', 'normal', 'high'].forEach(function (p) { prioritySel.appendChild(new Option(p.charAt(0).toUpperCase() + p.slice(1), p)); });
    prioritySel.value = 'normal';
    wrap.appendChild(field('Priority', prioritySel));

    var descInput = el('textarea'); descInput.rows = 3;
    wrap.appendChild(field('Description / Instructions', descInput));

    // Handbook Task 12: prefills from the template's ACTIVE, governed
    // deadline_rules row (state.deadlineRules), never from a raw
    // filing_deadline_day integer — a template with no active rule
    // simply doesn't prefill an external date, same "leave it unset
    // rather than guess" principle used at bulk-generation time. Still
    // uses this month as the basis (unlike bulk generation, which takes
    // an explicit requested period) because this modal creates a work
    // item for right now, not a backfilled past/future period. Clamps to
    // the month's real last day, then derives internal FROM external
    // (not independently). Only fills a date the user hasn't already
    // typed something into, and stays fully editable/overridable
    // afterward like any default — internal_due_date and external_due_
    // date remain two separate fields either can be changed without
    // touching the other.
    function computeFilingDate(dayOfMonth) {
      var now = new Date();
      var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var d = new Date(now.getFullYear(), now.getMonth(), Math.min(dayOfMonth, lastDay));
      return localDateStr(d);
    }
    function subtractDays(dateStr, n) {
      var d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() - n);
      return localDateStr(d);
    }
    function applyTemplate(id) {
      var t = templateById(id);
      if (!t) return;
      if (!titleInput.value.trim() || titleInput.dataset.auto === '1') { titleInput.value = t.title; titleInput.dataset.auto = '1'; }
      if (t.default_assignee_id && isReviewerOrAdmin()) assigneeSel.value = t.default_assignee_id;
      if (t.default_reviewer_id) reviewerSel.value = t.default_reviewer_id;
      var rule = activeDeadlineRuleFor(t.id);
      if (rule) {
        if (!externalDueInput.value) externalDueInput.value = computeFilingDate(rule.filing_deadline_day);
        if (t.internal_offset_days != null && !internalDueInput.value) internalDueInput.value = subtractDays(externalDueInput.value, t.internal_offset_days);
      } else if (t.requires_external_deadline) {
        toast('No verified deadline rule exists yet for ' + t.title + ' — enter the External / Filing Deadline manually, or set one up on the Templates page first.');
      }
    }
    titleInput.addEventListener('input', function () { titleInput.dataset.auto = '0'; });
    templateSel.addEventListener('change', function () { applyTemplate(templateSel.value); });
    if (prefill.templateId) { templateSel.value = prefill.templateId; applyTemplate(prefill.templateId); }
    // An explicit assignee/reviewer (e.g. from a client's Active Services
    // row) wins over whatever the template's own defaults set above.
    if (prefill.assigneeId && isReviewerOrAdmin()) assigneeSel.value = prefill.assigneeId;
    if (prefill.reviewerId) reviewerSel.value = prefill.reviewerId;

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Work';
    createBtn.addEventListener('click', async function () {
      if (!clientSel.value) { toast('Choose a client.', true); return; }
      if (!titleInput.value.trim()) { toast('Give the work a title.', true); return; }
      if (!assigneeSel.value) { toast('No active staff available to assign — activate someone under Staff first.', true); return; }
      // Fast, friendly check for the common case — the real guarantee is
      // the work_items_client_service_period_unique DB constraint (same
      // one the recurring-generation sweep relies on for idempotency), so
      // this can't actually be bypassed even if this check were removed;
      // it just avoids a raw constraint-violation error reaching the user.
      if (templateSel.value && periodInput.value.trim()) {
        var dupRes = await sb.from('work_items').select('id')
          .eq('client_id', clientSel.value).eq('service_template_id', templateSel.value).eq('period', periodInput.value.trim()).limit(1);
        if (dupRes.data && dupRes.data.length) {
          var dupTmpl = templateById(templateSel.value);
          toast('This client already has ' + (dupTmpl ? dupTmpl.title : 'this service') + ' for "' + periodInput.value.trim() + '".', true);
          return;
        }
      }
      createBtn.disabled = true;
      var chosenTmpl = templateSel.value ? templateById(templateSel.value) : null;
      var res = await sb.from('work_items').insert({
        client_id: clientSel.value,
        service_template_id: templateSel.value || null,
        title: titleInput.value.trim(),
        period: periodInput.value.trim() || null,
        assignee_id: assigneeSel.value,
        reviewer_id: reviewerSel.value || null,
        internal_due_date: internalDueInput.value || null,
        external_due_date: externalDueInput.value || null,
        priority: prioritySel.value,
        description: descInput.value.trim() || null,
        // Inherits the template's default; ad-hoc work (no template)
        // starts false and can still be flipped on later via Edit Work
        // if a specific engagement turns out to need filing after all.
        submission_required: chosenTmpl ? chosenTmpl.requires_submission : false,
        review_required: chosenTmpl ? chosenTmpl.requires_review !== false : true,
        created_by: state.user.id,
      }).select().single();
      if (res.error) { createBtn.disabled = false; toast('Could not create work: ' + res.error.message, true); return; }

      if (templateSel.value) {
        var itemsRes = await sb.from('service_template_items').select('*').eq('template_id', templateSel.value);
        var items = (itemsRes.data || []);
        if (items.length) {
          var rows = items.map(function (it) { return { work_item_id: res.data.id, stage: it.stage, title: it.title, sort_order: it.sort_order, is_required: it.is_required }; });
          var clRes = await sb.from('work_checklist_items').insert(rows);
          if (clRes.error) toast('Work created, but checklist items failed: ' + clRes.error.message, true);
        }
      }
      createBtn.disabled = false;
      closeModal();
      toast('Work created.');
      gotoWork(res.data.id);
    });
    actions.appendChild(createBtn);
    wrap.appendChild(actions);

    openModal(wrap);
  }

  // ============================================================
  // Work Details — Overview + Checklist tabs
  // ============================================================
  async function renderWorkDetail(id) {
    var main = qs('#main');
    clear(main);
    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var workRes = await sb.from('work_items').select('*').eq('id', id).single();
    var checklistRes = await sb.from('work_checklist_items').select('*').eq('work_item_id', id).order('sort_order');
    var commentsRes = await sb.from('work_comments').select('*').eq('work_item_id', id).order('created_at');
    var waitingItemsRes = await sb.from('work_waiting_items').select('*').eq('work_item_id', id).order('sort_order');
    var activityRes = await sb.from('work_activity').select('*').eq('work_item_id', id).order('created_at', { ascending: false });
    clear(main);

    if (workRes.error || !workRes.data) {
      var empty = el('div', 'empty-note'); empty.textContent = "That work item doesn't exist, or you don't have access to it.";
      main.appendChild(empty);
      var back = el('button', 'btn btn-outline btn-sm'); back.type = 'button'; back.textContent = '← Back to Today';
      back.addEventListener('click', function () { goto('today'); });
      main.appendChild(back);
      return;
    }
    var work = workRes.data;
    var checklist = checklistRes.data || [];
    var comments = commentsRes.data || [];
    var waitingItems = waitingItemsRes.data || [];
    var activity = activityRes.data || [];
    var isMine = work.assignee_id === state.user.id;
    // A reviewer's elevated rights apply only to work items they're
    // actually the assigned reviewer for -- "review work assigned to
    // them," not every work item company-wide. Matches the same scoping
    // enforced server-side in guard_work_item_update() (see
    // supabase/migrations/20260811090400_work_items.sql) so this can't
    // drift from what the DB will actually allow.
    var canEditFull = isAdmin() || (state.profile.role === 'reviewer' && work.reviewer_id === state.user.id);
    var canToggleChildren = isMine || canEditFull;
    var template = templateById(work.service_template_id);

    var card = el('div', 'card');
    var head = el('div', 'detail-head');
    var titleWrap = el('div');
    var h1 = el('h1'); h1.style.fontSize = '1.25rem'; h1.textContent = work.title;
    var sub = el('div'); sub.style.cssText = 'color:var(--ink-soft);font-size:.88rem;margin-top:2px;';
    sub.textContent = clientName(work.client_id) + (work.period ? ' · ' + work.period : '');
    titleWrap.appendChild(h1); titleWrap.appendChild(sub);
    var badge = el('span', 'badge badge-' + work.status); badge.textContent = STATUS_LABELS[work.status];
    head.appendChild(titleWrap); head.appendChild(badge);
    card.appendChild(head);
    var headRow2 = el('div'); headRow2.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;';
    var backLink = el('a'); backLink.href = '#today';
    backLink.textContent = '← Back';
    backLink.style.fontSize = '.85rem';
    headRow2.appendChild(backLink);
    if (isMine || canEditFull) {
      var editWorkBtn = el('button', 'btn btn-outline btn-sm'); editWorkBtn.type = 'button'; editWorkBtn.textContent = 'Edit';
      editWorkBtn.addEventListener('click', function () { openEditWorkModal(work); });
      headRow2.appendChild(editWorkBtn);
    }
    card.appendChild(headRow2);

    // ---- Tabs ----
    var tabs = el('div', 'tabs');
    var overviewBtn = el('button'); overviewBtn.type = 'button'; overviewBtn.textContent = 'Overview'; overviewBtn.classList.add('is-active');
    var checklistBtn = el('button'); checklistBtn.type = 'button';
    checklistBtn.textContent = 'Checklist' + (checklist.length ? ' (' + checklist.filter(function (i) { return i.is_done; }).length + '/' + checklist.length + ')' : '');
    var activityBtn = el('button'); activityBtn.type = 'button'; activityBtn.textContent = 'Activity';
    tabs.appendChild(overviewBtn); tabs.appendChild(checklistBtn); tabs.appendChild(activityBtn);
    card.appendChild(tabs);

    var overviewPane = el('div');
    var checklistPane = el('div', 'hidden');
    var activityPane = el('div', 'hidden');
    card.appendChild(overviewPane); card.appendChild(checklistPane); card.appendChild(activityPane);
    main.appendChild(card);

    var tabButtons = [overviewBtn, checklistBtn, activityBtn];
    var tabPanes = [overviewPane, checklistPane, activityPane];
    function showTab(activeBtn, activePane) {
      tabButtons.forEach(function (b) { b.classList.toggle('is-active', b === activeBtn); });
      tabPanes.forEach(function (p) { p.classList.toggle('hidden', p !== activePane); });
    }
    overviewBtn.addEventListener('click', function () { showTab(overviewBtn, overviewPane); });
    checklistBtn.addEventListener('click', function () { showTab(checklistBtn, checklistPane); });
    activityBtn.addEventListener('click', function () { showTab(activityBtn, activityPane); });

    // ---- Overview pane ----
    // Task 26: "put high-value operational context before long history" —
    // the primary next action is the single answer to "what do I do about
    // this," so it comes first, before even the meta grid. Reuses
    // nextActionLabel() from My Work/Today (Task 24) so the status->action
    // mapping can never drift between the list rows and this detail page.
    var nextActionBox = el('div', 'next-action-callout');
    nextActionBox.appendChild(icon('flag'));
    var naText = el('span'); naText.textContent = nextActionLabel(work);
    nextActionBox.appendChild(naText);
    overviewPane.appendChild(nextActionBox);

    // Task 26: at-a-glance state chips for checklist/waiting/submission —
    // each already has its own full interactive section further down this
    // same pane, but someone shouldn't have to scroll (or switch to the
    // Checklist tab) just to see the two numbers that answer "how close is
    // this." Only shown when actually relevant, so a plain to-do item
    // without submission tracking or an active wait doesn't grow a row of
    // empty/meaningless chips.
    var chipsRow = el('div', 'detail-chips');
    function chip(label, value, cls) {
      var c = el('span', 'detail-chip' + (cls ? ' ' + cls : ''));
      var l = el('span', 'k'); l.textContent = label;
      var v = el('span', 'v'); v.textContent = value;
      c.appendChild(l); c.appendChild(v);
      chipsRow.appendChild(c);
    }
    if (checklist.length) {
      chip('Checklist', checklist.filter(function (i) { return i.is_done; }).length + ' / ' + checklist.length + ' done');
    }
    if (work.status === 'waiting_for_client') {
      var receivedCount = waitingItems.filter(function (wi) { return wi.is_received; }).length;
      chip('Waiting on Client', waitingItems.length ? (receivedCount + ' / ' + waitingItems.length + ' received') : 'awaiting details', 'chip-amber');
    }
    if (work.submission_required) {
      chip('Submission', SUBMISSION_STATUS_LABELS[work.submission_status || 'not_ready']);
    }
    if (chipsRow.children.length) overviewPane.appendChild(chipsRow);

    var metaGrid = el('div', 'meta-grid');
    metaGrid.appendChild(metaItem('Client', clientName(work.client_id), 'building'));
    metaGrid.appendChild(metaItem('Service', template ? template.title : 'Ad-hoc', 'idcard'));
    metaGrid.appendChild(metaItem('Period', work.period || '—', 'calendar'));
    metaGrid.appendChild(metaItem('Status', STATUS_LABELS[work.status] || work.status, 'check'));
    metaGrid.appendChild(metaItem('Assignee', profileName(work.assignee_id), 'user', work.assignee_id));
    metaGrid.appendChild(metaItem('Reviewer', work.reviewer_id ? profileName(work.reviewer_id) : '—', 'user', work.reviewer_id));
    // Task 26: "make Internal vs External/Statutory deadline visually
    // unmistakable" — a plain "Internal Target" / "External / Filing
    // Deadline" label pair (unchanged text, for continuity) now also
    // carries a real color-coded tag on the value itself, not just a
    // different label, so the two can't be confused at a glance the way
    // two same-styled date fields could be.
    var internalTag = work.internal_due_date ? { text: 'INTERNAL', cls: 'badge-internal' } : null;
    metaGrid.appendChild(metaItem('Internal Target', fmtDate(work.internal_due_date), 'calendar', false, internalTag));
    // Handbook Task 12: distinct from "—" (no date, and none needed) —
    // a template flagged requires_external_deadline with no external_
    // due_date set means a governed rule hasn't been entered yet, not
    // that this work genuinely has no filing deadline.
    var needsDeadlineVerification = !work.external_due_date && !!(template && template.requires_external_deadline);
    var externalDeadlineText = work.external_due_date ? fmtDate(work.external_due_date) : (needsDeadlineVerification ? 'Requires verification' : '—');
    var externalTag = (work.external_due_date || needsDeadlineVerification) ? { text: 'STATUTORY', cls: 'badge-statutory' } : null;
    var externalDeadlineItem = metaItem('External / Filing Deadline', externalDeadlineText, 'calendar', false, externalTag);
    if (needsDeadlineVerification) { var edv = externalDeadlineItem.querySelector('.value'); if (edv) edv.style.color = 'var(--amber)'; }
    metaGrid.appendChild(externalDeadlineItem);
    metaGrid.appendChild(metaItem('Priority', work.priority.charAt(0).toUpperCase() + work.priority.slice(1), 'flag'));
    overviewPane.appendChild(metaGrid);

    // Status control — employees on their own work get a restricted set of
    // options (can't self-approve); a matching reviewer and admin get the
    // full set. As of Handbook Task 8, the offered options are also
    // filtered to whatever guard_work_item_update()'s transition map
    // actually allows from the item's CURRENT status — no more dead-end
    // choices that always error. Admin additionally sees every status
    // regardless of the map (an "Override" control appears if their pick
    // isn't a normal transition — see below), since only admin can supply
    // the override reason the DB requires for an exceptional change.
    if (isMine || canEditFull) {
      var statusWrap = el('div', 'f');
      var statusLabel = el('label'); statusLabel.textContent = 'Status'; statusWrap.appendChild(statusLabel);
      var statusSel = el('select');
      var normalNext = validClientNextStatuses(work);
      var allowed;
      if (isAdmin()) {
        var full = ['to_do', 'in_progress', 'waiting_for_client', 'ready_for_review', 'changes_required', 'approved'];
        if (!template || template.requires_submission) full.push('ready_to_submit');
        full.push('completed');
        allowed = full;
      } else if (canEditFull) {
        allowed = normalNext;
      } else {
        allowed = normalNext.filter(function (s) { return EMPLOYEE_STATUSES.indexOf(s) !== -1; });
      }
      if (allowed.indexOf(work.status) === -1) allowed = [work.status].concat(allowed);
      allowed.forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });
      statusSel.value = work.status;
      if (!canEditFull && !isMine) statusSel.disabled = true;
      var prevStatus = work.status;
      statusSel.addEventListener('change', async function () {
        var newStatus = statusSel.value;
        // Fast, friendly client-side check — the real enforcement is the
        // work_items_review_needs_reviewer DB constraint and the guard
        // trigger's own check (both apply regardless of role, admins
        // included), so this can't actually be bypassed even if this
        // check were removed; it just avoids a round trip for the common
        // case of someone forgetting to set a reviewer.
        if (newStatus === 'ready_for_review' && !work.reviewer_id) {
          toast('Assign a reviewer before sending this work for review.', true);
          statusSel.value = prevStatus;
          return;
        }
        if (newStatus === 'waiting_for_client' && prevStatus !== 'waiting_for_client') {
          openWaitingModal(work, function (waitingFields, waitingItems) {
            applyStatusChange(newStatus, waitingFields, waitingItems);
          }, function () { statusSel.value = prevStatus; });
          return;
        }
        applyStatusChange(newStatus, buildStatusPatch(newStatus));
      });
      function buildStatusPatch(newStatus, overrideReason) {
        var patch = { status: newStatus };
        if (newStatus !== 'waiting_for_client') { patch.waiting_reason = null; patch.waiting_since = null; patch.follow_up_date = null; patch.waiting_requested_by = null; }
        // Tracks how long something has actually sat in the review queue —
        // separate from updated_at, which any field change would bump —
        // so the Manager Dashboard can flag reviews that are going stale.
        patch.ready_for_review_at = newStatus === 'ready_for_review' ? new Date().toISOString() : null;
        // completed_at was a reserved-but-unset column until the Reports
        // page (V2 Task 16) needed a real completion timestamp for "Work
        // Completed by Month"/"Completed Work by Period" — set it the same
        // way ready_for_review_at is set here, and clear it if a status
        // correction moves an item back out of Completed.
        if (newStatus === 'completed') patch.completed_at = new Date().toISOString();
        else if (prevStatus === 'completed') patch.completed_at = null;
        if (overrideReason) patch.status_override_reason = overrideReason;
        return patch;
      }
      async function applyStatusChange(newStatus, patch, newWaitingItemTitles) {
        var res = await sb.from('work_items').update(patch).eq('id', work.id);
        if (res.error) {
          // Handbook Task 8: guard_work_item_update() rejects a normal-
          // looking but not-actually-allowed transition (wrong stage,
          // required checklist items unchecked, etc.) with a specific
          // message. Only admin can supply a reason and retry as an
          // explicit, audited override — anyone else just sees why it
          // was blocked and has to fix the underlying thing instead.
          if (isAdmin() && !patch.status_override_reason) {
            statusSel.value = prevStatus;
            openOverrideStatusModal(res.error.message, function (reason) {
              applyStatusChange(newStatus, buildStatusPatch(newStatus, reason), newWaitingItemTitles);
            });
            return;
          }
          toast('Could not update status: ' + res.error.message, true);
          statusSel.value = prevStatus;
          return;
        }
        if (newWaitingItemTitles && newWaitingItemTitles.length) {
          var rows = newWaitingItemTitles.map(function (title, i) {
            return {
              work_item_id: work.id,
              title: title,
              sort_order: i,
              requested_date: patch.waiting_since || localDateStr(),
              requested_by: state.user.id,
              follow_up_date: patch.follow_up_date || null,
            };
          });
          await sb.from('work_waiting_items').insert(rows);
        }
        // Leaving Waiting for Client through any path — not just "Mark
        // Documents Received" — should resolve any outstanding waiting-
        // checklist items too, so a later wait doesn't show stale items
        // left over from one that was abandoned via the status dropdown
        // instead of that button.
        if (prevStatus === 'waiting_for_client' && newStatus !== 'waiting_for_client') {
          await sb.from('work_waiting_items').update({ is_received: true }).eq('work_item_id', work.id);
        }
        // Logged automatically by guard_work_item_update() (Handbook Task 7) — no client-side call needed or permitted.
        toast(patch.status_override_reason ? 'Status overridden.' : 'Status updated.');
        renderWorkDetail(id);
      }
      statusWrap.appendChild(statusSel);
      if (!canEditFull) {
        var hint = el('span', 'f-hint'); hint.textContent = 'A reviewer sets Approved, Ready to Submit, or Completed.';
        statusWrap.appendChild(hint);
      }
      overviewPane.appendChild(statusWrap);
    }

    // Submission tracking — hidden entirely for work that doesn't require
    // formal filing (ad-hoc work, or a template with requires_submission
    // false). Deliberately separate from the main status control above:
    // an assignee may record submission for their OWN work once it's
    // cleared review (status already ready_to_submit/completed) without
    // needing a reviewer to do it for them — see guard_work_item_update()
    // for the matching DB-level enforcement of that same rule.
    if (work.submission_required) {
      var canRecordSubmission = canEditFull || (isMine && (work.status === 'ready_to_submit' || work.status === 'completed'));
      var subBox = el('div', 'action-box');
      var subTitle = el('div', 'action-title'); subTitle.textContent = 'Submission'; subBox.appendChild(subTitle);

      var subStatusWrap = el('div', 'f');
      var subStatusLabel = el('label'); subStatusLabel.textContent = 'Submission Status'; subStatusWrap.appendChild(subStatusLabel);
      var subStatusSel = el('select');
      Object.keys(SUBMISSION_STATUS_LABELS).forEach(function (s) { subStatusSel.appendChild(new Option(SUBMISSION_STATUS_LABELS[s], s)); });
      subStatusSel.value = work.submission_status || 'not_ready';
      subStatusSel.disabled = !canRecordSubmission;
      subStatusWrap.appendChild(subStatusSel);
      subBox.appendChild(subStatusWrap);

      var refInput = el('input'); refInput.type = 'text'; refInput.value = work.submission_reference || ''; refInput.placeholder = 'e.g. IRD acknowledgment no.';
      refInput.disabled = !canRecordSubmission;
      subBox.appendChild(field('Reference / Submission Number (optional)', refInput));

      var subNoteInput = el('textarea'); subNoteInput.rows = 2; subNoteInput.value = work.submission_note || ''; subNoteInput.placeholder = 'Short note (optional)';
      subNoteInput.disabled = !canRecordSubmission;
      subBox.appendChild(field('Note (optional)', subNoteInput));

      if (work.submitted_at) {
        var submittedLine = el('div'); submittedLine.style.cssText = 'font-size:.85rem;color:var(--ink-soft);margin-top:6px;';
        submittedLine.textContent = 'Submitted ' + fmtDate(work.submitted_at.slice(0, 10)) + (work.submitted_by ? ' by ' + profileName(work.submitted_by) : '');
        subBox.appendChild(submittedLine);
      }

      if (canRecordSubmission) {
        var subSaveBtn = el('button', 'btn btn-outline btn-sm'); subSaveBtn.type = 'button'; subSaveBtn.style.marginTop = '10px'; subSaveBtn.textContent = 'Save Submission Details';
        subSaveBtn.addEventListener('click', async function () {
          var newSubStatus = subStatusSel.value;
          var patch = {
            submission_status: newSubStatus,
            submission_reference: refInput.value.trim() || null,
            submission_note: subNoteInput.value.trim() || null,
          };
          // First time crossing into submitted/acknowledged: stamp who
          // and when. Left alone on later saves so it keeps reflecting
          // the original submission, not the most recent reference/note
          // tweak.
          if (!work.submitted_at && (newSubStatus === 'submitted' || newSubStatus === 'acknowledged')) {
            patch.submitted_at = new Date().toISOString();
            patch.submitted_by = state.user.id;
          }
          subSaveBtn.disabled = true;
          var res = await sb.from('work_items').update(patch).eq('id', work.id);
          subSaveBtn.disabled = false;
          if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
          // Logged automatically by guard_work_item_update() (Handbook Task 7) — no client-side call needed or permitted.
          toast('Submission details saved.');
          renderWorkDetail(id);
        });
        subBox.appendChild(subSaveBtn);
      }

      overviewPane.appendChild(subBox);
    }

    // Current action — status-dependent context box.
    if (work.status === 'waiting_for_client') {
      var actionBox = el('div', 'action-box');
      var atitle = el('div', 'action-title'); atitle.textContent = 'Current Action'; actionBox.appendChild(atitle);
      var wfLabel = el('div'); wfLabel.style.cssText = 'font-weight:700;font-size:.9rem;margin-bottom:4px;'; wfLabel.textContent = 'Waiting for:';
      actionBox.appendChild(wfLabel);
      if (!waitingItems.length) {
        var noWaitItems = el('div'); noWaitItems.style.cssText = 'font-size:.88rem;color:var(--ink-soft);'; noWaitItems.textContent = '—';
        actionBox.appendChild(noWaitItems);
      }
      // Return-to-In-Progress CTA and "Mark Documents Received" are two
      // different actions now: the CTA only ever appears once every item
      // is ALREADY received (individually checked off, or via the force-
      // mark button below), and just flips status — nothing is silently
      // auto-completed the instant the last checkbox is ticked, per the
      // explicit "do not automatically complete the work item" ask.
      var allReceivedBanner = el('div');
      allReceivedBanner.style.cssText = 'margin-top:12px;padding:10px 12px;background:var(--green-soft);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';
      var allReceivedText = el('span'); allReceivedText.style.cssText = 'color:var(--green);font-weight:700;font-size:.88rem;'; allReceivedText.textContent = 'All requirements received.';
      var returnBtn = el('button', 'btn btn-sm'); returnBtn.type = 'button'; returnBtn.textContent = 'Return to In Progress';
      returnBtn.addEventListener('click', async function () {
        var res = await sb.from('work_items').update({ status: 'in_progress', waiting_reason: null, waiting_since: null, follow_up_date: null, waiting_requested_by: null }).eq('id', work.id);
        if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
        // Status change (waiting_for_client -> in_progress) is logged automatically by guard_work_item_update() (Handbook Task 7).
        toast('Back in progress.');
        renderWorkDetail(id);
      });
      allReceivedBanner.appendChild(allReceivedText); allReceivedBanner.appendChild(returnBtn);

      var receivedBtn = el('button', 'btn btn-outline btn-sm'); receivedBtn.type = 'button'; receivedBtn.style.marginTop = '12px';
      receivedBtn.appendChild(icon('check')); receivedBtn.appendChild(document.createTextNode('Mark Documents Received'));
      receivedBtn.addEventListener('click', async function () {
        await sb.from('work_waiting_items').update({ is_received: true }).eq('work_item_id', work.id);
        var res = await sb.from('work_items').update({ status: 'in_progress', waiting_reason: null, waiting_since: null, follow_up_date: null, waiting_requested_by: null }).eq('id', work.id);
        if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
        // Status change (waiting_for_client -> in_progress) is logged automatically by guard_work_item_update() (Handbook Task 7).
        toast('Marked as received — back in progress.');
        renderWorkDetail(id);
      });

      // Reminder message draft — only makes sense while something's still
      // outstanding to remind the client about, so it shares the same
      // "hidden once allDone" visibility as receivedBtn.
      var messageBtn = el('button', 'btn btn-outline btn-sm'); messageBtn.type = 'button'; messageBtn.style.cssText = 'margin-top:10px;';
      messageBtn.appendChild(icon('message')); messageBtn.appendChild(document.createTextNode('Draft Message to Client'));
      messageBtn.addEventListener('click', function () { openMessageModal(work, waitingItems); });

      function refreshWaitingCta() {
        var allDone = waitingItems.length > 0 && waitingItems.every(function (wi) { return wi.is_received; });
        var canAct = isMine || canEditFull;
        allReceivedBanner.classList.toggle('hidden', !(allDone && canAct));
        receivedBtn.classList.toggle('hidden', !(!allDone && canAct));
        messageBtn.classList.toggle('hidden', !(!allDone && canAct));
      }

      waitingItems.forEach(function (wi) {
        actionBox.appendChild(waitingItemRow(wi, work.id, activityPane, canToggleChildren, refreshWaitingCta));
      });
      if (isMine || canEditFull) {
        actionBox.appendChild(messageBtn);
        var addWaitRow = el('div'); addWaitRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
        var newWaitInput = el('input'); newWaitInput.type = 'text'; newWaitInput.placeholder = 'Add another item…'; newWaitInput.style.flex = '1';
        var addWaitBtn = el('button', 'btn btn-outline btn-sm'); addWaitBtn.type = 'button'; addWaitBtn.textContent = 'Add';
        addWaitBtn.addEventListener('click', async function () {
          if (!newWaitInput.value.trim()) return;
          var res = await sb.from('work_waiting_items').insert({
            work_item_id: work.id,
            title: newWaitInput.value.trim(),
            sort_order: waitingItems.length,
            requested_date: localDateStr(),
            requested_by: state.user.id,
          });
          if (res.error) { toast('Could not add item: ' + res.error.message, true); return; }
          renderWorkDetail(id);
        });
        addWaitRow.appendChild(newWaitInput); addWaitRow.appendChild(addWaitBtn);
        actionBox.appendChild(addWaitRow);
      }
      if (work.waiting_requested_by) { var reqByLine = el('div'); reqByLine.style.cssText = 'margin-top:10px;font-size:.85rem;'; reqByLine.textContent = 'Requested by: ' + profileName(work.waiting_requested_by); actionBox.appendChild(reqByLine); }
      if (work.waiting_since) { var reqLine = el('div'); reqLine.style.marginTop = '2px'; reqLine.style.fontSize = '.85rem'; reqLine.textContent = 'Requested: ' + fmtDate(work.waiting_since); actionBox.appendChild(reqLine); }
      if (work.follow_up_date) { var fuLine = el('div'); fuLine.style.marginTop = '2px'; fuLine.style.fontSize = '.85rem'; fuLine.textContent = 'Follow-up: ' + fmtDate(work.follow_up_date); actionBox.appendChild(fuLine); }
      actionBox.appendChild(allReceivedBanner);
      actionBox.appendChild(receivedBtn);
      refreshWaitingCta();
      overviewPane.appendChild(actionBox);
    } else if (work.status === 'changes_required') {
      var cBox = el('div', 'action-box');
      var ctitle = el('div', 'action-title'); ctitle.textContent = 'Current Action'; cBox.appendChild(ctitle);
      var cLine = el('div'); cLine.textContent = 'The reviewer sent this back — see the comments below for what needs fixing.'; cBox.appendChild(cLine);
      overviewPane.appendChild(cBox);
    }

    if (work.description) {
      var descP = el('p'); descP.style.whiteSpace = 'pre-wrap'; descP.style.marginTop = '14px'; descP.textContent = work.description;
      overviewPane.appendChild(descP);
    }

    // Comments — stay attached to the work item and visible on Overview,
    // since review feedback needs to be seen right where the status is.
    var commentsCard = el('div', 'card'); commentsCard.style.marginTop = '20px'; commentsCard.style.boxShadow = 'none'; commentsCard.style.border = '1px solid var(--border)';
    var coH2 = el('h2'); coH2.appendChild(icon('message')); coH2.appendChild(document.createTextNode('Comments')); commentsCard.appendChild(coH2);
    if (!comments.length) {
      var noComments = el('p', 'desc'); noComments.textContent = 'No comments yet.';
      commentsCard.appendChild(noComments);
    }
    comments.forEach(function (c) {
      var row = el('div', 'comment');
      var who = el('span', 'who'); who.textContent = profileName(c.author_id);
      var when = el('span', 'when'); when.textContent = fmtDateTime(c.created_at);
      who.appendChild(when);
      var body = el('p'); body.textContent = c.body;
      row.appendChild(who); row.appendChild(body);
      commentsCard.appendChild(row);
    });
    var commentInput = el('textarea'); commentInput.rows = 2; commentInput.placeholder = 'Add a comment…';
    commentInput.style.marginTop = '12px';
    var commentBtn = el('button', 'btn btn-outline btn-sm'); commentBtn.type = 'button'; commentBtn.textContent = 'Post Comment';
    commentBtn.style.marginTop = '8px';
    commentBtn.addEventListener('click', async function () {
      if (!commentInput.value.trim()) return;
      var res = await sb.from('work_comments').insert({ work_item_id: work.id, author_id: state.user.id, body: commentInput.value.trim() });
      if (res.error) { toast('Could not post comment: ' + res.error.message, true); return; }
      commentInput.value = '';
      renderWorkDetail(id);
    });
    commentsCard.appendChild(commentInput);
    commentsCard.appendChild(commentBtn);
    overviewPane.appendChild(commentsCard);

    // ---- Checklist pane ----
    var anyStage = false;
    STAGES.forEach(function (stage) {
      var stageItems = checklist.filter(function (i) { return i.stage === stage; });
      if (!stageItems.length) return;
      anyStage = true;
      var h3 = el('div', 'checklist-stage'); h3.textContent = STAGE_LABELS[stage]; checklistPane.appendChild(h3);
      stageItems.forEach(function (item) { checklistPane.appendChild(checklistRow(item, id, activityPane, canToggleChildren)); });
    });
    if (!anyStage) {
      var noItems = el('p', 'desc'); noItems.textContent = 'No checklist items yet.';
      checklistPane.appendChild(noItems);
    }
    if (isMine || canEditFull) {
      var addItemRow = el('div');
      addItemRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;';
      var newItemInput = el('input'); newItemInput.type = 'text'; newItemInput.placeholder = 'Add a checklist item…';
      newItemInput.style.flex = '1'; newItemInput.style.minWidth = '160px';
      var stageSel = el('select'); stageSel.style.width = 'auto';
      STAGES.forEach(function (s) { stageSel.appendChild(new Option(STAGE_LABELS[s], s)); });
      var addItemBtn = el('button', 'btn btn-outline btn-sm'); addItemBtn.type = 'button'; addItemBtn.textContent = 'Add';
      addItemBtn.addEventListener('click', async function () {
        if (!newItemInput.value.trim()) return;
        var stageCount = checklist.filter(function (i) { return i.stage === stageSel.value; }).length;
        var res = await sb.from('work_checklist_items').insert({ work_item_id: work.id, stage: stageSel.value, title: newItemInput.value.trim(), sort_order: stageCount });
        if (res.error) { toast('Could not add item: ' + res.error.message, true); return; }
        newItemInput.value = '';
        renderWorkDetail(id);
      });
      addItemRow.appendChild(newItemInput); addItemRow.appendChild(stageSel); addItemRow.appendChild(addItemBtn);
      checklistPane.appendChild(addItemRow);
    }

    // ---- Activity pane ----
    if (!activity.length) {
      var noActivity = el('p', 'desc'); noActivity.textContent = 'Nothing logged yet — status changes and checklist updates show up here.';
      activityPane.appendChild(noActivity);
    }
    activity.forEach(function (a) {
      var row = el('div', 'activity-row');
      var who = el('span', 'who'); who.textContent = a.actor_id ? profileName(a.actor_id) : 'System';
      var when = el('span', 'when'); when.textContent = fmtDateTime(a.created_at);
      who.appendChild(when);
      row.appendChild(who);
      if (a.detail) { var detailEl = el('div', 'detail'); detailEl.textContent = a.detail; row.appendChild(detailEl); }
      activityPane.appendChild(row);
    });
  }

  // Lets a title/period/due-date typo (or a bulk-generated item that still
  // needs its dates filled in — see "Generate Period Work") be fixed
  // without recreating the work item.
  function openEditWorkModal(work) {
    // Same reassignment boundary as guard_work_item_update() itself
    // (admin, or this item's own reviewer) -- matches who the DB will
    // actually let change assignee_id/reviewer_id, so this never shows a
    // control that would just fail on save. Reassigning/adding a reviewer
    // had no UI path at all before this — the only way to set one was at
    // creation — which also meant "reassigned" could never appear in the
    // audit trail below since nothing ever produced it.
    var canReassign = isAdmin() || (state.profile.role === 'reviewer' && work.reviewer_id === state.user.id);

    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Edit Work';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text'; titleInput.value = work.title;
    wrap.appendChild(field('Title', titleInput));
    var periodInput = el('input'); periodInput.type = 'text'; periodInput.value = work.period || ''; periodInput.placeholder = 'e.g. Shrawan 2083';
    wrap.appendChild(field('Period (optional)', periodInput));
    var internalDueInput = el('input'); internalDueInput.type = 'date'; internalDueInput.value = work.internal_due_date || '';
    wrap.appendChild(field('Internal Target', internalDueInput));
    var externalDueInput = el('input'); externalDueInput.type = 'date'; externalDueInput.value = work.external_due_date || '';
    wrap.appendChild(field('External / Filing Deadline (optional)', externalDueInput));

    var assigneeSel, reviewerSel;
    if (canReassign) {
      assigneeSel = el('select');
      state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
      assigneeSel.value = work.assignee_id;
      wrap.appendChild(field('Assignee', assigneeSel));

      reviewerSel = el('select');
      reviewerSel.appendChild(new Option('— No reviewer —', ''));
      state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
      reviewerSel.value = work.reviewer_id || '';
      wrap.appendChild(field('Reviewer', reviewerSel));
    }

    var submissionReqCb;
    if (canReassign) {
      var submissionReqWrap = el('div', 'f');
      var submissionReqLabel = el('label');
      submissionReqCb = el('input'); submissionReqCb.type = 'checkbox'; submissionReqCb.style.width = 'auto'; submissionReqCb.style.marginRight = '8px';
      submissionReqCb.checked = !!work.submission_required;
      submissionReqLabel.appendChild(submissionReqCb);
      submissionReqLabel.appendChild(document.createTextNode('Requires formal submission/filing'));
      submissionReqWrap.appendChild(submissionReqLabel);
      wrap.appendChild(submissionReqWrap);
    }

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the work a title.', true); return; }
      saveBtn.disabled = true;
      var patch = {
        title: titleInput.value.trim(),
        period: periodInput.value.trim() || null,
        internal_due_date: internalDueInput.value || null,
        external_due_date: externalDueInput.value || null,
      };
      if (canReassign) {
        patch.assignee_id = assigneeSel.value;
        patch.reviewer_id = reviewerSel.value || null;
        patch.submission_required = submissionReqCb.checked;
      }
      // Reassignment and due-date-change history is logged automatically
      // by guard_work_item_update() itself (see supabase/migrations/
      // 20260811090400_work_items.sql) — nothing to do here beyond the
      // update; the trigger notices whatever actually changed.
      var res = await sb.from('work_items').update(patch).eq('id', work.id);
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      closeModal();
      toast('Work updated.');
      renderWorkDetail(work.id);
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  function checklistRow(item, workId, activityPane, canToggle) {
    var row = el('label', 'checklist-item' + (item.is_done ? ' done' : ''));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = item.is_done;
    cb.disabled = !canToggle;
    cb.addEventListener('change', async function () {
      var res = await sb.from('work_checklist_items').update({ is_done: cb.checked }).eq('id', item.id);
      if (res.error) { toast('Could not update item: ' + res.error.message, true); cb.checked = !cb.checked; return; }
      row.classList.toggle('done', cb.checked);
      var detail = (cb.checked ? 'Checked off: ' : 'Unchecked: ') + item.title;
      logActivity(workId, 'checklist_toggled', detail);
      prependActivityRow(activityPane, detail);
    });
    var span = el('span'); span.textContent = item.title + (item.is_required === false ? ' (Optional)' : '');
    row.appendChild(cb); row.appendChild(span);
    return row;
  }

  // A waiting-on-client requirement row: the checkbox is the same pattern
  // as checklistRow, but each item now carries its own requested-by/date,
  // follow-up history, and note — shown as a small detail line underneath
  // rather than cluttering the checkbox row itself. onToggled lets the
  // parent action box update its "all received" CTA the instant the last
  // item is checked, without a full page re-render.
  function waitingItemRow(wi, workId, activityPane, canToggle, onToggled) {
    var row = el('div', 'checklist-item' + (wi.is_received ? ' done' : ''));
    row.style.cssText = 'flex-direction:column;align-items:stretch;padding:8px 0;';
    var topRow = el('label'); topRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = wi.is_received;
    cb.disabled = !canToggle;
    var followUpBtn = el('button', 'btn btn-outline btn-sm');
    cb.addEventListener('change', async function () {
      var res = await sb.from('work_waiting_items').update({ is_received: cb.checked }).eq('id', wi.id);
      if (res.error) { toast('Could not update: ' + res.error.message, true); cb.checked = !cb.checked; return; }
      wi.is_received = cb.checked;
      row.classList.toggle('done', cb.checked);
      followUpBtn.classList.toggle('hidden', cb.checked || !canToggle);
      var detail = (cb.checked ? 'Received: ' : 'Un-received: ') + wi.title;
      logActivity(workId, 'waiting_item_toggled', detail);
      prependActivityRow(activityPane, detail);
      onToggled();
    });
    var span = el('span'); span.textContent = wi.title;
    topRow.appendChild(cb); topRow.appendChild(span);
    row.appendChild(topRow);

    var metaBits = ['Requested ' + fmtDate(wi.requested_date) + (wi.requested_by ? ' by ' + profileName(wi.requested_by) : '')];
    if (wi.follow_up_date) metaBits.push('Next follow-up ' + fmtDate(wi.follow_up_date));
    if (wi.follow_up_count) metaBits.push('Followed up ' + wi.follow_up_count + 'x' + (wi.last_followed_up_at ? ' (last ' + fmtDate(wi.last_followed_up_at.slice(0, 10)) + ')' : ''));
    var metaLine = el('div'); metaLine.style.cssText = 'font-size:.78rem;color:var(--ink-soft);margin:2px 0 0 28px;';
    metaLine.textContent = metaBits.join(' · ');
    row.appendChild(metaLine);

    if (isStaleWaitingItem(wi)) {
      var staleTag = el('div'); staleTag.style.cssText = 'font-size:.78rem;color:var(--red);font-weight:700;margin:2px 0 0 28px;';
      staleTag.textContent = 'Follow-up overdue';
      row.appendChild(staleTag);
    }
    if (wi.note) {
      var noteLine = el('div'); noteLine.style.cssText = 'font-size:.82rem;color:var(--ink-soft);font-style:italic;margin:2px 0 0 28px;';
      noteLine.textContent = wi.note;
      row.appendChild(noteLine);
    }

    followUpBtn.type = 'button'; followUpBtn.style.cssText = 'margin:6px 0 0 28px;';
    followUpBtn.textContent = 'Record Follow-up';
    if (wi.is_received || !canToggle) followUpBtn.classList.add('hidden');
    followUpBtn.addEventListener('click', function () {
      openFollowUpModal(wi, workId, function () { renderWorkDetail(workId); });
    });
    row.appendChild(followUpBtn);

    return row;
  }

  // Records that someone followed up on a specific outstanding
  // requirement — bumps follow_up_count, stamps last_followed_up_at, and
  // lets the next follow-up date / a short note be updated at the same
  // time, all in one action instead of separate edits per field. Always
  // logged to Activity so there's a real history of chasing, not just
  // whatever the item's current follow-up date happens to say.
  function openFollowUpModal(wi, workId, onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Record Follow-up';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var itemLine = el('p', 'desc'); itemLine.style.margin = '0 0 14px'; itemLine.textContent = 'Waiting on: ' + wi.title;
    wrap.appendChild(itemLine);

    var nextDateInput = el('input'); nextDateInput.type = 'date'; nextDateInput.value = wi.follow_up_date || '';
    wrap.appendChild(field('Next Follow-up Date (optional)', nextDateInput));
    var noteInput = el('textarea'); noteInput.rows = 2; noteInput.placeholder = 'Short note (optional)'; noteInput.value = wi.note || '';
    wrap.appendChild(field('Note (optional)', noteInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function () {
      saveBtn.disabled = true;
      var newCount = (wi.follow_up_count || 0) + 1;
      var res = await sb.from('work_waiting_items').update({
        follow_up_date: nextDateInput.value || null,
        note: noteInput.value.trim() || null,
        last_followed_up_at: new Date().toISOString(),
        follow_up_count: newCount,
      }).eq('id', wi.id);
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save follow-up: ' + res.error.message, true); return; }
      var detail = 'Followed up on "' + wi.title + '" (#' + newCount + ')' + (noteInput.value.trim() ? ' — ' + noteInput.value.trim() : '');
      logActivity(workId, 'follow_up_recorded', detail);
      closeModal();
      toast('Follow-up recorded.');
      onDone();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Plain-text reminder draft — client name, service/period, the still-
  // outstanding items, and the filing deadline if one's set. Deliberately
  // just a string assembled from data already in memory: no WhatsApp/SMS/
  // email API, paid or otherwise, and nothing here gets written to the
  // database (see openMessageModal below) — it exists only in the
  // textarea until the tab closes.
  function buildWaitingClientMessage(work, waitingItems) {
    var client = state.clients.find(function (c) { return c.id === work.client_id; });
    var greetName = (client && client.contact_person) || (client && client.name) || 'Sir/Madam';
    var tmpl = templateById(work.service_template_id);
    var serviceLabel = (tmpl ? tmpl.title : work.title) + (work.period ? ' (' + work.period + ')' : '');
    var outstanding = waitingItems.filter(function (wi) { return !wi.is_received; }).map(function (wi) { return wi.title; });

    var lines = [];
    lines.push('Dear ' + greetName + ',');
    lines.push('');
    lines.push('This is a reminder regarding your ' + serviceLabel + '. We are still waiting to receive the following:');
    outstanding.forEach(function (title) { lines.push('- ' + title); });
    lines.push('');
    lines.push(work.external_due_date
      ? 'Kindly share these by ' + fmtDate(work.external_due_date) + ' so we can meet the filing deadline.'
      : 'Kindly share these at your earliest convenience.');
    lines.push('');
    lines.push('Thank you,');
    lines.push(state.profile.full_name || 'Maven Consultancy Services');
    return lines.join('\n');
  }

  // Editable draft + a Copy button using the browser's own clipboard API
  // (navigator.clipboard) — no external service, paid or free, is
  // involved in sending anything; staff paste it into whatever they
  // already use (WhatsApp Web, email, SMS app) themselves. The generated
  // text lives only in this textarea's value; closing the modal discards
  // it, nothing is saved.
  function openMessageModal(work, waitingItems) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Message to Client';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var hint = el('p', 'desc'); hint.style.margin = '0 0 14px'; hint.textContent = 'Edit as needed, then copy — nothing here is saved. Paste it into WhatsApp, email, or wherever you\'d normally message this client.';
    wrap.appendChild(hint);

    var msgInput = el('textarea'); msgInput.rows = 11; msgInput.value = buildWaitingClientMessage(work, waitingItems);
    wrap.appendChild(field('Message', msgInput));

    var actions = el('div', 'modal-actions');
    var copyBtn = el('button', 'btn'); copyBtn.type = 'button'; copyBtn.textContent = 'Copy Message';
    copyBtn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(msgInput.value);
        toast('Message copied.');
      } catch (err) {
        toast('Could not copy automatically — select the text and copy manually.', true);
      }
    });
    actions.appendChild(copyBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Handbook Task 8: admin-only override when guard_work_item_update()
  // rejects a status change (skips a required stage, leaves required
  // checklist items unchecked, etc.). Deliberately requires a real,
  // non-empty reason — the DB itself refuses to apply the override
  // without one — and every use is permanently recorded to work_activity
  // as a distinct 'status_override' entry (see the migration), never
  // silently applied. This is an escape hatch for genuine exceptions,
  // not a way around fixing the workflow — it should be rare.
  function openOverrideStatusModal(blockedReason, onConfirm) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Override Required';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var explain = el('p', 'desc');
    explain.textContent = blockedReason + ' As an admin, you may override this — provide a reason. The override is permanently recorded in this item\'s Activity history.';
    wrap.appendChild(explain);

    var reasonInput = el('textarea'); reasonInput.rows = 3; reasonInput.placeholder = 'Why is this exception necessary?';
    wrap.appendChild(field('Override Reason (required)', reasonInput));

    var actions = el('div', 'modal-actions');
    var confirmBtn = el('button', 'btn btn-danger'); confirmBtn.type = 'button'; confirmBtn.textContent = 'Override and Apply';
    confirmBtn.addEventListener('click', function () {
      var reason = reasonInput.value.trim();
      if (!reason) { toast('A reason is required to override.', true); return; }
      closeModal();
      onConfirm(reason);
    });
    actions.appendChild(confirmBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Small inline prompt for the structured "waiting for client" fields —
  // reason + follow-up date — captured up front rather than left as a bare
  // status flip, so Today's attention list and the manager view (later
  // phase) both have something real to show.
  function openWaitingModal(work, onSave, onCancel) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Waiting for Client';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', function () { closeModal(); onCancel(); });
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var itemsInput = el('textarea'); itemsInput.rows = 3; itemsInput.placeholder = 'One item per line, e.g.\nPurchase invoices\nBank statement';
    wrap.appendChild(field('Waiting for', itemsInput));
    var followUpInput = el('input'); followUpInput.type = 'date';
    // Pre-filled from Workflow Settings (V2 Task 18) — "N days after
    // request" is just a starting suggestion, still fully editable or
    // clearable per item before Save.
    var suggestedFollowUp = new Date(); suggestedFollowUp.setDate(suggestedFollowUp.getDate() + state.settings.waiting_followup_default_days);
    followUpInput.value = localDateStr(suggestedFollowUp);
    wrap.appendChild(field('Follow-up date (optional)', followUpInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      var items = itemsInput.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!items.length) { toast('Enter at least one thing you\'re waiting for.', true); return; }
      closeModal();
      onSave({
        status: 'waiting_for_client',
        waiting_since: localDateStr(),
        follow_up_date: followUpInput.value || null,
        waiting_requested_by: state.user.id,
        ready_for_review_at: null,
      }, items);
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // tag (Task 26, optional): { text, cls } — appends a small pill after
  // the value. Used to make Internal vs External/Statutory deadlines
  // visually unmistakable on Work Details (see renderWorkDetail's own
  // metaGrid), not just distinguished by label text as before.
  function metaItem(label, value, iconName, avatarId, tag) {
    var wrap = el('div', 'meta-item');
    wrap.appendChild(icon(iconName, 'ic-lg'));
    var body = el('div');
    var l = el('label'); l.textContent = label;
    var v = el('div', 'value');
    if (avatarId && value !== '—') v.appendChild(avatarFor(avatarId, 'avatar-sm'));
    v.appendChild(document.createTextNode(value));
    if (tag) { var t = el('span', 'badge ' + tag.cls); t.textContent = tag.text; v.appendChild(t); }
    body.appendChild(l); body.appendChild(v);
    wrap.appendChild(body);
    return wrap;
  }

  // ============================================================
  // Admin: Clients
  // ============================================================
  async function renderClients(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Clients'; head.appendChild(h1);
    if (isAdmin()) {
      var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Client'));
      addBtn.addEventListener('click', function () { openClientFormModal(); });
      head.appendChild(addBtn);
    }
    main.appendChild(head);

    await renderClientWorkHubStrip(main);

    if (!state.clients.length) {
      var empty = el('div', 'empty-note');
      empty.appendChild(icon('building'));
      empty.appendChild(document.createTextNode('No clients yet. Add your first one to get started.'));
      main.appendChild(empty);
      return;
    }

    var grid = el('div', 'client-grid');
    state.clients.forEach(function (c) {
      var card = el('div', 'client-card' + (c.is_active ? '' : ' inactive-row'));
      var headRow = el('div', 'client-card-head');
      var nameWrap = el('div');
      var h3 = el('h3');
      var nameBtn = el('button', 'client-name-link'); nameBtn.type = 'button'; nameBtn.textContent = c.name;
      nameBtn.addEventListener('click', function () { gotoClient(c.id); });
      h3.appendChild(nameBtn);
      nameWrap.appendChild(h3);
      if (c.pan_vat) { var pv = el('div', 'pan-vat'); pv.textContent = 'PAN/VAT: ' + c.pan_vat; nameWrap.appendChild(pv); }
      var cardAttnBadge = attentionBadge(c);
      if (cardAttnBadge) { cardAttnBadge.style.marginTop = '6px'; nameWrap.appendChild(cardAttnBadge); }
      headRow.appendChild(nameWrap);
      if (c.business_type) { var typeBadge = el('span', 'badge badge-type'); typeBadge.textContent = c.business_type; headRow.appendChild(typeBadge); }
      card.appendChild(headRow);

      if (c.contact_person) {
        var cp = el('div', 'contact-row'); cp.appendChild(icon('user')); cp.appendChild(document.createTextNode(c.contact_person));
        card.appendChild(cp);
      }
      if (c.phone) {
        var ph = el('div', 'contact-row'); ph.appendChild(icon('phone')); ph.appendChild(document.createTextNode(c.phone));
        card.appendChild(ph);
      }
      if (c.email) {
        var em = el('div', 'contact-row'); em.appendChild(icon('mail')); em.appendChild(document.createTextNode(c.email));
        card.appendChild(em);
      }
      if (c.notes) {
        var notesP = el('p'); notesP.style.fontSize = '.85rem'; notesP.style.color = 'var(--ink-soft)'; notesP.style.marginTop = '10px'; notesP.textContent = c.notes;
        card.appendChild(notesP);
      }

      var actions = el('div', 'actions');
      // Task 25: "improve navigation between the related surfaces" —
      // jumps straight into Deadlines pre-filtered to this client (see
      // gotoDeadlinesForClient / routeFromHash's ?client= handling)
      // instead of leaving someone to re-select the client by hand on a
      // separate page.
      var deadlinesBtn = el('button', 'btn btn-outline btn-sm'); deadlinesBtn.type = 'button';
      deadlinesBtn.appendChild(icon('calendar'));
      deadlinesBtn.appendChild(document.createTextNode('View Deadlines'));
      deadlinesBtn.addEventListener('click', function () { gotoDeadlinesForClient(c.id); });
      actions.appendChild(deadlinesBtn);
      if (isReviewerOrAdmin()) {
        var credBtn = el('button', 'btn btn-outline btn-sm'); credBtn.type = 'button';
        credBtn.appendChild(icon('idcard'));
        credBtn.appendChild(document.createTextNode('Credentials'));
        credBtn.addEventListener('click', function () { openClientCredentialsModal(c); });
        actions.appendChild(credBtn);
      }
      if (isAdmin()) {
        var toggleBtn = el('button', 'btn btn-outline btn-sm'); toggleBtn.type = 'button';
        toggleBtn.textContent = c.is_active ? 'Deactivate' : 'Reactivate';
        toggleBtn.addEventListener('click', async function () {
          var res = await sb.from('clients').update({ is_active: !c.is_active }).eq('id', c.id);
          if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
          await loadClients();
          render();
        });
        actions.appendChild(toggleBtn);
      }
      card.appendChild(actions);
      grid.appendChild(card);
    });
    main.appendChild(grid);
  }

  // ============================================================
  // Client Detail — the single internal view of the client: what's open,
  // what's expected recurring, what we're waiting on them for, and notes.
  // ============================================================
  // Compact Service/Period/Status/Deadline table — used for both Current
  // Work and Recently Completed on the Client page so the two read as
  // one consistent format rather than two different list styles.
  function clientWorkTable(items) {
    // Task 35: every other wide table in this app scrolls horizontally
    // inside its own card instead of pushing the whole page wider (Task
    // 32's convention for Staff & Access); this one was missed.
    var scroll = el('div'); scroll.style.cssText = 'overflow-x:auto;';
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Service', 'Period', 'Status', 'Deadline'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    items.forEach(function (w) {
      var tmpl = templateById(w.service_template_id);
      var tr = el('tr'); tr.style.cursor = 'pointer';
      tr.addEventListener('click', function () { gotoWork(w.id); });
      var tdService = el('td'); tdService.textContent = tmpl ? tmpl.title : w.title; tr.appendChild(tdService);
      var tdPeriod = el('td'); tdPeriod.textContent = w.period || '—'; tr.appendChild(tdPeriod);
      var tdStatus = el('td'); var badge = el('span', 'badge badge-' + w.status); badge.textContent = STATUS_LABELS[w.status] || w.status; tdStatus.appendChild(badge); tr.appendChild(tdStatus);
      var tdDeadline = el('td'); if (isOverdue(w)) tdDeadline.style.cssText = 'color:var(--red);font-weight:700;'; tdDeadline.textContent = dueDateText(w); tr.appendChild(tdDeadline);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    return scroll;
  }

  async function renderClientDetail(id) {
    var main = qs('#main');
    clear(main);
    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var c = state.clients.find(function (x) { return x.id === id; });
    var workRes = await sb.from('work_items').select('*').eq('client_id', id).order('internal_due_date', { ascending: true, nullsFirst: false });
    var servicesRes = await sb.from('client_services').select('*, service_templates(*)').eq('client_id', id).order('created_at');
    clear(main);

    if (!c) {
      var empty = el('div', 'empty-note'); empty.textContent = "That client doesn't exist, or you don't have access to it.";
      main.appendChild(empty);
      var back = el('button', 'btn btn-outline btn-sm'); back.type = 'button'; back.textContent = '← Back to Clients';
      back.addEventListener('click', function () { goto('clients'); });
      main.appendChild(back);
      return;
    }
    var work = (workRes.data || []).slice().sort(compareByDue);
    var services = servicesRes.data || [];
    if (workRes.error) toast('Could not load work: ' + workRes.error.message, true);
    if (servicesRes.error) toast('Could not load active services: ' + servicesRes.error.message, true);

    // ---- Header ----
    var card = el('div', 'card');
    var head = el('div', 'detail-head');
    var titleWrap = el('div');
    var nameRow = el('div'); nameRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    var h1 = el('h1'); h1.style.fontSize = '1.25rem'; h1.textContent = c.name;
    nameRow.appendChild(h1);
    var attnBadge = attentionBadge(c);
    if (attnBadge) nameRow.appendChild(attnBadge);
    titleWrap.appendChild(nameRow);
    var sub = el('div'); sub.style.cssText = 'color:var(--ink-soft);font-size:.88rem;margin-top:2px;';
    sub.textContent = (c.pan_vat ? 'PAN/VAT ' + c.pan_vat : 'No PAN/VAT on file') + (c.contact_person ? ' · ' + c.contact_person : '');
    titleWrap.appendChild(sub);
    // The reason plus who/when — visible to every staff member (not just
    // the manager/admin who can change it), same "staff can see the flag"
    // requirement the badge itself satisfies.
    if (c.attention_level !== 'normal' && c.attention_reason) {
      var attnNote = el('div'); attnNote.style.cssText = 'margin-top:8px;font-size:.85rem;color:var(--ink-soft);';
      attnNote.textContent = '"' + c.attention_reason + '"' +
        (c.attention_set_by ? ' — set by ' + profileName(c.attention_set_by) : '') +
        (c.attention_set_at ? ' on ' + fmtDateTime(c.attention_set_at) : '');
      titleWrap.appendChild(attnNote);
    }
    head.appendChild(titleWrap);
    if (c.business_type) { var typeBadge = el('span', 'badge badge-type'); typeBadge.textContent = c.business_type; head.appendChild(typeBadge); }
    card.appendChild(head);
    var backLink = el('a'); backLink.href = '#clients'; backLink.textContent = '← Back'; backLink.style.fontSize = '.85rem';
    card.appendChild(backLink);

    if (c.phone || c.email) {
      var contactRow = el('div'); contactRow.style.cssText = 'margin-top:14px;display:flex;gap:18px;flex-wrap:wrap;';
      if (c.phone) { var ph = el('div', 'contact-row'); ph.appendChild(icon('phone')); ph.appendChild(document.createTextNode(c.phone)); contactRow.appendChild(ph); }
      if (c.email) { var em = el('div', 'contact-row'); em.appendChild(icon('mail')); em.appendChild(document.createTextNode(c.email)); contactRow.appendChild(em); }
      card.appendChild(contactRow);
    }

    var headActions = el('div', 'actions'); headActions.style.marginTop = '16px';
    if (isAdmin()) {
      var editBtn = el('button', 'btn btn-outline btn-sm'); editBtn.type = 'button'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { openClientFormModal(c); });
      headActions.appendChild(editBtn);
    }
    if (isReviewerOrAdmin()) {
      var credBtn = el('button', 'btn btn-outline btn-sm'); credBtn.type = 'button';
      credBtn.appendChild(icon('idcard')); credBtn.appendChild(document.createTextNode('Credentials'));
      credBtn.addEventListener('click', function () { openClientCredentialsModal(c); });
      headActions.appendChild(credBtn);

      var attnBtn = el('button', 'btn btn-outline btn-sm'); attnBtn.type = 'button';
      attnBtn.appendChild(icon('alert')); attnBtn.appendChild(document.createTextNode('Change Flag'));
      attnBtn.addEventListener('click', function () { openClientAttentionModal(c, function () { renderClientDetail(id); }); });
      headActions.appendChild(attnBtn);
    }
    if (isAdmin()) {
      var toggleBtn = el('button', 'btn btn-outline btn-sm'); toggleBtn.type = 'button';
      toggleBtn.textContent = c.is_active ? 'Deactivate' : 'Reactivate';
      toggleBtn.addEventListener('click', async function () {
        var res = await sb.from('clients').update({ is_active: !c.is_active }).eq('id', c.id);
        if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
        await loadClients();
        renderClientDetail(id);
      });
      headActions.appendChild(toggleBtn);
    }
    card.appendChild(headActions);
    main.appendChild(card);

    var openWork = work.filter(function (w) { return w.status !== 'completed'; });
    var completedWork = work.filter(function (w) { return w.status === 'completed'; }).slice(0, 15);

    // ---- Active Services (recurring subscriptions — "Create This Period's
    // Work" is a manual one-click bridge, not automatic generation) ----
    var svcCard = el('div', 'card');
    var svcH2 = el('h2'); svcH2.appendChild(icon('flag')); svcH2.appendChild(document.createTextNode('Active Services')); svcCard.appendChild(svcH2);
    if (!services.length) {
      var noSvc = el('p', 'desc'); noSvc.textContent = 'No services set up for this client yet.'; svcCard.appendChild(noSvc);
    }
    // Client-service write access is admin-only (client_services RLS) —
    // staff (and reviewers) can see the list but not toggle/add. Tightened
    // 2026-08-12 from admin/reviewer at explicit request; see
    // supabase/migrations/20260811090600_client_services.sql.
    var canManageServices = isAdmin();
    services.forEach(function (s) {
      var tmpl = s.service_templates;
      var row = el('div', 'service-row' + (s.is_active ? '' : ' is-inactive'));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = s.is_active;
      if (canManageServices) {
        cb.addEventListener('change', async function () {
          var res = await sb.from('client_services').update({ is_active: cb.checked }).eq('id', s.id);
          if (res.error) { toast('Could not update: ' + res.error.message, true); cb.checked = !cb.checked; return; }
          row.classList.toggle('is-inactive', !cb.checked);
        });
      } else {
        cb.disabled = true;
      }
      row.appendChild(cb);
      var body = el('div', 'body');
      var title = el('div', 'title'); title.textContent = tmpl ? tmpl.title : 'Unknown service';
      body.appendChild(title);
      // Template-derived configuration (frequency/submission/deadline
      // rule) — not independently settable per client-service, so shown
      // read-only here; edit the template itself to change these.
      if (tmpl) {
        var tmplMeta = el('div', 'meta');
        var tmplBits = [tmpl.category, tmpl.recurrence === 'none' ? 'One-off' : tmpl.recurrence.charAt(0).toUpperCase() + tmpl.recurrence.slice(1)];
        if (tmpl.requires_submission) tmplBits.push('Requires submission');
        var tmplRule = activeDeadlineRuleFor(tmpl.id);
        if (tmplRule) tmplBits.push('Filing day ' + tmplRule.filing_deadline_day + (tmpl.internal_offset_days != null ? ' (internal -' + tmpl.internal_offset_days + 'd)' : ''));
        else if (tmpl.requires_external_deadline) tmplBits.push('Filing deadline requires verification');
        tmplMeta.textContent = tmplBits.join(' · ');
        body.appendChild(tmplMeta);
      }
      var meta = el('div', 'meta');
      var metaBits = [];
      metaBits.push(s.assignee_id ? 'Assignee: ' + profileName(s.assignee_id) : 'No assignee');
      metaBits.push(s.reviewer_id ? 'Reviewer: ' + profileName(s.reviewer_id) : 'No reviewer');
      if (s.start_period) metaBits.push('Since ' + s.start_period);
      if (s.end_period) metaBits.push('Until ' + s.end_period);
      meta.textContent = metaBits.join(' · ');
      body.appendChild(meta);
      row.appendChild(body);
      // Creating this period's work is ordinary work-creation, not a
      // service-management action — openNewWorkModal already locks the
      // assignee to self for non-reviewer/admin callers, so this stays
      // available to everyone.
      var createBtn = el('button', 'btn btn-outline btn-sm'); createBtn.type = 'button'; createBtn.textContent = 'Create This Period’s Work';
      createBtn.addEventListener('click', function () {
        openNewWorkModal({ clientId: id, templateId: s.service_template_id, assigneeId: s.assignee_id, reviewerId: s.reviewer_id });
      });
      row.appendChild(createBtn);
      if (canManageServices) {
        var editSvcBtn = el('button', 'btn btn-outline btn-sm'); editSvcBtn.type = 'button'; editSvcBtn.textContent = 'Edit';
        editSvcBtn.addEventListener('click', function () { openEditServiceModal(s, function () { renderClientDetail(id); }); });
        row.appendChild(editSvcBtn);
      }
      svcCard.appendChild(row);
    });

    if (canManageServices) {
      var addSvcRow = el('div'); addSvcRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:flex-end;';
      var svcTemplateSel = el('select'); svcTemplateSel.style.flex = '1'; svcTemplateSel.style.minWidth = '160px';
      var activeTemplates = state.templates.filter(function (t) { return t.is_active; });
      activeTemplates.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
        .forEach(function (t) { svcTemplateSel.appendChild(new Option(t.title, t.id)); });
      var svcAssigneeSel = el('select'); svcAssigneeSel.style.width = 'auto';
      svcAssigneeSel.appendChild(new Option('— Assignee —', ''));
      state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { svcAssigneeSel.appendChild(new Option(p.full_name, p.id)); });
      var svcReviewerSel = el('select'); svcReviewerSel.style.width = 'auto';
      svcReviewerSel.appendChild(new Option('— Reviewer —', ''));
      state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { svcReviewerSel.appendChild(new Option(p.full_name, p.id)); });
      var svcStartInput = el('input'); svcStartInput.type = 'text'; svcStartInput.placeholder = 'Start period (optional)'; svcStartInput.style.width = 'auto';
      var svcEndInput = el('input'); svcEndInput.type = 'text'; svcEndInput.placeholder = 'End period (optional)'; svcEndInput.style.width = 'auto';
      // Handbook Task 13: the Gregorian dates that actually gate
      // generation — start_period/end_period above stay purely
      // cosmetic labels, unchanged. Leaving these blank means
      // unrestricted, same as every service before this task.
      var svcStartDateInput = el('input'); svcStartDateInput.type = 'date'; svcStartDateInput.title = 'Effective start date (optional) — generation skips this service before this date'; svcStartDateInput.style.width = 'auto';
      var svcEndDateInput = el('input'); svcEndDateInput.type = 'date'; svcEndDateInput.title = 'Effective end date (optional) — generation skips this service after this date'; svcEndDateInput.style.width = 'auto';
      var addSvcBtn = el('button', 'btn btn-outline btn-sm'); addSvcBtn.type = 'button'; addSvcBtn.textContent = 'Add Service';
      addSvcBtn.addEventListener('click', async function () {
        if (!svcTemplateSel.value) { toast('Create a template first under Templates.', true); return; }
        // Fast, friendly check for the common case — the real guarantee
        // is the client_services_active_unique partial index (same
        // pattern as the work_items duplicate-period constraint), so
        // this can't actually be bypassed even if this check were
        // removed; it just avoids a raw constraint-violation error.
        var dupRes = await sb.from('client_services').select('id')
          .eq('client_id', id).eq('service_template_id', svcTemplateSel.value).eq('is_active', true).limit(1);
        if (dupRes.data && dupRes.data.length) {
          var dupTmpl = templateById(svcTemplateSel.value);
          toast('This client already has an active ' + (dupTmpl ? dupTmpl.title : 'service') + ' subscription.', true);
          return;
        }
        addSvcBtn.disabled = true;
        var res = await sb.from('client_services').insert({
          client_id: id,
          service_template_id: svcTemplateSel.value,
          assignee_id: svcAssigneeSel.value || null,
          reviewer_id: svcReviewerSel.value || null,
          start_period: svcStartInput.value.trim() || null,
          end_period: svcEndInput.value.trim() || null,
          start_date: svcStartDateInput.value || null,
          end_date: svcEndDateInput.value || null,
        });
        addSvcBtn.disabled = false;
        if (res.error) { toast('Could not add service: ' + res.error.message, true); return; }
        toast('Service added.');
        renderClientDetail(id);
      });
      if (!activeTemplates.length) {
        var noTmpl = el('p', 'desc'); noTmpl.textContent = 'Create an active service template first (under Templates) before adding active services.'; svcCard.appendChild(noTmpl);
      } else {
        addSvcRow.appendChild(svcTemplateSel); addSvcRow.appendChild(svcAssigneeSel); addSvcRow.appendChild(svcReviewerSel);
        addSvcRow.appendChild(svcStartInput); addSvcRow.appendChild(svcEndInput);
        addSvcRow.appendChild(svcStartDateInput); addSvcRow.appendChild(svcEndDateInput);
        addSvcRow.appendChild(addSvcBtn);
        svcCard.appendChild(addSvcRow);
      }
    }
    main.appendChild(svcCard);

    // ---- Current Work — compact Service/Period/Status/Deadline table ----
    var workCard = el('div', 'card');
    var workHead = el('div', 'page-head'); workHead.style.marginBottom = '10px';
    var workH2 = el('h2'); workH2.appendChild(icon('clipboard')); workH2.appendChild(document.createTextNode('Current Work')); workHead.appendChild(workH2);
    var newWorkBtn = el('button', 'btn btn-outline btn-sm'); newWorkBtn.type = 'button'; newWorkBtn.appendChild(icon('plus')); newWorkBtn.appendChild(document.createTextNode('New Work'));
    newWorkBtn.addEventListener('click', function () { openNewWorkModal({ clientId: id }); });
    workHead.appendChild(newWorkBtn);
    workCard.appendChild(workHead);
    if (!openWork.length) {
      var noOpen = el('p', 'desc'); noOpen.textContent = 'No open work for this client.'; workCard.appendChild(noOpen);
    } else {
      workCard.appendChild(clientWorkTable(openWork));
    }
    main.appendChild(workCard);

    // ---- Upcoming Deadlines — the urgent subset of Current Work, not a
    // duplicate list: overdue or due within a week, so a compliance
    // reviewer can tell what needs attention without scanning the whole
    // table above. ----
    var horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
    var upcoming = openWork.filter(function (w) {
      var due = effectiveDue(w);
      if (!due) return false;
      return isOverdue(w) || new Date(due + 'T00:00:00') <= horizon;
    });
    if (upcoming.length) {
      var upcomingCard = el('div', 'card');
      var upcomingH2 = el('h2'); upcomingH2.appendChild(icon('calendar')); upcomingH2.appendChild(document.createTextNode('Upcoming Deadlines')); upcomingCard.appendChild(upcomingH2);
      upcomingCard.appendChild(clientWorkTable(upcoming));
      main.appendChild(upcomingCard);
    }

    // ---- Waiting for Client ----
    var waiting = openWork.filter(function (w) { return w.status === 'waiting_for_client'; });
    if (waiting.length) {
      var waitingSummaries = await loadWaitingSummaries(waiting.map(function (w) { return w.id; }));
      var outCard = el('div', 'card');
      var outH2 = el('h2'); outH2.appendChild(icon('alert')); outH2.appendChild(document.createTextNode('Waiting for Client')); outCard.appendChild(outH2);
      waiting.forEach(function (w) {
        var row = el('div', 'attention-row reason-waiting outstanding-row');
        row.addEventListener('click', function () { gotoWork(w.id); });
        var body = el('div', 'body');
        var svc = el('div', 'svc'); svc.style.color = 'var(--navy-950)'; svc.style.fontWeight = '700';
        var tmpl = templateById(w.service_template_id);
        svc.textContent = (tmpl ? tmpl.title : w.title) + (w.period ? ' · ' + w.period : '');
        var reasonEl = el('div', 'reason');
        var summary = waitingSummaries[w.id];
        reasonEl.textContent = (summary ? 'Waiting for ' + summary : 'Waiting for client') + (w.waiting_since ? ', requested ' + fmtDate(w.waiting_since) : '');
        body.appendChild(svc); body.appendChild(reasonEl);
        row.appendChild(body);
        var action = el('div', 'action'); action.textContent = 'Follow up →';
        row.appendChild(action);
        outCard.appendChild(row);
      });
      main.appendChild(outCard);
    }

    // ---- Recently Completed ----
    if (completedWork.length) {
      var completedCard = el('div', 'card');
      var completedH2 = el('h2'); completedH2.appendChild(icon('check')); completedH2.appendChild(document.createTextNode('Recently Completed')); completedCard.appendChild(completedH2);
      completedCard.appendChild(clientWorkTable(completedWork));
      main.appendChild(completedCard);
    }

    // ---- Notes ---- (client-info edit stays admin-only, same as the
    // Edit button above; staff see notes but can't change them)
    var notesCard = el('div', 'card');
    var notesH2 = el('h2'); notesH2.textContent = 'Notes'; notesCard.appendChild(notesH2);
    if (isAdmin()) {
      var notesInput = el('textarea'); notesInput.rows = 3; notesInput.value = c.notes || '';
      notesCard.appendChild(notesInput);
      var saveNotesBtn = el('button', 'btn btn-outline btn-sm'); saveNotesBtn.type = 'button'; saveNotesBtn.textContent = 'Save Notes'; saveNotesBtn.style.marginTop = '10px';
      saveNotesBtn.addEventListener('click', async function () {
        saveNotesBtn.disabled = true;
        var res = await sb.from('clients').update({ notes: notesInput.value.trim() || null }).eq('id', c.id);
        saveNotesBtn.disabled = false;
        if (res.error) { toast('Could not save notes: ' + res.error.message, true); return; }
        c.notes = notesInput.value.trim() || null;
        toast('Notes saved.');
      });
      notesCard.appendChild(saveNotesBtn);
    } else {
      var notesP = el('p', 'desc'); notesP.textContent = c.notes || 'No notes.'; notesCard.appendChild(notesP);
    }
    main.appendChild(notesCard);
  }

  // Admin-only (matches canManageServices in renderClientDetail — this is
  // only ever opened from a button that's already gated). Deliberately
  // doesn't allow changing the service template itself: that's really
  // "a different service," not an edit — deactivate this one and add a
  // fresh one instead, same as how switching a work item's template
  // isn't supported either.
  function openEditServiceModal(s, onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Edit Service';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var assigneeSel = el('select');
    assigneeSel.appendChild(new Option('— No assignee —', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
    assigneeSel.value = s.assignee_id || '';
    wrap.appendChild(field('Default Assignee', assigneeSel));

    var reviewerSel = el('select');
    reviewerSel.appendChild(new Option('— No reviewer —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
    reviewerSel.value = s.reviewer_id || '';
    wrap.appendChild(field('Default Reviewer', reviewerSel));

    var startInput = el('input'); startInput.type = 'text'; startInput.value = s.start_period || ''; startInput.placeholder = 'e.g. Shrawan 2083';
    wrap.appendChild(field('Start Period (optional)', startInput));
    var endInput = el('input'); endInput.type = 'text'; endInput.value = s.end_period || ''; endInput.placeholder = 'e.g. Ashad 2084 — leave blank if ongoing';
    wrap.appendChild(field('End Period (optional)', endInput));

    // Handbook Task 13: the Gregorian dates that actually gate
    // generation, independent of the free-text labels above (which stay
    // cosmetic). Leaving both blank keeps this service unrestricted.
    var startDateInput = el('input'); startDateInput.type = 'date'; startDateInput.value = s.start_date || '';
    wrap.appendChild(field('Effective Start Date (optional)', startDateInput));
    var endDateInput = el('input'); endDateInput.type = 'date'; endDateInput.value = s.end_date || '';
    wrap.appendChild(field('Effective End Date (optional) — leave blank if ongoing', endDateInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', async function () {
      if (startDateInput.value && endDateInput.value && endDateInput.value < startDateInput.value) {
        toast('Effective End Date cannot be before Effective Start Date.', true);
        return;
      }
      saveBtn.disabled = true;
      var res = await sb.from('client_services').update({
        assignee_id: assigneeSel.value || null,
        reviewer_id: reviewerSel.value || null,
        start_period: startInput.value.trim() || null,
        end_period: endInput.value.trim() || null,
        start_date: startDateInput.value || null,
        end_date: endDateInput.value || null,
      }).eq('id', s.id);
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      closeModal();
      toast('Service updated.');
      onDone();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Passwords are fetched decrypted from the get_client_credentials RPC
  // (which itself checks the caller is admin/reviewer before decrypting —
  // see the SQL) but stay masked on screen until explicitly revealed, same
  // convention as a real password manager, so a shoulder-surf or screen
  // share doesn't expose them by default.
  async function openClientCredentialsModal(c) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = c.name + ' — Credentials';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var p = el('p', 'desc');
    p.textContent = 'Portal logins for this client (IRD, OCR, banking, etc.) — visible only to admins and reviewers.';
    wrap.appendChild(p);

    var listWrap = el('div');
    wrap.appendChild(listWrap);

    async function refreshList() {
      clear(listWrap);
      var loading = el('p', 'desc'); loading.textContent = 'Loading…'; listWrap.appendChild(loading);
      // Metadata only — no decrypted password. The password for a given
      // credential is fetched separately, only when Show is clicked (see
      // the reveal button below).
      var res = await sb.rpc('list_client_credentials', { p_client_id: c.id });
      clear(listWrap);
      if (res.error) { toast('Could not load credentials: ' + res.error.message, true); return; }
      var creds = res.data || [];
      if (!creds.length) {
        var empty = el('p', 'desc'); empty.textContent = 'No credentials stored yet.'; listWrap.appendChild(empty);
      }
      creds.forEach(function (cred) {
        var row = el('div', 'cred-row');
        var rHead = el('div', 'cred-head');
        var label = el('span', 'cred-label'); label.textContent = cred.label;
        var delBtn = el('button', 'btn btn-outline btn-sm'); delBtn.type = 'button'; delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async function () {
          if (!window.confirm('Delete the "' + cred.label + '" credential? This can\'t be undone.')) return;
          var delRes = await sb.rpc('delete_client_credential', { p_id: cred.id });
          if (delRes.error) { toast('Could not delete: ' + delRes.error.message, true); return; }
          toast('Credential deleted.');
          refreshList();
        });
        rHead.appendChild(label); rHead.appendChild(delBtn);
        row.appendChild(rHead);

        if (cred.username) {
          var uField = el('div', 'cred-field');
          uField.appendChild(icon('user'));
          var uCode = el('code'); uCode.textContent = cred.username;
          uField.appendChild(document.createTextNode('Username: ')); uField.appendChild(uCode);
          row.appendChild(uField);
        }

        var pField = el('div', 'cred-field');
        pField.appendChild(icon('idcard'));
        var pCode = el('code'); pCode.textContent = '••••••••';
        var revealBtn = el('button', 'btn btn-outline btn-sm'); revealBtn.type = 'button'; revealBtn.textContent = 'Show';
        revealBtn.style.padding = '3px 10px'; revealBtn.style.fontSize = '.76rem';
        var revealed = false;
        var fetchedPassword = null;
        revealBtn.addEventListener('click', async function () {
          if (revealed) {
            revealed = false;
            pCode.textContent = '••••••••';
            revealBtn.textContent = 'Show';
            return;
          }
          if (fetchedPassword === null) {
            revealBtn.disabled = true;
            var revealRes = await sb.rpc('reveal_client_credential', { p_id: cred.id });
            revealBtn.disabled = false;
            if (revealRes.error) { toast('Could not reveal password: ' + revealRes.error.message, true); return; }
            fetchedPassword = revealRes.data;
          }
          revealed = true;
          pCode.textContent = fetchedPassword;
          revealBtn.textContent = 'Hide';
        });
        pField.appendChild(document.createTextNode('Password: ')); pField.appendChild(pCode); pField.appendChild(revealBtn);
        row.appendChild(pField);

        if (cred.notes) { var notesEl = el('div', 'cred-notes'); notesEl.textContent = cred.notes; row.appendChild(notesEl); }
        listWrap.appendChild(row);
      });
    }
    await refreshList();

    var addHead = el('label', 'block-label'); addHead.style.cssText = 'display:block;font-weight:700;font-size:.95rem;color:var(--navy-900);margin:18px 0 6px;';
    addHead.textContent = 'Add a credential';
    wrap.appendChild(addHead);

    var labelInput = el('input'); labelInput.type = 'text'; labelInput.placeholder = 'e.g. IRD Portal, OCR Portal, Bank Login';
    wrap.appendChild(field('Label', labelInput));
    var userInput = el('input'); userInput.type = 'text';
    wrap.appendChild(field('Username (optional)', userInput));
    var passInput = el('input'); passInput.type = 'password'; passInput.placeholder = 'Stored encrypted';
    wrap.appendChild(field('Password', passInput));
    var notesInput = el('textarea'); notesInput.rows = 2;
    wrap.appendChild(field('Notes (optional)', notesInput));

    var actions = el('div', 'modal-actions');
    var addBtn = el('button', 'btn'); addBtn.type = 'button'; addBtn.textContent = 'Add Credential';
    addBtn.addEventListener('click', async function () {
      if (!labelInput.value.trim() || !passInput.value) { toast('Label and password are both required.', true); return; }
      addBtn.disabled = true;
      var res = await sb.rpc('add_client_credential', {
        p_client_id: c.id,
        p_label: labelInput.value.trim(),
        p_username: userInput.value.trim() || null,
        p_password: passInput.value,
        p_notes: notesInput.value.trim() || null,
      });
      addBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      labelInput.value = ''; userInput.value = ''; passInput.value = ''; notesInput.value = '';
      toast('Credential saved.');
      refreshList();
    });
    actions.appendChild(addBtn);
    wrap.appendChild(actions);

    openModal(wrap);
  }

  // existing (optional): a client row to edit in place instead of creating
  // a new one — used by the "Edit" button on the Client Detail screen.
  // Human-controlled only — nothing here is computed from overdue counts,
  // waiting-too-long items, or any other metric. Reason is required for
  // either flagged level and cleared automatically when set back to
  // Normal; who/when is recorded on every save via set_client_attention()
  // regardless of direction (flagging OR clearing), not just the first.
  function openClientAttentionModal(c, onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Change Attention Flag — ' + c.name;
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var levelSel = el('select');
    levelSel.appendChild(new Option('Normal', 'normal'));
    levelSel.appendChild(new Option('Needs Attention', 'needs_attention'));
    levelSel.appendChild(new Option('High Attention', 'high_attention'));
    levelSel.value = c.attention_level || 'normal';
    wrap.appendChild(field('Attention Level', levelSel));

    var reasonInput = el('textarea'); reasonInput.rows = 3;
    reasonInput.value = c.attention_reason || '';
    reasonInput.placeholder = 'Short reason (required unless Normal)';
    var reasonField = field('Reason', reasonInput);
    wrap.appendChild(reasonField);
    function syncReasonRequired() { reasonField.classList.toggle('hidden', levelSel.value === 'normal'); }
    levelSel.addEventListener('change', syncReasonRequired);
    syncReasonRequired();

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function () {
      if (levelSel.value !== 'normal' && !reasonInput.value.trim()) {
        toast('Give a short reason for this flag.', true);
        return;
      }
      saveBtn.disabled = true;
      var res = await sb.rpc('set_client_attention', {
        p_client_id: c.id,
        p_level: levelSel.value,
        p_reason: reasonInput.value.trim() || null,
      });
      saveBtn.disabled = false;
      if (res.error) { toast('Could not update flag: ' + res.error.message, true); return; }
      await loadClients();
      closeModal();
      toast('Attention flag updated.');
      onDone();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  function openClientFormModal(existing) {
    var isEdit = !!existing;
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = isEdit ? 'Edit Client' : 'New Client';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var nameInput = el('input'); nameInput.type = 'text'; nameInput.value = isEdit ? existing.name : '';
    wrap.appendChild(field('Client / Business Name', nameInput));

    var typeSel = el('select');
    // Same categories as the public site's contact form (content/site.yaml
    // businessTypeOptions) so a client's type reads the same way whether
    // it came from an inquiry or was entered here directly.
    ['Not yet registered', 'Sole Proprietorship (Firm)', 'Partnership', 'Private Limited Company', 'NGO / Non-profit', 'Other']
      .forEach(function (t) { typeSel.appendChild(new Option(t, t)); });
    if (isEdit && existing.business_type) typeSel.value = existing.business_type;
    wrap.appendChild(field('Business Type', typeSel));

    var panInput = el('input'); panInput.type = 'text'; panInput.placeholder = 'e.g. 609876543'; panInput.value = isEdit ? (existing.pan_vat || '') : '';
    wrap.appendChild(field('PAN / VAT Number (optional)', panInput));

    var contactInput = el('input'); contactInput.type = 'text'; contactInput.value = isEdit ? (existing.contact_person || '') : '';
    wrap.appendChild(field('Contact Person (optional)', contactInput));

    var phoneInput = el('input'); phoneInput.type = 'tel'; phoneInput.value = isEdit ? (existing.phone || '') : '';
    wrap.appendChild(field('Phone (optional)', phoneInput));

    var emailInput = el('input'); emailInput.type = 'email'; emailInput.value = isEdit ? (existing.email || '') : '';
    wrap.appendChild(field('Email (optional)', emailInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Client';
    saveBtn.addEventListener('click', async function () {
      if (!nameInput.value.trim()) { toast('Give the client a name.', true); return; }
      var patch = {
        name: nameInput.value.trim(),
        business_type: typeSel.value,
        pan_vat: panInput.value.trim() || null,
        contact_person: contactInput.value.trim() || null,
        phone: phoneInput.value.trim() || null,
        email: emailInput.value.trim() || null,
      };
      saveBtn.disabled = true;
      var res = isEdit
        ? await sb.from('clients').update(patch).eq('id', existing.id)
        : await sb.from('clients').insert(patch).select().single();
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save client: ' + res.error.message, true); return; }
      closeModal();
      toast(isEdit ? 'Client updated.' : 'Client created.');
      await loadClients();
      var targetId = isEdit ? existing.id : res.data.id;
      // If we're already sitting on this client's detail page, changing the
      // hash to the same value wouldn't fire hashchange — re-render directly.
      if (location.hash.replace(/^#/, '') === 'client/' + targetId) { renderClientDetail(targetId); }
      else { gotoClient(targetId); }
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // ============================================================
  // Admin: Templates (service definitions — recurring work generation
  // from these on a schedule is a later addition, not built yet)
  // ============================================================
  async function renderTemplates(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Templates'; head.appendChild(h1);
    if (isAdmin()) {
      var genBtn = el('button', 'btn btn-outline btn-sm'); genBtn.type = 'button'; genBtn.appendChild(icon('flag')); genBtn.appendChild(document.createTextNode('Generate Period Work'));
      genBtn.addEventListener('click', openGeneratePeriodModal);
      head.appendChild(genBtn);
      var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Template'));
      addBtn.addEventListener('click', openNewTemplateModal);
      head.appendChild(addBtn);
    }
    main.appendChild(head);

    // Task 34: this page holds two genuinely different systems, easy to
    // conflate since they share one screen -- a template's own fields
    // (checklist/recurrence/assignees, edited freely, no citation needed)
    // versus each service's governed statutory deadline rule (source-
    // cited, verified-date, admin-only, full superseding history --
    // "Manage Deadline Rule" on a template card, a stricter system on
    // purpose). Workflow Settings (day-count thresholds like "warn N days
    // before due") is a third, separate thing entirely, on its own page.
    // None of the three ever rewrites already-generated work: a template
    // edit only changes what NEW work gets created from it from now on
    // (see openEditTemplateModal's own comment); a new deadline rule only
    // changes what a FUTURE period generation computes.
    var note = el('div', 'card');
    var p = el('p', 'desc');
    p.style.margin = '0';
    p.textContent = 'Templates describe recurring work (e.g. "VAT Return"). "Use This Template" fills in one work item at a time; "Generate Period Work" fills in a whole period at once from every client\'s Active Services. A template\'s statutory filing deadline is governed separately, per service, via "Manage Deadline Rule" below — source-cited and verified, never a guess. Workflow Settings (day-count thresholds, not deadlines) lives on its own Settings page. Editing any of these never rewrites work already generated — only what gets created from this point on.';
    note.appendChild(p);
    main.appendChild(note);

    if (isAdmin()) await renderAutoGenerateCard(main);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var res = await sb.from('service_templates').select('*, service_template_items(*)').order('title');
    // Guarded rather than a bare removeChild: if a hash navigation lands
    // (e.g. a direct/shared link, or a notification click) before this
    // page's own initial fetch resolves, a newer render may have already
    // cleared #main out from under this one -- an unguarded removeChild
    // on a node that's no longer main's child throws "not a child of
    // this node" (found via Handbook Task 18's direct-link Playwright
    // test, a real race, not new since only that test happened to await
    // an immediate post-login hash change and check for console errors).
    if (loading.parentNode) loading.parentNode.removeChild(loading);
    if (res.error) { toast('Could not load templates: ' + res.error.message, true); return; }
    var templates = res.data || [];
    if (!templates.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('flag')); empty.appendChild(document.createTextNode('No templates yet.'));
      main.appendChild(empty);
      return;
    }

    TEMPLATE_CATEGORIES.forEach(function (cat) {
      var inCat = templates.filter(function (t) { return t.category === cat; });
      if (!inCat.length) return;
      var h2 = el('div', 'section-h'); h2.style.marginTop = '22px'; h2.textContent = cat;
      main.appendChild(h2);
      inCat.forEach(function (t) { main.appendChild(templateCard(t)); });
    });
    // Anything with an unrecognized/legacy category still shows up, grouped last.
    var other = templates.filter(function (t) { return TEMPLATE_CATEGORIES.indexOf(t.category) === -1; });
    if (other.length) {
      var h2b = el('div', 'section-h'); h2b.style.marginTop = '22px'; h2b.textContent = 'Other';
      main.appendChild(h2b);
      other.forEach(function (t) { main.appendChild(templateCard(t)); });
    }
  }

  // A check that runs whenever an admin opens Work Desk (see enterApp()
  // in staff.js) generates any missing work for whatever period is set
  // here, per recurrence type — the period name always comes from a
  // person, never computed, since this app has no BS-calendar conversion
  // table to compute it safely. Update these fields whenever the real
  // period for that cadence rolls over; the next admin login picks it up.
  // Split into three period types (2026-08-12) since monthly/quarterly/
  // yearly services advance at different rates and can't share one
  // "current period" value.
  //
  // Handbook Task 11: each setting's value is now a small JSON object
  // ({"label":"...","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}) instead of
  // a bare label string — app_settings.value stays a plain text column
  // (no schema change needed), it just now carries the Gregorian date
  // range alongside the label, since generate_period_work_for_period
  // requires both explicitly (see 20260823090000_normalize_generation_
  // periods.sql) and can no longer derive them from today's date.
  var AUTO_GENERATE_KEYS = [
    ['auto_generate_period_monthly', 'Current Monthly Period', 'e.g. Shrawan 2083'],
    ['auto_generate_period_quarterly', 'Current Quarterly Period', 'e.g. Q1 2083/84'],
    ['auto_generate_period_yearly', 'Current Yearly Period', 'e.g. FY 2083/84'],
  ];
  function parseAutoGenerateValue(raw) {
    if (!raw) return { label: '', start: '', end: '' };
    try {
      var v = JSON.parse(raw);
      return { label: v.label || '', start: v.start || '', end: v.end || '' };
    } catch (e) {
      // Pre-Task-11 value: a bare label string, no date range yet. Kept
      // visible (not silently dropped) so the admin can see what was
      // there and fill in the now-required dates rather than losing the
      // label they'd already set.
      return { label: raw, start: '', end: '' };
    }
  }
  async function renderAutoGenerateCard(main) {
    var card = el('div', 'card');
    var h2 = el('h2'); h2.appendChild(icon('calendar')); h2.appendChild(document.createTextNode('Auto-Generate Periods')); card.appendChild(h2);
    var desc = el('p', 'desc');
    desc.textContent = 'When an admin opens Work Desk, work gets generated for every active service whose type matches a period set below. A label and both Gregorian dates are required to activate a type; leave all three blank to pause it. Existing work for the same client/service/period is always skipped, never duplicated or overwritten — changing a period here only affects what gets generated from now on, never what was already created.';
    card.appendChild(desc);

    var res = await sb.from('app_settings').select('*').in('key', AUTO_GENERATE_KEYS.map(function (k) { return k[0]; }));
    var settings = {};
    (res.data || []).forEach(function (row) { settings[row.key] = row.value; });

    AUTO_GENERATE_KEYS.forEach(function (k) {
      var key = k[0], label = k[1], placeholder = k[2];
      var current = parseAutoGenerateValue(settings[key]);
      var row = el('div'); row.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;';
      var labelInput = el('input'); labelInput.type = 'text'; labelInput.placeholder = placeholder; labelInput.value = current.label;
      var startInput = el('input'); startInput.type = 'date'; startInput.value = current.start;
      var endInput = el('input'); endInput.type = 'date'; endInput.value = current.end;
      row.appendChild(field(label, labelInput));
      // Task 35: two flex:1 date fields side by side don't fit at 320px;
      // wrap lets the second one drop to its own line instead of pushing
      // the page wider.
      var rangeRow = el('div'); rangeRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      var startWrap = el('div'); startWrap.style.flex = '1'; startWrap.appendChild(field('Period Start Date (Gregorian)', startInput));
      var endWrap = el('div'); endWrap.style.flex = '1'; endWrap.appendChild(field('Period End Date (Gregorian)', endInput));
      rangeRow.appendChild(startWrap); rangeRow.appendChild(endWrap);
      row.appendChild(rangeRow);
      var saveBtn = el('button', 'btn btn-outline btn-sm'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', async function () {
        var l = labelInput.value.trim(), s = startInput.value, e = endInput.value;
        var allBlank = !l && !s && !e;
        if (!allBlank && (!l || !s || !e)) {
          toast('Set a label and both dates to activate ' + label + ', or clear all three to pause it.', true);
          return;
        }
        if (!allBlank && e < s) {
          toast('Period End Date cannot be before Period Start Date.', true);
          return;
        }
        var value = allBlank ? null : JSON.stringify({ label: l, start: s, end: e });
        saveBtn.disabled = true;
        var updRes = await sb.from('app_settings').update({ value: value }).eq('key', key);
        saveBtn.disabled = false;
        if (updRes.error) { toast('Could not save: ' + updRes.error.message, true); return; }
        toast(allBlank ? label + ' paused (no period set).' : label + ' set to "' + l + '" (' + s + ' to ' + e + ').');
      });
      row.appendChild(saveBtn);
      card.appendChild(row);
    });
    main.appendChild(card);
  }

  function templateCard(t) {
    var card = el('div', 'card' + (t.is_active ? '' : ' is-inactive'));
    var h2 = el('h2'); h2.textContent = t.title + (t.is_active ? '' : ' — Inactive'); card.appendChild(h2);
    var rule = activeDeadlineRuleFor(t.id);
    var meta = el('p', 'desc');
    meta.textContent = (t.recurrence !== 'none' ? 'Recurs ' + t.recurrence : 'One-off') +
      (t.requires_submission ? ' · Includes a submission step' : '') +
      (t.default_assignee_id ? ' · Default assignee: ' + profileName(t.default_assignee_id) : '') +
      (rule ? ' · Filing due on day ' + rule.filing_deadline_day + ' of the month' : '') +
      (rule && t.internal_offset_days != null ? ' · Internal target ' + t.internal_offset_days + 'd before filing' : '');
    card.appendChild(meta);
    if (t.description) { var d = el('p'); d.textContent = t.description; card.appendChild(d); }
    // Handbook Task 12: every statutory deadline traces to a specific
    // approved rule, right here — its source citation and who verified
    // it, or a visible flag that none exists yet (never a silently
    // reused, unsourced number).
    if (t.requires_external_deadline) {
      var deadlineInfo = el('p', 'desc');
      if (rule) {
        deadlineInfo.innerHTML = '';
        deadlineInfo.appendChild(icon('calendar'));
        deadlineInfo.appendChild(document.createTextNode(
          ' Deadline rule: day ' + rule.filing_deadline_day + ' (' + rule.financial_year_label + ') — verified ' + fmtDate(rule.verified_date) +
          ' by ' + profileName(rule.verified_by) + ', source: ' + rule.source_title + (rule.source_url ? ' (' + rule.source_url + ')' : '')
        ));
      } else {
        deadlineInfo.style.color = 'var(--amber)';
        deadlineInfo.textContent = '⚠ No verified deadline rule yet — filing deadlines will not auto-generate for this service until one is added.';
      }
      card.appendChild(deadlineInfo);
    }
    var items = t.service_template_items || [];
    STAGES.forEach(function (stage) {
      var stageItems = items.filter(function (i) { return i.stage === stage; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
      if (!stageItems.length) return;
      var stageLabel = el('div', 'checklist-stage'); stageLabel.textContent = STAGE_LABELS[stage]; card.appendChild(stageLabel);
      var ul = el('ul'); ul.style.paddingLeft = '18px'; ul.style.listStyle = 'disc'; ul.style.margin = '0';
      stageItems.forEach(function (it) {
        var li = el('li');
        li.textContent = it.title + (it.is_required === false ? ' (Optional)' : '');
        ul.appendChild(li);
      });
      card.appendChild(ul);
    });
    var useBtn = el('button', 'btn btn-outline btn-sm');
    useBtn.type = 'button';
    useBtn.style.marginTop = '14px';
    useBtn.appendChild(icon('plus'));
    useBtn.appendChild(document.createTextNode('Use This Template'));
    useBtn.addEventListener('click', function () { openNewWorkModal({ templateId: t.id }); });
    card.appendChild(useBtn);
    if (isAdmin()) {
      var editBtn = el('button', 'btn btn-outline btn-sm'); editBtn.type = 'button';
      editBtn.style.marginTop = '14px'; editBtn.style.marginLeft = '8px'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { openEditTemplateModal(t); });
      card.appendChild(editBtn);

      if (t.requires_external_deadline) {
        var ruleBtn = el('button', 'btn btn-outline btn-sm'); ruleBtn.type = 'button';
        ruleBtn.style.marginTop = '14px'; ruleBtn.style.marginLeft = '8px'; ruleBtn.textContent = 'Manage Deadline Rule';
        ruleBtn.addEventListener('click', function () { openDeadlineRuleModal(t); });
        card.appendChild(ruleBtn);
      }

      var toggleBtn = el('button', 'btn btn-outline btn-sm'); toggleBtn.type = 'button';
      toggleBtn.style.marginTop = '14px'; toggleBtn.style.marginLeft = '8px';
      toggleBtn.textContent = t.is_active ? 'Deactivate' : 'Reactivate';
      toggleBtn.addEventListener('click', async function () {
        toggleBtn.disabled = true;
        var res = await sb.from('service_templates').update({ is_active: !t.is_active }).eq('id', t.id);
        toggleBtn.disabled = false;
        if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
        toast(t.is_active ? 'Template deactivated — it will no longer be offered for new work.' : 'Template reactivated.');
        render();
      });
      card.appendChild(toggleBtn);
    }
    return card;
  }

  // Handbook Task 12: the entire governed-deadline-rule surface for one
  // template — full history (so every filing deadline this app has ever
  // computed traces to a specific, dated, sourced rule/version) plus the
  // one and only way to add a new one. add_deadline_rule() itself
  // enforces admin-only, a required source_title, and a required
  // verified_date server-side — this form mirrors those same
  // requirements client-side just for a faster error message, not as the
  // real gate.
  function openDeadlineRuleModal(t) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Deadline Rule — ' + t.title;
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var history = deadlineRuleHistoryFor(t.id);
    if (history.length) {
      var histLabel = el('div', 'section-h'); histLabel.textContent = 'History'; wrap.appendChild(histLabel);
      var histList = el('div');
      history.forEach(function (r) {
        var row = el('div'); row.style.cssText = 'border-bottom:1px solid var(--border);padding:8px 0;font-size:.87rem;';
        var badge = el('span', 'badge badge-' + (r.status === 'active' ? 'approved' : 'completed'));
        badge.textContent = r.status === 'active' ? 'Active' : 'Superseded';
        badge.style.marginRight = '8px';
        row.appendChild(badge);
        row.appendChild(document.createTextNode(
          'Day ' + r.filing_deadline_day + ' · ' + r.financial_year_label +
          (r.effective_from || r.effective_to ? ' (' + (r.effective_from ? fmtDate(r.effective_from) : '…') + ' – ' + (r.effective_to ? fmtDate(r.effective_to) : '…') + ')' : '')
        ));
        var srcLine = el('div'); srcLine.style.cssText = 'color:var(--ink-soft);margin-top:2px;';
        srcLine.textContent = 'Source: ' + r.source_title + (r.source_page_section ? ', ' + r.source_page_section : '') +
          (r.source_reference ? ' (' + r.source_reference + ')' : '') +
          ' · Verified ' + fmtDate(r.verified_date) + ' by ' + profileName(r.verified_by);
        row.appendChild(srcLine);
        if (r.source_url) {
          var srcLink = el('div'); srcLink.style.cssText = 'color:var(--ink-soft);word-break:break-all;';
          srcLink.textContent = r.source_url;
          row.appendChild(srcLink);
        }
        histList.appendChild(row);
      });
      wrap.appendChild(histList);
    } else {
      var noHist = el('p', 'desc'); noHist.textContent = 'No deadline rule has ever been recorded for this service.';
      wrap.appendChild(noHist);
    }

    var formLabel = el('div', 'section-h'); formLabel.style.marginTop = '18px'; formLabel.textContent = 'Add / Replace Rule';
    wrap.appendChild(formLabel);
    var formNote = el('p', 'desc');
    formNote.textContent = 'DO NOT guess this from memory or a generic website — enter it only from an owner-approved primary source (Finance Act/IRD notice, confirmed with the firm owner). Saving this replaces whichever rule is currently active for future generation only — work items already generated keep the filing deadline they were created with, never silently updated to match a new rule.';
    wrap.appendChild(formNote);

    var fyInput = el('input'); fyInput.type = 'text'; fyInput.placeholder = 'e.g. FY 2082/83 onwards';
    wrap.appendChild(field('Financial Year / Effective Period Label', fyInput));
    var effFromInput = el('input'); effFromInput.type = 'date';
    wrap.appendChild(field('Effective From (optional)', effFromInput));
    var effToInput = el('input'); effToInput.type = 'date';
    wrap.appendChild(field('Effective To (optional)', effToInput));
    var dayInput = el('input'); dayInput.type = 'number'; dayInput.min = '1'; dayInput.max = '31'; dayInput.placeholder = 'e.g. 25';
    wrap.appendChild(field('Filing Deadline — day of month', dayInput));
    var sourceTitleInput = el('input'); sourceTitleInput.type = 'text'; sourceTitleInput.placeholder = 'e.g. Income Tax Act 2058, Finance Act 2082 amendment';
    wrap.appendChild(field('Source Title', sourceTitleInput));
    var sourceUrlInput = el('input'); sourceUrlInput.type = 'text'; sourceUrlInput.placeholder = 'https://... (optional)';
    wrap.appendChild(field('Source URL (optional)', sourceUrlInput));
    var sourceRefInput = el('input'); sourceRefInput.type = 'text'; sourceRefInput.placeholder = 'e.g. IRD Circular 2082/083-45 (optional)';
    wrap.appendChild(field('Source Reference (optional)', sourceRefInput));
    var sourcePageInput = el('input'); sourcePageInput.type = 'text'; sourcePageInput.placeholder = 'e.g. Page 12, Section 3.2 (optional)';
    wrap.appendChild(field('Source Page/Section (optional)', sourcePageInput));
    var verifiedDateInput = el('input'); verifiedDateInput.type = 'date'; verifiedDateInput.value = localDateStr();
    wrap.appendChild(field('Verified Date', verifiedDateInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Rule';
    saveBtn.addEventListener('click', async function () {
      if (!fyInput.value.trim()) { toast('Give the financial year / effective period a label.', true); return; }
      if (!dayInput.value.trim()) { toast('Set the filing deadline day of month.', true); return; }
      if (!sourceTitleInput.value.trim()) { toast('A source title is required — this cannot be saved without a citation.', true); return; }
      if (!verifiedDateInput.value) { toast('A verified date is required.', true); return; }
      saveBtn.disabled = true;
      var res = await sb.rpc('add_deadline_rule', {
        p_service_template_id: t.id,
        p_financial_year_label: fyInput.value.trim(),
        p_effective_from: effFromInput.value || null,
        p_effective_to: effToInput.value || null,
        p_filing_deadline_day: parseInt(dayInput.value, 10),
        p_source_title: sourceTitleInput.value.trim(),
        p_source_url: sourceUrlInput.value.trim() || null,
        p_source_reference: sourceRefInput.value.trim() || null,
        p_source_page_section: sourcePageInput.value.trim() || null,
        p_verified_date: verifiedDateInput.value,
      });
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save rule: ' + res.error.message, true); return; }
      await loadDeadlineRules();
      closeModal();
      toast('Deadline rule saved and is now active.');
      render();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Reusable checklist editor shared by New/Edit Template — one section per
  // stage (Preparation/Review/Submission), each item an editable title +
  // Required checkbox + Up/Down reorder + delete. Up/Down (not drag-and-
  // drop) per the task's own instruction: "Do not build drag-and-drop
  // unless already easy to support" — it wasn't, so this is the simple
  // alternative that still gives real reordering. getRows() reads the
  // live DOM order back out, so reordering needs no separate index state.
  function buildChecklistEditor(existingItems) {
    var wrap = el('div');
    var stageLists = {};
    STAGES.forEach(function (stage) {
      var stageWrap = el('div'); stageWrap.style.marginBottom = '14px';
      var label = el('div', 'checklist-stage'); label.textContent = STAGE_LABELS[stage];
      stageWrap.appendChild(label);
      var list = el('div');
      stageWrap.appendChild(list);
      stageLists[stage] = list;

      function addRow(title, isRequired) {
        var row = el('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
        var titleInput = el('input'); titleInput.type = 'text'; titleInput.value = title || ''; titleInput.style.flex = '1';
        var reqLabel = el('label'); reqLabel.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:.8rem;white-space:nowrap;width:auto;margin:0;';
        var reqCb = el('input'); reqCb.type = 'checkbox'; reqCb.checked = isRequired !== false; reqCb.style.width = 'auto';
        reqLabel.appendChild(reqCb); reqLabel.appendChild(document.createTextNode('Required'));
        var upBtn = el('button', 'btn btn-outline btn-sm'); upBtn.type = 'button'; upBtn.textContent = '↑'; upBtn.title = 'Move up';
        var downBtn = el('button', 'btn btn-outline btn-sm'); downBtn.type = 'button'; downBtn.textContent = '↓'; downBtn.title = 'Move down';
        var delBtn = el('button', 'btn btn-outline btn-sm'); delBtn.type = 'button'; delBtn.textContent = '×'; delBtn.title = 'Remove';
        upBtn.addEventListener('click', function () {
          var prev = row.previousElementSibling;
          if (prev) list.insertBefore(row, prev);
        });
        downBtn.addEventListener('click', function () {
          var next = row.nextElementSibling;
          if (next) list.insertBefore(next, row);
        });
        delBtn.addEventListener('click', function () { list.removeChild(row); });
        row.appendChild(titleInput); row.appendChild(reqLabel);
        row.appendChild(upBtn); row.appendChild(downBtn); row.appendChild(delBtn);
        row._titleInput = titleInput; row._reqCb = reqCb;
        list.appendChild(row);
      }

      (existingItems || []).filter(function (i) { return i.stage === stage; })
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .forEach(function (i) { addRow(i.title, i.is_required); });

      var addRowWrap = el('div'); addRowWrap.style.cssText = 'display:flex;gap:6px;margin-top:4px;';
      var newInput = el('input'); newInput.type = 'text'; newInput.placeholder = 'Add item…'; newInput.style.flex = '1';
      var addBtn = el('button', 'btn btn-outline btn-sm'); addBtn.type = 'button'; addBtn.textContent = 'Add';
      function commitAdd() {
        var v = newInput.value.trim();
        if (!v) return;
        addRow(v, true);
        newInput.value = '';
        newInput.focus();
      }
      addBtn.addEventListener('click', commitAdd);
      newInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); } });
      addRowWrap.appendChild(newInput); addRowWrap.appendChild(addBtn);
      stageWrap.appendChild(addRowWrap);

      wrap.appendChild(stageWrap);
    });

    function getRows() {
      var rows = [];
      STAGES.forEach(function (stage) {
        Array.prototype.forEach.call(stageLists[stage].children, function (row, i) {
          var title = row._titleInput.value.trim();
          if (!title) return;
          rows.push({ stage: stage, title: title, is_required: row._reqCb.checked, sort_order: i });
        });
      });
      return rows;
    }

    return { element: wrap, getRows: getRows };
  }

  function openNewTemplateModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Template';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text';
    wrap.appendChild(field('Title', titleInput));

    var catSel = el('select');
    TEMPLATE_CATEGORIES.forEach(function (c) { catSel.appendChild(new Option(c, c)); });
    wrap.appendChild(field('Category', catSel));

    var descInput = el('textarea'); descInput.rows = 2;
    wrap.appendChild(field('Description (optional)', descInput));

    var recurSel = el('select');
    [['none', 'One-off'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']]
      .forEach(function (r) { recurSel.appendChild(new Option(r[1], r[0])); });
    wrap.appendChild(field('Recurrence', recurSel));

    var submissionWrap = el('div', 'f');
    var submissionLabel = el('label');
    var submissionCb = el('input'); submissionCb.type = 'checkbox'; submissionCb.style.width = 'auto'; submissionCb.style.marginRight = '8px';
    submissionLabel.appendChild(submissionCb);
    submissionLabel.appendChild(document.createTextNode('Requires a submission step (adds "Ready to Submit" before Completed)'));
    submissionWrap.appendChild(submissionLabel);
    wrap.appendChild(submissionWrap);

    // Handbook Task 8: gates whether work created from this template must
    // pass through Ready for Review/Approved at all before Completed (or
    // Ready to Submit) — enforced by guard_work_item_update()'s transition
    // map, not just this checkbox. Defaults on, matching every template
    // that existed before this flag did.
    var reviewWrap = el('div', 'f');
    var reviewLabel = el('label');
    var reviewCb = el('input'); reviewCb.type = 'checkbox'; reviewCb.checked = true; reviewCb.style.width = 'auto'; reviewCb.style.marginRight = '8px';
    reviewLabel.appendChild(reviewCb);
    reviewLabel.appendChild(document.createTextNode('Requires review (adds "Ready for Review" / "Approved" before Completed)'));
    reviewWrap.appendChild(reviewLabel);
    wrap.appendChild(reviewWrap);

    var defaultAssigneeSel = el('select');
    defaultAssigneeSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { defaultAssigneeSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('Default Assignee (optional)', defaultAssigneeSel));

    var defaultReviewerSel = el('select');
    defaultReviewerSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { defaultReviewerSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('Default Reviewer (optional)', defaultReviewerSel));

    // Handbook Task 12: the statutory filing day-of-month is no longer set
    // here directly — a legal deadline needs a source citation and a
    // verified date, which this checkbox-and-number-field modal has no
    // room for, and typing a bare day-of-month in here with no
    // verification is exactly the "believable guess" this task exists to
    // close off. This checkbox only marks WHETHER the category has a
    // statutory deadline at all; the actual governed rule (day of month,
    // source, verified-by) is entered separately via "Manage Deadline
    // Rule" on the template card, once the template itself exists.
    var requiresExternalDeadlineWrap = el('div', 'f');
    var requiresExternalDeadlineLabel = el('label');
    var requiresExternalDeadlineCb = el('input'); requiresExternalDeadlineCb.type = 'checkbox'; requiresExternalDeadlineCb.style.width = 'auto'; requiresExternalDeadlineCb.style.marginRight = '8px';
    requiresExternalDeadlineLabel.appendChild(requiresExternalDeadlineCb);
    requiresExternalDeadlineLabel.appendChild(document.createTextNode('This service has a statutory filing deadline (govern it separately via "Manage Deadline Rule" after saving)'));
    requiresExternalDeadlineWrap.appendChild(requiresExternalDeadlineLabel);
    wrap.appendChild(requiresExternalDeadlineWrap);

    var internalOffsetInput = el('input'); internalOffsetInput.type = 'number'; internalOffsetInput.min = '0'; internalOffsetInput.placeholder = 'e.g. 3';
    // Pre-filled from Workflow Settings (V2 Task 18) as a starting
    // suggestion for a BRAND NEW template only — still fully editable/
    // clearable per template, and never touches any existing template's
    // own already-set internal_offset_days (Edit Template pre-fills from
    // the template's own value instead, unaffected by this setting).
    internalOffsetInput.value = String(state.settings.default_internal_offset_days);
    wrap.appendChild(field('Internal Deadline — days before filing (optional)', internalOffsetInput));

    var checklistEditor = buildChecklistEditor([]);
    wrap.appendChild(field('Checklist (optional)', checklistEditor.element));

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Template';
    createBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the template a title.', true); return; }
      var res = await sb.from('service_templates').insert({
        title: titleInput.value.trim(),
        category: catSel.value,
        description: descInput.value.trim() || null,
        recurrence: recurSel.value,
        requires_submission: submissionCb.checked,
        requires_review: reviewCb.checked,
        default_assignee_id: defaultAssigneeSel.value || null,
        default_reviewer_id: defaultReviewerSel.value || null,
        requires_external_deadline: requiresExternalDeadlineCb.checked,
        internal_offset_days: internalOffsetInput.value.trim() ? parseInt(internalOffsetInput.value, 10) : null,
      }).select().single();
      if (res.error) { toast('Could not create template: ' + res.error.message, true); return; }
      var rows = checklistEditor.getRows().map(function (r) {
        return { template_id: res.data.id, stage: r.stage, title: r.title, sort_order: r.sort_order, is_required: r.is_required };
      });
      if (rows.length) {
        var itemsRes = await sb.from('service_template_items').insert(rows);
        if (itemsRes.error) toast('Template created, but checklist items failed: ' + itemsRes.error.message, true);
      }
      closeModal();
      toast('Template created.');
      render();
    });
    actions.appendChild(createBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // Mirrors openNewTemplateModal's fields exactly (same six core fields
  // plus the shared checklist editor), pre-filled from an existing
  // template, plus an Active checkbox. Saving never touches already-
  // generated work_items/work_checklist_items rows — those were copied at
  // generation time (see _generate_period_work_core), not a live
  // reference — so editing a template here cannot rewrite historical
  // Work, only what gets generated from this point on. The checklist is
  // saved by replacing service_template_items wholesale (delete all rows
  // for this template, insert the current editor state) rather than
  // diffing — simpler, and safe because the copy already happened for any
  // past work item.
  function openEditTemplateModal(t) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Edit Template';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text'; titleInput.value = t.title;
    wrap.appendChild(field('Title', titleInput));

    var catSel = el('select');
    TEMPLATE_CATEGORIES.forEach(function (c) { catSel.appendChild(new Option(c, c)); });
    catSel.value = t.category;
    wrap.appendChild(field('Category', catSel));

    var descInput = el('textarea'); descInput.rows = 2; descInput.value = t.description || '';
    wrap.appendChild(field('Description (optional)', descInput));

    var recurSel = el('select');
    [['none', 'One-off'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']]
      .forEach(function (r) { recurSel.appendChild(new Option(r[1], r[0])); });
    recurSel.value = t.recurrence;
    wrap.appendChild(field('Recurrence', recurSel));

    var activeWrap = el('div', 'f');
    var activeLabel = el('label');
    var activeCb = el('input'); activeCb.type = 'checkbox'; activeCb.checked = t.is_active; activeCb.style.width = 'auto'; activeCb.style.marginRight = '8px';
    activeLabel.appendChild(activeCb);
    activeLabel.appendChild(document.createTextNode('Active (offered for new Work and Client Services)'));
    activeWrap.appendChild(activeLabel);
    wrap.appendChild(activeWrap);

    var submissionWrap = el('div', 'f');
    var submissionLabel = el('label');
    var submissionCb = el('input'); submissionCb.type = 'checkbox'; submissionCb.checked = t.requires_submission; submissionCb.style.width = 'auto'; submissionCb.style.marginRight = '8px';
    submissionLabel.appendChild(submissionCb);
    submissionLabel.appendChild(document.createTextNode('Requires a submission step (adds "Ready to Submit" before Completed)'));
    submissionWrap.appendChild(submissionLabel);
    wrap.appendChild(submissionWrap);

    var reviewWrap = el('div', 'f');
    var reviewLabel = el('label');
    var reviewCb = el('input'); reviewCb.type = 'checkbox'; reviewCb.checked = t.requires_review !== false; reviewCb.style.width = 'auto'; reviewCb.style.marginRight = '8px';
    reviewLabel.appendChild(reviewCb);
    reviewLabel.appendChild(document.createTextNode('Requires review (adds "Ready for Review" / "Approved" before Completed)'));
    reviewWrap.appendChild(reviewLabel);
    wrap.appendChild(reviewWrap);

    var defaultAssigneeSel = el('select');
    defaultAssigneeSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { defaultAssigneeSel.appendChild(new Option(p.full_name, p.id)); });
    defaultAssigneeSel.value = t.default_assignee_id || '';
    wrap.appendChild(field('Default Assignee (optional)', defaultAssigneeSel));

    var defaultReviewerSel = el('select');
    defaultReviewerSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { defaultReviewerSel.appendChild(new Option(p.full_name, p.id)); });
    defaultReviewerSel.value = t.default_reviewer_id || '';
    wrap.appendChild(field('Default Reviewer (optional)', defaultReviewerSel));

    // Handbook Task 12: see the New Template modal's matching comment —
    // the statutory day-of-month is governed separately (source-cited,
    // verified-by, versioned) via "Manage Deadline Rule" on the template
    // card, not editable here as a bare number.
    var requiresExternalDeadlineWrap = el('div', 'f');
    var requiresExternalDeadlineLabel = el('label');
    var requiresExternalDeadlineCb = el('input'); requiresExternalDeadlineCb.type = 'checkbox'; requiresExternalDeadlineCb.checked = !!t.requires_external_deadline; requiresExternalDeadlineCb.style.width = 'auto'; requiresExternalDeadlineCb.style.marginRight = '8px';
    requiresExternalDeadlineLabel.appendChild(requiresExternalDeadlineCb);
    requiresExternalDeadlineLabel.appendChild(document.createTextNode('This service has a statutory filing deadline (govern it separately via "Manage Deadline Rule")'));
    requiresExternalDeadlineWrap.appendChild(requiresExternalDeadlineLabel);
    wrap.appendChild(requiresExternalDeadlineWrap);

    var internalOffsetInput = el('input'); internalOffsetInput.type = 'number'; internalOffsetInput.min = '0'; internalOffsetInput.placeholder = 'e.g. 3';
    internalOffsetInput.value = t.internal_offset_days != null ? t.internal_offset_days : '';
    wrap.appendChild(field('Internal Deadline — days before filing (optional)', internalOffsetInput));

    var checklistEditor = buildChecklistEditor(t.service_template_items || []);
    wrap.appendChild(field('Checklist (optional)', checklistEditor.element));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the template a title.', true); return; }
      saveBtn.disabled = true;
      var res = await sb.from('service_templates').update({
        title: titleInput.value.trim(),
        category: catSel.value,
        description: descInput.value.trim() || null,
        recurrence: recurSel.value,
        is_active: activeCb.checked,
        requires_submission: submissionCb.checked,
        requires_review: reviewCb.checked,
        default_assignee_id: defaultAssigneeSel.value || null,
        default_reviewer_id: defaultReviewerSel.value || null,
        requires_external_deadline: requiresExternalDeadlineCb.checked,
        internal_offset_days: internalOffsetInput.value.trim() ? parseInt(internalOffsetInput.value, 10) : null,
      }).eq('id', t.id);
      if (res.error) { saveBtn.disabled = false; toast('Could not save: ' + res.error.message, true); return; }
      var delRes = await sb.from('service_template_items').delete().eq('template_id', t.id);
      if (delRes.error) { saveBtn.disabled = false; toast('Template saved, but checklist could not be updated: ' + delRes.error.message, true); return; }
      var rows = checklistEditor.getRows().map(function (r) {
        return { template_id: t.id, stage: r.stage, title: r.title, sort_order: r.sort_order, is_required: r.is_required };
      });
      if (rows.length) {
        var itemsRes = await sb.from('service_template_items').insert(rows);
        if (itemsRes.error) { saveBtn.disabled = false; toast('Template saved, but checklist could not be updated: ' + itemsRes.error.message, true); return; }
      }
      saveBtn.disabled = false;
      closeModal();
      toast('Template updated.');
      render();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  var PERIOD_TYPE_PLACEHOLDERS = { monthly: 'e.g. Shrawan 2083', quarterly: 'e.g. Q1 2083/84', yearly: 'e.g. FY 2083/84' };

  // Bulk-creates one work item per active client_service for a given
  // period, using each service's template/assignee/reviewer — the manual,
  // click-to-run twin of the open-Work-Desk check (see the "Auto-Generate
  // Periods" card above the templates list). Both call the same
  // `generate_period_work_for_period` SQL function so the generation logic
  // only exists in one place. Existing work for the same client+service+
  // period is skipped, so it's safe to run more than once. Period type
  // (monthly/quarterly/yearly) pins generation to only the services on
  // that cadence — a monthly period entered here can never land on a
  // quarterly or yearly service. Due dates land blank unless a template
  // sets a deadline rule (Templates → New Template).
  //
  // Handbook Task 11: Period Start/End (Gregorian) are now required
  // alongside the period label — the DB function derives filing_
  // deadline_day/internal_offset_days from Period End's month, never from
  // today's date, so generating a past or future period no longer
  // silently computes due dates as if it were generated today. This app
  // still has no owner-approved Bikram Sambat conversion table, so these
  // dates are never computed from the label — you're recording the real
  // Gregorian range the period covers, the same way you already know the
  // label itself.
  async function openGeneratePeriodModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Generate Period Work';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var typeSel = el('select');
    [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']].forEach(function (t) { typeSel.appendChild(new Option(t[1], t[0])); });
    wrap.appendChild(field('Period Type', typeSel));
    var periodInput = el('input'); periodInput.type = 'text'; periodInput.placeholder = PERIOD_TYPE_PLACEHOLDERS.monthly;
    wrap.appendChild(field('Period', periodInput));
    var startInput = el('input'); startInput.type = 'date';
    wrap.appendChild(field('Period Start Date (Gregorian)', startInput));
    var endInput = el('input'); endInput.type = 'date';
    wrap.appendChild(field('Period End Date (Gregorian)', endInput));
    var previewWrap = el('p', 'desc'); previewWrap.textContent = 'Enter a period above to see what would be generated.';
    wrap.appendChild(previewWrap);

    var actions = el('div', 'modal-actions');
    var genBtn = el('button', 'btn'); genBtn.type = 'button'; genBtn.textContent = 'Generate';
    genBtn.disabled = true;
    actions.appendChild(genBtn);
    wrap.appendChild(actions);
    openModal(wrap);

    async function refreshPreview() {
      var period = periodInput.value.trim();
      var periodType = typeSel.value;
      var hasRange = startInput.value && endInput.value && endInput.value >= startInput.value;
      if (!period) {
        previewWrap.textContent = 'Enter a period above to see what would be generated.';
        genBtn.disabled = true;
        return;
      }
      if (!hasRange) {
        previewWrap.textContent = 'Enter a valid Period Start/End Date (Gregorian) — End must not be before Start.';
        genBtn.disabled = true;
        return;
      }
      var svcRes = await sb.from('client_services').select('client_id, service_template_id').eq('is_active', true);
      var existingRes = await sb.from('work_items').select('client_id, service_template_id').eq('period', period);
      // Only services whose template actually recurs on the selected
      // cadence are eligible — matches the DB function's own filter, so
      // this preview can't promise a count the RPC wouldn't actually create.
      var services = (svcRes.data || []).filter(function (s) {
        var t = templateById(s.service_template_id);
        return t && t.recurrence === periodType;
      });
      var existing = existingRes.data || [];
      var remaining = services.filter(function (s) {
        return !existing.some(function (w) { return w.client_id === s.client_id && w.service_template_id === s.service_template_id; });
      }).length;
      if (!services.length) {
        previewWrap.textContent = 'No active ' + periodType + ' services set up yet — add some from a client\'s page first.';
      } else if (!remaining) {
        previewWrap.textContent = 'All ' + services.length + ' active ' + periodType + ' service' + (services.length === 1 ? '' : 's') + ' already ha' + (services.length === 1 ? 's' : 've') + ' work for "' + period + '".';
      } else {
        previewWrap.textContent = remaining + ' of ' + services.length + ' active ' + periodType + ' service' + (services.length === 1 ? '' : 's') + ' still need' + (remaining === 1 ? 's' : '') + ' work generated for "' + period + '".';
      }
      genBtn.disabled = remaining === 0;
    }
    typeSel.addEventListener('change', function () {
      periodInput.placeholder = PERIOD_TYPE_PLACEHOLDERS[typeSel.value];
      refreshPreview();
    });
    periodInput.addEventListener('input', refreshPreview);
    startInput.addEventListener('input', refreshPreview);
    endInput.addEventListener('input', refreshPreview);
    await refreshPreview();

    genBtn.addEventListener('click', async function () {
      var period = periodInput.value.trim();
      genBtn.disabled = true;
      var res = await sb.rpc('generate_period_work_for_period', {
        p_period: period, p_period_type: typeSel.value,
        p_period_start: startInput.value, p_period_end: endInput.value,
      });
      genBtn.disabled = false;
      if (res.error) { toast('Could not generate: ' + res.error.message, true); return; }
      var created = res.data || 0;
      closeModal();
      toast(created + ' work item' + (created === 1 ? '' : 's') + ' created. Set due dates on each before assigning out.');
    });
  }

  // ============================================================
  // Firm Work — internal team work (work_scope='firm'), deliberately
  // kept visually and functionally separate from Client Work: its own
  // nav group/icon, a dense table rather than the task-row cards Client
  // Work uses, and none of Client Work's compliance-specific columns
  // (client, period, filing deadline, reviewer, submission status) ever
  // appear here. Open to every active team member — work_items_read RLS
  // already grants unconditional read on work_scope='firm' rows to
  // anyone (see 20260816090000_firm_work_data_model.sql) — so this page
  // queries that scope directly rather than going through loadWork(),
  // which is deliberately hard-scoped to work_scope='client' so Firm
  // Work can never leak into a Client Work view.
  //
  // No new migration was needed for this task: work_comments' existing
  // read/insert policies check `w.status <> 'ready_for_review'` as a
  // catch-all visibility branch, which is trivially true for every Firm
  // Work status (none of them is literally the string 'ready_for_review'
  // — see Task 1's own note on why 'review' was chosen as a distinct
  // value) — so Updates (work_comments) already work for any active
  // user on any Firm Work item without touching RLS again.
  // ============================================================
  function truncateOneLine(s, n) {
    if (!s) return '';
    var oneLine = s.replace(/\s+/g, ' ').trim();
    return oneLine.length > n ? oneLine.slice(0, n) + '…' : oneLine;
  }

  async function renderFirmWorkPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Firm Work'; head.appendChild(h1);
    var headBtns = el('div'); headBtns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    var projectsBtn = el('button', 'btn btn-outline btn-sm'); projectsBtn.type = 'button'; projectsBtn.appendChild(icon('folder')); projectsBtn.appendChild(document.createTextNode('Manage Projects'));
    projectsBtn.addEventListener('click', function () { openProjectsModal(refresh); });
    headBtns.appendChild(projectsBtn);
    var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Firm Work'));
    addBtn.addEventListener('click', function () { openFirmWorkModal(refresh); });
    headBtns.appendChild(addBtn);
    head.appendChild(headBtns);
    main.appendChild(head);

    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'Internal team work — business development, marketing, admin, and everything else that isn\'t client compliance work. Visible to the whole team.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var filterCard = el('div', 'card');
    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;';

    var searchInput = el('input'); searchInput.type = 'text'; searchInput.placeholder = 'Search title, description, category, project, owner, next action, or blocker…'; searchInput.style.cssText = 'flex:1;min-width:180px;';
    var ownerSel = el('select'); ownerSel.style.width = 'auto';
    ownerSel.appendChild(new Option('All Owners', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { ownerSel.appendChild(new Option(p.full_name, p.id)); });
    var categorySel = el('select'); categorySel.style.width = 'auto';
    categorySel.appendChild(new Option('All Categories', ''));
    FIRM_CATEGORIES.forEach(function (c) { categorySel.appendChild(new Option(c, c)); });
    var statusSel = el('select'); statusSel.style.width = 'auto';
    // Default ('') means "open" (not completed) — completed work stays
    // reachable via the explicit "Completed" option or "All Statuses",
    // per "default view should emphasize open work."
    statusSel.appendChild(new Option('Open (default)', ''));
    FIRM_STATUSES.forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });
    statusSel.appendChild(new Option('All Statuses', 'all'));
    var prioritySel = el('select'); prioritySel.style.width = 'auto';
    [['', 'All Priorities'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].forEach(function (p) { prioritySel.appendChild(new Option(p[1], p[0])); });
    // Handbook Task 15
    var projectSel = el('select'); projectSel.style.width = 'auto';
    projectSel.appendChild(new Option('All Projects', ''));
    state.projects.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (p) { projectSel.appendChild(new Option(p.name + (p.status === 'archived' ? ' (archived)' : ''), p.id)); });
    var dueFromInput = el('input'); dueFromInput.type = 'date'; dueFromInput.style.width = 'auto';
    var dueToInput = el('input'); dueToInput.type = 'date'; dueToInput.style.width = 'auto';
    var dueToLabel = el('span'); dueToLabel.textContent = 'to'; dueToLabel.style.cssText = 'font-size:.8rem;color:var(--ink-soft);';

    [searchInput, ownerSel, categorySel, projectSel, statusSel, prioritySel].forEach(function (elm) { filterRow.appendChild(elm); });
    // Handbook Task 17: flex-wrap here too -- two native date inputs
    // side by side don't fit a narrow phone screen even alone on their
    // own row (Chromium's date input has an intrinsic minimum width
    // wider than a 375px viewport's available space), found by an actual
    // overflow measurement, not assumed. Wrapping lets "to" and the
    // second date drop to their own line instead of forcing the page
    // itself wider.
    var dueWrap = el('div'); dueWrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;';
    dueWrap.appendChild(dueFromInput); dueWrap.appendChild(dueToLabel); dueWrap.appendChild(dueToInput);
    filterRow.appendChild(dueWrap);
    filterCard.appendChild(filterRow);

    var statusLine = el('div'); statusLine.style.cssText = 'margin-top:12px;font-size:.85rem;color:var(--ink-soft);display:flex;align-items:center;gap:10px;';
    var statusText = el('span');
    var clearBtn = el('button', 'btn btn-outline btn-sm'); clearBtn.type = 'button'; clearBtn.textContent = 'Clear Filters';
    statusLine.appendChild(statusText); statusLine.appendChild(clearBtn);
    filterCard.appendChild(statusLine);
    main.appendChild(filterCard);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    var debounceTimer = null;
    function onFilterChange(immediate) {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (immediate) { refresh(); return; }
      debounceTimer = setTimeout(refresh, 300);
    }
    searchInput.addEventListener('input', function () { onFilterChange(false); });
    ownerSel.addEventListener('change', function () { onFilterChange(true); });
    categorySel.addEventListener('change', function () { onFilterChange(true); });
    projectSel.addEventListener('change', function () { onFilterChange(true); });
    statusSel.addEventListener('change', function () { onFilterChange(true); });
    prioritySel.addEventListener('change', function () { onFilterChange(true); });
    dueFromInput.addEventListener('change', function () { onFilterChange(true); });
    dueToInput.addEventListener('change', function () { onFilterChange(true); });
    clearBtn.addEventListener('click', function () {
      searchInput.value = ''; ownerSel.value = ''; categorySel.value = ''; projectSel.value = ''; statusSel.value = ''; prioritySel.value = '';
      dueFromInput.value = ''; dueToInput.value = '';
      onFilterChange(true);
    });

    async function refresh() {
      clear(resultsWrap);
      var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);

      var query = sb.from('work_items').select('*').eq('work_scope', 'firm').order('internal_due_date', { ascending: true, nullsFirst: false });
      if (statusSel.value === '') query = query.neq('status', 'completed');
      else if (statusSel.value !== 'all') query = query.eq('status', statusSel.value);
      if (ownerSel.value) query = query.eq('assignee_id', ownerSel.value);
      if (categorySel.value) query = query.eq('firm_category', categorySel.value);
      if (projectSel.value) query = query.eq('project_id', projectSel.value);
      if (prioritySel.value) query = query.eq('priority', prioritySel.value);
      if (dueFromInput.value) query = query.gte('internal_due_date', dueFromInput.value);
      if (dueToInput.value) query = query.lte('internal_due_date', dueToInput.value);
      var term = searchInput.value.trim().replace(/[,()]/g, ' ');
      // Handbook Task 17: search also matches next_action, per the
      // task's own "Search title/description/next action" instruction —
      // still one server-side query, never a client-side download-then-
      // filter of the full table.
      if (term) {
        // Handbook Task 23: "title; description; category; project;
        // owner; next action" is this task's own field list for Firm
        // Work search -- category (a fixed enum, still plain text so an
        // ilike works directly) and owner (matched by name the same way
        // project/client/staff names already are elsewhere in this app)
        // were the two not yet covered.
        // Task 27: blocker_reason joins the same search -- "why is this
        // stuck" is exactly the kind of thing someone searches for.
        var orParts = ['title.ilike.%' + term + '%', 'description.ilike.%' + term + '%', 'next_action.ilike.%' + term + '%', 'firm_category.ilike.%' + term + '%', 'blocker_reason.ilike.%' + term + '%'];
        // Handbook Task 19: "Project name should participate in Firm
        // Work search where practical." project_id is a foreign key, not
        // text, so it can't join into an ilike directly -- matched the
        // same way Client Work's own Search page matches client/staff
        // names (see renderSearchPage): compute matching project IDs
        // client-side from the already-loaded state.projects, then fold
        // them into the same server-side .or() as project_id.in.(...).
        // Still one query, never a client-side download-then-filter.
        var lowerTerm = term.toLowerCase();
        var matchingProjectIds = state.projects.filter(function (p) { return p.name.toLowerCase().indexOf(lowerTerm) !== -1; }).map(function (p) { return p.id; });
        if (matchingProjectIds.length) orParts.push('project_id.in.(' + matchingProjectIds.join(',') + ')');
        var matchingOwnerIds = state.profiles.filter(function (p) { return (p.full_name || '').toLowerCase().indexOf(lowerTerm) !== -1; }).map(function (p) { return p.id; });
        if (matchingOwnerIds.length) orParts.push('assignee_id.in.(' + matchingOwnerIds.join(',') + ')');
        query = query.or(orParts.join(','));
      }

      var res = await query;
      clear(resultsWrap);
      if (res.error) {
        var errBox = el('div', 'empty-note'); errBox.textContent = 'Could not load Firm Work: ' + res.error.message;
        resultsWrap.appendChild(errBox);
        return;
      }
      var items = res.data || [];
      statusText.textContent = items.length + ' item' + (items.length === 1 ? '' : 's') + '.';

      if (!items.length) {
        var empty = el('div', 'empty-note'); empty.appendChild(icon('briefcase'));
        empty.appendChild(document.createTextNode('No Firm Work matches these filters.'));
        resultsWrap.appendChild(empty);
        return;
      }

      // One extra query for the latest update per item — same "load
      // once, cheap at this org's size" pattern as loadWaitingSummaries().
      var commentsRes = await sb.from('work_comments').select('*').in('work_item_id', items.map(function (w) { return w.id; })).order('created_at', { ascending: false });
      var latestByItem = {};
      (commentsRes.data || []).forEach(function (c) { if (!latestByItem[c.work_item_id]) latestByItem[c.work_item_id] = c; });

      // Handbook Task 17: 8 columns is wide enough to overflow a narrow
      // phone screen — scrolls horizontally within its own card instead
      // of forcing the whole page wider (the page body itself must never
      // scroll sideways).
      var card = el('div', 'card');
      var tableScroll = el('div'); tableScroll.style.cssText = 'overflow-x:auto;';
      var table = el('table');
      var thead = el('thead'); var trh = el('tr');
      ['Title', 'Category', 'Project', 'Owner', 'Status', 'Due Date', 'Priority', 'Blocker / Next Action / Update'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
      thead.appendChild(trh); table.appendChild(thead);
      var tbody = el('tbody');
      items.forEach(function (w) {
        var tr = el('tr'); tr.style.cursor = 'pointer';
        tr.addEventListener('click', function () { gotoFirmWork(w.id); });
        var tdTitle = el('td'); tdTitle.style.fontWeight = '700'; tdTitle.style.color = 'var(--navy-950)'; tdTitle.textContent = w.title; tr.appendChild(tdTitle);
        var tdCat = el('td'); tdCat.textContent = w.firm_category || '—'; tr.appendChild(tdCat);
        var tdProject = el('td'); var proj = w.project_id ? projectById(w.project_id) : null; tdProject.textContent = proj ? proj.name : '—'; tr.appendChild(tdProject);
        var tdOwner = el('td'); tdOwner.textContent = profileName(w.assignee_id); tr.appendChild(tdOwner);
        var tdStatus = el('td'); var badge = el('span', 'badge badge-' + w.status); badge.textContent = STATUS_LABELS[w.status] || w.status; tdStatus.appendChild(badge); tr.appendChild(tdStatus);
        // Plain date only — no "Internal"/"Filing" framing (that's
        // Client Work's two-due-date vocabulary; Firm Work has one).
        var tdDue = el('td'); if (isOverdue(w)) tdDue.style.cssText = 'color:var(--red);font-weight:700;';
        tdDue.textContent = w.internal_due_date ? fmtDate(w.internal_due_date) : '—';
        tr.appendChild(tdDue);
        var tdPriority = el('td');
        var dot = el('span', 'priority-dot priority-dot-' + w.priority); dot.style.cssText = 'display:inline-block;margin-right:6px;';
        tdPriority.appendChild(dot);
        tdPriority.appendChild(document.createTextNode(w.priority.charAt(0).toUpperCase() + w.priority.slice(1)));
        tr.appendChild(tdPriority);
        // Handbook Task 17: next_action, when set, is a more direct
        // "what happens next" signal than a comment thread — falls back
        // to the latest update when there's no next_action recorded.
        // Task 27: a blocked item's own blocker reason outranks both —
        // "why is this stuck" is the more urgent question than "what's
        // next" once something is actually blocked. Amber, never red —
        // this is an operational blocker, not a statutory breach.
        var tdUpdate = el('td'); tdUpdate.style.cssText = 'font-size:.85rem;max-width:220px;';
        var latest = latestByItem[w.id];
        if (w.status === 'blocked' && w.blocker_reason) {
          tdUpdate.style.color = 'var(--amber)'; tdUpdate.style.fontWeight = '600';
          tdUpdate.textContent = 'Blocked: ' + truncateOneLine(w.blocker_reason, 55);
        } else {
          tdUpdate.style.color = 'var(--ink-soft)';
          if (w.next_action) tdUpdate.textContent = truncateOneLine(w.next_action, 60);
          else tdUpdate.textContent = latest ? truncateOneLine(latest.body, 60) : '—';
        }
        tr.appendChild(tdUpdate);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableScroll.appendChild(table);
      card.appendChild(tableScroll);
      resultsWrap.appendChild(card);
    }

    await refresh();
  }

  // ============================================================
  // Projects / Initiatives management — Handbook Task 19. Deliberately
  // small: no budgets, timesheets, dependencies, Gantt, milestones, or
  // files — a project is just a lightweight label Firm Work can group
  // under. Any active teammate may create/rename/archive any project,
  // same open peer model as Firm Work itself (projects_insert/update
  // RLS already grant this — see 20260826090000). Every material edit is
  // attributable via updated_by/updated_at, auto-set by a DB trigger
  // (Handbook Task 19) — never trusted from the client. Archiving never
  // deletes or hides historical Firm Work: there is no delete policy on
  // projects at all, and the Firm Work list's own project filter already
  // includes archived projects (labeled "(archived)") precisely so past
  // work under a retired project stays fully reachable.
  // ============================================================
  function openProjectsModal(onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Projects / Initiatives';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () { closeModal(); onDone(); });
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var newRow = el('div'); newRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;';
    var newInput = el('input'); newInput.type = 'text'; newInput.placeholder = 'e.g. Office Search, Marketing Campaign…'; newInput.style.flex = '1'; newInput.style.minWidth = '180px';
    var newBtn = el('button', 'btn btn-sm'); newBtn.type = 'button'; newBtn.appendChild(icon('plus')); newBtn.appendChild(document.createTextNode('New Project'));
    newBtn.addEventListener('click', async function () {
      if (!newInput.value.trim()) return;
      newBtn.disabled = true;
      var res = await sb.from('projects').insert({ name: newInput.value.trim(), created_by: state.user.id }).select().single();
      newBtn.disabled = false;
      if (res.error) { toast('Could not create project: ' + res.error.message, true); return; }
      state.projects.push(res.data);
      newInput.value = '';
      renderList();
    });
    newRow.appendChild(newInput); newRow.appendChild(newBtn);
    wrap.appendChild(newRow);

    var list = el('div');
    wrap.appendChild(list);

    function renderList() {
      clear(list);
      var sorted = state.projects.slice().sort(function (a, b) {
        if ((a.status === 'archived') !== (b.status === 'archived')) return a.status === 'archived' ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      if (!sorted.length) {
        var noneP = el('p', 'desc'); noneP.textContent = 'No projects yet.'; list.appendChild(noneP);
        return;
      }
      sorted.forEach(function (p) {
        var row = el('div', 'checklist-item'); row.style.cssText = 'align-items:center;gap:10px;';
        var nameSpan = el('span'); nameSpan.style.cssText = 'flex:1;font-weight:700;cursor:pointer;' + (p.status === 'archived' ? 'color:var(--ink-soft);text-decoration:line-through;' : '');
        nameSpan.textContent = p.name;
        nameSpan.addEventListener('click', function () { openProjectDetailModal(p, function () { openProjectsModal(onDone); }); });
        row.appendChild(nameSpan);
        if (p.status === 'archived') { var badge = el('span', 'badge badge-to_do'); badge.textContent = 'Archived'; row.appendChild(badge); }
        var renameBtn = el('button', 'btn btn-outline btn-sm'); renameBtn.type = 'button'; renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', async function () {
          var name = prompt('Rename project:', p.name);
          if (!name || !name.trim() || name.trim() === p.name) return;
          var res = await sb.from('projects').update({ name: name.trim() }).eq('id', p.id);
          if (res.error) { toast('Could not rename: ' + res.error.message, true); return; }
          p.name = name.trim();
          toast('Project renamed.');
          renderList();
        });
        row.appendChild(renameBtn);
        var archiveBtn = el('button', 'btn btn-outline btn-sm'); archiveBtn.type = 'button';
        archiveBtn.textContent = p.status === 'archived' ? 'Reactivate' : 'Archive';
        archiveBtn.addEventListener('click', async function () {
          var newStatus = p.status === 'archived' ? 'active' : 'archived';
          var res = await sb.from('projects').update({ status: newStatus }).eq('id', p.id);
          if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
          p.status = newStatus;
          toast(newStatus === 'archived' ? 'Project archived — its Firm Work history stays fully visible.' : 'Project reactivated.');
          renderList();
        });
        row.appendChild(archiveBtn);
        list.appendChild(row);
      });
    }
    renderList();

    openModal(wrap);
  }

  // Project Detail — Handbook Task 19: "can show active/completed Firm
  // Work counts and actual items." A small modal, not a page (this is a
  // lightweight label, not a first-class object with its own workflow) —
  // reachable from the Projects modal above and from the Project field
  // on the Firm Work Detail page (Handbook Task 18).
  function openProjectDetailModal(project, onClose) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = project.name;
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () { closeModal(); if (onClose) onClose(); });
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    if (project.status === 'archived') {
      var archivedNote = el('p', 'desc'); archivedNote.textContent = 'Archived — no longer offered for new Firm Work, but its history stays intact below.';
      wrap.appendChild(archivedNote);
    }
    if (project.description) {
      var descP = el('p'); descP.style.cssText = 'white-space:pre-wrap;'; descP.textContent = project.description;
      wrap.appendChild(descP);
    }

    var metaLine = el('div'); metaLine.style.cssText = 'font-size:.82rem;color:var(--ink-soft);margin:8px 0 16px;';
    var metaBits = ['Created by ' + profileName(project.created_by) + ' on ' + fmtDate(project.created_at)];
    if (project.updated_by) metaBits.push('last edited by ' + profileName(project.updated_by) + ' on ' + fmtDateTime(project.updated_at));
    metaLine.textContent = metaBits.join(' · ');
    wrap.appendChild(metaLine);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading Firm Work…';
    wrap.appendChild(loading);
    openModal(wrap);

    (async function loadItems() {
      var res = await sb.from('work_items').select('*').eq('work_scope', 'firm').eq('project_id', project.id).order('internal_due_date', { ascending: true, nullsFirst: false });
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      var items = res.data || [];
      if (res.error) {
        var errP = el('p', 'desc'); errP.textContent = 'Could not load Firm Work: ' + res.error.message; wrap.appendChild(errP);
        return;
      }
      var active = items.filter(function (w) { return w.status !== 'completed'; });
      var completed = items.filter(function (w) { return w.status === 'completed'; });

      var countsLine = el('div'); countsLine.style.cssText = 'display:flex;gap:16px;margin-bottom:12px;';
      countsLine.appendChild((function () { var s = el('div', 'today-stat'); var n = el('div', 'n'); n.textContent = String(active.length); var l = el('div', 'l'); l.textContent = 'Active'; s.appendChild(n); s.appendChild(l); return s; })());
      countsLine.appendChild((function () { var s = el('div', 'today-stat'); var n = el('div', 'n'); n.textContent = String(completed.length); var l = el('div', 'l'); l.textContent = 'Completed'; s.appendChild(n); s.appendChild(l); return s; })());
      wrap.appendChild(countsLine);

      if (!items.length) {
        var noneP = el('p', 'desc'); noneP.textContent = 'No Firm Work under this project yet.'; wrap.appendChild(noneP);
        return;
      }
      items.forEach(function (w) {
        var row = el('div', 'activity-row'); row.style.cursor = 'pointer';
        row.addEventListener('click', function () { closeModal(); gotoFirmWork(w.id); });
        var titleLine = el('div'); titleLine.style.cssText = 'display:flex;justify-content:space-between;gap:8px;align-items:center;';
        var titleSpan = el('span'); titleSpan.style.fontWeight = '700'; titleSpan.textContent = w.title;
        var badge = el('span', 'badge badge-' + w.status); badge.textContent = STATUS_LABELS[w.status] || w.status;
        titleLine.appendChild(titleSpan); titleLine.appendChild(badge);
        row.appendChild(titleLine);
        wrap.appendChild(row);
      });
    })();
  }

  // ============================================================
  // Firm Work Detail — Handbook Task 18: a dedicated page (not a modal)
  // so a teammate coming online later — possibly in a different time
  // zone, without a meeting — can see current position, next action, and
  // blocker context all at once, then dig into description/checklist/
  // updates/history below. Mirrors renderWorkDetail's card/meta-grid
  // conventions but is its own function: Client Work's page assumes
  // client-scope fields (client_id, service_template_id, submission,
  // waiting_for_client) throughout, none of which apply here.
  //
  // Every active teammate may edit any Firm Work item, including
  // reassigning it — the peer model confirmed in Task 16 and enforced at
  // the DB layer by guard_work_item_update() regardless of what this UI
  // shows, so no canEdit gating is needed here at all.
  // ============================================================
  async function renderFirmWorkDetail(id) {
    var main = qs('#main');
    clear(main);
    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var workRes = await sb.from('work_items').select('*').eq('id', id).eq('work_scope', 'firm').single();
    var checklistRes = await sb.from('work_checklist_items').select('*').eq('work_item_id', id).order('sort_order').order('created_at');
    var commentsRes = await sb.from('work_comments').select('*').eq('work_item_id', id).order('created_at', { ascending: false });
    var activityRes = await sb.from('work_activity').select('*').eq('work_item_id', id).order('created_at', { ascending: false }).limit(30);
    clear(main);

    if (workRes.error || !workRes.data) {
      var empty = el('div', 'empty-note'); empty.textContent = "That Firm Work item doesn't exist, or you don't have access to it.";
      main.appendChild(empty);
      var back = el('button', 'btn btn-outline btn-sm'); back.type = 'button'; back.textContent = '← Back to Firm Work';
      back.addEventListener('click', function () { goto('firm-work'); });
      main.appendChild(back);
      return;
    }
    var work = workRes.data;
    var checklist = checklistRes.data || [];
    var comments = commentsRes.data || [];
    var activity = activityRes.data || [];
    var project = work.project_id ? projectById(work.project_id) : null;

    // ---- TOP SUMMARY ----
    var card = el('div', 'card');
    var head = el('div', 'detail-head');
    var titleWrap = el('div');
    var h1 = el('h1'); h1.style.fontSize = '1.25rem'; h1.textContent = work.title;
    var sub = el('div'); sub.style.cssText = 'color:var(--ink-soft);font-size:.88rem;margin-top:2px;';
    sub.textContent = (work.firm_category || 'Uncategorized') + (project ? ' · ' + project.name : '');
    titleWrap.appendChild(h1); titleWrap.appendChild(sub);
    var badge = el('span', 'badge badge-' + work.status); badge.textContent = STATUS_LABELS[work.status] || work.status;
    head.appendChild(titleWrap); head.appendChild(badge);
    card.appendChild(head);

    var headRow2 = el('div'); headRow2.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;';
    var backLink = el('a'); backLink.href = '#firm-work'; backLink.textContent = '← Back to Firm Work'; backLink.style.fontSize = '.85rem';
    headRow2.appendChild(backLink);
    var editBtn = el('button', 'btn btn-outline btn-sm'); editBtn.type = 'button'; editBtn.textContent = 'Edit Basics';
    editBtn.addEventListener('click', function () { openEditFirmWorkModal(work, function () { renderFirmWorkDetail(id); }); });
    headRow2.appendChild(editBtn);
    // Handbook Task 24: "reusable examples/templates... only if the
    // current UI already supports templates cleanly" -- rather than a
    // new Firm Work Templates system, a lightweight Duplicate button
    // reuses the existing create modal, pre-filled from this item
    // (category/owner/priority/description/project/checklist), for
    // genuinely repeatable patterns like a monthly outreach campaign.
    var duplicateBtn = el('button', 'btn btn-outline btn-sm'); duplicateBtn.type = 'button'; duplicateBtn.textContent = 'Duplicate';
    duplicateBtn.title = 'Start a new Firm Work item pre-filled from this one — handy for repeatable patterns.';
    duplicateBtn.addEventListener('click', function () {
      openFirmWorkModal(function (newId) { if (newId) gotoFirmWork(newId); else render(); }, { duplicateFrom: work, checklistTitles: checklist.map(function (ci) { return ci.title; }) });
    });
    headRow2.appendChild(duplicateBtn);
    card.appendChild(headRow2);

    var metaGrid = el('div', 'meta-grid');
    metaGrid.appendChild(metaItem('Category', work.firm_category || '—', 'idcard'));
    var projectMeta = metaItem('Project', project ? project.name : '—', 'folder');
    if (project) {
      // Handbook Task 19: cross-link into the Project Detail modal — "Project
      // visible on ... detail" plus somewhere to actually navigate to it from.
      var projectValueEl = projectMeta.querySelector('.value');
      projectValueEl.style.cursor = 'pointer'; projectValueEl.style.textDecoration = 'underline';
      projectValueEl.addEventListener('click', function () { openProjectDetailModal(project, function () { renderFirmWorkDetail(id); }); });
    }
    metaGrid.appendChild(projectMeta);
    metaGrid.appendChild(metaItem('Owner', profileName(work.assignee_id), 'user', work.assignee_id));
    // Task 27: Status alongside the rest of the at-a-glance fields, not
    // just the corner badge -- matches Client Work Detail's own metaGrid
    // treatment (Task 26) so the two detail pages read consistently.
    metaGrid.appendChild(metaItem('Status', STATUS_LABELS[work.status] || work.status, 'check'));
    metaGrid.appendChild(metaItem('Priority', work.priority.charAt(0).toUpperCase() + work.priority.slice(1), 'flag'));
    metaGrid.appendChild(metaItem('Target Date', work.internal_due_date ? fmtDate(work.internal_due_date) : '—', 'calendar'));
    metaGrid.appendChild(metaItem('Last Updated', fmtDateTime(work.updated_at), 'calendar'));
    card.appendChild(metaGrid);

    // Status — every active teammate may change it (peer model, Task 16).
    var statusWrap = el('div', 'f');
    var statusLabel = el('label'); statusLabel.textContent = 'Status'; statusWrap.appendChild(statusLabel);
    var statusSel = el('select');
    FIRM_STATUSES.forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });
    statusSel.value = work.status;
    statusWrap.appendChild(statusSel);
    card.appendChild(statusWrap);

    // Next Action — Task 18's own "make next_action easy to edit by any
    // active teammate... answer 'what happens next?' in plain text" —
    // right in the top summary, not buried in an edit modal.
    var naWrap = el('div', 'f'); naWrap.style.marginTop = '10px';
    var naLabel = el('label'); naLabel.textContent = 'Next Action — what happens next?'; naWrap.appendChild(naLabel);
    var naRow = el('div'); naRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    var naInput = el('input'); naInput.type = 'text'; naInput.placeholder = 'e.g. Send follow-up email to landlord';
    naInput.value = work.next_action || ''; naInput.style.flex = '1'; naInput.style.minWidth = '180px';
    var naSaveBtn = el('button', 'btn btn-outline btn-sm'); naSaveBtn.type = 'button'; naSaveBtn.textContent = 'Save';
    naSaveBtn.addEventListener('click', async function () {
      naSaveBtn.disabled = true;
      var res = await sb.from('work_items').update({ next_action: naInput.value.trim() || null }).eq('id', work.id);
      naSaveBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      work.next_action = naInput.value.trim() || null;
      toast('Next action updated.');
    });
    naRow.appendChild(naInput); naRow.appendChild(naSaveBtn);
    naWrap.appendChild(naRow);
    card.appendChild(naWrap);

    // Blocker context — Task 18: "When status becomes Blocked, require a
    // short blocker reason. Optional review/follow-up date is acceptable
    // if it clearly remains an operational target, not a statutory
    // deadline." follow_up_date is the same column Client Work's Waiting
    // for Client uses, relaxed to firm scope by this task's own migration
    // — reused rather than adding a fourth near-duplicate date column.
    var blockerBox = el('div', 'action-box'); blockerBox.style.marginTop = '10px';
    var blockerTitle = el('div', 'action-title'); blockerTitle.textContent = 'Blocker Context'; blockerBox.appendChild(blockerTitle);
    var blockerInput = el('textarea'); blockerInput.rows = 2;
    blockerInput.placeholder = "What's blocking this? (required, at least a short sentence)";
    blockerInput.value = work.blocker_reason || '';
    blockerBox.appendChild(blockerInput);
    var fuInput = el('input'); fuInput.type = 'date'; fuInput.value = work.follow_up_date || '';
    blockerBox.appendChild(field('Review / follow-up date (optional — an operational target, not a statutory deadline)', fuInput));
    var blockerSaveBtn = el('button', 'btn btn-outline btn-sm'); blockerSaveBtn.type = 'button';
    blockerSaveBtn.style.marginTop = '6px';
    blockerBox.appendChild(blockerSaveBtn);
    card.appendChild(blockerBox);

    var prevStatus = work.status;
    function refreshBlockerVisibility() {
      blockerBox.classList.toggle('hidden', statusSel.value !== 'blocked');
      blockerSaveBtn.textContent = (statusSel.value === 'blocked' && prevStatus !== 'blocked')
        ? 'Save Blocker Context & Mark Blocked' : 'Save Blocker Context';
    }
    refreshBlockerVisibility();
    statusSel.addEventListener('change', function () {
      refreshBlockerVisibility();
      // Any transition that ISN'T into Blocked has no extra requirement —
      // save immediately, matching the DB trigger's own scoping (only the
      // moment of transitioning into Blocked needs a reason attached).
      if (statusSel.value !== 'blocked') {
        (async function () {
          var res = await sb.from('work_items').update({ status: statusSel.value }).eq('id', work.id);
          if (res.error) { toast('Could not update status: ' + res.error.message, true); statusSel.value = prevStatus; refreshBlockerVisibility(); return; }
          toast('Status updated.');
          renderFirmWorkDetail(id);
        })();
      }
      // Selecting Blocked just reveals the box — nothing saves until
      // "Save Blocker Context & Mark Blocked" is clicked below, since the
      // DB requires the reason and the status change together.
    });
    blockerSaveBtn.addEventListener('click', async function () {
      if (blockerInput.value.trim().length < 10) { toast("Explain what's blocking this (at least a short sentence).", true); return; }
      blockerSaveBtn.disabled = true;
      var patch = { blocker_reason: blockerInput.value.trim(), follow_up_date: fuInput.value || null };
      if (statusSel.value === 'blocked' && prevStatus !== 'blocked') patch.status = 'blocked';
      var res = await sb.from('work_items').update(patch).eq('id', work.id);
      blockerSaveBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      toast(patch.status ? 'Marked Blocked.' : 'Blocker context saved.');
      renderFirmWorkDetail(id);
    });

    if (work.description) {
      var descP = el('p'); descP.style.cssText = 'white-space:pre-wrap;margin-top:14px;'; descP.textContent = work.description;
      card.appendChild(descP);
    }
    // Task 27: "recent meaningful update" belongs in the top summary,
    // before long history -- a short preview here (comments is already
    // newest-first) means nobody has to scroll past the Checklist card
    // just to see the latest word on this item. The full thread with its
    // own post box stays in the Updates card below; this is read-only.
    if (comments.length) {
      var latestComment = comments[0];
      var latestBox = el('div', 'action-box'); latestBox.style.marginTop = '10px';
      var latestTitle = el('div', 'action-title'); latestTitle.textContent = 'Latest Update'; latestBox.appendChild(latestTitle);
      var latestWho = el('span', 'who'); latestWho.textContent = profileName(latestComment.author_id);
      if (latestComment.update_type) {
        var latestTypeBadge = el('span', 'badge badge-type'); latestTypeBadge.style.marginLeft = '8px';
        latestTypeBadge.textContent = UPDATE_TYPE_LABELS[latestComment.update_type] || latestComment.update_type;
        latestWho.appendChild(latestTypeBadge);
      }
      var latestWhen = el('span', 'when'); latestWhen.textContent = fmtDateTime(latestComment.created_at);
      latestWho.appendChild(latestWhen);
      latestBox.appendChild(latestWho);
      var latestBody = el('p'); latestBody.style.marginTop = '4px'; latestBody.textContent = truncateOneLine(latestComment.body, 160);
      latestBox.appendChild(latestBody);
      card.appendChild(latestBox);
    }
    main.appendChild(card);

    // ---- DETAIL BODY: Checklist ----
    var checklistCard = el('div', 'card'); checklistCard.style.marginTop = '20px';
    var clH2 = el('h2');
    clH2.appendChild(icon('check'));
    clH2.appendChild(document.createTextNode('Checklist' + (checklist.length ? ' (' + checklist.filter(function (i) { return i.is_done; }).length + '/' + checklist.length + ')' : '')));
    checklistCard.appendChild(clH2);
    if (!checklist.length) {
      var noChecklist = el('p', 'desc'); noChecklist.textContent = 'No checklist items yet.'; checklistCard.appendChild(noChecklist);
    }
    checklist.forEach(function (ci) {
      var row = el('label', 'checklist-item' + (ci.is_done ? ' done' : ''));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = ci.is_done;
      cb.addEventListener('change', async function () {
        var r = await sb.from('work_checklist_items').update({ is_done: cb.checked }).eq('id', ci.id);
        if (r.error) { toast('Could not update: ' + r.error.message, true); cb.checked = !cb.checked; return; }
        row.classList.toggle('done', cb.checked);
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(ci.title));
      checklistCard.appendChild(row);
    });
    var clAddRow = el('div'); clAddRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;';
    var clInput = el('input'); clInput.type = 'text'; clInput.placeholder = 'Add a checklist item…'; clInput.style.flex = '1'; clInput.style.minWidth = '160px';
    var clAddBtn = el('button', 'btn btn-outline btn-sm'); clAddBtn.type = 'button'; clAddBtn.textContent = 'Add';
    clAddBtn.addEventListener('click', async function () {
      if (!clInput.value.trim()) return;
      clAddBtn.disabled = true;
      var r = await sb.from('work_checklist_items').insert({ work_item_id: work.id, title: clInput.value.trim(), sort_order: checklist.length });
      clAddBtn.disabled = false;
      if (r.error) { toast('Could not add: ' + r.error.message, true); return; }
      renderFirmWorkDetail(id);
    });
    clAddRow.appendChild(clInput); clAddRow.appendChild(clAddBtn);
    checklistCard.appendChild(clAddRow);
    main.appendChild(checklistCard);

    // ---- DETAIL BODY: Updates — newest first, with an optional type tag
    // (Task 18: Progress/Result/Blocker/Handoff/Note — explicitly NOT a
    // Decision Needed/Owner Approval hierarchy). The latest one is
    // visually called out so "what's the latest update" never requires
    // scrolling a full thread.
    var updatesCard = el('div', 'card'); updatesCard.style.marginTop = '20px';
    var upH2 = el('h2'); upH2.appendChild(icon('message')); upH2.appendChild(document.createTextNode('Updates')); updatesCard.appendChild(upH2);
    if (!comments.length) {
      var noUpdates = el('p', 'desc'); noUpdates.textContent = 'No updates yet.'; updatesCard.appendChild(noUpdates);
    }
    comments.forEach(function (c, i) {
      var row = el('div', 'comment');
      if (i === 0) row.style.cssText = 'background:var(--mist);border-radius:8px;padding:10px 12px;margin-bottom:4px;border-bottom:none;';
      var who = el('span', 'who'); who.textContent = profileName(c.author_id);
      if (c.update_type) {
        var typeBadge = el('span', 'badge badge-type'); typeBadge.style.marginLeft = '8px';
        typeBadge.textContent = UPDATE_TYPE_LABELS[c.update_type] || c.update_type;
        who.appendChild(typeBadge);
      }
      var when = el('span', 'when'); when.textContent = fmtDateTime(c.created_at);
      who.appendChild(when);
      var body = el('p'); body.textContent = c.body;
      row.appendChild(who); row.appendChild(body);
      updatesCard.appendChild(row);
    });
    var typeSel = el('select'); typeSel.style.cssText = 'width:auto;margin-top:12px;';
    typeSel.appendChild(new Option('No type', ''));
    Object.keys(UPDATE_TYPE_LABELS).forEach(function (t) { typeSel.appendChild(new Option(UPDATE_TYPE_LABELS[t], t)); });
    updatesCard.appendChild(typeSel);
    var updateInput = el('textarea'); updateInput.rows = 2; updateInput.placeholder = 'Post a short update…'; updateInput.style.marginTop = '8px';
    updatesCard.appendChild(updateInput);
    var postBtn = el('button', 'btn btn-outline btn-sm'); postBtn.type = 'button'; postBtn.textContent = 'Post Update'; postBtn.style.marginTop = '8px';
    postBtn.addEventListener('click', async function () {
      if (!updateInput.value.trim()) return;
      postBtn.disabled = true;
      var res = await sb.from('work_comments').insert({ work_item_id: work.id, author_id: state.user.id, body: updateInput.value.trim(), update_type: typeSel.value || null });
      postBtn.disabled = false;
      if (res.error) { toast('Could not post: ' + res.error.message, true); return; }
      renderFirmWorkDetail(id);
    });
    updatesCard.appendChild(postBtn);
    main.appendChild(updatesCard);

    // ---- DETAIL BODY: Activity History — trusted system activity only
    // (reassigned/status_changed/due_date_changed/project_changed), all
    // logged unconditionally by guard_work_item_update() — never
    // client-inserted, so it can't be spoofed by whoever's looking at it.
    var activityCard = el('div', 'card'); activityCard.style.marginTop = '20px';
    var actH2 = el('h2'); actH2.appendChild(icon('flag')); actH2.appendChild(document.createTextNode('Activity History')); activityCard.appendChild(actH2);
    if (!activity.length) {
      var noActivity = el('p', 'desc'); noActivity.textContent = 'Nothing logged yet — status, reassignment, project, and due-date changes show up here.'; activityCard.appendChild(noActivity);
    }
    activity.forEach(function (a) {
      var row = el('div', 'activity-row');
      var who = el('span', 'who'); who.textContent = a.actor_id ? profileName(a.actor_id) : 'System';
      var when = el('span', 'when'); when.textContent = fmtDateTime(a.created_at);
      who.appendChild(when);
      row.appendChild(who);
      if (a.detail) { var detailEl = el('div', 'detail'); detailEl.textContent = a.detail; row.appendChild(detailEl); }
      activityCard.appendChild(row);
    });
    main.appendChild(activityCard);
  }

  // Title/category/owner/priority/due date/description/project — the
  // more static identity/classification fields, edited via a small modal
  // (mirrors Client Work's openEditWorkModal). Status, Next Action, and
  // Blocker Context are inline on the detail page itself (see above) —
  // those are the "async coordination" fields Task 18 asks to be easy to
  // update in the moment, not buried behind an Edit button.
  function openEditFirmWorkModal(work, onDone) {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Edit Firm Work';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text'; titleInput.value = work.title;
    wrap.appendChild(field('Title', titleInput));

    var categorySel = el('select');
    categorySel.appendChild(new Option('— Choose a category —', ''));
    FIRM_CATEGORIES.forEach(function (c) { categorySel.appendChild(new Option(c, c)); });
    categorySel.value = work.firm_category || '';
    wrap.appendChild(field('Category', categorySel));

    var ownerSel = el('select');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { ownerSel.appendChild(new Option(p.full_name, p.id)); });
    ownerSel.value = work.assignee_id;
    wrap.appendChild(field('Owner', ownerSel));

    var prioritySel = el('select');
    [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].forEach(function (p) { prioritySel.appendChild(new Option(p[1], p[0])); });
    prioritySel.value = work.priority;
    wrap.appendChild(field('Priority', prioritySel));

    var dueInput = el('input'); dueInput.type = 'date'; dueInput.value = work.internal_due_date || '';
    wrap.appendChild(field('Due Date (optional)', dueInput));

    var descInput = el('textarea'); descInput.rows = 3; descInput.value = work.description || '';
    wrap.appendChild(field('Description (optional)', descInput));

    var projectSel = el('select');
    projectSel.appendChild(new Option('— No project —', ''));
    state.projects.filter(function (p) { return p.status === 'active'; }).forEach(function (p) { projectSel.appendChild(new Option(p.name, p.id)); });
    if (work.project_id && !projectById(work.project_id)) {
      // Same "don't silently drop the reference" reasoning as the create
      // modal's own project select.
      projectSel.appendChild(new Option('Archived project', work.project_id));
    }
    projectSel.value = work.project_id || '';
    var projectField = field('Project / Initiative (optional)', projectSel);
    var newProjectBtn = el('button', 'btn btn-outline btn-sm'); newProjectBtn.type = 'button'; newProjectBtn.textContent = '+ New Project'; newProjectBtn.style.marginTop = '6px';
    newProjectBtn.addEventListener('click', async function () {
      var name = prompt('New project/initiative name (e.g. "Office Search", "Marketing Campaign"):');
      if (!name || !name.trim()) return;
      var res = await sb.from('projects').insert({ name: name.trim(), created_by: state.user.id }).select().single();
      if (res.error) { toast('Could not create project: ' + res.error.message, true); return; }
      state.projects.push(res.data);
      projectSel.appendChild(new Option(res.data.name, res.data.id));
      projectSel.value = res.data.id;
      toast('Project created.');
    });
    projectField.appendChild(newProjectBtn);
    wrap.appendChild(projectField);

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give it a title.', true); return; }
      if (!categorySel.value) { toast('Choose a category.', true); return; }
      if (!ownerSel.value) { toast('Choose an owner.', true); return; }
      saveBtn.disabled = true;
      // Reassignment/due-date/project changes are logged automatically by
      // guard_work_item_update() (Handbook Task 7/18) — nothing to do
      // here beyond the update itself.
      var res = await sb.from('work_items').update({
        title: titleInput.value.trim(),
        firm_category: categorySel.value,
        assignee_id: ownerSel.value,
        priority: prioritySel.value,
        internal_due_date: dueInput.value || null,
        description: descInput.value.trim() || null,
        project_id: projectSel.value || null,
      }).eq('id', work.id);
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save: ' + res.error.message, true); return; }
      closeModal();
      toast('Firm Work updated.');
      onDone();
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // New Firm Work — create only. Editing an existing item now happens on
  // its own detail page (renderFirmWorkDetail), not this modal.
  // prefill (optional, Handbook Task 24): { duplicateFrom: workItemRow,
  // checklistTitles: string[] } -- "reusable examples/templates" for
  // repeatable patterns (e.g. a monthly outreach campaign) without a new
  // template system: pre-fills this same create form from an existing
  // Firm Work item's category/owner/priority/description/project, and
  // (only after a successful save) copies the source item's checklist
  // titles onto the new item, all unchecked. Status/next_action/target
  // date/updates/activity are never copied -- those are specific to the
  // OLD item's own progress, not a template for a new one. See
  // renderFirmWorkDetail's "Duplicate" button.
  function openFirmWorkModal(onDone, prefill) {
    var src = (prefill && prefill.duplicateFrom) || null;
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = src ? 'Duplicate Firm Work' : 'New Firm Work';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text';
    if (src) titleInput.value = src.title;
    wrap.appendChild(field('Title', titleInput));

    // Category is required — starts blank so a real choice has to be
    // made, rather than defaulting to the first real category in the
    // list (Handbook Task 17).
    var categorySel = el('select');
    categorySel.appendChild(new Option('— Choose a category —', ''));
    FIRM_CATEGORIES.forEach(function (c) { categorySel.appendChild(new Option(c, c)); });
    if (src) categorySel.value = src.firm_category || '';
    wrap.appendChild(field('Category', categorySel));

    var ownerSel = el('select');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { ownerSel.appendChild(new Option(p.full_name, p.id)); });
    ownerSel.value = src ? src.assignee_id : state.user.id; // default to self (or the duplicated item's owner), freely changeable
    wrap.appendChild(field('Owner', ownerSel));

    // (new items always start at To Do — no status field on create, same
    // convention as Client Work's New Work modal. This stays true when
    // duplicating too -- a copy is a fresh item, not a clone of the
    // source's current progress.)

    var prioritySel = el('select');
    [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].forEach(function (p) { prioritySel.appendChild(new Option(p[1], p[0])); });
    prioritySel.value = src ? src.priority : 'normal';
    wrap.appendChild(field('Priority', prioritySel));

    // Due date deliberately NOT copied when duplicating — a repeatable
    // pattern (e.g. "Restaurant Outreach - September" after "...August")
    // needs its own fresh target date, not last month's.
    var dueInput = el('input'); dueInput.type = 'date';
    wrap.appendChild(field('Due Date (optional)', dueInput));

    var descInput = el('textarea'); descInput.rows = 3;
    if (src) descInput.value = src.description || '';
    wrap.appendChild(field('Description (optional)', descInput));

    var projectSel = el('select');
    projectSel.appendChild(new Option('— No project —', ''));
    state.projects.filter(function (p) { return p.status === 'active'; })
      .forEach(function (p) { projectSel.appendChild(new Option(p.name, p.id)); });
    if (src && src.project_id && projectById(src.project_id)) projectSel.value = src.project_id;
    var projectField = field('Project / Initiative (optional)', projectSel);
    var newProjectBtn = el('button', 'btn btn-outline btn-sm'); newProjectBtn.type = 'button'; newProjectBtn.textContent = '+ New Project';
    newProjectBtn.style.marginTop = '6px';
    newProjectBtn.addEventListener('click', async function () {
      var name = prompt('New project/initiative name (e.g. "Office Search", "Marketing Campaign"):');
      if (!name || !name.trim()) return;
      var res = await sb.from('projects').insert({ name: name.trim(), created_by: state.user.id }).select().single();
      if (res.error) { toast('Could not create project: ' + res.error.message, true); return; }
      state.projects.push(res.data);
      var opt = new Option(res.data.name, res.data.id);
      projectSel.appendChild(opt);
      projectSel.value = res.data.id;
      toast('Project created.');
    });
    projectField.appendChild(newProjectBtn);
    wrap.appendChild(projectField);

    // Next Action deliberately NOT copied — the source item's next step
    // is specific to its own progress, not a sensible starting point for
    // a brand-new item.
    var nextActionInput = el('input'); nextActionInput.type = 'text';
    nextActionInput.placeholder = 'e.g. Send follow-up email to landlord';
    wrap.appendChild(field('Next Action (optional)', nextActionInput));

    if (src && prefill.checklistTitles && prefill.checklistTitles.length) {
      var checklistNote = el('p', 'desc');
      checklistNote.textContent = 'Checklist (' + prefill.checklistTitles.length + ' item' + (prefill.checklistTitles.length === 1 ? '' : 's') + ') will be copied, unchecked, once created.';
      wrap.appendChild(checklistNote);
    }

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = src ? 'Create Duplicate' : 'Create Firm Work';
    saveBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give it a title.', true); return; }
      if (!categorySel.value) { toast('Choose a category.', true); return; }
      if (!ownerSel.value) { toast('Choose an owner.', true); return; }
      saveBtn.disabled = true;
      var res = await sb.from('work_items').insert({
        work_scope: 'firm',
        title: titleInput.value.trim(),
        firm_category: categorySel.value,
        assignee_id: ownerSel.value,
        priority: prioritySel.value,
        internal_due_date: dueInput.value || null,
        description: descInput.value.trim() || null,
        project_id: projectSel.value || null,
        next_action: nextActionInput.value.trim() || null,
        created_by: state.user.id,
      }).select('id').single();
      if (res.error) { saveBtn.disabled = false; toast('Could not save: ' + res.error.message, true); return; }
      if (src && prefill.checklistTitles && prefill.checklistTitles.length) {
        var rows = prefill.checklistTitles.map(function (title, i) { return { work_item_id: res.data.id, title: title, sort_order: i }; });
        var clRes = await sb.from('work_checklist_items').insert(rows);
        if (clRes.error) toast('Created, but could not copy the checklist: ' + clRes.error.message, true);
      }
      saveBtn.disabled = false;
      closeModal();
      toast(src ? 'Duplicate created.' : 'Firm Work created.');
      onDone(res.data.id);
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // ============================================================
  // Personal to-do list — private scratchpad per user, not tied to any
  // client/work item/reviewer. RLS on personal_todos restricts every row to
  // its owner (auth.uid() = user_id), so unlike client credentials this
  // needs no SECURITY DEFINER function — plain table access is already
  // scoped correctly, even for admins looking at their own list.
  // ============================================================
  async function renderTodoPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'My To-Do List'; head.appendChild(h1);
    main.appendChild(head);

    var note = el('p', 'desc');
    note.style.marginTop = '-10px'; note.style.marginBottom = '16px';
    note.textContent = "Private to you — nobody else on the team can see this list.";
    main.appendChild(note);

    var card = el('div', 'card');

    var addRow = el('div');
    addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
    var input = el('input'); input.type = 'text'; input.placeholder = 'Add something to remember…';
    var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('Add'));
    addRow.appendChild(input); addRow.appendChild(addBtn);
    card.appendChild(addRow);

    var listWrap = el('div');
    card.appendChild(listWrap);
    main.appendChild(card);

    async function refresh() {
      clear(listWrap);
      var loading = el('p', 'desc'); loading.textContent = 'Loading…'; listWrap.appendChild(loading);
      var res = await sb.from('personal_todos').select('*').eq('user_id', state.user.id)
        .order('is_done').order('created_at', { ascending: false });
      clear(listWrap);
      if (res.error) { toast('Could not load your list: ' + res.error.message, true); return; }
      var items = res.data || [];
      if (!items.length) {
        var empty = el('p', 'desc'); empty.textContent = 'Nothing on your list yet.'; listWrap.appendChild(empty);
        return;
      }
      items.forEach(function (t) {
        var row = el('label', 'checklist-item' + (t.is_done ? ' done' : ''));
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = t.is_done;
        cb.addEventListener('change', async function () {
          var r = await sb.from('personal_todos').update({ is_done: cb.checked }).eq('id', t.id);
          if (r.error) { toast('Could not update: ' + r.error.message, true); cb.checked = !cb.checked; return; }
          row.classList.toggle('done', cb.checked);
        });
        var span = el('span'); span.textContent = t.text;
        var delBtn = el('button', 'todo-del'); delBtn.type = 'button'; delBtn.textContent = '×'; delBtn.title = 'Delete';
        delBtn.addEventListener('click', async function (e) {
          e.preventDefault();
          var r = await sb.from('personal_todos').delete().eq('id', t.id);
          if (r.error) { toast('Could not delete: ' + r.error.message, true); return; }
          refresh();
        });
        row.appendChild(cb); row.appendChild(span); row.appendChild(delBtn);
        listWrap.appendChild(row);
      });
    }
    await refresh();

    async function addItem() {
      var text = input.value.trim();
      if (!text) return;
      addBtn.disabled = true;
      var r = await sb.from('personal_todos').insert({ user_id: state.user.id, text: text });
      addBtn.disabled = false;
      if (r.error) { toast('Could not add: ' + r.error.message, true); return; }
      input.value = '';
      refresh();
    }
    addBtn.addEventListener('click', addItem);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
  }

  // ============================================================
  // Staff Profile + Internal Directory
  // The internal directory is operational only. It is deliberately not
  // connected to the public website Team page/content.
  // ============================================================
  function initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join('') || '?';
  }
  function profilePhotoFallback(p, large) {
    var fallback = el('div', 'profile-photo profile-photo-fallback' + (large ? ' profile-photo-lg' : ''));
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = initials(p && p.full_name);
    return fallback;
  }

  // Keep staff photos deliberately simple: an optional local /images/ path or
  // a public object URL from Maven's own Supabase project (the
  // "staff-photos" bucket the upload button below writes to). Arbitrary
  // remote image hosts are rejected so the value a user is allowed to save
  // always agrees with the Work Desk CSP.
  function allowedStaffPhotoUrl(value) {
    var v = (value || '').trim();
    if (!v) return '';
    if (v.indexOf('/images/') === 0 && v.indexOf('..') === -1) return v;
    try {
      var parsed = new URL(v);
      var supabaseOrigin = new URL(SUPABASE_URL).origin;
      if (parsed.origin === supabaseOrigin && parsed.pathname.indexOf('/storage/v1/object/public/') === 0) return parsed.href;
    } catch (err) {
      return null;
    }
    return null;
  }

  // Uploads to the "staff-photos" bucket (see
  // 20260903090000_staff_photo_upload.sql) under "{ownerId}/..." --
  // self-upload only, for every role including admin (the RLS policy only
  // allows writing into your own folder, by owner's explicit instruction).
  // Only ever called with the caller's own id in practice, but takes
  // ownerId as a param rather than reading state.user.id directly so the
  // one caller site stays explicit about whose folder it's writing to.
  // Returns the public URL allowedStaffPhotoUrl() above already knows how
  // to validate, or an error string.
  var STAFF_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
  var STAFF_PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  async function uploadStaffPhotoFile(file, ownerId) {
    var ext = STAFF_PHOTO_TYPES[file.type];
    if (!ext) return { error: 'Photo must be a JPG, PNG or WEBP image.' };
    if (file.size > STAFF_PHOTO_MAX_BYTES) return { error: 'Photo must be 2MB or smaller.' };
    var path = ownerId + '/' + Date.now() + '.' + ext;
    var up = await sb.storage.from('staff-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) return { error: up.error.message };
    var pub = sb.storage.from('staff-photos').getPublicUrl(path);
    return { url: pub.data.publicUrl };
  }

  function profilePhoto(p, large) {
    var src = allowedStaffPhotoUrl(p && p.photo_url);
    if (src) {
      var img = el('img', 'profile-photo' + (large ? ' profile-photo-lg' : ''));
      img.src = src; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', function () {
        if (img.parentNode) img.parentNode.replaceChild(profilePhotoFallback(p, large), img);
      }, { once: true });
      return img;
    }
    return profilePhotoFallback(p, large);
  }

  function renderDirectoryPage(main) {
    var head = el('div', 'page-head'); var h1 = el('h1'); h1.textContent = 'Staff Directory'; head.appendChild(h1); main.appendChild(head);
    var intro = el('p', 'workspace-intro'); intro.textContent = 'Internal Maven staff contacts and roles. This directory is separate from the public Team page.'; main.appendChild(intro);
    var grid = el('div', 'directory-grid');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) {
      var card = el('article', 'directory-card'); card.appendChild(profilePhoto(p, false));
      var body = el('div');
      var n = el('h3'); n.textContent = p.full_name || 'Unnamed staff'; body.appendChild(n);
      var role = el('div', 'dir-role'); role.textContent = p.designation || (p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : 'Team member'); body.appendChild(role);
      // Task 31: real mailto:/tel: links -- a directory's whole point is
      // reaching someone, so "click to email/call" beats plain text here,
      // even though the client-contact rows elsewhere in this app stay
      // plain text by their own established convention.
      if (p.work_email) { var em = el('div', 'dir-line'); var emLink = el('a'); emLink.href = 'mailto:' + p.work_email; emLink.textContent = p.work_email; em.appendChild(emLink); body.appendChild(em); }
      if (p.phone) { var ph = el('div', 'dir-line'); var phLink = el('a'); phLink.href = 'tel:' + p.phone.replace(/[^\d+]/g, ''); phLink.textContent = p.phone; ph.appendChild(phLink); body.appendChild(ph); }
      if (p.join_date) { var jd = el('div', 'dir-line'); jd.textContent = 'Joined ' + fmtDate(p.join_date); body.appendChild(jd); }
      card.appendChild(body); grid.appendChild(card);
    });
    main.appendChild(grid);
  }

  // Task 31: the profile page is deliberately split into two visually
  // distinct cards -- "Managed by Admin" (read-only, disabled inputs) and
  // "You Can Edit" (the two fields update_my_profile() actually allows a
  // self-update on, see that RPC's own scoping) -- instead of one mixed
  // grid with a hint paragraph at the bottom. The boundary this reflects
  // is real, not cosmetic: the admin-managed fields are read-only here
  // because the DB itself doesn't let a self-update touch them (see
  // 20260902090000_attendance_and_staff_profiles.sql), not because the
  // UI merely chose to disable them.
  function renderProfilePage(main) {
    var p = state.profile;
    var hero = el('div', 'card profile-hero');
    var photoWrap = el('div', 'profile-hero-photo-wrap');
    photoWrap.appendChild(profilePhoto(p, true));
    // Jumps straight to the real upload control below rather than opening
    // a picker inline here -- the hero stays a display element, the actual
    // upload/edit fields live in the "You Can Edit" card.
    var editPhotoBtn = el('button', 'profile-hero-edit-btn'); editPhotoBtn.type = 'button'; editPhotoBtn.textContent = 'Edit photo';
    editPhotoBtn.addEventListener('click', function () {
      photoFile.scrollIntoView({ block: 'center' });
      photoFile.focus();
    });
    photoWrap.appendChild(editPhotoBtn);
    hero.appendChild(photoWrap);
    var text = el('div'); var h1 = el('h1'); h1.textContent = p.full_name || 'My Profile'; text.appendChild(h1);
    var meta = el('div', 'profile-meta'); meta.textContent = (p.designation || 'Maven team member') + ' · ' + (p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : ''); text.appendChild(meta);
    hero.appendChild(text); main.appendChild(hero);

    var adminCard = el('div', 'card');
    var adminH2 = el('h2'); adminH2.appendChild(icon('idcard')); adminH2.appendChild(document.createTextNode('Managed by Admin')); adminCard.appendChild(adminH2);
    var adminNote = el('p', 'desc'); adminNote.textContent = "These fields aren't yours to change here -- ask an admin if any of them need updating."; adminCard.appendChild(adminNote);
    var adminGrid = el('div', 'profile-grid');
    function readOnly(label, value) { var inp = el('input'); inp.value = value || ''; inp.disabled = true; adminGrid.appendChild(field(label, inp)); }
    readOnly('Full name', p.full_name);
    readOnly('Designation', p.designation);
    readOnly('Role', p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : '');
    readOnly('Work email', p.work_email || state.user.email);
    readOnly('Join date', p.join_date ? fmtDate(p.join_date) : '');
    adminCard.appendChild(adminGrid);
    main.appendChild(adminCard);

    var editCard = el('div', 'card');
    var editH2 = el('h2'); editH2.appendChild(icon('user')); editH2.appendChild(document.createTextNode('You Can Edit')); editCard.appendChild(editH2);
    var editGrid = el('div', 'profile-grid');
    var phone = el('input'); phone.value = p.phone || ''; editGrid.appendChild(field('Phone', phone));
    var photo = el('input'); photo.type = 'text'; photo.placeholder = '/images/staff/name.jpg or Maven Supabase Storage URL'; photo.value = p.photo_url || ''; editGrid.appendChild(field('Profile photo (optional)', photo));
    var photoFile = el('input'); photoFile.type = 'file'; photoFile.accept = 'image/png,image/jpeg,image/webp';
    var photoFileField = field('Or upload a photo', photoFile); editGrid.appendChild(photoFileField);
    var photoStatus = el('p', 'f-hint'); photoStatus.style.margin = '2px 0 0'; photoFileField.appendChild(photoStatus);
    photoFile.addEventListener('change', async function () {
      var file = photoFile.files && photoFile.files[0];
      if (!file) return;
      photoStatus.textContent = 'Uploading…';
      photoFile.disabled = true;
      var res = await uploadStaffPhotoFile(file, state.user.id);
      photoFile.disabled = false;
      if (res.error) { photoStatus.textContent = res.error; toast(res.error, true); return; }
      photo.value = res.url;
      photoStatus.textContent = 'Uploaded — click Save My Profile below to keep it.';
    });
    editCard.appendChild(editGrid);
    var hint = el('p', 'f-hint'); hint.textContent = 'Upload a JPG, PNG or WEBP (2MB max), or paste a local /images/ path or a public Maven Supabase Storage URL directly. Leave blank and your initials are shown instead.'; editCard.appendChild(hint);
    var save = el('button', 'btn btn-sm'); save.type = 'button'; save.textContent = 'Save My Profile';
    save.addEventListener('click', async function () {
      var photoValue = allowedStaffPhotoUrl(photo.value);
      if (photoValue === null) { toast('Profile photo must be a local /images/ path or a public Maven Supabase Storage URL.', true); photo.focus(); return; }
      save.disabled = true;
      var res = await sb.rpc('update_my_profile', { p_phone: phone.value.trim(), p_photo_url: photoValue });
      save.disabled = false;
      if (res.error) { toast('Could not update profile: ' + res.error.message, true); return; }
      await loadProfiles();
      state.profile = state.profiles.find(function (x) { return x.id === state.user.id; }) || state.profile;
      qs('#whoName').textContent = state.profile.full_name || state.user.email;
      toast('Profile updated.'); render();
    });
    editCard.appendChild(save);
    main.appendChild(editCard);
  }

  // ============================================================
  // Attendance — punch in/out + Gregorian monthly calendar/summary.
  // No location, IP, device, presence or productivity tracking.
  // ============================================================
  function attendanceTodayDateStr() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var map = {}; parts.forEach(function (x) { if (x.type !== 'literal') map[x.type] = x.value; });
      return map.year + '-' + map.month + '-' + map.day;
    } catch (e) { return localDateStr(); }
  }
  function attendanceMonthBounds(monthKey) {
    var parts = monthKey.split('-'); var y = Number(parts[0]); var m = Number(parts[1]);
    var nextY = m === 12 ? y + 1 : y; var nextM = m === 12 ? 1 : m + 1;
    return { start: monthKey + '-01', next: nextY + '-' + String(nextM).padStart(2, '0') + '-01', year: y, month: m };
  }
  function attendanceSeconds(entry) {
    if (!entry || !entry.punched_in_at || !entry.punched_out_at) return 0;
    return Math.max(0, Math.round((new Date(entry.punched_out_at) - new Date(entry.punched_in_at)) / 1000));
  }
  function durationText(seconds) {
    seconds = Math.max(0, seconds || 0); var h = Math.floor(seconds / 3600); var min = Math.floor((seconds % 3600) / 60);
    return h + 'h ' + String(min).padStart(2, '0') + 'm';
  }
  function nepalDateTimeParts(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    var map = {}; parts.forEach(function (x) { if (x.type !== 'literal') map[x.type] = x.value; });
    return map;
  }
  function timeOnly(iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: 'numeric', minute: '2-digit' });
  }
  function datetimeLocalValue(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var p = nepalDateTimeParts(d);
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }
  // HTML datetime-local has no timezone. Attendance corrections are always
  // entered as Nepal local time, so convert the value explicitly using
  // Nepal's fixed UTC+05:45 offset instead of the admin's browser timezone.
  function nepalLocalInputToIso(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
    if (!m) return null;
    var utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) - (5 * 60 + 45) * 60 * 1000;
    var d = new Date(utcMs);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  function csvCell(value) { value = value == null ? '' : String(value); return '"' + value.replace(/"/g, '""') + '"'; }
  function nepalCsvDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var p = nepalDateTimeParts(d);
    return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute;
  }
  function downloadAttendanceCsv(entries, monthKey) {
    var rows = [['Work Date','Staff','Punch In (Nepal)','Punch Out (Nepal)','Total Hours','Status']];
    entries.forEach(function (r) {
      rows.push([r.work_date, profileName(r.user_id), nepalCsvDateTime(r.punched_in_at), nepalCsvDateTime(r.punched_out_at), (attendanceSeconds(r) / 3600).toFixed(2), r.punched_out_at ? 'Completed' : 'Open']);
    });
    var csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'maven-attendance-' + monthKey + '.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  async function loadAttendanceEntries(monthKey, personId) {
    var b = attendanceMonthBounds(monthKey);
    var q = sb.from('attendance_entries').select('*').gte('work_date', b.start).lt('work_date', b.next).order('work_date', { ascending: true });
    if (!isAdmin()) q = q.eq('user_id', state.user.id);
    else if (personId && personId !== '__all__') q = q.eq('user_id', personId);
    var res = await q; if (res.error) { toast('Could not load attendance: ' + res.error.message, true); return []; } return res.data || [];
  }
  async function loadTodayAttendance() {
    var res = await sb.from('attendance_entries').select('*').eq('user_id', state.user.id).eq('work_date', attendanceTodayDateStr()).maybeSingle();
    if (res.error) return null; return res.data || null;
  }
  async function loadAttendanceCorrections(monthKey, personId) {
    var b = attendanceMonthBounds(monthKey);
    var q = sb.from('attendance_corrections').select('*').gte('work_date', b.start).lt('work_date', b.next).order('corrected_at', { ascending: false });
    if (!isAdmin()) q = q.eq('user_id', state.user.id);
    else if (personId && personId !== '__all__') q = q.eq('user_id', personId);
    var res = await q;
    if (res.error) { toast('Could not load attendance correction history: ' + res.error.message, true); return []; }
    return res.data || [];
  }
  function correctionChangeText(r) {
    var oldIn = r.old_punched_in_at ? timeOnly(r.old_punched_in_at) : 'none';
    var oldOut = r.old_punched_out_at ? timeOnly(r.old_punched_out_at) : 'none';
    var newIn = timeOnly(r.new_punched_in_at);
    var newOut = r.new_punched_out_at ? timeOnly(r.new_punched_out_at) : 'open';
    return 'In ' + oldIn + ' → ' + newIn + ' · Out ' + oldOut + ' → ' + newOut;
  }
  // Task 30: priority position 6/7 ("corrections" + "audit history") --
  // this table IS the audit history; the "Correct"/"Add Missing Record"
  // buttons that create the entries it shows live on the records table
  // (renderAttendanceRecordsTable) directly above it, so the two stay
  // visually adjacent.
  function renderAttendanceCorrectionHistory(main, corrections, personId) {
    if (!corrections.length) return;
    var card = el('div', 'card');
    var h2 = el('h2'); h2.textContent = 'Correction history'; card.appendChild(h2);
    var note = el('p', 'desc'); note.textContent = 'Attendance corrections are preserved with the reason and the admin who made the change.'; card.appendChild(note);
    // Task 30: mobile-safe -- wide tables (Date/Staff/Change/Reason/
    // Corrected by can exceed a phone's width) scroll horizontally
    // within their own card rather than forcing the page body wider,
    // same convention already established for the Firm Work list table.
    var tableScroll = el('div'); tableScroll.style.cssText = 'overflow-x:auto;';
    var table = el('table'); var hd = el('thead'); var trh = el('tr');
    var heads = ['Date'];
    if (isAdmin() && personId === '__all__') heads.push('Staff');
    heads = heads.concat(['Change', 'Reason', 'Corrected by']);
    heads.forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    hd.appendChild(trh); table.appendChild(hd);
    var tb = el('tbody');
    corrections.forEach(function (r) {
      var tr = el('tr');
      function td(v) { var x = el('td'); x.textContent = v; tr.appendChild(x); }
      td(fmtDate(r.work_date));
      if (isAdmin() && personId === '__all__') td(profileName(r.user_id));
      td(correctionChangeText(r)); td(r.reason || '—'); td(profileName(r.corrected_by));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    tableScroll.appendChild(table);
    card.appendChild(tableScroll);
    main.appendChild(card);
  }
  // Task 30: priority position 3 ("own monthly history") -- a compact
  // numeric summary of the selected person's selected month, ahead of
  // both the day-by-day records table and the calendar.
  function renderAttendanceMetrics(main, entries) {
    var complete = entries.filter(function (r) { return !!r.punched_out_at; });
    var total = complete.reduce(function (sum, r) { return sum + attendanceSeconds(r); }, 0);
    var vals = [
      ['Punch days', entries.length],
      ['Completed days', complete.length],
      ['Open / incomplete', entries.length - complete.length],
      ['Total time', durationText(total)],
    ];
    var grid = el('div', 'metric-grid');
    vals.forEach(function (v) {
      var c = el('div', 'metric-card');
      var l = el('span', 'metric-label'); l.textContent = v[0];
      var x = el('span', 'metric-value'); x.textContent = String(v[1]);
      c.appendChild(l); c.appendChild(x);
      grid.appendChild(c);
    });
    main.appendChild(grid);
  }
  // Task 30: priority position 4 ("calendar") -- a visual complement to
  // the records table above it, not a replacement for it. "No record"
  // stays the neutral label for a day with nothing logged (see this
  // function's own day-status text below) -- this app has no separate
  // leave/absence tracking, so a blank day is never asserted to mean
  // anything more specific than "nothing was punched."
  function renderAttendanceCalendar(main, entries, monthKey) {
    var b = attendanceMonthBounds(monthKey);
    var card = el('div', 'card');
    var h2 = el('h2'); h2.textContent = 'Monthly calendar'; card.appendChild(h2);
    var byDate = {};
    entries.forEach(function (r) { byDate[r.work_date] = r; });
    var cal = el('div', 'attendance-calendar');
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) {
      var x = el('div', 'cal-head'); x.textContent = d; cal.appendChild(x);
    });
    var first = new Date(b.year, b.month - 1, 1);
    var days = new Date(b.year, b.month, 0).getDate();
    for (var blank = 0; blank < first.getDay(); blank++) cal.appendChild(el('div', 'cal-day is-empty'));
    for (var day = 1; day <= days; day++) {
      var ds = b.year + '-' + String(b.month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var r = byDate[ds];
      var cell = el('div', 'cal-day' + (r ? ' has-record ' + (r.punched_out_at ? 'is-complete' : 'is-open') : ''));
      var n = el('div', 'day-num'); n.textContent = String(day); cell.appendChild(n);
      var st = el('div', 'day-status');
      st.textContent = r ? (r.punched_out_at ? durationText(attendanceSeconds(r)) : 'Punched in') : 'No record';
      cell.appendChild(st);
      cal.appendChild(cell);
    }
    card.appendChild(cal);
    main.appendChild(card);
  }
  // Task 30: priority position 5 ("admin team view") -- deliberately
  // last among the three data views (own history, calendar, team view),
  // and only ever rendered in place of the individual calendar (never
  // alongside it -- see renderAttendancePage's refreshResults), since an
  // "everyone at once" table has no single person's calendar to pair
  // with. Plain punch-day/completed/open/total-time counts only -- no
  // productivity or ranking metric of any kind, and staff stay in their
  // existing (alphabetical) load order, never sorted by these numbers.
  function renderTeamAttendanceSummary(main, entries) {
    if (!isAdmin()) return;
    var by = {};
    entries.forEach(function (r) { if (!by[r.user_id]) by[r.user_id] = []; by[r.user_id].push(r); });
    var card = el('div', 'card');
    var h2 = el('h2'); h2.textContent = 'Team monthly summary'; card.appendChild(h2);
    // Task 30: mobile-safe -- same overflow-x:auto convention as the
    // other attendance tables (see renderAttendanceCorrectionHistory).
    var tableScroll = el('div'); tableScroll.style.cssText = 'overflow-x:auto;';
    var table = el('table');
    var thd = el('thead'); var trh = el('tr');
    ['Staff', 'Punch days', 'Completed', 'Open', 'Total time'].forEach(function (t) {
      var th = el('th'); th.textContent = t; trh.appendChild(th);
    });
    thd.appendChild(trh); table.appendChild(thd);
    var tb = el('tbody');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) {
      var arr = by[p.id] || [];
      var comp = arr.filter(function (r) { return r.punched_out_at; });
      var sec = comp.reduce(function (sum, r) { return sum + attendanceSeconds(r); }, 0);
      var tr = el('tr');
      [p.full_name, arr.length, comp.length, arr.length - comp.length, durationText(sec)].forEach(function (v) {
        var td = el('td'); td.textContent = String(v); tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    tableScroll.appendChild(table);
    card.appendChild(tableScroll);
    main.appendChild(card);
  }
  function openAttendanceCorrection(entry, selectedPerson, monthKey, onSaved) {
    if (!isAdmin()) return;
    var wrap=el('div');var head=el('div','modal-head');var h2=el('h2');h2.textContent=entry?'Correct Attendance':'Add Missing Attendance';var cancel=el('button','btn btn-outline btn-sm');cancel.type='button';cancel.textContent='Cancel';cancel.addEventListener('click',closeModal);head.appendChild(h2);head.appendChild(cancel);wrap.appendChild(head);
    var person=el('select');state.profiles.filter(function(p){return p.is_active;}).forEach(function(p){person.appendChild(new Option(p.full_name,p.id));});person.value=entry?entry.user_id:(selectedPerson&&selectedPerson!=='__all__'?selectedPerson:state.user.id);wrap.appendChild(field('Staff member',person));
    var date=el('input');date.type='date';date.value=entry?entry.work_date:attendanceTodayDateStr();wrap.appendChild(field('Work date (Gregorian)',date));
    var pin=el('input');pin.type='datetime-local';pin.value=entry?datetimeLocalValue(entry.punched_in_at):'';wrap.appendChild(field('Punch in (Nepal time)',pin));
    var pout=el('input');pout.type='datetime-local';pout.value=entry?datetimeLocalValue(entry.punched_out_at):'';wrap.appendChild(field('Punch out (Nepal time, optional)',pout));
    var reason=el('textarea');reason.rows=3;reason.placeholder='Required: why is this record being corrected?';wrap.appendChild(field('Correction reason',reason));
    var actions=el('div','modal-actions');var save=el('button','btn');save.type='button';save.textContent='Save Correction';save.addEventListener('click',async function(){if(!person.value||!date.value||!pin.value||reason.value.trim().length<3){toast('Staff, date, punch-in and a correction reason are required.',true);return;}var inIso=nepalLocalInputToIso(pin.value);var outIso=pout.value?nepalLocalInputToIso(pout.value):null;if(!inIso||(pout.value&&!outIso)){toast('Enter valid Nepal punch times.',true);return;}if(outIso&&new Date(outIso)<new Date(inIso)){toast('Punch-out cannot be earlier than punch-in.',true);return;}save.disabled=true;var res=await sb.rpc('attendance_admin_correct',{p_user_id:person.value,p_work_date:date.value,p_punched_in_at:inIso,p_punched_out_at:outIso,p_reason:reason.value.trim()});save.disabled=false;if(res.error){toast('Could not correct attendance: '+res.error.message,true);return;}closeModal();toast('Attendance correction saved with audit history.');if(onSaved)onSaved();});actions.appendChild(save);wrap.appendChild(actions);openModal(wrap);
  }
  // Task 30: priority position 3 ("own monthly history") -- the actual
  // day-by-day record, ahead of the calendar. Admin-only Correct/Add
  // controls live here, right next to the data they act on; the audit
  // trail those actions produce is the separate Correction History card
  // immediately after this one (see renderAttendancePage).
  function renderAttendanceRecordsTable(main, entries, personId, monthKey, onCorrected) {
    var card = el('div', 'card');
    var hh = el('h2'); hh.textContent = 'Attendance records'; card.appendChild(hh);
    if (isAdmin()) {
      var add = el('button', 'btn btn-outline btn-sm'); add.type = 'button';
      add.textContent = 'Add / Correct Missing Record'; add.style.marginBottom = '14px';
      add.addEventListener('click', function () { openAttendanceCorrection(null, personId, monthKey, onCorrected); });
      card.appendChild(add);
    }
    if (!entries.length) {
      var none = el('div', 'empty-note'); none.textContent = 'No attendance records for this month.'; card.appendChild(none);
      main.appendChild(card);
      return;
    }
    // Task 30: mobile-safe -- same overflow-x:auto convention as the
    // other attendance tables.
    var tableScroll = el('div'); tableScroll.style.cssText = 'overflow-x:auto;';
    var table = el('table');
    var hd = el('thead'); var trh = el('tr');
    var heads = ['Date'];
    if (isAdmin() && personId === '__all__') heads.push('Staff');
    heads = heads.concat(['Punch In', 'Punch Out', 'Total', 'Status']);
    if (isAdmin()) heads.push('');
    heads.forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    hd.appendChild(trh); table.appendChild(hd);
    var tb = el('tbody');
    entries.forEach(function (r) {
      var tr = el('tr');
      function td(v) { var x = el('td'); x.textContent = v; tr.appendChild(x); }
      td(fmtDate(r.work_date));
      if (isAdmin() && personId === '__all__') td(profileName(r.user_id));
      td(timeOnly(r.punched_in_at));
      td(timeOnly(r.punched_out_at));
      td(r.punched_out_at ? durationText(attendanceSeconds(r)) : '—');
      var st = el('td');
      var pill = el('span', 'attendance-status-pill ' + (r.punched_out_at ? 'complete' : 'open'));
      pill.textContent = r.punched_out_at ? 'Completed' : 'Open';
      st.appendChild(pill); tr.appendChild(st);
      if (isAdmin()) {
        var act = el('td');
        var edit = el('button', 'btn btn-outline btn-sm'); edit.type = 'button'; edit.textContent = 'Correct';
        edit.addEventListener('click', function () { openAttendanceCorrection(r, personId, monthKey, onCorrected); });
        act.appendChild(edit); tr.appendChild(act);
      }
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    tableScroll.appendChild(table);
    card.appendChild(tableScroll);
    main.appendChild(card);
  }

  async function renderAttendancePage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Attendance'; head.appendChild(h1);
    main.appendChild(head);
    var intro = el('p', 'workspace-intro');
    intro.textContent = isAdmin()
      ? 'Punch in/out for your own day, review team attendance, export monthly CSV, and correct records with an audit reason.'
      : 'Punch in/out and review your own monthly attendance. Other employees\' attendance is private to admins.';
    main.appendChild(intro);

    // ---- Priority 1: today's punch status ----
    var punchCard = el('div', 'card attendance-punch-card');
    var pLeft = el('div');
    var ph = el('h2'); ph.textContent = 'Today · ' + fmtDate(attendanceTodayDateStr()); pLeft.appendChild(ph);
    // Task 30, priority 2: Nepal time stated immediately next to today's
    // status, as an actual current value -- not just the "(UTC+05:45)"
    // parenthetical buried in the paragraph below, which is easy to skim
    // past.
    var nepalNowLine = el('div', 'nepal-now-line');
    nepalNowLine.textContent = 'Nepal time now: ' + timeOnly(new Date().toISOString());
    pLeft.appendChild(nepalNowLine);
    var pd = el('p', 'desc');
    pd.textContent = 'One punch-in and one punch-out per Gregorian work date, using Nepal time (UTC+05:45). No location, IP or device data is collected.';
    pLeft.appendChild(pd);
    var stateLine = el('div', 'punch-state'); pLeft.appendChild(stateLine);
    punchCard.appendChild(pLeft);
    var actionWrap = el('div'); punchCard.appendChild(actionWrap);
    main.appendChild(punchCard);

    async function refreshPunch() {
      clear(stateLine); clear(actionWrap);
      var today = await loadTodayAttendance();
      if (!today) {
        stateLine.textContent = 'Not punched in yet.';
        var b = el('button', 'btn'); b.type = 'button'; b.textContent = 'Punch In';
        b.addEventListener('click', async function () {
          b.disabled = true;
          var r = await sb.rpc('attendance_punch_in');
          b.disabled = false;
          if (r.error) { toast('Punch in failed: ' + r.error.message, true); return; }
          toast('Punched in.');
          render();
        });
        actionWrap.appendChild(b);
      } else if (!today.punched_out_at) {
        stateLine.textContent = 'Punched in ' + timeOnly(today.punched_in_at) + ' · currently open';
        var b2 = el('button', 'btn'); b2.type = 'button'; b2.textContent = 'Punch Out';
        b2.addEventListener('click', async function () {
          b2.disabled = true;
          var r = await sb.rpc('attendance_punch_out');
          b2.disabled = false;
          if (r.error) { toast('Punch out failed: ' + r.error.message, true); return; }
          toast('Punched out.');
          render();
        });
        actionWrap.appendChild(b2);
      } else {
        stateLine.textContent = 'In ' + timeOnly(today.punched_in_at) + ' · Out ' + timeOnly(today.punched_out_at) + ' · ' + durationText(attendanceSeconds(today));
        var done = el('span', 'attendance-status-pill complete'); done.textContent = 'Completed';
        actionWrap.appendChild(done);
      }
    }
    await refreshPunch();

    // ---- Filter controls (Month / Staff view) -- inputs governing
    // everything below, kept near the top for reachability; the actual
    // Export CSV action stays with the data it exports (see the bottom
    // of refreshResults), matching this task's explicit priority order.
    var controlsCard = el('div', 'card');
    var controls = el('div', 'attendance-controls');
    var month = el('input'); month.type = 'month'; month.value = attendanceTodayDateStr().slice(0, 7);
    controls.appendChild(field('Month', month));
    var person = null;
    if (isAdmin()) {
      person = el('select');
      person.appendChild(new Option('All staff', '__all__'));
      state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { person.appendChild(new Option(p.full_name, p.id)); });
      // Task 30: defaults to the admin's OWN record ("own monthly
      // history" outranks "admin team view" in this task's own priority
      // order), not "All staff" -- switching to the team view is then a
      // deliberate choice, not what loads first.
      person.value = state.user.id;
      controls.appendChild(field('Staff view', person));
    } else {
      var own = el('input'); own.value = state.profile.full_name; own.disabled = true;
      controls.appendChild(field('Staff', own));
    }
    controlsCard.appendChild(controls);
    main.appendChild(controlsCard);

    var results = el('div'); main.appendChild(results);

    async function refreshResults() {
      clear(results);
      var personId = isAdmin() ? person.value : state.user.id;
      var loaded = await Promise.all([loadAttendanceEntries(month.value, personId), loadAttendanceCorrections(month.value, personId)]);
      var entries = loaded[0], corrections = loaded[1];
      var viewingAllStaff = isAdmin() && personId === '__all__';

      // Priority 3: own (or selected person's) monthly history.
      renderAttendanceMetrics(results, entries);
      renderAttendanceRecordsTable(results, entries, personId, month.value, refreshResults);
      // Priority 4 / 5: the calendar only makes sense for one person at a
      // time; "All staff" shows the team view instead, never both.
      if (viewingAllStaff) renderTeamAttendanceSummary(results, entries);
      else renderAttendanceCalendar(results, entries, month.value);
      // Priority 6 / 7: corrections' own audit trail.
      renderAttendanceCorrectionHistory(results, corrections, personId);

      // Priority 8: CSV export, last -- a card of its own rather than a
      // stray button in the top filter row.
      var exportCard = el('div', 'card');
      var exportP = el('p', 'desc'); exportP.style.margin = '0 0 10px';
      exportP.textContent = 'Export ' + (viewingAllStaff ? 'the whole team\'s' : 'this') + ' selected month\'s attendance records as CSV.';
      exportCard.appendChild(exportP);
      var exportBtn = el('button', 'btn btn-outline btn-sm'); exportBtn.type = 'button'; exportBtn.textContent = 'Export CSV';
      exportBtn.addEventListener('click', function () { downloadAttendanceCsv(entries, month.value); });
      exportCard.appendChild(exportBtn);
      results.appendChild(exportCard);
    }
    month.addEventListener('change', refreshResults);
    if (person) person.addEventListener('change', refreshResults);
    await refreshResults();
  }

  // ============================================================
  // Admin: Staff (role assignment + activation)
  // ============================================================
  function openStaffProfileModal(p2) {
    var wrap=el('div');var head=el('div','modal-head');var h2=el('h2');h2.textContent='Edit Staff Profile';var cancel=el('button','btn btn-outline btn-sm');cancel.type='button';cancel.textContent='Cancel';cancel.addEventListener('click',closeModal);head.appendChild(h2);head.appendChild(cancel);wrap.appendChild(head);
    var name=el('input');name.value=p2.full_name||'';wrap.appendChild(field('Full name',name));
    var designation=el('input');designation.value=p2.designation||'';wrap.appendChild(field('Designation',designation));
    var email=el('input');email.type='email';email.value=p2.work_email||'';wrap.appendChild(field('Work email',email));
    var phone=el('input');phone.value=p2.phone||'';wrap.appendChild(field('Phone',phone));
    var join=el('input');join.type='date';join.value=p2.join_date||'';wrap.appendChild(field('Join date (Gregorian)',join));
    var photo=el('input');photo.type='text';photo.value=p2.photo_url||'';photo.placeholder='/images/staff/name.jpg or Maven Supabase Storage URL';wrap.appendChild(field('Profile photo (optional)',photo));
    var photoHint=el('p','f-hint');photoHint.textContent='A local /images/ path or a public Maven Supabase Storage URL. Photo file upload is self-service only -- each person uploads their own from My Profile; an admin can only paste an already-hosted URL here, never upload a file for someone else. Leave blank to show initials.';wrap.appendChild(photoHint);
    var actions=el('div','modal-actions');var save=el('button','btn');save.type='button';save.textContent='Save Profile';save.addEventListener('click',async function(){if(!name.value.trim()){toast('Full name is required.',true);return;}var photoValue=allowedStaffPhotoUrl(photo.value);if(photoValue===null){toast('Profile photo must be a local /images/ path or a public Maven Supabase Storage URL.',true);photo.focus();return;}save.disabled=true;var res=await sb.from('profiles').update({full_name:name.value.trim(),designation:designation.value.trim()||null,work_email:email.value.trim()||null,phone:phone.value.trim()||null,join_date:join.value||null,photo_url:photoValue||null}).eq('id',p2.id);save.disabled=false;if(res.error){toast('Could not update staff profile: '+res.error.message,true);return;}closeModal();await loadProfiles();if(p2.id===state.user.id)state.profile=state.profiles.find(function(x){return x.id===state.user.id;})||state.profile;toast('Staff profile updated.');render();});actions.appendChild(save);wrap.appendChild(actions);openModal(wrap);
  }

  // Task 32: a role downgrade away from Reviewer/Admin down to Employee
  // can silently strand review responsibility exactly the way
  // deactivating someone with open assigned work would (see
  // confirmDeactivateStaff's own comment) -- guard_work_item_update()'s
  // reviewer-action branch requires BOTH current_user_role() = 'reviewer'
  // AND reviewer_id = auth.uid(), so the instant someone's role changes
  // to 'employee', they lose the ability to act as reviewer on any item
  // still pointing at them as reviewer_id, even though nothing about
  // those items changed. This is a warning, not a hard block: an admin
  // can always fix an affected item later via its own Edit Basics/Edit
  // Work reviewer field, so continuing anyway is a legitimate choice,
  // just never a silent one.
  async function confirmRoleChange(p2, newRole, roleSel, prevRole) {
    var losesReviewerPower = (prevRole === 'reviewer' || prevRole === 'admin') && newRole === 'employee';
    if (!losesReviewerPower) {
      await applyRoleChange(p2, newRole, roleSel, prevRole);
      return;
    }
    var res = await sb.from('work_items').select('*').eq('work_scope', 'client').eq('reviewer_id', p2.id).neq('status', 'completed');
    if (res.error) { toast('Could not check their review queue: ' + res.error.message, true); roleSel.value = prevRole; return; }
    var reviewing = res.data || [];
    if (!reviewing.length) {
      await applyRoleChange(p2, newRole, roleSel, prevRole);
      return;
    }

    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Reassign Reviewer Before Changing Role';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', function () { roleSel.value = prevRole; closeModal(); });
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var p = el('p', 'desc');
    p.textContent = p2.full_name + ' is still the reviewer on ' + reviewing.length + ' open Client Work item' + (reviewing.length === 1 ? '' : 's') + '. Once they\'re Employee, they can no longer act as reviewer on those — reassign the reviewer first, or continue anyway and fix it later.';
    wrap.appendChild(p);

    var list = el('ul'); list.style.paddingLeft = '18px'; list.style.listStyle = 'disc'; list.style.marginBottom = '14px';
    reviewing.forEach(function (w) { var li = el('li'); li.textContent = w.title + (w.period ? ' (' + w.period + ')' : ''); list.appendChild(li); });
    wrap.appendChild(list);

    var reviewerSel = el('select');
    reviewerSel.appendChild(new Option('— Leave as is, fix later —', ''));
    state.profiles.filter(function (p3) { return p3.is_active && p3.id !== p2.id && (p3.role === 'reviewer' || p3.role === 'admin'); })
      .forEach(function (p3) { reviewerSel.appendChild(new Option(p3.full_name, p3.id)); });
    wrap.appendChild(field('Reassign reviewer on the above to', reviewerSel));

    var actions = el('div', 'modal-actions');
    var confirmBtn = el('button', 'btn'); confirmBtn.type = 'button';
    confirmBtn.textContent = 'Continue';
    confirmBtn.addEventListener('click', async function () {
      confirmBtn.disabled = true;
      if (reviewerSel.value) {
        var reassignRes = await sb.from('work_items').update({ reviewer_id: reviewerSel.value }).eq('reviewer_id', p2.id).eq('work_scope', 'client').neq('status', 'completed');
        if (reassignRes.error) { confirmBtn.disabled = false; toast('Could not reassign reviewer: ' + reassignRes.error.message, true); return; }
      }
      closeModal();
      await applyRoleChange(p2, newRole, roleSel, prevRole);
    });
    actions.appendChild(confirmBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }
  async function applyRoleChange(p2, newRole, roleSel, prevRole) {
    var res = await sb.from('profiles').update({ role: newRole }).eq('id', p2.id);
    if (res.error) { toast('Could not update role: ' + res.error.message, true); roleSel.value = prevRole; return; }
    p2.role = newRole;
    toast(p2.full_name + ' is now ' + newRole + '.');
  }

  // Calls the "create-staff-account" Edge Function (see
  // supabase/functions/create-staff-account/index.ts) — the only place in
  // this project allowed to call the Auth Admin API, since that requires
  // the service-role key, which must never reach browser code. The
  // function does its own admin+active check server-side too (defense in
  // depth), so this modal being reachable only from an admin-only page is
  // not the real security boundary here, same as everywhere else in
  // Work Desk.
  function openCreateStaffModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head'); var h2 = el('h2'); h2.textContent = 'Create New Staff';
    var cancel = el('button', 'btn btn-outline btn-sm'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(cancel); wrap.appendChild(head);

    var note = el('p', 'f-hint'); note.textContent = 'Sends a real Supabase sign-in invite by email — the new hire sets their own password by clicking the link. No password is ever typed or stored here.'; wrap.appendChild(note);

    var email = el('input'); email.type = 'email'; wrap.appendChild(field('Work email', email));
    var name = el('input'); wrap.appendChild(field('Full name', name));
    var designation = el('input'); wrap.appendChild(field('Designation (optional)', designation));
    var roleSel = el('select');
    ['employee', 'reviewer', 'admin'].forEach(function (r) { roleSel.appendChild(new Option(r.charAt(0).toUpperCase() + r.slice(1), r)); });
    wrap.appendChild(field('Role', roleSel));

    var actions = el('div', 'modal-actions');
    var send = el('button', 'btn'); send.type = 'button'; send.textContent = 'Send Invite';
    send.addEventListener('click', async function () {
      var emailValue = email.value.trim();
      if (!emailValue || !name.value.trim()) { toast('Work email and full name are required.', true); return; }
      send.disabled = true;
      var res, body;
      try {
        var sessionRes = await sb.auth.getSession();
        var token = sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token;
        if (!token) { toast('Your session has expired — please sign in again.', true); send.disabled = false; return; }
        res = await fetch(SUPABASE_URL + '/functions/v1/create-staff-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ email: emailValue, full_name: name.value.trim(), designation: designation.value.trim() || null, role: roleSel.value }),
        });
        body = await res.json().catch(function () { return {}; });
      } catch (err) {
        toast('Could not reach the invite service: ' + err.message, true);
        send.disabled = false;
        return;
      }
      send.disabled = false;
      if (!res.ok) { toast('Could not send invite: ' + (body.error || res.statusText), true); return; }
      closeModal();
      await loadProfiles();
      render();
      toast(body.warning || ('Invite sent to ' + emailValue + '.'), !!body.warning);
    });
    actions.appendChild(send); wrap.appendChild(actions);
    openModal(wrap);
  }

  function renderStaff(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Staff & Access'; head.appendChild(h1);
    main.appendChild(head);

    var intro = el('div', 'card');
    var p = el('p', 'desc'); p.style.margin = '0 0 8px';
    p.textContent = 'Create New Staff sends a real sign-in invite by email — the new hire clicks the link and sets their own password. Work Desk never asks for or stores a Supabase service-role key: the invite is sent by a small server-side function, not by this page directly, so it only works once that function has been deployed once (see the setup note this page\'s owner was given). Until then, create the login directly in the Supabase Dashboard instead (Authentication → Users → Add User). Once an account exists, a matching profile row is created automatically; manage their internal profile, role and active access here. Public website Team profiles remain separate.';
    intro.appendChild(p);
    var roleLegend = el('p', 'f-hint');
    roleLegend.textContent = 'Employee: own work only. Reviewer: + can review/approve work where they\'re the assigned reviewer. Admin: full access, including Staff & Access itself.';
    intro.appendChild(roleLegend);
    var createBtn = el('button', 'btn btn-sm'); createBtn.type = 'button'; createBtn.textContent = 'Create New Staff';
    createBtn.style.marginTop = '8px';
    createBtn.addEventListener('click', openCreateStaffModal);
    intro.appendChild(createBtn);
    main.appendChild(intro);

    var card = el('div', 'card');
    // Task 32: mobile-safe -- same overflow-x:auto convention used
    // throughout this app's other wide tables.
    var tableScroll = el('div'); tableScroll.style.cssText = 'overflow-x:auto;';
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Name', 'Designation', 'Role', 'Status', 'Profile'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    state.profiles.forEach(function (p2) {
      var isSelf = p2.id === state.user.id;
      var tr = el('tr', p2.is_active ? '' : 'inactive-row');

      var tdName = el('td');
      var tdNameWrap = el('div'); tdNameWrap.style.cssText = 'display:flex;align-items:center;gap:9px;';
      tdNameWrap.appendChild(avatarFor(p2.id, 'avatar-sm'));
      var tdNameText = el('span'); tdNameText.textContent = p2.full_name + (isSelf ? ' (you)' : ''); tdNameWrap.appendChild(tdNameText);
      tdName.appendChild(tdNameWrap); tr.appendChild(tdName);
      var tdDes = el('td'); tdDes.textContent = p2.designation || '—'; tr.appendChild(tdDes);

      var tdRole = el('td');
      var roleSel = el('select', 'role-select');
      ['employee', 'reviewer', 'admin'].forEach(function (r) { roleSel.appendChild(new Option(r.charAt(0).toUpperCase() + r.slice(1), r)); });
      roleSel.value = p2.role;
      roleSel.disabled = isSelf;
      roleSel.addEventListener('change', function () {
        var prevRole = p2.role;
        confirmRoleChange(p2, roleSel.value, roleSel, prevRole);
      });
      tdRole.appendChild(roleSel); tr.appendChild(tdRole);

      // Task 32: an actual Active/Inactive status pill, not just the
      // action button that used to be this whole column -- "Status" was
      // the header, but the cell only ever showed what you could DO, not
      // what the state currently WAS.
      var tdStatus = el('td');
      var statusPill = el('span', 'status-pill ' + (p2.is_active ? 'active' : 'inactive'));
      statusPill.textContent = p2.is_active ? 'Active' : 'Inactive';
      tdStatus.appendChild(statusPill);
      var toggle = el('button', 'btn btn-outline btn-sm'); toggle.type = 'button';
      toggle.style.marginLeft = '8px';
      toggle.textContent = p2.is_active ? 'Deactivate' : 'Reactivate';
      toggle.disabled = isSelf;
      toggle.addEventListener('click', async function () {
        if (!p2.is_active) {
          var r = await sb.from('profiles').update({ is_active: true }).eq('id', p2.id);
          if (r.error) { toast('Could not update: ' + r.error.message, true); return; }
          await loadProfiles();
          render();
          return;
        }
        await confirmDeactivateStaff(p2);
      });
      tdStatus.appendChild(toggle); tr.appendChild(tdStatus);

      var tdEdit = el('td');
      var edit = el('button', 'btn btn-outline btn-sm'); edit.type = 'button'; edit.textContent = 'Edit';
      edit.addEventListener('click', function () { openStaffProfileModal(p2); });
      tdEdit.appendChild(edit); tr.appendChild(tdEdit);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableScroll.appendChild(table);
    card.appendChild(tableScroll);
    main.appendChild(card);
  }

  // ============================================================
  // Settings — a small, flat list of day-count thresholds (Workflow
  // Settings, V2 Task 18), not a general-purpose settings framework.
  // Every field here already existed as a hardcoded number somewhere in
  // this file; this page just gives an admin a place to change it
  // without editing code. All five are either read-time thresholds
  // (Manager Dashboard's exceptions) or one-time form pre-fills (New
  // Template, Waiting for Client) — none of them are ever copied onto an
  // existing work_items/service_templates row, so changing a value here
  // never rewrites anything that already exists, only what a live
  // computation flags or a NEW form starts pre-filled with from now on.
  // ============================================================
  function renderSettingsPage(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Settings'; head.appendChild(h1);
    main.appendChild(head);

    var intro = el('div', 'card');
    var introP = el('p', 'desc'); introP.style.margin = '0';
    introP.textContent = 'Workflow defaults used across Work Desk. Changing a value here never rewrites existing work — only what counts as an exception going forward, or what a new form starts pre-filled with. This is business-preference thresholds only, never a statutory deadline — those are governed separately, per service, on the Templates page ("Manage Deadline Rule"), source-cited and verified, not editable as a plain number.';
    intro.appendChild(introP);
    main.appendChild(intro);

    var card = el('div', 'card');
    var keys = Object.keys(WORKFLOW_SETTING_DEFAULTS);
    var inputs = {};
    keys.forEach(function (key) {
      var input = el('input'); input.type = 'number'; input.min = '0'; input.step = '1';
      input.value = String(state.settings[key]);
      inputs[key] = input;
      var fieldWrap = field(WORKFLOW_SETTING_LABELS[key], input);
      var help = el('p', 'f-hint'); help.style.marginTop = '2px'; help.textContent = WORKFLOW_SETTING_HELP[key];
      fieldWrap.appendChild(help);
      card.appendChild(fieldWrap);
    });

    var actions = el('div', 'modal-actions'); actions.style.marginTop = '6px';
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Settings';
    saveBtn.addEventListener('click', async function () {
      // Validate every field before saving any of them — a partial save
      // (some thresholds updated, others rejected) would leave Settings
      // showing values that don't match what's actually in the database.
      var parsed = {};
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var raw = inputs[key].value.trim();
        var n = Number(raw);
        if (raw === '' || !Number.isInteger(n) || n < 0) {
          toast(WORKFLOW_SETTING_LABELS[key] + ' must be a whole number, 0 or greater.', true);
          return;
        }
        parsed[key] = n;
      }
      saveBtn.disabled = true;
      // upsert, not update: an UPDATE ... WHERE key = X silently touches
      // zero rows (no error) if that key's row is somehow missing —
      // e.g. the seed migration hasn't run yet, or a row was deleted by
      // hand — which would show "Settings saved" while one value quietly
      // never persisted. Upsert self-heals that instead of failing silent.
      var rows = keys.map(function (key) { return { key: key, value: String(parsed[key]) }; });
      var res = await sb.from('app_settings').upsert(rows, { onConflict: 'key' });
      saveBtn.disabled = false;
      if (res.error) { toast('Could not save settings: ' + res.error.message, true); return; }
      state.settings = Object.assign({}, state.settings, parsed);
      toast('Settings saved.');
    });
    actions.appendChild(saveBtn);
    card.appendChild(actions);
    main.appendChild(card);
  }

  // Deactivating someone who still has open work would silently strand it:
  // the person can no longer log in (enterApp() checks is_active), but the
  // work stays assigned to them, invisible in anyone's "My Work" except an
  // admin/reviewer's firm-wide views. This checks for open work first and,
  // if there is any, makes reassignment part of the deactivation instead of
  // an afterthought someone has to remember later.
  async function confirmDeactivateStaff(p2) {
    var res = await sb.from('work_items').select('*').eq('assignee_id', p2.id).neq('status', 'completed');
    if (res.error) { toast('Could not check their open work: ' + res.error.message, true); return; }
    var openWork = res.data || [];
    if (!openWork.length) {
      var directRes = await sb.from('profiles').update({ is_active: false }).eq('id', p2.id);
      if (directRes.error) { toast('Could not update: ' + directRes.error.message, true); return; }
      await loadProfiles();
      render();
      return;
    }

    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'Reassign Before Deactivating';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var p = el('p', 'desc');
    p.textContent = p2.full_name + ' has ' + openWork.length + ' open item' + (openWork.length === 1 ? '' : 's') + '. Once deactivated they can\'t log in, so those need a new assignee first.';
    wrap.appendChild(p);

    var list = el('ul'); list.style.paddingLeft = '18px'; list.style.listStyle = 'disc'; list.style.marginBottom = '14px';
    openWork.forEach(function (w) { var li = el('li'); li.textContent = w.title; list.appendChild(li); });
    wrap.appendChild(list);

    var reassignSel = el('select');
    state.profiles.filter(function (p3) { return p3.is_active && p3.id !== p2.id; })
      .forEach(function (p3) { reassignSel.appendChild(new Option(p3.full_name, p3.id)); });
    wrap.appendChild(field('Reassign all of the above to', reassignSel));

    var actions = el('div', 'modal-actions');
    var confirmBtn = el('button', 'btn'); confirmBtn.type = 'button';
    confirmBtn.textContent = 'Reassign & Deactivate';
    confirmBtn.addEventListener('click', async function () {
      if (!reassignSel.value) { toast('No other active staff to reassign to.', true); return; }
      confirmBtn.disabled = true;
      var reassignRes = await sb.from('work_items').update({ assignee_id: reassignSel.value }).eq('assignee_id', p2.id).neq('status', 'completed');
      if (reassignRes.error) { confirmBtn.disabled = false; toast('Could not reassign work: ' + reassignRes.error.message, true); return; }
      var deactivateRes = await sb.from('profiles').update({ is_active: false }).eq('id', p2.id);
      confirmBtn.disabled = false;
      if (deactivateRes.error) { toast('Work reassigned, but deactivation failed: ' + deactivateRes.error.message, true); return; }
      closeModal();
      toast(openWork.length + ' item' + (openWork.length === 1 ? '' : 's') + ' reassigned; ' + p2.full_name + ' deactivated.');
      await loadProfiles();
      render();
    });
    actions.appendChild(confirmBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // ============================================================
  // Boot
  // ============================================================
  (async function init() {
    var sessionRes = await sb.auth.getSession();
    if (sessionRes.data && sessionRes.data.session) {
      await enterApp();
    }
  })();
})();
