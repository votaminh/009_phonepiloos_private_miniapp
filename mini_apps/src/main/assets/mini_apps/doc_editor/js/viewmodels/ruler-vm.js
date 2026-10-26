// Ruler — the horizontal ruler over the sheet (Print Layout, mouse): centimetres, the margins shaded, and the three indent markers of the paragraph under the caret — first line, left (hanging) and right.
// Dragging a marker sets that indent through Para.set when the pointer is released.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, R = window.Ruler = { type: 'left' }, drag = null, tm = 0, CM = 567, PXT = 15;
  function on() { return Wide.pc && Doc.mode === 'edit' && window.Paginate && Paginate.active() && Paginate.g && Store.prefs().ruler !== false; }
  function host() { var h = $('ruler'); if (!h) { h = document.createElement('div'); h.id = 'ruler'; h.className = 'ruler'; h.setAttribute('aria-hidden', 'true'); $('docBody').insertBefore(h, $('docBody').firstChild); } return h; }
  function scale() { var p = Doc.paper(); return p.getBoundingClientRect().width / (Paginate.W || Paginate.g.w); }
  function geo() { return Paginate.geoFor(window.Edit && Edit.block()) || Paginate.g; }   // the sheet of the section the caret is in   // screen px per sheet px
  R.update = function () {
    var h = host(); if (!on()) { h.style.display = 'none'; return; } if (drag) return;
    var g = geo(), s = g.s, sc = scale(), p = Doc.paper(), b = $('docBody'), pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(), W = g.w * sc;
    h.style.display = 'block'; h.style.left = (pr.left - br.left + b.scrollLeft + g.xoff * sc) + 'px'; h.style.width = W + 'px';
    var cmPx = CM * (1 / PXT) * sc, html = '<div class="rl-m" style="width:' + g.ml * sc + 'px"></div><div class="rl-m r" style="width:' + g.mr * sc + 'px"></div>', n = Math.floor(s.w / CM);
    for (var i = 0; i <= n; i++) { var x = i * cmPx; html += '<i class="rl-t" style="left:' + x + 'px"></i>' + (i && i < n ? '<span class="rl-n" style="left:' + x + 'px">' + (i) + '</span>' : '') + (i < n ? '<i class="rl-t h" style="left:' + (x + cmPx / 2) + 'px"></i>' : ''); }
    var c = window.Para && Para.read(); if (c) {
      var L = g.ml * sc, il = c.il / PXT * sc, fi = c.fi / PXT * sc, ir = c.ir / PXT * sc;
      html += '<b class="rl-k first" data-k="fi" style="left:' + (L + il + fi) + 'px"></b><b class="rl-k left" data-k="il" style="left:' + (L + il) + 'px"></b><b class="rl-k right" data-k="ir" style="left:' + (W - g.mr * sc - ir) + 'px"></b>';
    }
    if (c) c.tabs.forEach(function (tb, i) { if (tb.val === 'clear' || tb.val === 'bar') return; html += '<b class="rl-tab ' + (tb.val || 'left') + '" data-i="' + i + '" style="left:' + (g.ml * sc + tb.pos / PXT * sc) + 'px"></b>'; });
    html += '<button type="button" class="rl-type" data-k="type" title="' + Ui.esc(Ui.t('rl.tab')) + '">' + (R.type === 'center' ? 'C' : R.type === 'right' ? 'R' : 'L') + '</button>';
    h.innerHTML = html;
  };
  function px2tw(dx) { return Math.round(dx / scale() * PXT / 20) * 20; }
  document.addEventListener('pointerdown', function (e) {
    var ty = e.target.closest && e.target.closest('.rl-type'); if (ty) { e.preventDefault(); R.type = R.type === 'left' ? 'center' : R.type === 'left' ? 'right' : R.type === 'center' ? 'right' : 'left'; ty.textContent = R.type === 'center' ? 'C' : R.type === 'right' ? 'R' : 'L'; return; }
    var tb = e.target.closest && e.target.closest('.rl-tab'); if (tb && window.Para) { e.preventDefault(); var cc = Para.read(); if (!cc) return; drag = { k: 'tab', i: +tb.dataset.i, x0: e.clientX, y0: e.clientY, c: cc, el: tb, left0: parseFloat(tb.style.left) }; tb.classList.add('on'); return; }
    var rl = e.target.closest && !e.target.closest('.rl-k') ? e.target.closest('#ruler') : null; if (rl && window.Para) {   // a click on the bare ruler puts a tab stop there
      var c0 = Para.read(); if (!c0) return; var g = geo(), tw = Math.round(((e.clientX - rl.getBoundingClientRect().left) / scale() - g.ml) * PXT / 90) * 90; if (tw <= 0) return;
      e.preventDefault(); var list = c0.tabs.slice(); list.push({ pos: tw, val: R.type, leader: 'none' }); list.sort(function (a, b) { return a.pos - b.pos; }); Para.set({ tabs: list }); return;
    }
    var k = e.target.closest && e.target.closest('.rl-k'); if (!k || !window.Para) return; e.preventDefault(); var c = Para.read(); if (!c) return;
    drag = { k: k.dataset.k, x0: e.clientX, c: c, el: k, left0: parseFloat(k.style.left) }; k.setPointerCapture && k.setPointerCapture(e.pointerId); k.classList.add('on');
  });
  document.addEventListener('pointermove', function (e) { if (!drag) return; if (drag.k === 'tab') { drag.el.style.left = (drag.left0 + e.clientX - drag.x0) + 'px'; drag.el.style.opacity = Math.abs(e.clientY - drag.y0) > 24 ? '.3' : ''; return; } drag.el.style.left = (drag.left0 + e.clientX - drag.x0) + 'px'; });
  document.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag, dx = px2tw(e.clientX - d.x0), c = d.c, p = {}; drag = null;
    if (d.k === 'tab') { var l = c.tabs.slice(), tb = l[d.i]; if (!tb) return R.update(); if (Math.abs(e.clientY - d.y0) > 24) l.splice(d.i, 1); else tb.pos = Math.max(0, Math.round((tb.pos + dx) / 90) * 90); l.sort(function (a, b) { return a.pos - b.pos; }); Para.set({ tabs: l }); R.update(); return; }
    if (d.k === 'il') { p.il = Math.max(0, c.il + dx); p.fi = c.fi; } else if (d.k === 'fi') { p.fi = Math.max(-c.il, c.fi + dx); } else { p.ir = Math.max(0, c.ir - dx); }
    Para.set(p); R.update();
  });
  var run0 = Paginate.run; Paginate.run = function () { run0.apply(this, arguments); R.update(); };
  function later() { clearTimeout(tm); tm = setTimeout(R.update, 80); }
  document.addEventListener('selectionchange', later); window.addEventListener('resize', later); $('docBody').addEventListener('scroll', later, { passive: true });
  var set0 = Para.set; Para.set = function () { var r = set0.apply(this, arguments); later(); return r; };
})();
