// Menus — the menu bar of a computer: File, Edit, View, Insert, Format, Data, Tools, Help. Each item is an action the app already has, or one of the few that only a computer needs (freeze, gridlines, show formulas, go to a cell, the list of shortcuts).
// Other files add their items with Menus.add('data', function () { return [...]; }) when they load, so a feature shows up in the menu as soon as it exists.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, F = window.Format, D = window.Desk, X = window.Fmt2;
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform), K = MAC ? '⌘' : 'Ctrl+', M = window.Menus = { extra: {} };
  M.add = function (menu, fn) { (M.extra[menu] = M.extra[menu] || []).push(fn); };
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  function act(a) { return function () { A[a](); }; }

  // ---- go to a cell or a range: "C10", "B2:D9", "Sheet2!A1" or the name of a named range ------------------------------------------------
  M.goto = function (text) {
    text = String(text || '').trim(); var sh = G.geo.sh, m = /^(?:'?([^'!]+)'?!)?(.+)$/.exec(text), ref = m && m[2], other = m && m[1] && Wb.byName(m[1]);
    if (Wb.names && Wb.names[text.toLowerCase()]) { var n = Wb.names[text.toLowerCase()]; return M.goto(String(n.formula || '').replace(/^=/, '')); }
    var p = ref && /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(ref); if (!p) return false;
    var r1 = +p[2] - 1, c1 = CalcParse.colNum(p[1]), r2 = p[4] ? +p[4] - 1 : r1, c2 = p[3] ? CalcParse.colNum(p[3]) : c1;
    if (other && other !== sh) Book.show(Wb.sheets.indexOf(other)); G.select(r1, c1, r2, c2); G.reveal(r1, c1); return true;
  };

  // ---- view ----------------------------------------------------------------------------------------------------------------------
  function freezeTo(y, x) { var sh = G.geo.sh; sh.frozen = { x: x, y: y }; sh.freezeDirty = true; G.mount(); Book.touch(); }
  M.gridlines = function () { var sh = G.geo.sh; sh.noGrid = !sh.noGrid; sh.viewDirty = true; $('gWrap').classList.toggle('nogrid', !!sh.noGrid); Book.touch(); };
  M.formulas = function () { G.showF = !G.showF; G.mount(); };
  function zoomItems() { return [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map(function (z) { return { t: Math.round(z * 100) + '%', on: Math.abs(G.z - z) < 0.02, go: function () { G.setZoom(z); } }; }); }
  function fullscreen() { var d = document, el = d.documentElement; if (d.fullscreenElement) d.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); }

  // ---- the menus ---------------------------------------------------------------------------------------------------------------------
  var MENUS = {
    file: function () {
      return [it('mi.save', K + 'S', act('b-save'), { off: Wb.readOnly }), it('mi.copyfile', '', act('m-copy')), { t: t('mi.download'), sub: [it('mi.xlsx', '', act('m-save')), it('mi.csv', '', act('m-csv')), it('mi.pdf', '', act('m-pdf'))] }, '-',
        it('mi.share', '', act('m-share')), it('mi.rename', '', act('m-rename'), { off: Wb.readOnly }), it('mi.print', K + 'P', act('m-pdf')), '-', it('mi.discard', '', act('m-discard'), { off: Wb.readOnly }), it('mi.close', '', act('b-back'))];
    },
    edit: function () {
      var ro = Wb.readOnly, off = { off: ro };
      return [it('mi.undo', K + 'Z', act('b-undo'), { off: !Wb.canUndo() }), it('mi.redo', K + 'Y', act('b-redo'), { off: !Wb.canRedo() }), '-', it('cx.cut', K + 'X', function () { Clip.copy(true); }, off), it('cx.copy', K + 'C', function () { Clip.copy(false); }), it('cx.paste', K + 'V', function () { Clip.paste(); }, off),
        { t: t('cx.pspecial'), off: ro, sub: [it('cx.psvalues', '', function () { Clip.pasteMode('values'); }), it('cx.psformulas', '', function () { Clip.pasteMode('formulas'); }), it('cx.psformats', '', function () { Clip.pasteMode('formats'); }), it('cx.pstranspose', '', function () { Clip.pasteMode('transpose'); })] }, '-',
        it('mi.find', K + 'F', act('fd-open')), '-', it('cx.clear', 'Del', function () { Clip.clear(); }, off), it('ed.clearfmt', K + '\\', function () { X.clearFormats(); }, off),
        { t: t('mi.delete'), off: ro, sub: [it('cx.delrow', '', act('rc-rowd')), it('cx.delcol', '', act('rc-cold'))] }, '-', it('mi.selectall', K + 'A', function () { Keys.selectAll(); })];
    },
    view: function () {
      var sh = G.geo.sh;
      return [{ t: t('vw.freeze'), sub: [it('fz.none', '', function () { freezeTo(0, 0); }), it('fz.r1', '', function () { freezeTo(1, sh.frozen.x); }), it('fz.r2', '', function () { freezeTo(2, sh.frozen.x); }), it('fz.rn', '', function () { freezeTo(G.sel.r1 + 1, sh.frozen.x); }), '-',
        it('fz.c1', '', function () { freezeTo(sh.frozen.y, 1); }), it('fz.c2', '', function () { freezeTo(sh.frozen.y, 2); }), it('fz.cn', '', function () { freezeTo(sh.frozen.y, G.sel.c1 + 1); })] }, '-',
        it('vw.gridlines', '', M.gridlines, { on: !sh.noGrid }), it('vw.formulas', K + '`', M.formulas, { on: !!G.showF }), { t: t('vw.zoom'), sub: zoomItems() }, '-', it('vw.print', '', act('b-page'), { on: !!(window.XPage && XPage.on) }), it('vw.full', '', fullscreen)];
    },
    insert: function () {
      var off = { off: Wb.readOnly };
      return [it('mi.rowa', '', act('rc-rowa'), off), it('mi.rowb', '', act('rc-rowb'), off), it('mi.cola', '', act('rc-cola'), off), it('mi.colb', '', act('rc-colb'), off), '-', it('mi.chart', '', act('ch-open'), off),
        { t: t('mi.function'), off: Wb.readOnly, sub: D.sumItems() }, '-', it('mi.sheet', '', act('sh-add'), off)];
    },
    format: function () {
      var st = F.cur(), off = { off: Wb.readOnly }, ap = function (p) { return function () { F.apply(p); }; };
      return [{ t: t('mi.number'), sub: D.numberItems() }, { t: t('mi.text'), sub: [it('f.bold', K + 'B', act('f-bold'), { on: !!st.b }), it('f.italic', K + 'I', act('f-italic'), { on: !!st.i }), it('f.underline', K + 'U', act('f-under'), { on: !!st.u }), it('f.strike', '', act('f-strike'), { on: !!st.s })] },
        { t: t('mi.align'), sub: [it('al.left', '', ap({ al: 'left' }), { on: st.al === 'left' }), it('al.center', '', ap({ al: 'center' }), { on: st.al === 'center' }), it('al.right', '', ap({ al: 'right' }), { on: st.al === 'right' }), '-', it('al.top', '', ap({ va: 'top' }), { on: st.va === 'top' }), it('al.middle', '', ap({ va: 'center' }), { on: st.va === 'center' }), it('al.bottom', '', ap({ va: null }), { on: !st.va })] },
        { t: t('mi.wrapping'), sub: [it('wr.overflow', '', ap({ wrap: null }), { on: !st.wrap }), it('wr.wrap', '', ap({ wrap: 1 }), { on: !!st.wrap }), it('wr.clip', '', ap({ wrap: null }))] }, { t: t('mi.merge'), sub: D.mergeItems() }, '-', it('ed.clearfmt', K + '\\', function () { X.clearFormats(); }, off)];
    },
    data: function () {
      return [it('mi.sorta', '', act('sf-asc'), { off: Wb.readOnly }), it('mi.sortz', '', act('sf-desc'), { off: Wb.readOnly }), it('mi.advanced', '', act('sf-open'))];
    },
    tools: function () { return [it('vw.formulas', K + '`', M.formulas, { on: !!G.showF }), it('mi.goto', K + 'G', function () { var i = $('fbRef'); if (i) { i.focus(); i.select(); } })]; },
    help: function () { return [it('mi.keys', '', M.keys)]; }
  };
  M.keys = function () {
    var rows = [['ks.nav', [['← ↑ → ↓', 'Move'], [K + '←→↑↓', 'Jump to the edge of the data'], ['Tab / Shift+Tab', 'Next / previous cell'], ['Enter / Shift+Enter', 'Down / up'], [K + 'Home / End', 'First / last cell'], ['Shift+arrows', 'Extend the selection'], [K + 'A', 'Select all']]],
      ['ks.edit', [['F2', 'Edit the cell'], ['Esc', 'Cancel'], ['Alt+Enter', 'New line in a cell'], ['F4', 'Absolute / relative reference'], [K + 'D / R', 'Fill down / right'], [K + 'C / X / V', 'Copy / cut / paste'], [K + 'Z / Y', 'Undo / redo'], ['Del', 'Clear the cells']]],
      ['ks.format', [[K + 'B / I / U', 'Bold / italic / underline'], [K + '\\', 'Clear formatting']]], ['ks.other', [[K + 'F', 'Find and replace'], [K + 'S', 'Save'], [K + ';', 'Today\'s date'], ['Space + drag', 'Move the sheet'], [K + 'scroll', 'Zoom']]]];
    Ui.sheet('keys', '<h2 class="sh-h">' + Ui.esc(t('ks.title')) + '</h2><div class="ks">' + rows.map(function (g) { return '<h3>' + Ui.esc(t(g[0])) + '</h3>' + g[1].map(function (r) { return '<p><kbd>' + Ui.esc(r[0]) + '</kbd><span>' + Ui.esc(r[1]) + '</span></p>'; }).join(''); }).join('') + '</div><button type="button" class="btn" data-act="sheet-done">' + Ui.esc(t('a.done')) + '</button>');
  };

  // ---- the bar --------------------------------------------------------------------------------------------------------------------
  var NAMES = ['file', 'edit', 'view', 'insert', 'format', 'data', 'tools', 'help'];
  M.build = function () { var el = $('dkMenu'); if (el) el.innerHTML = NAMES.map(function (n) { return '<button type="button" class="dk-m" data-m="' + n + '">' + Ui.esc(t('mb.' + n)) + '</button>'; }).join(''); };
  // the items of one menu: its own, then what other files added with Menus.add (the touch layout lists them in the same order)
  M.items = function (n) { var items = MENUS[n](); (M.extra[n] || []).forEach(function (f) { var more = f(); if (more && more.length) items = items.concat(['-'], more); }); return items; };
  function open(btn) {
    var r = btn.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 2, M.items(btn.dataset.m), { from: btn });
  }
  M.init = function () {
    var el = $('dkMenu'); if (!el) return; M.build();
    el.addEventListener('click', function (e) { var b = e.target.closest('.dk-m'); if (!b) return; if (b.classList.contains('open')) PopMenu.close(); else open(b); });
    el.addEventListener('pointerover', function (e) { var b = e.target.closest('.dk-m'); if (b && PopMenu.isOpen() && !b.classList.contains('open')) open(b); });
    el.addEventListener('mousedown', function (e) { if (e.target.closest('.dk-m')) e.preventDefault(); });
    // the box left of the formula bar: type a cell, a range, a sheet!range or a name, press Enter
    document.addEventListener('keydown', function (e) { if (e.target.id !== 'fbRef') return; if (e.key === 'Enter') { e.preventDefault(); if (M.goto(e.target.value)) e.target.blur(); else Ui.toast(t('nb.bad')); } else if (e.key === 'Escape') { e.target.blur(); } });
    document.addEventListener('focusin', function (e) { if (e.target.id === 'fbRef' && Wb.readOnly === false) setTimeout(function () { e.target.select(); }, 0); });
    window.addEventListener('language:changed', M.build);
  };
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'g' && App.state.page === 'book') { e.preventDefault(); var i = $('fbRef'); if (i) { i.focus(); i.select(); } } });
})();
