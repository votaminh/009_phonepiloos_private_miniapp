// ShapeDrag — pick a shape up with the mouse (or a finger) and drop it somewhere else: between two other blocks, left, centre or right. A shape is a block of the page, so "position" is where in the text it sits and how it is aligned.
(function () {
  'use strict';
  var st = null, line = null;
  function paperBlocks() { return Array.prototype.filter.call(Doc.paper().children, function (e) { return e.classList.contains('b') && !e.hidden && !e.classList.contains('sb'); }); }
  // the block under the pointer, and whether the drop goes above or below it
  function target(y, me) {
    var list = paperBlocks().filter(function (e) { return e !== me; }), best = null;
    list.forEach(function (e) { var r = e.getBoundingClientRect(); if (y >= r.top - 1 || !best) best = { el: e, after: y > r.top + r.height / 2, r: r }; });
    return best;
  }
  function zone(x) { var r = Doc.paper().getBoundingClientRect(), f = (x - r.left) / Math.max(1, r.width); return f < 0.34 ? 'left' : f > 0.66 ? 'right' : 'center'; }
  function mark(x, y) {
    var tg = target(y, st.el); if (!tg) return null;
    if (!line) { line = document.createElement('div'); line.className = 'shp-drop'; document.body.appendChild(line); }
    var pr = Doc.paper().getBoundingClientRect(); line.style.left = pr.left + 'px'; line.style.width = pr.width + 'px'; line.style.top = (tg.after ? tg.r.bottom : tg.r.top) + 'px'; return tg;
  }
  function end() { if (line) { line.remove(); line = null; } if (st && st.el) st.el.classList.remove('drag'); st = null; }
  document.addEventListener('pointerdown', function (e) {
    var el = Doc.mode === 'edit' && e.button === 0 && e.target.closest && e.target.closest('#paper .b.shp'); if (!el || !el.dataset.shp) return;
    st = { el: el, x: e.clientX, y: e.clientY, on: false };
  });
  document.addEventListener('pointermove', function (e) {
    if (!st) return;
    if (!st.on) { if (Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 8) return; st.on = true; st.el.classList.add('drag'); getSelection().removeAllRanges(); }
    e.preventDefault(); mark(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', function (e) {
    if (!st) return; var s = st; if (!s.on) { st = null; return; }
    var tg = target(e.clientY, s.el), al = zone(e.clientX), spec; end();
    if (!tg) return;
    try { spec = JSON.parse(s.el.dataset.shp); } catch (x) { return; }
    spec.al = al; var el = s.el;
    if (spec.cx) { var chg = {}; try { chg = JSON.parse(el.dataset.shpc || '{}'); } catch (x) { chg = {}; } chg.al = 1; el.dataset.shp = JSON.stringify(spec); el.dataset.shpc = JSON.stringify(chg); el.dataset.m = '1'; el.className = 'b lk shp' + Render.picCls(spec.wrap) + ' al-' + al; el.classList.remove('drag'); }
    else { el = Shape.block(spec); s.el.remove(); }
    if (tg.after) tg.el.after(el); else tg.el.before(el);
    Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0);
  });
  document.addEventListener('pointercancel', end);
})();
