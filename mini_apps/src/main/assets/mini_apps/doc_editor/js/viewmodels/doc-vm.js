// Doc — the reading and editing page: opens a file, draws it, switches between reading and editing, keeps the history, the draft and the save.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DRAFT_MS = 30000, MIN_SHOW = 700, SNAP_MS = 500, HIST_MAX = 100;
  var Doc = window.Doc = { rec: null, mode: 'read', tab: 'text', dirty: false, xmls: {}, pics: {}, nextN: 1, hist: [], histAt: 0, baseAt: 0, tone: 'ok', drafting: false, saving: false, flash: '', range: null, error: '' };
  var timers = { snap: 0, draft: 0 };
  Doc.paper = function () { return $('paper'); };
  // editing: the whole page is one editing surface; what the engine keeps untouched (pictures, tables, charts) is an island inside it, a table's cells are typed in on their own
  Doc.islands = function (on) {
    var p = Doc.paper(); p.contentEditable = on ? 'true' : 'false';
    Array.prototype.forEach.call(p.querySelectorAll('.b.ed'), function (el) { el.removeAttribute('contenteditable'); });
    Array.prototype.forEach.call(p.querySelectorAll('.b.lk'), function (el) { if (on) el.contentEditable = 'false'; else el.removeAttribute('contenteditable'); });
  };
  Doc.nid = function () { return 'n' + (Doc.nextN++); };

  // ---- the bars ------------------------------------------------------------------------------------------------------------
  Doc.statusText = function () {
    if (Doc.saving) return { tone: 'busy', text: t('s.savingfile') };
    if (Doc.drafting) return { tone: 'busy', text: t('s.saving') };
    if (Doc.flash) return { tone: 'ok pop', text: t(Doc.flash) };
    if (!Doc.dirty) return { tone: 'ok', text: t('s.saved') };
    var d = Doc.rec && Doc.rec.draft;
    if (d && d.at >= Doc.lastEdit) return { tone: 'ok', text: t('s.draft', { t: new Date(d.at).toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' }) }) };
    return { tone: 'warn', text: t('s.unsaved') };
  };
  Doc.chrome = function () {
    var r = Doc.rec; if (!r) return;
    var st = Doc.statusText(); $('docTop').classList.toggle('saving', Doc.saving || Doc.drafting);
    $('docTop').innerHTML = DocView.top({ mode: Doc.mode, name: r.name, meta: t('d.reading') + ' · ' + HomeView.size(r.size || 0), pages: Store.prefs().layout === 'page', status: st.text, tone: st.tone, dirty: Doc.dirty, canUndo: Doc.histAt > 0, canRedo: Doc.histAt < Doc.hist.length - 1 });
  };
  Doc.relabel = function () { if (Doc.rec && App.state.page === 'doc') { Doc.chrome(); if (Doc.mode === 'edit') Edit.buildTools(); } };

  // ---- modes ---------------------------------------------------------------------------------------------------------------
  Doc.setMode = function (m) {
    Doc.mode = m;
    var p = Doc.paper(), pg = $('pgDoc');
    pg.dataset.mode = m; p.classList.toggle('editing', m === 'edit');
    Doc.islands(m === 'edit');
    Table.arm(m === 'edit'); if (m !== 'edit' && window.Struct) Struct.hide();
    $('docTools').classList.toggle('hidden', m !== 'edit');
    Read.apply();
    if (m === 'edit') Edit.buildTools(); else { Edit.hidePops(); }
    Doc.chrome();
  };
  A['d-edit'] = function () { Doc.setMode('edit'); if (!Wide.pc) Ui.toast(t('e.hint')); };
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
    var copy = buf.slice(0); Doc.zbuf = buf.slice(0); var r = await DocSvc.open(buf), p = Doc.paper(), body = $('docBody'), y = keepScroll ? body.scrollTop : 0;
    Styles.load(r.styles, r.defaults);
    if (window.Mf) Mf.reset();
    await DocRich.load(copy, r.blocks);
    p.innerHTML = Render.all(r.blocks) || '<p class="dc-load">' + Ui.esc(t('d.empty')) + '</p>';
    Doc.blocks = r.blocks; Doc.bmap = {}; r.blocks.forEach(function (b) { Doc.bmap[b.idx] = b; }); Doc.words = (p.textContent.trim().match(/\S+/g) || []).length; Doc.ms = r.ms;
    Doc.xmls = {}; Doc.pics = {}; Doc.sectOpts = null; Doc.pgOpts = null; Doc.pageColor = undefined; Doc.wmStyle = null; Doc.hfOpts = null; Doc.hfSect = []; Doc.wm = undefined; Doc.props = null; Doc.nums = r.nums || {}; Doc.comments = r.comments || []; Doc.newComments = []; Doc.resolve = []; Doc.notes = r.notes || []; Doc.newNotes = []; Doc.noteEdits = {}; Doc.revs = []; Doc.track = false; Doc.listDefs = {}; Doc.nextNum = 9001; Doc.nextN = 1; Doc.dirty = false; Doc.lastEdit = 0;
    if (window.Surface) Surface.renumber();
    Doc.hist = [p.innerHTML]; Doc.hsel = [null]; Doc.histAt = 0; Doc.baseAt = 0; Doc.rid = (Doc.rid || 0) + 1;
    body.scrollTop = y;
    Doc.setMode(Doc.mode);
    Thumb.refresh(Doc.rec, !!keepScroll);   // the picture of page 1 in the list: made once, and again after a save
  };
  Doc.open = async function (rec, opts) {
    opts = opts || {};
    Doc.rec = rec; Doc.mode = opts.edit ? 'edit' : 'read'; Doc.tab = 'text'; Doc.error = ''; Doc.blocks = null; Read.pz = 0;
    var p = Doc.paper(); p.innerHTML = '<p class="dc-load">' + Ui.esc(t('d.loading')) + '</p>'; p.className = 'paper';
    if (Router.getCurrent() !== 'doc') Router.navigate('doc'); else App.state.page = 'doc';
    Doc.setMode('read'); $('docBody').scrollTop = 0;
    try {
      if (opts.buf) await Doc.render(opts.buf);   // a new document: its bytes are here, there is no file yet
      else {
        rec.path = rec.path || rec.url;   // a record read back from storage has the address as `url` only
        await Files.request(rec.path);
        var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
        await Doc.render(await res.arrayBuffer());
      }
    } catch (e) { p.innerHTML = '<div class="dc-err">' + Ui.esc(t('err.open')) + '<small>' + Ui.esc(String(e && e.message || e)) + '</small></div>'; return; }
    if (opts.edit) Doc.setMode('edit');
    if (rec.draft && !opts.edit) Doc.offerDraft();
    if (opts.edit) { var f = p.querySelector('.b.ed'); if (f) { Surface.focus(); Struct.putCaret(f, { a: 0, z: 0 }); } }
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
  // what only shows the current selection (selected cells, a picked block, a table being dragged) is not part of the document: a snapshot taken with it would bring it back, stuck, on undo
  function plainHtml(h) {
    h = h.replace(/ contenteditable="(?:true|false)"/g, '');   // put on and taken off again by the page itself (islands, Table.arm): a snapshot must not differ for that alone, or the next undo looks like a change
    if (!/\b(csel|sel|moving)\b/.test(h)) return h;
    return h.replace(/ class="([^"]*)"/g, function (m, c) { var k = c.split(/\s+/).filter(function (x) { return x && x !== 'csel' && x !== 'sel' && x !== 'moving'; }); return k.length ? ' class="' + k.join(' ') + '"' : ''; });
  }
  Doc.snap = function () {
    clearTimeout(timers.snap);
    var h = plainHtml(window.Paginate ? Paginate.strip(Doc.paper().innerHTML) : Doc.paper().innerHTML); if (h === Doc.hist[Doc.histAt]) return;
    Doc.hist = Doc.hist.slice(0, Doc.histAt + 1); Doc.hsel = (Doc.hsel || []).slice(0, Doc.histAt + 1); Doc.hist.push(h); Doc.hsel.push(window.Surface ? Surface.sel() : null);
    if (Doc.hist.length > HIST_MAX) { Doc.hist.shift(); Doc.hsel.shift(); Doc.baseAt = Math.max(-1, Doc.baseAt - 1); } Doc.histAt = Doc.hist.length - 1;
    Doc.touch(true);
  };
  // something changed: update the bar and plan a snapshot and a draft
  Doc.touch = function (quiet) {
    if (window.Surface && Doc.mode === 'edit') { clearTimeout(timers.num); timers.num = setTimeout(Surface.renumber, 120); }
    Doc.dirty = Doc.histAt !== Doc.baseAt; Doc.lastEdit = Date.now();
    if (!quiet) { clearTimeout(timers.snap); timers.snap = setTimeout(Doc.snap, SNAP_MS); }
    if (Doc.dirty && !timers.draft) timers.draft = setTimeout(function () { timers.draft = 0; Doc.draftNow(); }, DRAFT_MS);
    var key = [Doc.dirty, Doc.histAt > 0, Doc.histAt < Doc.hist.length - 1, Doc.mode, Doc.statusText().text].join('|'); if (key !== Doc.ck) { Doc.ck = key; Doc.chrome(); }   // the bars only change when one of these does
  };
  function restore(i) {
    clearTimeout(timers.snap); Doc.histAt = i; var p = Doc.paper(); if (window.Table) Table.clearSel(); p.innerHTML = Doc.hist[i];
    Doc.islands(true); Table.arm(true); Doc.touch(true); Edit.sync(); if (window.Paginate) Paginate.schedule(0); if (window.Surface) Surface.restore(Doc.hsel && Doc.hsel[i]);
  }
  A['e-undo'] = function () { Doc.snap(); if (Doc.histAt > 0) restore(Doc.histAt - 1); };
  A['e-redo'] = function () { if (Doc.histAt < Doc.hist.length - 1) restore(Doc.histAt + 1); };

  // ---- saving ----------------------------------------------------------------------------------------------------------------
  Doc.bytes = async function () { Doc.snap(); var plan = Plan.build(Doc.paper(), Doc.xmls, Doc.pics); plan.comments = Doc.newComments; plan.resolve = Doc.resolve; plan.notes = Doc.newNotes; plan.noteEdits = Doc.noteEdits; plan.revs = Doc.revs; plan.lists = Object.keys(Doc.listDefs).filter(function (id) { return Doc.paper().querySelector('[data-nid="' + id + '"]'); }).map(function (id) { return Lists.def(Doc.listDefs[id], id); }); if (Doc.track) plan.track = { author: t('cm.me'), date: new Date().toISOString() }; if (Doc.sectOpts || Doc.pgOpts || Doc.pageColor !== undefined || Doc.hfOpts || Doc.hfSect.length || Doc.wm !== undefined || Doc.props) plan.opts = Object.assign({}, Doc.wm !== undefined ? { watermark: Doc.wm } : {}, Doc.props ? { properties: Doc.props } : {}, Doc.hfOpts, Doc.hfSect.length ? { sectionHf: Doc.hfSect } : {}, Doc.sectOpts ? { section: Doc.sectOpts } : {}, Doc.pgOpts ? { pgNumType: Doc.pgOpts } : {}, Doc.pageColor !== undefined ? { pageColor: Doc.pageColor } : {}, { pageCount: window.Paginate && Paginate.pages || 1 }); return DocSvc.save(plan); };
  function stopDraft() { clearTimeout(timers.draft); timers.draft = 0; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // the bar says "saving" with a moving line, then "saved" with a small pop; both stay long enough to be seen
  async function shown(work, flag, done) {
    Doc[flag] = true; Doc.flash = ''; Doc.chrome(); var t0 = Date.now(), ok = false;
    try { ok = await work(); } finally { var left = MIN_SHOW - (Date.now() - t0); if (left > 0) await sleep(left); Doc[flag] = false; }
    if (ok) { Doc.flash = done; clearTimeout(timers.flash); timers.flash = setTimeout(function () { Doc.flash = ''; Doc.chrome(); }, 2200); }
    Doc.chrome(); return ok;
  }
  // a draft is kept every 30 seconds while there are edits (one timer, not reset by each edit), and when the app goes to the background
  Doc.draftNow = function () {
    var rec = Doc.rec; if (!rec || rec.fresh || !Doc.dirty || Doc.drafting || Doc.saving) return Promise.resolve(false);   // a new document has no record yet: no draft
    return shown(async function () {
      try {
        var buf = await Doc.bytes(), r = await NativeTools.call('save_local_file', { fileName: 'draft-' + rec.name, base64: App.b64(buf), reason: 'Keep a draft of your edits' }), old = rec.draft && rec.draft.path;
        rec.draft = { path: r.data.path, size: buf.byteLength, at: Date.now() }; await Store.put(rec); if (old) Store.dropFile(old); return true;
      } catch (e) { return false; /* a draft is a convenience: the next round tries again */ }
    }, 'drafting', 's.draftok');
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden && Doc.dirty) { stopDraft(); if (Doc.rec && Doc.rec.fresh) Doc.save(); else Doc.draftNow(); } });
  Doc.save = function () {
    var rec = Doc.rec; if (!rec) return Promise.resolve(false); stopDraft();
    return shown(async function () {
      try {
        var buf = await Doc.bytes(), r = await NativeTools.call('save_local_file', { fileName: rec.name, base64: App.b64(buf), reason: 'Save the edited document' }), f = r && r.data;
        if (!f || !f.path) throw new Error('no file');
        var old = rec.path, oldDraft = rec.draft && rec.draft.path;
        delete rec.fresh; rec.path = f.path; rec.url = f.path; rec.size = f.sizeBytes || buf.byteLength; rec.editedAt = Date.now(); rec.openedAt = Date.now(); rec.draft = null;
        await Store.put(rec); if (old) Store.dropFile(old); if (oldDraft) Store.dropFile(oldDraft);
        await Doc.render(buf, true);   // read the saved file back: what you see is what is on disk
        return true;
      } catch (e) { App.fail('t.savefail', e); return false; }
    }, 'saving', 't.saved');
  };
  A['e-save'] = function () { Doc.save(); };
  Doc.discard = async function () {
    stopDraft(); clearTimeout(timers.snap); await Doc.dropDraft(); Doc.dirty = false; Ui.toast(t('t.discarded'));
  };
  A['e-done'] = function () { if (!Doc.guardLeave()) Doc.setMode('read'); };

  document.addEventListener('input', function (e) {
    var b = e.target.closest && e.target.closest('.b'); if (!b || !b.closest('#paper')) return;
    b.dataset.m = '1'; Doc.touch();
  });
})();
