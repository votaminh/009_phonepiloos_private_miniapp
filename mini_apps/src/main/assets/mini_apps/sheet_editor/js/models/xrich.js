// Xrich — what the engine's sheet model leaves out, read straight from the .xlsx: conditional formatting (colours, data bars, icons) and the charts and pictures placed over the grid.
// The file itself is never changed here: edits go through the engine, which keeps these parts byte for byte.
(function () {
  'use strict';
  var X = window.Xrich = { sheets: [] };
  function kids(el, n) { var o = []; for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (!n || c.localName === n) o.push(c); return o; }
  function kid(el, n) { return kids(el, n)[0] || null; }
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function xml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function rid(el) { return el && (el.getAttribute('r:id') || el.getAttribute('r:embed')); }
  function norm(base, t) { if (t[0] === '/') return t.slice(1); var p = base.split('/'); p.pop(); t.split('/').forEach(function (s) { if (s === '..') p.pop(); else if (s !== '.') p.push(s); }); return p.join('/'); }
  function argb(c) { var v = c && c.getAttribute('rgb'); return v ? '#' + v.slice(-6) : null; }
  function colIdx(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n - 1; }
  function range(s) {
    var m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(s); if (!m) return null;
    var c1 = colIdx(m[1]), r1 = +m[2] - 1; return { r1: r1, c1: c1, r2: m[4] ? +m[4] - 1 : r1, c2: m[3] ? colIdx(m[3]) : c1 };
  }
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };

  function dxfs(doc) {
    return all(kid(doc.documentElement, 'dxfs'), 'dxf').map(function (d) {
      var f = kid(d, 'font'), fl = kid(d, 'fill'), pf = fl && kid(fl, 'patternFill');
      return { color: f && argb(kid(f, 'color')), b: !!(f && kid(f, 'b')), i: !!(f && kid(f, 'i')), bg: pf && (argb(kid(pf, 'bgColor')) || argb(kid(pf, 'fgColor'))) };
    });
  }
  function cfvo(el) { return kids(el, 'cfvo').map(function (v) { return { t: v.getAttribute('type'), v: v.getAttribute('val') }; }); }
  function rules(doc, dx) {
    var out = [];
    all(doc, 'conditionalFormatting').forEach(function (cf) {
      var rs = (cf.getAttribute('sqref') || '').split(/\s+/).map(range).filter(Boolean);
      kids(cf, 'cfRule').forEach(function (r) {
        var o = { rs: rs, type: r.getAttribute('type'), op: r.getAttribute('operator'), prio: +r.getAttribute('priority') || 0, dxf: dx[+r.getAttribute('dxfId')] || null, text: r.getAttribute('text'), rank: +r.getAttribute('rank') || 10, pct: r.getAttribute('percent') === '1', bottom: r.getAttribute('bottom') === '1', above: r.getAttribute('aboveAverage') !== '0', f: kids(r, 'formula').map(function (f) { return f.textContent; }), stat: null };
        var cs = kid(r, 'colorScale'), db = kid(r, 'dataBar'), is = kid(r, 'iconSet');
        if (cs) o.scale = { v: cfvo(cs), c: kids(cs, 'color').map(argb) };
        if (db) o.bar = { v: cfvo(db), c: argb(kid(db, 'color')) || window.ChartLook.bar };
        if (is) o.icon = { set: is.getAttribute('iconSet') || '3TrafficLights1', v: cfvo(is), rev: is.getAttribute('reverse') === '1' };
        out.push(o);
      });
    });
    return out.sort(function (a, b) { return a.prio - b.prio; });
  }

  // charts and pictures of one sheet, with the cell they hang from
  async function drawings(z, file, doc, relPath) {
    var d = all(doc, 'drawing')[0], out = []; if (!d) return out;
    var rels = await relMap(z, file), target = rels[rid(d)]; if (!target) return out;
    var path = norm(file, target), dx = await z.text(path); if (!dx) return out; var dd = xml(dx), drels = await relMap(z, path);
    function pos(a) { var g = function (n) { var k = kid(a, n); return k ? +k.textContent : 0; }; return a ? { c: g('col'), co: g('colOff'), r: g('row'), ro: g('rowOff') } : null; }
    var anchors = kids(dd.documentElement).filter(function (a) { return /Anchor$/.test(a.localName); });
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i], o = { a: pos(kid(a, 'from')), b: pos(kid(a, 'to')), w: 0, h: 0, html: '', img: '' }, ext = kid(a, 'ext');
      if (!ext) ext = all(a, 'ext').filter(function (e) { return +e.getAttribute('cx') > 0; })[0];
      if (ext) { o.w = +ext.getAttribute('cx') / 9525; o.h = +ext.getAttribute('cy') / 9525; }
      if (!o.a) continue;
      var ch = all(a, 'chart')[0], bl = all(a, 'blip')[0];
      if (ch) { var cx = await z.text(norm(path, drels[rid(ch)] || '')); o.chart = cx || ''; }
      else if (bl) { var mp = norm(path, drels[rid(bl)] || ''), bytes = await z.bytes(mp); if (bytes) o.img = URL.createObjectURL(new Blob([bytes], { type: MIME[(mp.split('.').pop() || '').toLowerCase()] || 'image/png' })); }
      if (o.chart || o.img) out.push(o);
    }
    return out;
  }
  async function relMap(z, file) {
    var p = file.replace(/([^/]+)$/, '_rels/$1.rels'), t = await z.text(p), m = {}; if (t) all(xml(t), 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = r.getAttribute('Target'); }); return m;
  }

  // read the file once, when it opens; anything unexpected just leaves the grid as the engine described it
  X.load = async function (buf) {
    X.sheets = [];
    try {
      var z = Zipx.open(buf), wb = await z.text('xl/workbook.xml'); if (!wb) return;
      var rels = await relMap(z, 'xl/workbook.xml'), sx = await z.text('xl/styles.xml'), dx = sx ? dxfs(xml(sx)) : [];
      var wd = xml(wb), list = all(wd, 'sheet'), defs = {};
      all(wd, 'definedName').forEach(function (d) { var k = d.getAttribute('name'), id = d.getAttribute('localSheetId'); if (id !== null && /^_xlnm\.Print_(Area|Titles)$/.test(k)) defs[id + k.slice(6)] = d.textContent; });
      for (var i = 0; i < list.length; i++) {
        var file = norm('xl/workbook.xml', rels[rid(list[i])] || ''), t = await z.text(file), s = { rules: [], objs: [] }; X.sheets.push(s); if (!t) continue;
        var doc = xml(t); s.rules = rules(doc, dx); s.objs = await drawings(z, file, doc); s.setup = setup(doc, i, defs);
      }
    } catch (e) { X.sheets = []; }
  };

  // how the sheet prints: paper, margins, scale, breaks, header and footer, and the sizes Excel itself gives its rows and columns
  function setup(doc, i, defs) {
    var q = function (n) { return all(doc, n)[0] || null; }, pm = q('pageMargins'), ps = q('pageSetup'), po = q('printOptions'), fp = q('pageSetUpPr'), hf = q('headerFooter'), fmt = q('sheetFormatPr'), o = {};
    var n = function (el, a, d) { var v = el && el.getAttribute(a); return v === null || v === undefined || v === '' ? d : +v; };
    o.paper = n(ps, 'paperSize', 1); o.land = !!ps && ps.getAttribute('orientation') === 'landscape'; o.scale = n(ps, 'scale', 100); o.first = n(ps, 'firstPageNumber', 1);
    o.fit = fp && fp.getAttribute('fitToPage') === '1' ? { w: n(ps, 'fitToWidth', 1), h: n(ps, 'fitToHeight', 1) } : null;
    o.m = { l: n(pm, 'left', 0.7), r: n(pm, 'right', 0.7), t: n(pm, 'top', 0.75), b: n(pm, 'bottom', 0.75), hd: n(pm, 'header', 0.3), ft: n(pm, 'footer', 0.3) };
    o.center = { h: !!po && po.getAttribute('horizontalCentered') === '1', v: !!po && po.getAttribute('verticalCentered') === '1' }; o.grid = !!po && po.getAttribute('gridLines') === '1';
    o.brkR = all(q('rowBreaks'), 'brk').map(function (b) { return +b.getAttribute('id'); }); o.brkC = all(q('colBreaks'), 'brk').map(function (b) { return +b.getAttribute('id'); });
    o.header = hf && kid(hf, 'oddHeader') ? kid(hf, 'oddHeader').textContent : ''; o.footer = hf && kid(hf, 'oddFooter') ? kid(hf, 'oddFooter').textContent : '';
    o.defW = n(fmt, 'defaultColWidth', 0) ? Math.round(n(fmt, 'defaultColWidth', 8.43) * 7 + 5) : 64; o.defH = Math.round(n(fmt, 'defaultRowHeight', 15) * 4 / 3);
    o.colPx = {}; o.rowPx = {};
    all(q('cols'), 'col').forEach(function (c) { var w = n(c, 'width', 0); for (var k = n(c, 'min', 1) - 1; k <= Math.min(n(c, 'max', 1) - 1, n(c, 'min', 1) + 200); k++) if (w) o.colPx[k] = Math.round(w * 7 + 5); });
    if (all(doc, 'row').length < 60000) all(doc, 'row').forEach(function (r) { var h = n(r, 'ht', 0); if (h) o.rowPx[+r.getAttribute('r') - 1] = Math.round(h * 4 / 3); });
    var a = defs[i + 'Print_Area'], tt = defs[i + 'Print_Titles']; if (a) { var m = /!([^,]+)/.exec(a); if (m) o.area = range(m[1].split(',')[0]); }
    var tr = tt && /\$(\d+):\$(\d+)/.exec(tt); if (tr) o.titleR = [+tr[1] - 1, +tr[2] - 1];
    return o;
  }

  // ---- conditional formatting --------------------------------------------------------------------------------------------------
  function inRule(rule, r, c) { return rule.rs.some(function (q) { return r >= q.r1 && r <= q.r2 && c >= q.c1 && c <= q.c2; }); }
  function version() { return Wb.hist.length + ':' + Wb.at + ':' + Wb.on; }
  // the numbers of a rule's range (one pass, kept until the sheet changes)
  function stat(sh, rule) {
    var v = version(); if (rule.stat && rule.stat.v === v) return rule.stat;
    var nums = [], seen = {}, dup = {}, n = 0;
    rule.rs.forEach(function (q) { for (var r = q.r1; r <= q.r2 && n < 30000; r++) for (var c = q.c1; c <= q.c2; c++, n++) { var x = Calc.value(sh, r, c); if (typeof x === 'number') nums.push(x); if (x !== null && x !== undefined && typeof x !== 'object') { var k = String(x); if (seen[k]) dup[k] = 1; seen[k] = 1; } } });
    var sorted = nums.slice().sort(function (a, b) { return a - b; }), sum = nums.reduce(function (a, b) { return a + b; }, 0);
    return (rule.stat = { v: v, sorted: sorted, min: sorted[0], max: sorted[sorted.length - 1], avg: nums.length ? sum / nums.length : 0, dup: dup });
  }
  function at(st, o) {
    var v = parseFloat(o.v);
    if (o.t === 'min') return st.min; if (o.t === 'max') return st.max; if (o.t === 'num') return v;
    if (o.t === 'percent') return st.min + (st.max - st.min) * v / 100;
    if (o.t === 'percentile') return st.sorted.length ? st.sorted[Math.min(st.sorted.length - 1, Math.floor(v / 100 * (st.sorted.length - 1)))] : 0;
    return v;
  }
  function mix(a, b, t) {
    var p = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }, x = p(a), y = p(b);
    return '#' + x.map(function (q, i) { return ('0' + Math.round(q + (y[i] - q) * t).toString(16)).slice(-2); }).join('');
  }
  function lit(f) { f = (f || '').trim(); if (/^"(.*)"$/.test(f)) return f.slice(1, -1); var n = parseFloat(f); return isNaN(n) || !/^[-+0-9.eE]+$/.test(f) ? null : n; }
  function test(rule, v, st, sh) {
    var num = typeof v === 'number', s = v === null || v === undefined ? '' : String(v), tx = (rule.text || '').toLowerCase();
    switch (rule.type) {
      case 'cellIs': {
        var a = lit(rule.f[0]), b = lit(rule.f[1]); if (a === null) return false; var x = typeof a === 'number' ? (num ? v : NaN) : s;
        switch (rule.op) { case 'equal': return typeof a === 'string' ? s.toLowerCase() === a.toLowerCase() : x === a; case 'notEqual': return typeof a === 'string' ? s.toLowerCase() !== a.toLowerCase() : x !== a; case 'greaterThan': return x > a; case 'lessThan': return x < a; case 'greaterThanOrEqual': return x >= a; case 'lessThanOrEqual': return x <= a; case 'between': return x >= a && x <= b; case 'notBetween': return x < a || x > b; }
        return false;
      }
      case 'containsText': return s.toLowerCase().indexOf(tx) >= 0; case 'notContainsText': return s.toLowerCase().indexOf(tx) < 0;
      case 'beginsWith': return s.toLowerCase().indexOf(tx) === 0; case 'endsWith': return tx !== '' && s.toLowerCase().slice(-tx.length) === tx;
      case 'containsBlanks': return s === ''; case 'notContainsBlanks': return s !== ''; case 'containsErrors': return v && typeof v === 'object';
      case 'duplicateValues': return s !== '' && !!st.dup[s]; case 'uniqueValues': return s !== '' && !st.dup[s];
      case 'aboveAverage': return num && (rule.above ? v > st.avg : v < st.avg);
      case 'top10': { if (!num) return false; var n = rule.pct ? Math.max(1, Math.round(st.sorted.length * rule.rank / 100)) : rule.rank, sd = st.sorted; return rule.bottom ? v <= sd[Math.min(n, sd.length) - 1] : v >= sd[Math.max(0, sd.length - n)]; }
    }
    return false;
  }
  var GLYPH = { arrows: ['↓', '→', '↑'], traffic: ['●', '●', '●'], symbols: ['×', '!', '√'], flags: ['●', '●', '●'], stars: ['○', '◐', '●'], dots: ['●', '●', '●'] };
  X.has = function (sh) { var s = X.sheets[Wb.sheets.indexOf(sh)]; return !!s && s.rules.length > 0; };
  // { css, icon: {g, c}, bar } for one cell, or null
  X.cf = function (sh, r, c, v) {
    var s = X.sheets[Wb.sheets.indexOf(sh)]; if (!s) return null; var out = null;
    for (var i = 0; i < s.rules.length; i++) {
      var rule = s.rules[i]; if (!inRule(rule, r, c)) continue; var st = null, o = out || (out = { css: '' });
      if (rule.scale || rule.bar || rule.icon || /^(duplicateValues|uniqueValues|aboveAverage|top10)$/.test(rule.type)) st = stat(sh, rule);
      if (rule.scale) {
        if (typeof v !== 'number' || !st.sorted.length) continue; var pts = rule.scale.v.map(function (q) { return at(st, q); }), cs = rule.scale.c, k = 0;
        while (k < pts.length - 2 && v > pts[k + 1]) k++; var t = pts[k + 1] === pts[k] ? 0 : Math.max(0, Math.min(1, (v - pts[k]) / (pts[k + 1] - pts[k]))); if (!o.css.match(/background:/)) o.css += 'background:' + mix(cs[k], cs[k + 1], t) + ';';
      } else if (rule.bar) {
        if (typeof v !== 'number' || !st.sorted.length) continue; var lo = at(st, rule.bar.v[0]), hi = at(st, rule.bar.v[1]), f = hi === lo ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))), p = Math.round(10 + 80 * f);
        if (!o.bar) { o.bar = true; o.css += 'background-image:linear-gradient(90deg,' + rule.bar.c + ' ' + p + '%,transparent ' + p + '%);'; }
      } else if (rule.icon) {
        if (typeof v !== 'number' || !st.sorted.length || o.icon) continue; var set = rule.icon.set, n = parseInt(set, 10) || 3, th = rule.icon.v.slice(1).map(function (q) { return at(st, q); }), idx = 0;
        th.forEach(function (x) { if (v >= x) idx++; }); if (rule.icon.rev) idx = n - 1 - idx;
        var key = /Arrow/.test(set) ? 'arrows' : /Traffic|Rating|Quarters|Boxes/.test(set) ? 'traffic' : /Symbol/.test(set) ? 'symbols' : /Flag/.test(set) ? 'flags' : /Star/.test(set) ? 'stars' : 'dots', g = GLYPH[key], pick = n === 3 ? idx : Math.min(2, Math.round(idx * 2 / (n - 1)));
        o.icon = { g: g[pick], c: pick === 2 ? C('sw_green') : pick === 1 ? C('fl_yellow') : C('sw_red') };
      } else if (rule.dxf && test(rule, v, st, sh)) {
        var d = rule.dxf; if (d.bg && !/background:/.test(o.css)) o.css += 'background:' + d.bg + ';'; if (d.color && !/color:[^;]*;/.test(o.css.replace(/background[^;]*;/g, ''))) o.css += 'color:' + d.color + ';'; if (d.b) o.css += 'font-weight:700;'; if (d.i) o.css += 'font-style:italic;';
      }
    }
    return out && (out.css || out.icon) ? out : null;
  };

  // ---- charts and pictures over the grid -----------------------------------------------------------------------------------------
  // the size the chart has in Excel itself (default 64 x 20 pixel cells), so the picture keeps its shape although this grid's cells are taller
  function ew(o) { return (o.b.c - o.a.c) * 64 + (o.b.co - o.a.co) / 9525; }
  function eh(o) { return (o.b.r - o.a.r) * 20 + (o.b.ro - o.a.ro) / 9525; }
  X.place = function (host, g) {
    var layer = host.querySelector('.gobj'); if (!layer) { layer = document.createElement('div'); layer.className = 'gobj'; host.appendChild(layer); } layer.innerHTML = '';
    var s = X.sheets[Wb.sheets.indexOf(g.sh)]; if (!s || !s.objs.length) return;
    function pt(p) { var c = Math.min(p.c, g.cols), r = Math.min(p.r, g.rows); return { x: GridView.HW + g.colX[c] + p.co / 9525, y: g.tops[r] + p.ro / 9525 - g.tops[g.fy] }; }
    s.objs.forEach(function (o) {
      var a = pt(o.a), b = o.b ? pt(o.b) : { x: a.x + o.w, y: a.y + o.h }, w = Math.max(20, b.x - a.x), h = Math.max(20, o.b && ew(o) > 0 ? w * eh(o) / ew(o) : b.y - a.y), el = document.createElement('div');
      el.className = 'gobj-i' + (o.chart ? ' ch' : ''); el.style.cssText = 'left:' + a.x + 'px;top:' + a.y + 'px;width:' + w + 'px;height:' + h + 'px';
      el.innerHTML = o.chart ? ChartSvg.svg(o.chart, Math.round(w), Math.round(h)).replace('width="100%"', 'width="100%" height="100%"') : '<img src="' + o.img + '" alt="">'; layer.appendChild(el);
    });
  };
})();
