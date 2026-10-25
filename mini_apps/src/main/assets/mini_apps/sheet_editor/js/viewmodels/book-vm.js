// Book — the open workbook: reading it through the engine, the title bar and tabs, keeping a draft while you work, saving, and leaving.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DRAFT_MS = 30000, MIN_SHOW = 700, LARGE = 300000, timers = {};
  var B = window.Book = { rec: null, dirty: false, drafting: false, saving: false, flash: '' };

  // ---- title bar, tabs, banner ------------------------------------------------------------------------------------------------
  function status() {
    var r = B.rec; if (!r) return { c: 'mute', t: t('b.loading') };
    if (Wb.readOnly) return { c: 'mute', t: t(B.large ? 'b.large' : 'b.read') };
    if (B.saving) return { c: 'saving', t: t('s.savingfile') };
    if (B.drafting) return { c: 'saving', t: t('s.saving') };
    if (B.flash) return { c: 'pop', t: t(B.flash) };
    if (B.dirty) return { c: 'warn', t: r.draft ? t('s.draft', { t: HomeView.ago(r.draft.at) }) : t('s.unsaved') };
    return { c: '', t: t('s.saved') };
  }
  B.chrome = function (skipTabs) {
    var r = B.rec, s = status();
    $('bookTop').classList.toggle('saving', B.saving || B.drafting);
    $('bookTop').innerHTML = GridView.top(r ? r.name : '', s, { ro: Wb.readOnly, undo: Wb.canUndo(), redo: Wb.canRedo(), dirty: B.dirty, page: window.XPage && XPage.on });
    if (!skipTabs) B.tabs(false);
    var ban = $('bookBanner'); ban.classList.toggle('hidden', !Wb.readOnly || !r);
    ban.innerHTML = Wb.readOnly && r ? '<b>' + Ui.esc(t(B.large ? 'b.large.s' : 'b.read.s')) + '</b>' + (B.large ? '' : '<button type="button" class="pill solid" data-act="b-edit">' + Ui.esc(t('a.edit')) + '</button>') : '';
    var tab = $('bookTools'); if (tab && Grid.geo) Grid.tools(); if (window.Desk) Desk.sync();
  };
  // sheet tabs: rebuilt only when the sheets change; picking one slides the pill
  B.tabs = function (animate) {
    var el = $('bookTabs'), key = Wb.sheets.map(function (s) { return s.name + (s.hiddenSheet ? '!' : ''); }).join('|') + (Wb.readOnly ? '#' : '') + I18n.locale();
    if (el.dataset.key !== key) { el.innerHTML = GridView.tabs(Wb.sheets, Wb.on, !Wb.readOnly); el.dataset.key = key; Motion.pill(el, '.bk-tab.on', false); return; }
    Array.prototype.forEach.call(el.querySelectorAll('.bk-tab[data-i]'), function (b) { b.classList.toggle('on', +b.dataset.i === Wb.on); });
    Motion.pill(el, '.bk-tab.on', animate);
  };
  B.relabel = function () { if (B.rec) { B.chrome(); if (Grid.geo) Grid.paint(); } };
  B.show = function (i) {
    if (Grid.editing) { var f = $('fbIn'); if (f) f.blur(); }
    var was = Wb.on; Wb.on = i; Grid.sel = { r1: 0, c1: 0, r2: 0, c2: 0, whole: '' }; Grid.qk = false; Grid.mount(); B.chrome(true); B.tabs(was !== i); $('gScroll').scrollTop = 0; if (window.XPage && XPage.on) { XPage.render(); if (was !== i) Motion.slide($('xpages'), i > was ? 1 : -1); } else if (was !== i) Motion.slide($('gWrap'), i > was ? 1 : -1);
  };
  // something changed: update the bar and plan a draft
  B.touch = function () {
    B.dirty = true; if (!Wb.readOnly && !timers.draft) timers.draft = setTimeout(function () { timers.draft = 0; B.draftNow(); }, DRAFT_MS);
    B.chrome();
  };

  // ---- opening ----------------------------------------------------------------------------------------------------------------
  B.load = async function (buf, opts) {
    var head = new Uint8Array(buf.slice(0, 4));
    if (head[0] === 0xD0 && head[1] === 0xCF) throw new Error(t('err.protected'));
    var copy = buf.slice(0), res = await SheetSvc.open(buf);
    Wb.load(res); await Xrich.load(copy); var cells = 0; Wb.sheets.forEach(function (s) { cells += Object.keys(s.cells).length; });
    B.large = cells > LARGE; Wb.readOnly = !opts.edit || B.large;
    Wb.on = Math.max(0, Wb.sheets.findIndex(function (s) { return !s.hiddenSheet; })); B.dirty = false;
    B.show(Wb.on); if (window.XPage) XPage.sync(); B.savePeek();
  };
  // the first cells of the first sheet, kept with the file's record: the picture of the file on the home page
  B.savePeek = function () {
    var rec = B.rec, sh = Wb.sheets[Wb.on]; if (!rec || !sh) return;
    try {
      var pk = [], r, c, row, v, st, tx;
      for (r = 0; r < 7; r++) { row = []; for (c = 0; c < 4; c++) { v = Calc.value(sh, r, c); st = Wb.style(sh, r, c) || {}; tx = v === undefined || v === null ? '' : String(v); row.push([tx.length > 9 ? tx.slice(0, 9) : tx, st.bg || '', st.b ? 1 : 0]); } pk.push(row); }
      if (JSON.stringify(pk) !== JSON.stringify(rec.peek)) { rec.peek = pk; Store.put(rec); }
    } catch (e) { /* no picture; the plain grid stays */ }
  };
  B.open = async function (rec, opts) {
    opts = opts || {}; B.rec = rec; Wb.sheets = []; Wb.readOnly = true; Grid.geo = null; Grid.z = 1; B.dirty = false;
    $('gHost').innerHTML = ''; $('bookBar').innerHTML = ''; $('bookTools').innerHTML = ''; $('bookStats').classList.remove('on'); $('gFz').style.display = 'none'; $('gColIn').innerHTML = '';
    Find.close(); B.chrome();
    if (Router.getCurrent() !== 'book') Router.navigate('book'); else App.state.page = 'book';
    $('gHost').style.height = 'auto'; $('gHost').innerHTML = '<p class="bk-msg">' + Ui.esc(t('b.loading')) + '</p>';
    try {
      await Files.request(rec.path);
      var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
      await B.load(await res.arrayBuffer(), opts);
    } catch (e) { if (String(e && e.message) !== 'cancelled') App.problem(t('err.open'), String(e && e.message || e).slice(0, 200)); B.rec = null; Router.navigate('home'); return; }
    if (rec.draft && !opts.edit) B.offerDraft();
  };
  B.offerDraft = function () {
    var rec = B.rec, d = rec.draft; if (!d) return;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('au.title'), t('au.body', { name: rec.name, t: HomeView.ago(d.at) }), [{ act: 'a-discard', label: t('au.discard'), kind: 'danger' }, { act: 'a-recover', label: t('au.recover'), kind: 'solid' }]);
  };
  A['a-discard'] = function () { Ui.closeDialog(); B.dropDraft(); };
  A['a-recover'] = async function () {
    Ui.closeDialog();
    try { var res = await fetch(B.rec.draft.path); await B.load(await res.arrayBuffer(), { edit: true }); B.touch(); } catch (e) { App.fail('err.generic', e); }
  };
  B.dropDraft = async function () { var rec = B.rec; if (!rec || !rec.draft) return; var old = rec.draft.path; rec.draft = null; await Store.put(rec); Store.dropFile(old); };
  A['b-edit'] = function () { Wb.readOnly = false; B.chrome(); Grid.paint(); };

  // ---- engine round trips -----------------------------------------------------------------------------------------------------
  // send everything not yet in the engine's copy; null when there is nothing to send
  B.flush = async function (extra) {
    var p = Wb.payload(); if (extra) Object.assign(p, extra);
    if (!p.edits.length && !p.structural.length && !p.freeze.length && !p.dv.length && !p.links.length && !p.notes.length && !p.tabs.length && !p.cf.length && !p.cfDel.length && !p.filters.length && !p.protect.length && !p.tables.length && !p.tableEdits.length && !(p.pageSetup && p.pageSetup.length) && !(p.chartEdits && p.chartEdits.length) && !(p.pivots && p.pivots.length) && !(p.pivotUpdates && p.pivotUpdates.length) && !(p.visualEdits && p.visualEdits.length) && !p.names && !(p.visuals && p.visuals.length) && !p.sheetPlan) return null;
    var bytes = await SheetSvc.apply(p); Wb.clean(); if ((p.cf.length || p.cfDel.length) && window.Xrich) await Xrich.load(bytes.slice(0)); return bytes;
  };
  B.bytes = async function () { await B.flush(); return SheetSvc.bytes(); };
  // the engine moved cells (rows / columns / sheets): read the workbook back from it
  async function reread(keep) {
    var bytes = await SheetSvc.bytes(), ro = Wb.readOnly, on = Wb.on, sel = Object.assign({}, Grid.sel);
    Wb.load(await SheetSvc.open(bytes)); Wb.readOnly = ro; Wb.on = Math.min(on, Wb.sheets.length - 1);
    if (keep) { var i = Wb.sheets.findIndex(function (s) { return s.name === keep; }); if (i >= 0) Wb.on = i; }
    Grid.sel = { r1: sel.r1, c1: sel.c1, r2: sel.r1, c2: sel.c1, whole: '' }; Grid.mount(); B.chrome();
  }
  B.shift = async function (sheetName, ops) { var ps = Wb.byName(sheetName); if (ps && ps.prot && window.Prot && !Prot.allows(ps, ops)) return Prot.say('struct'); await B.flush(); await SheetSvc.apply({ structural: [{ sheetName: sheetName, ops: ops }] }); await reread(); B.touch(); };
  B.sheetPlan = async function (plan, focus) { await B.flush(); await SheetSvc.apply({ sheetPlan: plan }); await reread(focus); B.touch(); };

  // ---- draft and save ---------------------------------------------------------------------------------------------------------
  function stopDraft() { clearTimeout(timers.draft); timers.draft = 0; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // the bar says "saving" with a moving line, then "saved" with a small pop; both stay long enough to be seen
  async function shown(work, flag, done) {
    B[flag] = true; B.flash = ''; B.chrome(true); var t0 = Date.now(), ok = false;
    try { ok = await work(); } finally { var left = MIN_SHOW - (Date.now() - t0); if (left > 0) await sleep(left); B[flag] = false; }
    if (ok) { B.flash = done; clearTimeout(timers.flash); timers.flash = setTimeout(function () { B.flash = ''; B.chrome(true); }, 2200); }
    B.chrome(true); return ok;
  }
  // a draft is kept every 30 seconds while there are edits (one timer, not reset by each edit), and when the app goes to the background
  B.draftNow = function () {
    var rec = B.rec; if (!rec || !B.dirty || B.drafting || B.saving || Wb.readOnly) return Promise.resolve(false);
    return shown(async function () {
      try {
        var buf = await B.bytes(), r = await NativeTools.call('save_local_file', { fileName: 'draft-' + rec.name, base64: App.b64(buf), reason: 'Keep a draft of your edits' }), old = rec.draft && rec.draft.path;
        rec.draft = { path: r.data.path, size: buf.byteLength, at: Date.now() }; await Store.put(rec); if (old) Store.dropFile(old); return true;
      } catch (e) { return false; /* a draft is a convenience: the next round tries again */ }
    }, 'drafting', 's.draftok');
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden && B.dirty && !Wb.readOnly) { stopDraft(); B.draftNow(); } });
  B.save = function () {
    var rec = B.rec; if (!rec) return Promise.resolve(false); stopDraft();
    return shown(async function () {
      try {
        var buf = await B.bytes(), r = await NativeTools.call('save_local_file', { fileName: rec.name, base64: App.b64(buf), reason: 'Save the edited workbook' }), f = r && r.data;
        if (!f || !f.path) throw new Error('no file');
        var old = rec.path, oldDraft = rec.draft && rec.draft.path;
        rec.path = f.path; rec.url = f.path; rec.size = f.sizeBytes || buf.byteLength; rec.editedAt = Date.now(); rec.openedAt = Date.now(); rec.draft = null;
        await Store.put(rec); Store.dropFile(old); if (oldDraft) Store.dropFile(oldDraft);
        B.dirty = false; return true;
      } catch (e) { App.fail('t.savefail', e); return false; }
    }, 'saving', 't.saved');
  };
  A['b-save'] = function () { B.save(); };
  A['b-undo'] = function () { if (Wb.undo()) Grid.changed(); };
  A['b-redo'] = function () { if (Wb.redo()) Grid.changed(); };

  // ---- leaving ----------------------------------------------------------------------------------------------------------------
  B.guardLeave = function () {
    if (!B.dirty || Wb.readOnly || !B.rec) return false;
    Ui.dialog('', '', '', function () {});
    $('dlg').innerHTML = SheetsView.choice(t('lv.title'), t('lv.body'), [{ act: 'lv-discard', label: t('lv.discard'), kind: 'danger' }, { act: 'lv-save', label: t('lv.save'), kind: 'solid' }]);
    return true;
  };
  function leave() { B.dirty = false; Router.back(); }   // the page folds back into its row (UiNav.hookBack)
  A['lv-save'] = async function () { Ui.closeDialog(); if (await B.save()) leave(); };
  A['lv-discard'] = async function () { Ui.closeDialog(); stopDraft(); await B.dropDraft(); leave(); };
  A['b-back'] = function () { if (Find.close()) return; if (!B.guardLeave()) leave(); };
  // the phone's Back button: a finished sub-step first, then the page
  B.backInPage = function () { return Find.close(); };
})();
