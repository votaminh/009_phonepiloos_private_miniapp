// Rows — inserting and deleting rows and columns (the engine moves every formula, so the workbook is read back afterwards), hiding, sizes and frozen panes.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, RH = 40;
  function info() {
    var s = Grid.sel, g = Grid.geo, sh = g.sh;
    return { label: Format.label(), rowLabel: t(s.r1 === s.r2 ? 'rc.row' : 'rc.rows', { a: s.r1 + 1, b: s.r2 + 1 }), colLabel: t(s.c1 === s.c2 ? 'rc.col' : 'rc.cols', { a: SheetSvc.col(s.c1), b: SheetSvc.col(s.c2) }),
      rowHidden: !!sh.hidR[s.r1], colHidden: !!sh.hidC[s.c1], rh: Math.round(g.rowH(s.r1) || (sh.rowH[s.r1] || RH)), cw: Math.round(g.colW(s.c1) || (sh.colW[s.c1] || 88)), fx: sh.frozen.x ? 1 : 0, fy: sh.frozen.y ? 1 : 0 };
  }
  function show() { SheetsView.show('rows', SheetsView.rows(info())); }
  A['rc-open'] = function () { Ui.closeSheet(); show(); };

  // inserting / deleting moves cells, so it is applied at once and the workbook is read back from the engine
  async function shift(kind, index, count) {
    var sh = Grid.geo.sh, s = Grid.sel;
    try {
      await Book.shift(sh.name, [{ kind: kind, index: index, count: count }]);
      Grid.select(Math.min(s.r1, Grid.geo.rows - 1), Math.min(s.c1, Grid.geo.cols - 1));
    } catch (e) { App.fail('err.generic', e); }
    Ui.closeSheet();
  }
  A['rc-rowa'] = function () { var s = Grid.sel; shift('insert-rows', s.r1, s.r2 - s.r1 + 1); };
  A['rc-rowb'] = function () { var s = Grid.sel; shift('insert-rows', s.r2 + 1, s.r2 - s.r1 + 1); };
  A['rc-rowd'] = function () { var s = Grid.sel; shift('remove-rows', s.r1, s.r2 - s.r1 + 1); };
  A['rc-cola'] = function () { var s = Grid.sel; shift('insert-cols', s.c1, s.c2 - s.c1 + 1); };
  A['rc-colb'] = function () { var s = Grid.sel; shift('insert-cols', s.c2 + 1, s.c2 - s.c1 + 1); };
  A['rc-cold'] = function () { var s = Grid.sel; shift('remove-cols', s.c1, s.c2 - s.c1 + 1); };

  function after() { Grid.mount(); Book.touch(); show(); }
  function hide(rows) {
    var s = Grid.sel, sh = Grid.geo.sh, a = rows ? s.r1 : s.c1, b = rows ? s.r2 : s.c2, map = rows ? sh.hidR : sh.hidC, on = !map[a], i;
    for (i = a; i <= b; i++) { if (on) map[i] = 1; else delete map[i]; }
    sh.ops.push({ kind: rows ? 'set-rows-hidden' : 'set-cols-hidden', start: a, end: b, hidden: on }); after();
  }
  A['rc-rowh'] = function () { hide(true); }; A['rc-colh'] = function () { hide(false); };
  function size(rows, d) {
    var s = Grid.sel, sh = Grid.geo.sh, a = rows ? s.r1 : s.c1, b = rows ? s.r2 : s.c2, g = Grid.geo, now = rows ? (sh.rowH[a] || RH) : (sh.colW[a] || 88), px = Math.max(rows ? 24 : 24, Math.min(rows ? 400 : 400, now + d)), i;
    for (i = a; i <= b; i++) (rows ? sh.rowH : sh.colW)[i] = px;
    sh.ops.push({ kind: rows ? 'set-row-size' : 'set-col-size', start: a, end: b, size: rows ? Math.round(px / 1.333 * 10) / 10 : Math.round((px - 5) / 7 * 10) / 10 }); after();
  }
  A['rc-rh-inc'] = function () { size(true, 6); }; A['rc-rh-dec'] = function () { size(true, -6); };
  A['rc-cw-inc'] = function () { size(false, 12); }; A['rc-cw-dec'] = function () { size(false, -12); };

  // frozen panes: up to the selected row / column
  function freeze(rows) {
    var sh = Grid.geo.sh, s = Grid.sel, f = sh.frozen;
    if (rows) f.y = f.y ? 0 : s.r1 + 1; else f.x = f.x ? 0 : s.c1 + 1;
    sh.freezeDirty = true; after();
  }
  A['rc-fz-row'] = function () { freeze(true); }; A['rc-fz-col'] = function () { freeze(false); };
  A['rc-freeze'] = function () { var f = Grid.geo.sh.frozen; if (f.y || f.x) { f.x = f.y = 0; Grid.geo.sh.freezeDirty = true; Grid.mount(); Book.touch(); Ui.toast(t('rc.unfroze')); } else { f.y = 1; Grid.geo.sh.freezeDirty = true; Grid.mount(); Book.touch(); Ui.toast(t('rc.froze')); } };
})();
