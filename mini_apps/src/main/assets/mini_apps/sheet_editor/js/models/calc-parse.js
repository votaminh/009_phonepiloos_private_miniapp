// CalcParse — turns the text of a formula ("=SUM(B2:B5)*2") into a tree the evaluator walks. No evaluation here.
(function () {
  'use strict';
  var REF = /^(?:('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?/;
  function colNum(s) { var c = 0, i; s = s.toUpperCase(); for (i = 0; i < s.length; i++) c = c * 26 + s.charCodeAt(i) - 64; return c - 1; }

  function lex(src) {
    var t = [], i = 0, m, ch;
    while (i < src.length) {
      ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
      if (ch === '"') { var s = '', j = i + 1; for (;;) { if (j >= src.length) throw new Error('str'); if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; } t.push({ k: 'str', v: s }); i = j + 1; continue; }
      m = /^\d+(\.\d*)?([eE][+-]?\d+)?|^\.\d+/.exec(src.slice(i));
      if (m) { t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      m = REF.exec(src.slice(i));
      if (m && !/^[A-Za-z0-9_(]/.test(src.slice(i + m[0].length, i + m[0].length + 1))) {
        var sh = m[1] ? (m[1][0] === "'" ? m[1].slice(1, -1).replace(/''/g, "'") : m[1]) : null;
        t.push({ k: 'ref', sheet: sh, r1: +m[3] - 1, c1: colNum(m[2]), r2: m[5] ? +m[5] - 1 : +m[3] - 1, c2: m[4] ? colNum(m[4]) : colNum(m[2]), range: !!m[4] });
        i += m[0].length; continue;
      }
      m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
      if (m) { t.push({ k: 'id', v: m[0].toUpperCase() }); i += m[0].length; continue; }
      m = /^(<>|<=|>=|[-+*\/^&=<>(),%;])/.exec(src.slice(i));
      if (m) { t.push({ k: 'op', v: m[0] }); i += m[0].length; continue; }
      throw new Error('char ' + ch);
    }
    return t;
  }

  var BIN = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  function parse(text) {
    var tk = lex(String(text).replace(/^=/, '')), p = 0;
    function peek() { return tk[p]; }
    function isOp(v) { return tk[p] && tk[p].k === 'op' && tk[p].v === v; }
    function expr(min) {
      var a = unary(), o;
      while ((o = peek()) && o.k === 'op' && BIN[o.v] >= min && BIN[o.v]) { p++; var b = expr(BIN[o.v] + 1); a = { t: 'bin', op: o.v, a: a, b: b }; }
      return a;
    }
    function unary() {
      if (isOp('-') || isOp('+')) { var op = tk[p++].v, a = unary(); return op === '-' ? { t: 'un', a: a } : a; }
      var a2 = prim();
      while (isOp('%')) { p++; a2 = { t: 'pct', a: a2 }; }
      return a2;
    }
    function prim() {
      var x = tk[p++]; if (!x) throw new Error('end');
      if (x.k === 'num') return { t: 'num', v: x.v };
      if (x.k === 'str') return { t: 'str', v: x.v };
      if (x.k === 'ref') return { t: 'ref', sheet: x.sheet, r1: Math.min(x.r1, x.r2), r2: Math.max(x.r1, x.r2), c1: Math.min(x.c1, x.c2), c2: Math.max(x.c1, x.c2), range: x.range };
      if (x.k === 'id') {
        if (isOp('(')) {
          p++; var args = [];
          if (!isOp(')')) { for (;;) { args.push(isOp(',') || isOp(';') || isOp(')') ? { t: 'blank' } : expr(1)); if (isOp(',') || isOp(';')) { p++; continue; } break; } }
          if (!isOp(')')) throw new Error(')'); p++;
          return { t: 'fn', name: x.v, args: args };
        }
        if (x.v === 'TRUE' || x.v === 'FALSE') return { t: 'bool', v: x.v === 'TRUE' };
        throw new Error('name ' + x.v);
      }
      if (x.v === '(') { var e = expr(1); if (!isOp(')')) throw new Error(')'); p++; return e; }
      throw new Error('token ' + x.v);
    }
    var tree = expr(1);
    if (p < tk.length) throw new Error('extra');
    return tree;
  }
  window.CalcParse = { parse: parse, colNum: colNum };
})();
