(function () {
  'use strict';

  // Publishable (anon) key — safe to be public, the real security boundary
  // is the RLS policies on the database, not this key. Never put a
  // service_role/secret key here.
  var SUPABASE_URL = 'https://moqmgyniwytwmlcdthzy.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_I_UocrZmQBSKmsDhivOs0g_nxc5j5Gi';
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var STATUS_LABELS = {
    to_do: 'To Do',
    in_progress: 'In Progress',
    waiting_for_client: 'Waiting for Client',
    ready_for_review: 'Ready for Review',
    changes_required: 'Changes Required',
    approved: 'Approved',
    ready_to_submit: 'Ready to Submit',
    completed: 'Completed',
  };
  // Statuses an employee may set themselves — always available regardless
  // of which service template a work item follows. Everything past
  // "Ready for Review" requires a reviewer/admin, enforced both here (UI)
  // and in the guard_work_item_update() trigger (DB).
  var EMPLOYEE_STATUSES = ['to_do', 'in_progress', 'waiting_for_client', 'ready_for_review'];
  var STAGE_LABELS = { preparation: 'Preparation', review: 'Review', submission: 'Submission' };
  var STAGES = ['preparation', 'review', 'submission'];
  var TEMPLATE_CATEGORIES = ['Bookkeeping', 'Tax', 'Payroll', 'Reporting', 'Registration', 'Advisory', 'NFRS/IFRS'];

  var state = {
    user: null,
    profile: null,
    profiles: [],
    clients: [],
    templates: [],
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

  // Records a work item's Activity-tab entry. Deliberately not called for
  // creation (redundant with the created_at already shown) or comments
  // (already visible on Overview) — this is "what changed," not
  // everything that ever happened.
  function logActivity(workItemId, action, detail) {
    sb.from('work_activity').insert({ work_item_id: workItemId, actor_id: state.user.id, action: action, detail: detail || null });
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

  function openModal(contentEl) {
    var card = qs('#modalCard');
    clear(card);
    card.appendChild(contentEl);
    qs('#modalOverlay').classList.remove('hidden');
  }
  function closeModal() { qs('#modalOverlay').classList.add('hidden'); }
  qs('#modalOverlay').addEventListener('click', function (e) {
    if (e.target === qs('#modalOverlay')) closeModal();
  });

  function field(labelText, inputEl) {
    var wrap = el('div', 'f');
    var label = el('label'); label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
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
  // My Work, All Work, Deadlines). Internal is the primary/urgency date
  // (see isOverdue/effectiveDue); filing only appears when it's set and
  // actually different, so a work item with just one date doesn't show
  // a redundant second label.
  function dueDateText(w) {
    if (w.internal_due_date && w.external_due_date && w.internal_due_date !== w.external_due_date) {
      return 'Internal ' + fmtDate(w.internal_due_date) + ' · Filing ' + fmtDate(w.external_due_date);
    }
    if (w.internal_due_date) return 'Internal ' + fmtDate(w.internal_due_date);
    if (w.external_due_date) return 'Filing ' + fmtDate(w.external_due_date);
    return 'No due date';
  }
  function clientName(id) {
    var c = state.clients.find(function (x) { return x.id === id; });
    return c ? c.name : '—';
  }
  function templateById(id) {
    return state.templates.find(function (t) { return t.id === id; }) || null;
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
      await Promise.all([loadProfiles(), loadClients(), loadTemplates()]);
      renderSidebar();
      routeFromHash();
      if (isAdmin()) runAutoGenerateOnOpen();
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
        var period = settings[AUTO_GENERATE_KEYS[i][0]];
        if (!period) continue;
        var genRes = await sb.rpc('generate_period_work_for_period', { p_period: period, p_period_type: periodType });
        if (!genRes.error) totalCreated += genRes.data || 0;
      }
      if (totalCreated > 0) toast(totalCreated + ' work item' + (totalCreated === 1 ? '' : 's') + ' auto-generated for the current period.');
    })();
  }
  async function loadWork(mode) {
    var q = sb.from('work_items').select('*').order('internal_due_date', { ascending: true, nullsFirst: false });
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
  window.addEventListener('hashchange', routeFromHash);
  function routeFromHash() {
    var hash = location.hash.replace(/^#/, '');
    if (hash.indexOf('work/') === 0) {
      state.view = 'work-detail';
      state.workId = hash.slice(5);
      renderWorkDetail(state.workId);
      return;
    }
    if (hash.indexOf('client/') === 0) {
      state.view = 'client-detail';
      state.clientDetailId = hash.slice(7);
      renderClientDetail(state.clientDetailId);
      return;
    }
    var known = ['today', 'my-work', 'review', 'all-work', 'deadlines', 'manager', 'todo', 'clients', 'templates', 'staff'];
    state.view = known.indexOf(hash) !== -1 ? hash : 'today';
    render();
  }
  function goto(view) { location.hash = view; }
  function gotoWork(id) { location.hash = 'work/' + id; }
  function gotoClient(id) { location.hash = 'client/' + id; }

  // ============================================================
  // Sidebar
  // ============================================================
  function renderSidebar() {
    var nav = qs('#sidebar');
    clear(nav);
    function item(view, label, iconName) {
      var b = el('button');
      b.type = 'button';
      b.appendChild(icon(iconName));
      b.appendChild(document.createTextNode(label));
      b.classList.toggle('is-active', state.view === view || (state.view === 'work-detail' && view === 'today') || (state.view === 'client-detail' && view === 'clients'));
      b.addEventListener('click', function () { goto(view); });
      nav.appendChild(b);
    }
    var group1 = el('div', 'sidebar-group'); group1.textContent = 'Work';
    nav.appendChild(group1);
    item('today', 'Today', 'sun');
    item('my-work', 'My Work', 'clipboard');
    if (isReviewerOrAdmin()) {
      item('review', 'Review', 'check');
      item('all-work', 'All Work', 'folder');
    }
    item('deadlines', 'Deadlines', 'calendar');
    if (isReviewerOrAdmin()) item('manager', 'Manager Dashboard', 'users');
    item('todo', 'My To-Do List', 'list');
    // Every active staff member can look clients up (name, contact info,
    // active work/services) — that's just read access the app already
    // grants via RLS for the New Work modal's client picker. Only admin
    // gets the write actions (New Client, Edit, Deactivate) — those are
    // gated individually inside renderClients/renderClientDetail, not by
    // hiding the whole page.
    var group2 = el('div', 'sidebar-group'); group2.textContent = 'Clients';
    nav.appendChild(group2);
    item('clients', 'Clients', 'building');
    if (isAdmin()) {
      var group3 = el('div', 'sidebar-group'); group3.textContent = 'Manage';
      nav.appendChild(group3);
      item('templates', 'Templates', 'flag');
      item('staff', 'Staff', 'users');
    }
  }

  function render() {
    renderSidebar();
    var main = qs('#main');
    clear(main);
    if (state.view === 'today') return renderTodayPage(main);
    if (state.view === 'my-work') return renderWorkListView(main, 'My Work', 'mine');
    if (state.view === 'review') return renderWorkListView(main, 'Review', 'review');
    if (state.view === 'all-work') return renderWorkListView(main, 'All Work', 'all');
    if (state.view === 'deadlines') return renderDeadlinesPage(main);
    if (state.view === 'manager') return renderManagerDashboard(main);
    if (state.view === 'todo') return renderTodoPage(main);
    if (state.view === 'clients') return renderClients(main);
    if (state.view === 'templates') return renderTemplates(main);
    if (state.view === 'staff') return renderStaff(main);
  }

  // ============================================================
  // Today — the landing screen. Purpose: help the person decide what to
  // work on next, not show off charts. Pulls only "my work" plus (for
  // reviewers/admins) how many items are sitting in the review queue.
  // ============================================================
  async function renderTodayPage(main) {
    var greeting = el('h1', 'greeting');
    var hour = new Date().getHours();
    greeting.textContent = (hour < 12 ? 'Good morning, ' : hour < 17 ? 'Good afternoon, ' : 'Good evening, ') + (state.profile.full_name || '').split(' ')[0];
    main.appendChild(greeting);
    var dateLine = el('div', 'greeting-date');
    dateLine.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    main.appendChild(dateLine);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var mine = await loadWork('mine');
    var reviewCount = 0;
    if (isReviewerOrAdmin()) {
      var reviewItems = await loadWork('review');
      reviewCount = reviewItems.length;
    }
    main.removeChild(loading);

    var open = mine.filter(function (w) { return w.status !== 'completed'; });
    var overdue = open.filter(isOverdue);
    var todayStr = new Date().toISOString().slice(0, 10);
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

    if (!attention.length && !upcoming.length) {
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
  // Work list views (My Work / Review / All Work)
  // ============================================================
  async function renderWorkListView(main, title, mode) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = title;
    head.appendChild(h1);
    // Everyone can log their own work now, not just reviewers/admins —
    // openNewWorkModal() locks the assignee to "self" for employees (see
    // there), so this doesn't let anyone hand work to someone else.
    var addBtn = el('button', 'btn btn-sm');
    addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Work'));
    addBtn.addEventListener('click', function () { openNewWorkModal(); });
    head.appendChild(addBtn);
    main.appendChild(head);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var items = await loadWork(mode);
    // The DB query orders by internal_due_date alone, which pushes a work
    // item that only has a filing due date set to the bottom as if it had
    // no due date at all. Re-sort client-side by effective due date
    // (internal, falling back to filing) so it lands where it actually
    // belongs.
    items = items.slice().sort(compareByDue);
    main.removeChild(loading);

    if (mode === 'all') renderWorkloadSummary(main, items);

    if (mode === 'mine') {
      renderGroupedWork(main, items);
    } else {
      renderFlatWorkList(main, items);
    }
  }

  function renderGroupedWork(main, items) {
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
    var shown = 0;
    groups.forEach(function (g) {
      var rows = items.filter(g.filter);
      if (g.key === 'completed') rows = rows.slice(0, 10);
      if (!rows.length) return;
      shown += rows.length;
      var wrap = el('div', 'task-group');
      var h3 = el('h3');
      h3.appendChild(document.createTextNode(g.label + ' '));
      var count = el('span', 'count'); count.textContent = String(rows.length);
      h3.appendChild(count);
      wrap.appendChild(h3);
      rows.forEach(function (w) { wrap.appendChild(workRow(w)); });
      main.appendChild(wrap);
    });
    if (!shown) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No work assigned to you yet.'));
      main.appendChild(empty);
    }
  }

  // "Who's overloaded this week" — the one thing a flat list can't answer
  // at a glance. Counts open (non-completed) work per assignee, sorted
  // busiest-first, with overdue count called out separately since that's
  // the number that actually matters day to day.
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
    }).sort(function (a, b) { return b.open - a.open; });

    var card = el('div', 'card');
    var h2 = el('h2'); h2.appendChild(icon('users')); h2.appendChild(document.createTextNode('Team Workload')); card.appendChild(h2);
    var wrap = el('div'); wrap.style.display = 'flex'; wrap.style.flexWrap = 'wrap'; wrap.style.gap = '10px'; wrap.style.marginTop = '12px';
    rows.forEach(function (r) {
      var chip = el('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:9px;background:var(--mist);border:1px solid var(--border);border-radius:10px;padding:9px 14px;';
      if (r.id !== 'unassigned') chip.appendChild(avatar(r.name, 'avatar-sm'));
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

  function renderFlatWorkList(main, items) {
    if (!items.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No work here yet.'));
      main.appendChild(empty);
      return;
    }
    var wrap = el('div', 'task-group');
    items.forEach(function (w) { wrap.appendChild(workRow(w)); });
    main.appendChild(wrap);
  }

  function workRow(w) {
    var row = el('div', 'task-row');
    row.addEventListener('click', function () { gotoWork(w.id); });
    row.appendChild(avatar(profileName(w.assignee_id)));
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

    var filterRow = el('div'); filterRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;';
    var scopeSel = el('select'); scopeSel.style.width = 'auto';
    scopeSel.appendChild(new Option('My Deadlines', 'mine'));
    if (isReviewerOrAdmin()) scopeSel.appendChild(new Option('Team', 'all'));
    filterRow.appendChild(scopeSel);
    var clientSel = el('select'); clientSel.style.width = 'auto';
    clientSel.appendChild(new Option('All Clients', ''));
    state.clients.forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    filterRow.appendChild(clientSel);
    var serviceSel = el('select'); serviceSel.style.width = 'auto';
    serviceSel.appendChild(new Option('All Services', ''));
    state.templates.forEach(function (t) { serviceSel.appendChild(new Option(t.title, t.id)); });
    filterRow.appendChild(serviceSel);
    main.appendChild(filterRow);

    var resultsWrap = el('div');
    main.appendChild(resultsWrap);

    async function refresh() {
      clear(resultsWrap);
      var loading = el('div', 'empty-note'); loading.textContent = 'Loading…'; resultsWrap.appendChild(loading);
      var items = await loadWork(scopeSel.value === 'all' ? 'all' : 'mine');
      clear(resultsWrap);
      items = items.filter(function (w) { return w.status !== 'completed' && effectiveDue(w); });
      if (clientSel.value) items = items.filter(function (w) { return w.client_id === clientSel.value; });
      if (serviceSel.value) items = items.filter(function (w) { return w.service_template_id === serviceSel.value; });
      items.sort(compareByDue);

      var todayStr = new Date().toISOString().slice(0, 10);
      var weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
      var weekStr = weekOut.toISOString().slice(0, 10);
      var groups = [
        { key: 'overdue', label: 'Overdue', filter: function (w) { return isOverdue(w); } },
        { key: 'today', label: 'Today', filter: function (w) { return !isOverdue(w) && effectiveDue(w) === todayStr; } },
        { key: 'week', label: 'This Week', filter: function (w) { return !isOverdue(w) && effectiveDue(w) > todayStr && effectiveDue(w) <= weekStr; } },
        { key: 'later', label: 'Later', filter: function (w) { return !isOverdue(w) && effectiveDue(w) > weekStr; } },
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
        var empty = el('div', 'empty-note'); empty.appendChild(icon('calendar')); empty.appendChild(document.createTextNode('Nothing due.'));
        resultsWrap.appendChild(empty);
      }
    }
    scopeSel.addEventListener('change', refresh);
    clientSel.addEventListener('change', refresh);
    serviceSel.addEventListener('change', refresh);
    await refresh();
  }

  // ============================================================
  // Manager Dashboard — per-staff workload matrix plus a short list of
  // what needs a manager's attention. Deliberately no charts.
  // ============================================================
  async function renderManagerDashboard(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Manager Dashboard'; head.appendChild(h1);
    main.appendChild(head);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var items = await loadWork('all');
    main.removeChild(loading);

    var open = items.filter(function (w) { return w.status !== 'completed'; });
    var todayStr = new Date().toISOString().slice(0, 10);
    var weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
    var weekStr = weekOut.toISOString().slice(0, 10);

    // ---- Team Workload matrix ----
    var matrixCard = el('div', 'card');
    var mH2 = el('h2'); mH2.appendChild(icon('users')); mH2.appendChild(document.createTextNode('Team Workload')); matrixCard.appendChild(mH2);
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Staff', 'Overdue', 'Due 7d', 'Review', 'Waiting'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) {
      // Preparation/open workload (Overdue, Due 7d, Waiting) is the work
      // this person is doing, so it's assignee-based. Review is work
      // waiting on THEM to check someone else's, so it has to be counted
      // against reviewer_id -- otherwise a reviewer's own submissions
      // (awaiting someone else's review) would inflate their own Review
      // column instead of showing up under whoever is actually reviewing.
      var assigned = open.filter(function (w) { return w.assignee_id === p.id; });
      var reviewing = open.filter(function (w) { return w.reviewer_id === p.id && w.status === 'ready_for_review'; });
      var tr = el('tr');
      var tdName = el('td'); tdName.textContent = p.full_name; tr.appendChild(tdName);
      var overdueN = assigned.filter(isOverdue).length;
      var due7 = assigned.filter(function (w) { return !isOverdue(w) && effectiveDue(w) && effectiveDue(w) <= weekStr; }).length;
      var reviewN = reviewing.length;
      var waitingN = assigned.filter(function (w) { return w.status === 'waiting_for_client'; }).length;
      [overdueN, due7, reviewN, waitingN].forEach(function (n, i) {
        var td = el('td'); td.textContent = String(n);
        if (i === 0 && n) td.style.cssText = 'color:var(--red);font-weight:700;';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    matrixCard.appendChild(table);
    main.appendChild(matrixCard);

    // ---- Needs Manager Attention ----
    var overdueCount = open.filter(isOverdue).length;
    var staleReviews = open.filter(function (w) {
      if (w.status !== 'ready_for_review' || !w.ready_for_review_at) return false;
      var ageDays = (Date.now() - new Date(w.ready_for_review_at).getTime()) / 86400000;
      return ageDays > 2;
    }).length;
    var waitingClientIds = {};
    open.filter(function (w) { return w.status === 'waiting_for_client'; }).forEach(function (w) { waitingClientIds[w.client_id] = true; });
    var waitingClientCount = Object.keys(waitingClientIds).length;

    var attnCard = el('div', 'card');
    var aH2 = el('h2'); aH2.appendChild(icon('alert')); aH2.appendChild(document.createTextNode('Needs Manager Attention')); attnCard.appendChild(aH2);
    var lines = [];
    if (overdueCount) lines.push({ text: overdueCount + ' overdue work item' + (overdueCount === 1 ? '' : 's'), view: 'all-work' });
    if (staleReviews) lines.push({ text: staleReviews + ' review' + (staleReviews === 1 ? '' : 's') + ' older than 2 days', view: 'review' });
    if (waitingClientCount) lines.push({ text: waitingClientCount + ' client' + (waitingClientCount === 1 ? '' : 's') + ' waiting on documents', view: null });
    if (!lines.length) {
      var okLine = el('p', 'desc'); okLine.textContent = 'Nothing needs attention right now.'; attnCard.appendChild(okLine);
    } else {
      lines.forEach(function (l) {
        var p = el('p');
        p.style.cssText = 'font-size:.92rem;margin:6px 0;';
        if (l.view) {
          var a = el('a'); a.href = '#' + l.view; a.textContent = l.text;
          p.appendChild(a);
        } else {
          p.textContent = l.text;
        }
        attnCard.appendChild(p);
      });
    }
    main.appendChild(attnCard);
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
    state.templates.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
      .forEach(function (t) { templateSel.appendChild(new Option(t.title + ' (' + t.category + ')', t.id)); });
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
    wrap.appendChild(field('Internal Due', internalDueInput));
    var externalDueInput = el('input'); externalDueInput.type = 'date';
    wrap.appendChild(field('Filing / Client Due (optional)', externalDueInput));

    var prioritySel = el('select');
    ['low', 'normal', 'high'].forEach(function (p) { prioritySel.appendChild(new Option(p.charAt(0).toUpperCase() + p.slice(1), p)); });
    prioritySel.value = 'normal';
    wrap.appendChild(field('Priority', prioritySel));

    var descInput = el('textarea'); descInput.rows = 3;
    wrap.appendChild(field('Description / Instructions', descInput));

    // Same day-of-month-in-the-current-month rule used by bulk generation
    // (see supabase/migrations/20260811091000_recurring_work_generation.
    // sql) — clamps to the month's real last day, then derives internal
    // FROM filing (not independently). Only fills a date the user hasn't
    // already typed something into, and stays fully editable/overridable
    // afterward like any default — internal_due_date and external_due_
    // date remain two separate fields either can be changed without
    // touching the other.
    function computeFilingDate(dayOfMonth) {
      var now = new Date();
      var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var d = new Date(now.getFullYear(), now.getMonth(), Math.min(dayOfMonth, lastDay));
      return d.toISOString().slice(0, 10);
    }
    function subtractDays(dateStr, n) {
      var d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    }
    function applyTemplate(id) {
      var t = templateById(id);
      if (!t) return;
      if (!titleInput.value.trim() || titleInput.dataset.auto === '1') { titleInput.value = t.title; titleInput.dataset.auto = '1'; }
      if (t.default_assignee_id && isReviewerOrAdmin()) assigneeSel.value = t.default_assignee_id;
      if (t.default_reviewer_id) reviewerSel.value = t.default_reviewer_id;
      if (t.filing_deadline_day != null) {
        if (!externalDueInput.value) externalDueInput.value = computeFilingDate(t.filing_deadline_day);
        if (t.internal_offset_days != null && !internalDueInput.value) internalDueInput.value = subtractDays(externalDueInput.value, t.internal_offset_days);
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
        created_by: state.user.id,
      }).select().single();
      if (res.error) { createBtn.disabled = false; toast('Could not create work: ' + res.error.message, true); return; }

      if (templateSel.value) {
        var itemsRes = await sb.from('service_template_items').select('*').eq('template_id', templateSel.value);
        var items = (itemsRes.data || []);
        if (items.length) {
          var rows = items.map(function (it) { return { work_item_id: res.data.id, stage: it.stage, title: it.title, sort_order: it.sort_order }; });
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
    var metaGrid = el('div', 'meta-grid');
    metaGrid.appendChild(metaItem('Client', clientName(work.client_id), 'building'));
    metaGrid.appendChild(metaItem('Service', template ? template.title : 'Ad-hoc', 'idcard'));
    metaGrid.appendChild(metaItem('Assignee', profileName(work.assignee_id), 'user', true));
    metaGrid.appendChild(metaItem('Reviewer', work.reviewer_id ? profileName(work.reviewer_id) : '—', 'user', !!work.reviewer_id));
    metaGrid.appendChild(metaItem('Internal Due', fmtDate(work.internal_due_date), 'calendar'));
    metaGrid.appendChild(metaItem('Filing Due', fmtDate(work.external_due_date), 'calendar'));
    metaGrid.appendChild(metaItem('Priority', work.priority.charAt(0).toUpperCase() + work.priority.slice(1), 'flag'));
    overviewPane.appendChild(metaGrid);

    // Status control — employees on their own work get a restricted set of
    // options (can't self-approve); reviewers/admins get the full,
    // template-aware set. Setting status to "Waiting for Client" prompts
    // for the structured waiting details before committing; the reverse
    // is a one-click "Mark Documents Received."
    if (isMine || canEditFull) {
      var statusWrap = el('div', 'f');
      var statusLabel = el('label'); statusLabel.textContent = 'Status'; statusWrap.appendChild(statusLabel);
      var statusSel = el('select');
      var full = ['to_do', 'in_progress', 'waiting_for_client', 'ready_for_review', 'changes_required', 'approved'];
      if (!template || template.requires_submission) full.push('ready_to_submit');
      full.push('completed');
      var allowed = canEditFull ? full : EMPLOYEE_STATUSES.slice();
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
        var patch = { status: newStatus };
        if (newStatus !== 'waiting_for_client') { patch.waiting_reason = null; patch.waiting_since = null; patch.follow_up_date = null; patch.waiting_requested_by = null; }
        // Tracks how long something has actually sat in the review queue —
        // separate from updated_at, which any field change would bump —
        // so the Manager Dashboard can flag reviews that are going stale.
        patch.ready_for_review_at = newStatus === 'ready_for_review' ? new Date().toISOString() : null;
        applyStatusChange(newStatus, patch);
      });
      async function applyStatusChange(newStatus, patch, newWaitingItemTitles) {
        var res = await sb.from('work_items').update(patch).eq('id', work.id);
        if (res.error) { toast('Could not update status: ' + res.error.message, true); statusSel.value = prevStatus; return; }
        if (newWaitingItemTitles && newWaitingItemTitles.length) {
          var rows = newWaitingItemTitles.map(function (title, i) { return { work_item_id: work.id, title: title, sort_order: i }; });
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
        logActivity(work.id, 'status_changed', STATUS_LABELS[prevStatus] + ' → ' + STATUS_LABELS[newStatus]);
        toast('Status updated.');
        renderWorkDetail(id);
      }
      statusWrap.appendChild(statusSel);
      if (!canEditFull) {
        var hint = el('span', 'f-hint'); hint.textContent = 'A reviewer sets Approved, Ready to Submit, or Completed.';
        statusWrap.appendChild(hint);
      }
      overviewPane.appendChild(statusWrap);
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
      waitingItems.forEach(function (wi) {
        var row = el('label', 'checklist-item' + (wi.is_received ? ' done' : ''));
        row.style.padding = '5px 0';
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = wi.is_received;
        cb.disabled = !canToggleChildren;
        cb.addEventListener('change', async function () {
          var res = await sb.from('work_waiting_items').update({ is_received: cb.checked }).eq('id', wi.id);
          if (res.error) { toast('Could not update: ' + res.error.message, true); cb.checked = !cb.checked; return; }
          wi.is_received = cb.checked; // keep the in-memory copy in sync, not just the DOM/DB —
          // "Mark Documents Received" below reads this same waitingItems array.
          row.classList.toggle('done', cb.checked);
          var detail = (cb.checked ? 'Received: ' : 'Un-received: ') + wi.title;
          logActivity(work.id, 'waiting_item_toggled', detail);
          prependActivityRow(activityPane, detail);
        });
        var span = el('span'); span.textContent = wi.title;
        row.appendChild(cb); row.appendChild(span);
        actionBox.appendChild(row);
      });
      if (isMine || canEditFull) {
        var addWaitRow = el('div'); addWaitRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
        var newWaitInput = el('input'); newWaitInput.type = 'text'; newWaitInput.placeholder = 'Add another item…'; newWaitInput.style.flex = '1';
        var addWaitBtn = el('button', 'btn btn-outline btn-sm'); addWaitBtn.type = 'button'; addWaitBtn.textContent = 'Add';
        addWaitBtn.addEventListener('click', async function () {
          if (!newWaitInput.value.trim()) return;
          var res = await sb.from('work_waiting_items').insert({ work_item_id: work.id, title: newWaitInput.value.trim(), sort_order: waitingItems.length });
          if (res.error) { toast('Could not add item: ' + res.error.message, true); return; }
          renderWorkDetail(id);
        });
        addWaitRow.appendChild(newWaitInput); addWaitRow.appendChild(addWaitBtn);
        actionBox.appendChild(addWaitRow);
      }
      if (work.waiting_requested_by) { var reqByLine = el('div'); reqByLine.style.cssText = 'margin-top:10px;font-size:.85rem;'; reqByLine.textContent = 'Requested by: ' + profileName(work.waiting_requested_by); actionBox.appendChild(reqByLine); }
      if (work.waiting_since) { var reqLine = el('div'); reqLine.style.marginTop = '2px'; reqLine.style.fontSize = '.85rem'; reqLine.textContent = 'Requested: ' + fmtDate(work.waiting_since); actionBox.appendChild(reqLine); }
      if (work.follow_up_date) { var fuLine = el('div'); fuLine.style.marginTop = '2px'; fuLine.style.fontSize = '.85rem'; fuLine.textContent = 'Follow-up: ' + fmtDate(work.follow_up_date); actionBox.appendChild(fuLine); }
      if (isMine || canEditFull) {
        var receivedBtn = el('button', 'btn btn-outline btn-sm'); receivedBtn.type = 'button'; receivedBtn.style.marginTop = '12px';
        receivedBtn.appendChild(icon('check')); receivedBtn.appendChild(document.createTextNode('Mark Documents Received'));
        receivedBtn.addEventListener('click', async function () {
          var outstanding = waitingItems.filter(function (wi) { return !wi.is_received; });
          if (outstanding.length) {
            await sb.from('work_waiting_items').update({ is_received: true }).eq('work_item_id', work.id);
          }
          var res = await sb.from('work_items').update({ status: 'in_progress', waiting_reason: null, waiting_since: null, follow_up_date: null, waiting_requested_by: null }).eq('id', work.id);
          if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
          logActivity(work.id, 'waiting_resolved', 'All outstanding documents marked received.');
          toast('Marked as received — back In Progress.');
          renderWorkDetail(id);
        });
        actionBox.appendChild(receivedBtn);
      }
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
    wrap.appendChild(field('Internal Due', internalDueInput));
    var externalDueInput = el('input'); externalDueInput.type = 'date'; externalDueInput.value = work.external_due_date || '';
    wrap.appendChild(field('Filing / Client Due (optional)', externalDueInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the work a title.', true); return; }
      saveBtn.disabled = true;
      var res = await sb.from('work_items').update({
        title: titleInput.value.trim(),
        period: periodInput.value.trim() || null,
        internal_due_date: internalDueInput.value || null,
        external_due_date: externalDueInput.value || null,
      }).eq('id', work.id);
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
    var span = el('span'); span.textContent = item.title;
    row.appendChild(cb); row.appendChild(span);
    return row;
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
    wrap.appendChild(field('Follow-up date (optional)', followUpInput));

    var actions = el('div', 'modal-actions');
    var saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      var items = itemsInput.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!items.length) { toast('Enter at least one thing you\'re waiting for.', true); return; }
      closeModal();
      onSave({
        status: 'waiting_for_client',
        waiting_since: new Date().toISOString().slice(0, 10),
        follow_up_date: followUpInput.value || null,
        waiting_requested_by: state.user.id,
        ready_for_review_at: null,
      }, items);
    });
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  function metaItem(label, value, iconName, showAvatar) {
    var wrap = el('div', 'meta-item');
    wrap.appendChild(icon(iconName, 'ic-lg'));
    var body = el('div');
    var l = el('label'); l.textContent = label;
    var v = el('div', 'value');
    if (showAvatar && value !== '—') v.appendChild(avatar(value, 'avatar-sm'));
    v.appendChild(document.createTextNode(value));
    body.appendChild(l); body.appendChild(v);
    wrap.appendChild(body);
    return wrap;
  }

  // ============================================================
  // Admin: Clients
  // ============================================================
  function renderClients(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Clients'; head.appendChild(h1);
    if (isAdmin()) {
      var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Client'));
      addBtn.addEventListener('click', function () { openClientFormModal(); });
      head.appendChild(addBtn);
    }
    main.appendChild(head);

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
    var h1 = el('h1'); h1.style.fontSize = '1.25rem'; h1.textContent = c.name;
    var sub = el('div'); sub.style.cssText = 'color:var(--ink-soft);font-size:.88rem;margin-top:2px;';
    sub.textContent = (c.pan_vat ? 'PAN/VAT ' + c.pan_vat : 'No PAN/VAT on file') + (c.contact_person ? ' · ' + c.contact_person : '');
    titleWrap.appendChild(h1); titleWrap.appendChild(sub);
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

    // ---- Active Work ----
    var workCard = el('div', 'card');
    var workHead = el('div', 'page-head'); workHead.style.marginBottom = '10px';
    var workH2 = el('h2'); workH2.appendChild(icon('clipboard')); workH2.appendChild(document.createTextNode('Active Work')); workHead.appendChild(workH2);
    var newWorkBtn = el('button', 'btn btn-outline btn-sm'); newWorkBtn.type = 'button'; newWorkBtn.appendChild(icon('plus')); newWorkBtn.appendChild(document.createTextNode('New Work'));
    newWorkBtn.addEventListener('click', function () { openNewWorkModal({ clientId: id }); });
    workHead.appendChild(newWorkBtn);
    workCard.appendChild(workHead);

    var openWork = work.filter(function (w) { return w.status !== 'completed'; });
    var completedWork = work.filter(function (w) { return w.status === 'completed'; }).slice(0, 15);
    if (!openWork.length) {
      var noOpen = el('p', 'desc'); noOpen.textContent = 'No open work for this client.'; workCard.appendChild(noOpen);
    } else {
      openWork.forEach(function (w) { workCard.appendChild(workRow(w)); });
    }
    if (completedWork.length) {
      var histLabel = el('div', 'checklist-stage'); histLabel.textContent = 'Recently Completed'; workCard.appendChild(histLabel);
      completedWork.forEach(function (w) { workCard.appendChild(workRow(w)); });
    }
    main.appendChild(workCard);

    // ---- Outstanding (what we're waiting on this client for) ----
    var waiting = openWork.filter(function (w) { return w.status === 'waiting_for_client'; });
    if (waiting.length) {
      var waitingSummaries = await loadWaitingSummaries(waiting.map(function (w) { return w.id; }));
      var outCard = el('div', 'card');
      var outH2 = el('h2'); outH2.appendChild(icon('alert')); outH2.appendChild(document.createTextNode('Outstanding')); outCard.appendChild(outH2);
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

    // ---- Active Services (recurring subscriptions — "Create This Period's
    // Work" is a manual one-click bridge, not automatic generation) ----
    var svcCard = el('div', 'card');
    var svcH2 = el('h2'); svcH2.appendChild(icon('flag')); svcH2.appendChild(document.createTextNode('Active Services')); svcCard.appendChild(svcH2);
    if (!services.length) {
      var noSvc = el('p', 'desc'); noSvc.textContent = 'No services set up for this client yet.'; svcCard.appendChild(noSvc);
    }
    // Active/inactive is a service-management action (client_services RLS
    // is admin/reviewer write) — staff can see the list but not toggle it.
    var canManageServices = isReviewerOrAdmin();
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
      var meta = el('div', 'meta');
      meta.textContent = (tmpl ? tmpl.category : '') +
        (s.assignee_id ? ' · Assignee: ' + profileName(s.assignee_id) : '') +
        (s.reviewer_id ? ' · Reviewer: ' + profileName(s.reviewer_id) : '');
      body.appendChild(title); body.appendChild(meta);
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
      svcCard.appendChild(row);
    });

    if (canManageServices) {
      var addSvcRow = el('div'); addSvcRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:flex-end;';
      var svcTemplateSel = el('select'); svcTemplateSel.style.flex = '1'; svcTemplateSel.style.minWidth = '160px';
      state.templates.slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
        .forEach(function (t) { svcTemplateSel.appendChild(new Option(t.title, t.id)); });
      var svcAssigneeSel = el('select'); svcAssigneeSel.style.width = 'auto';
      svcAssigneeSel.appendChild(new Option('— Assignee —', ''));
      state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { svcAssigneeSel.appendChild(new Option(p.full_name, p.id)); });
      var svcReviewerSel = el('select'); svcReviewerSel.style.width = 'auto';
      svcReviewerSel.appendChild(new Option('— Reviewer —', ''));
      state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { svcReviewerSel.appendChild(new Option(p.full_name, p.id)); });
      var addSvcBtn = el('button', 'btn btn-outline btn-sm'); addSvcBtn.type = 'button'; addSvcBtn.textContent = 'Add Service';
      addSvcBtn.addEventListener('click', async function () {
        if (!svcTemplateSel.value) { toast('Create a template first under Templates.', true); return; }
        addSvcBtn.disabled = true;
        var res = await sb.from('client_services').insert({
          client_id: id,
          service_template_id: svcTemplateSel.value,
          assignee_id: svcAssigneeSel.value || null,
          reviewer_id: svcReviewerSel.value || null,
        });
        addSvcBtn.disabled = false;
        if (res.error) { toast('Could not add service: ' + res.error.message, true); return; }
        toast('Service added.');
        renderClientDetail(id);
      });
      if (!state.templates.length) {
        var noTmpl = el('p', 'desc'); noTmpl.textContent = 'Create a service template first (under Templates) before adding active services.'; svcCard.appendChild(noTmpl);
      } else {
        addSvcRow.appendChild(svcTemplateSel); addSvcRow.appendChild(svcAssigneeSel); addSvcRow.appendChild(svcReviewerSel); addSvcRow.appendChild(addSvcBtn);
        svcCard.appendChild(addSvcRow);
      }
    }
    main.appendChild(svcCard);

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

    var note = el('div', 'card');
    var p = el('p', 'desc');
    p.style.margin = '0';
    p.textContent = 'Templates describe recurring work (e.g. "VAT Return"). "Use This Template" fills in one work item at a time; "Generate Period Work" fills in a whole period at once from every client\'s Active Services.';
    note.appendChild(p);
    main.appendChild(note);

    if (isAdmin()) await renderAutoGenerateCard(main);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var res = await sb.from('service_templates').select('*, service_template_items(*)').order('title');
    main.removeChild(loading);
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
  // table to compute it safely. Update a field whenever the real period
  // for that cadence rolls over; the next admin login picks it up. Split
  // into three fields (2026-08-12) since monthly/quarterly/yearly
  // services advance at different rates and can't share one "current
  // period" value.
  var AUTO_GENERATE_KEYS = [
    ['auto_generate_period_monthly', 'Current Monthly Period', 'e.g. Shrawan 2083'],
    ['auto_generate_period_quarterly', 'Current Quarterly Period', 'e.g. Q1 2083/84'],
    ['auto_generate_period_yearly', 'Current Yearly Period', 'e.g. FY 2083/84'],
  ];
  async function renderAutoGenerateCard(main) {
    var card = el('div', 'card');
    var h2 = el('h2'); h2.appendChild(icon('calendar')); h2.appendChild(document.createTextNode('Auto-Generate Periods')); card.appendChild(h2);
    var desc = el('p', 'desc');
    desc.textContent = 'When an admin opens Work Desk, work gets generated for every active service whose type matches a period set below. Leave a field blank to pause that type.';
    card.appendChild(desc);

    var res = await sb.from('app_settings').select('*').in('key', AUTO_GENERATE_KEYS.map(function (k) { return k[0]; }));
    var settings = {};
    (res.data || []).forEach(function (row) { settings[row.key] = row.value; });

    AUTO_GENERATE_KEYS.forEach(function (k) {
      var key = k[0], label = k[1], placeholder = k[2];
      var row = el('div'); row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;';
      var input = el('input'); input.type = 'text'; input.placeholder = placeholder; input.value = settings[key] || '';
      var inputWrap = el('div'); inputWrap.style.flex = '1';
      inputWrap.appendChild(field(label, input));
      var saveBtn = el('button', 'btn btn-outline btn-sm'); saveBtn.type = 'button'; saveBtn.textContent = 'Save';
      saveBtn.style.marginTop = '26px';
      saveBtn.addEventListener('click', async function () {
        saveBtn.disabled = true;
        var updRes = await sb.from('app_settings').update({ value: input.value.trim() || null }).eq('key', key);
        saveBtn.disabled = false;
        if (updRes.error) { toast('Could not save: ' + updRes.error.message, true); return; }
        toast(input.value.trim() ? label + ' set to "' + input.value.trim() + '".' : label + ' paused (no period set).');
      });
      row.appendChild(inputWrap); row.appendChild(saveBtn);
      card.appendChild(row);
    });
    main.appendChild(card);
  }

  function templateCard(t) {
    var card = el('div', 'card');
    var h2 = el('h2'); h2.textContent = t.title; card.appendChild(h2);
    var meta = el('p', 'desc');
    meta.textContent = (t.recurrence !== 'none' ? 'Recurs ' + t.recurrence : 'One-off') +
      (t.requires_submission ? ' · Includes a submission step' : '') +
      (t.default_assignee_id ? ' · Default assignee: ' + profileName(t.default_assignee_id) : '') +
      (t.filing_deadline_day != null ? ' · Filing due on day ' + t.filing_deadline_day + ' of the month' : '') +
      (t.filing_deadline_day != null && t.internal_offset_days != null ? ' · Internal due ' + t.internal_offset_days + 'd before filing' : '');
    card.appendChild(meta);
    if (t.description) { var d = el('p'); d.textContent = t.description; card.appendChild(d); }
    var items = t.service_template_items || [];
    STAGES.forEach(function (stage) {
      var stageItems = items.filter(function (i) { return i.stage === stage; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
      if (!stageItems.length) return;
      var stageLabel = el('div', 'checklist-stage'); stageLabel.textContent = STAGE_LABELS[stage]; card.appendChild(stageLabel);
      var ul = el('ul'); ul.style.paddingLeft = '18px'; ul.style.listStyle = 'disc'; ul.style.margin = '0';
      stageItems.forEach(function (it) { var li = el('li'); li.textContent = it.title; ul.appendChild(li); });
      card.appendChild(ul);
    });
    var useBtn = el('button', 'btn btn-outline btn-sm');
    useBtn.type = 'button';
    useBtn.style.marginTop = '14px';
    useBtn.appendChild(icon('plus'));
    useBtn.appendChild(document.createTextNode('Use This Template'));
    useBtn.addEventListener('click', function () { openNewWorkModal({ templateId: t.id }); });
    card.appendChild(useBtn);
    return card;
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

    var defaultAssigneeSel = el('select');
    defaultAssigneeSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { defaultAssigneeSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('Default Assignee (optional)', defaultAssigneeSel));

    var defaultReviewerSel = el('select');
    defaultReviewerSel.appendChild(new Option('— No default —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); }).forEach(function (p) { defaultReviewerSel.appendChild(new Option(p.full_name, p.id)); });
    wrap.appendChild(field('Default Reviewer (optional)', defaultReviewerSel));

    // Optional deadline rule: days after a work item's own generation date
    // (not the period's calendar start, which this app can't safely
    // compute — see the migration note). Leave blank to keep due dates
    // manual, same as before this existed.
    var filingDayInput = el('input'); filingDayInput.type = 'number'; filingDayInput.min = '1'; filingDayInput.max = '31'; filingDayInput.placeholder = 'e.g. 25';
    wrap.appendChild(field('Filing/Client Deadline — day of month (optional)', filingDayInput));
    var internalOffsetInput = el('input'); internalOffsetInput.type = 'number'; internalOffsetInput.min = '0'; internalOffsetInput.placeholder = 'e.g. 3';
    wrap.appendChild(field('Internal Deadline — days before filing (optional)', internalOffsetInput));

    var prepInput = el('textarea'); prepInput.rows = 3; prepInput.placeholder = 'One item per line';
    wrap.appendChild(field('Preparation Checklist (optional)', prepInput));
    var reviewInput = el('textarea'); reviewInput.rows = 2; reviewInput.placeholder = 'One item per line';
    wrap.appendChild(field('Review Checklist (optional)', reviewInput));
    var submissionInput = el('textarea'); submissionInput.rows = 2; submissionInput.placeholder = 'One item per line';
    wrap.appendChild(field('Submission Checklist (optional)', submissionInput));

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
        default_assignee_id: defaultAssigneeSel.value || null,
        default_reviewer_id: defaultReviewerSel.value || null,
        filing_deadline_day: filingDayInput.value.trim() ? parseInt(filingDayInput.value, 10) : null,
        internal_offset_days: internalOffsetInput.value.trim() ? parseInt(internalOffsetInput.value, 10) : null,
      }).select().single();
      if (res.error) { toast('Could not create template: ' + res.error.message, true); return; }
      var rows = [];
      [['preparation', prepInput], ['review', reviewInput], ['submission', submissionInput]].forEach(function (pair) {
        var lines = pair[1].value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        lines.forEach(function (title, i) { rows.push({ template_id: res.data.id, stage: pair[0], title: title, sort_order: i }); });
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
      if (!period) {
        previewWrap.textContent = 'Enter a period above to see what would be generated.';
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
    await refreshPreview();

    genBtn.addEventListener('click', async function () {
      var period = periodInput.value.trim();
      genBtn.disabled = true;
      var res = await sb.rpc('generate_period_work_for_period', { p_period: period, p_period_type: typeSel.value });
      genBtn.disabled = false;
      if (res.error) { toast('Could not generate: ' + res.error.message, true); return; }
      var created = res.data || 0;
      closeModal();
      toast(created + ' work item' + (created === 1 ? '' : 's') + ' created. Set due dates on each before assigning out.');
    });
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
  // Admin: Staff (role assignment + activation)
  // ============================================================
  function renderStaff(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Staff'; head.appendChild(h1);
    main.appendChild(head);

    var inviteNote = el('div', 'card');
    var p = el('p', 'desc');
    p.style.margin = '0';
    p.textContent = 'To add someone new, invite them in the Supabase dashboard (Authentication → Users → Add user) — that part isn\'t done from here yet. Once they exist, manage their role and access below.';
    inviteNote.appendChild(p);
    main.appendChild(inviteNote);

    var card = el('div', 'card');
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Name', 'Role', 'Status', ''].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    state.profiles.forEach(function (p2) {
      var isSelf = p2.id === state.user.id;
      var tr = el('tr', p2.is_active ? '' : 'inactive-row');
      var tdName = el('td'); tdName.textContent = p2.full_name + (isSelf ? ' (you)' : '');
      var tdRole = el('td');
      var roleSel = el('select', 'role-select');
      ['employee', 'reviewer', 'admin'].forEach(function (r) { roleSel.appendChild(new Option(r.charAt(0).toUpperCase() + r.slice(1), r)); });
      roleSel.value = p2.role;
      roleSel.disabled = isSelf;
      roleSel.addEventListener('change', async function () {
        var res = await sb.from('profiles').update({ role: roleSel.value }).eq('id', p2.id);
        if (res.error) { toast('Could not update role: ' + res.error.message, true); roleSel.value = p2.role; return; }
        p2.role = roleSel.value;
        toast(p2.full_name + ' is now ' + roleSel.value + '.');
      });
      tdRole.appendChild(roleSel);
      var tdStatus = el('td');
      var toggleBtn = el('button', 'btn btn-outline btn-sm'); toggleBtn.type = 'button';
      toggleBtn.textContent = p2.is_active ? 'Deactivate' : 'Reactivate';
      toggleBtn.disabled = isSelf;
      toggleBtn.addEventListener('click', async function () {
        if (!p2.is_active) {
          // Reactivating needs no extra care — just flip it back on.
          var reactivateRes = await sb.from('profiles').update({ is_active: true }).eq('id', p2.id);
          if (reactivateRes.error) { toast('Could not update: ' + reactivateRes.error.message, true); return; }
          await loadProfiles();
          render();
          return;
        }
        await confirmDeactivateStaff(p2);
      });
      tdStatus.appendChild(toggleBtn);
      var tdBlank = el('td');
      if (isSelf) { var hint = el('span', 'f-hint'); hint.textContent = "Can't change your own role/status here."; tdBlank.appendChild(hint); }
      tr.appendChild(tdName); tr.appendChild(tdRole); tr.appendChild(tdStatus); tr.appendChild(tdBlank);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
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
