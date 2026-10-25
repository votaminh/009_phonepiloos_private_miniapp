// Reflow — reading a PDF as text that fits the screen: the paragraphs the engine found, in reading order, as one column that wraps at any width. Read only: every tool that edits shows the original pages again.
// View = 'page' (the original pages) or 'wrap' (this). A computer starts with the pages, a phone with the wrap; the last choice made by hand is remembered.
// What a PDF does not say (which line is bold, where a figure is) is guessed: sizes make headings, a big empty gap in a page makes a figure (cut from the page picture), several short boxes on one line make a table row.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, F = window.Reflow = { on: false, built: null, seq: 0 };
  var LIST = /^(?:[•●▪◦·\-–*]|\d{1,3}[.)])\s+/, END = /[.!?:;…”"')\]]$/;

  F.fallback = function () { return window.matchMedia && matchMedia('(min-width: 900px) and (pointer: fine)').matches ? 'page' : 'wrap'; };
  F.wanted = function () { var v = Store.prefs().view; return v === 'page' || v === 'wrap' ? v : F.fallback(); };
  F.size = function () { return Store.prefs().rfSize || (window.innerWidth >= 900 ? 18 : 17); };
  // the text size of the wrap: 12 to 32 px in halves; the place in the text is kept while it grows or shrinks
  var sizeT = 0;
  F.setSize = function (v) {
    v = Math.max(12, Math.min(32, Math.round(v * 2) / 2)); if (v === F.size()) return;
    var sc = $('rfScroll'), frac = sc.scrollHeight ? sc.scrollTop / sc.scrollHeight : 0; Store.savePrefs({ rfSize: v }); F.style(); sc.scrollTop = frac * sc.scrollHeight;
    var z = $('rfSz'); if (z) z.textContent = v; clearTimeout(sizeT); sizeT = setTimeout(function () { Ui.toast(t('rf.sizeis', { n: v })); if (window.Desk) Desk.panel(); }, 350);
  };
  F.bump = function (d) { F.setSize(F.size() + d); };
  F.theme = function () { return Store.prefs().rfTheme || 'light'; };

  // ---- the model: pages -> blocks ----------------------------------------------------------------------------------------------------
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
  function norm(s) { return s.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase(); }
  async function model() {
    var n = Doc.sizes.length, pages = [], i, weight = {}, total = 0;
    for (i = 0; i < n; i++) {
      var z = Doc.sizes[i], p = { i: i, w: z[0], h: z[1], rot: z[2] || 0, paras: [] };
      if (!p.rot) { try { p.paras = await Doc.paras(i); } catch (e) { p.paras = []; } }
      p.paras.forEach(function (q) { var k = Math.round(q.fs * 2) / 2; weight[k] = (weight[k] || 0) + q.text.length; total += q.text.length; });
      pages.push(p);
    }
    var body = 11, bw = -1; Object.keys(weight).forEach(function (k) { if (weight[k] > bw) { bw = weight[k]; body = +k; } });
    // running heads and page numbers: the same words (digits aside) near the top or bottom edge of several pages, or a bare number
    var seen = {}; pages.forEach(function (p) { p.paras.forEach(function (q) { if (q.rect[1] > p.h * 0.92 || q.rect[3] < p.h * 0.08) { var k = norm(q.text); seen[k] = (seen[k] || 0) + 1; } }); });
    pages.forEach(function (p) {
      p.top = p.h - 24; p.bot = 24;
      p.paras = p.paras.filter(function (q) {
        var edge = q.rect[3] > p.h * 0.92 || q.rect[1] < p.h * 0.08;
        if (edge && ((n > 1 && seen[norm(q.text)] > 1) || /^\d{1,4}$/.test(q.text.trim()))) { if (q.rect[3] > p.h * 0.5) p.top = Math.min(p.top, q.rect[1] - 2); else p.bot = Math.max(p.bot, q.rect[3] + 2); return false; }
        return true;
      });
    });
    var blocks = [], text = 0;
    pages.forEach(function (p) { blocks.push({ k: 'pg', i: p.i }); order(p, body).forEach(function (b) { blocks.push(b); if (b.k !== 'fig') text++; }); if (!p.paras.length && p.rot) blocks.push({ k: 'img', i: p.i }); });
    return { blocks: merge(blocks), text: text, body: body, gen: ++F.seq };
  }
  // reading order and kinds for one page
  function order(p, body) {
    var charts = labels(p), ps = p.paras.filter(function (q) { return !q.chart; }), out = [], cols = false, L = [], R = [], full = [];
    ps.forEach(function (q) { var w = q.rect[2] - q.rect[0]; (w > p.w * 0.6 ? full : (q.rect[0] + q.rect[2]) / 2 < p.w / 2 ? L : R).push(q); });
    function long(a) { return a.filter(function (q) { return q.lines.length > 1 || q.text.length > 100; }).length >= 3; }
    if (long(L) && long(R)) cols = true;
    var seq;
    charts.forEach(function (c) { ps.push({ rect: [c.x0, c.y0, c.x1, c.y1], first: c.y1, fs: body, text: '', lines: [1], figure: c }); });
    if (cols) {
      var top = Math.max.apply(null, L.concat(R).map(function (q) { return q.rect[3]; })), bot = Math.min.apply(null, L.concat(R).map(function (q) { return q.rect[1]; }));
      var by = function (a, b) { return b.rect[3] - a.rect[3]; };
      seq = full.filter(function (q) { return q.rect[1] >= top - 1; }).sort(by).concat(L.sort(by), R.sort(by), full.filter(function (q) { return q.rect[1] < top - 1; }).sort(by));
    } else seq = ps.sort(function (a, b) { return b.rect[3] - a.rect[3] || a.rect[0] - b.rect[0]; });
    // a row of several short boxes on one baseline is a table row
    var rows = [], cur = null;
    seq.forEach(function (q) {
      if (!cols && cur && !q.figure && !cur.items[0].figure && Math.abs(cur.y - q.first) < Math.max(2, q.fs * 0.45) && q.text.length <= 60) { cur.items.push(q); return; }
      cur = { y: q.first, items: [q] }; rows.push(cur);
    });
    var prevBottom = p.top, left = p.w, right = 0; ps.forEach(function (q) { left = Math.min(left, q.rect[0]); right = Math.max(right, q.rect[2]); });
    function gap(from, to) { if (from - to > Math.max(70, body * 6)) out.push({ k: 'fig', i: p.i, y0: from - 4, y1: to + 4, x0: Math.max(0, left - 4), x1: Math.min(p.w, right + 4), pw: p.w, ph: p.h }); }
    rows.forEach(function (r) {
      var top = Math.max.apply(null, r.items.map(function (q) { return q.rect[3]; })), bot = Math.min.apply(null, r.items.map(function (q) { return q.rect[1]; }));
      gap(prevBottom, top); prevBottom = bot;
      if (r.items[0].figure) { var c = r.items[0].figure; out.push({ k: 'fig', i: p.i, y0: c.y1, y1: c.y0, x0: Math.max(0, c.x0), x1: Math.min(p.w, c.x1), pw: p.w, ph: p.h, chart: true }); return; }
      if (r.items.length > 1) {
        // boxes that touch are one line set in several faces; boxes with room between them are cells
        var its = r.items.slice().sort(function (a, b) { return a.rect[0] - b.rect[0]; }), cells = [];
        its.forEach(function (q) {
          var c = cells[cells.length - 1];
          if (c && q.rect[0] - c.x1 < Math.max(q.fs, c.fs) * 0.9) { c.text += (/^[,.;:!?)\]]/.test(q.text) || /[(\[]$/.test(c.text) || /\s$/.test(c.text) ? '' : ' ') + q.text; c.x1 = Math.max(c.x1, q.rect[2]); if (q.text.length > c.len) { c.fs = q.fs; c.len = q.text.length; } }
          else cells.push({ text: q.text, x1: q.rect[2], fs: q.fs, len: q.text.length });
        });
        if (cells.length > 1 && cells.every(function (c) { return c.text.length <= 60; })) { out.push({ k: 'row', i: p.i, cells: cells.map(function (c) { return c.text; }) }); return; }
        if (cells.length === 1) { out.push(kind(Object.assign({}, its[0], { text: cells[0].text, fs: cells[0].fs, lines: [1] }), p, body)); return; }
      }
      r.items.forEach(function (q) { out.push(kind(q, p, body)); });
    });
    gap(prevBottom, p.bot);
    return out;
  }
  // a chart is full of short labels (axis numbers, legend words) that mean nothing as text: such a cluster becomes a picture cut from the page
  function labels(p) {
    var sh = p.paras.filter(function (q) { return q.lines.length === 1 && q.text.length <= 14 && !LIST.test(q.text); }), par = sh.map(function (_, i) { return i; }), regions = [];
    function find(a) { while (par[a] !== a) a = par[a] = par[par[a]]; return a; }
    sh.forEach(function (a, i) { sh.forEach(function (b, j) { if (j > i && Math.hypot((a.rect[0] + a.rect[2]) / 2 - (b.rect[0] + b.rect[2]) / 2, (a.rect[1] + a.rect[3]) / 2 - (b.rect[1] + b.rect[3]) / 2) < 70) par[find(j)] = find(i); }); });
    var groups = {}; sh.forEach(function (q, i) { (groups[find(i)] = groups[find(i)] || []).push(q); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.length < 8) return;
      var rowsN = {}; g.forEach(function (q) { var y = Math.round(q.first / 3); rowsN[y] = (rowsN[y] || 0) + 1; });
      var shared = g.filter(function (q) { return rowsN[Math.round(q.first / 3)] > 1; }).length; if (shared / g.length >= 0.6) return;   // a table
      var x0 = Math.min.apply(null, g.map(function (q) { return q.rect[0]; })), x1 = Math.max.apply(null, g.map(function (q) { return q.rect[2]; })), y0 = Math.min.apply(null, g.map(function (q) { return q.rect[1]; })), y1 = Math.max.apply(null, g.map(function (q) { return q.rect[3]; }));
      g.forEach(function (q) { q.chart = true; }); regions.push({ x0: x0 - 30, x1: x1 + 30, y0: y0 - 36, y1: y1 + 36 });
    });
    return regions;
  }
  function kind(q, p, body) {
    var r = q.fs / body, one = q.lines.length === 1 && q.text.length < 90;
    if (r >= 1.6 && one) return { k: 'h1', i: p.i, text: q.text };
    if (r >= 1.3 && one) return { k: 'h2', i: p.i, text: q.text };
    if (r >= 1.15 && one && !END.test(q.text.trim())) return { k: 'h3', i: p.i, text: q.text };
    if (LIST.test(q.text)) return { k: 'li', i: p.i, text: q.text.replace(LIST, '') };
    return { k: 'p', i: p.i, text: q.text, align: q.align };
  }
  // a sentence that runs over a page break is one paragraph
  function merge(bs) {
    var out = [];
    bs.forEach(function (b) {
      var j = out.length - 1, prev = out[j];
      if (b.k === 'pg' && out.length) { out.push(b); return; }
      if (b.k === 'p' && prev && prev.k === 'pg' && out[j - 1] && out[j - 1].k === 'p' && !END.test(out[j - 1].text.trim()) && /^[a-zà-ỹ]/.test(b.text)) { out[j - 1].text += ' ' + b.text; out[j - 1].joined = true; out.splice(j, 1); out.push({ k: 'pg', i: b.i, quiet: true }); return; }
      out.push(b);
    });
    return out;
  }

  // ---- markup ------------------------------------------------------------------------------------------------------------------------------
  function html(m) {
    var h = '', list = false, tbl = false;
    function close() { if (list) { h += '</ul>'; list = false; } if (tbl) { h += '</div>'; tbl = false; } }
    m.blocks.forEach(function (b) {
      if (b.k !== 'li') { if (list) { h += '</ul>'; list = false; } }
      if (b.k !== 'row') { if (tbl) { h += '</div>'; tbl = false; } }
      if (b.k === 'pg') { close(); h += '<div class="rf-pg' + (b.quiet ? ' quiet' : '') + '" data-p="' + b.i + '"><span>' + esc(t('rf.pg', { n: b.i + 1 })) + '</span><button type="button" data-act="rf-orig" data-p="' + b.i + '">' + esc(t('rf.orig')) + '</button></div>'; }
      else if (b.k === 'h1' || b.k === 'h2' || b.k === 'h3') h += '<' + b.k + ' class="rf-h">' + esc(b.text) + '</' + b.k + '>';
      else if (b.k === 'p') h += '<p class="rf-p' + (b.align === 'center' ? ' c' : b.align === 'right' ? ' r' : '') + '">' + esc(b.text) + '</p>';
      else if (b.k === 'li') { if (!list) { h += '<ul class="rf-ul">'; list = true; } h += '<li>' + esc(b.text) + '</li>'; }
      else if (b.k === 'row') { if (!tbl) { h += '<div class="rf-tb">'; tbl = true; } h += '<div class="rf-tr" style="grid-template-columns:repeat(' + b.cells.length + ',minmax(0,1fr))">' + b.cells.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>'; }
      else if (b.k === 'fig' || b.k === 'img') h += '<canvas class="rf-fig" data-k="' + b.k + '" data-p="' + b.i + '"' + (b.k === 'fig' ? ' data-b="' + [b.x0, b.x1, b.y0, b.y1, b.pw, b.ph].map(function (v) { return Math.round(v * 10) / 10; }).join(',') + '"' : '') + '></canvas>';
    });
    close(); return h;
  }
  // the figures: cut from the page picture; a cut that is only white paper is dropped
  async function figures(host, gen) {
    var cvs = Array.prototype.slice.call(host.querySelectorAll('.rf-fig')), i;
    for (i = 0; i < cvs.length; i++) {
      var cv = cvs[i]; if (!F.built || gen !== F.built.gen || !cv.isConnected) return;
      try {
        var p = +cv.dataset.p, bm = await Doc.bitmap(p), ctx, sx, sy, sw, sh;
        if (cv.dataset.k === 'img') { sx = 0; sy = 0; sw = bm.width; sh = bm.height; }
        else { var b = cv.dataset.b.split(',').map(Number), k = bm.width / b[4]; sx = b[0] * k; sw = (b[1] - b[0]) * k; sy = (b[5] - b[2]) * k; sh = (b[2] - b[3]) * k; }
        sw = Math.max(1, Math.min(bm.width - sx, sw)); sh = Math.max(1, Math.min(bm.height - sy, sh));
        cv.width = Math.round(sw); cv.height = Math.round(sh); ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bm, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        if (cv.dataset.k === 'fig') { var d = ctx.getImageData(0, 0, cv.width, cv.height).data, ink = 0, s = 0; for (s = 0; s < d.length; s += 16) if (d[s] < 235 || d[s + 1] < 235 || d[s + 2] < 235) ink++; if (ink / (d.length / 16) < 0.004) cv.remove(); }
      } catch (e) { cv.remove(); }
    }
  }

  // ---- showing it ------------------------------------------------------------------------------------------------------------------------
  F.style = function () {
    var host = $('rfScroll'); if (!host) return; host.dataset.th = F.theme(); host.style.setProperty('--rf-fs', F.size() + 'px');
  };
  async function build() {
    if (F.built) return F.built;
    var m = await model(); F.built = m; $('rfHost').innerHTML = html(m); figures($('rfHost'), m.gen); return m;
  }
  // set the view; opt.keep: do not remember it as the reader's choice
  F.set = async function (v, opt) {
    opt = opt || {};
    if (v === 'wrap') {
      if (!Doc.sizes.length) return;
      var cur = Read.current ? Read.current() : 0, m = await build();
      if (!m.text) { Ui.toast(t('rf.none')); if (!opt.keep) Store.savePrefs({ view: 'page' }); F.apply('page'); return; }
      F.apply('wrap'); F.style();
      var at = $('rfHost').querySelector('.rf-pg[data-p="' + cur + '"]'); var sc = $('rfScroll'); sc.scrollTop = at ? at.offsetTop - 8 : 0;
    } else {
      var seen = F.pageNow(); F.apply('page'); if (seen != null && Read.goto && !opt.noGoto) setTimeout(function () { var sc = $('rdScroll'); sc.scrollTop = Math.max(0, $('rdHost').offsetTop + Read.tops[seen] - 8); Read.counter(); }, 30);
    }
    if (!opt.keep) Store.savePrefs({ view: v });
  };
  F.apply = function (v) { F.on = v === 'wrap'; $('pgDoc').dataset.view = v; Viewer.chrome(); if (!F.on && Read.list) setTimeout(function () { if (Read.refit) Read.refit(); if (window.Desk) Desk.sync(); }, 30); };   // the pages were hidden while wrapped: measure the room again
  F.pageNow = function () {
    if (!F.on) return null; var sc = $('rfScroll'), best = 0; Array.prototype.forEach.call($('rfHost').querySelectorAll('.rf-pg:not(.quiet)'), function (e) { if (e.offsetTop <= sc.scrollTop + sc.clientHeight / 3) best = +e.dataset.p; }); return best;
  };
  // the file just opened: the view the reader wants, unless there is nothing to wrap
  F.opened = function (opts) {
    F.built = null; $('rfHost').innerHTML = ''; F.style();
    if (opts && (opts.edit || opts.blank)) return F.apply('page');
    if (F.wanted() === 'wrap') F.set('wrap', { keep: true }); else F.apply('page');
  };
  F.btns = function (edit) {
    if (edit) return '';
    var on = F.on, lay = function (k, icon, lab) { return '<button type="button" class="' + ((k === 'wrap') === on ? 'on' : '') + '" data-act="rf-view" data-k="' + k + '" aria-pressed="' + ((k === 'wrap') === on) + '" aria-label="' + esc(lab) + '">' + ic(icon, 18, 1.8) + '<span>' + esc(lab) + '</span></button>'; };
    return (on ? '<button type="button" class="ib" data-act="rf-aa" aria-label="' + esc(t('rf.aa')) + '"><b class="rf-aa">Aa</b></button>' : '')
      + '<button type="button" class="ib rf-ph" data-act="rf-toggle" aria-label="' + esc(t(on ? 'rf.toPage' : 'rf.toWrap')) + '">' + ic(on ? 'pages' : 'reflow', 22, 1.9) + '</button>'
      + '<div class="rf-seg rf-wd" role="group">' + lay('wrap', 'reflow', t('rf.wrap')) + lay('page', 'pages', t('rf.page')) + '</div>';
  };

  // two fingers or Ctrl + wheel change the text size (not the zoom of a page)
  (function () {
    var sc = $('rfScroll'), pts = {}, d0 = 0, s0 = 0, acc = 0;
    sc.style.touchAction = 'pan-y';
    sc.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1); acc += -Math.max(-60, Math.min(60, dy)) * 0.012; if (Math.abs(acc) >= 0.5) { F.bump(Math.round(acc * 2) / 2); acc = 0; }
    }, { passive: false });
    function dist() { var k = Object.keys(pts); return Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); }
    sc.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') return; pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (Object.keys(pts).length === 2) { d0 = dist(); s0 = F.size(); } });
    sc.addEventListener('pointermove', function (e) { if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (Object.keys(pts).length === 2 && d0 > 10) F.setSize(s0 * dist() / d0); });
    function up(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) d0 = 0; }
    sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up);
  })();

  // ---- acts ----------------------------------------------------------------------------------------------------------------------------------
  A['rf-toggle'] = function () { F.set(F.on ? 'page' : 'wrap'); };
  A['rf-view'] = function (el) { var v = el.dataset.k; if ((v === 'wrap') !== F.on) F.set(v); };
  A['rf-orig'] = function (el) { var p = +el.dataset.p; F.apply('page'); setTimeout(function () { var sc = $('rdScroll'); sc.scrollTop = Math.max(0, $('rdHost').offsetTop + Read.tops[p] - 8); Read.counter(); }, 30); };
  A['rf-aa'] = function () {
    var s = F.size(), th = F.theme();
    function chip(k) { return '<button type="button" class="sx-chip' + (th === k ? ' on' : '') + '" data-act="rf-theme" data-k="' + k + '">' + esc(t('rf.' + k)) + '</button>'; }
    Ui.sheet('rfaa', '<h2 class="sh-h">' + esc(t('rf.aa')) + '</h2><div class="rf-ctl"><span>' + esc(t('rf.size')) + '</span><div><button type="button" class="ib" data-act="rf-size" data-v="-" aria-label="−">' + ic('minus', 20, 2) + '</button><b id="rfSz">' + s + '</b><button type="button" class="ib" data-act="rf-size" data-v="+" aria-label="+">' + ic('plus', 20, 2) + '</button></div></div>'
      + '<div class="rf-ctl"><span>' + esc(t('rf.theme')) + '</span></div><div class="sx-chips">' + chip('light') + chip('paper') + chip('dark') + '</div><div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>');
  };
  A['rf-size'] = function (el) { var s = Math.max(12, Math.min(32, F.size() + (el.dataset.v === '+' ? 1 : -1))); Store.savePrefs({ rfSize: s }); var z = $('rfSz'); if (z) z.textContent = s; if (window.Desk) Desk.panel(); F.style(); };
  A['rf-theme'] = function (el) { Store.savePrefs({ rfTheme: el.dataset.k }); F.style(); if (window.Desk) Desk.panel(); Array.prototype.forEach.call(document.querySelectorAll('#sheet [data-act="rf-theme"]'), function (b) { b.classList.toggle('on', b === el); }); };
  // everything that edits or searches works on the original pages
  ['m-text', 'm-annot', 'm-sign', 'm-pages', 'm-add', 'fd-open'].forEach(function (k) { var f = A[k]; if (!f) return; A[k] = function () { var a = arguments, self = this; if (F.on) { F.apply('page'); setTimeout(function () { f.apply(self, a); }, 40); } else f.apply(self, a); }; });
  var sm = Read.setMode; Read.setMode = function (m) { if (m !== 'read' && F.on) F.apply('page'); return sm.apply(this, arguments); };
  var dc = Doc.changed; Doc.changed = function () { F.built = null; return dc.apply(this, arguments); };   // an edit: the text is new
  window.addEventListener('language:changed', function () { if (F.on && F.built) { F.built = null; build(); } });
})();
