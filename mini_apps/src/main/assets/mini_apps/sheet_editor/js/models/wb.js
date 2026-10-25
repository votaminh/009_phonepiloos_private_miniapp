// Wb — the open workbook in memory: sheets, cells, styles and every edit made since it was opened (so Save can hand just those to the engine), plus undo.
(function () {
  'use strict';
  var EMPTY = {}, HIST_MAX = 100, batch = null;
  var Wb = window.Wb = { sheets: [], xfs: [], on: 0, hist: [], at: 0, onChange: null, readOnly: false };

  function area(ref) { var p = ref.split(':'), a = SheetSvc.addr(p[0]), b = SheetSvc.addr(p[1] || p[0]); return a && b ? { r1: a.r, c1: a.c, r2: b.r, c2: b.c } : null; }
  Wb.load = function (res) {
    Wb.xfs = res.xfs || [];
    Wb.sheets = res.sheets.map(function (s, i) {
      var sh = { id: i, name: s.name, hiddenSheet: !!s.hidden, cells: {}, cs: s.cs || {}, ov: {}, sc: {}, dirty: {}, sdirty: {}, ops: [], colW: {}, rowH: {}, hidR: {}, hidC: {}, merges: [], frozen: s.frozen || { x: 0, y: 0 }, rows: 0, cols: 0, af: null, tables: (s.tables || []).slice(), prot: s.prot || null, lvlR: {}, lvlC: {}, afDirty: false, protDirty: false, tablesNew: [], freezeDirty: false, dv: (s.dv || []).map(function (d) { return { sqref: d.sqref, rule: d.rule }; }), links: (s.links || []).slice(), notes: (s.notes || []).slice(), tab: s.tab || null, noGrid: !!s.noGrid, linkOps: [], dvDirty: false, notesDirty: false, tabDirty: false, viewDirty: false };
      Object.keys(s.cells).forEach(function (a) {
        var c = s.cells[a], p = SheetSvc.addr(a); if (!p) return;
        sh.cells[a] = c.formula ? { v: null, f: window.SpillIo ? SpillIo.in(c.formula) : c.formula, cv: (s.cv || {})[a] } : { v: c.value };
        if (p.r + 1 > sh.rows) sh.rows = p.r + 1; if (p.c + 1 > sh.cols) sh.cols = p.c + 1;
      });
      // the cells an array formula of the file filled hold its answer, not data of their own: they come from the formula here (and are cleared at the next save of the sheet)
      sh.stale = []; (s.arrays || []).forEach(function (ar) {
        var m = sh.cells[ar.at]; if (!m || !m.f || !/\b(SORT|SORTBY|UNIQUE|FILTER|SEQUENCE|TRANSPOSE|VSTACK|HSTACK|TAKE|DROP|TEXTSPLIT|RANDARRAY|CHOOSECOLS|CHOOSEROWS|TOCOL|TOROW|EXPAND)\(/i.test(m.f)) return; var q = area(ar.range); if (!q) return;
        for (var rr = q.r1; rr <= q.r2; rr++) for (var cc = q.c1; cc <= q.c2; cc++) { var k = SheetSvc.ref(rr, cc); if (k !== ar.at && sh.cells[k] && !sh.cells[k].f) { delete sh.cells[k]; sh.stale.push(k); } }
      });
      (s.cols || []).forEach(function (d) { var c; for (c = d.min - 1; c <= Math.min(d.max - 1, d.min + 200); c++) { if (d.lvl) sh.lvlC[c] = d.lvl; if (d.w) sh.colW[c] = Math.max(36, Math.round(d.w * 7 + 5)); if (d.hidden) sh.hidC[c] = 1; } });
      Object.keys(s.rows || {}).forEach(function (r) { var d = s.rows[r]; if (d.h) sh.rowH[r] = Math.max(28, Math.round(d.h * 1.333)); if (d.hidden) sh.hidR[r] = 1; if (d.lvl) sh.lvlR[r] = d.lvl; });
      if (s.filter && s.filter.ref) { var fa = area(s.filter.ref); if (fa) { sh.af = { r1: fa.r1, c1: fa.c1, r2: fa.r2, c2: fa.c2, cols: {}, hid: [] }; (s.filter.cols || []).forEach(function (c) { sh.af.cols[fa.c1 + c.colId] = { values: c.values, blank: c.blank, customs: c.customs }; }); if (Object.keys(sh.af.cols).length) for (var hr = fa.r1 + 1; hr <= fa.r2; hr++) if (sh.hidR[hr]) sh.af.hid.push(hr); } }
      (s.merges || []).forEach(function (m) { var a = area(m); if (a) sh.merges.push(a); });
      if (!sh.frozen.x && !sh.frozen.y) sh.frozen = { x: 0, y: 0 };
      return sh;
    });
    Wb.names = {}; Wb.namesDirty = false; (res.names || []).forEach(function (n) { Wb.names[(n.sheet >= 0 ? Wb.sheets[n.sheet].name + '!' : '') + n.name.toLowerCase()] = n; });
    Wb.hist = []; Wb.at = 0; Calc.reset();
  };
  // a block of cells written as A1 / A1:B3 / a list of them separated by spaces -> areas for the engine
  Wb.areas = function (sqref) {
    return String(sqref).split(/\s+/).filter(Boolean).map(area).filter(Boolean).map(function (a) { return { startRow: a.r1, endRow: a.r2, startColumn: a.c1, endColumn: a.c2 }; });
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
  // one side of a border as the engine wants it: nothing, a thin line (1), a style name, or { s: style, c: colour }
  Wb.edge = function (v) {
    if (!v) return null; if (v === 1 || v === true) return { style: 'thin' };
    if (typeof v === 'string') return { style: v }; var o = { style: v.s || 'thin' }; if (v.c) o.color = v.c; return o;
  };
  var EDIT = { b: 'bold', i: 'italic', u: 'underline', s: 'strikethrough', sz: 'fontSize', f: 'fontFamily', c: 'fontColor', bg: 'fillColor', al: 'horizontalAlignment', va: 'verticalAlignment', wrap: 'wrapText', 'in': 'indent', rot: 'textRotation' };
  function styleEdit(ov) {
    var e = {}; Object.keys(ov).forEach(function (k) {
      var v = ov[k]; if (k === 'f' && !v) return;
      if (k === 'u') { e.underline = !!v; if (v === 2) e.underlineStyle = 'double'; else if (v) e.underlineStyle = 'single'; }
      else if (EDIT[k]) e[EDIT[k]] = v === 0 ? false : v;
      else if (k === 'nf') e.numberFormat = v || 'General';
      else if (k === 'bd') { var E = ['borderTop', 'borderRight', 'borderBottom', 'borderLeft']; for (var q = 0; q < 4; q++) e[E[q]] = Wb.edge(v && (v.length === 4 ? v[q] : v)); }
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
    if (sh.prot && !Wb.style(sh, r, c).unlocked) { if (Wb.onLocked) Wb.onLocked('cell'); return false; }
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
    if (sh.prot && !(sh.prot.allow && sh.prot.allow.formatCells)) { if (Wb.onLocked) Wb.onLocked('format'); return; }
    for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) {
      if (++n > 60000) return;
      var a = SheetSvc.ref(r, c), prev = sh.ov[a] ? Object.assign({}, sh.ov[a]) : null, next = Object.assign({}, prev || {}, patch);
      var it = { sh: sh, a: a, k: 'style', before: prev, after: next }; put(it, 'after'); push(it);
    }
  };

  // ---- what the engine needs at Save ---------------------------------------------------------------------------------------------
  Wb.pending = function () { return Wb.namesDirty || Wb.sheets.some(function (s) { return Object.keys(s.dirty).length || Object.keys(s.sdirty).length || s.ops.length || s.freezeDirty || s.dvDirty || s.notesDirty || s.tabDirty || s.viewDirty || s.linkOps.length || (s.cfNew && s.cfNew.length) || (s.cfDel && s.cfDel.length) || s.afDirty || s.protDirty || (s.tablesNew && s.tablesNew.length) || (s.tableEdits && s.tableEdits.length); }); };
  Wb.payload = function () {
    var edits = [], structural = [], fv = [], freeze = [], dv = [], links = [], notes = [], tabs = [], arrays = [], cf = [], cfDel = [], filters = [], protect = [], tables = [], tableEdits = [], names = null;
    Wb.sheets.forEach(function (sh) {
      var keys = {}; Object.keys(sh.dirty).concat(Object.keys(sh.sdirty)).forEach(function (a) { keys[a] = 1; });
      Object.keys(keys).forEach(function (a) {
        var p = SheetSvc.addr(a), cell = sh.cells[a], e = { sheetName: sh.name, row: p.r, column: p.c, writeValue: !!sh.dirty[a], cell: { value: null } };
        if (cell) { var v = cell.f ? Calc.value(sh, p.r, p.c) : cell.v; e.cell = { value: v && typeof v === 'object' ? null : v === undefined ? null : v }; if (cell.f) e.cell.formula = window.SpillIo ? SpillIo.out(cell.f) : cell.f; }
        if (sh.sdirty[a]) e.style = styleEdit(sh.ov[a] || {});
        if (e.writeValue || e.style) edits.push(e);
      });
      if (window.Calc && window.SpillIo && (Object.keys(sh.dirty).length || sh.ops.length)) {
        // a formula that fills a block: the block is the ref of its array, and the cells under the first one carry its answer (as Excel writes it) for readers that do not calculate
        var ar = []; Calc.spills(sh).forEach(function (sp) {
          var a = SheetSvc.ref(sp.r, sp.c), h = sp.rows.length, wd = sp.rows[0].length; ar.push({ at: a, range: a + ':' + SheetSvc.ref(sp.r + h - 1, sp.c + wd - 1) });
          sp.rows.forEach(function (row, i) { row.forEach(function (v, j) { if (!i && !j) return; edits.push({ sheetName: sh.name, row: sp.r + i, column: sp.c + j, writeValue: true, cell: { value: v === undefined || (v && typeof v === 'object') ? null : v } }); }); });
        }); if (ar.length) arrays.push({ sheetName: sh.name, items: ar });
      }
      if (sh.stale && sh.stale.length && (Object.keys(sh.dirty).length || sh.ops.length)) { var have = {}; edits.forEach(function (e) { if (e.sheetName === sh.name) have[e.row + ':' + e.column] = 1; }); sh.stale.forEach(function (a) { var p = SheetSvc.addr(a); if (!sh.cells[a] && !have[p.r + ':' + p.c]) edits.push({ sheetName: sh.name, row: p.r, column: p.c, writeValue: true, cell: { value: null } }); }); sh.stale = []; }
      if (sh.ops.length) structural.push({ sheetName: sh.name, ops: sh.ops.slice() });
      if (Object.keys(sh.dirty).length || sh.ops.length) {
        var list = []; Object.keys(sh.cells).forEach(function (a) {
          var c = sh.cells[a]; if (!c.f) return; var p = SheetSvc.addr(a), v = Calc.value(sh, p.r, p.c); if (c.ast === null) return;
          list.push({ row: p.r, column: p.c, value: v && typeof v === 'object' ? { error: v.e } : v });
        });
        if (list.length) fv.push({ sheetName: sh.name, cells: list });
      }
      if (sh.freezeDirty || sh.viewDirty) freeze.push({ sheetName: sh.name, x: sh.frozen.x, y: sh.frozen.y, noGrid: !!sh.noGrid, panes: !!sh.freezeDirty });
      if (sh.dvDirty) dv.push({ sheetName: sh.name, rules: sh.dv.map(function (d) { return { ranges: Wb.areas(d.sqref), rule: d.rule }; }) });
      if (sh.linkOps.length) links.push({ sheetName: sh.name, edits: sh.linkOps.slice() });
      if (sh.notesDirty) notes.push({ sheetName: sh.name, notes: sh.notes.map(function (n) { var p = SheetSvc.addr(n.ref); return { row: p.r, column: p.c, author: n.author || '', text: n.text }; }) });
      if (sh.cfNew && sh.cfNew.length) cf.push({ sheetName: sh.name, rules: sh.cfNew.map(function (n) { return n.wire; }), append: true });
      if (sh.cfDel && sh.cfDel.length) cfDel.push({ sheetName: sh.name, index: sh.cfDel.slice() });
      if (sh.afDirty) filters.push(Wb.filterState(sh));
      if (sh.protDirty) protect.push(sh.protOut || { sheetName: sh.name, protected: !!sh.prot, allow: sh.prot && sh.prot.allow || undefined });
      (sh.tablesNew || []).forEach(function (n) { tables.push(n.wire); });
      (sh.tableEdits || []).forEach(function (e) { tableEdits.push(e); });
      if (sh.tabDirty) tabs.push({ sheetName: sh.name, color: sh.tab || null });
    });
    if (Wb.namesDirty) names = { names: Object.keys(Wb.names).map(function (k) { var n = Wb.names[k]; return n.sheet >= 0 ? { name: n.name, formula: n.formula, sheetIndex: n.sheet } : { name: n.name, formula: n.formula }; }), preserveNames: [] };
    return { edits: edits, structural: structural, formulaValues: fv, freeze: freeze, dv: dv, links: links, notes: notes, tabs: tabs, cf: cf, arrays: arrays, cfDel: cfDel, filters: filters, protect: protect, tables: tables, tableEdits: tableEdits, names: names };
  };
  // the AutoFilter of a sheet in the shape the engine takes (null range = no filter any more); hiddenRows are the rows the filter hides
  Wb.filterState = function (sh) {
    var f = sh.af; if (!f) return { sheetName: sh.name, filter: null, hiddenRows: [], visibilityRange: sh.afWas ? { startRow: sh.afWas.r1, endRow: sh.afWas.r2, startColumn: sh.afWas.c1, endColumn: sh.afWas.c2 } : { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 } };
    return { sheetName: sh.name, filter: { range: { startRow: f.r1, endRow: f.r2, startColumn: f.c1, endColumn: f.c2 }, columns: Object.keys(f.cols).map(function (k) { var c = f.cols[k], o = { colId: +k - f.c1 }; if (c.values) o.values = c.values; if (c.blank) o.blank = true; if (c.customs) o.customs = c.customs; return o; }).filter(function (o) { return o.values || o.customs; }) }, hiddenRows: f.hid.slice(), visibilityRange: { startRow: f.r1, endRow: f.r2, startColumn: f.c1, endColumn: f.c2 } };
  };
  Wb.clean = function () { Wb.sheets.forEach(function (s) { s.dirty = {}; s.sdirty = {}; s.ops = []; s.freezeDirty = false; s.dvDirty = s.notesDirty = s.tabDirty = s.viewDirty = false; s.linkOps = []; s.cfNew = []; s.cfDel = []; s.afDirty = s.protDirty = false; s.protOut = null; s.tablesNew = []; s.tableEdits = []; }); Wb.namesDirty = false; };
  // sheet extent shown to the person: used area, never smaller than a screenful
  Wb.extent = function (sh) { return { rows: Math.max(sh.rows + 40, 60), cols: Math.max(sh.cols + 6, 26) }; };
  // rows of a block as values (calculated), for sort / find / export
  Wb.value = function (sh, r, c) { return Calc.value(sh, r, c); };
})();
