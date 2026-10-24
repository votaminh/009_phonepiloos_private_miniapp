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
    var s = App.state, all = Store.all(), docs = Store.recent(s.q), body = $('homeBody'), host = $('homeList');
    $('homeTop').innerHTML = HomeView.top({ search: s.search, q: s.q, count: all.length });
    $('homeActions').innerHTML = HomeView.actions();
    if (list) { list.destroy(); list = null; }
    host.innerHTML = '';
    if (!all.length) { host.style.height = 'auto'; host.innerHTML = HomeView.empty(); return; }
    if (!docs.length) { host.style.height = 'auto'; host.innerHTML = HomeView.none(); return; }
    rows = [];
    var today = docs.filter(function (d) { return sameDay(d.openedAt || 0); }), earlier = docs.filter(function (d) { return !sameDay(d.openedAt || 0); });
    if (today.length) rows.push({ head: t('h.today') }); today.forEach(function (d) { rows.push({ d: d }); });
    if (earlier.length) rows.push({ head: t('h.earlier') }); earlier.forEach(function (d) { rows.push({ d: d }); });
    list = VList.mount(body, host, {
      count: function () { return rows.length; },
      height: function (i) { return rows[i].head ? 34 : 80; },
      cls: function (i) { return rows[i].head ? 'hd' : 'hr'; },
      html: function (i) { return rows[i].head ? HomeView.head(rows[i].head) : HomeView.row(rows[i].d, i); }
    });
  };

  // ---- opening -------------------------------------------------------------------------------------------------------------
  async function add(f) {
    var rec = { key: 'd' + Ui.nextId(), name: f.fileName || t('untitled') + '.docx', size: f.sizeBytes || 0, url: f.url, openedAt: Date.now() };
    await Store.put(rec);
    rec.path = rec.url;   // Storage.put copied the picked file into the app and swapped the address for files/<id>.docx
    return rec;
  }
  async function pick() {
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
  A['h-pick'] = async function () { Ui.closeSheet(); var rec = await pick(); if (rec) { Ui.hint('slide'); Doc.open(rec); } };
  A['h-new'] = async function () {
    try {
      var buf = await DocSvc.blank(), name = t('untitled') + '.docx';
      var r = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Create a new document' }), f = r.data;
      var rec = { key: 'd' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() };
      await Store.put(rec); Ui.hint('slide'); Doc.open(rec, { edit: true });
    } catch (e) { App.fail('err.generic', e); }
  };
  A['h-open'] = function (el) { var rec = Store.get(el.dataset.id); if (!rec) return; Ui.hint('expand', el); rec.openedAt = Date.now(); Store.put(rec); Doc.open(rec); };
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
      if (to === 'home') App.renderHome();
    });
    window.addEventListener('language:changed', function () { App.renderHome(); Doc.relabel(); });
    $('homeTop').addEventListener('input', function (e) { if (e.target.id === 'homeQ') { s.q = e.target.value; var keep = e.target.selectionStart; App.renderHome(); var i = $('homeQ'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } } });
    App.renderHome(); Ui.reveal();
    // opened from another app ("Open with PiloOS"): go straight to the document
    try {
      var r = await NativeTools.call('get_launch_files', {}), f = ((r && r.data && r.data.files) || [])[0];
      if (f && /\.docx$/i.test(f.fileName || '')) { var rec = await add(f); Ui.hint('slide'); Doc.open(rec); }
    } catch (e) { /* a normal launch */ }
  };
})();
