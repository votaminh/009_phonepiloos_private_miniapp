// Wb — the open workbook in memory: sheets, cells, styles and every edit made since it was opened (so Save can hand just those to the engine), plus undo.
(function () {
  'use strict';
  var EMPTY = {}, HIST_MAX = 100, batch = null;
  var Wb = window.Wb = { sheets: [], xfs: [], on: 0, hist: [], at: 0, onChange: null, readOnly: false };

  function area(ref) { var p = ref.split(':'), a = SheetSvc.addr(p[0]), b = SheetSvc.addr(p[1] || p[0]); return a && b ? { r1: a.r, c1: a.c, r2: b.r, c2: b.c } : null; }
  Wb.load = function (res) {
    Wb.xfs = res.xfs || [];
    Wb.sheets = res.sheets.map(function (s, i) {
      var sh = { id: i, name: s.name, hiddenSheet: !!s.hidden, cells: {}, cs: s.cs || {}, ov: {}, sc: {}, dirty: {}, sdirty: {}, ops: [], colW: {}, rowH: {}, hidR: {}, hidC: {}, merges: [], frozen: s.frozen || { x: 0, y: 0 }, rows: 0, cols: 0, filter: null, freezeDirty: false };
      Object.keys(s.cells).forEach(function (a) {
        var c = s.cells[a], p = SheetSvc.addr(a); if (!p) return;
        sh.cells[a] = c.formula ? { v: null, f: c.formula, cv: (s.cv || {})[a] } : { v: c.value };
        if (p.r + 1 > sh.rows) sh.rows = p.r + 1; if (p.c + 1 > sh.cols) sh.cols = p.c + 1;
      });
      (s.cols || []).forEach(function (d) { var c; for (c = d.min - 1; c <= Math.min(d.max - 1, d.min + 200); c++) { if (d.w) sh.colW[c] = Math.max(36, Math.round(d.w * 7 + 5)); if (d.hidden) sh.hidC[c] = 1; } });
      Object.keys(s.rows || {}).forEach(function (r) { var d = s.rows[r]; if (d.h) sh.rowH[r] = Math.max(28, Math.round(d.h * 1.333)); if (d.hidden) sh.hidR[r] = 1; });
      (s.merges || []).forEach(function (m) { var a = area(m); if (a) sh.merges.push(a); });
      if (!sh.frozen.x && !sh.frozen.y) sh.frozen = { x: 0, y: 0 };
      return sh;
    });
    Wb.hist = []; Wb.at = 0; Calc.reset();
  };
  Wb.sh = function () { return Wb.sheets[Wb.on]; };
  Wb.byName = function (n) { var k, l = String(n).toLowerCase(); for (k = 0; k < Wb.sheets.length; k++) if (Wb.sheets[k].name.toLowerCase() === l) return Wb.sheets[k]; return null; };
  Wb.mergeAt = function (sh, r, c) { var i, m; for (i = 0; i < sh.merges.length; i++) { m = sh.merges[i]; if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m; } return null; };

  // ---- styles ---------------------------------------------------------------------------------------------------------------
  Wb.style = function (sh, r, c) {
    var a = SheetSvc.ref(r, c), ov = sh.ov[a], base = sh.cs[a] !== undefined ? Wb.xfs[sh.cs[a]] || EMPTY : EMPTY;
    if (!ov) return base;
    if (sh.sc[a]) return sh.sc[a];
    var o = Object.assign({}, base); Object.keys(ov).forEach(function (k) { if (ov[k] === null || ov[k] === false) delete o[k]; else o[k] = ov[k]; });
    return (sh.sc[a] = o);
  };
  var EDIT = { b: 'bold', i: 'italic', u: 'underline', s: 'strikethrough', sz: 'fontSize', f: 'fontFamily', c: 'fontColor', bg: 'fillColor', al: 'horizontalAlignment', wrap: 'wrapText' };
  function styleEdit(ov) {
    var e = {}; Object.keys(ov).forEach(function (k) {
      var v = ov[k]; if (k === 'f' && !v) return;
      if (EDIT[k]) e[EDIT[k]] = v === 0 ? false : v;
      else if (k === 'nf') e.numberFormat = v || 'General';
      else if (k === 'bd') { var s = v ? { style: 'thin' } : null; e.borderTop = s; e.borderRight = s; e.borderBottom = s; e.borderLeft = s; if (v && v.length === 4) { e.borderTop = v[0] ? s : null; e.borderRight = v[1] ? s : null; e.borderBottom = v[2] ? s : null; e.borderLeft = v[3] ? s : null; } }
    });
    return e;
  }

  // ---- history ----------------------------------------------------------------------------------------------------------------
  function push(item) {
    if (batch) { batch.push(item); return; }
    Wb.hist = Wb.hist.slice(0, Wb.at); Wb.hist.push([item]); if (Wb.hist.length > HIST_MAX) Wb.hist.shift(); Wb.at = Wb.hist.length;
  }
  Wb.batch = function (fn) {
    batch = []; try { fn(); } finally { var b = batch; batch = null; if (b.length) { Wb.hist = Wb.hist.slice(0, Wb.at); Wb.hist.push(b); if (Wb.hist.length > HIST_MAX) Wb.hist.shift(); Wb.at = Wb.hist.length; } }
  };
  function put(it, side) {
    var sh = it.sh, a = it.a;
    if (it.k === 'cell') { var v = it[side]; if (v) sh.cells[a] = Object.assign({}, v); else delete sh.cells[a]; sh.dirty[a] = 1; Calc.reset(); }
    else { var s = it[side]; if (s) sh.ov[a] = Object.assign({}, s); else delete sh.ov[a]; delete sh.sc[a]; sh.sdirty[a] = 1; }
  }
  Wb.canUndo = function () { return Wb.at > 0; };
  Wb.canRedo = function () { return Wb.at < Wb.hist.length; };
  Wb.undo = function () { if (!Wb.at) return false; Wb.hist[--Wb.at].slice().reverse().forEach(function (it) { put(it, 'before'); }); changed(); return true; };
  Wb.redo = function () { if (Wb.at >= Wb.hist.length) return false; Wb.hist[Wb.at++].forEach(function (it) { put(it, 'after'); }); changed(); return true; };
  function changed() { if (Wb.onChange) Wb.onChange(); }
  Wb.touch = changed;

  // ---- editing ----------------------------------------------------------------------------------------------------------------
  // v: value, f: formula text ("=B2+C2") or ''. null value and no formula empties the cell.
  Wb.setCell = function (sh, r, c, v, f) {
    var a = SheetSvc.ref(r, c), before = sh.cells[a] ? Object.assign({}, sh.cells[a]) : null, after = null;
    if (f) after = { v: null, f: f }; else if (v !== null && v !== undefined && v !== '') after = { v: v };
    if (JSON.stringify(before && { v: before.v, f: before.f }) === JSON.stringify(after)) return false;
    var it = { sh: sh, a: a, k: 'cell', before: before, after: after }; put(it, 'after'); push(it);
    if (after) { if (r + 1 > sh.rows) sh.rows = r + 1; if (c + 1 > sh.cols) sh.cols = c + 1; }
    return true;
  };
  // patch: { b: true, c: '#C23B3B', bg: null ... } merged into the cell's own overrides; null / false removes that look
  Wb.setStyle = function (sh, b, patch) {
    var r, c, n = 0;
    for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) {
      if (++n > 60000) return;
      var a = SheetSvc.ref(r, c), prev = sh.ov[a] ? Object.assign({}, sh.ov[a]) : null, next = Object.assign({}, prev || {}, patch);
      var it = { sh: sh, a: a, k: 'style', before: prev, after: next }; put(it, 'after'); push(it);
    }
  };

  // ---- what the engine needs at Save ---------------------------------------------------------------------------------------------
  Wb.pending = function () { return Wb.sheets.some(function (s) { return Object.keys(s.dirty).length || Object.keys(s.sdirty).length || s.ops.length || s.freezeDirty; }); };
  Wb.payload = function () {
    var edits = [], structural = [], fv = [], freeze = [];
    Wb.sheets.forEach(function (sh) {
      var keys = {}; Object.keys(sh.dirty).concat(Object.keys(sh.sdirty)).forEach(function (a) { keys[a] = 1; });
      Object.keys(keys).forEach(function (a) {
        var p = SheetSvc.addr(a), cell = sh.cells[a], e = { sheetName: sh.name, row: p.r, column: p.c, writeValue: !!sh.dirty[a], cell: { value: null } };
        if (cell) { var v = cell.f ? Calc.value(sh, p.r, p.c) : cell.v; e.cell = { value: v && typeof v === 'object' ? null : v === undefined ? null : v }; if (cell.f) e.cell.formula = cell.f; }
        if (sh.sdirty[a]) e.style = styleEdit(sh.ov[a] || {});
        if (e.writeValue || e.style) edits.push(e);
      });
      if (sh.ops.length) structural.push({ sheetName: sh.name, ops: sh.ops.slice() });
      if (Object.keys(sh.dirty).length || sh.ops.length) {
        var list = []; Object.keys(sh.cells).forEach(function (a) {
          var c = sh.cells[a]; if (!c.f) return; var p = SheetSvc.addr(a), v = Calc.value(sh, p.r, p.c); if (c.ast === null) return;
          list.push({ row: p.r, column: p.c, value: v && typeof v === 'object' ? { error: v.e } : v });
        });
        if (list.length) fv.push({ sheetName: sh.name, cells: list });
      }
      if (sh.freezeDirty) freeze.push({ sheetName: sh.name, x: sh.frozen.x, y: sh.frozen.y });
    });
    return { edits: edits, structural: structural, formulaValues: fv, freeze: freeze };
  };
  Wb.clean = function () { Wb.sheets.forEach(function (s) { s.dirty = {}; s.sdirty = {}; s.ops = []; s.freezeDirty = false; }); };
  // sheet extent shown to the person: used area, never smaller than a screenful
  Wb.extent = function (sh) { return { rows: Math.max(sh.rows + 40, 60), cols: Math.max(sh.cols + 6, 26) }; };
  // rows of a block as values (calculated), for sort / find / export
  Wb.value = function (sh, r, c) { return Calc.value(sh, r, c); };
})();
