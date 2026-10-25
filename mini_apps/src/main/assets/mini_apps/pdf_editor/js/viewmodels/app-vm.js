// App — the home page (recent PDFs), opening, picking and creating files, and how the pages change. Other view models add their handlers to App.acts.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = {}, list = null, rows = [], PDF = 'application/pdf';
  var App = window.App = { state: { page: 'home', search: false, q: '' }, acts: A };
  App.b64 = function (buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  App.fail = function (key, e) { Ui.toast(t(key, { e: String(e && e.message || e).slice(0, 80) })); };
  App.problem = function (title, body) { Ui.sheet('error', HomeView.error(title, body)); };

  // ---- home ------------------------------------------------------------------------------------------------------------------
  function sameDay(ms) { var a = new Date(ms), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  // the tiles of the grid view: two on a phone, more where there is room (each about 200px wide, the page drawn A4-shaped)
  App.homeGrid = function (body) {
    var room = Math.min(1100, (body ? body.clientWidth : window.innerWidth) - 32), cols = Math.max(2, Math.min(6, Math.floor((room + 12) / 212))), w = (room - (cols - 1) * 12) / cols, th = Math.round(w * 0.78);
    return { cols: cols, th: th, tile: th + 66 };
  };
  App.renderHome = function () {
    var s = App.state, all = Store.all(), books = Store.recent(s.q), body = $('homeBody'), host = $('homeList'), hold = App.hold, grid = !!Store.prefs().grid, sort = App.sort();
    if (Wide.pc && !hold && sort.k !== 'opened' || Wide.pc && sort.dir > 0 && sort.k === 'opened') books.sort(App.cmp(sort));
    // while a file is open (and while the page folds back into its row) the list keeps the order it had when the row was tapped
    if (hold) books.sort(function (a, b) { return hold.ord.indexOf(a.key) - hold.ord.indexOf(b.key); });
    function when(d) { return hold && hold.at[d.key] !== undefined ? hold.at[d.key] : d.openedAt || 0; }
    $('homeTop').innerHTML = HomeView.top({ search: s.search, q: s.q, count: all.length, grid: grid });
    $('homeCols').innerHTML = Wide.pc && !grid && books.length ? HomeView.cols(sort) : '';
    $('homeActions').innerHTML = HomeView.actions();
    if (list) { list.destroy(); list = null; }
    host.innerHTML = '';
    if (!all.length) { host.style.height = 'auto'; host.innerHTML = HomeView.empty(); return; }
    if (!books.length) { host.style.height = 'auto'; host.innerHTML = HomeView.none(); return; }
    rows = [];
    var byDay = !(Wide.pc && !grid) || (sort.k === 'opened' && sort.dir < 0), today = byDay ? books.filter(function (d) { return sameDay(when(d)); }) : books, earlier = byDay ? books.filter(function (d) { return !sameDay(when(d)); }) : [];
    var g = App.homeGrid(body); host.style.setProperty('--tile-h', g.tile + 'px'); host.style.setProperty('--tile-th', g.th + 'px'); host.dataset.cols = g.cols;
    function add(l) { if (!grid) return l.forEach(function (d) { rows.push({ d: d }); }); for (var k = 0; k < l.length; k += g.cols) { var ch = l.slice(k, k + g.cols); ch.cols = g.cols; rows.push({ pair: ch }); } }
    if (today.length) { if (byDay) rows.push({ head: t('h.today') }); add(today); }
    if (earlier.length) rows.push({ head: t('h.earlier') }); add(earlier);
    list = VList.mount(body, host, {
      count: function () { return rows.length; },
      height: function (i) { return rows[i].head ? 34 : rows[i].pair ? g.tile + 16 : Wide.pc ? 62 : 80; },
      cls: function (i) { return rows[i].head ? 'hd' : 'hr'; },
      html: function (i) { return rows[i].head ? HomeView.head(rows[i].head) : rows[i].pair ? HomeView.pair(rows[i].pair) : (Wide.pc ? HomeView.trow(rows[i].d) : HomeView.row(rows[i].d)); }
    });
  };
  // how the list is ordered on a computer: by a column, the last choice kept
  App.sort = function () { var v = Store.prefs().sort; return v && v.k ? v : { k: 'opened', dir: -1 }; };
  App.cmp = function (so) {
    return function (a, b) {
      var x, y; if (so.k === 'name') { x = String(a.name).toLowerCase(); y = String(b.name).toLowerCase(); return so.dir * (x < y ? -1 : x > y ? 1 : 0); }
      x = so.k === 'pages' ? a.pages || 0 : so.k === 'size' ? a.size || 0 : a.openedAt || 0; y = so.k === 'pages' ? b.pages || 0 : so.k === 'size' ? b.size || 0 : b.openedAt || 0; return so.dir * (x - y);
    };
  };
  A['h-sort'] = function (el) { var s = App.sort(), k = el.dataset.k; Store.savePrefs({ sort: { k: k, dir: s.k === k ? -s.dir : (k === 'name' ? 1 : -1) } }); UiNav.swap($('homeList'), App.renderHome); };
  // the file just closed hops from its old place to the top: every row that moves slides to its new place (see UiNav.flip)
  App.settleOrder = function () {
    if (!App.hold) return; var key = App.hold.open;
    UiNav.flip($('homeList'), function () { App.hold = null; App.renderHome(); }, key);
  };

  // an A4 PDF with one empty page, as plain text
  App.blankPdf = function () {
    var o = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>'], out = '%PDF-1.4\n', xref = [], i;
    for (i = 0; i < o.length; i++) { xref.push(out.length); out += (i + 1) + ' 0 obj\n' + o[i] + '\nendobj\n'; }
    var at = out.length; out += 'xref\n0 ' + (o.length + 1) + '\n0000000000 65535 f \n';
    xref.forEach(function (x) { out += ('0000000000' + x).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (o.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + at + '\n%%EOF\n';
    var u = new Uint8Array(out.length); for (i = 0; i < out.length; i++) u[i] = out.charCodeAt(i); return u.buffer;
  };
  // ---- opening -------------------------------------------------------------------------------------------------------------
  async function add(f) {
    var rec = { key: 'p' + Ui.nextId(), name: f.fileName || t('untitled') + '.pdf', size: f.sizeBytes || 0, url: f.url, openedAt: Date.now() };
    await Store.put(rec);
    rec.path = rec.url;   // Storage.put copied the picked file into the app and swapped the address for files/<id>.pdf
    return rec;
  }
  App.add = add;
  async function pick() {
    var r;
    try { r = await NativeTools.call('pick_file', { type: 'document', mimeTypes: [PDF, 'application/octet-stream'], multiple: false, reason: 'Open a PDF' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return null; }
    var f = ((r && r.data && r.data.files) || [])[0];
    if (!f) return null;
    if (!/\.pdf$/i.test(f.fileName || '')) { Ui.toast(t('err.pick')); return null; }
    try { return await add(f); } catch (e) { App.fail('err.generic', e); return null; }
  }
  A['h-pick'] = async function () { Ui.closeSheet(); var rec = await pick(); if (rec) { Viewer.open(rec); } };
  A['h-new'] = async function () {
    try {
      var name = t('untitled') + '.pdf', buf = App.blankPdf();
      var r = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Create a new PDF' }), f = r.data;
      var rec = { key: 'p' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() };
      await Store.put(rec); Viewer.open(rec, { edit: true, blank: true });
    } catch (e) { App.fail('err.generic', e); }
  };
  A['h-open'] = function (el) {
    var rec = Store.get(el.dataset.id); if (!rec) return;
    App.hold = { open: rec.key, ord: Store.recent(App.state.q).map(function (d) { return d.key; }), at: {} }; Store.all().forEach(function (d) { App.hold.at[d.key] = d.openedAt || 0; });
    rec.openedAt = Date.now(); Store.put(rec);
    UiNav.open(el, $('pgDoc'), function () { Viewer.open(rec); });
  };
  // list <-> grid: every file glides from its place in one view to its place in the other
  A['h-view'] = function () { Store.savePrefs({ grid: !Store.prefs().grid }); UiNav.swap($('homeList'), App.renderHome); };
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
  A['sheet-done'] = function () { Ui.closeSheet(); };
  A['h-search'] = function () { var s = App.state; s.search = !s.search; if (!s.search) s.q = ''; App.renderHome(); if (s.search) setTimeout(function () { var i = $('homeQ'); if (i) i.focus(); }, 60); };

  // ---- start -----------------------------------------------------------------------------------------------------------------
  App.start = async function () {
    var s = App.state;
    await Store.init();
    Ui.bind(A);
    // Back: close a sheet or dialog first
    Router.setBeforeLeave(function (from, to) {
      if (to === from) return true;
      if (Ui.closeDialog() || Ui.closeSheet() || Find.close()) return false;
      if (from === 'doc' && Viewer.guardLeave()) return false;
      return true;
    });
    // the device's Back button (and the arrow in the title bar) run the same morph: the page folds back into its row, then the row hops to the top
    UiNav.hookBack({ page: 'doc', el: function () { return $('pgDoc'); }, list: function () { return document.querySelector('[data-page="home"]'); }, id: function () { return Viewer.rec && Viewer.rec.key; }, after: App.settleOrder });
    window.MiniAppBackHandler = function () { return !!(Ui.closeDialog() || Ui.closeSheet() || Viewer.backInPage()); };
    document.addEventListener('nav:changed', function (ev) {
      var from = s.page, to = ev.detail.to; s.page = to;
      if (from !== to) Ui.pageIn(to, to === 'home');
      if (to === 'home') App.renderHome();
    });
    var gc = 0; window.addEventListener('resize', function () { if (Router.getCurrent() !== 'home') return; clearTimeout(gc); gc = setTimeout(function () { var g = App.homeGrid($('homeBody')), h = $('homeList'); if (h && String(g.cols) !== h.dataset.cols) App.renderHome(); }, 160); });
    window.addEventListener('language:changed', function () { App.renderHome(); Viewer.relabel(); });
    Read.init(); Desk.init(); Extras.init(); HomeDesk.init();
    $('homeTop').addEventListener('input', function (e) { if (e.target.id === 'homeQ') { s.q = e.target.value; var keep = e.target.selectionStart; App.renderHome(); var i = $('homeQ'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } } });
    App.renderHome(); Ui.reveal();
    // opened from another app ("Open with PiloOS"): go straight to the workbook
    try {
      var r = await NativeTools.call('get_launch_files', {}), f = ((r && r.data && r.data.files) || [])[0];
      if (f && /\.pdf$/i.test(f.fileName || '')) { var rec = await add(f); Viewer.open(rec); }
    } catch (e) { /* a normal launch */ }
  };
})();
