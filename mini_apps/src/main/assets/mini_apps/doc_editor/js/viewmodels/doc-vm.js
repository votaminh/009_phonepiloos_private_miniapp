// Doc — the reading and editing page: opens a file, draws it, switches between reading and editing, keeps the history, the draft and the save.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DRAFT_MS = 2500, SNAP_MS = 500, HIST_MAX = 40;
  var Doc = window.Doc = { rec: null, mode: 'read', tab: 'text', dirty: false, xmls: {}, pics: {}, nextN: 1, hist: [], histAt: 0, baseAt: 0, tone: 'ok', drafting: false, range: null, error: '' };
  var timers = { snap: 0, draft: 0 };
  Doc.paper = function () { return $('paper'); };
  Doc.nid = function () { return 'n' + (Doc.nextN++); };

  // ---- the bars ------------------------------------------------------------------------------------------------------------
  Doc.statusText = function () {
    if (!Doc.dirty) return { tone: 'ok', text: t('s.saved') };
    if (Doc.drafting) return { tone: 'busy', text: t('s.saving') };
    var d = Doc.rec && Doc.rec.draft;
    if (d && d.at >= Doc.lastEdit) return { tone: 'ok', text: t('s.draft', { t: new Date(d.at).toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' }) }) };
    return { tone: 'warn', text: t('s.unsaved') };
  };
  Doc.chrome = function () {
    var r = Doc.rec; if (!r) return;
    var st = Doc.statusText();
    $('docTop').innerHTML = DocView.top({ mode: Doc.mode, name: r.name, meta: t('d.reading') + ' · ' + HomeView.size(r.size || 0), status: st.text, tone: st.tone, dirty: Doc.dirty, canUndo: Doc.histAt > 0, canRedo: Doc.histAt < Doc.hist.length - 1 });
  };
  Doc.relabel = function () { if (Doc.rec && App.state.page === 'doc') { Doc.chrome(); if (Doc.mode === 'edit') Edit.buildTools(); } };

  // ---- modes ---------------------------------------------------------------------------------------------------------------
  Doc.setMode = function (m) {
    Doc.mode = m;
    var p = Doc.paper(), pg = $('pgDoc');
    pg.dataset.mode = m; p.classList.toggle('editing', m === 'edit');
    Array.prototype.forEach.call(p.querySelectorAll('.b.ed'), function (el) { el.contentEditable = m === 'edit' ? 'true' : 'false'; });
    Table.arm(m === 'edit');
    $('docTools').classList.toggle('hidden', m !== 'edit');
    Read.apply();
    if (m === 'edit') Edit.buildTools(); else { Edit.hidePops(); }
    Doc.chrome();
  };
  A['d-edit'] = function () { Doc.setMode('edit'); Ui.toast(t('e.hint')); };
  A['d-back'] = function () { if (!Doc.guardLeave()) Router.back(); };
  // leaving with unsaved edits: ask. Returns true when it asked (the caller must stay).
  Doc.guardLeave = function () {
    if (Doc.mode !== 'edit' || !Doc.dirty || !Doc.rec) return false;
    Ui.dialog(t('un.title'), t('un.body', { name: Doc.rec.name }), t('un.save'), function () { Doc.save().then(function () { Router.back(); }); });
    var d = $('dlg'); d.innerHTML = SheetsView.choice(t('un.title'), t('un.body', { name: Doc.rec.name }), [{ act: 'u-discard', label: t('un.discard'), kind: 'danger' }, { act: 'u-keep', label: t('un.keep') }, { act: 'u-save', label: t('un.save'), kind: 'solid' }]);
    return true;
  };
  A['u-keep'] = function () { Ui.closeDialog(); };
  A['u-save'] = function () { Ui.closeDialog(); Doc.save().then(function (ok) { if (ok) Router.back(); }); };
  A['u-discard'] = function () { Ui.closeDialog(); Doc.discard().then(function () { Router.back(); }); };
  // Back inside the page (not leaving it): closes the find bar first
  Doc.backInPage = function () { return typeof Find !== 'undefined' && Find.close(); };
  Doc.closePop = function () { return typeof Edit !== 'undefined' && Edit.hidePops(); };

  // ---- opening -------------------------------------------------------------------------------------------------------------
  Doc.render = async function (buf, keepScroll) {
    var r = await DocSvc.open(buf), p = Doc.paper(), body = $('docBody'), y = keepScroll ? body.scrollTop : 0;
    p.innerHTML = Render.all(r.blocks) || '<p class="dc-load">' + Ui.esc(t('d.empty')) + '</p>';
    Doc.blocks = r.blocks; Doc.words = (p.textContent.trim().match(/\S+/g) || []).length; Doc.ms = r.ms;
    Doc.xmls = {}; Doc.pics = {}; Doc.nextN = 1; Doc.dirty = false; Doc.lastEdit = 0;
    Doc.hist = [p.innerHTML]; Doc.histAt = 0; Doc.baseAt = 0;
    body.scrollTop = y;
    Doc.setMode(Doc.mode);
  };
  Doc.open = async function (rec, opts) {
    opts = opts || {};
    Doc.rec = rec; Doc.mode = opts.edit ? 'edit' : 'read'; Doc.tab = 'text'; Doc.error = '';
    var p = Doc.paper(); p.innerHTML = '<p class="dc-load">' + Ui.esc(t('d.loading')) + '</p>'; p.className = 'paper';
    if (Router.getCurrent() !== 'doc') Router.navigate('doc'); else App.state.page = 'doc';
    Doc.setMode('read'); $('docBody').scrollTop = 0;
    try {
      await Files.request(rec.path);
      var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
      await Doc.render(await res.arrayBuffer());
    } catch (e) { p.innerHTML = '<div class="dc-err">' + Ui.esc(t('err.open')) + '<small>' + Ui.esc(String(e && e.message || e)) + '</small></div>'; return; }
    if (opts.edit) Doc.setMode('edit');
    if (rec.draft && !opts.edit) Doc.offerDraft();
    if (opts.edit) { var f = p.querySelector('.b.ed'); if (f) { f.focus(); } }
  };
  Doc.offerDraft = function () {
    var rec = Doc.rec, d = rec.draft; if (!d) return;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('au.title'), t('au.body', { name: rec.name, t: HomeView.ago(d.at) }), [{ act: 'a-discard', label: t('au.discard'), kind: 'danger' }, { act: 'a-recover', label: t('au.recover'), kind: 'solid' }]);
  };
  A['a-discard'] = function () { Ui.closeDialog(); Doc.dropDraft(); };
  A['a-recover'] = async function () {
    Ui.closeDialog();
    try { var res = await fetch(Doc.rec.draft.path); await Doc.render(await res.arrayBuffer()); Doc.mode = 'edit'; Doc.setMode('edit'); Doc.baseAt = -1; Doc.dirty = true; Doc.lastEdit = 0; Doc.chrome(); }
    catch (e) { App.fail('err.generic', e); }
  };
  Doc.dropDraft = async function () {
    var rec = Doc.rec; if (!rec || !rec.draft) return;
    var old = rec.draft.path; rec.draft = null; await Store.put(rec); Store.dropFile(old);
  };

  // ---- history ---------------------------------------------------------------------------------------------------------------
  Doc.snap = function () {
    clearTimeout(timers.snap);
    var h = Doc.paper().innerHTML; if (h === Doc.hist[Doc.histAt]) return;
    Doc.hist = Doc.hist.slice(0, Doc.histAt + 1); Doc.hist.push(h); if (Doc.hist.length > HIST_MAX) { Doc.hist.shift(); Doc.baseAt = Math.max(-1, Doc.baseAt - 1); } Doc.histAt = Doc.hist.length - 1;
    Doc.touch(true);
  };
  // something changed: update the bar and plan a snapshot and a draft
  Doc.touch = function (quiet) {
    Doc.dirty = Doc.histAt !== Doc.baseAt; Doc.lastEdit = Date.now();
    if (!quiet) { clearTimeout(timers.snap); timers.snap = setTimeout(Doc.snap, SNAP_MS); }
    clearTimeout(timers.draft); if (Doc.dirty) timers.draft = setTimeout(Doc.draftNow, DRAFT_MS);
    Doc.chrome();
  };
  function restore(i) {
    clearTimeout(timers.snap); Doc.histAt = i; var p = Doc.paper(); p.innerHTML = Doc.hist[i];
    Array.prototype.forEach.call(p.querySelectorAll('.b.ed'), function (el) { el.contentEditable = 'true'; });
    Table.arm(true); Doc.touch(true); Edit.sync();
  }
  A['e-undo'] = function () { Doc.snap(); if (Doc.histAt > 0) restore(Doc.histAt - 1); };
  A['e-redo'] = function () { if (Doc.histAt < Doc.hist.length - 1) restore(Doc.histAt + 1); };

  // ---- saving ----------------------------------------------------------------------------------------------------------------
  Doc.bytes = async function () { Doc.snap(); return DocSvc.save(Plan.build(Doc.paper(), Doc.xmls, Doc.pics)); };
  Doc.draftNow = async function () {
    var rec = Doc.rec; if (!rec || !Doc.dirty || Doc.drafting) return;
    Doc.drafting = true; Doc.chrome();
    try {
      var buf = await Doc.bytes(), r = await NativeTools.call('save_local_file', { fileName: 'draft-' + rec.name, base64: App.b64(buf), reason: 'Keep a draft of your edits' }), old = rec.draft && rec.draft.path;
      rec.draft = { path: r.data.path, size: buf.byteLength, at: Date.now() }; await Store.put(rec); if (old) Store.dropFile(old);
    } catch (e) { /* a draft is a convenience: the next edit tries again */ }
    Doc.drafting = false; Doc.chrome();
  };
  Doc.save = async function () {
    var rec = Doc.rec; if (!rec) return false;
    clearTimeout(timers.draft);
    var b = $('docTop').querySelector('[data-act="e-save"]'); if (b) b.disabled = true;
    try {
      var buf = await Doc.bytes(), r = await NativeTools.call('save_local_file', { fileName: rec.name, base64: App.b64(buf), reason: 'Save the edited document' }), f = r && r.data;
      if (!f || !f.path) throw new Error('no file');
      var old = rec.path, oldDraft = rec.draft && rec.draft.path;
      rec.path = f.path; rec.url = f.path; rec.size = f.sizeBytes || buf.byteLength; rec.editedAt = Date.now(); rec.openedAt = Date.now(); rec.draft = null;
      await Store.put(rec); Store.dropFile(old); if (oldDraft) Store.dropFile(oldDraft);
      await Doc.render(buf, true);   // read the saved file back: what you see is what is on disk
      Ui.toast(t('t.saved')); return true;
    } catch (e) { App.fail('t.savefail', e); Doc.chrome(); return false; }
  };
  A['e-save'] = function () { Doc.save(); };
  Doc.discard = async function () {
    clearTimeout(timers.draft); clearTimeout(timers.snap); await Doc.dropDraft(); Doc.dirty = false; Ui.toast(t('t.discarded'));
  };
  A['e-done'] = function () { if (!Doc.guardLeave()) Doc.setMode('read'); };

  document.addEventListener('input', function (e) {
    var b = e.target.closest && e.target.closest('.b'); if (!b || !b.closest('#paper')) return;
    b.dataset.m = '1'; Doc.touch();
  });
})();
