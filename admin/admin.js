// Admin panel logic — extracted from an inline <script> block so it can
// run under a CSP with no 'unsafe-inline' in script-src (see /admin/* rule
// in build.js's _headers generation). Behavior is unchanged from before.
(function () {
  'use strict';

  var CONTENT_PATH = 'content/site.yaml';
  var state = { owner: '', repo: '', branch: 'main', token: '', sha: null, content: null, dirty: false };

  // ---------- utils ----------
  function b64DecodeUtf8(b64) {
    var binary = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function b64EncodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function showToast(text, isError) {
    var t = document.getElementById('toast');
    t.textContent = text;
    t.className = isError ? 'error' : '';
    t.classList.remove('hidden');
    if (!isError) setTimeout(function () { t.classList.add('hidden'); }, 6000);
  }
  function markDirty() {
    state.dirty = true;
    var b = document.getElementById('saveBtn');
    b.disabled = false;
    b.textContent = 'Save Changes •';
    document.getElementById('statusText').textContent = 'Unsaved changes';
  }
  function clearDirty() {
    state.dirty = false;
    var b = document.getElementById('saveBtn');
    b.disabled = true;
    b.textContent = 'Save Changes';
    document.getElementById('statusText').textContent = 'Up to date';
  }

  // ---------- GitHub API ----------
  function ghApi(path, opts) {
    opts = opts || {};
    var headers = Object.assign({
      'Authorization': 'token ' + state.token,
      'Accept': 'application/vnd.github+json'
    }, opts.headers || {});
    return fetch('https://api.github.com' + path, Object.assign({}, opts, { headers: headers }))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var msg = (data && data.message) || (res.status + ' ' + res.statusText);
            throw new Error(msg);
          }
          return data;
        });
      });
  }

  function loadContent() {
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + CONTENT_PATH + '?ref=' + encodeURIComponent(state.branch);
    return ghApi(url).then(function (data) {
      state.sha = data.sha;
      var text = b64DecodeUtf8(data.content);
      state.content = jsyaml.load(text);
      return state.content;
    });
  }

  function saveContent() {
    var text = jsyaml.dump(state.content, { lineWidth: 100 });
    var body = {
      message: 'Update site content via admin panel',
      content: b64EncodeUtf8(text),
      sha: state.sha,
      branch: state.branch
    };
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + CONTENT_PATH;
    return ghApi(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (data) {
        state.sha = data.content.sha;
      });
  }

  // Generic single-file helpers (used by the Blog Posts editor, which manages
  // its own files/commits independently of the site.yaml save button).
  function ghListDir(path) {
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch);
    return ghApi(url);
  }
  function ghGetFile(path) {
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch);
    return ghApi(url);
  }
  function ghPutFile(path, text, sha, message) {
    var body = { message: message, content: b64EncodeUtf8(text), branch: state.branch };
    if (sha) body.sha = sha;
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + path;
    return ghApi(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function ghDeleteFile(path, sha, message) {
    var body = { message: message, sha: sha, branch: state.branch };
    var url = '/repos/' + state.owner + '/' + state.repo + '/contents/' + path;
    return ghApi(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  // ---------- form helpers ----------
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // Up/Down reorder buttons for the item at position idx within arr. Swaps
  // it with its neighbour and re-renders the list. Disabled at each end.
  function moveButtons(arr, idx, render) {
    var wrap = el('span', 'move-buttons');
    var up = el('button', 'btn-move'); up.type = 'button'; up.textContent = '▲'; up.title = 'Move up'; up.setAttribute('aria-label', 'Move up');
    var down = el('button', 'btn-move'); down.type = 'button'; down.textContent = '▼'; down.title = 'Move down'; down.setAttribute('aria-label', 'Move down');
    up.disabled = idx === 0;
    down.disabled = idx === arr.length - 1;
    up.addEventListener('click', function () {
      var t = arr[idx]; arr[idx] = arr[idx - 1]; arr[idx - 1] = t;
      markDirty(); render();
    });
    down.addEventListener('click', function () {
      var t = arr[idx]; arr[idx] = arr[idx + 1]; arr[idx + 1] = t;
      markDirty(); render();
    });
    wrap.appendChild(up); wrap.appendChild(down);
    return wrap;
  }

  function textField(labelText, getVal, setVal, opts) {
    opts = opts || {};
    var wrap = el('div', 'f-field');
    var label = el('label'); label.textContent = labelText; wrap.appendChild(label);
    var input = el(opts.multiline ? 'textarea' : 'input');
    if (!opts.multiline) input.type = 'text';
    if (opts.multiline) input.rows = opts.rows || 3;
    input.value = getVal() || '';
    input.disabled = !!opts.disabled;
    input.addEventListener('input', function () { setVal(input.value); markDirty(); });
    wrap.appendChild(input);
    if (opts.hint) { var h = el('span', 'f-hint'); h.textContent = opts.hint; wrap.appendChild(h); }
    return wrap;
  }

  // Checkbox bound to a getter/setter. Returns a labelled row.
  function checkboxField(labelText, getVal, setVal, opts) {
    opts = opts || {};
    var wrap = el('label', 'f-check');
    var input = el('input'); input.type = 'checkbox';
    input.checked = !!getVal();
    input.addEventListener('change', function () { setVal(input.checked); markDirty(); });
    var span = el('span'); span.textContent = labelText;
    wrap.appendChild(input); wrap.appendChild(span);
    if (opts.hint) { var h = el('span', 'f-hint'); h.textContent = opts.hint; wrap.appendChild(h); }
    return wrap;
  }

  function stringListEditor(arr, itemLabel) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (val, idx) {
        var row = el('div', 'list-row');
        var input = el('input'); input.type = 'text'; input.value = val;
        input.addEventListener('input', function () { arr[idx] = input.value; markDirty(); });
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        row.appendChild(input); row.appendChild(rm);
        wrap.appendChild(row);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add ' + (itemLabel || 'item');
      add.addEventListener('click', function () { arr.push(''); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // list of {title, text} — used for values / whyChoose
  function titleTextListEditor(arr, itemLabel) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (obj, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = (itemLabel || 'Item') + ' ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(textField('Title', function () { return obj.title; }, function (v) { obj.title = v; }));
        card.appendChild(textField('Text', function () { return obj.text; }, function (v) { obj.text = v; }, { multiline: true, rows: 2 }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add ' + (itemLabel || 'item');
      add.addEventListener('click', function () { arr.push({ title: '', text: '' }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // FAQs: list of {q, a}
  function faqListEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (obj, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Question ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(textField('Question', function () { return obj.q; }, function (v) { obj.q = v; }));
        card.appendChild(textField('Answer', function () { return obj.a; }, function (v) { obj.a = v; }, { multiline: true, rows: 3 }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Question';
      add.addEventListener('click', function () { arr.push({ q: '', a: '' }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // Service categories: title/tagline editable, items string list editable, key/icon/letter locked
  function serviceCategoriesEditor(arr) {
    var wrap = el('div');
    arr.forEach(function (cat) {
      var card = el('div', 'sub-card');
      var head = el('div', 'sub-head');
      var strong = el('strong'); strong.textContent = 'Category ' + cat.letter;
      var lock = el('span', 'locked-tag'); lock.textContent = 'icon: ' + cat.icon + ' (locked)';
      head.appendChild(strong); head.appendChild(lock);
      card.appendChild(head);
      card.appendChild(textField('Title', function () { return cat.title; }, function (v) { cat.title = v; }));
      card.appendChild(textField('Tagline', function () { return cat.tagline; }, function (v) { cat.tagline = v; }));
      var itemsWrap = el('div', 'f-field');
      var itemsLabel = el('label'); itemsLabel.textContent = 'Services listed under this category'; itemsWrap.appendChild(itemsLabel);
      itemsWrap.appendChild(stringListEditor(cat.items, 'service'));
      card.appendChild(itemsWrap);
      wrap.appendChild(card);
    });
    return wrap;
  }

  // Packages: name/audience editable, items string list editable
  function packagesEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (pkg, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Package ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(textField('Package Name', function () { return pkg.name; }, function (v) { pkg.name = v; }));
        card.appendChild(textField('Audience (who it\'s for)', function () { return pkg.audience; }, function (v) { pkg.audience = v; }));
        var itemsWrap = el('div', 'f-field');
        var itemsLabel = el('label'); itemsLabel.textContent = 'What\'s included'; itemsWrap.appendChild(itemsLabel);
        itemsWrap.appendChild(stringListEditor(pkg.items, 'inclusion'));
        card.appendChild(itemsWrap);
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Package';
      add.addEventListener('click', function () { arr.push({ name: '', audience: '', items: [] }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // Document groups: title editable, items string list editable
  function documentGroupsEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (grp, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Group ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(textField('Group Title', function () { return grp.title; }, function (v) { grp.title = v; }));
        var itemsWrap = el('div', 'f-field');
        var itemsLabel = el('label'); itemsLabel.textContent = 'Documents in this list'; itemsWrap.appendChild(itemsLabel);
        itemsWrap.appendChild(stringListEditor(grp.items, 'document'));
        card.appendChild(itemsWrap);
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Document Group';
      add.addEventListener('click', function () { arr.push({ title: '', items: [] }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // Useful Links: name/url/description, each editable, with add/remove
  function usefulLinksEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (link, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Link ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm);
        card.appendChild(head);
        card.appendChild(textField('Name', function () { return link.name; }, function (v) { link.name = v; }));
        card.appendChild(textField('Web Address (must start with https://)', function () { return link.url; }, function (v) { link.url = v; }));
        card.appendChild(textField('Description', function () { return link.description; }, function (v) { link.description = v; }, { multiline: true, rows: 2 }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Link';
      add.addEventListener('click', function () { arr.push({ name: '', url: 'https://', description: '' }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // Industries: name editable, icon locked (no add/remove — icons are fixed to a known set)
  function industriesEditor(arr) {
    var wrap = el('div');
    arr.forEach(function (ind) {
      var card = el('div', 'sub-card');
      var head = el('div', 'sub-head');
      var strong = el('strong'); strong.textContent = ind.name || 'Industry';
      var lock = el('span', 'locked-tag'); lock.textContent = 'icon: ' + ind.icon;
      head.appendChild(strong); head.appendChild(lock);
      card.appendChild(head);
      card.appendChild(textField('Name', function () { return ind.name; }, function (v) { ind.name = v; strong.textContent = v || 'Industry'; }));
      card.appendChild(textField('Short description (shown on the Industries page)', function () { return ind.description; }, function (v) { ind.description = v; }, { multiline: true, rows: 2 }));
      wrap.appendChild(card);
    });
    var hint = el('span', 'f-hint');
    hint.textContent = 'Icons are locked to a fixed set — renaming an industry or editing its description is fine, but adding a brand-new one needs a developer to add a matching icon.';
    wrap.appendChild(hint);
    return wrap;
  }

  // Process steps: step number locked, title/text editable
  function processEditor(arr) {
    var wrap = el('div');
    arr.forEach(function (step) {
      var card = el('div', 'sub-card');
      var head = el('div', 'sub-head');
      var strong = el('strong'); strong.textContent = 'Step ' + step.step + ' (order locked)';
      head.appendChild(strong);
      card.appendChild(head);
      card.appendChild(textField('Title', function () { return step.title; }, function (v) { step.title = v; }));
      card.appendChild(textField('Description', function () { return step.text; }, function (v) { step.text = v; }, { multiline: true, rows: 2 }));
      wrap.appendChild(card);
    });
    return wrap;
  }

  // Pages: hide/show checkboxes. key/href are locked (they map to real files).
  function pageVisibilityEditor(arr) {
    var wrap = el('div');
    arr.forEach(function (pg) {
      var row = el('div', 'page-row');
      var name = el('span', 'page-row-label');
      name.textContent = (pg.label || pg.key) + '  (' + (pg.href || '') + ')';
      row.appendChild(name);
      // "hidden" is inverted for the editor: the tick means "show on site".
      row.appendChild(checkboxField('Show in menu', function () { return pg.hidden !== true; }, function (v) { pg.hidden = !v; }));
      wrap.appendChild(row);
    });
    return wrap;
  }

  // Page headings: eyebrow/title/subtitle per page key.
  function pageHeadingsEditor(obj) {
    var wrap = el('div');
    Object.keys(obj).forEach(function (key) {
      var h = obj[key] || (obj[key] = {});
      var card = el('div', 'sub-card');
      var head = el('div', 'sub-head');
      var strong = el('strong'); strong.textContent = key + '.html';
      head.appendChild(strong); card.appendChild(head);
      card.appendChild(textField('Small Heading / Eyebrow', function () { return h.eyebrow; }, function (v) { h.eyebrow = v; }));
      card.appendChild(textField('Main Heading', function () { return h.title; }, function (v) { h.title = v; }));
      card.appendChild(textField('Subtitle', function () { return h.subtitle; }, function (v) { h.subtitle = v; }, { multiline: true, rows: 2 }));
      wrap.appendChild(card);
    });
    return wrap;
  }

  // Team members: name/role/location/bio + hide toggle, add/remove.
  function teamEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (m, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Team Member ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm); card.appendChild(head);
        card.appendChild(checkboxField('Hide this team member', function () { return m.hidden === true; }, function (v) { m.hidden = v; }));
        card.appendChild(textField('Name', function () { return m.name; }, function (v) { m.name = v; }));
        card.appendChild(textField('Role / Position', function () { return m.role; }, function (v) { m.role = v; }));
        card.appendChild(textField('Location', function () { return m.location; }, function (v) { m.location = v; }));
        card.appendChild(textField('Photo URL (optional)', function () { return m.photo; }, function (v) { m.photo = v; }, { hint: 'Prefer uploading the image to the repo\'s /images/ folder and pasting that URL here, rather than linking to an external site — every visitor to the Team page loads this URL directly, so an untrusted external host could see visitor traffic.' }));
        card.appendChild(textField('Short Bio', function () { return m.bio; }, function (v) { m.bio = v; }, { multiline: true, rows: 3 }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Team Member';
      add.addEventListener('click', function () { arr.push({ name: '', role: '', location: '', photo: '', bio: '', hidden: false }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // Testimonials: quote/name/role/business + hide toggle, add/remove.
  function testimonialsEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (t, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'Testimonial ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm); card.appendChild(head);
        card.appendChild(checkboxField('Hide this testimonial', function () { return t.hidden === true; }, function (v) { t.hidden = v; }));
        card.appendChild(textField('Client Quote', function () { return t.quote; }, function (v) { t.quote = v; }, { multiline: true, rows: 3 }));
        card.appendChild(textField('Client Name', function () { return t.name; }, function (v) { t.name = v; }));
        card.appendChild(textField('Client Role', function () { return t.role; }, function (v) { t.role = v; }));
        card.appendChild(textField('Business / Company', function () { return t.business; }, function (v) { t.business = v; }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add Testimonial';
      add.addEventListener('click', function () { arr.push({ quote: '', name: '', role: '', business: '', hidden: true }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }


  // ---------- Calculator / Tax rates editors ----------

  // One income tax slab row: width (null = unlimited) + rate + sst toggle
  function slabRowEditor(band, onRemove) {
    var row = el('div', 'slab-row');
    // Width field
    var wField = el('div', 'f-field'); wField.style.flex = '1';
    var wLabel = el('label'); wLabel.textContent = 'Width (NPR, blank = unlimited)';
    wField.appendChild(wLabel);
    var wInput = el('input'); wInput.type = 'number'; wInput.min = '0'; wInput.step = '1';
    wInput.value = band.width != null ? band.width : '';
    wInput.placeholder = 'blank = rest of income';
    wInput.addEventListener('input', function () {
      var v = wInput.value.trim();
      band.width = v === '' ? null : (parseFloat(v) || 0);
      markDirty();
    });
    wField.appendChild(wInput); row.appendChild(wField);
    // Rate field
    var rField = el('div', 'f-field'); rField.style.flex = '0 0 90px';
    var rLabel = el('label'); rLabel.textContent = 'Rate %';
    rField.appendChild(rLabel);
    var rInput = el('input'); rInput.type = 'number'; rInput.min = '0'; rInput.step = '0.1';
    rInput.value = band.rate != null ? band.rate : '';
    rInput.addEventListener('input', function () { band.rate = parseFloat(rInput.value) || 0; markDirty(); });
    rField.appendChild(rInput); row.appendChild(rField);
    // SST checkbox
    var sstWrap = el('div', 'f-field'); sstWrap.style.flex = '0 0 auto'; sstWrap.style.justifyContent = 'flex-end';
    sstWrap.appendChild(checkboxField('SST band', function () { return !!band.sst; }, function (v) { band.sst = v || undefined; markDirty(); }));
    row.appendChild(sstWrap);
    // Remove button
    if (onRemove) {
      var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
      rm.style.alignSelf = 'flex-end'; rm.style.marginBottom = '2px';
      rm.addEventListener('click', onRemove);
      row.appendChild(rm);
    }
    return row;
  }

  function slabListEditor(bands, renderParent) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      bands.forEach(function (b, idx) {
        wrap.appendChild(slabRowEditor(b, function () {
          bands.splice(idx, 1); markDirty(); render();
        }));
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add slab';
      add.addEventListener('click', function () { bands.push({ width: null, rate: 0 }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // One FY tax table: label, hasCouple, disclaimer, single slabs, optional couple slabs
  function taxTableEditor(table, onRemove) {
    var card = el('div', 'sub-card');
    var head = el('div', 'sub-head');
    var strong = el('strong'); strong.textContent = 'FY ' + (table.key || '');
    var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = 'Remove FY'; rm.style.fontSize = '.78rem';
    rm.addEventListener('click', onRemove);
    head.appendChild(strong); head.appendChild(rm); card.appendChild(head);

    card.appendChild(textField('FY Key (e.g. 2084)', function () { return table.key; }, function (v) { table.key = v; markDirty(); }, { hint: 'Used internally — match the button data-fy value you want (e.g. 2084).' }));
    card.appendChild(textField('Label (shown in the badge, e.g. FY 2084/85 · 2027/28)', function () { return table.label; }, function (v) { table.label = v; markDirty(); }));
    card.appendChild(textField('Disclaimer (shown below the slab table)', function () { return table.disclaimer; }, function (v) { table.disclaimer = v; markDirty(); }, { multiline: true, rows: 2 }));
    card.appendChild(checkboxField('Has separate Married Couple slabs', function () { return !!table.hasCouple; }, function (v) { table.hasCouple = v; markDirty(); render(); }));

    var slabLabel = el('label', 'block-label'); slabLabel.textContent = 'Individual slabs (top to bottom = lowest to highest)'; slabLabel.style.marginTop = '14px'; card.appendChild(slabLabel);
    card.appendChild(slabListEditor(table.single || (table.single = [])));

    if (table.hasCouple) {
      var coupleLabel = el('label', 'block-label'); coupleLabel.textContent = 'Married couple slabs'; coupleLabel.style.marginTop = '14px'; card.appendChild(coupleLabel);
      card.appendChild(slabListEditor(table.couple || (table.couple = [])));
    }

    function render() { /* re-renders inline */ }
    return card;
  }

  // All FY tables
  function taxTablesEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (table, idx) {
        wrap.appendChild(taxTableEditor(table, function () {
          if (!window.confirm('Remove the entire FY ' + (table.label || table.key || '') + ' tax table? This cannot be undone once you Save.')) return;
          arr.splice(idx, 1); markDirty(); render();
        }));
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add new fiscal year';
      add.addEventListener('click', function () {
        arr.push({ key: '', label: '', hasCouple: false, disclaimer: '', single: [], couple: [] });
        markDirty(); render();
      });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }

  // TDS type rows
  function tdsTypesEditor(arr) {
    var wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      arr.forEach(function (t, idx) {
        var card = el('div', 'sub-card');
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = 'TDS Type ' + (idx + 1);
        var rm = el('button', 'btn-remove'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { if (!window.confirm('Remove this item? This cannot be undone once you Save.')) return; arr.splice(idx, 1); markDirty(); render(); });
        head.appendChild(strong); head.appendChild(moveButtons(arr, idx, render)); head.appendChild(rm); card.appendChild(head);
        var g = el('div', 'f-grid'); g.style.gridTemplateColumns = '1fr auto';
        g.appendChild(textField('Dropdown Label', function () { return t.label; }, function (v) { t.label = v; markDirty(); }));
        var rWrap = el('div', 'f-field');
        var rLbl = el('label'); rLbl.textContent = 'Rate %'; rWrap.appendChild(rLbl);
        var rIn = el('input'); rIn.type = 'number'; rIn.min = '0'; rIn.step = '0.1'; rIn.value = t.rate != null ? t.rate : '';
        rIn.addEventListener('input', function () { t.rate = parseFloat(rIn.value) || 0; markDirty(); });
        rWrap.appendChild(rIn); g.appendChild(rWrap);
        card.appendChild(g);
        card.appendChild(textField('Short description (tooltip)', function () { return t.note; }, function (v) { t.note = v; markDirty(); }));
        wrap.appendChild(card);
      });
      var add = el('button', 'btn-add'); add.type = 'button'; add.textContent = '+ Add TDS type';
      add.addEventListener('click', function () { arr.push({ label: '', rate: 0, note: '' }); markDirty(); render(); });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }


  // Blog posts: list existing content/blog/*.md files, plus a form to write a
  // new one or edit/delete an existing one. Each post is its own file in the
  // repo, so this saves directly via its own GitHub commit rather than the
  // page's main "Save Changes" button (which only writes content/site.yaml).
  function yamlStr(v) { return JSON.stringify(v == null ? '' : String(v)); }
  function slugify(s) {
    return (s || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  }
  function slugFromFilename(name) { return slugify(name.replace(/\.md$/i, '')); }

  function blogEditor() {
    var wrap = el('div');
    var addBtn = el('button', 'btn-add'); addBtn.type = 'button'; addBtn.textContent = '+ Write New Post';
    addBtn.addEventListener('click', function () { showForm(null); });
    wrap.appendChild(addBtn);
    var listWrap = el('div'); listWrap.style.marginTop = '10px';
    var formWrap = el('div'); formWrap.style.marginTop = '18px';
    wrap.appendChild(listWrap);
    wrap.appendChild(formWrap);

    function loadList() {
      listWrap.innerHTML = '<p class="desc">Loading posts…</p>';
      ghListDir('content/blog').then(function (files) {
        listWrap.innerHTML = '';
        var mdFiles = (files || []).filter(function (f) {
          return f.type === 'file' && /\.md$/i.test(f.name) && f.name.toLowerCase() !== 'readme.md';
        });
        if (!mdFiles.length) {
          var p = el('p', 'desc'); p.textContent = 'No posts yet — click "Write New Post" to add your first one.';
          listWrap.appendChild(p);
          return;
        }
        mdFiles.forEach(function (f) {
          var row = el('div', 'page-row');
          var name = el('span', 'page-row-label'); name.textContent = f.name;
          row.appendChild(name);
          var editBtn = el('button', 'btn-outline'); editBtn.type = 'button'; editBtn.textContent = 'Edit';
          editBtn.style.width = 'auto'; editBtn.style.padding = '6px 14px';
          editBtn.addEventListener('click', function () { showForm(f.name); });
          row.appendChild(editBtn);
          listWrap.appendChild(row);
        });
      }).catch(function (err) {
        listWrap.innerHTML = '';
        var p = el('p', 'desc'); p.textContent = 'Could not load posts: ' + err.message; listWrap.appendChild(p);
      });
    }

    function showForm(filename) {
      var isNew = !filename;
      var post = { title: '', date: new Date().toISOString().slice(0, 10), excerpt: '', body: '', slug: '', sha: null };
      var card = el('div', 'sub-card');
      formWrap.innerHTML = '';
      formWrap.appendChild(card);
      var saveBtn;

      function doSave() {
        var title = (post.title || '').trim();
        if (!title) { showToast('Please enter a title.', true); return; }
        var path;
        if (isNew) {
          var slug = slugify(post.slug) || slugify(title);
          if (!slug) { showToast('Please enter a title or slug.', true); return; }
          path = 'content/blog/' + slug + '.md';
        } else {
          path = 'content/blog/' + filename;
        }
        var frontmatter = '---\ntitle: ' + yamlStr(title) + '\ndate: ' + yamlStr(post.date) + '\nexcerpt: ' + yamlStr(post.excerpt) + '\n---\n\n';
        var text = frontmatter + (post.body || '');
        saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
        ghPutFile(path, text, post.sha, (isNew ? 'Add blog post: ' : 'Update blog post: ') + title).then(function () {
          showToast((isNew ? 'Post published! ' : 'Post updated! ') + 'The site will rebuild automatically — check "View Actions" in about a minute.', false);
          formWrap.innerHTML = '';
          loadList();
        }).catch(function (err) {
          saveBtn.disabled = false; saveBtn.textContent = isNew ? 'Publish Post' : 'Save Post';
          showToast('Could not save post: ' + err.message, true);
        });
      }

      function doDelete() {
        if (!window.confirm('Delete "' + post.title + '" permanently? This cannot be undone.')) return;
        ghDeleteFile('content/blog/' + filename, post.sha, 'Delete blog post: ' + filename).then(function () {
          showToast('Post deleted. The site will rebuild automatically.', false);
          formWrap.innerHTML = '';
          loadList();
        }).catch(function (err) { showToast('Could not delete post: ' + err.message, true); });
      }

      function renderFields() {
        card.innerHTML = '';
        var head = el('div', 'sub-head');
        var strong = el('strong'); strong.textContent = isNew ? 'New Post' : ('Editing: ' + filename);
        head.appendChild(strong);
        card.appendChild(head);

        card.appendChild(textField('Title', function () { return post.title; }, function (v) { post.title = v; }));
        card.appendChild(textField('Date', function () { return post.date; }, function (v) { post.date = v; }, { hint: 'Format YYYY-MM-DD. Controls sort order on the blog listing page.' }));
        card.appendChild(textField('Excerpt', function () { return post.excerpt; }, function (v) { post.excerpt = v; }, { multiline: true, rows: 2, hint: 'One or two sentence summary shown on the blog listing page.' }));
        if (isNew) {
          card.appendChild(textField('URL slug (optional)', function () { return post.slug; }, function (v) { post.slug = v; }, { hint: 'Lowercase, hyphenated — becomes the page address (e.g. "5-vat-mistakes" → blog-5-vat-mistakes.html). Leave blank to auto-generate from the title.' }));
        }
        card.appendChild(textField('Post Body (Markdown)', function () { return post.body; }, function (v) { post.body = v; }, { multiline: true, rows: 16, hint: 'Use Markdown: ## for a subheading, **bold**, *italic*, - for bullet points, [link text](https://example.com) for links.' }));

        var btnRow = el('div'); btnRow.style.cssText = 'display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;';
        saveBtn = el('button', 'btn'); saveBtn.type = 'button'; saveBtn.style.width = 'auto';
        saveBtn.textContent = isNew ? 'Publish Post' : 'Save Post';
        saveBtn.addEventListener('click', doSave);
        btnRow.appendChild(saveBtn);
        if (!isNew) {
          var delBtn = el('button', 'btn-outline'); delBtn.type = 'button'; delBtn.textContent = 'Delete Post';
          delBtn.style.borderColor = 'var(--red)'; delBtn.style.color = 'var(--red)';
          delBtn.addEventListener('click', doDelete);
          btnRow.appendChild(delBtn);
        }
        var cancelBtn = el('button', 'btn-outline'); cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () { formWrap.innerHTML = ''; });
        btnRow.appendChild(cancelBtn);
        card.appendChild(btnRow);
      }

      if (isNew) {
        renderFields();
      } else {
        card.innerHTML = '<p class="desc">Loading post…</p>';
        ghGetFile('content/blog/' + filename).then(function (data) {
          post.sha = data.sha;
          var text = b64DecodeUtf8(data.content);
          var m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
          var meta = {};
          if (m) {
            try { meta = jsyaml.load(m[1]) || {}; } catch (e) { meta = {}; }
            post.body = m[2] || '';
          } else {
            post.body = text;
          }
          post.title = meta.title || slugFromFilename(filename);
          post.date = meta.date || '';
          post.excerpt = meta.excerpt || '';
          renderFields();
        }).catch(function (err) {
          card.innerHTML = '';
          var p = el('p', 'desc'); p.textContent = 'Could not load post: ' + err.message; card.appendChild(p);
        });
      }
    }

    loadList();
    return wrap;
  }

  // SEO editor: per-page browser title + Google description. Blank = use the
  // built-in default for that page. Keys are the built HTML filenames.
  var SEO_PAGES = [
    ['index.html', 'Home'],
    ['about.html', 'About'],
    ['services.html', 'Services'],
    ['outsourced-accounting.html', 'Outsourced Accounting'],
    ['global-outsourcing.html', 'Global Outsourcing'],
    ['packages.html', 'Packages'],
    ['documents-needed.html', 'Documents Checklist'],
    ['industries.html', 'Industries'],
    ['useful-links.html', 'Useful Links'],
    ['calculators.html', 'Calculators'],
    ['faq.html', 'FAQ'],
    ['contact.html', 'Contact'],
    ['team.html', 'Team'],
    ['testimonials.html', 'Testimonials'],
    ['privacy.html', 'Privacy Policy'],
    ['blog.html', 'Blog'],
  ];
  function seoEditor(seoObj) {
    var wrap = el('div');
    SEO_PAGES.forEach(function (row) {
      var file = row[0], label = row[1];
      if (!seoObj[file]) seoObj[file] = { title: '', description: '' };
      var entry = seoObj[file];
      var card = el('div', 'sub-card');
      var head = el('div', 'sub-head'); var strong = el('strong'); strong.textContent = label + ' page'; head.appendChild(strong); card.appendChild(head);
      card.appendChild(textField('Browser / Google Title', function () { return entry.title; }, function (v) { entry.title = v; }, { hint: 'Aim for ~50\u201360 characters. Leave blank to use the built-in default for this page.' }));
      card.appendChild(textField('Google Description', function () { return entry.description; }, function (v) { entry.description = v; }, { multiline: true, rows: 2, hint: 'Aim for ~150\u2013160 characters \u2014 the grey text shown under the title in Google results. Leave blank to use the default.' }));
      wrap.appendChild(card);
    });
    return wrap;
  }

  function section(id, title, desc, bodyEl) {
    var card = el('div', 'card'); card.id = id;
    var h = el('h2'); h.textContent = title; card.appendChild(h);
    if (desc) { var p = el('p', 'desc'); p.textContent = desc; card.appendChild(p); }
    card.appendChild(bodyEl);
    return card;
  }

  function renderForm() {
    var c = state.content;
    var area = document.getElementById('formArea');
    area.innerHTML = '';

    // Brand & contact
    var brandBody = el('div');
    var grid = el('div', 'f-grid');
    grid.appendChild(textField('Legal Name', function () { return c.brand.legalName; }, function (v) { c.brand.legalName = v; }));
    grid.appendChild(textField('Short Name', function () { return c.brand.shortName; }, function (v) { c.brand.shortName = v; }));
    grid.appendChild(textField('Mobile / WhatsApp (display)', function () { return c.brand.mobile; }, function (v) { c.brand.mobile = v; }));
    grid.appendChild(textField('WhatsApp Number — digits only, with country code, no + or spaces', function () { return c.brand.whatsappDigits; }, function (v) { c.brand.whatsappDigits = v; }, { hint: 'e.g. 9779812345678' }));
    grid.appendChild(textField('Office Landline', function () { return c.brand.landline; }, function (v) { c.brand.landline = v; }));
    grid.appendChild(textField('Email', function () { return c.brand.email; }, function (v) { c.brand.email = v; }));
    grid.appendChild(textField('Address Line', function () { return c.brand.addressLine; }, function (v) { c.brand.addressLine = v; }));
    grid.appendChild(textField('Address Note (e.g. building/floor)', function () { return c.brand.addressNote; }, function (v) { c.brand.addressNote = v; }));
    grid.appendChild(textField('Business Hours', function () { return c.brand.hours; }, function (v) { c.brand.hours = v; }));
    grid.appendChild(textField('Map Search Text', function () { return c.brand.mapQuery; }, function (v) { c.brand.mapQuery = v; }));
    grid.appendChild(textField('Founded Year', function () { return c.brand.foundedYear; }, function (v) { c.brand.foundedYear = v; }, { hint: 'Shown in the homepage stat row (e.g. 2022).' }));
    grid.appendChild(textField('Clients Served', function () { return c.brand.clientsServed; }, function (v) { c.brand.clientsServed = v; }, { hint: 'Shown in the homepage stat row (e.g. 100+). Keep it honest — this is a displayed claim.' }));
    brandBody.appendChild(grid);
    brandBody.appendChild(textField('Tagline', function () { return c.brand.tagline; }, function (v) { c.brand.tagline = v; }));
    brandBody.appendChild(textField('Alternative Tagline', function () { return c.brand.altTagline; }, function (v) { c.brand.altTagline = v; }));
    brandBody.appendChild(textField('Formspree Form ID (contact form email delivery)', function () { return c.brand.formspreeId; }, function (v) { c.brand.formspreeId = v; }, { hint: 'From formspree.io — just the ID (e.g. xgojnjby), not the full web address. Leave blank to keep the manual email/WhatsApp send flow.' }));
    brandBody.appendChild(textField('Website URL (for sitemap & sharing links)', function () { return c.brand.siteUrl; }, function (v) { c.brand.siteUrl = v; }, { hint: 'Your live domain, e.g. https://mavenconsultancy.com.np — leave blank until the final domain is ready. When set, the build creates sitemap.xml and canonical links.' }));
    brandBody.appendChild(textField('Cloudflare Web Analytics Token', function () { return c.brand.cloudflareAnalyticsToken; }, function (v) { c.brand.cloudflareAnalyticsToken = v; }, { hint: 'From Cloudflare dashboard → Analytics & Logs → Web Analytics → Manage Site → the JavaScript snippet (copy just the token value inside data-cf-beacon, not the whole script tag). Leave blank to keep analytics off.' }));
    // Social links — footer icons. Blank = the icon is hidden on the site.
    if (!c.brand.social) c.brand.social = { facebook: '', instagram: '', tiktok: '', linkedin: '' };
    brandBody.appendChild(textField('Facebook Page URL', function () { return c.brand.social.facebook; }, function (v) { c.brand.social.facebook = v; }, { hint: 'Full link to your Facebook page, e.g. https://facebook.com/YourPage — leave blank to hide the Facebook icon.' }));
    brandBody.appendChild(textField('Instagram Profile URL', function () { return c.brand.social.instagram; }, function (v) { c.brand.social.instagram = v; }, { hint: 'Full link to your Instagram profile, e.g. https://instagram.com/yourhandle — leave blank to hide the Instagram icon.' }));
    brandBody.appendChild(textField('TikTok Profile URL', function () { return c.brand.social.tiktok; }, function (v) { c.brand.social.tiktok = v; }, { hint: 'Full link to your TikTok profile, e.g. https://tiktok.com/@yourhandle — leave blank to hide the TikTok icon.' }));
    brandBody.appendChild(textField('LinkedIn Page URL', function () { return c.brand.social.linkedin; }, function (v) { c.brand.social.linkedin = v; }, { hint: 'Full link to your LinkedIn company page, e.g. https://linkedin.com/company/yourcompany — leave blank to hide the LinkedIn icon.' }));
    var tpWrap = el('div', 'f-field'); var tpL = el('label'); tpL.textContent = 'Trust Points (shown under the homepage hero)'; tpWrap.appendChild(tpL);
    tpWrap.appendChild(stringListEditor(c.trustPoints, 'trust point'));
    brandBody.appendChild(tpWrap);
    area.appendChild(section('sec-brand', 'Brand & Contact', 'Shown in the header, footer, and contact page.', brandBody));

    // Pages: hide/show + editable headings
    if (!Array.isArray(c.pages)) c.pages = [];
    if (!c.pageHeaders || typeof c.pageHeaders !== 'object') c.pageHeaders = {};
    var pagesBody = el('div');
    var hideLabel = el('label', 'block-label'); hideLabel.textContent = 'Hide / Show Pages'; pagesBody.appendChild(hideLabel);
    var hideDesc = el('p', 'desc'); hideDesc.textContent = 'Untick a page to remove it from the site menu and footer (and mark it noindex). The page still builds, so existing buttons never break. Blog stays hidden until your first post is ready.'; pagesBody.appendChild(hideDesc);
    pagesBody.appendChild(pageVisibilityEditor(c.pages));
    var headLabel = el('label', 'block-label'); headLabel.textContent = 'Editable Page Headings'; headLabel.style.marginTop = '22px'; pagesBody.appendChild(headLabel);
    pagesBody.appendChild(pageHeadingsEditor(c.pageHeaders));
    area.appendChild(section('sec-pages', 'Pages: Hide & Headings', 'Control which pages appear in the menu, and edit the big heading text at the top of each page.', pagesBody));

    // About
    var aboutBody = el('div');
    aboutBody.appendChild(textField('About Paragraph', function () { return c.aboutText; }, function (v) { c.aboutText = v; }, { multiline: true, rows: 4 }));
    aboutBody.appendChild(textField('Closing Statement', function () { return c.aboutClosing; }, function (v) { c.aboutClosing = v; }, { multiline: true, rows: 3 }));
    var afWrap = el('div', 'f-field'); var afL = el('label'); afL.textContent = 'Quick Facts'; afWrap.appendChild(afL);
    afWrap.appendChild(stringListEditor(c.aboutFacts, 'fact'));
    aboutBody.appendChild(afWrap);
    var valWrap = el('div', 'f-field'); var valL = el('label'); valL.textContent = 'Our Values'; valWrap.appendChild(valL);
    valWrap.appendChild(titleTextListEditor(c.values, 'Value'));
    aboutBody.appendChild(valWrap);
    area.appendChild(section('sec-about', 'About', 'Your About page content.', aboutBody));

    // Services
    area.appendChild(section('sec-services', 'Services', 'Editing "key" and "icon" isn\'t offered here on purpose — they\'re linked to the site\'s icons and internal links.', serviceCategoriesEditor(c.serviceCategories)));

    // Outsourced accounting
    var outBody = el('div');
    outBody.appendChild(textField('Page Title', function () { return c.outsourced.title; }, function (v) { c.outsourced.title = v; }));
    outBody.appendChild(textField('Paragraph', function () { return c.outsourced.paragraph; }, function (v) { c.outsourced.paragraph = v; }, { multiline: true, rows: 3 }));
    outBody.appendChild(textField('Call-to-Action Text', function () { return c.outsourced.cta; }, function (v) { c.outsourced.cta = v; }));
    var benWrap = el('div', 'f-field'); var benL = el('label'); benL.textContent = 'Benefits List'; benWrap.appendChild(benL);
    benWrap.appendChild(stringListEditor(c.outsourced.benefits, 'benefit'));
    outBody.appendChild(benWrap);
    area.appendChild(section('sec-outsourced', 'Outsourced Accounting', '', outBody));

    // Global Outsourcing
    if (!c.globalOutsourcing || typeof c.globalOutsourcing !== 'object') c.globalOutsourcing = {};
    var go = c.globalOutsourcing;
    if (!Array.isArray(go.benefits)) go.benefits = [];
    if (!Array.isArray(go.services)) go.services = [];
    if (!Array.isArray(go.process)) go.process = [];
    if (!Array.isArray(go.faqs)) go.faqs = [];
    var goBody = el('div');
    goBody.appendChild(textField('Intro Paragraph', function () { return go.intro; }, function (v) { go.intro = v; }, { multiline: true, rows: 3 }));
    goBody.appendChild(textField('Call-to-Action Text', function () { return go.cta; }, function (v) { go.cta = v; }));
    var goBenWrap = el('div', 'f-field'); var goBenL = el('label'); goBenL.textContent = 'Why Outsource To Maven (benefits)'; goBenWrap.appendChild(goBenL);
    goBenWrap.appendChild(stringListEditor(go.benefits, 'benefit'));
    goBody.appendChild(goBenWrap);
    var goSvcWrap = el('div', 'f-field'); var goSvcL = el('label'); goSvcL.textContent = 'What We Support (services list)'; goSvcWrap.appendChild(goSvcL);
    goSvcWrap.appendChild(stringListEditor(go.services, 'service'));
    goBody.appendChild(goSvcWrap);
    goBody.appendChild(textField('Scope Note (what Maven does NOT do — e.g. tax filing/audit)', function () { return go.scopeNote; }, function (v) { go.scopeNote = v; }, { multiline: true, rows: 2 }));
    var goProcWrap = el('div', 'f-field'); var goProcL = el('label'); goProcL.textContent = 'How It Works (onboarding steps, in order)'; goProcWrap.appendChild(goProcL);
    goProcWrap.appendChild(titleTextListEditor(go.process, 'Step'));
    goBody.appendChild(goProcWrap);
    goBody.appendChild(textField('Data Security & Confidentiality Note', function () { return go.securityNote; }, function (v) { go.securityNote = v; }, { multiline: true, rows: 2 }));
    var goFaqWrap = el('div', 'f-field'); var goFaqL = el('label'); goFaqL.textContent = 'Page FAQs'; goFaqWrap.appendChild(goFaqL);
    goFaqWrap.appendChild(faqListEditor(go.faqs));
    goBody.appendChild(goFaqWrap);
    area.appendChild(section('sec-global-outsourcing', 'Global Outsourcing', 'Content for the Global Outsourcing page, aimed at international clients.', goBody));

    // Packages
    var pkgBody = el('div');
    pkgBody.appendChild(packagesEditor(c.packages));
    pkgBody.appendChild(textField('Fee Note (shown below the packages)', function () { return c.packagesFeeNote; }, function (v) { c.packagesFeeNote = v; }, { multiline: true, rows: 2 }));
    area.appendChild(section('sec-packages', 'Packages', '', pkgBody));

    // Documents
    var docBody = el('div');
    docBody.appendChild(textField('Top Note', function () { return c.documentsTopNote; }, function (v) { c.documentsTopNote = v; }, { multiline: true, rows: 2 }));
    docBody.appendChild(documentGroupsEditor(c.documentGroups));
    docBody.appendChild(textField('Bottom Note', function () { return c.documentsBottomNote; }, function (v) { c.documentsBottomNote = v; }, { multiline: true, rows: 2 }));
    area.appendChild(section('sec-documents', 'Documents Checklist', '', docBody));

    // Industries
    area.appendChild(section('sec-industries', 'Industries We Serve', '', industriesEditor(c.industries)));

    // Team
    if (!Array.isArray(c.teamMembers)) c.teamMembers = [];
    area.appendChild(section('sec-team', 'Team Page', 'People shown on the Team page. Tick "Hide" to keep someone off the public page. Hide the whole Team page under "Pages: Hide & Headings" until you are ready.', teamEditor(c.teamMembers)));

    // Testimonials
    if (!Array.isArray(c.testimonials)) c.testimonials = [];
    area.appendChild(section('sec-testimonials', 'Testimonials Page', 'Only publish real, approved client feedback. New testimonials start hidden — untick "Hide" once you have permission to show them.', testimonialsEditor(c.testimonials)));

    // Useful Links
    if (!c.usefulLinks) c.usefulLinks = [];
    area.appendChild(section('sec-useful-links', 'Useful Links', 'Official government portals shown on the Useful Links page. Double-check web addresses carefully — a broken link is easy to miss.', usefulLinksEditor(c.usefulLinks)));

    // Blog posts — each post is its own file, saved independently of the main Save button.
    area.appendChild(section('sec-blog', 'Blog Posts', 'Write, edit, or delete blog posts here. Each post publishes with its own "Publish"/"Save" button below — it does not use the main "Save Changes" button at the top. Remember: the Blog section itself still needs to be ticked "Show in menu" under "Pages: Hide & Headings" before visitors can find it.', blogEditor()));

    // Why choose
    area.appendChild(section('sec-why', 'Why Choose Us', '', titleTextListEditor(c.whyChoose, 'Point')));

    // Process
    area.appendChild(section('sec-process', 'Process Steps', 'The order (1–9) is fixed since it\'s a real sequence — only titles and descriptions are editable.', processEditor(c.process)));

    // FAQs
    area.appendChild(section('sec-faqs', 'FAQs', '', faqListEditor(c.faqs)));

    // Privacy Policy
    if (!Array.isArray(c.privacySections)) c.privacySections = [];
    var privBody = el('div');
    privBody.appendChild(textField('Intro Paragraph', function () { return c.privacyIntro; }, function (v) { c.privacyIntro = v; }, { multiline: true, rows: 3 }));
    privBody.appendChild(titleTextListEditor(c.privacySections, 'Section'));
    area.appendChild(section('sec-privacy', 'Privacy Policy', 'The intro paragraph and each titled section shown on the Privacy Policy page.', privBody));

    // Tax & Calculator Rates
    if (!c.calculators || typeof c.calculators !== 'object') c.calculators = {};
    var cc = c.calculators;
    if (!Array.isArray(cc.taxTables)) cc.taxTables = [];
    if (!Array.isArray(cc.tdsTypes)) cc.tdsTypes = [];
    var calcBody = el('div');
    calcBody.appendChild(textField('Income Tax — FY Hint Text (shown above the FY buttons)', function () { return cc.incomeTaxFYHint; }, function (v) { cc.incomeTaxFYHint = v; markDirty(); }, { multiline: true, rows: 2, hint: 'Explain which FY runs when and any gazette note.' }));
    calcBody.appendChild(textField('Deduction Cap — Retirement fund (SSF/EPF/CIT), NPR', function () { return cc.deductionCapRetirement; }, function (v) { cc.deductionCapRetirement = parseFloat(v) || 0; markDirty(); }, { hint: 'Usually 500,000 or 1/3 of income, whichever is lower — check the Finance Act.' }));
    calcBody.appendChild(textField('Deduction Cap — Life insurance premium, NPR', function () { return cc.deductionCapLife; }, function (v) { cc.deductionCapLife = parseFloat(v) || 0; markDirty(); }, { hint: 'Usually 40,000.' }));
    calcBody.appendChild(textField('Deduction Cap — Health insurance premium, NPR', function () { return cc.deductionCapHealth; }, function (v) { cc.deductionCapHealth = parseFloat(v) || 0; markDirty(); }, { hint: 'Usually 20,000.' }));
    var fyLabel = el('label', 'block-label'); fyLabel.textContent = 'Income Tax — Fiscal Year Tables'; fyLabel.style.marginTop = '22px'; calcBody.appendChild(fyLabel);
    var fyDesc = el('p', 'desc'); fyDesc.textContent = 'Each fiscal year has its own slab table. Every May/June, add the new FY here after the Finance Act is published. Width is the NPR band size (leave blank for the top/unlimited band). Rate is the % for that band. SST band = the 1% Social Security Tax slab that SSF contributors pay 0% on.'; calcBody.appendChild(fyDesc);
    calcBody.appendChild(taxTablesEditor(cc.taxTables));
    var vatLabel = el('label', 'block-label'); vatLabel.textContent = 'VAT Rate'; vatLabel.style.marginTop = '22px'; calcBody.appendChild(vatLabel);
    calcBody.appendChild(textField('VAT Rate (%)', function () { return cc.vatRate; }, function (v) { cc.vatRate = parseFloat(v) || 13; markDirty(); }, { hint: 'Currently 13% in Nepal. Update if the Finance Act changes it.' }));
    calcBody.appendChild(textField('VAT Note (shown below the VAT calculator)', function () { return cc.vatNote; }, function (v) { cc.vatNote = v; markDirty(); }, { multiline: true, rows: 2 }));
    var tdsLabel = el('label', 'block-label'); tdsLabel.textContent = 'TDS Payment Types'; tdsLabel.style.marginTop = '22px'; calcBody.appendChild(tdsLabel);
    calcBody.appendChild(tdsTypesEditor(cc.tdsTypes));
    calcBody.appendChild(textField('TDS Note (shown below the TDS calculator)', function () { return cc.tdsNote; }, function (v) { cc.tdsNote = v; markDirty(); }, { multiline: true, rows: 3 }));
    area.appendChild(section('sec-calculators', 'Tax & Calculator Rates', 'Update every year after the Finance Act is published (usually May/June). Changes go live automatically on the next GitHub Actions build.', calcBody));

    // SEO / Search engine — per-page title + description
    if (!c.seo || typeof c.seo !== 'object') c.seo = {};
    area.appendChild(section('sec-seo', 'SEO / Search Engine', 'The title is what shows in the browser tab and as the blue link in Google. The description is the grey summary under it. Leave any field blank to use the sensible built-in default. Tip: set your Website URL in "Brand & Contact" too, so Google gets a sitemap.', seoEditor(c.seo)));

    // Footer & options
    var footBody = el('div');
    footBody.appendChild(textField('Footer Disclaimer', function () { return c.footerDisclaimer; }, function (v) { c.footerDisclaimer = v; }, { multiline: true, rows: 3 }));
    footBody.appendChild(textField('Partner Note (Services page callout)', function () { return c.partnerNote; }, function (v) { c.partnerNote = v; }, { multiline: true, rows: 2 }));
    var soWrap = el('div', 'f-field'); var soL = el('label'); soL.textContent = 'Contact Form — "Service Required" Dropdown Options'; soWrap.appendChild(soL);
    soWrap.appendChild(stringListEditor(c.serviceOptions, 'option'));
    footBody.appendChild(soWrap);
    var btWrap = el('div', 'f-field'); var btL = el('label'); btL.textContent = 'Contact Form — "Business Type" Dropdown Options'; btWrap.appendChild(btL);
    btWrap.appendChild(stringListEditor(c.businessTypeOptions, 'option'));
    footBody.appendChild(btWrap);
    area.appendChild(section('sec-footer', 'Footer & Form Options', '', footBody));

    clearDirty();
  }

  // ---------- connect / boot ----------
  // Owner/repo/branch are non-sensitive, so they're remembered in localStorage
  // for convenience. The token is a GitHub PAT with repo write access — it's
  // kept in sessionStorage only, so it's gone as soon as the tab/browser closes
  // rather than sitting in the browser's storage indefinitely.
  function saveLocal() {
    localStorage.setItem('maven_admin_owner', state.owner);
    localStorage.setItem('maven_admin_repo', state.repo);
    localStorage.setItem('maven_admin_branch', state.branch);
    sessionStorage.setItem('maven_admin_token', state.token);
  }

  function connect(owner, repo, branch, token) {
    state.owner = owner; state.repo = repo; state.branch = branch || 'main'; state.token = token;
    var msg = document.getElementById('connectMsg');
    msg.innerHTML = '';
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('connectBtn').textContent = 'Connecting…';
    loadContent().then(function () {
      saveLocal();
      document.getElementById('connectScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      // Prefer the configured live domain; otherwise hide the live link (GitHub Pages
      // is not used — this site deploys to Cloudflare, so guessing a URL would mislead).
      var siteUrl = (state.content && state.content.brand && state.content.brand.siteUrl || '').trim();
      var liveLink = document.getElementById('liveLink');
      if (siteUrl) { liveLink.href = siteUrl.replace(/\/+$/, '') + '/'; liveLink.style.display = ''; }
      else { liveLink.style.display = 'none'; }
      document.getElementById('actionsLink').href = 'https://github.com/' + owner + '/' + repo + '/actions';
      renderForm();
    }).catch(function (err) {
      document.getElementById('connectBtn').disabled = false;
      document.getElementById('connectBtn').textContent = 'Connect & Load Content';
      var d = document.createElement('div'); d.className = 'msg msg-error';
      d.textContent = 'Could not load content: ' + err.message + '. Check your username, repo name, branch, and token.';
      msg.appendChild(d);
    });
  }

  document.getElementById('connectBtn').addEventListener('click', function () {
    var owner = document.getElementById('in-owner').value.trim();
    var repo = document.getElementById('in-repo').value.trim();
    var branch = document.getElementById('in-branch').value.trim() || 'main';
    var token = document.getElementById('in-token').value.trim();
    if (!owner || !repo || !token) {
      document.getElementById('connectMsg').innerHTML = '<div class="msg msg-error">Please fill in username, repository, and token.</div>';
      return;
    }
    connect(owner, repo, branch, token);
  });

  document.getElementById('saveBtn').addEventListener('click', function () {
    var btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    saveContent().then(function () {
      clearDirty();
      showToast('Saved! The site will rebuild automatically — check "View Actions" in about a minute.', false);
    }).catch(function (err) {
      markDirty();
      showToast('Save failed: ' + err.message, true);
    });
  });

  document.getElementById('disconnectBtn').addEventListener('click', function () {
    localStorage.removeItem('maven_admin_token'); // clears any token saved by older versions of this page
    sessionStorage.clear();
    location.reload();
  });

  // window.onbeforeunload warning if unsaved
  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- boot: prefill from storage / auto-detect from URL ----------
  (function boot() {
    var host = location.hostname;
    var guessedOwner = host.endsWith('.github.io') ? host.replace('.github.io', '') : '';
    var parts = location.pathname.split('/').filter(Boolean);
    var guessedRepo = parts.length ? parts[0] : '';

    var savedOwner = localStorage.getItem('maven_admin_owner') || guessedOwner;
    var savedRepo = localStorage.getItem('maven_admin_repo') || guessedRepo;
    var savedBranch = localStorage.getItem('maven_admin_branch') || 'main';
    // Token is session-only — only survives if this is the same tab/session
    // that connected (e.g. a page refresh), never a fresh browser session.
    var savedToken = sessionStorage.getItem('maven_admin_token') || '';

    document.getElementById('in-owner').value = savedOwner;
    document.getElementById('in-repo').value = savedRepo;
    document.getElementById('in-branch').value = savedBranch;
    if (savedToken) document.getElementById('in-token').value = savedToken;
  })();
})();
