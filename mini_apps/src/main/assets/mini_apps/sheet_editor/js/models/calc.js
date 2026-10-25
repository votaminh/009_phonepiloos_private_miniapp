// Calc — evaluates the formulas of the open workbook on demand. A value is a number, text, true/false, null (blank) or { e: '#DIV/0!' }.
// A cell is calculated when something asks for it and remembered until the next edit (reset). A formula this engine does not know keeps the value Excel stored with it.
(function () {
  'use strict';
  var memo = {}, busy = {}, fns = {}, lazy = {};
  function CalcErr(e) { this.e = e; }
  function err(e) { return new CalcErr(e); }
  function isErr(v) { return !!v && typeof v === 'object' && typeof v.e === 'string'; }
  function isRng(v) { return !!v && typeof v === 'object' && !!v.rows; }
  function num(v) {
    if (isErr(v)) throw new CalcErr(v.e);
    if (isRng(v)) v = v.rows[0][0];
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    var n = Number(String(v).trim().replace(/%$/, '')); if (isNaN(n)) throw err('#VALUE!');
    return /%\s*$/.test(String(v)) ? n / 100 : n;
  }
  function str(v) {
    if (isErr(v)) throw new CalcErr(v.e);
    if (isRng(v)) v = v.rows[0][0];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(+v.toPrecision(15));
    return String(v);
  }
  function bool(v) { if (isErr(v)) throw new CalcErr(v.e); if (isRng(v)) v = v.rows[0][0]; if (typeof v === 'string') { var u = v.toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE') return false; throw err('#VALUE!'); } return !!num(v); }
  function rank(v) { return typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2; }
  function cmp(a, b) {
    if (a === null) a = typeof b === 'string' ? '' : 0; if (b === null) b = typeof a === 'string' ? '' : 0;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (typeof a === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  // a defined name: the cell-scoped one first (Sheet!name), then the workbook's; its formula is parsed once and kept
  function nameOf(ctx, id) {
    var low = String(id).toLowerCase(), n = Wb.names && (Wb.names[ctx.sh.name + '!' + low] || Wb.names[low]); if (!n) throw err('#NAME?');
    if (n.ast === undefined) { try { n.ast = CalcParse.parse('=' + String(n.formula || '').replace(/^=/, '')); } catch (e) { n.ast = null; } }
    if (!n.ast) throw err('#NAME?'); return n.ast;
  }
  function sheetOf(ctx, name) { if (!name) return ctx.sh; var s = Wb.byName(name); if (!s) throw err('#REF!'); return s; }

  // formulas whose answer is a block of cells: it spills over the cells to the right and below (they must be empty)
  var SPILLS = /\b(SORT|SORTBY|UNIQUE|FILTER|SEQUENCE|TRANSPOSE|VSTACK|HSTACK|TAKE|DROP|TEXTSPLIT|RANDARRAY|CHOOSECOLS|CHOOSEROWS|TOCOL|TOROW|EXPAND|LET|MAP|BYROW|BYCOL|SCAN|MAKEARRAY)\(|[A-Z]+\d+#/i, epoch = 0;
  function anchors(sh) {
    if (sh._ae !== epoch) { sh._ae = epoch; sh._an = []; Object.keys(sh.cells).forEach(function (a) { var c = sh.cells[a]; if (c.f && SPILLS.test(c.f)) sh._an.push(a); }); }
    return sh._an;
  }
  function spillBlocked(sh, cell, v) {
    var at = null; anchors(sh).forEach(function (a) { if (sh.cells[a] === cell) at = SheetSvc.addr(a); }); if (!at) return false;
    for (var i = 0; i < v.rows.length; i++) for (var j = 0; j < v.rows[0].length; j++) { if (!i && !j) continue; var o = sh.cells[SheetSvc.ref(at.r + i, at.c + j)]; if (o && (o.f || (o.v !== null && o.v !== undefined && o.v !== ''))) return true; }
    return false;
  }
  // the value a cell gets from a spill that comes from a formula above or to the left of it
  function spillAt(sh, r, c) {
    var l = anchors(sh), i; for (i = 0; i < l.length; i++) {
      var p = SheetSvc.addr(l[i]); if (p.r > r || p.c > c || (p.r === r && p.c === c) || busy[sh.id + ':' + p.r + ':' + p.c]) continue; cellVal(sh, p.r, p.c);
      var cell = sh.cells[l[i]]; if (cell && cell.spill && r - p.r < cell.spill.length && c - p.c < cell.spill[0].length) return cell.spill[r - p.r][c - p.c];
    }
    return null;
  }
  function cellVal(sh, r, c) {
    var key = sh.id + ':' + r + ':' + c; if (key in memo) return memo[key];
    var cell = sh.cells[SheetSvc.ref(r, c)], v;
    if (!cell) v = anchors(sh).length ? spillAt(sh, r, c) : null;
    else if (cell.f) {
      if (busy[key]) return { e: '#REF!' };
      busy[key] = 1;
      try { v = formula(sh, cell, r, c); } finally { delete busy[key]; }
    } else v = cell.v === undefined ? null : cell.v;
    memo[key] = v; return v;
  }
  function formula(sh, cell, r0, c0) {
    try {
      if (cell.ast === undefined) cell.ast = CalcParse.parse(cell.f);
      cell.spill = null; var v = ev(cell.ast, { sh: sh, r: r0, c: c0 });
      if (isRng(v)) {
        if ((v.rows.length > 1 || v.rows[0].length > 1) && SPILLS.test(cell.f)) { var blocked = spillBlocked(sh, cell, v); if (blocked) return { e: '#SPILL!' }; cell.spill = v.rows; }
        v = v.rows[0][0];
      }
      return v === undefined ? null : v;
    } catch (e) {
      if (e instanceof CalcErr) return { e: e.e };
      cell.ast = null;   // a function or syntax this engine does not know: keep what Excel stored
      return cell.cv !== undefined ? cell.cv : { e: '#NAME?' };
    }
  }
  function rangeOf(n, ctx) {
    var sh = sheetOf(ctx, n.sheet), rows = [], r, c, row;
    if ((n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1) > 300000) throw err('#VALUE!');
    for (r = n.r1; r <= n.r2; r++) { row = []; for (c = n.c1; c <= n.c2; c++) row.push(cellVal(sh, r, c)); rows.push(row); }
    return { rows: rows };
  }
  function ev(n, ctx) {
    switch (n.t) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'blank': return null;
      case 'name': if (ctx.vars && ctx.vars[n.v] !== undefined) return ctx.vars[n.v]; return ev(nameOf(ctx, n.v), ctx);
      case 'arr': return { rows: n.rows.map(function (r) { return r.map(function (x) { var v = ev(x, ctx); return isRng(v) ? v.rows[0][0] : v; }); }) };
      case 'ref': if (n.spill) { var ss = sheetOf(ctx, n.sheet); cellVal(ss, n.r1, n.c1); var an = ss.cells[SheetSvc.ref(n.r1, n.c1)]; return an && an.spill ? { rows: an.spill } : cellVal(ss, n.r1, n.c1); } if (n.range) return rangeOf(n, ctx); var v = cellVal(sheetOf(ctx, n.sheet), n.r1, n.c1); return v;
      case 'un': var ua = ev(n.a, ctx); return isRng(ua) && size(ua) > 1 ? zip(ua, 0, function (x) { return -num(x); }) : -num(ua);
      case 'pct': var pa = ev(n.a, ctx); return isRng(pa) && size(pa) > 1 ? zip(pa, 0, function (x) { return num(x) / 100; }) : num(pa) / 100;
      case 'bin': return bin(n.op, ev(n.a, ctx), ev(n.b, ctx));
      case 'fn':
        if (ctx.vars && ctx.vars[n.name] && ctx.vars[n.name].lambda) {   // a LAMBDA kept under a name (LET(f, LAMBDA(x, x+1), f(2)))
          var cl = ctx.vars[n.name], vals = n.args.map(function (x) { return ev(x, ctx); }), saved = ctx.vars; if (cl.params.length !== vals.length) throw err('#VALUE!'); ctx.vars = Object.create(cl.vars || null);
          try { cl.params.forEach(function (p, i) { ctx.vars[p] = vals[i]; }); var rv = ev(cl.body, ctx); return rv; } finally { ctx.vars = saved; }
        }
        if (lazy[n.name]) return lazy[n.name](n.args, function (x) { return ev(x, ctx); }, ctx);
        if (!fns[n.name]) throw new Error('unknown ' + n.name);
        return fns[n.name](n.args.map(function (x) { return ev(x, ctx); }), ctx);
    }
    throw new Error('node');
  }
  // arrays take part in arithmetic and comparisons cell by cell (a single row or column is repeated across the other)
  function size(r) { return r.rows.length * r.rows[0].length; }
  function zip(a, b, f) {
    var ra = isRng(a) ? a.rows : [[a]], rb = isRng(b) ? b.rows : [[b]], R = Math.max(ra.length, rb.length), C = Math.max(ra[0].length, rb[0].length), out = [], i, j;
    for (i = 0; i < R; i++) { var row = []; for (j = 0; j < C; j++) { var x = ra[ra.length === 1 ? 0 : i][ra[0].length === 1 ? 0 : j], y = rb[rb.length === 1 ? 0 : i][rb[0].length === 1 ? 0 : j]; try { row.push(f(x, y)); } catch (e) { if (e instanceof CalcErr) row.push({ e: e.e }); else throw e; } } out.push(row); }
    return { rows: out };
  }
  function bin(op, a, b) {
    if ((isRng(a) && size(a) > 1) || (isRng(b) && size(b) > 1)) return zip(a, b, function (x, y) { return bin(op, x, y); });
    if (isErr(a)) throw new CalcErr(a.e); if (isErr(b)) throw new CalcErr(b.e);
    if (isRng(a)) a = a.rows[0][0]; if (isRng(b)) b = b.rows[0][0];
    switch (op) {
      case '+': return num(a) + num(b);
      case '-': return num(a) - num(b);
      case '*': return num(a) * num(b);
      case '/': var d = num(b); if (d === 0) throw err('#DIV/0!'); return num(a) / d;
      case '^': return Math.pow(num(a), num(b));
      case '&': return str(a) + str(b);
      case '=': return cmp(a, b) === 0; case '<>': return cmp(a, b) !== 0;
      case '<': return cmp(a, b) < 0; case '>': return cmp(a, b) > 0; case '<=': return cmp(a, b) <= 0; case '>=': return cmp(a, b) >= 0;
    }
  }

  // ---- functions that work on where a reference is, not on what it holds ---------------------------------------------------------
  function refOf(node, ctx) { var n = node; if (n && n.t === 'name') n = nameOf(ctx, n.v); if (!n || n.t !== 'ref') throw err('#VALUE!'); return n; }
  function block(sh, r1, c1, r2, c2) { if (r1 < 0 || c1 < 0 || r2 < r1 || c2 < c1) throw err('#REF!'); if ((r2 - r1 + 1) * (c2 - c1 + 1) > 300000) throw err('#VALUE!'); if (r1 === r2 && c1 === c2) return cellVal(sh, r1, c1); var rows = [], r, c; for (r = r1; r <= r2; r++) { var row = []; for (c = c1; c <= c2; c++) row.push(cellVal(sh, r, c)); rows.push(row); } return { rows: rows }; }
  function col(c) { var s = ''; c++; while (c > 0) { c--; s = String.fromCharCode(65 + c % 26) + s; c = Math.floor(c / 26); } return s; }
  lazy.ROW = function (args, ev, ctx) { if (!args.length) { if (ctx.r === undefined) throw err('#VALUE!'); return ctx.r + 1; } var n = refOf(args[0], ctx); if (n.r1 === n.r2) return n.r1 + 1; var o = []; for (var r = n.r1; r <= n.r2; r++) o.push([r + 1]); return { rows: o }; };
  lazy.COLUMN = function (args, ev, ctx) { if (!args.length) { if (ctx.c === undefined) throw err('#VALUE!'); return ctx.c + 1; } var n = refOf(args[0], ctx); if (n.c1 === n.c2) return n.c1 + 1; var o = []; for (var c = n.c1; c <= n.c2; c++) o.push(c + 1); return { rows: [o] }; };
  lazy.OFFSET = function (args, ev, ctx) {
    var n = refOf(args[0], ctx), dr = num(ev(args[1])), dc = num(ev(args[2])), h = args[3] && args[3].t !== 'blank' ? num(ev(args[3])) : n.r2 - n.r1 + 1, w = args[4] && args[4].t !== 'blank' ? num(ev(args[4])) : n.c2 - n.c1 + 1;
    if (h < 1 || w < 1) throw err('#REF!'); var r1 = n.r1 + Math.trunc(dr), c1 = n.c1 + Math.trunc(dc); return block(sheetOf(ctx, n.sheet), r1, c1, r1 + h - 1, c1 + w - 1);
  };
  lazy.INDIRECT = function (args, ev, ctx) {
    var text = str(ev(args[0])).trim(); if (args[1] && args[1].t !== 'blank' && !bool(ev(args[1]))) throw err('#REF!'); var node; try { node = CalcParse.parse('=' + text); } catch (e) { throw err('#REF!'); }
    if (node.t === 'name') node = nameOf(ctx, node.v); if (!node || node.t !== 'ref') throw err('#REF!'); return ev(node);
  };
  fns.ADDRESS = function (a) {
    var r = Math.trunc(num(a[0])), c = Math.trunc(num(a[1])), k = a[2] === undefined || a[2] === null ? 1 : num(a[2]), sheet = a[4] === undefined ? '' : str(a[4]); if (r < 1 || c < 1) throw err('#VALUE!');
    var text = (k === 1 || k === 3 ? '$' : '') + col(c - 1) + (k === 1 || k === 2 ? '$' : '') + r; return sheet ? (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet) ? sheet : "'" + sheet.replace(/'/g, "''") + "'") + '!' + text : text;
  };

  window.Calc = {
    fns: fns, lazy: lazy, num: num, str: str, bool: bool, cmp: cmp, isErr: isErr, isRng: isRng, err: err, CalcErr: CalcErr,
    reset: function () { memo = {}; epoch++; },
    // the formulas of a sheet that spill, with the block they fill: [{ r, c, rows }]
    spills: function (sh) { var o = []; anchors(sh).forEach(function (a) { var p = SheetSvc.addr(a); cellVal(sh, p.r, p.c); var cell = sh.cells[a]; if (cell && cell.spill) o.push({ r: p.r, c: p.c, rows: cell.spill }); }); return o; },
    zip: zip,
    // the value of a formula typed as text (with or without the =), as seen from sheet sh; { e: '#...' } when it fails
    evalText: function (sh, text) { try { var v = ev(CalcParse.parse(text[0] === '=' ? text : '=' + text), { sh: sh }); if (isRng(v)) v = v.rows[0][0]; return v === undefined ? null : v; } catch (e) { return e instanceof CalcErr ? { e: e.e } : { e: '#NAME?' }; } },
    // the cells of a range typed as text (A1:B3, Sheet2!A1:A9, a name) as a flat list of values; null when it is not a range
    cellsOf: function (sh, text) { try { var n = CalcParse.parse('=' + text); if (n && n.t === 'name') n = nameOf({ sh: sh }, n.v); if (n && n.t === 'ref') { var r = ev(n, { sh: sh }); return isRng(r) ? [].concat.apply([], r.rows) : [r]; } } catch (e) { /* not a range */ } return null; },
    // the value of a cell as the screen shows it (formulas calculated)
    value: function (sh, r, c) { return cellVal(sh, r, c); },
    // does this formula parse, and with functions we know? (used to decide what to store with it)
    known: function (sh, r, c) { var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell || !cell.f) return true; cellVal(sh, r, c); return cell.ast !== null; }
  };
})();
