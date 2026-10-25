// SlideDraw2 — tables and charts of the render tree (the chart arrives as ready-made bars, lines, wedges and labels).
(function () {
  'use strict';
  var col = function (c) { return window.SlideDraw.col(c); };
  function sline(ctx, a) { ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.lineWidth = a.widthPx || 1; ctx.strokeStyle = col(a.color); ctx.setLineDash(a.dash || []); ctx.stroke(); ctx.setLineDash([]); }
  function label(ctx, l) {
    ctx.save(); ctx.font = (l.italic ? 'italic ' : '') + (l.bold ? '700 ' : '400 ') + l.fontSizePx + 'px "' + (l.fontFamily || 'Carlito') + '"'; ctx.textBaseline = 'top'; ctx.fillStyle = col(l.color);
    if (l.rotationDeg) { ctx.translate(l.x, l.y); ctx.rotate(l.rotationDeg * Math.PI / 180); ctx.fillText(l.text, 0, 0); } else ctx.fillText(l.text, l.x, l.y); ctx.restore();
  }
  window.SlideDraw2 = {
    table: function (ctx, n) {
      var D = window.SlideDraw, w = n.box.w, h = n.box.h;
      if (n.bgFill) { var bp = new Path2D(); bp.rect(0, 0, w, h); D.paint(ctx, n.bgFill, bp, w, h); }
      n.cells.forEach(function (c) {
        var p = new Path2D(); p.rect(c.x, c.y, c.w, c.h); ctx.save(); ctx.translate(0, 0); D.paint(ctx, c.fill, p, c.w, c.h);
        ctx.save(); ctx.translate(c.x, c.y); D.text(ctx, c.text); ctx.restore();
        var b = c.borders || {}; [['t', c.x, c.y, c.x + c.w, c.y], ['b', c.x, c.y + c.h, c.x + c.w, c.y + c.h], ['l', c.x, c.y, c.x, c.y + c.h], ['r', c.x + c.w, c.y, c.x + c.w, c.y + c.h]].forEach(function (e) {
          var s = b[e[0]]; if (!s || !(s.widthPx > 0)) return; ctx.beginPath(); ctx.moveTo(e[1], e[2]); ctx.lineTo(e[3], e[4]); ctx.lineWidth = s.widthPx; ctx.strokeStyle = col(s.color); ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
        }); ctx.restore();
      });
    },
    chart: function (ctx, n) {
      var D = window.SlideDraw, w = n.box.w, h = n.box.h;
      if (n.bgFill) { var bp = new Path2D(); bp.rect(0, 0, w, h); D.paint(ctx, n.bgFill, bp, w, h); }
      if (n.plotRect && n.plotRect.fill) { var pp = new Path2D(); pp.rect(n.plotRect.x, n.plotRect.y, n.plotRect.w, n.plotRect.h); D.paint(ctx, n.plotRect.fill, pp, n.plotRect.w, n.plotRect.h); }
      (n.gridLines || []).forEach(function (g) { sline(ctx, g); });
      (n.bars || []).forEach(function (b) { ctx.fillStyle = col(b.color); ctx.fillRect(b.x, b.y, b.w, b.h); });
      (n.paths || []).forEach(function (p) { var q = new Path2D(p.d); ctx.save(); if (p.dy) ctx.translate(0, p.dy); ctx.fillStyle = col(p.fill); ctx.fill(q); if (p.stroke) { ctx.strokeStyle = col(p.stroke); ctx.lineWidth = p.strokeWidthPx || 1; ctx.stroke(q); } ctx.restore(); });
      (n.wedges || []).forEach(function (a) {
        var s = (a.startDeg) * Math.PI / 180, e = (a.startDeg + a.sweepDeg) * Math.PI / 180; ctx.beginPath(); ctx.arc(a.cx, a.cy, a.outerR, s, e);
        if (a.innerR > 0) ctx.arc(a.cx, a.cy, a.innerR, e, s, true); else ctx.lineTo(a.cx, a.cy); ctx.closePath();
        if (!a.noFill) { ctx.fillStyle = col(a.color); ctx.fill(); } ctx.strokeStyle = col(a.stroke || C('white')); ctx.lineWidth = a.strokeWidthPx || 1; ctx.stroke();
      });
      (n.axisLines || []).forEach(function (g) { sline(ctx, g); });
      (n.polylines || []).forEach(function (l) {
        var p = l.points; if (p.length < 4) return; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); if (l.closed) ctx.closePath();
        if (l.fill) { ctx.fillStyle = col(l.fill); ctx.fill(); } ctx.lineWidth = l.widthPx; ctx.strokeStyle = col(l.color); ctx.lineJoin = 'round'; ctx.setLineDash(l.dash || []); ctx.stroke(); ctx.setLineDash([]);
      });
      (n.markers || []).forEach(function (m) { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fillStyle = col(m.color); ctx.fill(); });
      (n.swatches || []).forEach(function (s) { ctx.fillStyle = col(s.color); ctx.fillRect(s.x, s.y, s.w, s.h); });
      (n.labels || []).forEach(function (l) { label(ctx, l); });
      if (n.border) { ctx.strokeStyle = col(n.border.color); ctx.lineWidth = n.border.widthPx; ctx.strokeRect(0, 0, w, h); }
    }
  };
})();
