// Resize — drag the right edge of a column letter, or the bottom edge of a row number, to make that column wider / row taller. The grid follows the finger; the size goes into the file at release.
(function () {
  'use strict';
  var $ = Ui.$, G = window.Grid, R = window.Resize = {};
  var MINW = 24, MAXW = 600, MINH = 24, MAXH = 400;

  // ---- live changes: only what depends on the size moves --------------------------------------------------------------------------
  function setCol(c, w) {
    var g = G.geo, old = g.colW(c), d = w - old, k; if (!d) return;
    g.sh.colW[c] = w / G.z; for (k = c + 1; k < g.colX.length; k++) g.colX[k] += d; g.width += d;
    Array.prototype.forEach.call(document.querySelectorAll('#gColIn .gh[data-c="' + c + '"],#gHost .gc[data-c="' + c + '"],#gFzIn .gc[data-c="' + c + '"]'), function (el) { el.style.width = w + 'px'; });
    Array.prototype.forEach.call(document.querySelectorAll('#gHost .gr,#gFzIn .gr'), function (el) { el.style.width = g.width + 'px'; });
    $('gHost').style.width = g.width + 'px'; $('gFzIn').style.width = g.width + 'px'; $('gColIn').style.width = g.width + 'px';
    G.place();
  }
  function setRow(r, h) {
    var g = G.geo, i; if (g.rowH(r) === h) return;
    g.sh.rowH[r] = h / G.z; for (i = r; i < g.rows; i++) g.tops[i + 1] = g.tops[i] + g.rowH(i);
    if (r < g.fy) {
      var el = $('gFzIn').children[r]; if (el) el.style.height = h + 'px';
      $('gFz').style.height = g.tops[g.fy] + 2 + 'px';
    } else if (G.list) G.list.relayout();
    G.place();
  }
  // the size is kept in the file as an op; a later drag of the same column / row replaces the earlier op
  function keep(kind, i, size) {
    var sh = G.geo.sh; sh.ops = sh.ops.filter(function (o) { return !(o.kind === kind && o.start === i && o.end === i); });
    sh.ops.push({ kind: kind, start: i, end: i, size: size });
  }

  // ---- the drag ---------------------------------------------------------------------------------------------------------------
  function begin(e) {
    var grip = e.target.closest && e.target.closest('.rs'); if (!grip || Wb.readOnly || !G.geo) return;
    e.preventDefault(); e.stopPropagation();
    var g = G.geo, sh = g.sh, isRow = grip.classList.contains('r'), i = +(isRow ? grip.dataset.r : grip.dataset.c), s = G.sel;
    var from = isRow ? (g.rowH(i) || 40) : (g.colW(i) || 88), x0 = e.clientX, y0 = e.clientY, size = from;
    // a whole row / column selection that contains the dragged one is resized together
    var lo = i, hi = i;
    if (isRow && s.whole === 'row' && i >= s.r1 && i <= s.r2) { lo = s.r1; hi = s.r2; } else if (!isRow && s.whole === 'col' && i >= s.c1 && i <= s.c2) { lo = s.c1; hi = s.c2; }
    var head = isRow ? document.querySelector('.gr-h[data-r="' + i + '"]') : document.querySelector('#gColIn .gh[data-c="' + i + '"]');
    grip.classList.add('on'); if (head) head.classList.add('rsz'); Motion.drag = true; document.body.style.userSelect = 'none';
    function move(ev) {
      size = Math.round(Math.max(isRow ? MINH : MINW, Math.min(isRow ? MAXH : MAXW, (from + (isRow ? ev.clientY - y0 : ev.clientX - x0)) / G.z)) * G.z);
      if (isRow) setRow(i, size); else setCol(i, size);
    }
    function up() {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      grip.classList.remove('on'); if (head) head.classList.remove('rsz'); Motion.drag = false; document.body.style.userSelect = ''; G.noHead = G.noTap = Date.now() + 350;
      var k; for (k = lo; k <= hi; k++) { if (k !== i) { if (isRow) setRow(k, size); else setCol(k, size); } }
      for (k = lo; k <= hi; k++) { var m = size / G.z; if (isRow) keep('set-row-size', k, Math.round(m / 1.333 * 10) / 10); else keep('set-col-size', k, Math.round((m - 5) / 7 * 10) / 10); }
      G.paint(true); Book.touch();
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  // fit to content (double click on the edge, or the menu): the widest text of the column / the tallest of the row, with a little air
  var cv = null;
  function textW(txt, st) { cv = cv || document.createElement('canvas').getContext('2d'); cv.font = (st.i ? 'italic ' : '') + (st.b ? '700 ' : '400 ') + Math.round((st.sz || 11) * 1.36) + 'px ' + Fonts.css(st.f || Fonts.def); return cv.measureText(txt).width; }
  R.fit = function (kind, index) {
    var sh = G.geo.sh, s = G.sel, isCol = kind === 'col', lo = index !== undefined ? index : (isCol ? s.c1 : s.r1), hi = index !== undefined ? index : (isCol ? s.c2 : s.r2), i, k, ext = isCol ? sh.rows : sh.cols;
    if (index !== undefined && (isCol ? (s.whole === 'col' && index >= s.c1 && index <= s.c2) : (s.whole === 'row' && index >= s.r1 && index <= s.r2))) { lo = isCol ? s.c1 : s.r1; hi = isCol ? s.c2 : s.r2; }
    for (i = lo; i <= hi; i++) {
      var best = 0;
      for (k = 0; k < ext; k++) {
        var r = isCol ? k : i, c = isCol ? i : k, cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell || Wb.mergeAt(sh, r, c)) continue;
        var st = Wb.style(sh, r, c), f = Fmt.cell(sh, r, c); if (f.t === '') continue;
        if (isCol) best = Math.max(best, textW(f.t, st) + 22);
        else { var lines = st.wrap ? Math.max(1, Math.ceil(textW(f.t, st) / Math.max(40, (sh.colW[c] || 88) - 16))) : 1; best = Math.max(best, lines * Math.round((st.sz || 11) * 1.36 * 1.25) + 12); }
      }
      var size = Math.max(isCol ? MINW : MINH, Math.min(isCol ? MAXW : MAXH, Math.round(best || (isCol ? 88 : 40)))), op = isCol ? 'set-col-size' : 'set-row-size', m = size;
      sh[isCol ? 'colW' : 'rowH'][i] = size; keep(op, i, isCol ? Math.round((m - 5) / 7 * 10) / 10 : Math.round(m / 1.333 * 10) / 10);
    }
    G.mount(); Book.touch();
  };
  R.init = function () {
    var wrap = $('gWrap');
    wrap.addEventListener('pointerdown', begin, true);
    // the click that ends a resize must not select the column / row under it
    wrap.addEventListener('click', function (e) { if (e.target.classList && e.target.classList.contains('rs')) { e.stopPropagation(); e.preventDefault(); } }, true);
  };
})();
