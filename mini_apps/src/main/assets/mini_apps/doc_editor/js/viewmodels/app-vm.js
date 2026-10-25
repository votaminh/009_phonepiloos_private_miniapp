// App — the home page (recent documents), opening, picking and creating files, and how the pages change. Other view models add their handlers to App.acts.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = {}, list = null, rows = [], DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var App = window.App = { state: { page: 'home', search: false, q: '' }, acts: A };
  App.b64 = function (buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  App.fail = function (key, e) { Ui.toast(t(key, { e: String(e && e.message || e).slice(0, 80) })); };

  // ---- home ------------------------------------------------------------------------------------------------------------------
  function sameDay(ms) { var a = new Date(ms), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  App.renderHome = function () {
    var s = App.state, all = Store.all(), docs = Store.recent(s.q), body = $('homeBody'), host = $('homeList'), hold = App.hold;
    // while a document is open (and while the page folds back into its row) the list keeps the order it had when the row was tapped
    if (hold) docs.sort(function (a, b) { return hold.ord.indexOf(a.key) - hold.ord.indexOf(b.key); });
    function when(d) { return hold && hold.at[d.key] !== undefined ? hold.at[d.key] : d.openedAt || 0; }
    var grid = !!Store.prefs().grid;
    $('homeTop').innerHTML = HomeView.top({ search: s.search, q: s.q, count: all.length, grid: grid });
    $('homeActions').innerHTML = HomeView.actions();
    if (list) { list.destroy(); list = null; }
    host.innerHTML = '';
    if (!all.length) { host.style.height = 'auto'; host.innerHTML = HomeView.empty(); return; }
    if (!docs.length) { host.style.height = 'auto'; host.innerHTML = HomeView.none(); return; }
    rows = [];
    var today = docs.filter(function (d) { return sameDay(when(d)); }), earlier = docs.filter(function (d) { return !sameDay(when(d)); });
    function add(list) { if (!grid) return list.forEach(function (d) { rows.push({ d: d }); }); for (var k = 0; k < list.length; k += 2) rows.push({ pair: list.slice(k, k + 2) }); }
    if (today.length) rows.push({ head: t('h.today') }); add(today);
    if (earlier.length) rows.push({ head: t('h.earlier') }); add(earlier);
    list = VList.mount(body, host, {
      count: function () { return rows.length; },
      height: function (i) { return rows[i].head ? 34 : rows[i].pair ? 212 : 80; },
      cls: function (i) { return rows[i].head ? 'hd' : 'hr'; },
      html: function (i) { return rows[i].head ? HomeView.head(rows[i].head) : rows[i].pair ? HomeView.pair(rows[i].pair, i * 2) : HomeView.row(rows[i].d, i); }
    });
  };

  // the file just closed hops from its old place to the top: every row that moves slides to its new place (First, Last, Invert, Play), the opened file rises with a little lift
  App.settleOrder = function () {
    if (!App.hold) return; var host = $('homeList'), key = App.hold.open;
    function spots() { var m = {}; Array.prototype.forEach.call(host.querySelectorAll('.hm-card'), function (c) { var r = c.getBoundingClientRect(); m[c.dataset.id] = { x: r.left, y: r.top }; }); return m; }
    var before = spots(); App.hold = null; App.renderHome();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var after = spots();
    Array.prototype.forEach.call(host.querySelectorAll('.hm-card'), function (c) {
      var id = c.dataset.id, a = before[id], b = after[id]; if (!a || !b) return;
      var dx = a.x - b.x, dy = a.y - b.y; if (!dx && !dy && id !== key) return;   // (in the grid a file can change column as well as row)
      var lift = id === key;
      if (lift) { c.style.zIndex = '2'; }
      c.animate([{ translate: dx + 'px ' + dy + 'px', scale: '1', boxShadow: 'none' }, { translate: dx / 2 + 'px ' + dy / 2 + 'px', scale: lift ? '1.04' : '1', boxShadow: lift ? '0 10px 24px var(--shadow-hi)' : 'none', offset: .5 }, { translate: '0 0', scale: '1', boxShadow: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,0,0,1)' }).onfinish = function () { c.style.zIndex = ''; };
    });
  };

  // ---- opening -------------------------------------------------------------------------------------------------------------
  async function add(f) {
    var rec = { key: 'd' + Ui.nextId(), name: f.fileName || t('untitled') + '.docx', size: f.sizeBytes || 0, url: f.url, openedAt: Date.now() };
    await Store.put(rec);
    rec.path = rec.url;   // Storage.put copied the picked file into the app and swapped the address for files/<id>.docx
    return rec;
  }
  // in a browser (no phone behind it) "Open file" opens the sample document kept in demo/ (not in git, not for the store)
  async function sample() {
    if (window.NativeToolsBridge) return null;
    try { var h = await fetch('demo/demo_full.docx', { method: 'HEAD' }); if (!h.ok) return null; var rec = await add({ fileName: 'demo_full.docx', sizeBytes: +h.headers.get('content-length') || 0, url: 'demo/demo_full.docx' }); rec.path = 'demo/demo_full.docx'; return rec; } catch (e) { return null; }
  }
  async function pick() {
    var demo = await sample(); if (demo) return demo;
    var r;
    try { r = await NativeTools.call('pick_file', { type: 'document', mimeTypes: [DOCX, 'application/octet-stream'], multiple: false, reason: 'Open a Word document' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return null; }
    var f = ((r && r.data && r.data.files) || [])[0];
    if (!f) return null;
    if (/\.doc$/i.test(f.fileName || '')) { App.problem(t('err.open'), t('err.doc', { n: f.fileName })); return null; }
    if (!/\.docx$/i.test(f.fileName || '')) { Ui.toast(t('err.pick')); return null; }
    try { return await add(f); } catch (e) { App.fail('err.generic', e); return null; }
  }
  App.problem = function (title, body) { Ui.sheet('error', SheetsView.error(title, body)); };
  A['h-pick'] = async function () { Ui.closeSheet(); var rec = await pick(); if (rec) { Doc.open(rec); } };
  A['h-new'] = async function () {
    try {
      var buf = await DocSvc.blank(), name = t('untitled') + '.docx';
      var r = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Create a new document' }), f = r.data;
      var rec = { key: 'd' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() };
      await Store.put(rec); Doc.open(rec, { edit: true });
    } catch (e) { App.fail('err.generic', e); }
  };
  A['h-open'] = function (el) { var rec = Store.get(el.dataset.id); if (!rec) return; App.hold = { open: rec.key, ord: Store.recent(App.state.q).map(function (d) { return d.key; }), at: {} }; Store.all().forEach(function (d) { App.hold.at[d.key] = d.openedAt || 0; }); rec.openedAt = Date.now(); Store.put(rec); UiNav.open(el, function () { return Doc.open(rec); }); };
  A['h-more'] = function (el, ev) {
    ev.stopPropagation();
    var rec = Store.get(el.dataset.id); if (!rec) return;
    Ui.sheet('row', '<h2 class="sh-h">' + Ui.esc(rec.name) + '</h2><button type="button" class="opt danger" data-act="h-remove" data-id="' + Ui.esc(rec.key) + '">' + Ui.ic('trash', 22, 1.75) + '<span class="op-t"><b>' + Ui.esc(t('r.remove')) + '</b><small>' + Ui.esc(t('r.remove.s')) + '</small></span></button>');
  };
  A['h-remove'] = function (el) {
    var rec = Store.get(el.dataset.id); Ui.closeSheet(); if (!rec) return;
    var copy = JSON.parse(JSON.stringify(rec));
    Store.del(rec.key).then(App.renderHome);
    Ui.toast(t('t.removed'), function () { Store.put(copy).then(App.renderHome); });
  };
  // list <-> grid: the browser moves every file from its place in one view to its place in the other
  A['h-view'] = function () {
    Store.savePrefs({ grid: !Store.prefs().grid });
    if (!UiNav.ok()) return App.renderHome();
    function name() { Array.prototype.forEach.call(document.querySelectorAll('.hm-card'), function (c) { c.style.viewTransitionName = 'c-' + c.dataset.id; }); }
    name(); document.documentElement.classList.add('vt-view');
    var tr = document.startViewTransition(function () { App.renderHome(); name(); return new Promise(function (r) { setTimeout(r, 30); }); });
    tr.finished.then(function () {}, function () {}).then(function () { document.documentElement.classList.remove('vt-view'); Array.prototype.forEach.call(document.querySelectorAll('.hm-card'), function (c) { c.style.viewTransitionName = ''; }); });
  };
  A['h-search'] = function () { var s = App.state; s.search = !s.search; if (!s.search) s.q = ''; App.renderHome(); if (s.search) setTimeout(function () { var i = $('homeQ'); if (i) i.focus(); }, 60); };
  A['sheet-done'] = function () { Ui.closeSheet(); };

  // ---- start -----------------------------------------------------------------------------------------------------------------
  App.start = async function () {
    var s = App.state;
    await Store.init();
    Ui.bind(A);
    // Back: close a sheet, popover or dialog first; leaving the editor with unsaved edits asks first
    Router.setBeforeLeave(function (from, to) {
      if (to === from) return true;
      if (Ui.closeDialog() || Ui.closeSheet() || Doc.closePop()) return false;
      if (from === 'doc' && Doc.guardLeave()) return false;
      return true;
    });
    window.MiniAppBackHandler = function () { return !!(Ui.closeDialog() || Ui.closeSheet() || Doc.closePop() || Doc.backInPage()); };
    document.addEventListener('nav:changed', function (ev) {
      var from = s.page, to = ev.detail.to; s.page = to;
      if (from !== to) Ui.pageIn(to, to === 'home', from);
      if (to === 'home') { if (!Ui.vtOn) App.hold = null; App.renderHome(); }   // (with the morph running, the old order is kept until it has finished)
    });
    window.addEventListener('language:changed', function () { App.renderHome(); Doc.relabel(); });
    $('homeTop').addEventListener('input', function (e) { if (e.target.id === 'homeQ') { s.q = e.target.value; var keep = e.target.selectionStart; App.renderHome(); var i = $('homeQ'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } } });
    App.renderHome(); Ui.reveal();
    // opened from another app ("Open with PiloOS"): go straight to the document
    try {
      var r = await NativeTools.call('get_launch_files', {}), f = ((r && r.data && r.data.files) || [])[0];
      if (f && /\.docx$/i.test(f.fileName || '')) { var rec = await add(f); Doc.open(rec); }
    } catch (e) { /* a normal launch */ }
  };
})();
