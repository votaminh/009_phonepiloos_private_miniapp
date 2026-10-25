// XPage — the sheet as it prints: paper size, margins, scale, page breaks, header and footer, cut into pages that each hold a block of rows and columns. Read only; the button in the title bar switches back to the grid, and the choice is kept.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)'), esc = Ui.esc;
  var PAPER = { 1: [8.5, 11], 5: [8.5, 14], 7: [7.25, 10.5], 8: [11.69, 16.54], 9: [8.27, 11.69], 11: [5.83, 8.27], 13: [7.17, 10.12] };
  var X = window.XPage = { on: false, sig: '', total: 0, maxW: 0, pz: 0 };
  function still() { return calm && calm.matches; }
  function version() { return Wb.on + ':' + Wb.hist.length + ':' + Wb.at; }
  // header / footer codes: &L &C &R halves, &P page, &N pages, &D date, &T time, &F file, &A sheet; font codes are dropped
  function hf(code, ctx) {
    if (!code) return ''; var parts = { L: '', C: '', R: '' }, at = 'C', out = code.replace(/&&/g, '\u0001').split(/(&[LCR])/);
    out.forEach(function (x) { if (/^&[LCR]$/.test(x)) { at = x[1]; return; } parts[at] += x; });
    function fix(s) { return s.replace(/&P|&\[Page\]/g, ctx.page).replace(/&N|&\[Pages\]/g, ctx.total).replace(/&D|&\[Date\]/g, new Date().toLocaleDateString(I18n.locale())).replace(/&T|&\[Time\]/g, new Date().toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' })).replace(/&F|&\[File\]/g, ctx.file).replace(/&A|&\[Tab\]/g, ctx.sheet).replace(/&"[^"]*"|&\d+|&[BIUSEXYK][0-9A-Fa-f]{0,6}/g, '').replace(/\u0001/g, '&'); }
    return '<span>' + esc(fix(parts.L)) + '</span><span>' + esc(fix(parts.C)) + '</span><span>' + esc(fix(parts.R)) + '</span>';
  }
  function chunks(sizes, limit, breaks, from, to) {
    var out = [], cur = [], sum = 0;
    for (var i = from; i <= to; i++) {
      if (cur.length && sum + sizes[i] > limit) { out.push(cur); cur = []; sum = 0; }
      cur.push(i); sum += sizes[i]; if (breaks.indexOf(i + 1) >= 0 && i < to) { out.push(cur); cur = []; sum = 0; }
    }
    if (cur.length) out.push(cur); return out;
  }
  // a long text runs on over the empty cells to its right on the page too
  function spill(sh, r, c, text, st, w, colW, cc) {
    var need = text.length * (st.sz || 11) * 0.62 + 12; if (need <= w) return false;
    for (var k = c + 1, total = w; cc.indexOf(k) >= 0 && total < need; k++) { if (Wb.mergeAt(sh, r, k) || Fmt.cell(sh, r, k).t !== '') return total > w; total += colW[k]; }
    return total > w;
  }
  X.build = function () {
    var sh = Wb.sh(), host = $('xpages'), xs = Xrich.sheets[Wb.sheets.indexOf(sh)], st = xs && xs.setup, i;
    host.innerHTML = ''; if (!st) st = { paper: 9, land: false, scale: 100, fit: null, m: { l: .7, r: .7, t: .75, b: .75, hd: .3, ft: .3 }, center: {}, brkR: [], brkC: [], header: '', footer: '', defW: 64, defH: 20, colPx: {}, rowPx: {}, first: 1 };
    var pp = (PAPER[st.paper] || PAPER[9]).slice(); if (st.land) pp.reverse();
    var W = pp[0] * 96, H = pp[1] * 96, cw = W - (st.m.l + st.m.r) * 96, ch = H - (st.m.t + st.m.b) * 96;
    var a = st.area || { r1: 0, c1: 0, r2: Math.max(0, sh.rows - 1), c2: Math.max(0, sh.cols - 1) }, colW = [], rowH = [];
    if (!st.area && xs) xs.objs.forEach(function (o) { var q = o.b || o.a; a.c2 = Math.max(a.c2, q.c); a.r2 = Math.max(a.r2, q.r); });
    for (i = 0; i <= a.c2; i++) colW[i] = sh.hidC[i] ? 0 : (st.colPx[i] || st.defW);
    for (i = 0; i <= a.r2; i++) rowH[i] = sh.hidR[i] ? 0 : (st.rowPx[i] || st.defH);
    var tw = 0, th = 0; for (i = a.c1; i <= a.c2; i++) tw += colW[i]; for (i = a.r1; i <= a.r2; i++) th += rowH[i];
    var s = (st.scale || 100) / 100; if (st.fit) { s = 1; if (st.fit.w > 0) s = Math.min(s, cw / tw * st.fit.w); if (st.fit.h > 0) s = Math.min(s, ch / th * st.fit.h); }
    s = Math.max(0.1, Math.min(1, s));
    var tt = st.titleR, titleH = 0; if (tt) for (i = tt[0]; i <= tt[1]; i++) titleH += rowH[i] || st.rowPx[i] || st.defH;
    var cols = chunks(colW, cw / s, st.brkC, a.c1, a.c2), rows = chunks(rowH, ch / s - titleH, st.brkR, a.r1, a.r2), pages = [];
    rows.forEach(function (rr) { cols.forEach(function (cc) { pages.push({ rr: rr, cc: cc }); }); });
    var colX = [0], rowY = [0]; for (i = 0; i <= a.c2; i++) colX.push(colX[i] + colW[i]); for (i = 0; i <= a.r2; i++) rowY.push(rowY[i] + rowH[i]);
    var total = pages.length, ctx = { total: total, file: (Book.rec && Book.rec.name) || '', sheet: sh.name }, html = '';
    pages.forEach(function (p, k) {
      var x0 = colX[p.cc[0]], y0 = rowY[p.rr[0]], pw = colX[p.cc[p.cc.length - 1] + 1] - x0, ph = rowY[p.rr[p.rr.length - 1] + 1] - y0 + (tt && p.rr[0] > tt[1] ? titleH : 0), rowsHtml = '';
      var list = p.rr.slice(); if (tt && p.rr[0] > tt[1]) { var ex = []; for (i = tt[0]; i <= tt[1]; i++) ex.push(i); list = ex.concat(list); }
      list.forEach(function (r) {
        var cells = '', c;
        for (var j = 0; j < p.cc.length; j++) {
          c = p.cc[j]; var m = Wb.mergeAt(sh, r, c), w = colW[c];
          if (m && (c > m.c1 || r > m.r1)) { cells += '<span class="xp-c" style="width:' + w + 'px"></span>'; continue; }
          if (m) { w = 0; for (var q = m.c1; q <= m.c2; q++) if (p.cc.indexOf(q) >= 0) w += colW[q]; }
          var f = Fmt.cell(sh, r, c), stl = Wb.style(sh, r, c), cf = Xrich.has(sh) ? Xrich.cf(sh, r, c, f.v) : null;
          var over = !f.n && f.t && !f.x && !stl.wrap && (!stl.al || stl.al === 'left') && spill(sh, r, c, f.t, stl, w, colW, p.cc);
          cells += '<span class="xp-c' + (f.n ? ' num' : '') + '" style="width:' + w + 'px;' + GridView.cellStyle(stl, 0) + (cf ? cf.css : '') + (over ? 'overflow:visible;z-index:1;' : '') + '">' + (cf && cf.icon ? '<i class="cfi" style="color:' + cf.icon.c + '">' + cf.icon.g + '</i>' : '') + (f.t ? esc(f.t) : '') + '</span>';
        }
        rowsHtml += '<div class="xp-r" style="height:' + rowH[r] + 'px">' + cells + '</div>';
      });
      var objs = ''; (xs ? xs.objs : []).forEach(function (o) {
        var ox = colX[Math.min(o.a.c, a.c2 + 1)] + o.a.co / 9525, oy = rowY[Math.min(o.a.r, a.r2 + 1)] + o.a.ro / 9525; if (ox < x0 || ox >= x0 + pw || oy < y0 || oy >= y0 + ph) return;
        var bw = o.b ? colX[Math.min(o.b.c, a.c2 + 1)] + o.b.co / 9525 - ox : o.w, bh = o.b ? rowY[Math.min(o.b.r, a.r2 + 1)] + o.b.ro / 9525 - oy : o.h;
        objs += '<div class="xp-o" style="left:' + (ox - x0) + 'px;top:' + (oy - y0) + 'px;width:' + bw + 'px;height:' + bh + 'px">' + (o.chart ? ChartSvg.svg(o.chart, Math.round(bw), Math.round(bh)).replace('width="100%"', 'width="100%" height="100%"') : '<img src="' + o.img + '" alt="">') + '</div>';
      });
      var ox = st.center.h ? Math.max(0, (cw - pw * s) / 2) : 0, oy = st.center.v ? Math.max(0, (ch - ph * s) / 2) : 0, c2 = { total: total, file: ctx.file, sheet: ctx.sheet, page: k + (st.first || 1) };
      html += '<div class="xp-page" style="width:' + W + 'px;height:' + H + 'px"><div class="xp-hf hd" style="left:' + st.m.l * 96 + 'px;top:' + st.m.hd * 96 + 'px;width:' + cw + 'px">' + hf(st.header, c2) + '</div>'
        + '<div class="xp-clip" style="left:' + st.m.l * 96 + 'px;top:' + st.m.t * 96 + 'px;width:' + cw + 'px;height:' + ch + 'px"><div class="xp-in' + (st.grid ? ' gl' : '') + '" style="left:' + ox + 'px;top:' + oy + 'px;width:' + pw + 'px;height:' + ph + 'px;transform:scale(' + s + ')">' + rowsHtml + objs + '</div></div>'
        + '<div class="xp-hf ft" style="left:' + st.m.l * 96 + 'px;bottom:' + st.m.ft * 96 + 'px;width:' + cw + 'px">' + hf(st.footer, c2) + '</div></div>';
    });
    host.innerHTML = html; X.total = total; X.maxW = W; X.sig = version();
  };
  X.fit = function () { return Math.max(0.2, Math.min(1, ($('xpages').clientWidth - 24) / (X.maxW || 816))); };
  X.render = function () { if (X.sig !== version() || !$('xpages').firstChild) X.build(); var z = X.pz = X.pz || X.fit(); $('xpages').style.zoom = z; };
  X.show = function (on, silent) {
    var pg = $('pgBook'), out = on ? $('gWrap') : $('xpages'), inc = on ? $('xpages') : $('gWrap');
    function go() {
      X.on = on; pg.classList.toggle('xp-on', on); X.pz = 0; if (on) X.render(); else Grid.paint(); Book.chrome(true);
      if (!still() && !silent) inc.animate([{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1.06)', fill: 'backwards' });
    }
    if (still() || silent || !Wb.sheets.length) return go();
    var a = out.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' }), end = function () { a.cancel(); go(); };
    a.finished.then(end, end);
  };
  X.set = function (on) { if (!!Store.prefs().page === on) return; Store.savePrefs({ page: on }); X.show(on); };
  A['b-page'] = function () { X.set(!X.on); };
  A['b-edit'] = (function (edit0) { return function () { if (X.on) X.set(false); edit0(); }; })(A['b-edit']);
  X.sync = function () { if (!!Store.prefs().page !== X.on) X.show(!!Store.prefs().page, true); else if (X.on) X.render(); };
  // two fingers zoom the pages
  var pinch = null; function dist(e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  $('xpages').addEventListener('touchstart', function (e) { if (e.touches.length === 2) pinch = { d: dist(e), z: X.pz || X.fit() }; }, { passive: true });
  $('xpages').addEventListener('touchmove', function (e) { if (!pinch || e.touches.length !== 2) return; e.preventDefault(); X.pz = Math.max(0.2, Math.min(3, pinch.z * dist(e) / pinch.d)); $('xpages').style.zoom = X.pz; }, { passive: false });
  $('xpages').addEventListener('touchend', function () { pinch = null; }, { passive: true });
  // on a computer: Ctrl / Cmd + wheel (and a trackpad pinch), about the point under the pointer
  $('xpages').addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
    var sc = $('xpages'), r = sc.getBoundingClientRect(), old = X.pz || X.fit(), z = Math.max(0.2, Math.min(3, old * Math.exp(-Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode ? 5 : 1))) * 0.01))), k = z / old, mx = e.clientX - r.left, my = e.clientY - r.top, cx = sc.scrollLeft + mx, cy = sc.scrollTop + my;
    X.pz = z; sc.style.zoom = z; sc.scrollLeft = cx * k - mx; sc.scrollTop = cy * k - my;
  }, { passive: false });
})();
