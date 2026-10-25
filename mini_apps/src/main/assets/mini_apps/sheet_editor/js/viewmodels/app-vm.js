// App — the home page (recent workbooks), opening, picking and creating files, and how the pages change. Other view models add their handlers to App.acts.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = {}, list = null, rows = [], XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var App = window.App = { state: { page: 'home', search: false, q: '' }, acts: A };
  App.b64 = function (buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  App.fail = function (key, e) { Ui.toast(t(key, { e: String(e && e.message || e).slice(0, 80) })); };
  App.problem = function (title, body) { Ui.sheet('error', HomeView.error(title, body)); };

  // ---- home ------------------------------------------------------------------------------------------------------------------
  function sameDay(ms) { var a = new Date(ms), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  App.renderHome = function () {
    var s = App.state, all = Store.all(), books = Store.recent(s.q), body = $('homeBody'), host = $('homeList'), hold = App.hold;
    // while a workbook is open (and while the page folds back into its row) the list keeps the order it had when the row was tapped
    if (hold) books.sort(function (a, b) { return hold.ord.indexOf(a.key) - hold.ord.indexOf(b.key); });
    function when(d) { return hold && hold.at[d.key] !== undefined ? hold.at[d.key] : d.openedAt || 0; }
    var grid = !!Store.prefs().grid;
    $('homeTop').innerHTML = HomeView.top({ search: s.search, q: s.q, count: all.length, grid: grid });
    $('homeActions').innerHTML = HomeView.actions();
    if (list) { list.destroy(); list = null; }
    host.innerHTML = '';
    if (!all.length) { host.style.height = 'auto'; host.innerHTML = HomeView.empty(); return; }
    if (!books.length) { host.style.height = 'auto'; host.innerHTML = HomeView.none(); return; }
    rows = [];
    var today = books.filter(function (d) { return sameDay(when(d)); }), earlier = books.filter(function (d) { return !sameDay(when(d)); });
    function add(l) { if (!grid) return l.forEach(function (d) { rows.push({ d: d }); }); for (var k = 0; k < l.length; k += 2) rows.push({ pair: l.slice(k, k + 2) }); }
    if (today.length) rows.push({ head: t('h.today') }); add(today);
    if (earlier.length) rows.push({ head: t('h.earlier') }); add(earlier);
    list = VList.mount(body, host, {
      count: function () { return rows.length; },
      height: function (i) { return rows[i].head ? 34 : rows[i].pair ? 212 : 80; },
      cls: function (i) { return rows[i].head ? 'hd' : 'hr'; },
      html: function (i) { return rows[i].head ? HomeView.head(rows[i].head) : rows[i].pair ? HomeView.pair(rows[i].pair) : HomeView.row(rows[i].d); }
    });
  };
  // the file just closed hops from its old place to the top: every row that moves slides to its new place (see UiNav.flip)
  App.settleOrder = function () {
    if (!App.hold) return; var key = App.hold.open;
    UiNav.flip($('homeList'), function () { App.hold = null; App.renderHome(); }, key);
  };

  // ---- opening -------------------------------------------------------------------------------------------------------------
  async function add(f) {
    var rec = { key: 'b' + Ui.nextId(), name: f.fileName || t('untitled') + '.xlsx', size: f.sizeBytes || 0, url: f.url, openedAt: Date.now() };
    await Store.put(rec);
    rec.path = rec.url;   // Storage.put copied the picked file into the app and swapped the address for files/<id>.xlsx
    return rec;
  }
  async function pick() {
    var r;
    try { r = await NativeTools.call('pick_file', { type: 'document', mimeTypes: [XLSX, 'application/octet-stream'], multiple: false, reason: 'Open an Excel file' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return null; }
    var f = ((r && r.data && r.data.files) || [])[0];
    if (!f) return null;
    if (/\.xls$/i.test(f.fileName || '')) { App.problem(t('err.open'), t('err.xls', { n: f.fileName })); return null; }
    if (!/\.xlsx$/i.test(f.fileName || '')) { Ui.toast(t('err.pick')); return null; }
    try { return await add(f); } catch (e) { App.fail('err.generic', e); return null; }
  }
  A['h-pick'] = async function () { Ui.closeSheet(); var rec = await pick(); if (rec) Book.open(rec); };
  A['h-new'] = async function () {
    try {
      var name = t('untitled') + '.xlsx', buf = await SheetSvc.blank(t('untitled'));
      var r = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Create a new workbook' }), f = r.data;
      var rec = { key: 'b' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() };
      await Store.put(rec); Book.open(rec, { edit: true });
    } catch (e) { App.fail('err.generic', e); }
  };
  A['h-open'] = function (el) {
    var rec = Store.get(el.dataset.id); if (!rec) return;
    App.hold = { open: rec.key, ord: Store.recent(App.state.q).map(function (d) { return d.key; }), at: {} }; Store.all().forEach(function (d) { App.hold.at[d.key] = d.openedAt || 0; });
    rec.openedAt = Date.now(); Store.put(rec);
    UiNav.open(el, $('pgBook'), function () { Book.open(rec); });
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
      if (from === 'book' && Book.guardLeave()) return false;
      return true;
    });
    // the device's Back button (and the arrow in the title bar) run the same morph: the page folds back into its row, then the row hops to the top
    UiNav.hookBack({ page: 'book', el: function () { return $('pgBook'); }, list: function () { return document.querySelector('[data-page="home"]'); }, id: function () { return Book.rec && Book.rec.key; }, after: App.settleOrder });
    window.MiniAppBackHandler = function () { return !!(Ui.closeDialog() || Ui.closeSheet() || Book.backInPage()); };
    document.addEventListener('nav:changed', function (ev) {
      var from = s.page, to = ev.detail.to; s.page = to;
      if (from !== to) Ui.pageIn(to, to === 'home');
      if (to === 'home') App.renderHome();
    });
    window.addEventListener('language:changed', function () { App.renderHome(); Book.relabel(); });
    Grid.init();
    $('homeTop').addEventListener('input', function (e) { if (e.target.id === 'homeQ') { s.q = e.target.value; var keep = e.target.selectionStart; App.renderHome(); var i = $('homeQ'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } } });
    App.renderHome(); Ui.reveal();
    // opened from another app ("Open with PiloOS"): go straight to the workbook
    try {
      var r = await NativeTools.call('get_launch_files', {}), f = ((r && r.data && r.data.files) || [])[0];
      if (f && /\.xlsx$/i.test(f.fileName || '')) { var rec = await add(f); Book.open(rec); }
    } catch (e) { /* a normal launch */ }
  };
})();
