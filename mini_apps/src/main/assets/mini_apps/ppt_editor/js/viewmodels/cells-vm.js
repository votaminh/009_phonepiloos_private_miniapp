// Cells — the cells of a table, picked with the mouse: a click picks one, a drag over the table picks a block (Shift + click stretches it); the picked block is drawn over the slide, with a small grip at the table's corner to move the table itself.
// Double click writes in the cell. What can be done with the picked cells (merge, split, rows, columns, sizes) is in the format panel (Insp.H 'tc-*', see insp-tbl-vm.js). The table is a box like the others when it is picked with the grip or from the slide strip.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, S = window.Stage, C = window.Cells = { sel: null }, drag = null;

  function table() { var n = Deck.sel && S.node(Deck.sel); return n && n.type === 'table' && Sel.count() === 1 ? n : null; }
  function pt(e) { var r = $('slideBox').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function at(n, p) { var x = p.x - n.box.x, y = p.y - n.box.y, f = null; (n.cells || []).forEach(function (c) { if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) f = c; }); return f; }
  // the block of the picked cells, grown so that a merged cell is never cut
  function grow(n, a, b) {
    var r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col), again = true;
    while (again) { again = false; (n.cells || []).forEach(function (c) { var rs = c.rowSpan || 1, cs = c.gridSpan || 1; if (c.row <= r2 && c.row + rs - 1 >= r1 && c.col <= c2 && c.col + cs - 1 >= c1) { if (c.row < r1) { r1 = c.row; again = true; } if (c.col < c1) { c1 = c.col; again = true; } if (c.row + rs - 1 > r2) { r2 = c.row + rs - 1; again = true; } if (c.col + cs - 1 > c2) { c2 = c.col + cs - 1; again = true; } } }); }
    return { r1: r1, c1: c1, r2: r2, c2: c2 };
  }
  C.valid = function () { var n = table(); if (!n || !C.sel || C.sel.id !== n.sourceId) { C.sel = null; return null; } return C.sel; };
  C.set = function (n, a, b) { C.sel = Object.assign({ id: n.sourceId }, grow(n, a, b || a)); C.draw(); if (window.Insp && Insp.host() && Quick.last) Insp.render(Quick.last); };
  C.clear = function () { C.sel = null; C.draw(); };

  // ---- drawn over the slide -----------------------------------------------------------------------------------------------------------------
  C.draw = function () {
    var old = $('cellSel'), n = table(); if (old) old.remove(); if (!n) return;
    var box = $('slideBox'), el = document.createElement('div'); el.id = 'cellSel'; el.innerHTML = '<i class="cl-grip" data-h="mv" title="' + Ui.esc(t('tc.move')) + '"></i>'; box.appendChild(el);
    el.style.cssText = 'left:' + n.box.x + 'px;top:' + n.box.y + 'px;width:' + n.box.w + 'px;height:' + n.box.h + 'px;transform:rotate(' + (n.box.rotationDeg || 0) + 'deg)';
    var s = C.valid(); if (!s) return; var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    (n.cells || []).forEach(function (c) { var rs = c.rowSpan || 1, cs = c.gridSpan || 1; if (c.row >= s.r1 && c.row + rs - 1 <= s.r2 && c.col >= s.c1 && c.col + cs - 1 <= s.c2) { x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y); x2 = Math.max(x2, c.x + c.w); y2 = Math.max(y2, c.y + c.h); } });
    if (x2 > x1) el.insertAdjacentHTML('beforeend', '<i class="cl-box" style="left:' + x1 + 'px;top:' + y1 + 'px;width:' + (x2 - x1) + 'px;height:' + (y2 - y1) + 'px"></i>');
  };

  // ---- the mouse ------------------------------------------------------------------------------------------------------------------------------
  // returns true when the press was taken (the mouse code does not move the table then)
  C.down = function (e, n) {
    if (!Wide.pc || n.type !== 'table') return false; var p = pt(e), c = at(n, p); if (!c) return false;
    if (Sel.count() !== 1 || Deck.sel !== n.sourceId) Sel.set([n.sourceId]);
    var first = (C.valid() && e.shiftKey) ? { row: C.sel.r1, col: C.sel.c1 } : c; C.set(n, first, c); drag = { n: n, a: first };
    function mv(ev) { var q = at(n, pt(ev)); if (q) C.set(n, drag.a, q); }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); drag = null; }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); return true;
  };

  // ---- writing in a cell ----------------------------------------------------------------------------------------------------------------------
  C.edit = async function (n, p) {
    var c = at(n, p); if (!c) return; C.set(n, c); var r; try { r = await Deck.read(n.sourceId); } catch (x) { return; }
    var txt = ((r.cells || [])[c.row] || [])[c.col] || '', box = $('slideBox'), old = $('cellEd'); if (old) old.remove();
    var ta = document.createElement('textarea'); ta.id = 'cellEd'; ta.value = txt; ta.spellcheck = true; ta.setAttribute('aria-label', t('tc.edit'));
    ta.style.cssText = 'left:' + (n.box.x + c.x) + 'px;top:' + (n.box.y + c.y) + 'px;width:' + c.w + 'px;height:' + c.h + 'px'; box.appendChild(ta); ta.focus(); ta.select();
    var done = false;
    function end(save) {
      if (done) return; done = true; var v = ta.value; ta.remove();
      if (save && v !== txt) Viewer.run([Deck.op('setTableCell', n.sourceId, { row: c.row, col: c.col, paragraphs: v ? v.split('\n').map(function (l) { return { runs: [{ text: l }] }; }) : [] })], 'busy.edit');
    }
    ta.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); end(false); } else if (e.key === 'Enter' && !e.altKey && !e.shiftKey) { e.preventDefault(); end(true); } else if (e.key === 'Tab') { e.preventDefault(); end(true); } e.stopPropagation(); });
    ta.addEventListener('blur', function () { end(true); }); ta.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  };
})();
