// Stage — the slide on its dark stage: drawing it, selecting a box by touch, moving, resizing and turning it, and the answer to a tap (only the content of the box bounces; the frame never moves).
(function () {
  'use strict';
  var $ = Ui.$, A = App.acts, PAD = 12, TAP = 6;
  var S = window.Stage = { tree: null, cv: null, ctx: null, dpr: 1, res: 1, zoom: { k: 1, x: 0, y: 0 }, lift: null, g: null, lastTap: { at: 0, id: '' } };
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  // ---- size and drawing --------------------------------------------------------------------------------------------------
  S.layout = function () {
    S.zoom.k = 1; S.zoom.x = 0; S.zoom.y = 0; S.res = 1; $('slideBox').style.transform = '';
    var st = $('stage'), w = Math.max(160, Math.floor(st.clientWidth - 32)), box = $('slideBox');
    if (w !== Deck.w) { Deck.w = w; Deck.gen++; Deck.trees = {}; Deck.reads = {}; }
    var h = Math.round(w * Deck.ratio()); S.dpr = Math.min(2, window.devicePixelRatio || 1);
    box.style.width = w + 'px'; box.style.height = h + 'px'; st.style.height = (h + 76) + 'px';
    S.cv = $('slideCv'); S.cv.width = Math.round(w * S.dpr * S.res); S.cv.height = Math.round(h * S.dpr * S.res); S.ctx = S.cv.getContext('2d');
  };
  S.draw = function (skip) { if (!S.tree) return; var m = S.dpr * S.res; S.ctx.setTransform(m, 0, 0, m, 0, 0); SlideDraw.draw(S.ctx, S.tree, skip, true); };
  // the tree of the slide on stage, drawn; the selection frame follows
  S.show = async function () {
    var i = Deck.cur, g = Deck.gen, tree; try { tree = await Deck.tree(i); } catch (e) { return; }
    if (g !== Deck.gen || i !== Deck.cur) return;
    S.tree = tree; S.endLift(); S.draw();
    if (Deck.sel && !S.node(Deck.sel)) Deck.sel = S.successor();
    S.frame(); $('stPill').textContent = (i + 1) + ' / ' + Deck.count(); Quick.render(); Film.update();
  };
  SlideDraw.onImage(function () { if (!S.g) S.draw(); });
  // an edit can give a box a new id (a table that got a row): the box of the same kind that sits where it sat is still the selection
  S.successor = function () {
    var l = S.last, best = null, d = 1e9; if (!l) return null;
    (S.tree ? S.tree.nodes : []).forEach(function (n) { var e = Math.hypot(n.box.x - l.x, n.box.y - l.y); if (n.type === l.type && !n.decoration && e < d) { d = e; best = n; } });
    return best && d < 6 ? best.sourceId : null;
  };
  S.node = function (id) { var f = null; (S.tree ? S.tree.nodes : []).forEach(function (n) { if (n.sourceId === id) f = n; }); return f; };

  // ---- the frame over the selected box -----------------------------------------------------------------------------------------
  S.frame = function () {
    var fr = $('frame'), n = Deck.sel && S.node(Deck.sel);
    if (!n) { fr.classList.remove('on'); $('stFloat').classList.remove('on'); return; }
    var b = n.box, rot = n.type !== 'group' && !n.decoration; S.last = { type: n.type, x: b.x, y: b.y };
    fr.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;transform:rotate(' + (b.rotationDeg || 0) + 'deg)';
    fr.dataset.k = n.type; if (fr.dataset.s !== n.sourceId + ':' + rot) { fr.innerHTML = EditView.frame(rot); fr.dataset.s = n.sourceId + ':' + rot; }
    fr.classList.add('on'); S.floatAt();
  };
  S.floatAt = function () {
    var f = $('stFloat'), fr = $('frame'), n = Deck.sel && S.node(Deck.sel);
    if (!n || S.g) { f.classList.remove('on'); return; }
    var sb = $('stage').getBoundingClientRect(), r = fr.getBoundingClientRect(), fw = f.offsetWidth || 260, top = r.top - sb.top - 52;
    if (top < 6) top = r.bottom - sb.top + 10;
    f.style.left = Math.max(8, Math.min(sb.width - fw - 8, r.left - sb.left + r.width / 2 - fw / 2)) + 'px'; f.style.top = Math.max(6, Math.min(sb.height - 50, top)) + 'px'; f.classList.add('on');
  };
  S.select = function (id) {
    Deck.sel = id; Quick.tab = null; S.frame();
    var n = id && S.node(id); $('stFloat').innerHTML = n ? EditView.floatBar({ text: !!(n.text && n.text.lines) || n.type === 'text' }) : ''; if (n) S.floatAt(); Quick.render();
  };

  // ---- a box on its own canvas: it is what moves, bounces and turns while the slide behind is drawn without it ---------------------
  function bounds(b) {
    var a = (b.rotationDeg || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return { w: b.w * c + b.h * s, h: b.w * s + b.h * c };
  }
  function liftOf(n) {
    var b = n.box, bd = bounds(b), w = bd.w + PAD * 2, h = bd.h + PAD * 2, cv = document.createElement('canvas'), x = b.centerX - w / 2, y = b.centerY - h / 2;
    cv.width = Math.round(w * S.dpr); cv.height = Math.round(h * S.dpr); cv.className = 'lift'; cv.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    var c = cv.getContext('2d'); c.scale(S.dpr, S.dpr); c.translate(-x, -y); SlideDraw.node(c, n);
    return { el: cv, x: x, y: y, w: w, h: h, n: n };
  }
  S.beginLift = function (n) { S.endLift(); S.draw(n.sourceId); S.lift = liftOf(n); $('lifts').appendChild(S.lift.el); };
  S.endLift = function () { if (S.lift) { S.lift.el.remove(); S.lift = null; } };
  S.bounce = function (n) {
    if (calm && calm.matches || !n || n.type === 'group' && false) return;
    S.beginLift(n); var l = S.lift, a = l.el.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-3px) scale(1.05)', offset: .42 }, { transform: 'translateY(0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    a.onfinish = a.oncancel = function () { if (S.lift === l && !S.g) { S.endLift(); S.draw(); } };
  };

  // ---- two fingers: the slide grows under them (up to 4x), one finger on an empty place moves it, a double tap on an empty place sets it back -----------
  var pts = {}, pinch = null, pan = null, lastBlank = 0;
  function applyZoom() {
    var z = S.zoom, b = $('slideBox'), w = Deck.w, h = Math.round(w * Deck.ratio());
    if (z.k <= 1.001) { z.k = 1; z.x = 0; z.y = 0; }
    z.x = Math.min(0, Math.max(w * (1 - z.k), z.x)); z.y = Math.min(0, Math.max(h * (1 - z.k), z.y));
    b.style.transformOrigin = '0 0'; b.style.transform = z.k === 1 ? '' : 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.k + ')'; b.style.setProperty('--z', z.k); S.floatAt();
  }
  function sharp() {
    var r = S.zoom.k > 1.5 ? Math.min(3, Math.ceil(S.zoom.k)) : 1; if (r === S.res) return;
    S.res = r; S.cv.width = Math.round(Deck.w * S.dpr * r); S.cv.height = Math.round(Math.round(Deck.w * Deck.ratio()) * S.dpr * r); S.ctx = S.cv.getContext('2d'); S.draw();
  }
  S.resetZoom = function (soft) {
    if (S.zoom.k === 1) return; var b = $('slideBox'), from = b.style.transform || 'none'; S.zoom.k = 1; S.zoom.x = 0; S.zoom.y = 0; applyZoom(); sharp();
    if (soft && !(calm && calm.matches)) b.animate([{ transform: from, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
  function pair() { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function pinchStart() {
    if (S.g) { S.g = null; S.endLift(); S.draw(); S.frame(); $('guides').innerHTML = ''; } pan = null;
    var r = $('slideBox').getBoundingClientRect(), p = pair(), z = S.zoom; pinch = { d: p.d, k: z.k, ox: r.left - z.x, oy: r.top - z.y, cx: (p.x - (r.left - z.x) - z.x) / z.k, cy: (p.y - (r.top - z.y) - z.y) / z.k }; $('stFloat').classList.remove('on');
  }
  function pinchMove() {
    var p = pair(), z = S.zoom; z.k = Math.max(1, Math.min(4, pinch.k * p.d / pinch.d)); z.x = p.x - pinch.ox - pinch.cx * z.k; z.y = p.y - pinch.oy - pinch.cy * z.k; applyZoom();
  }
  // Ctrl / Cmd + wheel (a trackpad pinch too): the slide grows about the pointer
  var wheelT = 0;
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey) || !S.tree) return; e.preventDefault();
    var z = S.zoom, r = $('slideBox').getBoundingClientRect(), ox = r.left - z.x, oy = r.top - z.y, cx = (e.clientX - ox - z.x) / z.k, cy = (e.clientY - oy - z.y) / z.k;
    z.k = Math.max(1, Math.min(4, z.k * Math.exp(-Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode ? 5 : 1))) * 0.01))); z.x = e.clientX - ox - cx * z.k; z.y = e.clientY - oy - cy * z.k; applyZoom();
    clearTimeout(wheelT); wheelT = setTimeout(function () { sharp(); S.floatAt(); }, 160);
  }
  function track(e, on) {
    if (e.pointerType === 'mouse') return false;
    if (on) pts[e.pointerId] = { x: e.clientX, y: e.clientY }; else delete pts[e.pointerId];
    return true;
  }

  // ---- touch -------------------------------------------------------------------------------------------------------------------------
  function local(ev) { var r = $('slideBox').getBoundingClientRect(); var k = S.zoom.k; return { x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k }; }
  function inside(n, p) {
    var b = n.box, a = -(b.rotationDeg || 0) * Math.PI / 180, dx = p.x - b.centerX, dy = p.y - b.centerY, x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a), m = 6;
    return Math.abs(x) <= b.w / 2 + m && Math.abs(y) <= b.h / 2 + m;
  }
  function hit(p) {
    var ns = S.tree ? S.tree.nodes : [];
    for (var i = ns.length - 1; i >= 0; i--) { var n = ns[i]; if (n.decoration || n.background) continue; if (inside(n, p)) return n; }
    return null;
  }
  function down(e) {
    if (track(e, true)) { try { $('slideBox').setPointerCapture(e.pointerId); } catch (x) { /* lifted */ } if (Object.keys(pts).length === 2) { pinchStart(); e.preventDefault(); return; } }
    if (pinch) return;
    if (!S.tree || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var p = local(e), h = e.target.dataset && e.target.dataset.h, sel = Deck.sel && S.node(Deck.sel), n = sel, mode = 'move';
    if (h && sel) mode = h === 'rot' ? 'rotate' : 'resize'; else { n = hit(p); if (!n) { var now = Date.now(); if (now - lastBlank < 350) S.resetZoom(true); lastBlank = now; if (S.zoom.k > 1) pan = { id: e.pointerId, x: e.clientX, y: e.clientY, zx: S.zoom.x, zy: S.zoom.y }; if (Deck.sel) S.select(null); return; } }
    var was = Deck.sel === n.sourceId;
    S.g = { id: e.pointerId, mode: mode, h: h, n: n, x0: e.clientX, y0: e.clientY, p0: p, moved: false, was: was, box: Object.assign({}, n.box), dx: 0, dy: 0, nb: Object.assign({}, n.box) };
    try { $('slideBox').setPointerCapture(e.pointerId); } catch (x) { /* the finger already lifted */ }
    if (!was) S.select(n.sourceId);
    S.g.lifted = false; e.preventDefault();
  }
  function move(e) {
    if (pts[e.pointerId]) { pts[e.pointerId].x = e.clientX; pts[e.pointerId].y = e.clientY; }
    if (pinch) { if (Object.keys(pts).length >= 2) pinchMove(); return; }
    if (pan && e.pointerId === pan.id) { S.zoom.x = pan.zx + e.clientX - pan.x; S.zoom.y = pan.zy + e.clientY - pan.y; applyZoom(); return; }
    var g = S.g; if (!g || e.pointerId !== g.id) return;
    var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved && Math.hypot(dx, dy) < TAP) return;
    if (!g.moved) { g.moved = true; $('stFloat').classList.remove('on'); S.beginLift(g.n); }
    var b = g.box, nb = g.nb = Object.assign({}, b), p = local(e);
    if (g.mode === 'move') {
      nb.x = b.x + dx; nb.y = b.y + dy; snap(nb);
    } else if (g.mode === 'rotate') {
      var a = Math.atan2(p.y - b.centerY, p.x - b.centerX) * 180 / Math.PI + 90, st = Math.round(a / 15) * 15; if (Math.abs(a - st) < 3.5) a = st; nb.rotationDeg = ((a % 360) + 360) % 360;
    } else resize(nb, b, dx, dy);
    nb.centerX = nb.x + nb.w / 2; nb.centerY = nb.y + nb.h / 2; paint(nb);
  }
  // slide centre lines and edges pull the box when it comes within a few pixels; the guides show it
  function snap(nb) {
    var W = S.tree.widthPx, H = S.tree.heightPx, T = 5, gx = null, gy = null, cx = nb.x + nb.w / 2, cy = nb.y + nb.h / 2;
    [[cx, W / 2, nb.w / 2], [nb.x, 0, 0], [nb.x + nb.w, W, nb.w]].forEach(function (c) { if (gx === null && Math.abs(c[0] - c[1]) < T) { nb.x = c[1] - c[2]; gx = c[1]; } });
    [[cy, H / 2, nb.h / 2], [nb.y, 0, 0], [nb.y + nb.h, H, nb.h]].forEach(function (c) { if (gy === null && Math.abs(c[0] - c[1]) < T) { nb.y = c[1] - c[2]; gy = c[1]; } });
    var gd = $('guides'); gd.innerHTML = (gx !== null ? '<i class="gv" style="left:' + gx + 'px"></i>' : '') + (gy !== null ? '<i class="gh" style="top:' + gy + 'px"></i>' : '');
  }
  function resize(nb, b, dx, dy) {
    var a = (b.rotationDeg || 0) * Math.PI / 180, lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a), h = S.g.h, hx = /e/.test(h) ? 1 : /w/.test(h) ? -1 : 0, hy = /s/.test(h) ? 1 : /n/.test(h) ? -1 : 0;
    var keep = S.g.n.type === 'picture' && hx && hy, minW = S.g.n.line ? 0 : 14;
    var w = Math.max(minW, b.w + hx * lx), hh = Math.max(S.g.n.line ? 0 : 14, b.h + hy * ly);
    if (keep) { var k = Math.max(w / b.w, hh / b.h); w = b.w * k; hh = b.h * k; }
    var sx = hx * (w - b.w) / 2, sy = hy * (hh - b.h) / 2, cx = b.centerX + sx * Math.cos(a) - sy * Math.sin(a), cy = b.centerY + sx * Math.sin(a) + sy * Math.cos(a);
    nb.w = w; nb.h = hh; nb.x = cx - w / 2; nb.y = cy - hh / 2;
  }
  // the lifted copy and the frame follow the numbers of the new box
  function paint(nb) {
    var fr = $('frame'), l = S.lift, b = S.g.box;
    fr.style.cssText = 'left:' + nb.x + 'px;top:' + nb.y + 'px;width:' + nb.w + 'px;height:' + nb.h + 'px;transform:rotate(' + (nb.rotationDeg || 0) + 'deg)';
    if (!l) return;
    var sx = nb.w / (b.w || 1), sy = nb.h / (b.h || 1), plain = !b.rotationDeg;
    if (S.g.mode === 'rotate') l.el.style.transform = 'rotate(' + ((nb.rotationDeg || 0) - (b.rotationDeg || 0)) + 'deg)';
    else if (S.g.mode === 'resize' && plain) { l.el.style.transformOrigin = '0 0'; l.el.style.transform = 'translate(' + (nb.x - b.x) + 'px,' + (nb.y - b.y) + 'px) translate(' + PAD * (1 - sx) + 'px,' + PAD * (1 - sy) + 'px) scale(' + sx + ',' + sy + ')'; }
    else l.el.style.transform = 'translate(' + (nb.centerX - b.centerX) + 'px,' + (nb.centerY - b.centerY) + 'px)';
  }
  function up(e) {
    track(e, false);
    if (pinch) { if (Object.keys(pts).length < 2) { pinch = null; sharp(); S.floatAt(); } return; }
    if (pan && e.pointerId === pan.id) { pan = null; return; }
    var g = S.g; if (!g || e.pointerId !== g.id) return; S.g = null; $('guides').innerHTML = '';
    if (e.type === 'pointercancel') { S.endLift(); S.draw(); S.frame(); return; }
    if (!g.moved) { S.endLift(); S.tap(g.n, g.was); return; }
    S.commit(g.n, g.nb);
  }
  // the box was moved: the engine takes the new place, then the slide is drawn again from its answer
  S.commit = async function (n, nb) {
    var k = Deck.k(), e = Math.round, el = n.sourceId;
    var op = Deck.op('setTransform', el, { box: { x: e(nb.x * k), y: e(nb.y * k), cx: e(nb.w * k), cy: e(nb.h * k) }, rotDeg: Math.round((nb.rotationDeg || 0) * 10) / 10 });
    var ok = await Viewer.run([op], 'busy.edit'); if (!ok) { S.endLift(); S.draw(); S.frame(); }
  };
  S.tap = function (n, was) {
    var now = Date.now(), twice = was && S.lastTap.id === n.sourceId && now - S.lastTap.at < 380;
    S.lastTap = { at: now, id: n.sourceId }; S.floatAt(); S.bounce(n);
    if (twice && n.text && n.type !== 'picture') Text.open(true);
  };

  S.init = function () {
    $('stage').addEventListener('wheel', onWheel, { passive: false }); var ov = $('slideBox'); ov.addEventListener('pointerdown', down); ov.addEventListener('pointermove', move); ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    window.addEventListener('resize', function () { if (Deck.info && Router.getCurrent() === 'deck') { S.layout(); S.show(); } });
  };
  A['f-go'] = function (el) { Slides.go(+el.dataset.i); };
})();
