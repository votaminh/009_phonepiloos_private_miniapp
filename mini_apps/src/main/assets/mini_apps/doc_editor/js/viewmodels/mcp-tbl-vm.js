// McpTbl — the agent tools for tables: rows, columns, merging, shading, alignment, the whole table. They put the caret in a cell and call the table
// actions the buttons call, so the table is also marked for saving. A table whose columns were dragged or whose cells were merged is locked for row and column changes.
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc, A = App.acts;
  if (!M || !D) return;

  function cellOf(a) {
    var tb = D.at(a.table, 'table'), tr = tb.querySelectorAll('tr')[a.row || 0], td = tr && tr.children[a.col || 0];
    if (!td) throw new Error('no_cell:' + (a.row || 0) + ',' + (a.col || 0));
    return { tb: tb, td: td };
  }
  function into(td) { var r = document.createRange(), s = getSelection(); if (window.Surface) Surface.focus(); r.selectNodeContents(td); r.collapse(true); s.removeAllRanges(); s.addRange(r); Doc.range = r.cloneRange(); }
  function locked(tb) { if (tb.dataset.simple !== '1') throw new Error('table_locked: columns were resized or cells merged, so rows and columns cannot be added or removed here'); }
  function dims(tb) { return { rows: tb.querySelectorAll('tr').length, cols: tb.querySelector('tr') ? tb.querySelector('tr').children.length : 0 }; }
  function shape(tb) { var d = dims(tb); return d.rows + 'x' + d.cols; }

  M.tool('doc_table_add_row', function (a) {
    D.ready(); var c = cellOf({ table: a.table, row: a.row, col: 0 }); locked(c.tb); into(c.td);
    A[a.position === 'above' ? 't-rowa' : 't-rowb'](); return { summary: 'Table is now ' + shape(c.tb), data: dims(c.tb) };
  });
  M.tool('doc_table_add_column', function (a) {
    D.ready(); var c = cellOf({ table: a.table, row: 0, col: a.col }); locked(c.tb); into(c.td);
    A[a.position === 'left' ? 't-cola' : 't-colb'](); return { summary: 'Table is now ' + shape(c.tb), data: dims(c.tb) };
  });
  M.tool('doc_table_delete_row', function (a) {
    D.ready(); var c = cellOf({ table: a.table, row: a.row, col: 0 }); locked(c.tb); into(c.td); A['t-delrow'](); return { summary: 'Table is now ' + shape(c.tb), data: dims(c.tb) };
  });
  M.tool('doc_table_delete_column', function (a) {
    D.ready(); var c = cellOf({ table: a.table, row: 0, col: a.col }); locked(c.tb); into(c.td); A['t-delcol'](); return { summary: 'Table is now ' + shape(c.tb), data: dims(c.tb) };
  });
  M.tool('doc_table_delete', function (a) {
    D.ready(); var c = cellOf({ table: a.table, row: 0, col: 0 }); into(c.td); A['t-deltable'](); return { summary: 'Deleted table ' + a.table, data: null };
  });

  M.tool('doc_table_merge_cells', function (a) {
    D.ready(); var c = cellOf(a), right = a.right || 0, down = a.down || 0, k;
    for (k = 0; k < right; k++) { into(c.td); A['t-merge'](); }
    for (k = 0; k < down; k++) { into(c.td); A['t-vmerge'](); }
    return { summary: 'Merged ' + (right + 1) + ' column(s) by ' + (down + 1) + ' row(s) from cell (' + (a.row || 0) + ',' + (a.col || 0) + ')', data: null };
  });
  M.tool('doc_table_split_cell', function (a) { D.ready(); var c = cellOf(a); into(c.td); A['t-split'](); return { summary: 'Split cell (' + (a.row || 0) + ',' + (a.col || 0) + ')', data: null }; });

  M.tool('doc_table_shade_cell', function (a) {
    D.ready(); var c = cellOf(a), H = Table.h, fill = a.color === 'none' ? '' : String(a.color).replace('#', '').toUpperCase();
    if (fill && !/^[0-9A-F]{6}$/.test(fill)) throw new Error('bad_color:' + a.color + ' (use RRGGBB or "none")');
    var tr = c.td.parentElement, r = Array.prototype.indexOf.call(tr.parentElement.children, tr), k = Array.prototype.indexOf.call(tr.children, c.td);
    H.addOp(c.tb, { op: 'shade', r: r, c: k, fill: fill }); c.td.style.background = fill ? '#' + fill : ''; c.td.dataset.m = '1'; c.tb.dataset.m = '1'; Doc.snap(); Edit.sync();
    return { summary: 'Cell (' + r + ',' + k + ') ' + (fill ? 'shaded #' + fill : 'unshaded'), data: null };
  });

  M.tool('doc_table_align_cell', function (a) {
    D.ready(); var c = cellOf(a); c.td.style.textAlign = a.align === 'left' ? '' : a.align; c.td.dataset.m = '1'; c.tb.dataset.m = '1'; Doc.snap(); Edit.sync();
    return { summary: 'Cell (' + (a.row || 0) + ',' + (a.col || 0) + ') aligned ' + a.align, data: null };
  });

  M.tool('doc_table_move', function (a) {
    D.ready(); var tb = D.at(a.table, 'table'), list = D.blocks(), to = Math.max(0, Math.min(list.length - 1, a.to)), ref = list[to];
    if (ref === tb) return { summary: 'Table already at ' + to, data: null };
    to > a.table ? ref.after(tb) : ref.before(tb); D.done(tb); return { summary: 'Moved the table to index ' + D.blocks().indexOf(tb), data: { index: D.blocks().indexOf(tb) } };
  });
})();
