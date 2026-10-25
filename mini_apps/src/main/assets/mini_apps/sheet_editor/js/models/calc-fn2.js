// CalcFn2 — more functions: the conditional sums (COUNTIFS …), XLOOKUP, IFS / SWITCH, text, date and money functions, and the one-line signatures the formula box shows while typing (CalcDoc).
// A function that would spill into the cells around it (SORT, UNIQUE, FILTER, SEQUENCE …) is not here: this engine keeps one value per formula cell.
(function () {
  'use strict';
  var F = Calc.fns, L = Calc.lazy, num = Calc.num, str = Calc.str, bool = Calc.bool, err = Calc.err, isErr = Calc.isErr, isRng = Calc.isRng, cmp = Calc.cmp, flat = Calc.flat, nums = Calc.nums, crit = Calc.crit;
  var EPOCH = Date.UTC(1899, 11, 30);
  function one(v) { return isRng(v) ? v.rows[0][0] : v; }
  function opt(a, i, d) { return a[i] === undefined || one(a[i]) === null && isRng(a[i]) ? d : a[i]; }
  function dayOf(v) { return new Date(EPOCH + Math.floor(num(v)) * 86400000); }
  function serial(y, m, d) { return Math.floor((Date.UTC(y, m, d) - EPOCH) / 86400000); }

  // ---- conditions over several ranges ----------------------------------------------------------------------------------------------
  // the positions where every (range, test) pair holds; args start at `from`
  function where(a, from) {
    var tests = [], n = -1, i;
    for (i = from; i + 1 < a.length; i += 2) { var cells = flat(a[i]); if (n >= 0 && cells.length !== n) throw err('#VALUE!'); n = cells.length; tests.push({ cells: cells, ok: crit(one(a[i + 1])) }); }
    var hit = []; for (i = 0; i < n; i++) if (tests.every(function (t) { return t.ok(t.cells[i]); })) hit.push(i);
    return hit;
  }
  function pick(a, hit) { var src = flat(a), o = []; hit.forEach(function (i) { if (typeof src[i] === 'number') o.push(src[i]); }); return o; }
  F.COUNTIFS = function (a) { return where(a, 0).length; };
  F.SUMIFS = function (a) { return pick(a[0], where(a, 1)).reduce(function (x, y) { return x + y; }, 0); };
  F.AVERAGEIFS = function (a) { var v = pick(a[0], where(a, 1)); if (!v.length) throw err('#DIV/0!'); return v.reduce(function (x, y) { return x + y; }, 0) / v.length; };
  F.MAXIFS = function (a) { var v = pick(a[0], where(a, 1)); return v.length ? Math.max.apply(null, v) : 0; };
  F.MINIFS = function (a) { var v = pick(a[0], where(a, 1)); return v.length ? Math.min.apply(null, v) : 0; };

  // ---- logic ------------------------------------------------------------------------------------------------------------------------
  L.IFS = function (args, ev) { for (var i = 0; i + 1 < args.length; i += 2) if (bool(ev(args[i]))) return ev(args[i + 1]); throw err('#N/A'); };
  L.SWITCH = function (args, ev) {
    var key = one(ev(args[0])), i; for (i = 1; i + 1 < args.length; i += 2) if (cmp(one(ev(args[i])), key) === 0) return ev(args[i + 1]);
    if (args.length % 2 === 0) return ev(args[args.length - 1]); throw err('#N/A');
  };
  L.IFNA = function (args, ev) { try { var v = ev(args[0]); return isErr(v) && v.e === '#N/A' ? ev(args[1]) : v; } catch (e) { if (e instanceof Calc.CalcErr && e.e === '#N/A') return ev(args[1]); throw e; } };
  L.CHOOSE = function (args, ev) { var i = num(ev(args[0])); if (i < 1 || i >= args.length) throw err('#VALUE!'); return ev(args[i]); };
  F.XOR = function (a) { var n = 0; a.forEach(function (x) { flat(x).forEach(function (v) { if (v !== null && bool(v)) n++; }); }); return n % 2 === 1; };
  F.TRUE = function () { return true; }; F.FALSE = function () { return false; }; F.NA = function () { throw err('#N/A'); };
  F.ISNA = function (a) { var v = one(a[0]); return isErr(v) && v.e === '#N/A'; };
  F.ISERR = function (a) { var v = one(a[0]); return isErr(v) && v.e !== '#N/A'; };
  F.ISLOGICAL = function (a) { return typeof one(a[0]) === 'boolean'; };
  F.ISNONTEXT = function (a) { return typeof one(a[0]) !== 'string'; };
  F.N = function (a) { var v = one(a[0]); return typeof v === 'number' ? v : v === true ? 1 : 0; };

  // ---- lookup -----------------------------------------------------------------------------------------------------------------------
  function wild(p) { return new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
  // the position in `list` (0-based) of key; mode 0 exact, -1 exact or next smaller, 1 exact or next larger, 2 wildcards; back = search from the end
  function seek(key, list, mode, back) {
    var best = -1, i, re = mode === 2 ? wild(str(key)) : null;
    for (var k = 0; k < list.length; k++) {
      i = back ? list.length - 1 - k : k; var v = list[i]; if (v === null && key !== null) continue;
      if (re) { if (re.test(str(v))) return i; continue; }
      var c = cmp(v, key); if (c === 0) return i;
      if (mode === -1 && c < 0 && (best < 0 || cmp(v, list[best]) > 0)) best = i;
      if (mode === 1 && c > 0 && (best < 0 || cmp(v, list[best]) < 0)) best = i;
    }
    return best;
  }
  function at(rng, i) { var rows = rng.rows; if (rows.length === 1) return rows[0][i]; if (rows[0].length === 1) return rows[i][0]; return rows[i]; }
  F.XLOOKUP = function (a) {
    var key = one(a[0]), look = flat(a[1]), i = seek(key, look, num(opt(a, 4, 0)), num(opt(a, 5, 1)) < 0);
    if (i < 0) { if (a[3] !== undefined) return a[3]; throw err('#N/A'); }
    var v = at(a[2], i); return Array.isArray(v) ? v[0] : v;
  };
  F.XMATCH = function (a) { var i = seek(one(a[0]), flat(a[1]), num(opt(a, 2, 0)), num(opt(a, 3, 1)) < 0); if (i < 0) throw err('#N/A'); return i + 1; };
  F.LOOKUP = function (a) {
    var key = one(a[0]), look = flat(a[1]), i = seek(key, look, -1, false); if (i < 0) throw err('#N/A');
    var res = a[2] ? flat(a[2]) : look; return res[i];
  };
  F.ROWS = function (a) { return isRng(a[0]) ? a[0].rows.length : 1; };
  F.COLUMNS = function (a) { return isRng(a[0]) ? a[0].rows[0].length : 1; };

  // ---- math and statistics ----------------------------------------------------------------------------------------------------------
  function dig(a, d) { return a[1] === undefined ? d : num(a[1]); }
  F.SIGN = function (a) { var x = num(a[0]); return x > 0 ? 1 : x < 0 ? -1 : 0; };
  F.EXP = function (a) { return Math.exp(num(a[0])); };
  F.LN = function (a) { var x = num(a[0]); if (x <= 0) throw err('#NUM!'); return Math.log(x); };
  F.LOG10 = function (a) { var x = num(a[0]); if (x <= 0) throw err('#NUM!'); return Math.log(x) / Math.LN10; };
  F.LOG = function (a) { var x = num(a[0]), b = dig(a, 10); if (x <= 0 || b <= 0 || b === 1) throw err('#NUM!'); return Math.log(x) / Math.log(b); };
  F.PI = function () { return Math.PI; };
  F.SIN = function (a) { return Math.sin(num(a[0])); }; F.COS = function (a) { return Math.cos(num(a[0])); }; F.TAN = function (a) { return Math.tan(num(a[0])); }; F.ATAN = function (a) { return Math.atan(num(a[0])); };
  F.RADIANS = function (a) { return num(a[0]) * Math.PI / 180; }; F.DEGREES = function (a) { return num(a[0]) * 180 / Math.PI; };
  F.TRUNC = function (a) { var m = Math.pow(10, dig(a, 0)), x = num(a[0]) * m; return (x < 0 ? Math.ceil(x) : Math.floor(x)) / m; };
  F.CEILING = function (a) { var s = dig(a, 1); return s === 0 ? 0 : Math.ceil(num(a[0]) / s - 1e-12) * s; };
  F.FLOOR = function (a) { var s = dig(a, 1); return s === 0 ? 0 : Math.floor(num(a[0]) / s + 1e-12) * s; };
  F.QUOTIENT = function (a) { var d = num(a[1]); if (d === 0) throw err('#DIV/0!'); var q = num(a[0]) / d; return q < 0 ? Math.ceil(q) : Math.floor(q); };
  F.FACT = function (a) { var n = Math.floor(num(a[0])), r = 1; if (n < 0 || n > 170) throw err('#NUM!'); for (var i = 2; i <= n; i++) r *= i; return r; };
  F.GCD = function (a) { var g = function (x, y) { return y ? g(y, x % y) : x; }; return nums(a).reduce(function (x, y) { return g(Math.abs(Math.floor(x)), Math.abs(Math.floor(y))); }, 0); };
  F.RAND = function () { return Math.random(); };
  F.RANDBETWEEN = function (a) { var lo = Math.ceil(num(a[0])), hi = Math.floor(num(a[1])); if (hi < lo) throw err('#NUM!'); return lo + Math.floor(Math.random() * (hi - lo + 1)); };
  function sorted(a) { return nums([a]).sort(function (x, y) { return x - y; }); }
  F.LARGE = function (a) { var n = sorted(a[0]), k = num(a[1]); if (k < 1 || k > n.length) throw err('#NUM!'); return n[n.length - k]; };
  F.SMALL = function (a) { var n = sorted(a[0]), k = num(a[1]); if (k < 1 || k > n.length) throw err('#NUM!'); return n[k - 1]; };
  F.RANK = function (a) { var x = num(a[0]), n = sorted(a[1]), asc = a[2] !== undefined && num(a[2]) !== 0, r = 1; if (n.indexOf(x) < 0) throw err('#N/A'); n.forEach(function (v) { if (asc ? v < x : v > x) r++; }); return r; };
  function variance(a, pop) { var n = nums(a), m = n.reduce(function (x, y) { return x + y; }, 0) / (n.length || 1), k = pop ? n.length : n.length - 1; if (k < 1) throw err('#DIV/0!'); return n.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / k; }
  F.VAR = F['VAR.S'] = function (a) { return variance(a, false); }; F['VAR.P'] = F.VARP = function (a) { return variance(a, true); };
  F.STDEV = F['STDEV.S'] = function (a) { return Math.sqrt(variance(a, false)); }; F['STDEV.P'] = F.STDEVP = function (a) { return Math.sqrt(variance(a, true)); };
  F.MODE = function (a) { var n = nums(a), c = {}, best = null, k = 0; n.forEach(function (v) { c[v] = (c[v] || 0) + 1; if (c[v] > k) { k = c[v]; best = v; } }); if (k < 2) throw err('#N/A'); return best; };
  F.PERCENTILE = function (a) { var n = sorted(a[0]), p = num(a[1]); if (!n.length || p < 0 || p > 1) throw err('#NUM!'); var x = p * (n.length - 1), i = Math.floor(x); return n[i] + (n[Math.min(i + 1, n.length - 1)] - n[i]) * (x - i); };
  F.SUMSQ = function (a) { return nums(a).reduce(function (s, v) { return s + v * v; }, 0); };

  // SUBTOTAL: the number picks the function (101–111 ignore hidden rows like the 1–11 do not; the rows a filter hid are skipped in both here)
  F.SUBTOTAL = function (a) {
    var k = num(a[0]) % 100, v = nums(a.slice(1)); if (k === 1) return v.length ? v.reduce(function (x, y) { return x + y; }, 0) / v.length : 0; if (k === 2) return a.slice(1).reduce(function (n, r) { return n + flat(r).filter(function (x) { return typeof x === 'number'; }).length; }, 0);
    if (k === 3) return a.slice(1).reduce(function (n, r) { return n + flat(r).filter(function (x) { return x !== null && x !== ''; }).length; }, 0); if (k === 4) return v.length ? Math.max.apply(null, v) : 0; if (k === 5) return v.length ? Math.min.apply(null, v) : 0; if (k === 6) return v.reduce(function (x, y) { return x * y; }, 1);
    if (k === 9) return v.reduce(function (x, y) { return x + y; }, 0); throw err('#VALUE!');
  };

  // ---- text -------------------------------------------------------------------------------------------------------------------------
  F.PROPER = function (a) { return str(a[0]).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, function (m, p, c) { return p + c.toUpperCase(); }); };
  F.REPT = function (a) { var n = num(a[1]); if (n < 0 || n * str(a[0]).length > 32767) throw err('#VALUE!'); return str(a[0]).repeat(Math.floor(n)); };
  F.EXACT = function (a) { return str(a[0]) === str(a[1]); };
  F.CLEAN = function (a) { return str(a[0]).replace(/[\u0000-\u001f]/g, ''); };
  F.CHAR = function (a) { var n = num(a[0]); if (n < 1 || n > 255) throw err('#VALUE!'); return String.fromCharCode(n); };
  F.CODE = function (a) { var s = str(a[0]); if (!s) throw err('#VALUE!'); return s.charCodeAt(0); };
  F.UNICHAR = function (a) { return String.fromCodePoint(num(a[0])); }; F.UNICODE = function (a) { var s = str(a[0]); if (!s) throw err('#VALUE!'); return s.codePointAt(0); };
  F.REPLACE = function (a) { var s = str(a[0]), st = num(a[1]) - 1, n = num(a[2]); if (st < 0 || n < 0) throw err('#VALUE!'); return s.slice(0, st) + str(a[3]) + s.slice(st + n); };
  F.T = function (a) { var v = one(a[0]); return typeof v === 'string' ? v : ''; };
  F.TEXTBEFORE = function (a) { var s = str(a[0]), d = str(a[1]), i = s.indexOf(d); if (i < 0) throw err('#N/A'); return s.slice(0, i); };
  F.TEXTAFTER = function (a) { var s = str(a[0]), d = str(a[1]), i = s.indexOf(d); if (i < 0) throw err('#N/A'); return s.slice(i + d.length); };

  // ---- dates and times --------------------------------------------------------------------------------------------------------------
  F.EDATE = function (a) { var d = dayOf(a[0]), m = d.getUTCMonth() + Math.floor(num(a[1])), y = d.getUTCFullYear() + Math.floor(m / 12); m = ((m % 12) + 12) % 12; return serial(y, m, Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate())); };
  F.EOMONTH = function (a) { var d = dayOf(a[0]), m = d.getUTCMonth() + Math.floor(num(a[1])); return serial(d.getUTCFullYear(), m + 1, 0); };
  F.WEEKDAY = function (a) { var w = dayOf(a[0]).getUTCDay(), t = dig(a, 1); return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; };
  F.WEEKNUM = function (a) { var d = dayOf(a[0]), j = Date.UTC(d.getUTCFullYear(), 0, 1); return Math.floor(((d - j) / 86400000 + new Date(j).getUTCDay()) / 7) + 1; };
  F.DAYS = function (a) { return Math.floor(num(a[0])) - Math.floor(num(a[1])); };
  F.TIME = function (a) { return (num(a[0]) * 3600 + num(a[1]) * 60 + num(a[2])) / 86400; };
  function secs(v) { return Math.round((num(v) % 1) * 86400); }
  F.HOUR = function (a) { return Math.floor(secs(a[0]) / 3600) % 24; }; F.MINUTE = function (a) { return Math.floor(secs(a[0]) / 60) % 60; }; F.SECOND = function (a) { return secs(a[0]) % 60; };
  F.DATEDIF = function (a) {
    var s = dayOf(a[0]), e = dayOf(a[1]), u = str(a[2]).toUpperCase(); if (e < s) throw err('#NUM!');
    var m = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth() - (e.getUTCDate() < s.getUTCDate() ? 1 : 0);
    if (u === 'D') return Math.round((e - s) / 86400000); if (u === 'M') return m; if (u === 'Y') return Math.floor(m / 12);
    if (u === 'YM') return m % 12; if (u === 'MD') { var x = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() - (e.getUTCDate() < s.getUTCDate() ? 1 : 0), s.getUTCDate())); return Math.round((e - x) / 86400000); }
    throw err('#NUM!');
  };
  F.NETWORKDAYS = function (a) { var s = Math.floor(num(a[0])), e = Math.floor(num(a[1])), lo = Math.min(s, e), hi = Math.max(s, e), n = 0; for (var d = lo; d <= hi; d++) { var w = new Date(EPOCH + d * 86400000).getUTCDay(); if (w !== 0 && w !== 6) n++; } return s <= e ? n : -n; };

  // ---- money ------------------------------------------------------------------------------------------------------------------------
  F.PMT = function (a) { var r = num(a[0]), n = num(a[1]), pv = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), ty = a[4] === undefined ? 0 : num(a[4]); if (!n) throw err('#NUM!'); if (!r) return -(pv + fv) / n; var k = Math.pow(1 + r, n); return -(r * (pv * k + fv)) / ((1 + r * ty) * (k - 1)); };
  F.FV = function (a) { var r = num(a[0]), n = num(a[1]), p = num(a[2]), pv = a[3] === undefined ? 0 : num(a[3]), ty = a[4] === undefined ? 0 : num(a[4]); if (!r) return -(pv + p * n); var k = Math.pow(1 + r, n); return -(pv * k + p * (1 + r * ty) * (k - 1) / r); };
  F.PV = function (a) { var r = num(a[0]), n = num(a[1]), p = num(a[2]), fv = a[3] === undefined ? 0 : num(a[3]), ty = a[4] === undefined ? 0 : num(a[4]); if (!r) return -(fv + p * n); var k = Math.pow(1 + r, n); return -(fv + p * (1 + r * ty) * (k - 1) / r) / k; };
  F.NPV = function (a) { var r = num(a[0]); return nums(a.slice(1)).reduce(function (s, v, i) { return s + v / Math.pow(1 + r, i + 1); }, 0); };

  // ---- what the formula box shows while typing --------------------------------------------------------------------------------------
  var SIG = {
    SUM: 'number1, [number2], …', AVERAGE: 'number1, [number2], …', COUNT: 'value1, [value2], …', COUNTA: 'value1, [value2], …', MIN: 'number1, [number2], …', MAX: 'number1, [number2], …', ROUND: 'number, digits', IF: 'test, then, [else]', AND: 'test1, [test2], …', OR: 'test1, [test2], …', NOT: 'test',
    IFERROR: 'value, if_error', VLOOKUP: 'key, range, col, [exact]', HLOOKUP: 'key, range, row, [exact]', INDEX: 'range, [row], [col]', MATCH: 'key, range, [type]', COUNTIF: 'range, test', SUMIF: 'range, test, [sum_range]', AVERAGEIF: 'range, test, [average_range]',
    COUNTIFS: 'range1, test1, [range2, test2], …', SUMIFS: 'sum_range, range1, test1, …', AVERAGEIFS: 'average_range, range1, test1, …', MAXIFS: 'max_range, range1, test1, …', MINIFS: 'min_range, range1, test1, …',
    IFS: 'test1, value1, [test2, value2], …', SWITCH: 'value, case1, result1, …, [default]', IFNA: 'value, if_na', CHOOSE: 'index, value1, [value2], …', XLOOKUP: 'key, lookup_range, return_range, [if_not_found], [match_mode], [search_mode]', XMATCH: 'key, range, [match_mode], [search_mode]', LOOKUP: 'key, lookup_range, [result_range]',
    ABS: 'number', INT: 'number', SQRT: 'number', POWER: 'number, power', MOD: 'number, divisor', ROUNDUP: 'number, digits', ROUNDDOWN: 'number, digits', MEDIAN: 'number1, [number2], …', PRODUCT: 'number1, [number2], …', SUMPRODUCT: 'array1, [array2], …',
    CONCAT: 'text1, [text2], …', CONCATENATE: 'text1, [text2], …', TEXTJOIN: 'delimiter, skip_empty, text1, …', LEFT: 'text, [n]', RIGHT: 'text, [n]', MID: 'text, start, length', LEN: 'text', UPPER: 'text', LOWER: 'text', PROPER: 'text', TRIM: 'text', TEXT: 'value, format', VALUE: 'text',
    FIND: 'find, within, [start]', SEARCH: 'find, within, [start]', SUBSTITUTE: 'text, old, new', REPLACE: 'text, start, length, new', REPT: 'text, times', EXACT: 'text1, text2', OFFSET: 'reference, rows, cols, [height], [width]', INDIRECT: 'ref_text, [a1]', ROW: '[reference]', COLUMN: '[reference]', ADDRESS: 'row, col, [abs], [a1], [sheet]', SUBTOTAL: 'function_num, range1, [range2], …', TODAY: '', NOW: '', DATE: 'year, month, day', YEAR: 'date', MONTH: 'date', DAY: 'date',
    EDATE: 'date, months', EOMONTH: 'date, months', WEEKDAY: 'date, [type]', DATEDIF: 'start, end, unit "Y" "M" "D"', NETWORKDAYS: 'start, end', DAYS: 'end, start', TIME: 'hour, minute, second', LARGE: 'range, k', SMALL: 'range, k', RANK: 'number, range, [ascending]',
    STDEV: 'number1, [number2], …', VAR: 'number1, [number2], …', PERCENTILE: 'range, k', TRUNC: 'number, [digits]', CEILING: 'number, multiple', FLOOR: 'number, multiple', LOG: 'number, [base]', PMT: 'rate, nper, pv, [fv], [type]', FV: 'rate, nper, pmt, [pv], [type]', PV: 'rate, nper, pmt, [fv], [type]', NPV: 'rate, value1, [value2], …'
  };
  window.CalcDoc = { extra: SIG, sig: function (n) { return SIG[n] === undefined ? '' : n + '(' + SIG[n] + ')'; } };
})();
