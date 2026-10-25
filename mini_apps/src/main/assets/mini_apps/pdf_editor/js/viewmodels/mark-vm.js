// Mark — marking up the pages: highlight, underline, strike (tap a line, or drag along it), the pen, notes; and redaction (mark lines or areas, then apply for good).
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var M = window.Mark = { tool: 'highlight', color: C('hl_yellow'), marks: [], area: false };
  function rgba(h) { h = String(h).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]; }
  M.clear = function () { M.marks = []; };

  // ---- redaction marks, drawn over their pages -------------------------------------------------------------------------------------
  Read.layers.push(function (ov, i) {
    if (Read.mode !== 'redact') return;
    ov.insertAdjacentHTML('beforeend', M.marks.map(function (m, k) { if (m.page !== i) return ''; var b = Read.box(i, m.rect); return '<i class="mk" data-act="x-gone" data-k="' + k + '" style="left:' + b.l + 'px;top:' + b.t + 'px;width:' + b.w + 'px;height:' + b.h + 'px"></i>'; }).join(''));
  });

  // ---- the finger ----------------------------------------------------------------------------------------------------------------
  var g = null;
  function kind() { return Read.mode === 'redact' ? (M.area ? 'area' : 'text') : Read.mode === 'annot' ? M.tool : ''; }
  function band(g2) {
    var b = g2.band; if (!b) { b = g2.band = document.createElement('i'); b.className = 'drag'; g2.p.el.querySelector('.ov').appendChild(b); }
    return b;
  }
  function down(e) {
    var k = kind(); if (!k || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('[data-act]')) return;
    var p = Read.pageOf(e.target); if (!p) return; var l = Read.local(p.el, e);
    g = { p: p, k: k, x0: l.x, y0: l.y, x: l.x, y: l.y, id: e.pointerId, pts: [[l.x, l.y]], band: null, moved: false };
  }
  function move(e) {
    if (!g || e.pointerId !== g.id) return; var l = Read.local(g.p.el, e); g.x = l.x; g.y = l.y;
    if (Math.abs(g.x - g.x0) + Math.abs(g.y - g.y0) > 8) g.moved = true;
    if (!g.moved) return;
    if (g.k === 'pen') { g.pts.push([l.x, l.y]); var pl = g.line || (g.line = penLine(g)); pl.setAttribute('points', g.pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' ')); return; }
    var b = band(g);
    if (g.k === 'area') b.style.cssText = 'left:' + Math.min(g.x0, g.x) + 'px;top:' + Math.min(g.y0, g.y) + 'px;width:' + Math.abs(g.x - g.x0) + 'px;height:' + Math.abs(g.y - g.y0) + 'px';
    else b.style.cssText = 'left:' + Math.min(g.x0, g.x) + 'px;top:' + (g.y0 - 9) + 'px;width:' + Math.abs(g.x - g.x0) + 'px;height:18px';
  }
  function penLine(g2) {
    var ov = g2.p.el.querySelector('.ov'), s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'inkp');
    var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('stroke', M.color); s.appendChild(pl); ov.appendChild(s); g2.svg = s; return pl;
  }
  function up(e) {
    if (!g || e.pointerId !== g.id) return; var d = g; g = null;
    if (d.band) d.band.remove(); if (d.svg) d.svg.remove();
    if (e.type === 'pointercancel') return;
    var i = d.p.i, a = Read.pdf(i, d.x0, d.y0), b = Read.pdf(i, d.x, d.y);
    if (d.k === 'pen') { if (d.pts.length > 1) pen(i, d.pts); return; }
    if (d.k === 'note') { if (!d.moved) note(i, a); return; }
    if (d.k === 'area') { if (d.moved && Math.abs(d.x - d.x0) > 6 && Math.abs(d.y - d.y0) > 6) addMark(i, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]); return; }
    // text kinds: the line under the finger, all of it for a tap, the dragged part for a drag along the line
    Doc.blocks(i).then(function (bl) {
      var tol = 3, hit = bl.filter(function (x) { return a[0] >= x.rect[0] - tol && a[0] <= x.rect[2] + tol && a[1] >= x.rect[1] - tol && a[1] <= x.rect[3] + tol; })[0];
      if (!hit) return;
      var r = hit.rect.slice(); if (d.moved) { r[0] = Math.max(r[0], Math.min(a[0], b[0])); r[2] = Math.min(r[2], Math.max(a[0], b[0])); if (r[2] - r[0] < 2) return; }
      if (d.k === 'text') addMark(i, r); else mark(i, r);
    });
  }
  function mark(i, r) { var kd = M.tool; Viewer.run(function () { return PdfSvc.annotate({ page: i, kind: kd, rects: [r], color: rgba(kd === 'highlight' ? M.color : M.color) }); }, 'busy.mark'); }
  function pen(i, pts) {
    var pp = pts.map(function (q) { return Read.pdf(i, q[0], q[1]); }), xs = pp.map(function (q) { return q[0]; }), ys = pp.map(function (q) { return q[1]; }), w = 2.2;
    var box = [Math.min.apply(0, xs) - w, Math.min.apply(0, ys) - w, Math.max.apply(0, xs) + w, Math.max.apply(0, ys) + w];
    Viewer.run(function () { return PdfSvc.annotate({ page: i, kind: 'ink', points: pp, box: box, color: rgba(M.color), width: w }); }, 'busy.mark');
  }
  function addMark(i, r) { M.marks.push({ page: i, rect: r }); Read.repaint(); Read.chrome(); }

  // ---- notes ----------------------------------------------------------------------------------------------------------------------
  var noteAt = null;
  function note(i, at) { noteAt = { page: i, at: at }; Ui.sheet('note', SheetsView.note()); setTimeout(function () { var x = $('ntIn'); if (x) x.focus(); }, 380); }
  A['nt-apply'] = function () {
    var v = $('ntIn').value.trim(), n = noteAt; Ui.closeSheet(); if (!v || !n) return;
    Viewer.run(function () { return PdfSvc.annotate({ page: n.page, kind: 'text', box: [n.at[0], n.at[1] - 18, n.at[0] + 18, n.at[1]], text: v, color: rgba(C('note_fill')) }); }, 'busy.mark');
  };

  // ---- tool buttons -------------------------------------------------------------------------------------------------------------------
  A['a-tool'] = function (el) {
    var k = el.dataset.k, y = C('hl_yellow'), r = C('sw_red'); M.tool = k;
    // yellow suits a highlighter, not a line under the words: the two defaults swap when the tool changes
    if (k === 'highlight' && M.color === r) M.color = y; else if (k !== 'highlight' && M.color === y) M.color = r;
    Read.chrome();
  };
  A['a-color'] = function (el) { M.color = el.dataset.v; Read.chrome(); };
  A['x-text'] = function () { M.area = false; Read.chrome(); };
  A['x-area'] = function () { M.area = true; Read.chrome(); };
  A['x-clear'] = function () { M.marks = []; Read.repaint(); Read.chrome(); };
  A['x-apply'] = function () {
    if (!M.marks.length) return; var n = M.marks.length;
    Ui.dialog(t('rx.confirm', { n: n }), t('rx.permanent') + ' ' + t('rx.permanent.s'), t('rx.go'), function () {
      var by = {}; M.marks.forEach(function (m) { (by[m.page] = by[m.page] || []).push(m.rect); });
      Viewer.run(async function () { for (var p in by) await PdfSvc.annotate({ page: +p, kind: 'redact', rects: by[p], color: rgba(C('redact_ink')) }); }, 'busy.redact').then(function () { M.marks = []; Read.setMode('read'); Ui.toast(t('rx.done')); });
    }, true);
  };
  A['x-gone'] = function (el) { M.marks.splice(+el.dataset.k, 1); Read.repaint(); Read.chrome(); };

  var sc = $('rdScroll');
  sc.addEventListener('pointerdown', down); sc.addEventListener('pointermove', move); sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up);
})();
