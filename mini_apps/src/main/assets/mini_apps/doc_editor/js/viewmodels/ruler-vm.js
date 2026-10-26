// Ruler — the horizontal ruler over the sheet (Print Layout, mouse): centimetres, the margins shaded, and the three indent markers of the paragraph under the caret — first line, left (hanging) and right.
// Dragging a marker sets that indent through Para.set when the pointer is released.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, R = window.Ruler = { type: 'left' }, drag = null, tm = 0, CM = 567, PXT = 15;
  function on() { return Wide.pc && Doc.mode === 'edit' && window.Paginate && Paginate.active() && Paginate.g && Store.prefs().ruler !== false; }
  function host() { var h = $('ruler'); if (!h) { h = document.createElement('div'); h.id = 'ruler'; h.className = 'ruler'; h.setAttribute('aria-hidden', 'true'); h.innerHTML = '<div class="rl-track"></div>'; $('docBody').insertBefore(h, $('docBody').firstChild); } return h; }
  function scale() { var p = Doc.paper(); return p.getBoundingClientRect().width / (Paginate.W || Paginate.g.w); }
  function geo() { return Paginate.geoFor(window.Edit && Edit.block()) || Paginate.g; }   // the sheet of the section the caret is in   // screen px per sheet px
  R.update = function () {
    var band = host(), h = band.firstChild; if (!on()) { band.style.display = 'none'; V.hide(); return; } if (drag || mdrag) return;   // not while a marker or a margin is being dragged: the handle under the pointer must stay
    var g = geo(), s = g.s, sc = scale(), p = Doc.paper(), b = $('docBody'), pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(), W = g.w * sc;
    var bcs = getComputedStyle(b), pt = parseFloat(bcs.paddingTop) || 0, pl = parseFloat(bcs.paddingLeft) || 0, pR = parseFloat(bcs.paddingRight) || 0;
    band.style.cssText = 'display:block;top:-' + pt + 'px;margin:-' + pt + 'px -' + pR + 'px 10px -' + pl + 'px;padding:' + pt + 'px ' + pR + 'px 0 ' + pl + 'px;height:' + (pt + 22) + 'px';   // the band covers the stage above and beside the sheet, so the text scrolls under it
    h.style.marginLeft = Math.round(pr.left + g.xoff * sc - (br.left + (parseFloat(getComputedStyle(b).paddingLeft) || 0) - b.scrollLeft)) + 'px'; h.style.width = W + 'px';   // in the flow above the sheet: only its distance from the left edge is set
    var cmPx = CM * (1 / PXT) * sc, html = '<b class="rl-mh" data-e="l" data-i="' + g.i + '" title="' + Ui.esc(t('rl.margin')) + '" style="left:' + g.ml * sc + 'px"></b><b class="rl-mh" data-e="r" data-i="' + g.i + '" title="' + Ui.esc(t('rl.margin')) + '" style="left:' + (W - g.mr * sc) + 'px"></b><div class="rl-m" style="width:' + g.ml * sc + 'px"></div><div class="rl-m r" style="width:' + g.mr * sc + 'px"></div>', n = Math.floor(s.w / CM);
    for (var i = 0; i <= n; i++) { var x = i * cmPx; html += '<i class="rl-t" style="left:' + x + 'px"></i>' + (i && i < n ? '<span class="rl-n" style="left:' + x + 'px">' + (i) + '</span>' : '') + (i < n ? '<i class="rl-t h" style="left:' + (x + cmPx / 2) + 'px"></i>' : ''); }
    var c = window.Para && Para.read(); if (c) R.last = c; else c = R.last || { il: 0, fi: 0, ir: 0, tabs: [] };   // with no caret in the text the markers keep the last paragraph they showed
    if (c) {
      var L = g.ml * sc, il = c.il / PXT * sc, fi = c.fi / PXT * sc, ir = c.ir / PXT * sc;
      html += '<b class="rl-k first" data-k="fi" style="left:' + (L + il + fi) + 'px"></b><b class="rl-k left" data-k="il" style="left:' + (L + il) + 'px"></b><b class="rl-k right" data-k="ir" style="left:' + (W - g.mr * sc - ir) + 'px"></b>';
    }
    if (c) c.tabs.forEach(function (tb, i) { if (tb.val === 'clear' || tb.val === 'bar') return; html += '<b class="rl-tab ' + (tb.val || 'left') + '" data-i="' + i + '" style="left:' + (g.ml * sc + tb.pos / PXT * sc) + 'px"></b>'; });
    html += '<button type="button" class="rl-type" data-k="type" title="' + Ui.esc(Ui.t('rl.tab')) + '">' + (R.type === 'center' ? 'C' : R.type === 'right' ? 'R' : 'L') + '</button>';
    h.innerHTML = html; V.update(pr, br, b, sc);
  };
  // ---- the vertical ruler: left of every sheet that is on screen, zero at the top margin, centimetres counted both ways; the margins are shaded
  var V = {
    el: function () { var v = $('vruler'); if (!v) { v = document.createElement('div'); v.id = 'vruler'; v.className = 'vruler'; v.setAttribute('aria-hidden', 'true'); $('docBody').appendChild(v); } return v; },
    hide: function () { var v = $('vruler'); if (v) v.style.display = 'none'; },
    update: function (pr, br, b, sc) {
      var v = V.el(), pgs = Paginate.pgs || [], html = '', cm = CM / PXT * sc, top0 = pr.top - br.top + b.scrollTop, view0 = b.scrollTop - 200, view1 = b.scrollTop + b.clientHeight + 200;
      var left = pr.left - br.left + b.scrollLeft + (pgs[0] ? pgs[0].g.xoff * sc : 0) - 26;
      if (left < 2) { v.style.display = 'none'; return; }
      pgs.forEach(function (pg) {
        var g = pg.g, y = top0 + pg.y * sc, h = g.h * sc; if (y + h < view0 || y > view1) return;
        var mt = g.mt * sc, mb = g.mb * sc;
        html += '<div class="vr-p" style="top:' + y + 'px;height:' + h + 'px;left:' + (g.xoff - (pgs[0] ? pgs[0].g.xoff : 0)) * sc + 'px"><div class="vr-m" style="height:' + mt + 'px"></div><div class="vr-m b" style="height:' + mb + 'px"></div><b class="vr-h" data-e="t" data-i="' + g.i + '" title="' + Ui.esc(t('rl.margin')) + '" style="top:' + mt + 'px"></b><b class="vr-h" data-e="b" data-i="' + g.i + '" title="' + Ui.esc(t('rl.margin')) + '" style="top:' + (h - mb) + 'px"></b>';
        for (var i = -Math.floor(mt / cm); mt + i * cm <= h; i++) {
          var yy = mt + i * cm; if (yy < 0) continue; html += '<i class="vr-t" style="top:' + yy + 'px"></i>' + (i ? '<span class="vr-n" style="top:' + yy + 'px">' + Math.abs(i) + '</span>' : '') + (mt + (i + 0.5) * cm <= h && mt + (i + 0.5) * cm >= 0 ? '<i class="vr-t h" style="top:' + (yy + cm / 2) + 'px"></i>' : '');
        }
        html += '</div>';
      });
      v.style.display = 'block'; v.style.left = left + 'px'; v.innerHTML = html;
    }
  };
  // ---- dragging a margin: the boundary of the shaded part, on either ruler. The shading follows the pointer; the margin is written when it is released (rounded to 0.1 cm, at least 2 cm of page left)
  var MIN = 1134, mdrag = null;
  function log() { if (window.RULER_LOG !== false) console.log.apply(console, ['[ruler]'].concat([].slice.call(arguments))); }   // pointer trace for the margin handles (window.RULER_LOG = false switches it off)
  document.addEventListener('pointerdown', function (e) { var r = $('ruler'), v = $('vruler'); if (!r && !v) return; var at = document.elementFromPoint(e.clientX, e.clientY); if ((r && r.contains(e.target)) || (v && v.contains(e.target)) || (at && ((r && r.contains(at)) || (v && v.contains(at))))) log('pointerdown', 'x=' + Math.round(e.clientX), 'y=' + Math.round(e.clientY), 'target=' + (e.target.className || e.target.tagName), 'under=' + (at && (at.className || at.tagName)), 'btn=' + e.button, 'type=' + e.pointerType); }, true);
  document.addEventListener('pointerdown', function (e) {
    var hd = e.target.closest && e.target.closest('.rl-mh, .vr-h'); if (!hd || !window.PageSetup) return; var s = Sec.list()[+hd.dataset.i]; if (!s) return;
    log('handle grabbed', hd.dataset.e, 'section', hd.dataset.i, 'margin', s[hd.dataset.e]); e.preventDefault(); e.stopPropagation(); var ed = hd.dataset.e, vert = ed === 't' || ed === 'b';
    mdrag = { el: hd, e: ed, vert: vert, i: +hd.dataset.i, s: s, x0: vert ? e.clientY : e.clientX, at: parseFloat(vert ? hd.style.top : hd.style.left), sh: hd.parentNode.querySelector(vert ? (ed === 't' ? '.vr-m:not(.b)' : '.vr-m.b') : (ed === 'l' ? '.rl-m:not(.r)' : '.rl-m.r')), tw: s[ed] };
    hd.setPointerCapture && hd.setPointerCapture(e.pointerId); hd.classList.add('on'); document.body.classList.add(vert ? 'rl-drag-v' : 'rl-drag-h');
  }, true);
  function mval(d, px) {   // the new margin (twips) for a pointer move of px screen pixels
    var s = d.s, sign = d.e === 'l' || d.e === 't' ? 1 : -1, other = d.vert ? (d.e === 't' ? s.b : s.t) : (d.e === 'l' ? s.r : s.l), size = d.vert ? s.h : s.w;
    return Math.max(0, Math.min(size - other - MIN, Math.round((d.tw + sign * px / scale() * PXT) / 57) * 57));
  }
  document.addEventListener('pointermove', function (e) {
    if (!mdrag) return; var d = mdrag, px = (d.vert ? e.clientY : e.clientX) - d.x0, nv = mval(d, px); log('move', d.e, 'dx=' + px, 'margin ->', nv); var diff = (nv - d.tw) / PXT * scale(), sign = d.e === 'l' || d.e === 't' ? 1 : -1;
    d.el.style[d.vert ? 'top' : 'left'] = (d.at + sign * diff) + 'px';   // the handle follows the pointer; the shaded part grows by the change of the margin
    if (d.sh) { if (d.base === undefined) d.base = parseFloat(d.sh.style[d.vert ? 'height' : 'width']) || 0; d.sh.style[d.vert ? 'height' : 'width'] = Math.max(0, d.base + diff) + 'px'; }
  });
  document.addEventListener('pointerup', function (e) {
    if (!mdrag) return; var d = mdrag; mdrag = null; document.body.classList.remove('rl-drag-v', 'rl-drag-h'); d.el.classList.remove('on');
    var nv = mval(d, (d.vert ? e.clientY : e.clientX) - d.x0), m = {}; log('released', d.e, d.tw, '->', nv); if (nv === d.tw) return R.update(); m[d.e] = nv; PageSetup.setMargins(d.i, m);
  }, true);
  function px2tw(dx) { return Math.round(dx / scale() * PXT / 20) * 20; }
  document.addEventListener('pointerdown', function (e) {
    var ty = e.target.closest && e.target.closest('.rl-type'); if (ty) { e.preventDefault(); R.type = R.type === 'left' ? 'center' : R.type === 'left' ? 'right' : R.type === 'center' ? 'right' : 'left'; ty.textContent = R.type === 'center' ? 'C' : R.type === 'right' ? 'R' : 'L'; return; }
    var tb = e.target.closest && e.target.closest('.rl-tab'); if (tb && window.Para) { e.preventDefault(); var cc = Para.read(); if (!cc) return; drag = { k: 'tab', i: +tb.dataset.i, x0: e.clientX, y0: e.clientY, c: cc, el: tb, left0: parseFloat(tb.style.left) }; tb.classList.add('on'); return; }
    var rl = e.target.closest && !e.target.closest('.rl-k') ? e.target.closest('.rl-track') : null; if (rl && window.Para) {   // a click on the bare ruler puts a tab stop there
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
