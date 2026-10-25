// Mouse — what a mouse does on the slide (a computer only; a finger keeps the touch code in stage-vm.js): click to pick, Shift / Ctrl + click to add or take away, a box dragged over empty space picks what it touches,
// drag to move (guides snap to the slide and to the other boxes), the handles resize, the round handle turns, double click writes in the box, right click opens its menu.
(function () {
  'use strict';
  var $ = Ui.$, S = window.Stage, M = window.Mouse = {}, g = null, T = 5, PAD = 12;

  function pt(e) { var r = $('slideBox').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function emu(v) { return Math.round(v * Deck.k()); }
  function boxOp(n, b) { return Deck.op('setTransform', n.sourceId, { box: { x: emu(b.x), y: emu(b.y), cx: emu(b.w), cy: emu(b.h) }, rotDeg: Math.round((b.rotationDeg || 0) * 10) / 10 }); }

  // ---- a lifted copy of the picked boxes: it moves while the slide behind is drawn without them ---------------------------------------------
  function lift(nodes) {
    var bb = Sel.bounds(nodes), x = bb.x - PAD, y = bb.y - PAD, w = bb.w + PAD * 2, h = bb.h + PAD * 2, cv = document.createElement('canvas'), skip = {};
    cv.width = Math.round(w * S.dpr); cv.height = Math.round(h * S.dpr); cv.className = 'lift'; cv.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    var c = cv.getContext('2d'); c.scale(S.dpr, S.dpr); c.translate(-x, -y); nodes.forEach(function (n) { SlideDraw.node(c, n); skip[n.sourceId] = 1; });
    S.endLift(); S.draw(skip); S.lift = { el: cv, x: x, y: y, w: w, h: h, n: nodes[0] }; $('lifts').appendChild(cv); return bb;
  }
  // guides: the edges and the middle of the slide and of the other boxes pull the moving box when it comes within a few pixels
  function lines(skip) {
    var W = S.tree.widthPx, H = S.tree.heightPx, xs = [0, W / 2, W], ys = [0, H / 2, H];
    S.tree.nodes.forEach(function (n) { if (skip[n.sourceId] || n.decoration || n.background || n.empty) return; var b = n.box; xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); });
    return { xs: xs, ys: ys };
  }
  function pull(vals, lns) {
    var best = null; vals.forEach(function (v) { lns.forEach(function (l) { var d = l - v; if (Math.abs(d) < T && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d: d, at: l }; }); }); return best;
  }
  function guides(gx, gy) { $('guides').innerHTML = (gx ? '<i class="gv" style="left:' + gx.at + 'px"></i>' : '') + (gy ? '<i class="gh" style="top:' + gy.at + 'px"></i>' : ''); }
  function frames(dx, dy) {
    var fr = $('frame'), nodes = g.nodes, bb = g.bb;
    if (nodes.length > 1) { fr.style.left = bb.x + dx + 'px'; fr.style.top = bb.y + dy + 'px'; }
    else { var b = nodes[0].box; fr.style.left = b.x + dx + 'px'; fr.style.top = b.y + dy + 'px'; }
    $('msel').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  // ---- press ------------------------------------------------------------------------------------------------------------------------------
  function down(e) {
    if (!Wide.pc || e.pointerType !== 'mouse' || e.button !== 0 || !S.tree || !Deck.info) return;
    if (e.target.closest && e.target.closest('.rd-busy,.rd-float,#inl')) return;
    var h = e.target.dataset && e.target.dataset.h, p = pt(e), n = h ? null : S.hit(p), add = e.shiftKey || e.ctrlKey || e.metaKey;
    e.preventDefault(); e.stopPropagation();
    if (h === 'mv' && Deck.sel) { start(e, 'move', Sel.nodes(), null); return; }
    if (h && Deck.sel) { start(e, h === 'rot' ? 'rotate' : 'resize', Sel.nodes(), h); return; }
    if (!n) { marquee(e, add); return; }
    if (add) { Sel.toggle(n.sourceId); return; }
    if (window.Cells && Cells.down(e, n)) return;
    var keep = Sel.has(n.sourceId) && Sel.count() > 1; if (!keep) Sel.set([n.sourceId]);
    start(e, 'move', Sel.nodes(), null, keep ? n.sourceId : null);
  }
  function start(e, mode, nodes, h, solo) {
    if (!nodes.length) return;
    g = { mode: mode, h: h, nodes: nodes, x0: e.clientX, y0: e.clientY, moved: false, solo: solo, boxes: nodes.map(function (n) { return Object.assign({}, n.box); }), bb: Sel.bounds(nodes), id: nodes.map(function (n) { return n.sourceId; }) };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
  }
  function move(e) {
    if (!g) return; var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved) { if (Math.hypot(dx, dy) < 4) return; g.moved = true; g.bb = lift(g.nodes); g.skip = {}; g.id.forEach(function (i) { g.skip[i] = 1; }); g.ln = lines(g.skip); }
    var el = S.lift && S.lift.el; if (!el) return;
    if (g.mode === 'move') {
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }   // Shift keeps to one direction
      var b = g.bb, bx = dx === 0 && e.shiftKey ? null : pull([b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], g.ln.xs), by = dy === 0 && e.shiftKey ? null : pull([b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], g.ln.ys);
      if (bx) dx += bx.d; if (by) dy += by.d; if (window.Extras && Extras.snap()) { if (!bx) dx = Extras.snapTo(b.x + dx) - b.x; if (!by) dy = Extras.snapTo(b.y + dy) - b.y; } g.dx = dx; g.dy = dy; guides(bx, by); el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; frames(dx, dy);
    } else if (g.mode === 'resize') resize(e, dx, dy); else rotate(e);
  }
  function rotate(e) {
    var n = g.nodes[0], b = g.boxes[0], p = pt(e), a = Math.atan2(p.y - b.centerY, p.x - b.centerX) * 180 / Math.PI + 90, st = Math.round(a / 15) * 15; if (Math.abs(a - st) < 3.5 || e.shiftKey) a = st;
    var r = ((a % 360) + 360) % 360; g.rot = r; S.lift.el.style.transform = 'rotate(' + (r - (b.rotationDeg || 0)) + 'deg)'; $('frame').style.transform = 'rotate(' + r + 'deg)';
  }
  // the new box of a handle drag; many boxes scale together inside the frame round them
  function resize(e, dx, dy) {
    var many = g.nodes.length > 1, o = many ? g.bb : g.boxes[0], a = many ? 0 : (o.rotationDeg || 0) * Math.PI / 180, h = g.h, hx = /e/.test(h) ? 1 : /w/.test(h) ? -1 : 0, hy = /s/.test(h) ? 1 : /n/.test(h) ? -1 : 0;
    var lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a), line = !many && g.nodes[0].line, min = line ? 0 : 14;
    var w = Math.max(min, o.w + hx * lx), hh = Math.max(min, o.h + hy * ly), keep = (e.shiftKey || (!many && g.nodes[0].type === 'picture')) && hx && hy;
    if (keep) { var k = Math.max(w / o.w, hh / o.h); w = o.w * k; hh = o.h * k; }
    var cx0 = many ? o.x + o.w / 2 : o.centerX, cy0 = many ? o.y + o.h / 2 : o.centerY, sx = hx * (w - o.w) / 2, sy = hy * (hh - o.h) / 2;
    var cx = cx0 + sx * Math.cos(a) - sy * Math.sin(a), cy = cy0 + sx * Math.sin(a) + sy * Math.cos(a), nb = { x: cx - w / 2, y: cy - hh / 2, w: w, h: hh };
    g.nb = nb; var fr = $('frame'); fr.style.left = nb.x + 'px'; fr.style.top = nb.y + 'px'; fr.style.width = nb.w + 'px'; fr.style.height = nb.h + 'px';
    var l = S.lift, el = l.el, sxs = nb.w / (o.w || 1), sys = nb.h / (o.h || 1), ob = many ? g.bb : g.boxes[0];
    el.style.transformOrigin = '0 0'; el.style.transform = 'translate(' + (nb.x - ob.x) + 'px,' + (nb.y - ob.y) + 'px) translate(' + PAD * (1 - sxs) + 'px,' + PAD * (1 - sys) + 'px) scale(' + sxs + ',' + sys + ')';
  }
  function end() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); $('guides').innerHTML = ''; $('msel').style.transform = ''; }
  function cancel() { var had = g && g.moved; end(); g = null; if (had) { S.endLift(); S.draw(); S.frame(); } }
  function up() {
    var d = g; end(); g = null; if (!d) return;
    if (!d.moved) { if (d.solo) Sel.set([d.solo]); S.endLift(); return; }
    var ops;
    if (d.mode === 'move') {
      ops = d.nodes.map(function (n, i) { var b = d.boxes[i]; return boxOp(n, { x: b.x + d.dx, y: b.y + d.dy, w: b.w, h: b.h, rotationDeg: b.rotationDeg }); });
    } else if (d.mode === 'rotate') { var b0 = d.boxes[0]; ops = [boxOp(d.nodes[0], { x: b0.x, y: b0.y, w: b0.w, h: b0.h, rotationDeg: d.rot })]; }
    else if (d.nodes.length === 1) { var b1 = d.boxes[0]; ops = [boxOp(d.nodes[0], { x: d.nb.x, y: d.nb.y, w: d.nb.w, h: d.nb.h, rotationDeg: b1.rotationDeg })]; }
    else {
      var B = d.bb, N = d.nb, sx = N.w / (B.w || 1), sy = N.h / (B.h || 1);
      ops = d.nodes.map(function (n, i) { var b = d.boxes[i]; return boxOp(n, { x: N.x + (b.x - B.x) * sx, y: N.y + (b.y - B.y) * sy, w: b.w * sx, h: b.h * sy, rotationDeg: b.rotationDeg }); });
    }
    Viewer.run(ops, 'busy.edit').then(function (ok) { if (!ok) { S.endLift(); S.draw(); S.frame(); } });
  }

  // ---- a box dragged over empty space picks what it touches ---------------------------------------------------------------------------------
  function marquee(e, add) {
    var p0 = pt(e), base = add ? Sel.ids() : [], el = document.createElement('i'), moved = false; el.className = 'mq'; $('slideBox').appendChild(el);
    if (!add && Deck.sel) { Sel.set([]); }
    function mv(ev) {
      var p = pt(ev), x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y), w = Math.abs(p.x - p0.x), h = Math.abs(p.y - p0.y); if (!moved && w + h < 4) return; moved = true;
      el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
      var hit = S.tree.nodes.filter(function (n) { if (n.decoration || n.background || n.empty) return false; var b = Sel.bounds([n]); return b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y; }).map(function (n) { return n.sourceId; });
      Sel.set(base.concat(hit.filter(function (i) { return base.indexOf(i) < 0; })));
    }
    function fin() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', fin); el.remove(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', fin);
  }

  // ---- hover, double click, right click ---------------------------------------------------------------------------------------------------------
  function hover(e) {
    if (!Wide.pc || g || !S.tree || e.pointerType !== 'mouse' || e.buttons) return;
    var on = e.target.closest && e.target.closest('#slideBox') && !(e.target.dataset && e.target.dataset.h); $('slideBox').classList.toggle('hov', !!(on && S.hit(pt(e))));
  }
  function dbl(e) {
    if (!Wide.pc || !e.target.closest('#slideBox') || e.target.closest('#inl') || (e.target.dataset && e.target.dataset.h)) return; var n = S.hit(pt(e)); if (!n) return;
    Sel.set([n.sourceId]); if (n.type === 'table') Cells.edit(n, pt(e)); else if (window.Inline && (n.text || n.empty) && n.type !== 'picture') Inline.open(n); else if (n.text && n.type !== 'picture') Text.open(true);
  }
  function A_(a) { App.acts[a](); }
  M.init = function () {
    var sc = $('stScroll'); sc.addEventListener('pointerdown', down, true); sc.addEventListener('pointermove', hover); sc.addEventListener('dblclick', dbl);
    sc.addEventListener('contextmenu', function (e) {
      if (!Wide.pc || !S.tree) return; e.preventDefault(); var n = e.target.closest('#slideBox') ? S.hit(pt(e)) : null;
      if (n && !Sel.has(n.sourceId)) Sel.set([n.sourceId]); if (!n && Deck.sel) Sel.set([]); if (window.Ctx) Ctx.canvas(e.clientX, e.clientY, !!n);
    });
  };
})();
