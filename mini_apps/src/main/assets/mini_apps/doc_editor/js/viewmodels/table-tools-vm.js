// TableTools — what sits around a table, as in Word: the handle at its top-left corner that moves the whole table (drag it between the other blocks),
// and the "+" that shows on the border between two rows (left edge) or two columns (top edge) while the mouse is over it and adds one there.
(function () {
  'use strict';
  var t = Ui.t, H = Table.h, mv = null, plus = null, line = null, drop = null, drag = null, hint = null, last = null;
  var ARROWS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';
  function mk(cls, html) { var d = document.createElement('div'); d.className = cls; d.hidden = true; if (html) d.innerHTML = html; document.body.appendChild(d); return d; }
  function ensure() {
    if (mv) return;
    mv = mk('tmove', ARROWS); mv.setAttribute('role', 'button'); mv.setAttribute('aria-label', t('tb.move'));
    plus = mk('tplus', '+'); plus.setAttribute('role', 'button'); line = mk('tline'); drop = mk('tdrop');
    mv.addEventListener('pointerdown', startDrag);
    plus.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); });   // the page keeps its caret and its selection of cells
    plus.addEventListener('click', function () { if (hint) add(hint); });
  }
  function hideAll() { if (!mv) return; mv.hidden = plus.hidden = line.hidden = true; hint = null; }
  function plain(b) { return b.dataset.simple === '1' && H.plainTable(b); }
  function near(x, y) {
    var tbs = Doc.paper().querySelectorAll('.b.tbl'), M = 28;
    for (var i = 0; i < tbs.length; i++) { var r = tbs[i].getBoundingClientRect(); if (x >= r.left - M && x <= r.right + M && y >= r.top - M && y <= r.bottom + M) return tbs[i]; }
    return null;
  }

  // ---- where things go -----------------------------------------------------------------------------------------------------------
  function placeMove(b) {
    var r = b.getBoundingClientRect(), vis = document.getElementById('docBody').getBoundingClientRect();
    if (r.bottom < vis.top || r.top > vis.bottom) { mv.hidden = true; return; }
    mv.style.left = Math.max(vis.left + 2, r.left - 26) + 'px'; mv.style.top = Math.max(vis.top + 2, r.top - 26) + 'px'; mv.hidden = false;
  }
  // the border under the pointer: { b, kind: 'row'|'col', k } — k is the place the new row or column will take
  function borderAt(b, x, y) {
    var r = b.getBoundingClientRect(), Z = 10, i;
    if (x >= r.left - 18 && x <= r.left + 14) {
      var rows = b.querySelectorAll('tr');
      for (i = 0; i <= rows.length; i++) { var yy = i < rows.length ? rows[i].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom; if (Math.abs(y - yy) <= Z) return { b: b, kind: 'row', k: i, x: r.left, y: yy, len: r.width }; }
    }
    if (y >= r.top - 18 && y <= r.top + 14) {
      var cells = b.querySelector('tr').children;
      for (i = 0; i <= cells.length; i++) { var xx = i < cells.length ? cells[i].getBoundingClientRect().left : cells[cells.length - 1].getBoundingClientRect().right; if (Math.abs(x - xx) <= Z) return { b: b, kind: 'col', k: i, x: xx, y: r.top, len: r.height }; }
    }
    return null;
  }
  function placeHint(h) {
    hint = h; plus.hidden = line.hidden = false; plus.setAttribute('aria-label', t(h.kind === 'row' ? 'tb.addrow' : 'tb.addcol'));
    if (h.kind === 'row') { plus.style.left = (h.x - 22) + 'px'; plus.style.top = (h.y - 10) + 'px'; line.style.left = h.x + 'px'; line.style.top = (h.y - 1) + 'px'; line.style.width = h.len + 'px'; line.style.height = '2px'; }
    else { plus.style.left = (h.x - 10) + 'px'; plus.style.top = (h.y - 22) + 'px'; line.style.left = (h.x - 1) + 'px'; line.style.top = h.y + 'px'; line.style.width = '2px'; line.style.height = h.len + 'px'; }
  }
  function refresh(e) {
    if (Doc.mode !== 'edit' || drag) { if (!drag) hideAll(); return; }
    ensure();
    if (e && (e.target === plus || e.target === mv)) return;
    var b = e && !e.buttons ? near(e.clientX, e.clientY) : null, td = window.Table && Table.cell(), mouse = e && e.pointerType === 'mouse';
    if (!b && td) b = H.blockOf(td);   // the caret in a table keeps its handle (the only way to it on a touch screen)
    if (!b) { hideAll(); return; }
    last = b; placeMove(b);
    var h = mouse && !e.buttons && plain(b) ? borderAt(b, e.clientX, e.clientY) : null;
    if (h) placeHint(h); else { plus.hidden = line.hidden = true; hint = null; }
  }
  document.addEventListener('pointermove', refresh);
  document.addEventListener('selectionchange', function () { if (!drag) refresh(null); });
  document.addEventListener('scroll', function () { if (!drag) refresh(null); }, true);
  window.addEventListener('resize', function () { if (!drag) refresh(null); });
  document.documentElement.addEventListener('pointerleave', function () { if (!drag && plus) { plus.hidden = line.hidden = true; hint = null; } });   // the pointer left the window (not a child: that one is the way onto the +)

  // ---- Tab in a cell: on to the next cell (Shift+Tab: back); Tab in the last cell adds a row, as in Word ------------------------------------------------
  function goCell(td) {
    var r = document.createRange(), s = getSelection(); r.selectNodeContents(td); s.removeAllRanges(); s.addRange(r); Doc.range = r.cloneRange(); td.scrollIntoView({ block: 'nearest' }); Edit.sync();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || Doc.mode !== 'edit' || e.ctrlKey || e.metaKey || e.altKey) return;
    var td = window.Table && Table.cell(); if (!td) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var b = H.blockOf(td), list = function () { return Array.prototype.filter.call(b.querySelectorAll('td'), function (c) { return !c.hidden; }); }, cells = list(), i = cells.indexOf(td), to = cells[e.shiftKey ? i - 1 : i + 1];
    if (!to && !e.shiftKey && b.dataset.simple === '1') { App.acts['t-rowb'](); cells = list(); to = cells[cells.indexOf(td) + 1]; }   // the last cell: a row below, then its first cell
    if (to) goCell(to);
  }, true);

  // ---- the + : one row or column on that border ---------------------------------------------------------------------------------
  function add(h) {
    var b = h.b, ops, nw;
    if (b.dataset.simple !== '1') return Ui.toast(t('e.lock'));
    if (h.kind === 'row') {
      var trs = b.querySelectorAll('tr'), n = trs.length, ref = h.k < n ? trs[h.k] : trs[n - 1], before = h.k < n;
      H.addOp(b, { op: 'row+', at: Array.prototype.indexOf.call(ref.parentElement.children, ref), before: before });
      nw = document.createElement('tr'); nw.innerHTML = H.fresh(ref.children.length); Array.prototype.forEach.call(nw.children, function (c) { c.contentEditable = 'true'; });
      before ? ref.before(nw) : ref.after(nw);
    } else {
      var cols = b.querySelector('tr').children.length, at = h.k < cols ? h.k : cols - 1, bf = h.k < cols;
      H.addOp(b, { op: 'col+', at: at, before: bf });
      Array.prototype.forEach.call(b.querySelectorAll('tr'), function (r) { var c = document.createElement('td'); c.dataset.new = '1'; c.contentEditable = 'true'; c.innerHTML = '<br data-ph>'; var rf = r.children[at]; bf ? rf.before(c) : rf.after(c); });
    }
    hideAll(); Doc.snap(); Edit.sync();
  }

  // ---- the handle : drag the whole table to another place between the blocks --------------------------------------------------
  function blocks(b) { return Array.prototype.filter.call(Doc.paper().children, function (c) { return c.classList.contains('b') && c !== b && !c.hidden; }); }
  // the block the table would go in front of (null = after the last one) and the y of that gap
  function gap(b, y) {
    var list = blocks(b), i, r;
    for (i = 0; i < list.length; i++) { r = list[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return { ref: list[i], y: r.top }; }
    return { ref: null, y: list.length ? list[list.length - 1].getBoundingClientRect().bottom : 0 };
  }
  function startDrag(e) {
    if (e.button !== 0 || !last) return; e.preventDefault(); e.stopPropagation();
    var b = last, pr = Doc.paper().getBoundingClientRect(); drag = { b: b, ref: undefined };
    drop.style.left = pr.left + 'px'; drop.style.width = pr.width + 'px'; plus.hidden = line.hidden = true; b.classList.add('moving');
    try { mv.setPointerCapture(e.pointerId); } catch (x) { /* the pointer is already gone */ }
    mv.addEventListener('pointermove', onDrag); mv.addEventListener('pointerup', endDrag); mv.addEventListener('pointercancel', endDrag);
    onDrag(e);
  }
  function onDrag(e) {
    if (!drag) return; var body = document.getElementById('docBody'), v = body.getBoundingClientRect();
    if (e.clientY < v.top + 40) body.scrollTop -= 14; else if (e.clientY > v.bottom - 40) body.scrollTop += 14;   // near the edge the page scrolls under the pointer
    var g = gap(drag.b, e.clientY); drag.ref = g.ref; drop.style.top = (g.y - 1) + 'px'; drop.hidden = false;
    mv.style.left = (e.clientX - 11) + 'px'; mv.style.top = (e.clientY - 11) + 'px';
  }
  function endDrag(e) {
    if (!drag) return; var d = drag; drag = null;
    mv.removeEventListener('pointermove', onDrag); mv.removeEventListener('pointerup', endDrag); mv.removeEventListener('pointercancel', endDrag);
    try { mv.releasePointerCapture(e.pointerId); } catch (x) { /* released already */ }
    drop.hidden = true; d.b.classList.remove('moving');
    var list = blocks(d.b), all = Array.prototype.filter.call(Doc.paper().children, function (c) { return c.classList.contains('b') && !c.hidden; }), at = all.indexOf(d.b);
    var moved = e.type === 'pointerup' && list.length && (d.ref ? all[at + 1] !== d.ref : at !== all.length - 1);
    if (moved) {
      if (d.ref) d.ref.before(d.b); else list[list.length - 1].after(d.b);
      var f = d.b.querySelector('td'); if (f) { var r = document.createRange(), s = getSelection(); r.selectNodeContents(f); r.collapse(true); s.removeAllRanges(); s.addRange(r); Doc.range = r.cloneRange(); }
      Doc.snap(); Edit.sync();
    }
    refresh(null);
  }
})();
