// Obj — pictures and charts on the grid: tap to select, drag to move, drag the corner square to resize, Delete to remove. Each change is written at once through the engine (the drawing anchor of the file)
// and the grid reads the drawings again. The engine refuses to delete a chart; that is told to the person.
(function () {
  'use strict';
  var t = Ui.t, G = window.Grid, sel = null, drag = null;
  function objOf(el) { var s = Xrich.sheets[Wb.sheets.indexOf(G.geo.sh)]; return s && s.objs[+el.dataset.k]; }
  function mark() { Array.prototype.forEach.call(document.querySelectorAll('.gobj-i'), function (e) { e.classList.toggle('sel', !!sel && +e.dataset.k === sel.k); }); }
  // a point of the object layer → the cell it falls in and the distance from that cell's corner, in EMU
  function anchorAt(x, y) {
    var g = G.geo, z = G.z || 1, gx = x - GridView.hw(), gy = y + g.tops[g.fy], p = G.at(gx, gy);
    return { row: p.r, col: p.c, rowOff: Math.max(0, Math.round((gy - g.tops[p.r]) / z * 9525)), colOff: Math.max(0, Math.round((gx - g.colX[p.c]) / z * 9525)) };
  }
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.gobj-i'); if (!el || !G.geo) { if (sel) { sel = null; mark(); } return; }
    var o = objOf(el); if (!o) return; sel = { k: +el.dataset.k, o: o }; mark(); if (Wb.readOnly || !o.dpath) return;
    drag = { el: el, mode: e.target.classList.contains('oh') ? 'size' : 'move', x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (x) { /* not captured */ }
    e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return; drag.moved = true;
    if (drag.mode === 'move') drag.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; else { drag.el.style.width = Math.max(30, drag.w + dx) + 'px'; drag.el.style.height = Math.max(30, drag.h + dy) + 'px'; }
  });
  async function apply(edit) {
    try { var out = await Book.flush({ visualEdits: [edit] }); if (out) { await Xrich.load(out.slice(0)); } Book.touch(); G.mount(); } catch (x) { Ui.toast(t(/chart/i.test(String(x && x.message)) ? 'ob.nochart' : 'ob.fail')); G.mount(); }
  }
  // sizes the cells have in the file itself (not on this screen), so a picture keeps its shape in Excel
  function sizes() { var x = Xrich.sheets[Wb.sheets.indexOf(G.geo.sh)], st = x && x.setup || {}; return { cw: function (c) { return (st.colPx && st.colPx[c]) || st.defW || 64; }, rh: function (r) { return (st.rowPx && st.rowPx[r]) || st.defH || 20; } }; }
  function spanPx(sz, a, b) {
    var w = -a.co / 9525 + b.co / 9525, h = -a.ro / 9525 + b.ro / 9525, c, r; for (c = a.c; c < b.c; c++) w += sz.cw(c); for (r = a.r; r < b.r; r++) h += sz.rh(r); return { w: w, h: h };
  }
  // the end of a span of w x h pixels that starts at `from` ({ c, co, r, ro } in EMU offsets)
  function walk(sz, from, w, h) {
    var c = from.c, co = from.co / 9525 + w, r = from.r, ro = from.ro / 9525 + h;
    while (co >= sz.cw(c) && c < 16000) { co -= sz.cw(c); c++; } while (ro >= sz.rh(r) && r < 1048000) { ro -= sz.rh(r); r++; }
    return { c: c, co: Math.round(co * 9525), r: r, ro: Math.round(ro * 9525) };
  }
  function wire(a, b) { return { fromRow: a.r, fromColumn: a.c, fromRowOffset: a.ro, fromColumnOffset: a.co, toRow: b.r, toColumn: b.c, toRowOffset: b.ro, toColumnOffset: b.co }; }
  document.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null; d.el.style.transform = ''; if (!d.moved) return; var o = sel && sel.o; if (!o) return;
    var sz = sizes(), dx = e.clientX - d.x, dy = e.clientY - d.y, from = o.a, b = o.b || { c: o.a.c, co: o.a.co + o.w * 9525, r: o.a.r, ro: o.a.ro + o.h * 9525 }, span = spanPx(sz, o.a, o.b || walk(sz, o.a, o.w, o.h)), a2, b2;
    if (d.mode === 'move') {
      var n = anchorAt(d.l + dx, d.t + dy); a2 = { c: n.col, co: Math.min(n.colOff, (sz.cw(n.col) - 1) * 9525), r: n.row, ro: Math.min(n.rowOff, (sz.rh(n.row) - 1) * 9525) }; b2 = walk(sz, a2, span.w, span.h);
    } else { a2 = from; b2 = walk(sz, from, span.w * Math.max(30, d.w + dx) / d.w, span.h * Math.max(30, d.h + dy) / d.h); }
    apply({ drawingPath: o.dpath, drawingIndex: o.dix, anchor: wire(a2, b2) }); sel = null;
  });
  document.addEventListener('keydown', function (e) {
    if (!sel || !sel.o.dpath || Wb.readOnly || (e.key !== 'Delete' && e.key !== 'Backspace') || G.editing) return; var a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
    e.preventDefault(); e.stopPropagation(); var o = sel.o; sel = null; apply({ drawingPath: o.dpath, drawingIndex: o.dix, remove: true });
  }, true);
})();
