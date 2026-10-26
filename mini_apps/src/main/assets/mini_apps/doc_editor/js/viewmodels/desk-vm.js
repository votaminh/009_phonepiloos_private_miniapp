// Desk — the computer's look of the editor (html.pc: a mouse and 1000px or more): a menu bar, one strip of tools (styles, font, size, bold…, alignment, lists, insert), a status bar, and a menu on right click.
// Every item is an existing action (data-act), so the phone and the touch tablet reach the same features through the "All features" sheet, which is built from the same menus (Menus.items).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, MAC = /Mac|iPhone|iPad/.test(navigator.platform), K = MAC ? '⌘' : 'Ctrl+';
  var D = window.Desk = {}, M = window.Menus = { extra: {}, K: K };
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  function act(a, arg) { return function () { A[a](arg || { dataset: {} }); }; }
  function inEdit() { return Doc.mode === 'edit'; }
  function q(c) { try { return document.queryCommandState(c); } catch (e) { return false; } }
  function exec(c) { return function () { Surface.focus(); document.execCommand(c); Edit.mark(); Doc.touch(); }; }
  function blk() { return Edit.block(); }
  function has() { return !!Doc.rec && !!Doc.blocks; }

  // ---- the menus -----------------------------------------------------------------------------------------------------------------
  function align(a) { var b = blk(); return !!b && (b.dataset.al || 'left') === a; }
  var MENUS = {
    file: function () {
      return [it('a.save', K + 'S', act('e-save'), { off: !Doc.dirty }), it('mn.copy', '', act('m-copy')), it('mn.pdf', '', act('m-pdf')), it('mn.share', '', act('m-share')), it('mn.rename', '', act('m-rename')), '-',
        it('r.remove', '', act('m-remove')), it('dk.close', '', act('d-back'))];
    },
    edit: function () {
      var e = inEdit();
      return [it('f.undo', K + 'Z', act('e-undo'), { off: !e || !(Doc.histAt > 0) }), it('f.redo', K + 'Y', act('e-redo'), { off: !e || !(Doc.histAt < Doc.hist.length - 1) }), '-',
        it('q.cut', K + 'X', exec('cut'), { off: !e }), it('q.copy', K + 'C', exec('copy')), it('q.paste', K + 'V', function () { A['q-paste'](); }, { off: !e }), it('dk.selall', K + 'A', function () { Surface.focus(); document.execCommand('selectAll'); }), '-',
        it('mn.find', K + 'F', act('d-find')), '-', it(e ? 'dk.read' : 'a.edit', '', function () { A[e ? 'e-done' : 'd-edit'](); })];
    },
    view: function () {
      var pg = Store.prefs().layout === 'page';
      return [it('w.wrap', '', function () { A['r-layout']({ dataset: { k: 'fit' } }); }, { on: !pg }), it('w.pages', '', function () { A['r-layout']({ dataset: { k: 'page' } }); }, { on: pg }), '-',
        it('w.zin', K + '+', act('z-in')), it('w.zout', K + '−', act('z-out')), it('w.fit', K + '0', act('z-fit')), '-',
        it('o.title', '', act('sd-toggle'), { on: $('pgDoc').classList.contains('side-open') || !!($('docSide') && $('docSide').offsetWidth > 100) }), it('rv.theme', '', function () { A['m-read'](); }), '-',
        it('dk.fullscreen', 'F11', function () { var d = document; if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen(); })];
    },
    insert: function () {
      var e = inEdit();
      return [it('i.table', '', act('i-table'), { off: !e }), it('i.picture', '', act('i-pic'), { off: !e }), it('i.link', K + 'K', act('e-link'), { off: !e }), it('i.divider', '', act('i-div'), { off: !e }), it('i.pagebreak', K + '↵', act('i-brk'), { off: !e })];
    },
    format: function () {
      var e = inEdit(), off = { off: !e };
      return [it('f.bold', K + 'B', act('e-bold'), Object.assign({ on: e && q('bold') }, off)), it('f.italic', K + 'I', act('e-italic'), Object.assign({ on: e && q('italic') }, off)), it('f.underline', K + 'U', act('e-underline'), Object.assign({ on: e && q('underline') }, off)), it('f.strike', '', act('e-strike'), Object.assign({ on: e && q('strikeThrough') }, off)),
        it('fo.sup', '', act('e-sup'), off), it('fo.sub', '', act('e-sub'), off), '-', it('f.larger', K + '⇧>', act('e-larger'), off), it('f.smaller', K + '⇧<', act('e-smaller'), off), it('f.font', '', act('e-font'), off), '-',
        { t: t('dk.align'), off: !e, sub: ['left', 'center', 'right', 'justify'].map(function (a) { return { t: t('p.' + a), k: a === 'center' ? K + 'E' : a === 'left' ? K + 'L' : a === 'right' ? K + 'R' : K + 'J', on: align(a), go: act('e-al-' + a) }; }) },
        it('p.bullets', K + '⇧L', act('e-bul'), off), it('p.numbers', '', act('e-num'), off), it('p.indent', '', act('e-indent'), off), it('p.outdent', '', act('e-outdent'), off), '-',
        { t: t('p.style'), off: !e, sub: [[0, 'st.normal'], [1, 'st.h1'], [2, 'st.h2'], [3, 'st.h3']].map(function (s) { return { t: t(s[1]), k: s[0] ? K + 'Alt+' + s[0] : K + 'Alt+0', go: function () { Struct.setStyle(s[0]); } }; }) },
        '-', it('fo.clear', '', act('e-clear'), off)];
    },
    table: function () {
      var c = !!(window.Table && Table.cell()), e = inEdit() && c;
      return [it('i.table', '', act('i-table'), { off: !inEdit() }), '-', it('tb.rowa', '', act('t-rowa'), { off: !e }), it('tb.rowb', '', act('t-rowb'), { off: !e }), it('tb.cola', '', act('t-cola'), { off: !e }), it('tb.colb', '', act('t-colb'), { off: !e }), '-',
        it('tb.delrow', '', act('t-delrow'), { off: !e }), it('tb.delcol', '', act('t-delcol'), { off: !e }), it('tb.deltable', '', act('t-deltable'), { off: !e })];
    },
    tools: function () { return [it('dk.words', '', function () { D.words(); }), it('mn.contents', '', act('m-contents'))]; }
  };
  M.names = ['file', 'edit', 'view', 'insert', 'format', 'table', 'tools'];
  M.add = function (menu, fn) { (M.extra[menu] = M.extra[menu] || []).push(fn); };
  M.items = function (name) { var out = MENUS[name](); (M.extra[name] || []).forEach(function (f) { out = out.concat(['-'], f()); }); return out; };
  M.open = function (btn) { var r = btn.getBoundingClientRect(); if (PopMenu.isOpen() && PopMenu.from === btn) { PopMenu.close(); return; } PopMenu.show(r.left, r.bottom + 2, M.items(btn.dataset.mn), { from: btn }); };

  // ---- the strip of tools ---------------------------------------------------------------------------------------------------------------
  function sep() { return '<i class="tl-sep"></i>'; }
  D.bar = function () {
    var host = $('dkBar'); if (!host) return;
    if (!Wide.pc || !inEdit()) { host.innerHTML = ''; host.classList.remove('on'); return; }
    host.classList.add('on');
    var tbl = !!(window.Table && Table.cell()); Doc.inTable = tbl;
    host.innerHTML = '<div id="tlBody" class="tl-row dk-row">' + DocView.row('para', {}).replace('class="tl-chip on" data-act="e-style"', 'class="tl-chip st" data-act="e-style"') + sep() + DocView.row('text', {}) + sep()
      + ['i-pic:image:i.picture', 'i-table:table:i.table', 'i-brk:pagebreak:i.pagebreak'].map(function (x) { var p = x.split(':'); return '<button type="button" class="tl" data-act="' + p[0] + '" aria-label="' + esc(t(p[2])) + '" title="' + esc(t(p[2])) + '">' + ic(p[1], 22, 1.8) + '</button>'; }).join('')
      + (tbl ? sep() + DocView.row('table', {}) : '') + '</div>';
    Edit.sync();
  };
  D.chrome = function () {
    if (!Wide.pc) return; var bar = $('dkMenu'); if (!bar.firstChild || bar.dataset.l !== I18n.locale()) { bar.dataset.l = I18n.locale(); bar.innerHTML = M.names.map(function (n) { return '<button type="button" class="dk-m" data-mn="' + n + '" aria-haspopup="menu">' + esc(t('mu.' + n)) + '</button>'; }).join(''); }
    D.status();
  };
  var wt = 0;
  D.words = function () {
    var tx = Doc.paper().textContent || '', w = (tx.trim().match(/\S+/g) || []).length, c = tx.length, cs = tx.replace(/\s/g, '').length;
    Ui.sheet('words', '<h2 class="sh-h">' + esc(t('dk.words')) + '</h2>' + [['dk.w.words', w], ['dk.w.chars', c], ['dk.w.nospace', cs], ['dk.w.paras', Doc.paper().querySelectorAll('.b.ed').length]].map(function (r) { return '<div class="pr-row"><span>' + esc(t(r[0])) + '</span><b>' + r[1] + '</b></div>'; }).join('') + '<div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>');
  };
  D.status = function () {
    var s = $('dkStatus'); if (!s || !Wide.pc) return; var pg = Store.prefs().layout === 'page', w = Doc.words || 0, z = Math.round((Read.pz || 1) * 100);
    var pgs = window.Paginate && Paginate.active() ? '<span class="dk-pg" id="dkPage">' + esc(t('dk.page', { a: Paginate.at(), b: Paginate.pages })) + '</span>' : '';
    s.innerHTML = pgs + '<span class="dk-w" id="dkWords">' + esc(t('dk.wordsn', { n: w })) + '</span><span class="dk-fill"></span>'
      + '<div class="dc-lay dk-lay" role="group">' + [['fit', 'reflow', 'w.wrap'], ['page', 'pages', 'w.pages']].map(function (x) { var on = (x[0] === 'page') === pg; return '<button type="button" class="' + (on ? 'on' : '') + '" data-act="r-layout" data-k="' + x[0] + '" aria-pressed="' + on + '" title="' + esc(t(x[2])) + '">' + ic(x[1], 16, 1.8) + '</button>'; }).join('') + '</div>'
      + '<button type="button" class="dk-b sm" data-act="z-out" aria-label="−">' + ic('minus', 16, 2) + '</button><b class="dk-zv">' + z + '%</b><button type="button" class="dk-b sm" data-act="z-in" aria-label="+">' + ic('plus', 16, 2) + '</button><button type="button" class="dk-b wd" data-act="z-fit"><span>' + esc(t('w.fit')) + '</span></button>';
  };
  function counts() { clearTimeout(wt); wt = setTimeout(function () { if (!Wide.pc) return; Doc.words = (Doc.paper().textContent.trim().match(/\S+/g) || []).length; var e = $('dkWords'); if (e) e.textContent = t('dk.wordsn', { n: Doc.words }); }, 500); }

  // ---- wiring ----------------------------------------------------------------------------------------------------------------------------
  D.init = function () {
    var bar = $('dkMenu');
    bar.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-mn]'); if (b && has()) M.open(b); });
    bar.addEventListener('pointerover', function (e) { var b = e.target.closest('[data-mn]'); if (b && PopMenu.isOpen() && PopMenu.from && PopMenu.from !== b && PopMenu.from.dataset.mn) { PopMenu.close(); M.open(b); } });
    $('dkBar').addEventListener('pointerdown', function (e) { if (!e.target.closest('input')) e.preventDefault(); });
    $('dkStatus').addEventListener('pointerdown', function (e) { e.preventDefault(); });
    // the strip follows the mode and a caret that enters a table
    var chrome0 = Doc.chrome; Doc.chrome = function () { chrome0.apply(this, arguments); if (Wide.pc) { D.chrome(); D.bar(); } };
    var tb = null; document.addEventListener('selectionchange', function () { if (!Wide.pc || !inEdit()) return; var c = !!(window.Table && Table.cell()); if (c !== !!Doc.inTable) { clearTimeout(tb); tb = setTimeout(D.bar, 30); } });
    document.addEventListener('input', counts);
    var pgt = 0; function pgUpdate() { clearTimeout(pgt); pgt = setTimeout(function () { var e = $('dkPage'); if (e && window.Paginate && Paginate.active()) e.textContent = t('dk.page', { a: Paginate.at(), b: Paginate.pages }); }, 120); }
    document.addEventListener('selectionchange', pgUpdate); $('docBody').addEventListener('scroll', pgUpdate, { passive: true });
    // right click: the menu of the thing under the pointer
    Doc.paper().addEventListener('contextmenu', function (e) {
      if (!Wide.pc) return; e.preventDefault(); var e1 = inEdit(), td = e.target.closest && e.target.closest('.tbl td');
      var items = [it('q.cut', K + 'X', exec('cut'), { off: !e1 }), it('q.copy', K + 'C', exec('copy')), it('q.paste', K + 'V', function () { A['q-paste'](); }, { off: !e1 }), '-',
        it('f.bold', K + 'B', act('e-bold'), { off: !e1, on: e1 && q('bold') }), it('f.italic', K + 'I', act('e-italic'), { off: !e1, on: e1 && q('italic') }), it('f.underline', K + 'U', act('e-underline'), { off: !e1, on: e1 && q('underline') }), '-',
        it('i.link', K + 'K', act('e-link'), { off: !e1 })];
      if (td && e1) items = items.concat(['-', it('tb.rowa', '', act('t-rowa')), it('tb.rowb', '', act('t-rowb')), it('tb.cola', '', act('t-cola')), it('tb.colb', '', act('t-colb')), it('tb.delrow', '', act('t-delrow')), it('tb.delcol', '', act('t-delcol'))]);
      if (!e1) items = [it('q.copy', K + 'C', exec('copy')), it('dk.selall', K + 'A', function () { document.execCommand('selectAll'); }), '-', it('a.edit', '', act('d-edit'))];
      PopMenu.show(e.clientX, e.clientY, items);
    });
    Wide.on(function () { Doc.chrome && Doc.rec && Doc.chrome(); });
  };
  D.init();
})();
