// ChartSvg — draws an Office chart (the chart part of a .docx / .xlsx) as a small SVG: columns, bars, lines, areas, pies, doughnuts, scatter, radar and bubbles, several kinds in one chart.
(function () {
  'use strict';
  var W = 600, H = 340, L = null;
  function kids(el, n) { var o = []; for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (!n || c.localName === n) o.push(c); return o; }
  function kid(el, n) { return kids(el, n)[0] || null; }
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function one(el, n) { return all(el, n)[0] || null; }
  function val(el, n) { var k = el && kid(el, n); return k ? k.getAttribute('val') : null; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function f1(n) { return Math.round(n * 10) / 10; }
  // the points of a data reference (cache or literal) in order of their idx
  function pts(el) {
    var host = el && (one(el, 'numCache') || one(el, 'strCache') || one(el, 'numLit') || one(el, 'strLit')); if (!host) return [];
    var n = +(val(host, 'ptCount') || 0), out = new Array(n);
    kids(host, 'pt').forEach(function (p) { var i = +p.getAttribute('idx'); out[i] = (kid(p, 'v') || {}).textContent; if (i >= out.length) out.length = i + 1; });
    return Array.prototype.slice.call(out);
  }
  function nums(el) { return pts(el).map(function (v) { var x = parseFloat(v); return isNaN(x) ? null : x; }); }
  function color(sp, i, line) {
    var fill = sp && (line ? one(kid(sp, 'ln'), 'solidFill') : kid(sp, 'solidFill')), c = fill && fill.firstElementChild;
    if (c && c.localName === 'srgbClr') return '#' + c.getAttribute('val');
    if (c && c.localName === 'schemeClr') { var m = /accent(\d)/.exec(c.getAttribute('val')); if (m) return L.series[(+m[1] - 1) % L.series.length]; }
    return L.series[i % L.series.length];
  }
  function nice(lo, hi) {
    if (lo === hi) { hi = lo + 1; } var span = hi - lo, st = Math.pow(10, Math.floor(Math.log10(span / 5))), r = span / 5 / st;
    st *= r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10; var a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, t = [];
    for (var v = a; v <= b + st / 2; v += st) t.push(Math.round(v / st) * st); return t;
  }
  function fmt(v) { var a = Math.abs(v); return a >= 1e6 ? f1(v / 1e6) + 'M' : a >= 1e4 ? f1(v / 1e3) + 'K' : String(Math.round(v * 100) / 100); }

  function parse(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml'), ch = one(doc, 'chart'); if (!ch) return null;
    var pa = one(ch, 'plotArea'), m = { title: '', legend: !!kid(ch, 'legend'), plots: [] }, ti = kid(ch, 'title');
    if (ti && val(ti, 'overlay') !== '1') m.title = all(ti, 't').map(function (t) { return t.textContent; }).join('');
    kids(pa).forEach(function (p) {
      var n = p.localName; if (!/Chart$/.test(n) || /^(surface|stock|ofPie)/.test(n)) return;
      var type = n.replace(/3?DChart$|Chart$/, ''), pl = { type: type, dir: val(p, 'barDir') || 'col', grouping: val(p, 'grouping') || 'clustered', ser: [], ax: kids(p, 'axId').map(function (a) { return a.getAttribute('val'); }), lbl: val(kid(p, 'dLbls'), 'showVal') === '1', pct: val(kid(p, 'dLbls'), 'showPercent') === '1' };
      kids(p, 'ser').forEach(function (s, i) {
        var sp = kid(s, 'spPr'), d = { name: (one(kid(s, 'tx'), 'v') || {}).textContent || '', cats: pts(kid(s, 'cat') || kid(s, 'xVal')), vals: nums(kid(s, 'val') || kid(s, 'yVal')), size: nums(kid(s, 'bubbleSize')), color: color(sp, i + m.plots.reduce(function (a, q) { return a + q.ser.length; }, 0), type === 'line' || type === 'scatter' || type === 'radar'), pt: {}, lbl: val(kid(s, 'dLbls'), 'showVal') === '1' || pl.lbl, pct: val(kid(s, 'dLbls'), 'showPercent') === '1' || pl.pct, mark: val(kid(s, 'marker'), 'symbol') !== 'none' && (type !== 'line' || !!kid(s, 'marker') || val(p, 'marker') === '1') };
        kids(s, 'dPt').forEach(function (dp) { d.pt[val(dp, 'idx')] = color(kid(dp, 'spPr'), +val(dp, 'idx')); });
        if (!d.cats.length) d.cats = d.vals.map(function (_, k) { return String(k + 1); });
        pl.ser.push(d);
      });
      if (pl.ser.length) m.plots.push(pl);
    });
    m.valMin = one(pa, 'min') ? +one(pa, 'min').getAttribute('val') : null; m.valMax = one(pa, 'max') ? +one(pa, 'max').getAttribute('val') : null;
    return m.plots.length ? m : null;
  }

  function draw(m) {
    var o = [], top = m.title ? 34 : 12, bot = m.legend ? 40 : 14, first = m.plots[0], round = /^(pie|doughnut)$/.test(first.type), radar = first.type === 'radar';
    var two = m.plots.some(function (p) { return p.ax[1] !== first.ax[1]; }), left = round || radar ? 12 : 48, right = two ? 38 : 14, x0 = left, x1 = W - right, y0 = top, y1 = H - bot - (round || radar ? 0 : 18);
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" font-family="sans-serif" font-size="11"><rect width="' + W + '" height="' + H + '" fill="' + L.back + '"/>');
    if (m.title) o.push('<text x="' + W / 2 + '" y="22" text-anchor="middle" font-size="15" font-weight="bold" fill="' + L.text + '">' + esc(m.title) + '</text>');
    var legend = [];
    if (round) {
      var s = first.ser[0], tot = s.vals.reduce(function (a, v) { return a + (v > 0 ? v : 0); }, 0) || 1, cx = W / 2, cy = (y0 + y1) / 2, r = Math.min(y1 - y0, W - 40) / 2 - 6, ang = -Math.PI / 2, hole = first.type === 'doughnut' ? r * 0.5 : 0;
      s.vals.forEach(function (v, i) {
        if (!(v > 0)) return; var a = v / tot * Math.PI * 2, b = ang + a, c = s.pt[i] || L.series[i % L.series.length], big = a > Math.PI ? 1 : 0;
        var P = function (rr, an) { return f1(cx + rr * Math.cos(an)) + ' ' + f1(cy + rr * Math.sin(an)); };
        o.push(a >= Math.PI * 2 - 1e-6 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '"/>' : '<path d="M' + P(hole || 0, ang) + (hole ? '' : '') + ' L' + P(r, ang) + ' A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + P(r, b) + (hole ? ' L' + P(hole, b) + ' A' + hole + ' ' + hole + ' 0 ' + big + ' 0 ' + P(hole, ang) : ' Z') + ' Z" fill="' + c + '" stroke="' + L.back + '" stroke-width="1.5"/>');
        if (s.lbl || s.pct) { var mid = ang + a / 2, rr = hole ? (r + hole) / 2 : r * 0.62; o.push('<text x="' + f1(cx + rr * Math.cos(mid)) + '" y="' + f1(cy + rr * Math.sin(mid) + 4) + '" text-anchor="middle" fill="' + L.back + '" font-weight="bold">' + (s.pct ? Math.round(v / tot * 100) + '%' : fmt(v)) + '</text>'); }
        ang = b; legend.push({ n: s.cats[i], c: c });
      });
    } else if (radar) {
      var cs = first.ser[0].cats, nn = cs.length, rcx = W / 2, rcy = (y0 + y1) / 2, rr0 = Math.min(y1 - y0, W - 120) / 2 - 8, mx = Math.max.apply(null, [1].concat(first.ser.reduce(function (a, s) { return a.concat(s.vals); }, []).filter(function (v) { return v != null; })));
      for (var g = 1; g <= 4; g++) { o.push('<polygon points="' + cs.map(function (_, i) { var an = -Math.PI / 2 + i * 2 * Math.PI / nn; return f1(rcx + rr0 * g / 4 * Math.cos(an)) + ',' + f1(rcy + rr0 * g / 4 * Math.sin(an)); }).join(' ') + '" fill="none" stroke="' + L.grid + '"/>'); }
      cs.forEach(function (c, i) { var an = -Math.PI / 2 + i * 2 * Math.PI / nn; o.push('<line x1="' + rcx + '" y1="' + rcy + '" x2="' + f1(rcx + rr0 * Math.cos(an)) + '" y2="' + f1(rcy + rr0 * Math.sin(an)) + '" stroke="' + L.grid + '"/><text x="' + f1(rcx + (rr0 + 12) * Math.cos(an)) + '" y="' + f1(rcy + (rr0 + 12) * Math.sin(an) + 4) + '" text-anchor="middle" fill="' + L.text + '">' + esc(c) + '</text>'); });
      first.ser.forEach(function (s) { o.push('<polygon points="' + s.vals.map(function (v, i) { var an = -Math.PI / 2 + i * 2 * Math.PI / nn; return f1(rcx + rr0 * (v || 0) / mx * Math.cos(an)) + ',' + f1(rcy + rr0 * (v || 0) / mx * Math.sin(an)); }).join(' ') + '" fill="' + s.color + '" fill-opacity=".18" stroke="' + s.color + '" stroke-width="2"/>'); legend.push({ n: s.name, c: s.color }); });
    } else axes(m, o, x0, x1, y0, y1, legend);
    if (m.legend && legend.length) {
      var lw = legend.reduce(function (a, l) { return a + 26 + String(l.n).length * 6.4; }, 0), lx = Math.max(8, (W - lw) / 2);
      legend.forEach(function (l) { o.push('<rect x="' + f1(lx) + '" y="' + (H - 26) + '" width="10" height="10" fill="' + l.c + '"/><text x="' + f1(lx + 14) + '" y="' + (H - 17) + '" fill="' + L.text + '">' + esc(l.n) + '</text>'); lx += 26 + String(l.n).length * 6.4; });
    }
    return o.join('') + '</svg>';
  }

  // the plots that sit on a pair of axes: bars and columns, lines, areas, scatter and bubbles
  function axes(m, o, x0, x1, y0, y1, legend) {
    var horiz = m.plots[0].type === 'bar' && m.plots[0].dir === 'bar', xy = /^(scatter|bubble)$/.test(m.plots[0].type);
    var sets = {}; m.plots.forEach(function (p) { var k = p.ax[1] || 'a'; (sets[k] = sets[k] || []).push(p); });
    var keys = Object.keys(sets), cats = m.plots[0].ser[0].cats, nc = Math.max.apply(null, m.plots.map(function (p) { return Math.max.apply(null, p.ser.map(function (s) { return s.vals.length; })); }));
    var scales = keys.map(function (k) {
      var lo = 0, hi = 0, first = true; sets[k].forEach(function (p) {
        var stacked = /stacked/i.test(p.grouping) && /^(bar|area)$/.test(p.type), pct = /percent/i.test(p.grouping);
        if (stacked) { for (var i = 0; i < nc; i++) { var pos = 0, neg = 0; p.ser.forEach(function (s) { var v = s.vals[i] || 0; if (v >= 0) pos += v; else neg += v; }); hi = Math.max(hi, pct ? 100 : pos); lo = Math.min(lo, neg); } }
        else p.ser.forEach(function (s) { s.vals.forEach(function (v) { if (v == null) return; hi = first ? v : Math.max(hi, v); lo = first ? v : Math.min(lo, v); first = false; }); });
        if (!/^(bar|area)$/.test(p.type) && first === false && lo > 0) lo = Math.min(lo, lo - (hi - lo) * 0.2);
      });
      if (/^(bar|area)$/.test(sets[k][0].type)) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
      if (m.valMin != null && k === keys[0]) lo = m.valMin; if (m.valMax != null && k === keys[0]) hi = m.valMax;
      return nice(lo, hi);
    });
    function xnum(s, i) { var v = parseFloat(s.cats[i]); return isNaN(v) ? i + 1 : v; }
    var xall = xy ? m.plots[0].ser.reduce(function (a, s) { return a.concat(s.cats.map(function (_, i) { return xnum(s, i); })); }, []) : [], xs = xy ? nice(Math.min.apply(null, xall), Math.max.apply(null, xall)) : null;
    var sc = scales[0], sMin = sc[0], sMax = sc[sc.length - 1], gw = horiz ? y1 - y0 : x1 - x0, gh = horiz ? x1 - x0 : y1 - y0;
    function vy(v, s) { s = s || sc; return horiz ? x0 + (v - s[0]) / ((s[s.length - 1] - s[0]) || 1) * (x1 - x0) : y1 - (v - s[0]) / ((s[s.length - 1] - s[0]) || 1) * (y1 - y0); }
    function cx(i, n) { return horiz ? y1 - (i + .5) / n * (y1 - y0) : x0 + (i + .5) / n * (x1 - x0); }
    function xv(v) { return x0 + (v - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1) * (x1 - x0); }
    sc.forEach(function (t) { var p = vy(t); o.push(horiz ? '<line x1="' + f1(p) + '" y1="' + y0 + '" x2="' + f1(p) + '" y2="' + y1 + '" stroke="' + L.grid + '"/><text x="' + f1(p) + '" y="' + (y1 + 13) + '" text-anchor="middle" fill="' + L.text + '">' + fmt(t) + '</text>' : '<line x1="' + x0 + '" y1="' + f1(p) + '" x2="' + x1 + '" y2="' + f1(p) + '" stroke="' + L.grid + '"/><text x="' + (x0 - 6) + '" y="' + f1(p + 4) + '" text-anchor="end" fill="' + L.text + '">' + fmt(t) + '</text>'); });
    if (scales[1]) scales[1].forEach(function (t) { o.push('<text x="' + (x1 + 4) + '" y="' + f1(vy(t, scales[1]) + 4) + '" fill="' + L.text + '" font-size="10">' + fmt(t) + '</text>'); });
    if (xy) xs.forEach(function (t) { o.push('<text x="' + f1(xv(t)) + '" y="' + (y1 + 14) + '" text-anchor="middle" fill="' + L.text + '">' + fmt(t) + '</text>'); });
    else cats.forEach(function (c, i) { var p = cx(i, cats.length); o.push(horiz ? '<text x="' + (x0 - 6) + '" y="' + f1(p + 4) + '" text-anchor="end" fill="' + L.text + '">' + esc(c) + '</text>' : '<text x="' + f1(p) + '" y="' + (y1 + 15) + '" text-anchor="middle" fill="' + L.text + '">' + esc(c) + '</text>'); });
    var zero = vy(Math.max(sMin, Math.min(0, sMax))); o.push(horiz ? '<line x1="' + f1(zero) + '" y1="' + y0 + '" x2="' + f1(zero) + '" y2="' + y1 + '" stroke="' + L.axis + '"/>' : '<line x1="' + x0 + '" y1="' + f1(zero) + '" x2="' + x1 + '" y2="' + f1(zero) + '" stroke="' + L.axis + '"/>');
    var nBar = m.plots.reduce(function (a, p) { return a + (p.type === 'bar' && !/stacked/i.test(p.grouping) ? p.ser.length : 0); }, 0), bi = 0;
    keys.forEach(function (k, ki) {
      var s2 = scales[ki];
      sets[k].forEach(function (p) {
        var stacked = /stacked/i.test(p.grouping), pct = /percent/i.test(p.grouping), n = Math.max.apply(null, p.ser.map(function (s) { return s.vals.length; })), acc = new Array(n).fill(0), tots = [];
        if (pct) for (var q = 0; q < n; q++) tots[q] = p.ser.reduce(function (a, s) { return a + Math.abs(s.vals[q] || 0); }, 0) || 1;
        p.ser.forEach(function (s) {
          legend.push({ n: p.type === 'pie' ? '' : s.name, c: s.color });
          var line = [], base = new Array(n).fill(0);
          s.vals.forEach(function (v, i) {
            if (v == null) return; var c = xy ? null : cx(i, n), band = (horiz ? (y1 - y0) : (x1 - x0)) / n, lo = acc[i];
            if (pct) v = v / tots[i] * 100;
            if (p.type === 'bar') {
              var bw = stacked ? band * .6 : band * .7 / (nBar || 1), off = stacked ? -bw / 2 : -band * .35 + bi * bw, a = vy(stacked ? lo : 0, s2), b = vy(stacked ? lo + v : v, s2);
              o.push(horiz ? '<rect x="' + f1(Math.min(a, b)) + '" y="' + f1(c - off - bw) + '" width="' + f1(Math.abs(b - a)) + '" height="' + f1(bw) + '" fill="' + (s.pt[i] || s.color) + '"/>' : '<rect x="' + f1(c + off) + '" y="' + f1(Math.min(a, b)) + '" width="' + f1(bw) + '" height="' + f1(Math.abs(b - a)) + '" fill="' + (s.pt[i] || s.color) + '"/>');
              if (s.lbl) o.push('<text x="' + f1(horiz ? Math.max(a, b) + 3 : c + off + bw / 2) + '" y="' + f1(horiz ? c - off - bw / 2 + 4 : Math.min(a, b) - 4) + '" text-anchor="' + (horiz ? 'start' : 'middle') + '" fill="' + L.text + '" font-size="10">' + fmt(v) + '</text>');
              if (stacked) acc[i] += v;
            } else if (p.type === 'scatter' || p.type === 'bubble') {
              var px = xv(xnum(s, i)), py = vy(v, s2); line.push([px, py]);
              if (p.type === 'bubble') { var mxs = Math.max.apply(null, s.size.filter(Boolean)) || 1; o.push('<circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="' + f1(6 + 16 * Math.sqrt((s.size[i] || 0) / mxs)) + '" fill="' + s.color + '" fill-opacity=".6"/>'); } else if (s.mark) o.push('<circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="3.5" fill="' + s.color + '"/>');
            } else { var yv = /stacked/i.test(p.grouping) ? (acc[i] += v) : v; line.push([c, vy(yv, s2)]); base[i] = /stacked/i.test(p.grouping) ? acc[i] - v : 0; }
          });
          if (p.type === 'line' || p.type === 'scatter') { if (line.length > 1 && !(p.type === 'scatter' && false)) o.push('<polyline points="' + line.map(function (q) { return f1(q[0]) + ',' + f1(q[1]); }).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2.2"/>'); if (p.type === 'line' && s.mark) line.forEach(function (q) { o.push('<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="3.5" fill="' + s.color + '"/>'); }); if (s.lbl && p.type === 'line') line.forEach(function (q, i) { o.push('<text x="' + f1(q[0]) + '" y="' + f1(q[1] - 7) + '" text-anchor="middle" fill="' + L.text + '" font-size="10">' + fmt(s.vals[i]) + '</text>'); }); }
          if (p.type === 'area' && line.length > 1) { var z = vy(0, s2); o.push('<polygon points="' + line.map(function (q) { return f1(q[0]) + ',' + f1(q[1]); }).concat(line.slice().reverse().map(function (q, i) { return f1(q[0]) + ',' + f1(stackedBase(q, line.length - 1 - i)); })).join(' ') + '" fill="' + s.color + '" fill-opacity="' + (stacked ? 1 : .75) + '"/>'); function stackedBase(q, i) { return stacked ? vy(base[i], s2) : z; } }
          if (p.type === 'bar' && !stacked) bi++;
        });
      });
    });
    var seen = {}; for (var i = legend.length - 1; i >= 0; i--) { var key = legend[i].n + legend[i].c; if (seen[key] || !legend[i].n) legend.splice(i, 1); else seen[key] = 1; }
  }

  window.ChartSvg = { parse: function (x) { L = window.ChartLook; return parse(x); }, svg: function (xml, w, h) { try { L = window.ChartLook; W = w || 600; H = h || 340; var m = parse(xml); return m ? draw(m) : ''; } catch (e) { return ''; } } };
})();
