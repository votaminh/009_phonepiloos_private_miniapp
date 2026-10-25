// Read — the document page: the continuous list of pages (drawn only near the screen), the page counter and scroll thumb, zoom, the mode of the tools, and the layers each mode paints over the pages.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var R = window.Read = { mode: 'read', list: null, layers: [], tops: [], hintFn: null };
  var pillT = 0, lastTap = 0;

  // ---- the list --------------------------------------------------------------------------------------------------------------
  R.reset = function () { if (R.list) { R.list.destroy(); R.list = null; } $('rdHost').innerHTML = ''; $('rdHost').style.height = 'auto'; R.mode = 'read'; };
  function measure() { var y = 0; R.tops = Doc.sizes.map(function (_, i) { var v = y; y += Doc.rowH(i); return v; }); R.tops.push(y); $('rdHost').style.width = Doc.hostW() + 'px'; }
  R.mount = function () {
    var sc = $('rdScroll'); Doc.viewW = sc.clientWidth || Doc.viewW; measure(); sc.scrollTop = 0; sc.scrollLeft = 0;
    if (R.list) R.list.destroy();
    R.list = VList.mount(sc, $('rdHost'), {
      count: function () { return Doc.sizes.length; }, height: function (i) { return Doc.rowH(i); }, cls: function () { return 'rdrow'; },
      html: function (i) { return ReadView.page(i, Doc.pageW(), Doc.pageH(i)); }, onBind: function (el, i) { R.paint(el.firstChild, i); }
    });
    R.counter();
  };
  // the document changed (an edit, a page added): sizes and drawings are new, the scroll position stays
  R.reload = function () { if (!R.list) return; measure(); R.list.relayout(); R.counter(); R.chrome(); };
  R.pg = function (i) { return $('rdHost').querySelector('.pg[data-p="' + i + '"]'); };
  R.each = function (fn) { Array.prototype.forEach.call($('rdHost').querySelectorAll('.pg'), function (el) { fn(el, +el.dataset.p); }); };

  // one page: the canvas gets the engine's picture a moment after the row appears (a fast scroll never queues pages that already left)
  R.paint = function (el, i) {
    var cv = el.querySelector('.pc'), dpr = Doc.dpr(), g = Doc.gen;
    cv.width = Math.round(Doc.pageW() * dpr); cv.height = Math.round(Doc.pageH(i) * dpr); R.ov(el, i);
    var pv = Doc.previous(i); if (pv) { try { cv.getContext('2d').drawImage(pv, 0, 0, cv.width, cv.height); el.classList.add('rdy'); } catch (e) { /* closed */ } }
    setTimeout(function () {
      if (!el.isConnected || +el.dataset.p !== i || g !== Doc.gen) return;
      Doc.bitmap(i).then(function (bm) {
        if (!el.isConnected || +el.dataset.p !== i || g !== Doc.gen) return;
        try { cv.getContext('2d').drawImage(bm, 0, 0); el.classList.add('rdy'); } catch (e) { /* the picture was dropped from the cache: the next bind draws it again */ }
      }).catch(function () { el.classList.add('rdy'); });
    }, 50);
  };
  R.ov = function (el, i) { var ov = el.querySelector('.ov'); ov.innerHTML = ''; R.layers.forEach(function (fn) { fn(ov, i, el); }); };
  R.repaint = function () { R.each(function (el, i) { R.ov(el, i); }); };

  // ---- coordinates: PDF points (origin bottom left, page not turned) <-> css pixels on the page as shown (a page can carry /Rotate 90, 180, 270) ------------------------
  function dims(i) { var z = Doc.sizes[i], r = z[2] || 0; return r % 180 ? { w0: z[1], h0: z[0], r: r } : { w0: z[0], h0: z[1], r: r }; }
  function toDisp(i, x, y) { var d = dims(i); return d.r === 90 ? [y, x] : d.r === 180 ? [d.w0 - x, y] : d.r === 270 ? [d.h0 - y, d.w0 - x] : [x, d.h0 - y]; }
  function fromDisp(i, x, y) { var d = dims(i); return d.r === 90 ? [y, x] : d.r === 180 ? [d.w0 - x, y] : d.r === 270 ? [d.w0 - y, d.h0 - x] : [x, d.h0 - y]; }
  R.rot = function (i) { return Doc.sizes[i][2] || 0; };
  R.box = function (i, r) {
    var s = Doc.scale(i), a = toDisp(i, r[0], r[1]), b = toDisp(i, r[2], r[3]);
    return { l: Math.min(a[0], b[0]) * s, t: Math.min(a[1], b[1]) * s, w: Math.abs(b[0] - a[0]) * s, h: Math.abs(b[1] - a[1]) * s };
  };
  R.pdf = function (i, x, y) { var s = Doc.scale(i); return fromDisp(i, x / s, y / s); };
  // a move on the page as shown (dx right, dy down, in css pixels) as a move in PDF points
  R.vec = function (i, dx, dy) { var s = Doc.scale(i), r = R.rot(i), x = dx / s, y = dy / s; return r === 90 ? [y, x] : r === 180 ? [-x, y] : r === 270 ? [-y, -x] : [x, -y]; };
  R.local = function (el, ev) { var b = el.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
  R.pageOf = function (target) { var el = target.closest && target.closest('.pg'); return el ? { el: el, i: +el.dataset.p } : null; };
  R.current = function () { var sc = $('rdScroll'); return Math.max(0, Math.min(Doc.sizes.length - 1, Doc.pageAt(sc.scrollTop + sc.clientHeight / 3 - $('rdHost').offsetTop, R.tops))); };
  R.goto = function (i, y) { var sc = $('rdScroll'); sc.scrollTo({ top: Math.max(0, $('rdHost').offsetTop + R.tops[i] + (y || 0) - 60), behavior: 'smooth' }); };

  // ---- counter, thumb ----------------------------------------------------------------------------------------------------------
  R.counter = function () {
    var sc = $('rdScroll'), n = Doc.sizes.length; if (!n) return;
    $('rdPill').innerHTML = ReadView.pill(R.current(), n);
    var max = sc.scrollHeight - sc.clientHeight, th = $('rdThumb'), h = Math.max(36, sc.clientHeight * sc.clientHeight / Math.max(sc.scrollHeight, 1));
    th.style.height = h + 'px'; th.style.transform = 'translateY(' + (max > 0 ? (sc.scrollTop / max) * (sc.clientHeight - h) : 0) + 'px)';
  };
  function onScroll() {
    R.counter(); R.floatAt(); if (window.Desk) Desk.sync();
    var p = $('rdPill'), th = $('rdThumb'); p.classList.add('on'); th.classList.add('on'); clearTimeout(pillT);
    pillT = setTimeout(function () { p.classList.remove('on'); th.classList.remove('on'); }, 1100);
  }

  R.zmin = function () { return window.Wide && Wide.pc ? 0.25 : 1; }; R.zmax = function () { return window.Wide && Wide.pc ? 4 : 3; };
  // ---- zoom: two fingers, or two quick taps in reading mode ---------------------------------------------------------------
  function zoomTo(z, mx, my) {
    var sc = $('rdScroll'), old = Doc.pageW(); z = Math.max(R.zmin(), Math.min(R.zmax(), z)); if (z === Doc.zoom) return;
    var cx = sc.scrollLeft + mx, cy = sc.scrollTop + my; Doc.zoom = z; Doc.reset(Doc.sizes);
    var k = Doc.pageW() / old; measure(); R.list.relayout(); sc.scrollLeft = cx * k - mx; sc.scrollTop = cy * k - my; R.counter(); R.floatAt();
  }
  R.zoomTo = zoomTo;
  function pinch() {
    var sc = $('rdScroll'), pts = {}, start = 0, z0 = 1, mid = null;
    function dist() { var k = Object.keys(pts); return Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); }
    sc.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') return; pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (Object.keys(pts).length === 2) { start = dist(); z0 = Doc.zoom; var b = sc.getBoundingClientRect(), k = Object.keys(pts); mid = { x: (pts[k[0]].x + pts[k[1]].x) / 2 - b.left, y: (pts[k[0]].y + pts[k[1]].y) / 2 - b.top }; } });
    sc.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pts).length === 2 && start) { var r = Math.max(1 / z0, Math.min(3 / z0, dist() / start)); $('rdHost').style.transformOrigin = (sc.scrollLeft + mid.x) + 'px ' + (sc.scrollTop + mid.y) + 'px'; $('rdHost').style.transform = 'scale(' + r + ')'; sc.dataset.pz = String(r); }
    });
    function end(e) {
      if (!pts[e.pointerId]) return; delete pts[e.pointerId];
      if (start && Object.keys(pts).length < 2) { var r = +sc.dataset.pz || 1; start = 0; sc.dataset.pz = ''; $('rdHost').style.transform = ''; if (Math.abs(r - 1) > 0.03 && mid) zoomTo(z0 * r, mid.x, mid.y); }
    }
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    // on a computer: Ctrl / Cmd + wheel (a trackpad pinch too), applied once per frame
    var acc = 1, at = null, raf = 0;
    sc.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
      var b = sc.getBoundingClientRect(); acc *= Math.exp(-Math.max(-60, Math.min(60, e.deltaY * (e.deltaMode ? 16 : 1))) * 0.0005); at = { x: e.clientX - b.left, y: e.clientY - b.top };
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; var f = acc; acc = 1; if (Math.abs(f - 1) > 0.002) { zoomTo(Doc.zoom * f, at.x, at.y); if (window.Desk) Desk.sync(); } });
    }, { passive: false });
  }

  R.zoomTo = function (z, mx, my) { var sc = $('rdScroll'); if (!R.list) return; zoomTo(z, mx == null ? sc.clientWidth / 2 : mx, my == null ? sc.clientHeight / 2 : my); };
  // the room for the pages changed (a panel opened, the window resized): measure again and lay the list out
  R.refit = function () { var sc = $('rdScroll'), w = sc.clientWidth; if (R.list && w) { Doc.viewW = w; Doc.reset(Doc.sizes); measure(); R.list.relayout(); R.counter(); } };
  // ---- modes -------------------------------------------------------------------------------------------------------------------
  R.setMode = function (m) {
    R.mode = m; $('pgDoc').dataset.mode = m; Text.clear(); R.chrome(); R.repaint(); R.floatAt();
  };
  R.chrome = function () {
    var m = R.mode, o = { mode: m, tool: Mark.tool, color: Mark.color, marks: Mark.marks.length, area: Mark.area };
    $('pgDoc').dataset.tool = Mark.tool; $('pgDoc').dataset.area = String(Mark.area); Viewer.chrome(); $('docTools').innerHTML = Sign.active ? ReadView.sigBar() : ReadView.tools(m, o);
    var h = $('docHint'), msg = R.hintFn ? R.hintFn(m) : null; h.classList.toggle('hidden', !msg); h.innerHTML = msg ? ReadView.hint(msg.text, msg.act, msg.label) : '';
  };
  R.busy = function (text) { var b = $('rdBusy'); b.innerHTML = ReadView.busy(text); b.classList.remove('hidden'); };
  R.idle = function () { $('rdBusy').classList.add('hidden'); };

  // ---- the bar that follows the selected block ---------------------------------------------------------------------------------
  R.floatAt = function () {
    var f = $('rdFloat'), el = Text.selEl && Text.selEl();
    if (!el || !el.isConnected) { f.classList.remove('on'); return; }
    var w = $('rdWrap').getBoundingClientRect(), b = el.getBoundingClientRect(), fw = f.offsetWidth || 220, fh = 44;
    var top = b.top - w.top - fh - 8; if (top < 4) top = b.bottom - w.top + 8;
    var left = Math.max(8, Math.min(w.width - fw - 8, b.left - w.left + b.width / 2 - fw / 2));
    f.style.left = left + 'px'; f.style.top = Math.max(4, Math.min(w.height - fh - 4, top)) + 'px'; f.classList.add('on');
  };

  function onTap(ev) {
    var now = Date.now();
    if (R.mode === 'read' && !ev.target.closest('[data-act]')) {
      if (now - lastTap < 300) { var b = $('rdScroll').getBoundingClientRect(); zoomTo(Doc.zoom > 1.2 ? 1 : 2, ev.clientX - b.left, ev.clientY - b.top); lastTap = 0; return; }
      lastTap = now;
    }
    var p = R.pageOf(ev.target); if (!p) return;
    if (R.mode === 'text') Text.tap(ev, p); else if (R.mode === 'add') Text.addAt(ev, p);
  }

  R.init = function () {
    var sc = $('rdScroll'); sc.addEventListener('scroll', onScroll, { passive: true }); sc.addEventListener('click', onTap); pinch();
    window.addEventListener('resize', function () { if (R.list && Router.getCurrent() === 'doc') { var w = sc.clientWidth; if (w && w !== Doc.viewW) { Doc.viewW = w; Doc.reset(Doc.sizes); measure(); R.list.relayout(); } } });
  };

  // ---- mode buttons --------------------------------------------------------------------------------------------------------------
  A['m-text'] = function () { R.setMode('text'); };
  A['m-add'] = function () { R.setMode('add'); };
  A['m-annot'] = function () { R.setMode('annot'); };
  A['m-redact'] = function () { R.setMode('redact'); };
  A['m-done'] = function () { if (Sign.active) return Sign.cancel(); Mark.clear(); R.setMode('read'); };
  A['m-sign'] = function () { Sign.open(); };
  A['m-pages'] = function () { Pages.open(); };
  A['d-undo'] = async function () { if (!Doc.canUndo()) return; Text.clear(); if (await Doc.undo()) { R.reload(); Viewer.touch(); } };
  A['d-redo'] = async function () { if (!Doc.canRedo()) return; Text.clear(); if (await Doc.redoStep()) { R.reload(); Viewer.touch(); } };
})();
