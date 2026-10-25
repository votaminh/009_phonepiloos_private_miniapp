// SlideDraw — draws the engine's render tree (shapes, text already laid out in lines, pictures) on a canvas. All numbers in the tree are css pixels of the slide at the width it was built for.
(function () {
  'use strict';
  var imgs = {}, redraw = null;
  // #RRGGBBAA -> rgba(), anything else as it is
  function col(c) {
    if (!c || c === 'none') return 'transparent';
    if (/^#[0-9a-f]{8}$/i.test(c)) return 'rgba(' + parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16) + ',' + (parseInt(c.slice(7, 9), 16) / 255).toFixed(3) + ')';
    return c;
  }
  // pictures load once; when one arrives the owner of the canvas is asked to draw again
  function image(url) {
    if (!url) return null; var e = imgs[url];
    if (e) return e.ok ? e.img : null;
    var img = new Image(); e = imgs[url] = { img: img, ok: false }; img.onload = function () { e.ok = true; if (redraw) redraw(); }; img.onerror = function () { e.bad = true; }; img.src = url; return null;
  }
  function gradient(ctx, f, w, h) {
    var st = (f.stops || []).slice().sort(function (a, b) { return a.pos - b.pos; }), g;
    if (f.radial) { var c = f.center || { x: .5, y: .5 }, cx = c.x * w, cy = c.y * h, r = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy)); g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r || 1); }
    else {
      var a = (f.angleDeg || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      if (f.scaled) { var vx = h * Math.cos(a), vy = w * Math.sin(a), n = Math.hypot(vx, vy) || 1; dx = vx / n; dy = vy / n; }
      var len = Math.abs(dx) * w + Math.abs(dy) * h; g = ctx.createLinearGradient(w / 2 - dx * len / 2, h / 2 - dy * len / 2, w / 2 + dx * len / 2, h / 2 + dy * len / 2);
    }
    st.forEach(function (s) { g.addColorStop(Math.max(0, Math.min(1, s.pos)), col(s.color)); }); return g;
  }
  // a fill painted over the path (in the box's own coordinates)
  function paint(ctx, f, path, w, h) {
    if (!f || f.kind === 'none') return;
    if (f.kind === 'image') {
      var im = image(f.dataUrl); if (!im) return; ctx.save(); ctx.clip(path); if (f.alpha != null) ctx.globalAlpha = f.alpha;
      var r = f.fillRect || { l: 0, t: 0, r: 0, b: 0 }; ctx.drawImage(im, r.l * w, r.t * h, w * (1 - r.l - r.r), h * (1 - r.t - r.b)); ctx.restore(); return;
    }
    ctx.fillStyle = f.kind === 'solid' ? col(f.color) : f.kind === 'gradient' ? gradient(ctx, f, w, h) : col(f.fg); ctx.fill(path);
  }
  function stroke(ctx, s, path, w, h) {
    if (!s || !(s.widthPx > 0)) return;
    ctx.lineWidth = s.widthPx; ctx.strokeStyle = s.gradient ? gradient(ctx, { stops: s.gradient.stops, angleDeg: s.gradient.angleDeg, scaled: s.gradient.scaled }, w, h) : col(s.color);
    ctx.setLineDash(s.dash || []); ctx.lineCap = s.cap || 'butt'; ctx.lineJoin = s.join || 'miter'; ctx.stroke(path); ctx.setLineDash([]);
  }
  function shadow(ctx, s) { if (s && !s.inner) { ctx.shadowColor = col(s.color); ctx.shadowBlur = s.blurPx; ctx.shadowOffsetX = s.offsetX; ctx.shadowOffsetY = s.offsetY; } }
  function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function rrect(p, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
  function shapePath(n, w, h) {
    var p;
    if (n.fillPathData || n.pathData) return new Path2D(n.fillPathData || n.pathData);
    p = new Path2D();
    if (n.polygonPoints) { var q = n.polygonPoints; p.moveTo(q[0], q[1]); for (var i = 2; i < q.length; i += 2) p.lineTo(q[i], q[i + 1]); p.closePath(); }
    else if (n.presetGeometry === 'ellipse' || n.presetGeometry === 'circle') p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (n.cornerRadiusPx != null || n.presetGeometry === 'roundRect') rrect(p, 0, 0, w, h, n.cornerRadiusPx != null ? n.cornerRadiusPx : Math.min(w, h) * 0.167);
    else p.rect(0, 0, w, h);
    return p;
  }
  function arrow(ctx, e, x, y, ang, color) {
    var l = e.lengthPx || 8, w = e.widthPx || 6; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.beginPath();
    if (e.type === 'oval') ctx.ellipse(0, 0, l / 2, w / 2, 0, 0, Math.PI * 2); else if (e.type === 'diamond') { ctx.moveTo(-l / 2, 0); ctx.lineTo(0, -w / 2); ctx.lineTo(l / 2, 0); ctx.lineTo(0, w / 2); } else { ctx.moveTo(l, 0); ctx.lineTo(0, -w / 2); ctx.lineTo(0, w / 2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function line(ctx, n) {
    var L = n.line, p = L.points, path = new Path2D(); path.moveTo(p[0], p[1]);
    if (L.bezier && L.bezier.length >= 6) path.bezierCurveTo(L.bezier[0], L.bezier[1], L.bezier[2], L.bezier[3], L.bezier[4], L.bezier[5]); else for (var i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    stroke(ctx, n.stroke, path, n.box.w, n.box.h);
    var c = col(n.stroke && n.stroke.color), m = p.length;
    if (L.headEnd) arrow(ctx, L.headEnd, p[0], p[1], Math.atan2(p[1] - p[3], p[0] - p[2]), c);
    if (L.tailEnd) arrow(ctx, L.tailEnd, p[m - 2], p[m - 1], Math.atan2(p[m - 1] - p[m - 3], p[m - 2] - p[m - 4]), c);
  }
  function text(ctx, t) {
    if (!t) return;
    t.lines.forEach(function (ln) {
      ln.runs.forEach(function (r) {
        if (r.image || !r.text) return;
        ctx.save();
        if (r.highlight) { ctx.fillStyle = col(r.highlight); ctx.fillRect(r.x, ln.top, r.widthPx, ln.height); }
        if (r.rotate90 || r.rotate270) { ctx.translate(r.x, r.baselineY); ctx.rotate((r.rotate90 ? 1 : -1) * Math.PI / 2); ctx.translate(-r.x, -r.baselineY); }
        ctx.font = (r.italic ? 'italic ' : '') + (r.bold ? '700 ' : '400 ') + r.fontSizePx + 'px "' + r.fontFamily + '"';
        var ls = (r.letterSpacingPx || 0) + (r.justifyExtraPx || 0); if ('letterSpacing' in ctx) ctx.letterSpacing = ls ? ls + 'px' : '0px';
        ctx.fillStyle = col(r.color); ctx.textBaseline = 'alphabetic'; if (r.rtl) ctx.direction = 'rtl';
        var y = r.baselineY + (r.baselineShiftPx || 0);
        if (r.shadow) shadow(ctx, r.shadow);
        if (r.outline) { ctx.lineWidth = Math.max(0.5, r.outline.widthPx); ctx.strokeStyle = col(r.outline.color); ctx.strokeText(r.text, r.x, y); }
        ctx.fillText(r.text, r.x, y); noShadow(ctx);
        if (r.underline) ctx.fillRect(r.x, y + r.fontSizePx * 0.1, r.widthPx, Math.max(1, r.fontSizePx * 0.06));
        if (r.strike) ctx.fillRect(r.x, y - r.fontSizePx * 0.28, r.widthPx, Math.max(1, r.fontSizePx * 0.06));
        ctx.restore();
      });
    });
  }
  function picture(ctx, n) {
    var w = n.box.w, h = n.box.h, im = image(n.dataUrl), clip = n.clip;
    ctx.save();
    if (clip) { var cp = clip.pathData ? new Path2D(clip.pathData) : new Path2D(); if (!clip.pathData) { if (clip.polygonPoints) { var q = clip.polygonPoints; cp.moveTo(q[0], q[1]); for (var i = 2; i < q.length; i += 2) cp.lineTo(q[i], q[i + 1]); cp.closePath(); } else rrect(cp, 0, 0, w, h, clip.cornerRadiusPx || 0); } ctx.clip(cp); }
    if (n.opacity != null) ctx.globalAlpha = n.opacity;
    if (n.bgColor) { ctx.fillStyle = col(n.bgColor); ctx.fillRect(0, 0, w, h); }
    if (im) {
      var s = n.srcRect || { l: 0, t: 0, r: 0, b: 0 }, sw = im.naturalWidth * (1 - s.l - s.r), sh = im.naturalHeight * (1 - s.t - s.b);
      shadow(ctx, n.shadow); ctx.drawImage(im, im.naturalWidth * s.l, im.naturalHeight * s.t, sw, sh, 0, 0, w, h); noShadow(ctx);
    } else { ctx.fillStyle = col(C('chip')); ctx.fillRect(0, 0, w, h); ctx.fillStyle = col(C('muted')); ctx.font = '600 ' + Math.max(10, Math.min(16, h / 6)) + 'px "Carlito"'; ctx.textAlign = 'center'; ctx.fillText(n.media ? n.media : 'Picture', w / 2, h / 2); }
    ctx.restore();
    if (n.stroke) { var sp = new Path2D(); sp.rect(0, 0, w, h); stroke(ctx, n.stroke, sp, w, h); }
  }
  function shape(ctx, n) {
    var w = n.box.w, h = n.box.h;
    if (n.line) { line(ctx, n); text(ctx, n.text); return; }
    var p = shapePath(n, w, h);
    if (n.fill && n.fill.kind !== 'none') { shadow(ctx, n.shadow); paint(ctx, n.fill, p, w, h); noShadow(ctx); }
    if (n.fillOverlay) paint(ctx, n.fillOverlay, p, w, h);
    if (n.stroke) stroke(ctx, n.stroke, n.strokePathData ? new Path2D(n.strokePathData) : p, w, h);
    text(ctx, n.text);
  }
  // one node (with its rotation and flips); text is never mirrored
  function node(ctx, n) {
    if (n.type === 'group') {
      // the children are placed relative to the group's own corner; the group may be turned or flipped as a whole
      var g = n.box; ctx.save(); ctx.translate(g.x + g.w / 2, g.y + g.h / 2); if (g.rotationDeg) ctx.rotate(g.rotationDeg * Math.PI / 180); if (g.flipH || g.flipV) ctx.scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1); ctx.translate(-g.w / 2, -g.h / 2);
      n.children.forEach(function (c) { node(ctx, c); }); ctx.restore(); return;
    }
    var b = n.box, flip = !!(b.flipH || b.flipV), plain = n.type === 'shape' || n.type === 'text', loose = flip && plain ? n.text : null;
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); if (b.rotationDeg) ctx.rotate(b.rotationDeg * Math.PI / 180);
    ctx.save(); if (flip) ctx.scale(b.flipH ? -1 : 1, b.flipV ? -1 : 1); ctx.translate(-b.w / 2, -b.h / 2);
    if (n.type === 'picture') picture(ctx, n);
    else if (n.type === 'table') SlideDraw2.table(ctx, n);
    else if (n.type === 'chart') SlideDraw2.chart(ctx, n);
    else if (n.type === 'placeholder-chip') { ctx.fillStyle = col(C('chip')); ctx.fillRect(0, 0, b.w, b.h); ctx.fillStyle = col(C('muted')); ctx.font = '600 12px "Carlito"'; ctx.textAlign = 'center'; ctx.fillText(n.label || n.kind, b.w / 2, b.h / 2); }
    else shape(ctx, loose ? Object.assign({}, n, { text: null }) : n);
    ctx.restore();
    if (loose) { ctx.translate(-b.w / 2, -b.h / 2); text(ctx, loose); }
    ctx.restore();
  }
  // a box without words yet: a dashed outline and what to do
  function hint(ctx, n) {
    var b = n.box, kind = /^(ctrTitle|title)$/i.test(n.placeholder) ? 'title' : /^subTitle$/i.test(n.placeholder) ? 'sub' : 'body';
    ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = col(C('accent_hi')); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
    ctx.fillStyle = col(C('muted')); ctx.font = '500 ' + Math.max(10, Math.min(15, b.h * 0.4)) + 'px "Carlito"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Ui.t('ph.' + kind), b.x + b.w / 2, b.y + b.h / 2, Math.max(20, b.w - 8)); ctx.restore();
  }
  window.SlideDraw = {
    col: col, paint: paint, text: text, rrect: rrect, node: node,
    onImage: function (fn) { redraw = fn; },
    // the whole slide; skip = a source id left out (it is lifted onto its own canvas while it moves)
    draw: function (ctx, tree, skip, hints) {
      ctx.save(); ctx.fillStyle = col(C('white')); ctx.fillRect(0, 0, tree.widthPx, tree.heightPx);
      var bp = new Path2D(); bp.rect(0, 0, tree.widthPx, tree.heightPx); paint(ctx, tree.background, bp, tree.widthPx, tree.heightPx);
      tree.nodes.forEach(function (n) { if (n.sourceId === skip || (skip && typeof skip === 'object' && skip[n.sourceId])) return; if (n.empty) { if (hints) hint(ctx, n); return; } node(ctx, n); }); ctx.restore();
    }
  };
})();
