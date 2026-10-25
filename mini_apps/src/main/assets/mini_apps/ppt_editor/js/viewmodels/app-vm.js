// App — the home page (recent decks), opening, picking and creating files, and how the pages change. Other view models add their handlers to App.acts.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = {}, list = null, rows = [], PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  var App = window.App = { state: { page: 'home', search: false, q: '' }, acts: A };
  App.b64 = function (buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  App.fail = function (key, e) { Ui.toast(t(key, { e: String(e && e.message || e).slice(0, 80) })); };
  App.problem = function (title, body) { Ui.sheet('error', HomeView.error(title, body)); };

  // ---- home ------------------------------------------------------------------------------------------------------------------
  function sameDay(ms) { var a = new Date(ms), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  App.renderHome = function () {
    var s = App.state, all = Store.all(), books = Store.recent(s.q), body = $('homeBody'), host = $('homeList');
    $('homeTop').innerHTML = HomeView.top({ search: s.search, q: s.q, count: all.length });
    $('homeActions').innerHTML = HomeView.actions();
    if (list) { list.destroy(); list = null; }
    host.innerHTML = '';
    if (!all.length) { host.style.height = 'auto'; host.innerHTML = HomeView.empty(); return; }
    if (!books.length) { host.style.height = 'auto'; host.innerHTML = HomeView.none(); return; }
    rows = [];
    var today = books.filter(function (d) { return sameDay(d.openedAt || 0); }), earlier = books.filter(function (d) { return !sameDay(d.openedAt || 0); });
    if (today.length) rows.push({ head: t('h.today') }); today.forEach(function (d) { rows.push({ d: d }); });
    if (earlier.length) rows.push({ head: t('h.earlier') }); earlier.forEach(function (d) { rows.push({ d: d }); });
    list = VList.mount(body, host, {
      count: function () { return rows.length; },
      height: function (i) { return rows[i].head ? 34 : 80; },
      cls: function (i) { return rows[i].head ? 'hd' : 'hr'; },
      html: function (i) { return rows[i].head ? HomeView.head(rows[i].head) : HomeView.row(rows[i].d); }
    });
  };

  // ---- opening -------------------------------------------------------------------------------------------------------------
  async function add(f) {
    var rec = { key: 'p' + Ui.nextId(), name: f.fileName || t('untitled') + '.pptx', size: f.sizeBytes || 0, url: f.url, openedAt: Date.now() };
    await Store.put(rec);
    rec.path = rec.url;   // Storage.put copied the picked file into the app and swapped the address for files/<id>.pdf
    return rec;
  }
  async function pick() {
    var r;
    try { r = await NativeTools.call('pick_file', { type: 'document', mimeTypes: [PPTX, 'application/octet-stream'], multiple: false, reason: 'Open a PowerPoint deck' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return null; }
    var f = ((r && r.data && r.data.files) || [])[0];
    if (!f) return null;
    if (/\.ppt$/i.test(f.fileName || '')) { App.problem(t('err.old'), t('err.old.s')); return null; }
    if (!/\.pptx$/i.test(f.fileName || '')) { Ui.toast(t('err.pick')); return null; }
    try { return await add(f); } catch (e) { App.fail('err.generic', e); return null; }
  }
  A['h-pick'] = async function () { Ui.closeSheet(); var rec = await pick(); if (rec) { Ui.hint('slide'); Viewer.open(rec); } };
  // a new deck: the bundled template (a few layouts), cut down to one slide, in the look and first layout chosen
  var nd = { look: 'tide', first: 'title', size: '16:9' };
  A['h-new'] = function () { Ui.sheet('new', HomeView.newDeck(nd)); };
  A['n-look'] = function (el) { nd.look = el.dataset.k; Ui.sheet('new', HomeView.newDeck(nd)); };
  A['n-first'] = function (el) { nd.first = el.dataset.k; Ui.sheet('new', HomeView.newDeck(nd)); };
  A['n-size'] = function (el) { nd.size = el.dataset.k; Ui.sheet('new', HomeView.newDeck(nd)); };
  A['n-go'] = async function () {
    Ui.closeSheet();
    try {
      var tpl = await (await fetch('template.pptx')).arrayBuffer(), info = await PptSvc.open(tpl), look = Layout.looks().filter(function (l) { return l.id === nd.look; })[0], ops = [], i, names = info.layouts.map(function (l) { return l.name; });
      var want = nd.first === 'title' ? /title slide/i : nd.first === 'text' ? /title and content/i : /blank/i, pick = names.filter(function (n) { return want.test(n); })[0] || names[0], n0 = info.slides.length;
      // the first slide is a new one made from the chosen layout; the template's own slides are removed
      ops.push({ op: 'addSlideWithLayout', target: { slide: n0 - 1 }, layout: pick });
      for (i = n0 - 1; i >= 0; i--) ops.push({ op: 'deleteSlide', target: { slide: i } });
      if (nd.size === '4:3') ops.push({ op: 'setSlideSize', cx: 9144000, cy: 6858000 });
      if (look) ops.push({ op: 'applyTheme', name: look.id, colors: look.colors, majorFont: look.major, minorFont: look.minor });
      var r = await PptSvc.txn(ops); if (!r.applied) throw new Error((r.failures[0] && r.failures[0].error) || 'template');
      var sh = await PptSvc.render(0, 100), ids = sh.nodes.filter(function (x) { return x.placeholder && !/^(sldNum|ftr|dt)$/i.test(x.placeholder) && x.sourceId; });
      var again = [], k = 0; ids.forEach(function (x) { if (/^(ctrTitle|title)$/i.test(x.placeholder || '')) again.push({ op: 'setText', target: { slide: 0, el: x.sourceId }, paragraphs: [{ runs: [{ text: t('nd.title') }] }] }); else if (x.placeholder) again.push({ op: 'setText', target: { slide: 0, el: x.sourceId }, paragraphs: [{ runs: [{ text: t(nd.first === 'title' ? 'nd.sub' : 'nd.body') }] }] }); k++; });
      if (again.length) await PptSvc.txn(again);
      var buf = await PptSvc.save(), name = t('untitled') + '.pptx';
      var s = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Create a new deck' }), f = s.data;
      var rec = { key: 'p' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() };
      await Viewer.thumb(rec); await Store.put(rec); Ui.hint('slide'); Viewer.open(rec, { blank: true });
    } catch (e) { App.fail('err.generic', e); }
  };
  A['h-open'] = function (el) { var rec = Store.get(el.dataset.id); if (!rec) return; Ui.hint('expand', el); rec.openedAt = Date.now(); Store.put(rec); Viewer.open(rec); };
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
      if (Ui.closeDialog() || Ui.closeSheet() || Present.close() || Find.close() || Slides.close()) return false;
      if (from === 'deck' && Viewer.guardLeave()) return false;
      return true;
    });
    window.MiniAppBackHandler = function () { return !!(Ui.closeDialog() || Ui.closeSheet() || Viewer.backInPage()); };
    document.addEventListener('nav:changed', function (ev) {
      var from = s.page, to = ev.detail.to; s.page = to;
      if (from !== to) Ui.pageIn(to, to === 'home', from);
      if (to === 'home') App.renderHome();
    });
    window.addEventListener('language:changed', function () { App.renderHome(); Viewer.relabel(); });
    Stage.init();
    $('homeTop').addEventListener('input', function (e) { if (e.target.id === 'homeQ') { s.q = e.target.value; var keep = e.target.selectionStart; App.renderHome(); var i = $('homeQ'); if (i) { i.focus(); i.setSelectionRange(keep, keep); } } });
    App.renderHome(); Ui.reveal();
    // opened from another app ("Open with PiloOS"): go straight to the deck
    try {
      var r = await NativeTools.call('get_launch_files', {}), f = ((r && r.data && r.data.files) || [])[0];
      if (f && /\.pptx$/i.test(f.fileName || '')) { var rec = await add(f); Ui.hint('slide'); Viewer.open(rec); }
    } catch (e) { /* a normal launch */ }
  };
})();
