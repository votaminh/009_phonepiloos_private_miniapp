// Insp, the table controls: what the picked cells (Cells) can do — rows and columns around them, merge and split, a row's height and a column's width, vertical place — and the table's style and its parts (header row, banding).
// Every control is one op or a few in one go (the engine takes them together, or none).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, I = window.Insp, H = I.H, N = I.N;
  function id() { return Deck.sel; }
  function sel() { return window.Cells && Cells.valid(); }
  function run(ops) { return Viewer.run(ops, 'busy.edit'); }
  // the engine makes a table anew when it merges or adds rows, and the table gets another id: ops on one table go one at a time, each with the id the table has by then
  async function seq(items) {
    var n0 = Stage.node(id()); if (!n0) return false; var cx = n0.box.centerX, cy = n0.box.centerY, keep = Cells.sel && Cells.sel.id === id() ? Cells.sel : null;
    for (var i = 0; i < items.length; i++) {
      var r = await Viewer.run([Deck.op(items[i].op, Deck.sel, items[i].p)], 'busy.edit'); if (!r) return false;
      var best = null; Stage.tree.nodes.forEach(function (n) { if (n.type === 'table') { var d = Math.hypot(n.box.centerX - cx, n.box.centerY - cy); if (!best || d < best.d) best = { d: d, id: n.sourceId }; } });
      if (best && best.id !== Deck.sel) { Deck.sel = best.id; if (keep) keep.id = best.id; }
    }
    Stage.select(Deck.sel); if (keep) { Cells.sel = keep; Cells.draw(); } return true;
  }
  function so(kind, index, before) { return { op: 'tableStructure', p: { kind: kind, index: index, before: !!before } }; }
  function struct(kind, index, before) { return Deck.op('tableStructure', id(), { kind: kind, index: index, before: !!before }); }
  function bad(why) { Ui.toast(t(why)); }
  function hasMerge() { var n = Stage.node(id()); return !!(n && (n.cells || []).some(function (c) { return (c.rowSpan || 1) > 1 || (c.gridSpan || 1) > 1 || c.vMerge || c.hMerge; })); }

  H['tc-ra'] = function () { var s = sel(); if (!s) return; if (hasMerge()) return bad('tc.merged'); var l = []; for (var k = s.r1; k <= s.r2; k++) l.push(so('insert-row', s.r1, true)); Cells.clear(); seq(l); };
  H['tc-rb'] = function () { var s = sel(); if (!s) return; if (hasMerge()) return bad('tc.merged'); var l = []; for (var k = s.r1; k <= s.r2; k++) l.push(so('insert-row', s.r2, false)); Cells.clear(); seq(l); };
  H['tc-cl'] = function () { var s = sel(); if (!s) return; if (hasMerge()) return bad('tc.merged'); var l = []; for (var k = s.c1; k <= s.c2; k++) l.push(so('insert-col', s.c1, true)); Cells.clear(); seq(l); };
  H['tc-cr'] = function () { var s = sel(); if (!s) return; if (hasMerge()) return bad('tc.merged'); var l = []; for (var k = s.c1; k <= s.c2; k++) l.push(so('insert-col', s.c2, false)); Cells.clear(); seq(l); };
  H['tc-rd'] = function () { var s = sel(), q = Quick.last; if (!s || !q) return; if (hasMerge()) return bad('tc.merged'); if (s.r2 - s.r1 + 1 >= q.rows) return bad('tb.keep'); var l = []; for (var k = s.r2; k >= s.r1; k--) l.push(so('delete-row', k)); Cells.clear(); seq(l); };
  H['tc-cd'] = function () { var s = sel(), q = Quick.last; if (!s || !q) return; if (hasMerge()) return bad('tc.merged'); if (s.c2 - s.c1 + 1 >= q.cols) return bad('tb.keep'); var l = []; for (var k = s.c2; k >= s.c1; k--) l.push(so('delete-col', k)); Cells.clear(); seq(l); };
  // a block becomes one cell: each row joins its cells to the right, then the first column joins downwards
  // the engine joins cells in a line (along a row or down a column); a block of both is not offered
  H['tc-merge'] = function () {
    var s = sel(); if (!s) return; if (s.r1 === s.r2 && s.c1 === s.c2) return bad('tc.two'); if (s.r1 !== s.r2 && s.c1 !== s.c2) return bad('tc.line'); var l = [], k;
    if (s.r1 === s.r2) for (k = s.c1; k < s.c2; k++) l.push({ op: 'tableMerge', p: { kind: 'merge-right', row: s.r1, col: s.c1 } });
    else for (k = s.r1; k < s.r2; k++) l.push({ op: 'tableMerge', p: { kind: 'merge-down', row: s.r1, col: s.c1 } });
    seq(l);
  };
  H['tc-split'] = function () { var s = sel(); if (!s) return; seq([{ op: 'tableMerge', p: { kind: 'split', row: s.r1, col: s.c1 } }]); };
  H['tc-anc'] = function (b) { var s = sel(); if (!s) return; var ops = []; for (var r = s.r1; r <= s.r2; r++) for (var c = s.c1; c <= s.c2; c++) ops.push(Deck.op('setTableCellAnchor', id(), { row: r, col: c, anchor: b.dataset.v })); run(ops); };
  N['tc-h'] = function (v) { var s = sel(); if (!s || v <= 0) return; var ops = [], f = I.unit().f; for (var r = s.r1; r <= s.r2; r++) ops.push(Deck.op('setTableRowHeight', id(), { row: r, hEmu: Math.round(v * f) })); run(ops); };
  N['tc-w'] = function (v) { var s = sel(); if (!s || v <= 0) return; var ops = [], f = I.unit().f; for (var c = s.c1; c <= s.c2; c++) ops.push(Deck.op('setTableColWidth', id(), { col: c, wEmu: Math.round(v * f) })); run(ops); };
  H['tc-style'] = function (b) { var r = b.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, InspView.TSTYLES.map(function (n) { return { t: n, go: function () { var fl = ((Quick.last.more || {}).tableStyle || {}).flags || {}; seq([{ op: 'setTableStyle', p: { styleId: n, firstRow: fl.firstRow !== false, bandRow: fl.bandRow !== false } }]); } }; }), { from: b }); };
  H['tc-flag'] = function (b) { var fl = ((Quick.last.more || {}).tableStyle || {}).flags || {}, k = b.dataset.v, p = {}; p[k] = !fl[k]; seq([{ op: 'setTableStyle', p: p }]); };
  // the sizes shown for the picked cells
  I.tableSizes = function (s) {
    var n = s.tnode, c = s.cell; if (!n || !c || !n.cells) return; var k = Deck.k(), f = s.u.f, row = n.cells.filter(function (x) { return x.row === c.r1 && x.col === 0; })[0] || n.cells.filter(function (x) { return x.row === c.r1; })[0], col = n.cells.filter(function (x) { return x.col === c.c1 && x.row === 0; })[0] || n.cells.filter(function (x) { return x.col === c.c1; })[0];
    if (row) s.th = Math.round(row.h * k / f * 100) / 100; if (col) s.tw = Math.round(col.w * k / f * 100) / 100;
  };
})();
