// CalcFn — the functions a formula can call. Each one gets its arguments already calculated (a range arrives as { rows }).
(function () {
  'use strict';
  var F = Calc.fns, L = Calc.lazy, num = Calc.num, str = Calc.str, bool = Calc.bool, err = Calc.err, isErr = Calc.isErr, isRng = Calc.isRng, cmp = Calc.cmp;
  function flat(a) { return isRng(a) ? [].concat.apply([], a.rows) : [a]; }
  // numbers of an argument list: in a range only real numbers count, typed directly everything that reads as a number does
  function nums(args) {
    var o = [];
    args.forEach(function (a) {
      if (isRng(a)) flat(a).forEach(function (v) { if (isErr(v)) throw new Calc.CalcErr(v.e); if (typeof v === 'number') o.push(v); });
      else if (a !== null) o.push(num(a));
    });
    return o;
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function rnd(v, d, mode) { var m = Math.pow(10, d), x = v * m; x = mode === 'up' ? (x < 0 ? -Math.ceil(-x - 1e-9) : Math.ceil(x - 1e-9)) : mode === 'down' ? (x < 0 ? -Math.floor(-x + 1e-9) : Math.floor(x + 1e-9)) : (x < 0 ? -Math.round(-x + 1e-9) : Math.round(x + 1e-9)); return x / m; }
  var EPOCH = Date.UTC(1899, 11, 30);
  function serial(d) { return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000); }
  function dateOf(v) { var s = num(v); return new Date(EPOCH + Math.floor(s) * 86400000); }
  // COUNTIF-style test: ">5", "<>x", "=abc", a plain value
  function test(crit) {
    if (typeof crit === 'string') {
      var m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(crit), op = m[1] || '=', rest = m[2], n = rest !== '' && !isNaN(Number(rest)) ? Number(rest) : null;
      return function (v) {
        if (v === null && rest === '') return op === '=';
        var x = n !== null ? (typeof v === 'number' ? v : null) : (typeof v === 'string' ? v : null);
        if (x === null) return op === '<>';
        var c = cmp(x, n !== null ? n : rest);
        return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
      };
    }
    return function (v) { return v !== null && cmp(v, crit) === 0; };
  }

  Calc.crit = test; Calc.flat = flat; Calc.nums = nums;

  F.SUM = function (a) { return sum(nums(a)); };
  F.AVERAGE = function (a) { var n = nums(a); if (!n.length) throw err('#DIV/0!'); return sum(n) / n.length; };
  F.MIN = function (a) { var n = nums(a); return n.length ? Math.min.apply(null, n) : 0; };
  F.MAX = function (a) { var n = nums(a); return n.length ? Math.max.apply(null, n) : 0; };
  F.COUNT = function (a) { var c = 0; a.forEach(function (x) { flat(x).forEach(function (v) { if (typeof v === 'number') c++; }); }); return c; };
  F.COUNTA = function (a) { var c = 0; a.forEach(function (x) { flat(x).forEach(function (v) { if (v !== null && v !== '') c++; }); }); return c; };
  F.COUNTBLANK = function (a) { var c = 0; flat(a[0]).forEach(function (v) { if (v === null || v === '') c++; }); return c; };
  F.PRODUCT = function (a) { return nums(a).reduce(function (x, y) { return x * y; }, 1); };
  F.MEDIAN = function (a) { var n = nums(a).sort(function (x, y) { return x - y; }), k = n.length >> 1; if (!n.length) throw err('#NUM!'); return n.length % 2 ? n[k] : (n[k - 1] + n[k]) / 2; };
  F.ROUND = function (a) { return rnd(num(a[0]), a[1] === undefined ? 0 : num(a[1]), ''); };
  F.ROUNDUP = function (a) { return rnd(num(a[0]), a[1] === undefined ? 0 : num(a[1]), 'up'); };
  F.ROUNDDOWN = function (a) { return rnd(num(a[0]), a[1] === undefined ? 0 : num(a[1]), 'down'); };
  F.ABS = function (a) { return Math.abs(num(a[0])); };
  F.INT = function (a) { return Math.floor(num(a[0])); };
  F.SQRT = function (a) { var x = num(a[0]); if (x < 0) throw err('#NUM!'); return Math.sqrt(x); };
  F.POWER = function (a) { return Math.pow(num(a[0]), num(a[1])); };
  F.MOD = function (a) { var d = num(a[1]); if (d === 0) throw err('#DIV/0!'); var x = num(a[0]); return x - d * Math.floor(x / d); };
  F.NOT = function (a) { return !bool(a[0]); };
  F.AND = function (a) { var r = true; a.forEach(function (x) { flat(x).forEach(function (v) { if (v !== null && !bool(v)) r = false; }); }); return r; };
  F.OR = function (a) { var r = false; a.forEach(function (x) { flat(x).forEach(function (v) { if (v !== null && bool(v)) r = true; }); }); return r; };
  L.IF = function (args, ev) { var t = bool(ev(args[0])); var pick = t ? args[1] : args[2]; return pick ? ev(pick) : (t ? true : false); };
  L.IFERROR = function (args, ev) { try { var v = ev(args[0]); return isErr(v) ? ev(args[1]) : v; } catch (e) { if (e instanceof Calc.CalcErr) return ev(args[1]); throw e; } };
  F.CONCAT = F.CONCATENATE = function (a) { return a.map(function (x) { return flat(x).map(str).join(''); }).join(''); };
  F.TEXTJOIN = function (a) { var d = str(a[0]), parts = []; a.slice(2).forEach(function (x) { flat(x).forEach(function (v) { if (!(bool(a[1]) && (v === null || v === ''))) parts.push(str(v)); }); }); return parts.join(d); };
  F.LEFT = function (a) { return str(a[0]).slice(0, a[1] === undefined ? 1 : num(a[1])); };
  F.RIGHT = function (a) { var s = str(a[0]), n = a[1] === undefined ? 1 : num(a[1]); return n ? s.slice(-n) : ''; };
  F.MID = function (a) { var s = num(a[1]); return str(a[0]).substr(s - 1, num(a[2])); };
  F.LEN = function (a) { return str(a[0]).length; };
  F.UPPER = function (a) { return str(a[0]).toUpperCase(); };
  F.LOWER = function (a) { return str(a[0]).toLowerCase(); };
  F.TRIM = function (a) { return str(a[0]).trim().replace(/\s+/g, ' '); };
  F.VALUE = function (a) { return num(a[0]); };
  F.FIND = function (a) { var i = str(a[1]).indexOf(str(a[0]), a[2] === undefined ? 0 : num(a[2]) - 1); if (i < 0) throw err('#VALUE!'); return i + 1; };
  F.SEARCH = function (a) { var i = str(a[1]).toLowerCase().indexOf(str(a[0]).toLowerCase(), a[2] === undefined ? 0 : num(a[2]) - 1); if (i < 0) throw err('#VALUE!'); return i + 1; };
  F.SUBSTITUTE = function (a) { return str(a[0]).split(str(a[1])).join(str(a[2])); };
  F.TEXT = function (a) { return window.NumFmt ? NumFmt.format(str(a[1]), isNaN(Number(a[0])) ? a[0] : num(a[0])) : str(a[0]); };
  F.ISNUMBER = function (a) { return typeof (isRng(a[0]) ? a[0].rows[0][0] : a[0]) === 'number'; };
  F.ISTEXT = function (a) { return typeof (isRng(a[0]) ? a[0].rows[0][0] : a[0]) === 'string'; };
  F.ISBLANK = function (a) { return (isRng(a[0]) ? a[0].rows[0][0] : a[0]) === null; };
  F.ISERROR = function (a) { return isErr(isRng(a[0]) ? a[0].rows[0][0] : a[0]); };
  F.TODAY = function () { return serial(new Date()); };
  F.NOW = function () { var d = new Date(); return serial(d) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; };
  F.DATE = function (a) { return Math.floor((Date.UTC(num(a[0]), num(a[1]) - 1, num(a[2])) - EPOCH) / 86400000); };
  F.YEAR = function (a) { return dateOf(a[0]).getUTCFullYear(); };
  F.MONTH = function (a) { return dateOf(a[0]).getUTCMonth() + 1; };
  F.DAY = function (a) { return dateOf(a[0]).getUTCDate(); };
  F.COUNTIF = function (a) { var t = test(a[1]), c = 0; flat(a[0]).forEach(function (v) { if (t(v)) c++; }); return c; };
  F.SUMIF = function (a) { var t = test(a[1]), src = flat(a[0]), tgt = a[2] ? flat(a[2]) : src, s = 0; src.forEach(function (v, i) { if (t(v) && typeof tgt[i] === 'number') s += tgt[i]; }); return s; };
  F.AVERAGEIF = function (a) { var t = test(a[1]), src = flat(a[0]), tgt = a[2] ? flat(a[2]) : src, s = 0, n = 0; src.forEach(function (v, i) { if (t(v) && typeof tgt[i] === 'number') { s += tgt[i]; n++; } }); if (!n) throw err('#DIV/0!'); return s / n; };
  F.SUMPRODUCT = function (a) { var cols = a.map(flat), s = 0, i; for (i = 0; i < cols[0].length; i++) s += cols.reduce(function (p, c) { return p * (typeof c[i] === 'number' ? c[i] : 0); }, 1); return s; };
  F.VLOOKUP = function (a) {
    var key = isRng(a[0]) ? a[0].rows[0][0] : a[0], rows = a[1].rows, col = num(a[2]) - 1, exact = a[3] !== undefined && !bool(a[3]), i, best = -1;
    if (col < 0 || col >= rows[0].length) throw err('#REF!');
    for (i = 0; i < rows.length; i++) { var c = cmp(rows[i][0], key); if (c === 0 && rows[i][0] !== null) return rows[i][col]; if (!exact && c < 0) best = i; }
    if (!exact && best >= 0) return rows[best][col];
    throw err('#N/A');
  };
  F.HLOOKUP = function (a) {
    var key = isRng(a[0]) ? a[0].rows[0][0] : a[0], rows = a[1].rows, row = num(a[2]) - 1, i;
    if (row < 0 || row >= rows.length) throw err('#REF!');
    for (i = 0; i < rows[0].length; i++) if (cmp(rows[0][i], key) === 0 && rows[0][i] !== null) return rows[row][i];
    throw err('#N/A');
  };
  F.INDEX = function (a) { var r = a[1] === undefined ? 1 : num(a[1]), c = a[2] === undefined ? 1 : num(a[2]), rows = a[0].rows; if (rows.length === 1 && a[2] === undefined) { c = r; r = 1; } if (r < 1 || c < 1 || r > rows.length || c > rows[0].length) throw err('#REF!'); return rows[r - 1][c - 1]; };
  F.MATCH = function (a) {
    var key = isRng(a[0]) ? a[0].rows[0][0] : a[0], list = flat(a[1]), type = a[2] === undefined ? 1 : num(a[2]), i, best = -1;
    for (i = 0; i < list.length; i++) { var c = cmp(list[i], key); if (c === 0 && list[i] !== null) return i + 1; if (type > 0 && c < 0) best = i; if (type < 0 && c > 0) best = i; }
    if (type !== 0 && best >= 0) return best + 1;
    throw err('#N/A');
  };
})();
