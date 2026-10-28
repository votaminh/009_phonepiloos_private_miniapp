// TableFmt — a table's borders and shading: of the selected cells (or the cell the caret is in), or of the whole table. Split from table-vm.js (the package check allows 20 KB a file); it uses what that file shares in Table.h.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, H = Table.h, cell = Table.cell, blockOf = H.blockOf, pos = H.pos, addOp = H.addOp, cellsOf = H.cellsOf;
  // borders of the selected cells (or the cell the caret is in): all, outside, none, one side — or of the whole table
  var SIDE = { t: 'borderTop', b: 'borderBottom', l: 'borderLeft', r: 'borderRight' };
  function setBorders(td, sides, style) {
    var b = blockOf(td), p = pos(td); addOp(b, { op: 'border', r: p.r, c: p.c, sides: sides, style: style }); td.dataset.m = '1';
    sides.split('').forEach(function (s) { td.style[SIDE[s]] = style === 'nil' ? 'none' : '1px solid ' + C('paper_ink'); });
  }
  A['t-borders'] = function (el) {
    var r = el.getBoundingClientRect(), td0 = cell() || (Table.selection() ? cellsOf(Table.selection())[0] : null); if (!td0) return Ui.toast(t('e.tap'));
    var sel = Table.selection(), cells = sel ? cellsOf(sel).filter(function (x) { return !x.hidden; }) : [td0], b = blockOf(td0), all = Array.prototype.slice.call(b.querySelectorAll('td')).filter(function (x) { return !x.hidden; });
    function apply(list, fn) { list.forEach(function (x) { var s = fn(x); if (s.sides) setBorders(x, s.sides, s.style); }); Doc.snap(); Edit.sync(); }
    function outside(x) { var p = pos(x), q = sel || { r0: p.r, r1: p.r, c0: p.c, c1: p.c }, s = ''; if (p.r === q.r0) s += 't'; if (p.r === q.r1) s += 'b'; if (p.c === q.c0) s += 'l'; if (p.c === q.c1) s += 'r'; return { sides: s, style: 'single' }; }
    PopMenu.show(r.left, r.bottom + 2, [
      { t: t('bd.all'), go: function () { apply(cells, function () { return { sides: 'tblr', style: 'single' }; }); } },
      { t: t('bd.outside'), go: function () { apply(cells, outside); } },
      { t: t('bd.none'), go: function () { apply(cells, function () { return { sides: 'tblr', style: 'nil' }; }); } }, '-',
      { t: t('bd.top'), go: function () { apply(cells, function (x) { return { sides: pos(x).r === (sel ? sel.r0 : pos(x).r) ? 't' : '', style: 'single' }; }); } },
      { t: t('bd.bottom'), go: function () { apply(cells, function (x) { return { sides: pos(x).r === (sel ? sel.r1 : pos(x).r) ? 'b' : '', style: 'single' }; }); } }, '-',
      { t: t('bd.tableall'), go: function () { apply(all, function () { return { sides: 'tblr', style: 'single' }; }); } },
      { t: t('bd.tablenone'), go: function () { apply(all, function () { return { sides: 'tblr', style: 'nil' }; }); } }], { from: el });
  };
  var SHADES = ['hl_yellow', 'hl_green', 'hl_pink', 'hl_blue', 'chip', 'accent_soft', 'warn_soft'];
  A['t-shade'] = function (el) {
    Doc.range = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : Doc.range;
    Edit.pop(SHADES.map(function (k) { return '<button type="button" class="pop-sw" style="background:' + C(k) + '" data-act="t-setshade" data-k="' + k + '" aria-label="' + k + '"></button>'; }).join('') + '<button type="button" class="pop-sw none" data-act="t-setshade" data-k="" aria-label="' + Ui.esc(t('f.nohl')) + '">' + Ui.ic('close', 16, 2.4) + '</button>', el, 'sw');
  };
  A['t-setshade'] = function (el) {
    var td = cell() || (Doc.range && (Doc.range.startContainer.nodeType === 3 ? Doc.range.startContainer.parentElement : Doc.range.startContainer).closest('.tbl td')); Edit.hidePops(); if (!td && Table.selection()) td = cellsOf(Table.selection())[0]; if (!td) return Ui.toast(t('e.tap'));
    var hex = el.dataset.k ? C(el.dataset.k).replace('#', '').toUpperCase() : '', b = blockOf(td), sel = Table.selection(), list = sel ? cellsOf(sel).filter(function (x) { return !x.hidden; }) : [td];
    list.forEach(function (x) { var p = pos(x); addOp(b, { op: 'shade', r: p.r, c: p.c, fill: hex }); x.style.background = hex ? '#' + hex : ''; x.dataset.m = '1'; }); Doc.snap(); Edit.sync();
  };
})();
