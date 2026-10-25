// Wrap — the text of a paragraph as the engine needs it: lines joined back into one string, and a string broken into lines of a given width (GenOffice's renderer/text-wrap.ts).
// Latin breaks at spaces, CJK after any character; a closing mark never starts a line and an opening bracket never ends one. Widths are measured on a canvas in the look-alike face.
(function () {
  'use strict';
  var CJK = /[⺀-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/;
  var NO_START = new Set('，。、；：！？）】」』〉》〕…‥·—～ヽヾゝゞ々ー%％℃,.;:!?)]}"\'’”°'), NO_END = new Set('（【「『〈《〔([{“‘');
  var ctx = null, cache = {};
  function tokenize(text) {
    var units = [], word = '';
    function flush() { if (word) units.push(word); word = ''; }
    Array.from(text).forEach(function (ch) {
      if (/\s/.test(ch)) { flush(); if (units.length && units[units.length - 1] === ' ') return; units.push(' '); }
      else if (CJK.test(ch) || NO_START.has(ch) || NO_END.has(ch)) { flush(); units.push(ch); } else word += ch;
    });
    flush(); return units;
  }
  // width in PDF points of text at size fs in a CSS family ('bold'/'italic' in style)
  function measure(text, fs, family, style) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    var font = ((style || '') + ' 100px ' + family).trim(); if (ctx.font !== font) ctx.font = font;
    var w = 0; Array.from(text).forEach(function (ch) { var k = font + '\u0000' + ch, cw = cache[k]; if (cw === undefined) { cw = ctx.measureText(ch).width; cache[k] = cw; } w += cw; });
    return w / 100 * fs;
  }
  function wrap(text, width, fs, family, style) {
    var w = function (s) { return measure(s, fs, family, style); }, units = tokenize(text.trim()), lines = [], line = '';
    function push() { if (line.trim()) lines.push(line.trim()); line = ''; }
    for (var i = 0; i < units.length; i++) {
      var u = units[i]; if (u === ' ' && !line) continue;
      if (line && w(line + u) > width && u !== ' ') {
        if (NO_START.has(u)) { var m = /^(.*?)(\S)$/.exec(line); if (m && m[1].trim()) { line = m[1]; push(); line = m[2]; } else push(); }
        else { var last = line.replace(/\s+$/, ''); if (last && NO_END.has(last[last.length - 1])) { line = last.slice(0, -1); push(); line = last[last.length - 1]; } else push(); }
      }
      while (w(u) > width && u.length > 1) { var k = 1; while (k < u.length && w(line + u.slice(0, k + 1)) <= width) k++; line += u.slice(0, k); push(); u = u.slice(k); }
      line += u;
    }
    push(); return lines.length ? lines : [''];
  }
  // the lines of a paragraph as one string: a space between Latin words, nothing between CJK characters
  function join(lines) {
    var out = '';
    lines.forEach(function (l) { var t = String(l).trim(); if (!t) return; if (out) out += CJK.test(out[out.length - 1]) && CJK.test(t[0]) ? '' : ' '; out += t; });
    return out;
  }
  // lines pushed past the bottom of the paragraph would be drawn over whatever sits below: true when the new text grows into another paragraph
  function overflows(p, count, leading, fs, others) {
    var lastBase = p.first - (count - 1) * leading; if (lastBase >= p.rect[1] - fs * 0.1) return false;
    var band = [p.rect[0], lastBase - fs * 0.3, p.rect[2], p.rect[1]];
    return others.some(function (o) {
      if (o.id === p.id) return false; var r = o.rect;
      return Math.min(r[2], band[2]) - Math.max(r[0], band[0]) > 1 && Math.min(r[3], band[3]) - Math.max(r[1], band[1]) > 1;
    });
  }
  window.Wrap = { measure: measure, wrap: wrap, join: join, overflows: overflows };
})();
