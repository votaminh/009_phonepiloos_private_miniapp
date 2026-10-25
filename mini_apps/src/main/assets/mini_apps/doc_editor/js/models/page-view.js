// PageView — the document laid out as pages of its real size: margins, columns, header and footer, page breaks. Read only; a page is the same blocks as the reading view, flowed through CSS columns.
// A section is one tall box of columns (as high as the page's text area); the n-th page shows that box shifted sideways by n pages, so the browser does the line breaking.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, PX = 1 / 15, io = null, pill = 0;
  var PV = window.PageView = { pages: [], map: {}, sig: '', fit: 1, total: 0 };
  function a4() { return { end: Infinity, w: 11906, h: 16838, t: 1440, r: 1440, b: 1440, l: 1440, hd: 720, ft: 720, cols: 1, space: 720, title: false, hdr: {}, ftr: {} }; }
  function sects() { var d = DocRich.doc; return d && d.sects.length ? d.sects : [a4()]; }
  function clean(el) { return el.outerHTML.replace(/ contenteditable="[^"]*"/g, '').replace(/ class="([^"]*)\bsel\b([^"]*)"/g, ' class="$1$2"'); }
  // the blocks of the page now on screen (edits included), grouped by the section each one sits in
  function groups(ss) {
    var g = ss.map(function () { return []; }), at = 0;
    Array.prototype.forEach.call(Doc.paper().children, function (el) {
      if (!el.classList.contains('b') || el.hidden || el.classList.contains('sb')) return;
      var src = el.dataset.src; if (src !== undefined) { src = +src; while (at < ss.length - 1 && src > ss[at].end) at++; }
      g[at].push(clean(el));
    });
    return g;
  }
  function dims(s) {
    var gap = s.cols > 1 ? s.space * PX : 0, cw = (s.w - s.l - s.r) * PX;
    return { w: s.w * PX, h: s.h * PX, l: s.l * PX, t: s.t * PX, cw: cw, ch: (s.h - s.t - s.b) * PX, gap: gap, hd: s.hd * PX, ft: s.ft * PX };
  }
  function flowStyle(s, d, base) {
    return 'width:' + d.cw + 'px;height:' + d.ch + 'px;column-count:' + s.cols + ';column-gap:' + d.gap + 'px;--pg-fs:' + base.pt * 96 / 72 + 'px;--pg-after:' + base.after * 96 / 72 + 'px;--pg-lh:' + Math.max(1.05, base.line * 1.12);
  }
  // the inside of one page: header, the text area (the section's box of columns shifted to this page), footer
  function fill(el, p, at, total) {
    var s = p.s, d = p.d, first = s.title && p.j === 0, tok = function (h) { return (h || '').replace('{PAGE}', at + 1).replace('{NUMPAGES}', total); };
    var hd = tok(first ? s.hdr.first : s.hdr['default']), ft = tok(first ? s.ftr.first : s.ftr['default']);
    el.innerHTML = (hd ? '<div class="pgx-hd" style="left:' + d.l + 'px;top:' + d.hd + 'px;width:' + d.cw + 'px">' + hd + '</div>' : '')
      + '<div class="pgx-clip" style="left:' + d.l + 'px;top:' + d.t + 'px;width:' + d.cw + 'px;height:' + d.ch + 'px"><div class="pgx-flow" style="' + flowStyle(s, d, p.base) + ';transform:translateX(' + (-p.j * (d.cw + d.gap)) + 'px)">' + p.html + '</div></div>'
      + (ft ? '<div class="pgx-ft" style="left:' + d.l + 'px;bottom:' + d.ft + 'px;width:' + d.cw + 'px">' + ft + '</div>' : '');
  }
  function put(pg) { if (pg.done) return; pg.done = true; fill(pg.el, pg.def, pg.at, PV.total); }
  // page 1 alone, off screen at its real size (for the picture in the list)
  PV.first = function () {
    var ss = sects(), g = groups(ss), base = (DocRich.doc && DocRich.doc.base) || { pt: 11, after: 8, line: 1.1 }, d = dims(ss[0]), host = document.createElement('div'), el = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none'; el.className = 'pgx-page'; el.style.cssText = 'width:' + d.w + 'px;height:' + d.h + 'px'; host.appendChild(el); document.body.appendChild(host);
    fill(el, { s: ss[0], d: d, j: 0, html: g[0].join(''), base: base }, 0, PV.total || 1); return { el: el, w: d.w, h: d.h, done: function () { host.remove(); } };
  };
  PV.build = function () {
    var host = $('pages'), ss = sects(), g = groups(ss), base = (DocRich.doc && DocRich.doc.base) || { pt: 11, after: 8, line: 1.1 }, defs = [], total = 0;
    var meas = document.createElement('div'); meas.className = 'pgx-meas'; document.body.appendChild(meas);
    PV.map = {}; PV.pages = []; host.innerHTML = ''; if (io) io.disconnect();
    ss.forEach(function (s, k) {
      var d = dims(s), flow = document.createElement('div'), html = g[k].join('');
      flow.className = 'pgx-flow'; flow.style.cssText = flowStyle(s, d, base); flow.innerHTML = html; meas.appendChild(flow);
      var n = Math.max(1, Math.ceil((flow.scrollWidth + d.gap - 2) / (d.cw + d.gap)));
      Array.prototype.forEach.call(flow.querySelectorAll('[data-src]'), function (b) { PV.map[b.dataset.src] = total + Math.min(n - 1, Math.floor(b.offsetLeft / (d.cw + d.gap))); });
      for (var j = 0; j < n; j++) defs.push({ s: s, d: d, j: j, n: n, html: html, base: base });
      total += n; meas.removeChild(flow);
    });
    document.body.removeChild(meas); PV.total = total;
    var maxW = 0; defs.forEach(function (p, i) {
      var el = document.createElement('div'); el.className = 'pgx-page'; el.style.cssText = 'width:' + p.d.w + 'px;height:' + p.d.h + 'px'; host.appendChild(el); maxW = Math.max(maxW, p.d.w);
      PV.pages.push({ el: el, def: p, at: i, done: false });
    });
    PV.maxW = maxW; PV.sig = PV.stamp();
    io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var pg = PV.pages[Array.prototype.indexOf.call(host.children, e.target)]; if (pg) put(pg); } }); }, { root: $('docBody'), rootMargin: '700px 0px' });
    PV.pages.forEach(function (pg) { io.observe(pg.el); }); PV.pages.slice(0, 2).forEach(put);
  };
  PV.stamp = function () { return Doc.rid + ':' + Doc.histAt + ':' + Doc.hist.length; };
  PV.fitZoom = function () { return Math.max(0.2, Math.min(1, ($('docBody').clientWidth - 24) / (PV.maxW || sects()[0].w * PX || 794))); };
  // editing keeps one continuous sheet, set to the first section's page width, margins and text size, so lines break where they do in the pages
  PV.editStyle = function (p, on) {
    if (!on) { ['width', 'padding', 'minHeight', 'margin', 'boxSizing', 'lineHeight'].forEach(function (k) { p.style[k] = ''; }); p.style.removeProperty('--pg-after'); return; }
    var s = sects()[0], d = dims(s), base = (DocRich.doc && DocRich.doc.base) || { pt: 11, after: 8, line: 1.1 };
    p.style.width = d.w + 'px'; p.style.boxSizing = 'border-box'; p.style.padding = d.t + 'px ' + s.r * PX + 'px ' + s.b * PX + 'px ' + d.l + 'px'; p.style.minHeight = d.h + 'px'; p.style.margin = '0 auto';
    p.style.fontSize = base.pt * 96 / 72 + 'px'; p.style.lineHeight = Math.max(1.05, base.line * 1.12); p.style.setProperty('--pg-after', base.after * 96 / 72 + 'px');
  };
  PV.show = function () {
    if (PV.stamp() !== PV.sig) PV.build();
    var z = Read.pz = Read.pz || PV.fitZoom(); $('pages').style.zoom = z;
  };
  // the page a block is on (by its index in the file), for the jump from the contents
  PV.jump = function (src) {
    var i = PV.map[src]; if (i === undefined || !PV.pages[i]) return false; var body = $('docBody'), pg = PV.pages[i]; put(pg);
    body.scrollTo({ top: Math.max(0, pg.el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8), behavior: 'smooth' }); return true;
  };
  // "Page 3 / 7" shows for a moment while the pages move
  PV.here = function () {
    var body = $('docBody'), mid = body.getBoundingClientRect().top + body.clientHeight / 3, at = 0;
    PV.pages.forEach(function (pg, i) { if (pg.el.getBoundingClientRect().top <= mid) at = i; }); return at;
  };
  PV.init = function () {
    var el = document.createElement('div'); el.className = 'pgx-pill'; el.id = 'pgxPill'; $('pgDoc').appendChild(el);
    $('docBody').addEventListener('scroll', function () {
      if (!PV.pages.length || !$('pages').classList.contains('on')) return;
      el.textContent = t('pv.of', { a: PV.here() + 1, b: PV.total }); el.classList.add('on'); clearTimeout(pill); pill = setTimeout(function () { el.classList.remove('on'); }, 1100);
    }, { passive: true });
  };
})();
