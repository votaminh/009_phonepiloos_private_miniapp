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
  function sheetOf(ctx, name) { if (!name) return ctx.sh; var s = Wb.byName(name); if (!s) throw err('#REF!'); return s; }

  function cellVal(sh, r, c) {
    var key = sh.id + ':' + r + ':' + c; if (key in memo) return memo[key];
    var cell = sh.cells[SheetSvc.ref(r, c)], v;
    if (!cell) v = null;
    else if (cell.f) {
      if (busy[key]) return { e: '#REF!' };
      busy[key] = 1;
      try { v = formula(sh, cell); } finally { delete busy[key]; }
    } else v = cell.v === undefined ? null : cell.v;
    memo[key] = v; return v;
  }
  function formula(sh, cell) {
    try {
      if (cell.ast === undefined) cell.ast = CalcParse.parse(cell.f);
      var v = ev(cell.ast, { sh: sh });
      if (isRng(v)) v = v.rows[0][0];
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
      case 'ref': if (n.range) return rangeOf(n, ctx); var v = cellVal(sheetOf(ctx, n.sheet), n.r1, n.c1); return v;
      case 'un': return -num(ev(n.a, ctx));
      case 'pct': return num(ev(n.a, ctx)) / 100;
      case 'bin': return bin(n.op, ev(n.a, ctx), ev(n.b, ctx));
      case 'fn':
        if (lazy[n.name]) return lazy[n.name](n.args, function (x) { return ev(x, ctx); });
        if (!fns[n.name]) throw new Error('unknown ' + n.name);
        return fns[n.name](n.args.map(function (x) { return ev(x, ctx); }), ctx);
    }
    throw new Error('node');
  }
  function bin(op, a, b) {
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

  window.Calc = {
    fns: fns, lazy: lazy, num: num, str: str, bool: bool, cmp: cmp, isErr: isErr, isRng: isRng, err: err, CalcErr: CalcErr,
    reset: function () { memo = {}; },
    // the value of a cell as the screen shows it (formulas calculated)
    value: function (sh, r, c) { return cellVal(sh, r, c); },
    // does this formula parse, and with functions we know? (used to decide what to store with it)
    known: function (sh, r, c) { var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell || !cell.f) return true; cellVal(sh, r, c); return cell.ast !== null; }
  };
})();
