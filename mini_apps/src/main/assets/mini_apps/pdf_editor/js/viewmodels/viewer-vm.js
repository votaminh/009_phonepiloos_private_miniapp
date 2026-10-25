// Viewer — the open PDF as a file: reading it into the engine (and asking for a password), the title bar, keeping a draft while you work, saving, and leaving.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DRAFT_MS = 30000, MIN_SHOW = 700, timers = {};
  var V = window.Viewer = { rec: null, dirty: false, drafting: false, saving: false, flash: '', scanned: false, pw: '' };

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
    $('docTop').classList.toggle('saving', V.saving || V.drafting);
    $('docTop').innerHTML = ReadView.top(V.rec ? V.rec.name : '', status(), { mode: Read.mode, undo: Doc.canUndo(), redo: Doc.canRedo(), dirty: V.dirty });
  };
  V.relabel = function () { if (V.rec) Read.chrome(); };
  // what the line under the pages says in each mode
  Read.hintFn = function (m) {
    if (m === 'text') return { text: t(V.scanned ? 'hint.scan' : 'hint.text') };
    if (m === 'add') return { text: t('hint.add') };
    if (m === 'annot') return { text: t('hint.' + Mark.tool) };
    if (m === 'redact') return { text: t('hint.redact') };
    if (m === 'read' && V.scanned) return { text: t('hint.scan') };
    return null;
  };

  // ---- opening -----------------------------------------------------------------------------------------------------------------
  V.open = async function (rec, opts) {
    opts = opts || {}; V.rec = rec; V.dirty = false; V.pw = ''; V.scanned = false; Doc.rec = rec; Doc.hist = []; Doc.redo = []; Doc.zoom = 1; Doc.sizes = [];
    Read.reset(); Find.close(); Pages.close(); Mark.clear(); Sign.cancel(); V.chrome(); $('docTools').innerHTML = ''; $('docHint').classList.add('hidden');
    if (Router.getCurrent() !== 'doc') Router.navigate('doc'); else App.state.page = 'doc';
    $('rdHost').style.height = 'auto'; $('rdHost').innerHTML = '<p class="bk-msg">' + Ui.esc(t('b.loading')) + '</p>';
    try {
      await Files.request(rec.path);
      var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
      await V.load(await res.arrayBuffer(), opts);
    } catch (e) { if (String(e && e.message) !== 'cancelled') App.problem(t('err.open'), String(e && e.message || e).slice(0, 200)); V.rec = null; Router.navigate('home'); return; }
    if (rec.draft && !opts.edit) V.offerDraft();
  };
  V.load = async function (buf, opts) {
    var r;
    try { r = await PdfSvc.open(buf.slice(0), V.pw); }
    catch (e) { if (/password/i.test(String(e && e.message))) return V.askPassword(buf, opts); throw e; }
    Doc.reset(r.sizes); Doc.hist = []; Doc.redo = []; Doc.viewW = $('rdScroll').clientWidth || Doc.viewW;
    $('rdHost').innerHTML = ''; Read.mount(); Read.setMode(opts.edit ? 'text' : 'read');
    if (!opts.blank) Doc.blocks(0).then(function (b) { V.scanned = !b.length; if (V.scanned) Read.chrome(); }).catch(function () {});
  };
  V.askPassword = function (buf, opts) {
    V.pending = { buf: buf, opts: opts };
    Ui.dialog('', '', '', function () {}); $('dlg').innerHTML = SheetsView.password(!!V.pw);
    setTimeout(function () { var i = $('pwIn'); if (i) i.focus(); }, 320);
  };
  A['pw-ok'] = async function () {
    var v = $('pwIn').value; if (!v) return; V.pw = v; Ui.closeDialog();
    try { await V.load(V.pending.buf, V.pending.opts); } catch (e) { if (/password/i.test(String(e && e.message))) V.askPassword(V.pending.buf, V.pending.opts); else { App.problem(t('err.open'), String(e && e.message || e).slice(0, 200)); Router.navigate('home'); } }
  };
  A['pw-no'] = function () { Ui.closeDialog(); V.rec = null; Router.navigate('home'); };

  // ---- drafts ------------------------------------------------------------------------------------------------------------------
  V.offerDraft = function () {
    var rec = V.rec, d = rec.draft; if (!d) return;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('au.title'), t('au.body', { name: rec.name, t: HomeView.ago(d.at) }), [{ act: 'a-discard', label: t('au.discard'), kind: 'danger' }, { act: 'a-recover', label: t('au.recover'), kind: 'solid' }]);
  };
  A['a-discard'] = function () { Ui.closeDialog(); V.dropDraft(); };
  A['a-recover'] = async function () {
    Ui.closeDialog();
    try { var res = await fetch(V.rec.draft.path); await V.load(await res.arrayBuffer(), { edit: true }); V.touch(); } catch (e) { App.fail('err.generic', e); }
  };
  V.dropDraft = async function () { var rec = V.rec; if (!rec || !rec.draft) return; var old = rec.draft.path; rec.draft = null; await Store.put(rec); Store.dropFile(old); };
  // a draft is kept every 30 seconds while there are edits (one timer, not reset by each edit), and when the app goes to the background
  V.touch = function () { V.dirty = true; if (!timers.draft) timers.draft = setTimeout(function () { timers.draft = 0; V.draftNow(); }, DRAFT_MS); V.chrome(); Read.chrome(); };
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
        var buf = await PdfSvc.save(), r = await NativeTools.call('save_local_file', { fileName: 'draft-' + rec.name, base64: App.b64(buf), reason: 'Keep a draft of your edits' }), old = rec.draft && rec.draft.path;
        rec.draft = { path: r.data.path, size: buf.byteLength, at: Date.now() }; await Store.put(rec); if (old) Store.dropFile(old); return true;
      } catch (e) { return false; /* a draft is a convenience: the next round tries again */ }
    }, 'drafting', 's.draftok');
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden && V.dirty) { stopTimer(); V.draftNow(); } });

  // ---- one change to the document: busy line, engine, redraw, draft --------------------------------------------------------------
  // changes wait for each other: two quick taps never run inside the engine at the same time
  var queue = Promise.resolve();
  V.run = function (fn, key) {
    var p = queue.then(async function () {
      Read.busy(t(key || 'busy.edit'));
      try { var r = await Doc.mutate(fn); V.scanned = false; Read.reload(); V.touch(); return r; }
      catch (e) { App.fail('err.generic', e); return null; }
      finally { Read.idle(); }
    });
    queue = p.catch(function () {}); return p;
  };

  // ---- save and leave --------------------------------------------------------------------------------------------------------------
  V.save = function () {
    var rec = V.rec; if (!rec) return Promise.resolve(false); stopTimer();
    return shown(async function () {
      try {
        var buf = await PdfSvc.save(), r = await NativeTools.call('save_local_file', { fileName: rec.name, base64: App.b64(buf), reason: 'Save the edited PDF' }), f = r && r.data;
        if (!f || !f.path) throw new Error('no file');
        var old = rec.path, oldDraft = rec.draft && rec.draft.path;
        rec.path = f.path; rec.url = f.path; rec.size = f.sizeBytes || buf.byteLength; rec.editedAt = Date.now(); rec.openedAt = Date.now(); rec.draft = null;
        await Store.put(rec); Store.dropFile(old); if (oldDraft) Store.dropFile(oldDraft);
        V.dirty = false; return true;
      } catch (e) { App.fail('t.savefail', e); return false; }
    }, 'saving', 's.saved').then(function (ok) { Read.chrome(); return ok; });
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
    if (Find.close() || Pages.close()) return true;
    if (Sign.active) { Sign.cancel(); return true; }
    if (Read.mode !== 'read' && Router.getCurrent() === 'doc') { Mark.clear(); Read.setMode('read'); return true; }
    return false;
  };
})();
