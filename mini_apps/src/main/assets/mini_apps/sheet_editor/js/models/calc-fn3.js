// CalcFn3 — the functions that answer with a block of cells (dynamic arrays): SORT, SORTBY, UNIQUE, FILTER, SEQUENCE, TRANSPOSE, VSTACK, HSTACK, TAKE, DROP, TEXTSPLIT, RANDARRAY, CHOOSECOLS, CHOOSEROWS, TOCOL, TOROW, EXPAND
// and LET (names for parts of a formula). A formula that returns a block spills over the cells to its right and below (see calc.js); the block can also be used inside other formulas, like =SUM(FILTER(...)).
(function () {
  'use strict';
  var F = Calc.fns, L = Calc.lazy, num = Calc.num, str = Calc.str, bool = Calc.bool, err = Calc.err, isErr = Calc.isErr, isRng = Calc.isRng, cmp = Calc.cmp;
  function rows(x) { return isRng(x) ? x.rows.map(function (r) { return r.slice(); }) : [[x]]; }
  function out(r) { if (!r.length || !r[0].length) throw err('#CALC!'); return { rows: r }; }
  function opt(a, i, d) { var v = a[i]; if (v === undefined || (isRng(v) && v.rows[0][0] === null && v.rows.length === 1 && v.rows[0].length === 1)) return d; return isRng(v) ? v.rows[0][0] : v; }
  function flag(a, i) { var v = opt(a, i, false); return v === null ? false : bool(v); }
  function key(row) { return JSON.stringify(row.map(function (v) { return typeof v === 'string' ? v.toLowerCase() : v; })); }
  function blank(v) { return v === null || v === ''; }
  function cmpv(a, b) { var x = blank(a), y = blank(b); if (x || y) return x === y ? 0 : x ? 1 : -1; return cmp(a, b); }
  function sortBy(data, keys, orders) {
    var idx = data.map(function (_, i) { return i; });
    idx.sort(function (i, j) { for (var k = 0; k < keys.length; k++) { var d = cmpv(keys[k][i], keys[k][j]); if (d) return blank(keys[k][i]) || blank(keys[k][j]) ? d : d * orders[k]; } return i - j; });
    return idx.map(function (i) { return data[i]; });
  }
  function flip(m) { return m[0].map(function (_, j) { return m.map(function (r) { return r[j]; }); }); }
  function col(m, j) { return m.map(function (r) { return r[j]; }); }

  F.SORT = function (a) {
    var m = rows(a[0]), i = num(opt(a, 1, 1)), o = num(opt(a, 2, 1)) < 0 ? -1 : 1, byCol = flag(a, 3); if (byCol) m = flip(m);
    if (i < 1 || i > m[0].length) throw err('#VALUE!'); var r = sortBy(m, [col(m, i - 1)], [o]); return out(byCol ? flip(r) : r);
  };
  F.SORTBY = function (a) {
    var m = rows(a[0]), keys = [], orders = [], i; for (i = 1; i < a.length; i += 2) { var k = flat(a[i]); if (k.length !== m.length) throw err('#VALUE!'); keys.push(k); orders.push(a[i + 1] === undefined ? 1 : num(a[i + 1]) < 0 ? -1 : 1); }
    return out(sortBy(m, keys, orders));
  };
  function flat(x) { return isRng(x) ? [].concat.apply([], x.rows) : [x]; }
  F.UNIQUE = function (a) {
    var m = rows(a[0]), byCol = flag(a, 1), once = flag(a, 2); if (byCol) m = flip(m);
    var seen = {}, order = []; m.forEach(function (r) { var k = key(r); if (!seen[k]) { seen[k] = { r: r, n: 0 }; order.push(k); } seen[k].n++; });
    var res = order.filter(function (k) { return !once || seen[k].n === 1; }).map(function (k) { return seen[k].r; }); if (!res.length) throw err('#CALC!'); return out(byCol ? flip(res) : res);
  };
  F.FILTER = function (a) {
    var m = rows(a[0]), inc = rows(a[1]), byRow = inc.length === 1 && inc[0].length > 1 && m.length !== inc.length, keep = byRow ? inc[0] : col(inc, 0);
    var data = byRow ? flip(m) : m; if (keep.length !== data.length) throw err('#VALUE!');
    var res = data.filter(function (_, i) { var v = keep[i]; if (isErr(v)) throw err(v.e); return typeof v === 'number' ? v !== 0 : typeof v === 'boolean' ? v : false; });
    if (!res.length) { if (a[2] !== undefined) return a[2]; throw err('#CALC!'); } return out(byRow ? flip(res) : res);
  };
  F.SEQUENCE = function (a) {
    var R = num(a[0]), C = num(opt(a, 1, 1)), s = num(opt(a, 2, 1)), st = num(opt(a, 3, 1)); if (R < 1 || C < 1 || R * C > 100000) throw err('#CALC!'); var r = [], i, j; for (i = 0; i < R; i++) { var row = []; for (j = 0; j < C; j++) row.push(s + (i * C + j) * st); r.push(row); } return { rows: r };
  };
  F.RANDARRAY = function (a) { var R = num(opt(a, 0, 1)), C = num(opt(a, 1, 1)), lo = num(opt(a, 2, 0)), hi = num(opt(a, 3, 1)), whole = flag(a, 4), r = [], i, j; if (R * C > 100000) throw err('#CALC!'); for (i = 0; i < R; i++) { var row = []; for (j = 0; j < C; j++) row.push(whole ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo)); r.push(row); } return { rows: r }; };
  F.TRANSPOSE = function (a) { return out(flip(rows(a[0]))); };
  F.VSTACK = function (a) { var w = Math.max.apply(null, a.map(function (x) { return rows(x)[0].length; })), r = []; a.forEach(function (x) { rows(x).forEach(function (row) { var o = row.slice(); while (o.length < w) o.push({ e: '#N/A' }); r.push(o); }); }); return out(r); };
  F.HSTACK = function (a) { var h = Math.max.apply(null, a.map(function (x) { return rows(x).length; })), r = [], i; for (i = 0; i < h; i++) r.push([]); a.forEach(function (x) { var m = rows(x), w = m[0].length; for (i = 0; i < h; i++) for (var j = 0; j < w; j++) r[i].push(m[i] ? m[i][j] : { e: '#N/A' }); }); return out(r); };
  function slice(m, n, fromEnd) { return n >= 0 ? (fromEnd ? m.slice(-n || m.length) : m.slice(0, n)) : (fromEnd ? m.slice(0, m.length + n) : m.slice(-n)); }
  F.TAKE = function (a) { var m = rows(a[0]), r = num(opt(a, 1, m.length)), c = a[2] === undefined ? m[0].length : num(a[2]); var x = r >= 0 ? m.slice(0, r) : m.slice(r); return out(x.map(function (row) { return c >= 0 ? row.slice(0, c) : row.slice(c); })); };
  F.DROP = function (a) { var m = rows(a[0]), r = num(opt(a, 1, 0)), c = num(opt(a, 2, 0)); var x = r >= 0 ? m.slice(r) : m.slice(0, m.length + r); return out(x.map(function (row) { return c >= 0 ? row.slice(c) : row.slice(0, row.length + c); })); };
  F.CHOOSECOLS = function (a) { var m = rows(a[0]); var ix = a.slice(1).map(function (x) { var k = num(x); return k < 0 ? m[0].length + k : k - 1; }); if (ix.some(function (k) { return k < 0 || k >= m[0].length; })) throw err('#VALUE!'); return out(m.map(function (row) { return ix.map(function (k) { return row[k]; }); })); };
  F.CHOOSEROWS = function (a) { var m = rows(a[0]); var ix = a.slice(1).map(function (x) { var k = num(x); return k < 0 ? m.length + k : k - 1; }); if (ix.some(function (k) { return k < 0 || k >= m.length; })) throw err('#VALUE!'); return out(ix.map(function (k) { return m[k].slice(); })); };
  F.TOCOL = function (a) { var m = rows(a[0]), skip = num(opt(a, 1, 0)), byCol = flag(a, 2), v = byCol ? [].concat.apply([], flip(m)) : [].concat.apply([], m); if (skip === 1 || skip === 3) v = v.filter(function (x) { return !blank(x); }); if (skip === 2 || skip === 3) v = v.filter(function (x) { return !isErr(x); }); return out(v.map(function (x) { return [x]; })); };
  F.TOROW = function (a) { var c = F.TOCOL(a); return out([c.rows.map(function (r) { return r[0]; })]); };
  F.EXPAND = function (a) { var m = rows(a[0]), R = num(a[1]), C = a[2] === undefined ? m[0].length : num(a[2]), pad = a[3] === undefined ? { e: '#N/A' } : opt(a, 3, null); if (R < m.length || C < m[0].length) throw err('#VALUE!'); var r = [], i, j; for (i = 0; i < R; i++) { var row = []; for (j = 0; j < C; j++) row.push(m[i] && j < m[0].length ? m[i][j] : pad); r.push(row); } return { rows: r }; };
  F.TEXTSPLIT = function (a) {
    var t = str(a[0]), cd = a[1] === undefined ? '' : flat(a[1]).map(str).filter(Boolean), rd = a[2] === undefined ? [] : flat(a[2]).map(str).filter(Boolean), ig = flag(a, 3), pad = a[5] === undefined ? { e: '#N/A' } : opt(a, 5, null);
    function split(s, ds) { if (!ds.length) return [s]; var re = new RegExp(ds.map(function (d) { return d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), a[4] !== undefined && num(a[4]) === 1 ? 'gi' : 'g'), p = s.split(re); return ig ? p.filter(function (x) { return x !== ''; }) : p; }
    var lines = rd.length ? split(t, rd) : [t], m = lines.map(function (l) { return split(l, cd); }), w = Math.max.apply(null, m.map(function (r) { return r.length; }));
    return out(m.map(function (r) { var o = r.map(function (x) { return x !== '' && !isNaN(Number(x)) && x.trim() === x ? Number(x) : x; }); while (o.length < w) o.push(pad); return o; }));
  };
  // LET(name1, value1, …, result): the names can be used in the later values and in the result
  L.LET = function (args, ev, ctx) {
    if (args.length < 3 || args.length % 2 === 0) throw err('#VALUE!'); var saved = ctx.vars; ctx.vars = Object.create(saved || null);
    try { for (var i = 0; i + 1 < args.length - 1; i += 2) { if (args[i].t !== 'name') throw err('#NAME?'); ctx.vars[args[i].v] = ev(args[i + 1]); } return ev(args[args.length - 1]); } finally { ctx.vars = saved; }
  };
  // LAMBDA(x, y, body) is a function made on the spot; MAP, BYROW, BYCOL, SCAN, REDUCE and MAKEARRAY call it for each cell, row or column
  L.LAMBDA = function (args, ev, ctx) {
    if (!args.length) throw err('#VALUE!'); var ps = args.slice(0, -1).map(function (a) { if (a.t !== 'name') throw err('#VALUE!'); return a.v; });
    return { lambda: true, params: ps, body: args[args.length - 1], vars: ctx.vars };
  };
  function call(cl, vals, ev, ctx) {
    if (!cl || !cl.lambda || cl.params.length !== vals.length) throw err('#VALUE!'); var saved = ctx.vars; ctx.vars = Object.create(cl.vars || null);
    try { cl.params.forEach(function (n, i) { ctx.vars[n] = vals[i]; }); var v = ev(cl.body); return isRng(v) ? v.rows[0][0] : v; } finally { ctx.vars = saved; }
  }
  function val(args, i, ev) { var v = ev(args[i]); if (isErr(v)) throw err(v.e); return v; }
  function lam(args, ev) { var l = ev(args[args.length - 1]); if (!l || !l.lambda) throw err('#VALUE!'); return l; }
  function size(m) { return m.length * m[0].length; }
  L.MAP = function (args, ev, ctx) {
    var cl = lam(args, ev), ms = args.slice(0, -1).map(function (_, i) { return rows(val(args, i, ev)); }), R = Math.max.apply(null, ms.map(function (m) { return m.length; })), C = Math.max.apply(null, ms.map(function (m) { return m[0].length; })), out = [], i, j;
    if (R * C > 100000) throw err('#CALC!');
    for (i = 0; i < R; i++) { var row = []; for (j = 0; j < C; j++) { try { row.push(call(cl, ms.map(function (m) { return m[m.length === 1 ? 0 : i][m[0].length === 1 ? 0 : j]; }), ev, ctx)); } catch (e) { if (e instanceof Calc.CalcErr) row.push({ e: e.e }); else throw e; } } out.push(row); }
    return { rows: out };
  };
  L.BYROW = function (args, ev, ctx) { var m = rows(val(args, 0, ev)), cl = lam(args, ev); return out(m.map(function (r) { return [call(cl, [{ rows: [r] }], ev, ctx)]; })); };
  L.BYCOL = function (args, ev, ctx) { var m = rows(val(args, 0, ev)), cl = lam(args, ev); return out([m[0].map(function (_, j) { return call(cl, [{ rows: col(m, j).map(function (x) { return [x]; }) }], ev, ctx); })]); };
  L.REDUCE = function (args, ev, ctx) { var acc = args[0].t === 'blank' ? null : val(args, 0, ev), m = rows(val(args, 1, ev)), cl = lam(args, ev); [].concat.apply([], m).forEach(function (x, i) { acc = i === 0 && args[0].t === 'blank' ? x : call(cl, [acc, x], ev, ctx); }); return acc; };
  L.SCAN = function (args, ev, ctx) { var acc = args[0].t === 'blank' ? null : val(args, 0, ev), first = args[0].t === 'blank', m = rows(val(args, 1, ev)), cl = lam(args, ev), n = 0; return { rows: m.map(function (r) { return r.map(function (x) { acc = first && n++ === 0 ? x : call(cl, [acc, x], ev, ctx); return acc; }); }) }; };
  L.MAKEARRAY = function (args, ev, ctx) { var R = num(val(args, 0, ev)), C = num(val(args, 1, ev)), cl = lam(args, ev), o = [], i, j; if (R < 1 || C < 1 || R * C > 100000) throw err('#CALC!'); for (i = 1; i <= R; i++) { var row = []; for (j = 1; j <= C; j++) row.push(call(cl, [i, j], ev, ctx)); o.push(row); } return { rows: o }; };
  // a few functions that take a block and answer one value
  F.ROWS = F.ROWS || function (a) { return rows(a[0]).length; };
  Object.assign(CalcDoc.extra, {
    SORT: 'array, [sort_index], [order], [by_col]', SORTBY: 'array, by1, [order1], …', UNIQUE: 'array, [by_col], [exactly_once]', FILTER: 'array, include, [if_empty]', SEQUENCE: 'rows, [cols], [start], [step]', RANDARRAY: '[rows], [cols], [min], [max], [whole]',
    TRANSPOSE: 'array', VSTACK: 'array1, [array2], …', HSTACK: 'array1, [array2], …', TAKE: 'array, rows, [cols]', DROP: 'array, rows, [cols]', CHOOSECOLS: 'array, col1, […]', CHOOSEROWS: 'array, row1, […]', TOCOL: 'array, [ignore], [by_col]', TOROW: 'array, [ignore], [by_col]',
    EXPAND: 'array, rows, [cols], [pad]', LAMBDA: 'param1, [param2], …, calculation', MAP: 'array1, [array2], …, lambda', BYROW: 'array, lambda', BYCOL: 'array, lambda', SCAN: 'initial, array, lambda', REDUCE: 'initial, array, lambda', MAKEARRAY: 'rows, cols, lambda', TEXTSPLIT: 'text, col_delim, [row_delim], [ignore_empty], [match_mode], [pad]', LET: 'name1, value1, …, result'
  });
})();
