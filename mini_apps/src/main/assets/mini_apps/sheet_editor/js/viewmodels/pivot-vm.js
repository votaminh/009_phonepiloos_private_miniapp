// Pivot — Insert > Pivot table: up to three row fields, one column field, a report filter and one or two values (sum, count, average, largest, smallest) from a block of data, on a new sheet.
// The table is made of real cells and written as a native pivot table too (source range, fields, cache), so Excel opens it as a pivot and can refresh and rearrange it.
// It is not refreshed here when the data changes. Two values go together with rows only; a column field takes one value.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, PV = window.Pivot = {};
  var AGGS = ['sum', 'count', 'average', 'max', 'min'], CAP = { sum: 'Sum', count: 'Count', average: 'Average', max: 'Max', min: 'Min' }, MAXREC = 30000;
  function parse(text) { var m = /^\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/.exec(String(text).trim().toUpperCase()); if (!m) return null; var a = SheetSvc.addr(m[1] + m[2]), b = SheetSvc.addr(m[3] + m[4]); return a && b ? { r1: a.r, c1: a.c, r2: b.r, c2: b.c } : null; }
  function names(sh, q) { var o = [], seen = {}, c; for (c = q.c1; c <= q.c2; c++) { var h = String(Fmt.cell(sh, q.r1, c).t || '').trim() || 'Column' + (c - q.c1 + 1), base = h, k = 1; while (seen[h.toLowerCase()]) h = base + (++k); seen[h.toLowerCase()] = 1; o.push(h); } return o; }
  function guess(sh) {
    var s = G.sel; if (s.r1 !== s.r2 || s.c1 !== s.c2) return { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 };
    var r1 = s.r1, c1 = s.c1, r2 = s.r1, c2 = s.c1, has = function (r, c) { return !!sh.cells[SheetSvc.ref(r, c)]; }, grow = true, r, c;
    while (grow) { grow = false;
      for (c = c1 - 1; c <= c2 + 1 && !grow; c++) if (c >= 0 && (c < c1 || c > c2)) for (r = r1; r <= r2; r++) if (has(r, c)) { if (c < c1) c1 = c; else c2 = c; grow = true; break; }
      for (r = r1 - 1; r <= r2 + 1 && !grow; r++) if (r >= 0 && (r < r1 || r > r2)) for (c = c1; c <= c2; c++) if (has(r, c)) { if (r < r1) r1 = r; else r2 = r; grow = true; break; } }
    return { r1: r1, c1: c1, r2: Math.max(r2, r1 + 1), c2: c2 };
  }
  function fields() { var q = parse(D.st.range); return q ? names(G.geo.sh, q) : []; }

  // ---- the form ---------------------------------------------------------------------------------------------------------------------
  function form() {
    var s = D.st, f = fields(), items = function (none) { return (none ? [{ v: -1, t: t('pv.none') }] : []).concat(f.map(function (n, i) { return { v: i, t: n }; })); };
    if (!f.length) return D.fld(t('pv.source'), D.input('pvRange', s.range, 'A1:D20'));
    ['row', 'row2', 'row3', 'col', 'val', 'val2', 'page'].forEach(function (k) { if (s[k] >= f.length) s[k] = k === 'row' || k === 'val' ? 0 : -1; });
    var two = s.col < 0, aggs = AGGS.map(function (a) { return { v: a, t: t('pv.a.' + a) }; });
    return D.fld(t('pv.source'), D.input('pvRange', s.range, 'A1:D20')) + D.fld(t('pv.rows'), D.sel('row', s.row, items(false)) + '<div class="af-gap"></div>' + D.sel('row2', s.row2, items(true)) + (s.row2 >= 0 ? '<div class="af-gap"></div>' + D.sel('row3', s.row3, items(true)) : ''))
      + D.fld(t('pv.cols'), D.sel('col', s.col, items(true))) + D.fld(t('pv.page'), D.sel('page', s.page, items(true)))
      + '<div class="df-two">' + D.fld(t('pv.values'), D.sel('val', s.val, items(false))) + D.fld(t('pv.agg'), D.sel('agg', s.agg, aggs)) + '</div>'
      + (two ? '<div class="df-two">' + D.fld(t('pv.values2'), D.sel('val2', s.val2, items(true))) + (s.val2 >= 0 ? D.fld(t('pv.agg'), D.sel('agg2', s.agg2, aggs)) : '<span></span>') + '</div>' : '') + D.fld(t('pv.filter'), D.sel('ftype', s.ftype, ['none', 'top', 'greaterThan', 'contains', 'equal', 'beginsWith'].map(function (x) { return { v: x, t: t('pv.f.' + x) }; })) + (s.ftype !== 'none' ? '<div class="af-gap"></div>' + D.input('pvFv', s.fval, '', s.ftype === 'top' || s.ftype === 'greaterThan' ? { num: 1 } : undefined) : ''))
      + '<p class="df-hint">' + t('pv.hint') + '</p>';
  }
  function draw() { var e = $('pvRange'); if (e) D.st.range = e.value; e = $('pvFv'); if (e) D.st.fval = e.value; D.show('pivot', t('pv.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'pv-make', label: t('pv.make') }]); D.change = function (id) { if (id === 'row2' || id === 'col' || id === 'ftype') draw(); }; }
  PV.open = function () {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh, q = guess(sh); D.st = { range: SheetSvc.ref(q.r1, q.c1) + ':' + SheetSvc.ref(q.r2, q.c2), row: 0, row2: -1, row3: -1, col: -1, page: -1, val: Math.min(1, q.c2 - q.c1), agg: 'sum', val2: -1, agg2: 'sum', ftype: 'none', fval: '' }; draw();
  };
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'pvRange') draw(); });

  // ---- the numbers -----------------------------------------------------------------------------------------------------------------
  function order(list, raw) { return list.slice().sort(function (a, b) { var x = raw[a], y = raw[b]; return typeof x === 'number' && typeof y === 'number' ? x - y : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }); }
  function agg(kind, xs) { var n = xs.filter(function (x) { return typeof x === 'number'; }), c = xs.length; if (kind === 'count') return c; if (!n.length) return null; var sum = n.reduce(function (a, b) { return a + b; }, 0); return kind === 'sum' ? sum : kind === 'average' ? sum / n.length : kind === 'max' ? Math.max.apply(null, n) : Math.min.apply(null, n); }
  // one record per source row: the text of its row fields, column field and page field, and its values
  function records(sh, q, rows, col, vals, page) {
    var out = [], raw = {}, r; for (r = q.r1 + 1; r <= q.r2 && out.length < MAXREC; r++) {
      var text = function (f) { return Fmt.cell(sh, r, q.c1 + f).t; }, ks = rows.map(text); if (ks.some(function (k) { return k === ''; })) continue; var ck = col >= 0 ? text(col) : ''; if (col >= 0 && ck === '') continue;
      rows.concat(col >= 0 ? [col] : [], page >= 0 ? [page] : []).forEach(function (f) { raw[f + ':' + text(f)] = Calc.value(sh, r, q.c1 + f); });
      out.push({ k: ks, c: ck, p: page >= 0 ? text(page) : '', v: vals.map(function (f) { var x = Calc.value(sh, r, q.c1 + f.field); return x === null || x === '' || (typeof x === 'object') ? null : x; }) });
    }
    return { recs: out, raw: raw };
  }
  function uniq(recs, get, field, raw) { var seen = {}, list = [], rw = {}; recs.forEach(function (x) { var k = get(x); if (k !== '' && !seen[k]) { seen[k] = 1; list.push(k); rw[k] = raw[field + ':' + k]; } }); return order(list, rw); }
  PV.build = function (sh, q, f, spec) {
    var rowsF = spec.rows, L = rowsF.length, col = spec.col, vals = spec.vals, d = records(sh, q, rowsF, col, vals, spec.page), recs = d.recs;
    if (!recs.length) throw new Error(t('pv.empty'));
    var flt = spec.filter && spec.filter.type !== 'none' ? spec.filter : null, allKeys = null;
    var items = rowsF.map(function (fi, l) { return uniq(recs, function (x) { return x.k[l]; }, fi, d.raw); }), cols = col >= 0 ? uniq(recs, function (x) { return x.c; }, col, d.raw) : [], pages = spec.page >= 0 ? uniq(recs, function (x) { return x.p; }, spec.page, d.raw) : [];
    var hidden = [], filterDef = null;
    if (flt) {   // a label or value filter on the first row field: members that fail it are hidden, and their rows leave every total
      var keep = {}, members = items[0], num = parseFloat(flt.value);
      if (['contains', 'equal', 'beginsWith'].indexOf(flt.type) >= 0) { var v = String(flt.value).toLowerCase(); members.forEach(function (m) { var l = m.toLowerCase(); if (flt.type === 'contains' ? l.indexOf(v) >= 0 : flt.type === 'equal' ? l === v : l.indexOf(v) === 0) keep[m] = 1; }); filterDef = { kind: 'label', field: rowsF[0], op: flt.type, value: String(flt.value) }; }
      else {
        if (isNaN(num)) throw new Error(t('pv.fbad')); var tot = members.map(function (m) { return { m: m, v: agg(vals[0].agg, recs.filter(function (x) { return x.k[0] === m; }).map(function (x) { return x.v[0]; }).filter(function (x) { return x !== null; })) }; });
        if (flt.type === 'top') tot.filter(function (x) { return x.v !== null; }).map(function (x, i) { return { m: x.m, v: x.v, i: i }; }).sort(function (a, b) { return b.v - a.v || a.i - b.i; }).slice(0, Math.max(1, Math.round(num))).forEach(function (x) { keep[x.m] = 1; }); else tot.forEach(function (x) { if (x.v !== null && x.v > num) keep[x.m] = 1; });
        filterDef = flt.type === 'top' ? { kind: 'value', field: rowsF[0], dataField: 0, op: 'top', count: Math.max(1, Math.round(num)) } : { kind: 'value', field: rowsF[0], dataField: 0, op: 'greaterThan', from: num };
      }
      members.forEach(function (m, i) { if (!keep[m]) hidden.push(i); }); recs = recs.filter(function (x) { return keep[x.k[0]]; }); if (!recs.length) throw new Error(t('pv.fnone'));
      if (L > 1) { var inner = items.slice(1); items = [items[0]].concat(inner); }
    }
    function pick(prefix, ck) { return recs.filter(function (x) { for (var i = 0; i < prefix.length; i++) if (x.k[i] !== prefix[i]) return false; return ck === null || x.c === ck; }); }
    function cells(prefix) { var sel; if (col >= 0) { var o = cols.map(function (ck) { return agg(vals[0].agg, pick(prefix, ck).map(function (x) { return x.v[0]; }).filter(function (x) { return x !== null; })); }); o.push(agg(vals[0].agg, pick(prefix, null).map(function (x) { return x.v[0]; }).filter(function (x) { return x !== null; }))); return o; } sel = pick(prefix, null); return vals.map(function (vs, i) { return agg(vs.agg, sel.map(function (x) { return x.v[i]; }).filter(function (x) { return x !== null; })); }); }
    var caps = vals.map(function (vs) { return CAP[vs.agg] + ' of ' + f[vs.field]; }), grid = [], lines = [], last = [];
    var head1 = [], head2 = [];
    if (col >= 0) { head1 = [caps[0]]; for (var i = 1; i < L; i++) head1.push(null); head1.push(L === 1 ? t('pv.collabels') : f[col]); cols.forEach(function () { head1.push(null); }); head1.push(null); head2 = rowsF.map(function (fi) { return f[fi]; }).concat(cols).concat([t('pv.total')]); if (L === 1) head2[0] = t('pv.rowlabels'); }
    else { head1 = L === 1 ? [t('pv.rowlabels')].concat(caps) : rowsF.map(function (fi) { return f[fi]; }).concat(caps); }
    var top = spec.page >= 0 ? 2 : 0; if (spec.page >= 0) { grid.push([f[spec.page], t('pv.all')]); grid.push([]); }
    grid.push(head1); if (col >= 0) grid.push(head2);
    var labelRow = function (path, lvl, isTotal) { var row = [], l; for (l = 0; l < L; l++) { if (isTotal) row.push(l === lvl ? path[l] + ' ' + t('pv.sub') : null); else row.push(path.slice(0, l + 1).join('\u0001') !== last[l] ? path[l] : null); } if (!isTotal) path.forEach(function (_, l) { last[l] = path.slice(0, l + 1).join('\u0001'); }); return row; };
    var rowLines = [];
    (function walk(prefix, lvl) {
      uniq(pick(prefix, null), function (x) { return x.k[lvl]; }, rowsF[lvl], d.raw).forEach(function (key) {
        var p = prefix.concat(key), mem = p.map(function (k, l) { return items[l].indexOf(k); });
        if (lvl === L - 1) { grid.push((L === 1 ? [key] : labelRow(p, lvl, false)).concat(cells(p))); rowLines.push({ t: 'data', members: mem }); }
        else { walk(p, lvl + 1); grid.push(labelRow(p, lvl, true).concat(cells(p))); rowLines.push({ t: 'default', members: mem.slice(0, lvl + 1) }); }
        if (lvl < L - 1) last.length = lvl + 1;
      });
    })([], 0);
    var tot = []; for (var l = 0; l < L; l++) tot.push(l === 0 ? t('pv.total') : null); grid.push(tot.concat(cells([])));
    var width = Math.max.apply(null, grid.map(function (r) { return r.length; })), area = { startRow: top, endRow: grid.length - 1, startColumn: 0, endColumn: width - 1 };
    var pivot = { rowFieldIndices: rowsF, rowItems: items[0], values: vals.map(function (vs, i) { return { fieldIndex: vs.field, agg: vs.agg, name: caps[i] }; }), location: area };
    if (filterDef) { pivot.filters = [filterDef]; pivot.rowHiddenItems = [hidden].concat(rowsF.slice(1).map(function () { return []; })); }
    if (L > 1) { pivot.rowLevelItems = items; pivot.rowLines = rowLines; } if (col >= 0) { pivot.columnFieldIndex = col; pivot.columnItems = cols; }
    if (spec.page >= 0) { pivot.pageFieldIndices = [spec.page]; pivot.pageLevelItems = [pages]; pivot.pageItems = [null]; }
    return { grid: grid, pivot: pivot };
  };

  A['pv-make'] = async function () {
    var e = $('pvRange'); if (e) D.st.range = e.value; var s = D.st, src = G.geo.sh, q = parse(s.range), f = fields(); if (!q || q.r2 <= q.r1 || q.c2 <= q.c1) return Ui.toast(t('pv.bad'));
    var rows = [+s.row].concat(s.row2 >= 0 ? [+s.row2] : [], s.row2 >= 0 && s.row3 >= 0 ? [+s.row3] : []), used = rows.concat(s.col >= 0 ? [+s.col] : [], s.page >= 0 ? [+s.page] : []);
    if (used.some(function (x, i) { return used.indexOf(x) !== i; })) return Ui.toast(t('pv.same'));
    var vals = [{ field: +s.val, agg: s.agg }]; if (s.col < 0 && s.val2 >= 0) vals.push({ field: +s.val2, agg: s.agg2 }); D.close();
    var name = 'Pivot', i = 1, used2 = Wb.sheets.map(function (x) { return x.name; }); while (used2.indexOf(name + i) >= 0) i++; name = name + i;
    try {
      var made = PV.build(src, q, f, { rows: rows, col: +s.col, vals: vals, page: +s.page, filter: { type: s.ftype, value: s.fval } });
      await Book.sheetPlan({ renames: [], additions: [{ name: name }], removals: [], order: used2.concat(name) }, name);
      var sh = Wb.byName(name);
      Wb.batch(function () { made.grid.forEach(function (row, r) { row.forEach(function (v, c) { if (v !== null && v !== undefined) Wb.setCell(sh, r, c, v, ''); }); }); });
      var pivot = Object.assign({ sheetName: name, sourceSheetName: src.name, sourceArea: { startRow: q.r1, endRow: q.r2, startColumn: q.c1, endColumn: q.c2 }, name: 'PivotTable' + i, fieldNames: f }, made.pivot);
      var out = await Book.flush({ pivots: [pivot] }); if (out) { await Xrich.load(out.slice(0)); } Book.touch(); G.mount(); Ui.toast(t('pv.done'));
    } catch (x) { App.fail('err.generic', x); }
  };

  // ---- refresh: read the pivot of this sheet from the file, calculate it again from its source and lay it out afresh -------------------------------
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function dom(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  async function readPivots(bytes, sheetIndex) {
    var z = Zipx.open(bytes), file = Xrich.sheets[sheetIndex] && Xrich.sheets[sheetIndex].file, out = []; if (!file) return out;
    var rels = await Xrich.rels(z, file), targets = Object.keys(rels).map(function (k) { return Xrich.norm(file, rels[k]); }).filter(function (p) { return /pivotTables\/pivotTable\d*\.xml$/.test(p); });
    for (var i = 0; i < targets.length; i++) {
      var d = dom(await z.text(targets[i])), def = d.documentElement, prel = await Xrich.rels(z, targets[i]), cachePath = Object.keys(prel).map(function (k) { return Xrich.norm(targets[i], prel[k]); }).filter(function (p) { return /pivotCacheDefinition/.test(p); })[0];
      if (!cachePath) continue; var cd = dom(await z.text(cachePath)), src = all(cd, 'worksheetSource')[0];
      out.push({ name: def.getAttribute('name'), cachePath: cachePath, def: d, cache: cd, src: src ? { sheet: src.getAttribute('sheet'), ref: src.getAttribute('ref'), name: src.getAttribute('name') } : null });
    }
    return out;
  }
  function fieldIdx(parent, tag, child) { var p = all(parent, tag)[0]; return p ? all(p, child).map(function (f) { return +f.getAttribute('x'); }).filter(function (x) { return x >= 0; }) : []; }
  PV.refresh = async function () {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh, si = Wb.sheets.indexOf(sh);
    try {
      var bytes = await Book.bytes(), list = await readPivots(bytes.slice(0), si); if (!list.length) return Ui.toast(t('pv.nopivot'));
      var updates = [], edits = [];
      for (var i = 0; i < list.length; i++) {
        var p = list[i], def = p.def.documentElement, why = null;
        if (!p.src || !p.src.ref || !p.src.sheet) why = 'src'; else if (all(p.cache, 'fieldGroup').length || all(def, 'filters').length || all(def, 'calculatedItem').length) why = 'adv';
        var rowsF = fieldIdx(def, 'rowFields', 'field'), colsF = fieldIdx(def, 'colFields', 'field'), pagesF = fieldIdx(def, 'pageFields', 'pageField'), pg = all(def, 'pageField').map(function (x) { return +x.getAttribute('fld'); }), data = all(all(def, 'dataFields')[0], 'dataField');
        if (!why && (rowsF.length < 1 || rowsF.length > 3 || colsF.length > 1 || pg.length > 1 || data.length < 1 || data.length > 2 || (colsF.length && data.length > 1) || data.some(function (x) { return x.getAttribute('showDataAs') && x.getAttribute('showDataAs') !== 'normal'; }))) why = 'adv';
        if (why) { Ui.toast(t('pv.norefresh', { n: p.name })); continue; }
        var srcSheet = Wb.byName(p.src.sheet), q = parse(p.src.ref); if (!srcSheet || !q) { Ui.toast(t('pv.norefresh', { n: p.name })); continue; }
        var f = names(srcSheet, q), map = { sum: 'sum', count: 'count', average: 'average', max: 'max', min: 'min' };
        var vals = data.map(function (x) { var st = x.getAttribute('subtotal') || 'sum'; return { field: +x.getAttribute('fld'), agg: map[st] || 'sum' }; });
        var made = PV.build(srcSheet, q, f, { rows: rowsF, col: colsF.length ? colsF[0] : -1, vals: vals, page: pg.length ? pg[0] : -1 });
        var loc = all(def, 'location')[0].getAttribute('ref'), old = parse(loc), area = made.pivot.location;
        // the old cells are cleared, then the new table is written where the pivot starts
        var top = old.r1 - (pg.length ? 2 : 0); Wb.batch(function () {
          for (var r = Math.max(0, top); r <= old.r2; r++) for (var c = old.c1; c <= old.c2; c++) Wb.setCell(sh, r, c, null, '');
          made.grid.forEach(function (row, r) { row.forEach(function (v, c) { if (v !== null && v !== undefined) Wb.setCell(sh, Math.max(0, top) + r, old.c1 + c, v, ''); }); });
        });
        var shift = Math.max(0, top), loc2 = { startRow: area.startRow + shift, endRow: area.endRow + shift, startColumn: old.c1 + area.startColumn, endColumn: old.c1 + area.endColumn };
        var re = Object.assign({ sheetName: sh.name, sourceSheetName: srcSheet.name, sourceArea: { startRow: q.r1, endRow: q.r2, startColumn: q.c1, endColumn: q.c2 }, name: p.name, fieldNames: f }, made.pivot, { location: loc2 });
        updates.push({ cachePath: p.cachePath, sheetName: sh.name, newOutputRef: SheetSvc.ref(loc2.startRow, loc2.startColumn) + ':' + SheetSvc.ref(loc2.endRow, loc2.endColumn), relayout: re });
      }
      if (!updates.length) return; var out = await Book.flush({ pivotUpdates: updates }); if (out) await Xrich.load(out.slice(0)); Book.touch(); G.mount(); Ui.toast(t('pv.refreshed'));
    } catch (x) { App.fail('err.generic', x); }
  };
  if (window.Menus) Menus.add('data', function () { return [{ t: t('pv.refresh'), off: Wb.readOnly, go: PV.refresh }]; });
  if (window.Menus) Menus.add('insert', function () { return [{ t: t('pv.title') + '…', off: Wb.readOnly, go: PV.open }]; });
})();
