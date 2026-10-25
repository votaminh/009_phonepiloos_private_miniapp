// Paragraphs — lines of text from the engine grouped into paragraphs (leading, overlap and font size decide), the way GenOffice's PDF app does it (renderer/text-block.ts), so a paragraph can be edited as one piece.
// Deliberately careful: a paragraph split in two can still be edited line by line; two columns merged cannot be told apart again.
(function () {
  'use strict';
  var CJK = /[⺀-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/;
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
  function lowMedian(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.ceil(s.length / 2) - 1]; }
  function dominant(pairs) {
    var by = {}, best = pairs[0][0], bw = -1;
    pairs.forEach(function (p) { var b = Math.round(p[0] * 2) / 2; by[b] = (by[b] || 0) + p[1]; });
    Object.keys(by).forEach(function (b) { if (by[b] > bw) { bw = by[b]; best = +b; } });
    return best;
  }
  // how wide the first word of the next line is: a ragged wrap before a long word is not a paragraph end
  function firstTokenWidth(text, fs) { var t = text.replace(/^\s+/, ''); if (!t) return 0; if (CJK.test(t[0])) return fs * 2; return /^\S+/.exec(t)[0].length * fs * 0.6; }
  function extent(lines) { var x1 = 1e9, x2 = -1e9; lines.forEach(function (l) { x1 = Math.min(x1, l.rect[0]); x2 = Math.max(x2, l.rect[2]); }); return [x1, x2]; }

  // which edge the lines agree on best (the first line may be indented, the last one short)
  function inferAlign(lines, x1, x2, fs) {
    if (lines.length < 2) return 'left';
    var tol = fs * 0.6, mid = (x1 + x2) / 2, two = lines.length === 2;
    function dev(sel, skip) { return Math.max.apply(0, lines.map(function (l, i) { return !two && skip(i) ? 0 : Math.abs(sel(l)); })); }
    var ld = dev(function (l) { return l.rect[0] - x1; }, function (i) { return i === 0; });
    var rd = dev(function (l) { return x2 - l.rect[2]; }, function (i) { return i === lines.length - 1; });
    var cd = dev(function (l) { return (l.rect[0] + l.rect[2]) / 2 - mid; }, function () { return false; });
    if (ld <= tol && ld <= cd && ld <= rd) return 'left';
    if (two && rd <= tol) { var shift = Math.abs(lines[0].rect[0] - lines[1].rect[0]); if (shift > tol && shift <= fs * 2.5) return 'left'; }
    if (cd <= tol && cd <= rd) return 'center';
    if (!two) {
      var rest = lines.slice(1), rx = Math.min.apply(0, rest.map(function (l) { return l.rect[0]; })), rdv = Math.max.apply(0, rest.map(function (l) { return l.rect[0] - rx; })), inset = rx - x1;
      if (lines[0].rect[0] - x1 <= tol && rdv <= tol && inset > tol && inset <= fs * 2.5) return 'left';
    }
    return rd <= tol ? 'right' : 'left';
  }

  // lines → paragraphs
  function group(page, raw) {
    var lines = raw.map(function (r) { return { rect: r.rect, text: r.text, y: r.y, fontSize: r.fs || (r.rect[3] - r.rect[1]) * 0.8 }; });
    lines.sort(function (a, b) { return b.y - a.y || a.rect[0] - b.rect[0]; });
    var open = [];
    lines.forEach(function (ln) {
      var best = null, bestOv = 0;
      open.forEach(function (p) {
        var last = p.lines[p.lines.length - 1], gap = last.y - ln.y; if (gap <= 0) return;
        var fs = Math.max(last.fontSize, ln.fontSize); if (Math.abs(last.fontSize - ln.fontSize) > fs * 0.1) return;
        if (gap > (p.leads.length ? median(p.leads) * 1.5 : fs * 2.5)) return;
        var e = extent(p.lines), ov = Math.min(e[1], ln.rect[2]) - Math.max(e[0], ln.rect[0]), narrow = Math.min(e[1] - e[0], ln.rect[2] - ln.rect[0]);
        if (!(narrow > 0) || ov < narrow * 0.6) return;
        if (ov > bestOv) { bestOv = ov; best = p; }
      });
      if (best) { best.leads.push(best.lines[best.lines.length - 1].y - ln.y); best.lines.push(ln); } else open.push({ lines: [ln], leads: [] });
    });
    // a line that stops far short of the right edge ends its paragraph (left-set text only)
    for (var i = open.length - 1; i >= 0; i--) {
      var p = open[i]; if (p.lines.length < 2) continue;
      var e = extent(p.lines), fs0 = dominant(p.lines.map(function (l) { return [l.fontSize, l.rect[2] - l.rect[0]]; }));
      if (inferAlign(p.lines, e[0], e[1], fs0) !== 'left') continue;
      var parts = [], cur = { lines: [p.lines[0]], leads: [] };
      for (var j = 1; j < p.lines.length; j++) {
        var prev = p.lines[j - 1], ln = p.lines[j];
        if (e[1] - prev.rect[2] > firstTokenWidth(ln.text, ln.fontSize) + ln.fontSize * 1.5) { parts.push(cur); cur = { lines: [ln], leads: [] }; }
        else { cur.leads.push(p.leads[j - 1]); cur.lines.push(ln); }
      }
      parts.push(cur);
      if (parts.length > 1) open.splice.apply(open, [i, 1].concat(parts));
    }
    // a jump in the leading inside a paragraph is a boundary (a heading glued to the text below)
    var split = [];
    open.forEach(function (p) {
      if (!p.leads.length) { split.push(p); return; }
      if (p.leads.length === 1) {
        var fs = Math.max(p.lines[0].fontSize, p.lines[1].fontSize);
        if (p.leads[0] > fs * 2.1) split.push({ lines: [p.lines[0]], leads: [] }, { lines: [p.lines[1]], leads: [] }); else split.push(p);
        return;
      }
      var med = lowMedian(p.leads), cur2 = { lines: [p.lines[0]], leads: [] };
      for (var k = 1; k < p.lines.length; k++) {
        var lead = p.leads[k - 1];
        if (lead > med * 1.45) { split.push(cur2); cur2 = { lines: [p.lines[k]], leads: [] }; } else { cur2.leads.push(lead); cur2.lines.push(p.lines[k]); }
      }
      split.push(cur2);
    });
    split.sort(function (a, b) { return b.lines[0].y - a.lines[0].y || a.lines[0].rect[0] - b.lines[0].rect[0]; });
    return split.map(function (p, n) {
      var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      p.lines.forEach(function (l) { x1 = Math.min(x1, l.rect[0]); y1 = Math.min(y1, l.rect[1]); x2 = Math.max(x2, l.rect[2]); y2 = Math.max(y2, l.rect[3]); });
      var fs = dominant(p.lines.map(function (l) { return [l.fontSize, l.rect[2] - l.rect[0]]; }));
      return { id: page + ':p' + n, page: page, rect: [x1, y1, x2, y2], fs: Math.round(fs * 10) / 10, lh: p.leads.length ? median(p.leads) : fs * 1.2, align: inferAlign(p.lines, x1, x2, fs), lines: p.lines, first: p.lines[0].y, text: Wrap.join(p.lines.map(function (l) { return l.text; })) };
    });
  }
  window.Paragraphs = { group: group };
})();
