(function () {
  'use strict';

  // Publishable (anon) key — safe to be public, the real security boundary
  // is the RLS policies on the database, not this key. Never put a
  // service_role/secret key here.
  var SUPABASE_URL = 'https://moqmgyniwytwmlcdthzy.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_I_UocrZmQBSKmsDhivOs0g_nxc5j5Gi';
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var STATUS_LABELS = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    waiting_for_client: 'Waiting for Client',
    ready_for_review: 'Ready for Review',
    changes_required: 'Changes Required',
    completed: 'Completed',
  };
  var EMPLOYEE_STATUSES = ['not_started', 'in_progress', 'waiting_for_client', 'ready_for_review'];
  var ALL_STATUSES = ['not_started', 'in_progress', 'waiting_for_client', 'ready_for_review', 'changes_required', 'completed'];

  var state = {
    user: null,
    profile: null,
    profiles: [],
    clients: [],
    engagements: [],
    view: 'my-tasks',
    taskId: null,
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
  // inside an async view render (e.g. render(), renderTaskDetail()) becomes
  // an unhandled promise rejection, not a thrown exception, so it wouldn't
  // hit a normal try/catch around the call site. This is a blanket safety
  // net so "the page just went blank with no explanation" can't happen
  // silently while this is still a new, not-fully-battle-tested app.
  window.addEventListener('unhandledrejection', function (e) {
    toast('Something went wrong: ' + (e.reason && e.reason.message ? e.reason.message : 'unknown error'), true);
  });

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
  function isOverdue(task) {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date + 'T00:00:00') < new Date(new Date().toDateString());
  }
  function clientName(id) {
    var c = state.clients.find(function (x) { return x.id === id; });
    return c ? c.name : '—';
  }
  function engagementTitle(id) {
    var e = state.engagements.find(function (x) { return x.id === id; });
    return e ? e.title : '—';
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
      await Promise.all([loadProfiles(), loadClients(), loadEngagements()]);
      renderSidebar();
      routeFromHash();
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
  // Data loading — profiles/clients/engagements are small lists (a handful
  // to a few dozen rows at this org's size), so they're loaded once into
  // memory and looked up client-side rather than joined per-query. Tasks are
  // loaded fresh per view since they change constantly.
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
  async function loadEngagements() {
    var res = await sb.from('engagements').select('*').order('title');
    if (res.error) { toast('Could not load engagements: ' + res.error.message, true); return; }
    state.engagements = res.data || [];
  }
  async function loadTasks(mode) {
    var q = sb.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (mode === 'mine') q = q.eq('assignee_id', state.user.id);
    if (mode === 'review-queue') q = q.eq('status', 'ready_for_review');
    var res = await q;
    if (res.error) { toast('Could not load tasks: ' + res.error.message, true); return []; }
    return res.data || [];
  }

  // ============================================================
  // Routing — minimal hash-based routing so the back button and page
  // refresh both land somewhere sensible, without a full router library.
  // ============================================================
  window.addEventListener('hashchange', routeFromHash);
  function routeFromHash() {
    var hash = location.hash.replace(/^#/, '');
    if (hash.indexOf('task/') === 0) {
      state.view = 'task-detail';
      state.taskId = hash.slice(5);
      renderTaskDetail(state.taskId);
      return;
    }
    var known = ['my-tasks', 'review-queue', 'all-tasks', 'clients', 'engagements', 'templates', 'staff'];
    state.view = known.indexOf(hash) !== -1 ? hash : 'my-tasks';
    render();
  }
  function goto(view) { location.hash = view; }
  function gotoTask(id) { location.hash = 'task/' + id; }

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
      b.classList.toggle('is-active', state.view === view || (state.view === 'task-detail' && view === 'my-tasks'));
      b.addEventListener('click', function () { goto(view); });
      nav.appendChild(b);
    }
    var group1 = el('div', 'sidebar-group'); group1.textContent = 'Work';
    nav.appendChild(group1);
    item('my-tasks', 'My Tasks', 'clipboard');
    if (isReviewerOrAdmin()) {
      item('review-queue', 'Review Queue', 'check');
      item('all-tasks', 'All Tasks', 'folder');
    }
    if (isAdmin()) {
      var group2 = el('div', 'sidebar-group'); group2.textContent = 'Manage';
      nav.appendChild(group2);
      item('clients', 'Clients', 'building');
      item('engagements', 'Engagements', 'idcard');
      item('templates', 'Task Templates', 'flag');
      item('staff', 'Staff', 'users');
    }
  }

  function render() {
    renderSidebar();
    var main = qs('#main');
    clear(main);
    if (state.view === 'my-tasks') return renderTaskListView(main, 'My Tasks', 'mine');
    if (state.view === 'review-queue') return renderTaskListView(main, 'Review Queue', 'review-queue');
    if (state.view === 'all-tasks') return renderTaskListView(main, 'All Tasks', 'all');
    if (state.view === 'clients') return renderClients(main);
    if (state.view === 'engagements') return renderEngagements(main);
    if (state.view === 'templates') return renderTemplates(main);
    if (state.view === 'staff') return renderStaff(main);
  }

  // ============================================================
  // Task list views (My Tasks / Review Queue / All Tasks)
  // ============================================================
  async function renderTaskListView(main, title, mode) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = title;
    head.appendChild(h1);
    // Everyone can log their own work now, not just reviewers/admins —
    // openNewTaskModal() locks the assignee to "self" for employees (see
    // there), so this doesn't let anyone hand work to someone else.
    var addBtn = el('button', 'btn btn-sm');
    addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Task'));
    addBtn.addEventListener('click', function () { openNewTaskModal(); });
    head.appendChild(addBtn);
    main.appendChild(head);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var tasks = await loadTasks(mode);
    main.removeChild(loading);

    if (mode === 'all') renderWorkloadSummary(main, tasks);

    if (mode === 'mine') {
      renderGroupedTasks(main, tasks);
    } else {
      renderFlatTaskList(main, tasks);
    }
  }

  function renderGroupedTasks(main, tasks) {
    var groups = [
      { key: 'overdue', label: 'Overdue', filter: function (t) { return isOverdue(t); } },
      { key: 'ready_for_review', label: 'Ready for Review', filter: function (t) { return t.status === 'ready_for_review' && !isOverdue(t); } },
      { key: 'changes_required', label: 'Changes Required', filter: function (t) { return t.status === 'changes_required' && !isOverdue(t); } },
      { key: 'in_progress', label: 'In Progress', filter: function (t) { return t.status === 'in_progress' && !isOverdue(t); } },
      { key: 'waiting_for_client', label: 'Waiting for Client', filter: function (t) { return t.status === 'waiting_for_client' && !isOverdue(t); } },
      { key: 'not_started', label: 'Not Started', filter: function (t) { return t.status === 'not_started' && !isOverdue(t); } },
      { key: 'completed', label: 'Recently Completed', filter: function (t) { return t.status === 'completed'; } },
    ];
    var shown = 0;
    groups.forEach(function (g) {
      var items = tasks.filter(g.filter);
      if (g.key === 'completed') items = items.slice(0, 10);
      if (!items.length) return;
      shown += items.length;
      var wrap = el('div', 'task-group');
      var h3 = el('h3');
      h3.appendChild(document.createTextNode(g.label + ' '));
      var count = el('span', 'count'); count.textContent = String(items.length);
      h3.appendChild(count);
      wrap.appendChild(h3);
      items.forEach(function (t) { wrap.appendChild(taskRow(t)); });
      main.appendChild(wrap);
    });
    if (!shown) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No tasks assigned to you yet.'));
      main.appendChild(empty);
    }
  }

  // "Who's overloaded this week" — the one thing a flat task list can't
  // answer at a glance. Counts open (non-completed) work per assignee,
  // sorted busiest-first, with overdue count called out separately since
  // that's the number that actually matters day to day.
  function renderWorkloadSummary(main, tasks) {
    var open = tasks.filter(function (t) { return t.status !== 'completed'; });
    if (!open.length) return;
    var byAssignee = {};
    open.forEach(function (t) {
      var key = t.assignee_id || 'unassigned';
      if (!byAssignee[key]) byAssignee[key] = { open: 0, overdue: 0 };
      byAssignee[key].open++;
      if (isOverdue(t)) byAssignee[key].overdue++;
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

  function renderFlatTaskList(main, tasks) {
    if (!tasks.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('clipboard')); empty.appendChild(document.createTextNode('No tasks here yet.'));
      main.appendChild(empty);
      return;
    }
    var wrap = el('div', 'task-group');
    tasks.forEach(function (t) { wrap.appendChild(taskRow(t)); });
    main.appendChild(wrap);
  }

  function taskRow(t) {
    var row = el('div', 'task-row');
    row.addEventListener('click', function () { gotoTask(t.id); });
    row.appendChild(avatar(profileName(t.assignee_id)));
    var dot = el('span', 'priority-dot priority-dot-' + t.priority);
    dot.title = t.priority.charAt(0).toUpperCase() + t.priority.slice(1) + ' priority';
    row.appendChild(dot);
    var title = el('div', 'title');
    var strong = el('strong'); strong.textContent = t.title;
    var span = el('span');
    span.appendChild(icon('building'));
    span.appendChild(document.createTextNode(clientName(t.client_id) + (t.engagement_id ? ' · ' + engagementTitle(t.engagement_id) : '')));
    title.appendChild(strong); title.appendChild(span);
    row.appendChild(title);
    var due = el('span', 'due' + (isOverdue(t) ? ' overdue' : ''));
    due.appendChild(icon('calendar'));
    due.appendChild(document.createTextNode(t.due_date ? fmtDate(t.due_date) : 'No due date'));
    row.appendChild(due);
    var badge = el('span', 'badge badge-' + t.status);
    badge.textContent = STATUS_LABELS[t.status] || t.status;
    row.appendChild(badge);
    return row;
  }

  // ============================================================
  // New task modal
  // ============================================================
  // prefill (optional): { title, description, assigneeId, reviewerId,
  // templateId, checklistItems } — used by "Use This Template" on the Task
  // Templates page so recurring compliance work (VAT, TDS, monthly close)
  // doesn't have to be retyped by hand every time.
  function openNewTaskModal(prefill) {
    prefill = prefill || {};
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Task';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text'; titleInput.value = prefill.title || '';
    wrap.appendChild(field('Title', titleInput));

    var clientSel = el('select');
    clientSel.appendChild(new Option('— No client —', ''));
    state.clients.filter(function (c) { return c.is_active; }).forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    wrap.appendChild(field('Client', clientSel));

    var engSel = el('select');
    engSel.appendChild(new Option('— No engagement —', ''));
    wrap.appendChild(field('Engagement', engSel));
    clientSel.addEventListener('change', function () {
      clear(engSel);
      engSel.appendChild(new Option('— No engagement —', ''));
      state.engagements.filter(function (e) { return e.client_id === clientSel.value && e.status !== 'completed'; })
        .forEach(function (e) { engSel.appendChild(new Option(e.title, e.id)); });
    });

    var assigneeSel = el('select');
    state.profiles.filter(function (p) { return p.is_active; }).forEach(function (p) { assigneeSel.appendChild(new Option(p.full_name, p.id)); });
    if (prefill.assigneeId) assigneeSel.value = prefill.assigneeId;
    var assigneeField = field('Assignee', assigneeSel);
    if (!isReviewerOrAdmin()) {
      // Employees can create tasks for themselves, not hand work to
      // colleagues — that stays a reviewer/admin action.
      assigneeSel.value = state.user.id;
      assigneeSel.disabled = true;
      var lockedHint = el('span', 'f-hint'); lockedHint.textContent = 'Tasks you create are assigned to you.';
      assigneeField.appendChild(lockedHint);
    }
    wrap.appendChild(assigneeField);

    var reviewerSel = el('select');
    reviewerSel.appendChild(new Option('— No reviewer —', ''));
    state.profiles.filter(function (p) { return p.is_active && (p.role === 'admin' || p.role === 'reviewer'); })
      .forEach(function (p) { reviewerSel.appendChild(new Option(p.full_name, p.id)); });
    if (prefill.reviewerId) reviewerSel.value = prefill.reviewerId;
    wrap.appendChild(field('Reviewer', reviewerSel));

    var dueInput = el('input'); dueInput.type = 'date';
    wrap.appendChild(field('Due Date', dueInput));

    var prioritySel = el('select');
    ['low', 'normal', 'high'].forEach(function (p) { prioritySel.appendChild(new Option(p.charAt(0).toUpperCase() + p.slice(1), p)); });
    prioritySel.value = 'normal';
    wrap.appendChild(field('Priority', prioritySel));

    var descInput = el('textarea'); descInput.rows = 3; descInput.value = prefill.description || '';
    wrap.appendChild(field('Description / Instructions', descInput));

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Task';
    createBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the task a title.', true); return; }
      if (!assigneeSel.value) { toast('No active staff available to assign — activate someone under Staff first.', true); return; }
      createBtn.disabled = true;
      var res = await sb.from('tasks').insert({
        title: titleInput.value.trim(),
        client_id: clientSel.value || null,
        engagement_id: engSel.value || null,
        template_id: prefill.templateId || null,
        assignee_id: assigneeSel.value,
        reviewer_id: reviewerSel.value || null,
        due_date: dueInput.value || null,
        priority: prioritySel.value,
        description: descInput.value.trim() || null,
        created_by: state.user.id,
      }).select().single();
      if (res.error) { createBtn.disabled = false; toast('Could not create task: ' + res.error.message, true); return; }
      if (prefill.checklistItems && prefill.checklistItems.length) {
        var rows = prefill.checklistItems.map(function (title, i) { return { task_id: res.data.id, title: title, sort_order: i }; });
        var clRes = await sb.from('task_checklist_items').insert(rows);
        if (clRes.error) toast('Task created, but checklist items failed: ' + clRes.error.message, true);
      }
      createBtn.disabled = false;
      closeModal();
      toast('Task created.');
      gotoTask(res.data.id);
    });
    actions.appendChild(createBtn);
    wrap.appendChild(actions);

    openModal(wrap);
  }

  // ============================================================
  // Task detail
  // ============================================================
  async function renderTaskDetail(id) {
    var main = qs('#main');
    clear(main);
    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);

    var taskRes = await sb.from('tasks').select('*').eq('id', id).single();
    var checklistRes = await sb.from('task_checklist_items').select('*').eq('task_id', id).order('sort_order');
    var commentsRes = await sb.from('task_comments').select('*').eq('task_id', id).order('created_at');
    clear(main);

    if (taskRes.error || !taskRes.data) {
      var empty = el('div', 'empty-note'); empty.textContent = "That task doesn't exist, or you don't have access to it.";
      main.appendChild(empty);
      var back = el('button', 'btn btn-outline btn-sm'); back.type = 'button'; back.textContent = '← Back to My Tasks';
      back.addEventListener('click', function () { goto('my-tasks'); });
      main.appendChild(back);
      return;
    }
    var task = taskRes.data;
    var checklist = checklistRes.data || [];
    var comments = commentsRes.data || [];
    var isMine = task.assignee_id === state.user.id;
    var canEditFull = isReviewerOrAdmin();

    var card = el('div', 'card');
    var head = el('div', 'detail-head');
    var h1 = el('h1'); h1.style.fontSize = '1.25rem'; h1.textContent = task.title;
    var badge = el('span', 'badge badge-' + task.status); badge.textContent = STATUS_LABELS[task.status];
    head.appendChild(h1); head.appendChild(badge);
    card.appendChild(head);
    var backLink = el('a'); backLink.href = '#' + (state.view === 'task-detail' ? 'my-tasks' : state.view);
    backLink.textContent = '← Back';
    backLink.style.fontSize = '.85rem';
    card.appendChild(backLink);

    var metaGrid = el('div', 'meta-grid');
    metaGrid.appendChild(metaItem('Client', clientName(task.client_id), 'building'));
    metaGrid.appendChild(metaItem('Engagement', engagementTitle(task.engagement_id), 'idcard'));
    metaGrid.appendChild(metaItem('Assignee', profileName(task.assignee_id), 'user', true));
    metaGrid.appendChild(metaItem('Reviewer', task.reviewer_id ? profileName(task.reviewer_id) : '—', 'user', !!task.reviewer_id));
    metaGrid.appendChild(metaItem('Due Date', fmtDate(task.due_date), 'calendar'));
    metaGrid.appendChild(metaItem('Priority', task.priority.charAt(0).toUpperCase() + task.priority.slice(1), 'flag'));
    card.appendChild(metaGrid);

    // Status control — employees on their own task get a restricted set of
    // options (can't self-approve); reviewers/admins get all of them.
    if (isMine || canEditFull) {
      var statusWrap = el('div', 'f');
      var statusLabel = el('label'); statusLabel.textContent = 'Status'; statusWrap.appendChild(statusLabel);
      var statusSel = el('select');
      var allowed = canEditFull ? ALL_STATUSES : EMPLOYEE_STATUSES;
      allowed.forEach(function (s) { statusSel.appendChild(new Option(STATUS_LABELS[s], s)); });
      statusSel.value = task.status;
      if (!canEditFull && !isMine) statusSel.disabled = true;
      statusSel.addEventListener('change', async function () {
        var res = await sb.from('tasks').update({ status: statusSel.value }).eq('id', task.id);
        if (res.error) { toast('Could not update status: ' + res.error.message, true); statusSel.value = task.status; return; }
        task.status = statusSel.value;
        badge.className = 'badge badge-' + task.status;
        badge.textContent = STATUS_LABELS[task.status];
        toast('Status updated.');
      });
      statusWrap.appendChild(statusSel);
      if (!canEditFull) {
        var hint = el('span', 'f-hint'); hint.textContent = 'A reviewer sets Completed or Changes Required.';
        statusWrap.appendChild(hint);
      }
      card.appendChild(statusWrap);
    }

    if (task.description) {
      var descP = el('p'); descP.style.whiteSpace = 'pre-wrap'; descP.style.marginTop = '14px'; descP.textContent = task.description;
      card.appendChild(descP);
    }
    main.appendChild(card);

    // Checklist
    var checklistCard = el('div', 'card');
    var clH2 = el('h2'); clH2.appendChild(icon('check')); clH2.appendChild(document.createTextNode('Checklist')); checklistCard.appendChild(clH2);
    if (!checklist.length) {
      var noItems = el('p', 'desc'); noItems.textContent = 'No checklist items yet.';
      checklistCard.appendChild(noItems);
    }
    checklist.forEach(function (item) {
      var row = el('label', 'checklist-item' + (item.is_done ? ' done' : ''));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = item.is_done;
      cb.addEventListener('change', async function () {
        var res = await sb.from('task_checklist_items').update({ is_done: cb.checked }).eq('id', item.id);
        if (res.error) { toast('Could not update item: ' + res.error.message, true); cb.checked = !cb.checked; return; }
        row.classList.toggle('done', cb.checked);
      });
      var span = el('span'); span.textContent = item.title;
      row.appendChild(cb); row.appendChild(span);
      checklistCard.appendChild(row);
    });
    if (isMine || canEditFull) {
      var addItemRow = el('div', 'f');
      addItemRow.style.display = 'flex'; addItemRow.style.gap = '8px'; addItemRow.style.marginTop = '12px';
      var newItemInput = el('input'); newItemInput.type = 'text'; newItemInput.placeholder = 'Add a checklist item…';
      var addItemBtn = el('button', 'btn btn-outline btn-sm'); addItemBtn.type = 'button'; addItemBtn.textContent = 'Add';
      addItemBtn.addEventListener('click', async function () {
        if (!newItemInput.value.trim()) return;
        var res = await sb.from('task_checklist_items').insert({ task_id: task.id, title: newItemInput.value.trim(), sort_order: checklist.length }).select().single();
        if (res.error) { toast('Could not add item: ' + res.error.message, true); return; }
        newItemInput.value = '';
        renderTaskDetail(id);
      });
      addItemRow.appendChild(newItemInput); addItemRow.appendChild(addItemBtn);
      checklistCard.appendChild(addItemRow);
    }
    main.appendChild(checklistCard);

    // Comments
    var commentsCard = el('div', 'card');
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
      var res = await sb.from('task_comments').insert({ task_id: task.id, author_id: state.user.id, body: commentInput.value.trim() });
      if (res.error) { toast('Could not post comment: ' + res.error.message, true); return; }
      commentInput.value = '';
      renderTaskDetail(id);
    });
    commentsCard.appendChild(commentInput);
    commentsCard.appendChild(commentBtn);
    main.appendChild(commentsCard);
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
    var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Client'));
    addBtn.addEventListener('click', openNewClientModal);
    head.appendChild(addBtn);
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
      var h3 = el('h3'); h3.textContent = c.name; nameWrap.appendChild(h3);
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
      var toggleBtn = el('button', 'btn btn-outline btn-sm'); toggleBtn.type = 'button';
      toggleBtn.textContent = c.is_active ? 'Deactivate' : 'Reactivate';
      toggleBtn.addEventListener('click', async function () {
        var res = await sb.from('clients').update({ is_active: !c.is_active }).eq('id', c.id);
        if (res.error) { toast('Could not update: ' + res.error.message, true); return; }
        await loadClients();
        render();
      });
      actions.appendChild(toggleBtn);
      card.appendChild(actions);
      grid.appendChild(card);
    });
    main.appendChild(grid);
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
      var res = await sb.rpc('get_client_credentials', { p_client_id: c.id });
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
        revealBtn.addEventListener('click', function () {
          revealed = !revealed;
          pCode.textContent = revealed ? cred.password : '••••••••';
          revealBtn.textContent = revealed ? 'Hide' : 'Show';
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
    var passInput = el('input'); passInput.type = 'text'; passInput.placeholder = 'Stored encrypted';
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

  function openNewClientModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Client';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var nameInput = el('input'); nameInput.type = 'text';
    wrap.appendChild(field('Client / Business Name', nameInput));

    var typeSel = el('select');
    // Same categories as the public site's contact form (content/site.yaml
    // businessTypeOptions) so a client's type reads the same way whether
    // it came from an inquiry or was entered here directly.
    ['Not yet registered', 'Sole Proprietorship (Firm)', 'Partnership', 'Private Limited Company', 'NGO / Non-profit', 'Other']
      .forEach(function (t) { typeSel.appendChild(new Option(t, t)); });
    wrap.appendChild(field('Business Type', typeSel));

    var panInput = el('input'); panInput.type = 'text'; panInput.placeholder = 'e.g. 609876543';
    wrap.appendChild(field('PAN / VAT Number (optional)', panInput));

    var contactInput = el('input'); contactInput.type = 'text';
    wrap.appendChild(field('Contact Person (optional)', contactInput));

    var phoneInput = el('input'); phoneInput.type = 'tel';
    wrap.appendChild(field('Phone (optional)', phoneInput));

    var emailInput = el('input'); emailInput.type = 'email';
    wrap.appendChild(field('Email (optional)', emailInput));

    var notesInput = el('textarea'); notesInput.rows = 2;
    wrap.appendChild(field('Notes (optional)', notesInput));

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Client';
    createBtn.addEventListener('click', async function () {
      if (!nameInput.value.trim()) { toast('Give the client a name.', true); return; }
      var res = await sb.from('clients').insert({
        name: nameInput.value.trim(),
        business_type: typeSel.value,
        pan_vat: panInput.value.trim() || null,
        contact_person: contactInput.value.trim() || null,
        phone: phoneInput.value.trim() || null,
        email: emailInput.value.trim() || null,
        notes: notesInput.value.trim() || null,
      });
      if (res.error) { toast('Could not create client: ' + res.error.message, true); return; }
      closeModal();
      toast('Client created.');
      await loadClients();
      render();
    });
    actions.appendChild(createBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // ============================================================
  // Admin: Engagements
  // ============================================================
  function renderEngagements(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Engagements'; head.appendChild(h1);
    var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Engagement'));
    addBtn.addEventListener('click', openNewEngagementModal);
    head.appendChild(addBtn);
    main.appendChild(head);

    var card = el('div', 'card');
    var table = el('table');
    var thead = el('thead'); var trh = el('tr');
    ['Title', 'Client', 'Status'].forEach(function (t) { var th = el('th'); th.textContent = t; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    var ENGAGEMENT_STATUSES = ['active', 'on_hold', 'completed'];
    var ENGAGEMENT_STATUS_LABELS = { active: 'Active', on_hold: 'On Hold', completed: 'Completed' };
    state.engagements.forEach(function (e) {
      var tr = el('tr', e.status === 'completed' ? 'inactive-row' : '');
      var tdTitle = el('td'); tdTitle.textContent = e.title;
      var tdClient = el('td'); tdClient.textContent = clientName(e.client_id);
      var tdStatus = el('td');
      var statusSel = el('select', 'role-select');
      ENGAGEMENT_STATUSES.forEach(function (s) { statusSel.appendChild(new Option(ENGAGEMENT_STATUS_LABELS[s], s)); });
      statusSel.value = e.status || 'active';
      statusSel.addEventListener('change', async function () {
        var res = await sb.from('engagements').update({ status: statusSel.value }).eq('id', e.id);
        if (res.error) { toast('Could not update: ' + res.error.message, true); statusSel.value = e.status; return; }
        e.status = statusSel.value;
        toast(e.title + ' is now ' + ENGAGEMENT_STATUS_LABELS[e.status] + '.');
        tr.className = e.status === 'completed' ? 'inactive-row' : '';
      });
      tdStatus.appendChild(statusSel);
      tr.appendChild(tdTitle); tr.appendChild(tdClient); tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    if (!state.engagements.length) {
      var empty = el('p', 'desc'); empty.textContent = 'No engagements yet.'; card.appendChild(empty);
    }
    main.appendChild(card);
  }

  function openNewEngagementModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Engagement';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var clientSel = el('select');
    state.clients.filter(function (c) { return c.is_active; }).forEach(function (c) { clientSel.appendChild(new Option(c.name, c.id)); });
    wrap.appendChild(field('Client', clientSel));
    var titleInput = el('input'); titleInput.type = 'text';
    wrap.appendChild(field('Engagement Title', titleInput));
    var descInput = el('textarea'); descInput.rows = 2;
    wrap.appendChild(field('Description (optional)', descInput));

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Engagement';
    createBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the engagement a title.', true); return; }
      if (!clientSel.value) { toast('Choose a client first — add one under Clients if none exist yet.', true); return; }
      var res = await sb.from('engagements').insert({ client_id: clientSel.value, title: titleInput.value.trim(), description: descInput.value.trim() || null });
      if (res.error) { toast('Could not create engagement: ' + res.error.message, true); return; }
      closeModal();
      toast('Engagement created.');
      await loadEngagements();
      render();
    });
    actions.appendChild(createBtn);
    wrap.appendChild(actions);
    openModal(wrap);
  }

  // ============================================================
  // Admin: Task Templates (definitions only — generating task instances
  // from these on a schedule is a later addition, not built yet)
  // ============================================================
  async function renderTemplates(main) {
    var head = el('div', 'page-head');
    var h1 = el('h1'); h1.textContent = 'Task Templates'; head.appendChild(h1);
    var addBtn = el('button', 'btn btn-sm'); addBtn.type = 'button'; addBtn.appendChild(icon('plus')); addBtn.appendChild(document.createTextNode('New Template'));
    addBtn.addEventListener('click', openNewTemplateModal);
    head.appendChild(addBtn);
    main.appendChild(head);

    var note = el('div', 'card');
    var p = el('p', 'desc');
    p.style.margin = '0';
    p.textContent = 'Templates describe recurring work (e.g. "Monthly Bookkeeping Close"). Generating tasks automatically on a schedule isn\'t built yet — "Use This Template" fills in a new task and its checklist for you, one client at a time.';
    note.appendChild(p);
    main.appendChild(note);

    var loading = el('div', 'empty-note'); loading.textContent = 'Loading…';
    main.appendChild(loading);
    var res = await sb.from('task_templates').select('*, task_template_items(*)').order('title');
    main.removeChild(loading);
    if (res.error) { toast('Could not load templates: ' + res.error.message, true); return; }
    var templates = res.data || [];
    if (!templates.length) {
      var empty = el('div', 'empty-note'); empty.appendChild(icon('flag')); empty.appendChild(document.createTextNode('No templates yet.'));
      main.appendChild(empty);
      return;
    }
    templates.forEach(function (t) {
      var card = el('div', 'card');
      var h2 = el('h2'); h2.textContent = t.title; card.appendChild(h2);
      var meta = el('p', 'desc');
      meta.textContent = (t.recurrence !== 'none' ? 'Recurs ' + t.recurrence : 'One-off') +
        (t.default_assignee_id ? ' · Default assignee: ' + profileName(t.default_assignee_id) : '');
      card.appendChild(meta);
      if (t.description) { var d = el('p'); d.textContent = t.description; card.appendChild(d); }
      var items = t.task_template_items || [];
      if (items.length) {
        var ul = el('ul'); ul.style.paddingLeft = '18px'; ul.style.listStyle = 'disc';
        items.sort(function (a, b) { return a.sort_order - b.sort_order; }).forEach(function (it) {
          var li = el('li'); li.textContent = it.title; ul.appendChild(li);
        });
        card.appendChild(ul);
      }
      var useBtn = el('button', 'btn btn-outline btn-sm');
      useBtn.type = 'button';
      useBtn.style.marginTop = '14px';
      useBtn.appendChild(icon('plus'));
      useBtn.appendChild(document.createTextNode('Use This Template'));
      useBtn.addEventListener('click', function () {
        openNewTaskModal({
          title: t.title,
          description: t.description,
          assigneeId: t.default_assignee_id,
          reviewerId: t.default_reviewer_id,
          templateId: t.id,
          checklistItems: items.sort(function (a, b) { return a.sort_order - b.sort_order; }).map(function (it) { return it.title; }),
        });
      });
      card.appendChild(useBtn);
      main.appendChild(card);
    });
  }

  function openNewTemplateModal() {
    var wrap = el('div');
    var head = el('div', 'modal-head');
    var h2 = el('h2'); h2.textContent = 'New Task Template';
    var closeBtn = el('button', 'btn btn-outline btn-sm'); closeBtn.type = 'button'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(h2); head.appendChild(closeBtn);
    wrap.appendChild(head);

    var titleInput = el('input'); titleInput.type = 'text';
    wrap.appendChild(field('Title', titleInput));
    var descInput = el('textarea'); descInput.rows = 2;
    wrap.appendChild(field('Description (optional)', descInput));
    var recurSel = el('select');
    [['none', 'One-off'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']]
      .forEach(function (r) { recurSel.appendChild(new Option(r[1], r[0])); });
    wrap.appendChild(field('Recurrence', recurSel));
    var itemsInput = el('textarea'); itemsInput.rows = 4; itemsInput.placeholder = 'One checklist item per line';
    wrap.appendChild(field('Checklist Items (one per line, optional)', itemsInput));

    var actions = el('div', 'modal-actions');
    var createBtn = el('button', 'btn'); createBtn.type = 'button'; createBtn.textContent = 'Create Template';
    createBtn.addEventListener('click', async function () {
      if (!titleInput.value.trim()) { toast('Give the template a title.', true); return; }
      var res = await sb.from('task_templates').insert({
        title: titleInput.value.trim(),
        description: descInput.value.trim() || null,
        recurrence: recurSel.value,
      }).select().single();
      if (res.error) { toast('Could not create template: ' + res.error.message, true); return; }
      var lines = itemsInput.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length) {
        var rows = lines.map(function (title, i) { return { template_id: res.data.id, title: title, sort_order: i }; });
        var itemsRes = await sb.from('task_template_items').insert(rows);
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

  // Deactivating someone who still has open work would silently strand
  // those tasks: the person can no longer log in (enterApp() checks
  // is_active), but the tasks stay assigned to them, invisible in anyone's
  // "My Tasks" except an admin/reviewer's firm-wide views. This checks for
  // open tasks first and, if there are any, makes reassignment part of the
  // deactivation instead of an afterthought someone has to remember later.
  async function confirmDeactivateStaff(p2) {
    var res = await sb.from('tasks').select('*').eq('assignee_id', p2.id).neq('status', 'completed');
    if (res.error) { toast('Could not check their open tasks: ' + res.error.message, true); return; }
    var openTasks = res.data || [];
    if (!openTasks.length) {
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
    p.textContent = p2.full_name + ' has ' + openTasks.length + ' open task' + (openTasks.length === 1 ? '' : 's') + '. Once deactivated they can\'t log in, so those tasks need a new assignee first.';
    wrap.appendChild(p);

    var list = el('ul'); list.style.paddingLeft = '18px'; list.style.listStyle = 'disc'; list.style.marginBottom = '14px';
    openTasks.forEach(function (t) { var li = el('li'); li.textContent = t.title; list.appendChild(li); });
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
      var reassignRes = await sb.from('tasks').update({ assignee_id: reassignSel.value }).eq('assignee_id', p2.id).neq('status', 'completed');
      if (reassignRes.error) { confirmBtn.disabled = false; toast('Could not reassign tasks: ' + reassignRes.error.message, true); return; }
      var deactivateRes = await sb.from('profiles').update({ is_active: false }).eq('id', p2.id);
      confirmBtn.disabled = false;
      if (deactivateRes.error) { toast('Tasks reassigned, but deactivation failed: ' + deactivateRes.error.message, true); return; }
      closeModal();
      toast(openTasks.length + ' task' + (openTasks.length === 1 ? '' : 's') + ' reassigned; ' + p2.full_name + ' deactivated.');
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
