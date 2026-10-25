// Mouse — what a mouse does on the grid: press to select, drag to select a block (the grid scrolls when the pointer reaches the edge), Shift + click to extend, double-click to edit, drag over the letters or numbers to select columns or rows, and, while a formula is being written, press to put the cell's address in it.
// A finger keeps its own way (tap, long press, handles) in grid-vm.js.
(function () {
  'use strict';
  var $ = Ui.$, G = window.Grid, M = window.Mouse = {}, drag = null, timer = 0, last = null;

  function at(e) {
    var sc = $('gScroll'), g = G.geo, fz = $('gFz'), inFz = fz.style.display !== 'none' && e.clientY < fz.getBoundingClientRect().bottom && e.clientY >= fz.getBoundingClientRect().top;
    var box = (inFz ? fz : sc).getBoundingClientRect(), x = e.clientX - box.left + sc.scrollLeft - GridView.hw(), y = e.clientY - box.top + (inFz ? 0 : sc.scrollTop + g.tops[g.fy]);
    if (x < 0) return null; var p = G.at(x, y); return p;
  }
  function stopAuto() { clearInterval(timer); timer = 0; }
  // the grid follows the pointer when it is held near an edge
  function auto(e) {
    var sc = $('gScroll'), box = sc.getBoundingClientRect(); stopAuto(); if (!drag) return;
    var dx = e.clientX > box.right - 24 ? 22 : e.clientX < box.left + 24 ? -22 : 0, dy = e.clientY > box.bottom - 24 ? 22 : e.clientY < box.top + 24 ? -22 : 0;
    if (!dx && !dy) return;
    timer = setInterval(function () { sc.scrollLeft += dx; sc.scrollTop += dy; var p = at(drag.ev); if (p) update(p); }, 40);
  }
  function update(p) {
    if (drag.mode === 'point') { if (p.r !== drag.pr || p.c !== drag.pc) { drag.pr = p.r; drag.pc = p.c; CellEdit.point(p.r, p.c, true); } return; }
    var a = drag.from, n = drag.mode === 'col' ? { r1: 0, c1: a.c, r2: G.geo.rows - 1, c2: p.c } : drag.mode === 'row' ? { r1: a.r, c1: 0, r2: p.r, c2: G.geo.cols - 1 } : { r1: a.r, c1: a.c, r2: p.r, c2: p.c };
    if (drag.moved && n.r1 === G.anc.r && n.c1 === G.anc.c && n.r2 === G.cur.r && n.c2 === G.cur.c) return;
    drag.moved = true; G.anc = { r: n.r1, c: n.c1 }; G.cur = { r: n.r2, c: n.c2 };
    G.sel = { r1: Math.min(n.r1, n.r2), c1: Math.min(n.c1, n.c2), r2: Math.max(n.r1, n.r2), c2: Math.max(n.c1, n.c2), whole: drag.mode === 'cell' ? '' : drag.mode };
    G.paintLight();
  }
  function down(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !G.geo || (window.Zoom && Zoom.hand()) || (e.target.closest && e.target.closest('.gsel i,.gquick,.rs,.ce,[data-act]:not(.gh)'))) return;
    var head = e.target.closest && e.target.closest('.gh'), p;
    if (head && !head.classList.contains('gh-corner')) { headDown(e, head); return; }
    if (head) { if (window.Keys) Keys.selectAll(); return; }
    p = at(e); if (!p) return;
    if (window.CellEdit && CellEdit.on) {
      if (CellEdit.pointing()) { e.preventDefault(); drag = { mode: 'point', pr: p.r, pc: p.c, ev: e }; CellEdit.point(p.r, p.c, e.shiftKey && !!CellEdit.pointStart()); capture(e); return; }
      G.commit(false, true);
    }
    var anchor = e.shiftKey && G.anc ? G.anc : { r: p.r, c: p.c };
    if (e.shiftKey && G.anc) { G.select(anchor.r, anchor.c, p.r, p.c); } else G.select(p.r, p.c);
    drag = { mode: 'cell', from: anchor, ev: e, moved: false }; capture(e);
    // keep the focus out of any text box left over from the phone's way of editing
    if (document.activeElement && document.activeElement.blur && document.activeElement.id === 'fbIn') document.activeElement.blur();
  }
  function headDown(e, head) {
    var isCol = !head.classList.contains('gr-h'), i = +(isCol ? head.dataset.c : head.dataset.r), g = G.geo; if (isNaN(i) || !head.dataset.act) return;
    if (window.CellEdit && CellEdit.on) G.commit(false);
    e.preventDefault(); var from = e.shiftKey && G.anc ? G.anc : { r: isCol ? 0 : i, c: isCol ? i : 0 };
    if (isCol) G.select(0, from.c, g.rows - 1, i, 'col'); else G.select(from.r, 0, i, g.cols - 1, 'row');
    drag = { mode: isCol ? 'col' : 'row', from: from, ev: e, moved: false }; capture(e); G.noHead = Date.now() + 350;
  }
  function capture(e) { try { $('gWrap').setPointerCapture(e.pointerId); } catch (x) { /* the pointer is gone */ } }
  function move(e) {
    if (!drag) return; drag.ev = e; var p = at(e); if (p) update(p); auto(e);
  }
  function up(e) {
    if (!drag) return; stopAuto(); var was = drag; drag = null; G.noTap = Date.now() + 350; try { $('gWrap').releasePointerCapture(e.pointerId); } catch (x) { /* ok */ }
    if (was.mode !== 'point') G.paint(true);
    if (was.mode !== 'point' && window.Fmt2 && Fmt2.painting()) Fmt2.drop();
    if (was.mode === 'point' && window.CellEdit) CellEdit.focus();
  }
  M.at = at;
  M.init = function () {
    var w = $('gWrap');
    w.addEventListener('pointerdown', down, true); w.addEventListener('pointermove', move); w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
    // a double click edits (the click event of a mouse press is ignored by the tap code: G.noTap)
    w.addEventListener('dblclick', function (e) {
      var grip = e.target.closest && e.target.closest('.rs'); if (grip && !Wb.readOnly) { e.preventDefault(); Resize.fit(grip.classList.contains('r') ? 'row' : 'col', +(grip.dataset.r !== undefined ? grip.dataset.r : grip.dataset.c)); return; }
      if (e.target.closest && e.target.closest('.gsel i.br') && window.Fill && Fill.desktop() && !Wb.readOnly) { Fill.auto(); return; }
      if (Wb.readOnly || e.pointerType === 'touch' || (e.target.closest && e.target.closest('.gh,.gsel i,[data-act]'))) return;
      var p = at(e); if (!p) return; if (p.r !== G.act().r || p.c !== G.act().c) G.select(p.r, p.c); G.edit();
    });
  };
})();
