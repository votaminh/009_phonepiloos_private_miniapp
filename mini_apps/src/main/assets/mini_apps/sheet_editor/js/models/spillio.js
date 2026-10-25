// SpillIo — how spilling formulas travel to and from a file. Excel stores LET's names as _xlpm.name and A1# as ANCHORARRAY(A1); this app writes them the way a person types them.
// out() is the file spelling of a formula, in() the typed one; arrayRange() says which formulas Excel only knows as array formulas (the block they fill must be written as the array's ref).
(function () {
  'use strict';
  function split(args) { var o = [], d = 0, q = false, cur = '', i, ch; for (i = 0; i < args.length; i++) { ch = args[i]; if (ch === '"') q = !q; if (!q) { if (ch === '(' || ch === '{') d++; if (ch === ')' || ch === '}') d--; if (ch === ',' && d === 0) { o.push(cur); cur = ''; continue; } } cur += ch; } o.push(cur); return o; }
  // the end of the call that opens at text[open] ('(')
  function close(text, open) { var d = 0, q = false, i; for (i = open; i < text.length; i++) { var ch = text[i]; if (ch === '"') q = !q; if (q) continue; if (ch === '(') d++; if (ch === ')' && --d === 0) return i; } return -1; }
  // every LET( / LAMBDA( call of a formula, innermost last, with the names it makes (LET: every other argument but the last; LAMBDA: every argument but the last)
  function calls(text) {
    var out = [], re = /\b(LET|LAMBDA)\(/gi, m; while ((m = re.exec(text))) { var o = m.index + m[0].length - 1, c = close(text, o); if (c < 0) continue; var a = split(text.slice(o + 1, c)), n = [], i; if (/^LET$/i.test(m[1])) { for (i = 0; i < a.length - 1; i += 2) n.push(a[i].trim()); } else for (i = 0; i < a.length - 1; i++) n.push(a[i].trim()); out.push({ from: m.index, to: c, names: n.filter(Boolean) }); }
    return out;
  }
  function mapOutside(text, f) { return text.split(/("(?:[^"]|"")*")/).map(function (part, i) { return i % 2 ? part : f(part); }).join(''); }
  window.SpillIo = {
    out: function (formula) {
      var f = String(formula);
      f = mapOutside(f, function (p) { return p.replace(/(\$?[A-Za-z]{1,3}\$?\d+)#/g, '_xlfn.ANCHORARRAY($1)'); });
      for (var k = calls(f).length - 1; k >= 0; k--) {   // the later call first; its text grows, so the calls are looked for again each time
        var l = calls(f)[k]; if (!l || !l.names.length) continue; var seg = f.slice(l.from, l.to + 1);
        seg = mapOutside(seg, function (p) { l.names.forEach(function (n) { p = p.replace(new RegExp('(^|[^A-Za-z0-9_.])(' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9_.])', 'g'), '$1_xlpm.$2'); }); return p; });
        f = f.slice(0, l.from) + seg + f.slice(l.to + 1);
      }
      return f;
    },
    in: function (formula) { return String(formula).replace(/_xlfn\.ANCHORARRAY\(([^()]*)\)/gi, '$1#').replace(/_xlpm\./g, '').replace(/_xlfn\.(?:_xlws\.)?/g, ''); },
    // TRANSPOSE has no dynamic-array marker of its own: Excel reads it as an array formula only with t="array" and the block as ref
    legacyArray: function (formula) { return /\bTRANSPOSE\(/i.test(formula) && !/\b(SORT|SORTBY|UNIQUE|FILTER|SEQUENCE|VSTACK|HSTACK|TAKE|DROP|TEXTSPLIT|RANDARRAY|CHOOSECOLS|CHOOSEROWS|TOCOL|TOROW|EXPAND)\(/i.test(formula); }
  };
})();
