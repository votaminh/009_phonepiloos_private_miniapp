// Viewer — the open deck as a file: reading it into the engine, the title bar, every change as ops, keeping a draft while you work (every 30 s), saving, and leaving.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DRAFT_MS = 30000, MIN_SHOW = 700, timers = {}, queue = Promise.resolve();
  var V = window.Viewer = { rec: null, dirty: false, drafting: false, saving: false, flash: '' };

  function status() {
    if (!V.rec) return { c: 'mute', t: t('b.loading') };
    if (V.saving) return { c: 'saving', t: t('s.savingfile') };
    if (V.drafting) return { c: 'saving', t: t('s.saving') };
    if (V.flash) return { c: 'pop', t: t(V.flash) };
    if (V.dirty) return { c: 'warn', t: V.rec.draft ? t('s.draft', { t: HomeView.ago(V.rec.draft.at) }) : t('s.unsaved') };
    return { c: '', t: t('s.saved') };
  }
  V.chrome = function () {
    if (Find.open) return;
    var i = Deck.info || { canUndo: false, canRedo: false };
    $('deckTop').classList.toggle('saving', V.saving || V.drafting);
    $('deckTop').innerHTML = EditView.top(V.rec ? V.rec.name : '', status(), { undo: i.canUndo, redo: i.canRedo, dirty: V.dirty, outline: window.Outline && Outline.on });
  };
  V.relabel = function () { if (V.rec) { V.chrome(); $('deckTools').innerHTML = EditView.tools(); Quick.render(); } };

  // ---- opening -------------------------------------------------------------------------------------------------------------------
  V.open = async function (rec, opts) {
    opts = opts || {}; V.rec = rec; V.dirty = false; Deck.rec = rec; Deck.info = null; Deck.sel = null; Find.close(); Slides.close(); V.chrome();
    $('deckTools').innerHTML = EditView.tools(); $('quick').innerHTML = ''; $('film').innerHTML = ''; $('stBusy').classList.add('hidden');
    if (Router.getCurrent() !== 'deck') Router.navigate('deck'); else App.state.page = 'deck';
    try {
      await Files.request(rec.path);
      var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
      await V.load(await res.arrayBuffer(), opts);
    } catch (e) { if (String(e && e.message) !== 'cancelled') App.problem(t('err.open'), String(e && e.message || e).slice(0, 200)); V.rec = null; Router.navigate('home'); return; }
    if (rec.draft && !opts.blank) V.offerDraft();
  };
  V.load = async function (buf) {
    var head = new Uint8Array(buf.slice(0, 4));
    if (head[0] === 0xD0 && head[1] === 0xCF) throw new Error(t('err.protected'));
    var info = await PptSvc.open(buf);
    Deck.reset(info); Stage.layout(); $('deckTools').innerHTML = EditView.tools(); Stage.select(null); Film.build(); V.chrome(); await Stage.show(); if (window.Outline) Outline.sync();
  };

  // ---- drafts ------------------------------------------------------------------------------------------------------------------
  V.offerDraft = function () {
    var rec = V.rec, d = rec.draft; if (!d) return;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('au.title'), t('au.body', { name: rec.name, t: HomeView.ago(d.at) }), [{ act: 'a-discard', label: t('au.discard'), kind: 'danger' }, { act: 'a-recover', label: t('au.recover'), kind: 'solid' }]);
  };
  A['a-discard'] = function () { Ui.closeDialog(); V.dropDraft(); };
  A['a-recover'] = async function () {
    Ui.closeDialog();
    try { var res = await fetch(V.rec.draft.path); await V.load(await res.arrayBuffer()); V.touch(); } catch (e) { App.fail('err.generic', e); }
  };
  V.dropDraft = async function () { var rec = V.rec; if (!rec || !rec.draft) return; var old = rec.draft.path; rec.draft = null; await Store.put(rec); Store.dropFile(old); };
  // a draft is kept every 30 seconds while there are edits (one timer, not reset by each edit), and when the app goes to the background
  V.touch = function () { V.dirty = true; if (!timers.draft) timers.draft = setTimeout(function () { timers.draft = 0; V.draftNow(); }, DRAFT_MS); V.chrome(); };
  function stopTimer() { clearTimeout(timers.draft); timers.draft = 0; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // the bar says "saving" with a moving line, then "saved" with a small pop; both stay long enough to be seen
  async function shown(work, flag, done) {
    V[flag] = true; V.flash = ''; V.chrome(); var t0 = Date.now(), ok = false;
    try { ok = await work(); } finally { var left = MIN_SHOW - (Date.now() - t0); if (left > 0) await sleep(left); V[flag] = false; }
    if (ok) { V.flash = done; clearTimeout(timers.flash); timers.flash = setTimeout(function () { V.flash = ''; V.chrome(); }, 2200); }
    V.chrome(); return ok;
  }
  V.draftNow = function () {
    var rec = V.rec; if (!rec || !V.dirty || V.drafting || V.saving) return Promise.resolve(false);
    return shown(async function () {
      try {
        var buf = await PptSvc.save(), r = await NativeTools.call('save_local_file', { fileName: 'draft-' + rec.name, base64: App.b64(buf), reason: 'Keep a draft of your edits' }), old = rec.draft && rec.draft.path;
        rec.draft = { path: r.data.path, size: buf.byteLength, at: Date.now() }; await Store.put(rec); if (old) Store.dropFile(old); return true;
      } catch (e) { return false; /* a draft is a convenience: the next round tries again */ }
    }, 'drafting', 's.draftok');
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden && V.dirty) { stopTimer(); V.draftNow(); } });

  // ---- one change to the deck: a list of ops, all or nothing; changes wait for each other -----------------------------------------------
  V.run = function (ops, key, opt) {
    opt = opt || {};
    var p = queue.then(async function () {
      var busy = setTimeout(function () { $('stBusy').innerHTML = EditView.busy(t(key || 'busy.edit')); $('stBusy').classList.remove('hidden'); }, 400);
      try {
        var r = await PptSvc.txn(ops);
        if (!r.applied) { Ui.toast(t('err.op', { e: String((r.failures[0] && r.failures[0].error) || '').split('\n')[0].slice(0, 90) })); return false; }
        var n = Deck.count(); Deck.changed(r);
        if (opt.go != null) Deck.cur = Math.max(0, Math.min(Deck.count() - 1, opt.go));
        if (opt.select && r.added && r.added.length) Deck.sel = r.added[0]; else if (n !== Deck.count()) Deck.sel = null;
        V.touch(); if (n !== Deck.count() || opt.rebuild) Film.build(); await Stage.show(); if (opt.select) Stage.select(Deck.sel);
        return r;
      } catch (e) { App.fail('err.generic', e); return false; }
      finally { clearTimeout(busy); $('stBusy').classList.add('hidden'); }
    });
    queue = p.catch(function () {}); return p;
  };
  V.dup = async function (slide, id) {
    try { var items = await PptSvc.copy(slide, [id]), r = await V.run([Deck.op('pasteElements', null, { items: items, dx: 228600, dy: 228600 }, slide)], 'busy.edit', { select: true }); return r && r.added && r.added[0]; }
    catch (e) { App.fail('err.generic', e); return null; }
  };
  // undo and redo are one step of the engine's own history
  function step(name) {
    queue = queue.then(async function () {
      try { var n = Deck.count(), info = await PptSvc[name](); Deck.changed(info); if (n !== Deck.count()) Film.build(); V.touch(); await Stage.show(); } catch (e) { App.fail('err.generic', e); }
    }).catch(function () {});
  }
  A['d-undo'] = function () { if (Deck.info && Deck.info.canUndo) step('undo'); };
  A['d-redo'] = function () { if (Deck.info && Deck.info.canRedo) step('redo'); };

  // ---- save and leave --------------------------------------------------------------------------------------------------------------
  // the first slide, small, kept as a picture for the list of decks
  V.thumb = async function (rec) {
    try {
      var tree = await PptSvc.render(0, 240), cv = document.createElement('canvas'), dpr = 1; cv.width = Math.round(tree.widthPx); cv.height = Math.round(tree.heightPx); SlideDraw.draw(cv.getContext('2d'), tree);
      var png = cv.toDataURL('image/png').split(',')[1], r = await NativeTools.call('save_local_file', { fileName: 'thumb.png', base64: png, reason: 'A small picture of the first slide' }), old = rec.thumbPath;
      rec.thumb = r.data.path; rec.thumbPath = r.data.path; if (old) Store.dropFile(old);
    } catch (e) { /* the list shows a plain page instead */ }
  };
  V.save = function () {
    var rec = V.rec; if (!rec) return Promise.resolve(false); stopTimer();
    return shown(async function () {
      try {
        var buf = await PptSvc.save(), r = await NativeTools.call('save_local_file', { fileName: rec.name, base64: App.b64(buf), reason: 'Save the edited deck' }), f = r && r.data;
        if (!f || !f.path) throw new Error('no file');
        var old = rec.path, oldDraft = rec.draft && rec.draft.path;
        rec.path = f.path; rec.url = f.path; rec.size = f.sizeBytes || buf.byteLength; rec.editedAt = Date.now(); rec.openedAt = Date.now(); rec.draft = null;
        await V.thumb(rec); await Store.put(rec); Store.dropFile(old); if (oldDraft) Store.dropFile(oldDraft);
        V.dirty = false; return true;
      } catch (e) { App.fail('t.savefail', e); return false; }
    }, 'saving', 's.saved').then(function (ok) { V.chrome(); return ok; });
  };
  A['v-save'] = function () { V.save(); };
  V.guardLeave = function () {
    if (!V.dirty || !V.rec) return false;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('lv.title'), t('lv.body'), [{ act: 'lv-discard', label: t('lv.discard'), kind: 'danger' }, { act: 'lv-save', label: t('lv.save'), kind: 'solid' }]);
    return true;
  };
  function leave() { V.dirty = false; V.rec = null; Ui.hint('slide'); Router.navigate('home'); }
  A['lv-save'] = async function () { Ui.closeDialog(); if (await V.save()) leave(); };
  A['lv-discard'] = async function () { Ui.closeDialog(); stopTimer(); await V.dropDraft(); leave(); };
  A['v-back'] = function () { if (V.backInPage()) return; if (!V.guardLeave()) leave(); };
  // the phone's Back button: close the step you are in first, then the page
  V.backInPage = function () {
    if (Present.close() || Find.close() || Slides.close()) return true;
    if (Deck.sel && Router.getCurrent() === 'deck') { Stage.select(null); return true; }
    return false;
  };
})();
