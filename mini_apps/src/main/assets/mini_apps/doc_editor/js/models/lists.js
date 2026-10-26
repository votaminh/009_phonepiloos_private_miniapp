// Lists — the kinds of list the editor offers (1. a. i. · 1) a) i) · I. A. 1. · A. a. 1. · i. a. 1. · 1. 1.1. 1.1.1. · and four bullet sets), the label each item shows, and the numbering definition written into the file for a kind the file does not have yet.
(function () {
  'use strict';
  function alpha(n, up) { var s = ''; n = Math.max(1, n); while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode((up ? 65 : 97) + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  function roman(n, up) { var m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], o = ''; m.forEach(function (p) { while (n >= p[0]) { o += p[1]; n -= p[0]; } }); return up ? o.toUpperCase() : o; }
  var FMT = { decimal: function (n) { return String(n); }, lowerLetter: function (n) { return alpha(n); }, upperLetter: function (n) { return alpha(n, true); }, lowerRoman: function (n) { return roman(n); }, upperRoman: function (n) { return roman(n, true); } };
  var P = [
    { id: 'n1', kind: 'ordered', lv: [['decimal', '%1.'], ['lowerLetter', '%2.'], ['lowerRoman', '%3.']] },
    { id: 'n2', kind: 'ordered', lv: [['decimal', '%1)'], ['lowerLetter', '%2)'], ['lowerRoman', '%3)']] },
    { id: 'n3', kind: 'ordered', lv: [['upperRoman', '%1.'], ['upperLetter', '%2.'], ['decimal', '%3.']] },
    { id: 'n4', kind: 'ordered', lv: [['upperLetter', '%1.'], ['lowerLetter', '%2.'], ['decimal', '%3.']] },
    { id: 'n5', kind: 'ordered', lv: [['lowerRoman', '%1.'], ['lowerLetter', '%2.'], ['decimal', '%3.']] },
    { id: 'n6', kind: 'ordered', lv: [['decimal', '%1.'], ['decimal', '%1.%2.'], ['decimal', '%1.%2.%3.'], ['decimal', '%1.%2.%3.%4.']], cycle: false },
    { id: 'b1', kind: 'bullet', lv: [[null, '\u2022'], [null, '\u25CB'], [null, '\u25AA']] },
    { id: 'b2', kind: 'bullet', lv: [[null, '\u27A2'], [null, '\u2013'], [null, '\u2022']] },
    { id: 'b3', kind: 'bullet', lv: [[null, '\u2713'], [null, '\u2022'], [null, '\u2013']] },
    { id: 'b4', kind: 'bullet', lv: [[null, '\u25A0'], [null, '\u25A1'], [null, '\u2022']] }
  ], MAP = {};
  P.forEach(function (p) { MAP[p.id] = p; });
  var L = window.Lists = { presets: P, get: function (id, kind) { return MAP[id] || MAP[kind === 'bullet' ? 'b1' : 'n1']; } };
  function spec(p, lv) { var l = p.lv; return p.cycle === false ? l[Math.min(lv, l.length - 1)] : l[lv % l.length]; }
  // the text beside an item at level lv, given the counters of each level (c[0..])
  L.label = function (id, kind, lv, c) {
    var p = L.get(id, kind), s = spec(p, lv); if (p.kind === 'bullet') return s[1];
    return s[1].replace(/%(\d)/g, function (m, d) { var i = +d - 1, sp = spec(p, i); return (FMT[sp[0]] || FMT.decimal)(c[i] || 1); });
  };
  // the label of an item whose list is defined by the file itself: def = { ilvl: [numFmt, lvlText, start] }
  var FMTF = { decimal: FMT.decimal, lowerLetter: FMT.lowerLetter, upperLetter: FMT.upperLetter, lowerRoman: FMT.lowerRoman, upperRoman: FMT.upperRoman, decimalZero: function (n) { return (n < 10 ? '0' : '') + n; }, none: function () { return ''; } };
  L.fileLabel = function (def, lv, c) {
    var d = def && (def[lv] || def[0]); if (!d) return null; var fmt = d[0], tx = String(d[1] || '');
    if (fmt === 'bullet') { var ch = tx.charAt(0), code = ch.charCodeAt(0); return !ch || code >= 0xF000 || code < 32 ? (lv % 3 === 0 ? '\u2022' : lv % 3 === 1 ? '\u25CB' : '\u25AA') : ch; }
    return tx.replace(/%(\d)/g, function (m, n) { var i = +n - 1, di = def[i] || def[0], f = FMTF[di[0]] || FMT.decimal; return f((c[i] || 1) + ((di[2] || 1) - 1)); });
  };
  // the definition the engine appends to numbering.xml: nine levels
  L.def = function (id, numId) {
    var p = L.get(id), levels = [];
    for (var i = 0; i < 9; i++) {
      var s = spec(p, i), lt = p.kind === 'bullet' ? s[1] : s[1].replace(/%(\d)/g, function (m, d) { return '%' + d; });
      if (p.kind === 'ordered' && p.cycle === false && i >= p.lv.length) lt = Array.apply(null, Array(i + 1)).map(function (x, k) { return '%' + (k + 1); }).join('.') + '.';
      levels.push({ numFmt: p.kind === 'bullet' ? 'bullet' : s[0], lvlText: lt, indentLeft: 720 * (i + 1), hanging: 360, start: 1, font: p.kind === 'bullet' ? 'Arial' : undefined });
    }
    return { numId: String(numId), kind: p.kind, levels: levels };
  };
})();
