// Tbl — Excel tables (Insert > Table): a block with a header row, a name and a colour style. It is drawn here with a bold coloured header and banded rows, and written into the file at Save
// (header names become the column names; the table carries its own filter arrows in Excel). Tables already in a file are read and drawn the same way; they cannot be edited here.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, T = window.Tbl = {};
  var STYLES = [['TableStyleMedium2', 'blue'], ['TableStyleMedium3', 'orange'], ['TableStyleMedium4', 'gray'], ['TableStyleMedium5', 'gold'], ['TableStyleMedium7', 'green'], ['TableStyleLight1', 'plain']];
  function look(name) { var m = /TableStyle(Light|Medium|Dark)(\d+)/.exec(name || ''); if (!m) return 'blue'; if (m[1] === 'Light' && m[2] === '1') return 'plain'; var k = { 2: 'blue', 3: 'orange', 4: 'gray', 5: 'gold', 6: 'blue', 7: 'green' }[m[2]]; return k || 'blue'; }
  function areas(sh) { return sh._tb || (sh._tb = sh.tables.map(function (x) { var p = x.ref.split(':'), a = SheetSvc.addr(p[0]), b = SheetSvc.addr(p[1] || p[0]); return a && b ? { r1: a.r, c1: a.c, r2: b.r, c2: b.c, look: look(x.style), banded: x.banded, totals: x.totals, t: x } : null; }).filter(Boolean)); }
  // the classes a cell gets when it lies in a table
  T.cls = function (sh, r, c) {
    if (!sh.tables.length) return ''; var l = areas(sh), i, a;
    for (i = 0; i < l.length; i++) { a = l[i]; if (r >= a.r1 && r <= a.r2 && c >= a.c1 && c <= a.c2) return r === a.r1 ? ' tbh tb-' + a.look : a.totals && r === a.r2 ? ' tbt tb-' + a.look : a.banded && (r - a.r1) % 2 === 0 ? ' tbb tb-' + a.look : ' tbd'; }
    return '';
  };
  T.at = function (sh, r, c) { var l = areas(sh); for (var i = 0; i < l.length; i++) if (r >= l[i].r1 && r <= l[i].r2 && c >= l[i].c1 && c <= l[i].c2) return l[i].t; return null; };

  function ref(a) { return SheetSvc.ref(a.r1, a.c1) + ':' + SheetSvc.ref(a.r2, a.c2); }
  function guess() {
    var s = G.sel, sh = G.geo.sh; if (s.r1 !== s.r2 || s.c1 !== s.c2) return { r1: s.r1, c1: s.c1, r2: Math.max(s.r2, s.r1 + 1), c2: s.c2 };
    var r1 = s.r1, c1 = s.c1, r2 = s.r1, c2 = s.c1, has = function (r, c) { return !!sh.cells[SheetSvc.ref(r, c)]; }, grow = true, r, c;
    while (grow) { grow = false;
      for (c = c1 - 1; c <= c2 + 1 && !grow; c++) if (c >= 0 && (c < c1 || c > c2)) for (r = r1; r <= r2; r++) if (has(r, c)) { if (c < c1) c1 = c; else c2 = c; grow = true; break; }
      for (r = r1 - 1; r <= r2 + 1 && !grow; r++) if (r >= 0 && (r < r1 || r > r2)) for (c = c1; c <= c2; c++) if (has(r, c)) { if (r < r1) r1 = r; else r2 = r; grow = true; break; } }
    return { r1: r1, c1: c1, r2: Math.max(r2, r1 + 1), c2: c2 };
  }
  function nextName() { var n = 1, used = {}; Wb.sheets.forEach(function (sh) { sh.tables.forEach(function (x) { used[x.name.toLowerCase()] = 1; }); }); while (used['table' + n]) n++; return 'Table' + n; }
  function form() {
    var s = D.st; return D.fld(t('tbl.range'), D.input('tbRange', s.range, 'A1:D10')) + D.fld(t('tbl.name'), D.input('tbName', s.name, 'Table1'))
      + D.fld(t('tbl.style'), D.sel('style', s.style, STYLES.map(function (x) { return { v: x[0], t: t('tbl.s.' + x[1]) }; }))) + '<div class="df-tg">' + D.tgl('band', t('tbl.band'), s.band) + '</div><p class="df-hint">' + t('tbl.hint') + '</p>';
  }
  T.open = function () {
    if (Wb.readOnly || !G.geo) return; var a = guess(); D.st = { range: ref(a), name: nextName(), style: 'TableStyleMedium2', band: true };
    D.show('table', t('tbl.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'tb-save', label: t('tbl.create') }]);
  };
  A['tb-save'] = function () {
    var sh = G.geo.sh, s = D.st, rng = D.val('tbRange').trim().toUpperCase().replace(/\$/g, ''), name = D.val('tbName').trim(), m = /^([A-Z]{1,3}\d+):([A-Z]{1,3}\d+)$/.exec(rng);
    if (!m) return Ui.toast(t('dv.bad')); var a = SheetSvc.addr(m[1]), b = SheetSvc.addr(m[2]); if (b.r <= a.r) return Ui.toast(t('tbl.small'));
    if (!/^[A-Za-z_\\][A-Za-z0-9_.]*$/.test(name) || /^[A-Za-z]{1,3}\d+$/.test(name) || /^[rRcC]$/.test(name)) return Ui.toast(t('tbl.badname'));
    var used = false; Wb.sheets.forEach(function (x) { x.tables.forEach(function (y) { if (y.name.toLowerCase() === name.toLowerCase()) used = true; }); }); if (used) return Ui.toast(t('tbl.taken'));
    var box = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
    if (areas(sh).some(function (x) { return box.r1 <= x.r2 && box.r2 >= x.r1 && box.c1 <= x.c2 && box.c2 >= x.c1; })) return Ui.toast(t('tbl.overlap'));
    if (sh.af && box.r1 <= sh.af.r2 && box.r2 >= sh.af.r1 && box.c1 <= sh.af.c2 && box.c2 >= sh.af.c1) return Ui.toast(t('tbl.filter'));
    var names = [], seen = {}, c;
    for (c = box.c1; c <= box.c2; c++) { var h = String(Fmt.cell(sh, box.r1, c).t || '').trim() || 'Column' + (c - box.c1 + 1), base = h, k = 1; while (seen[h.toLowerCase()]) h = base + (++k); seen[h.toLowerCase()] = 1; names.push(h); }
    Wb.batch(function () { names.forEach(function (n, i) { var cell = sh.cells[SheetSvc.ref(box.r1, box.c1 + i)]; if (!cell || cell.f || String(cell.v) !== n) Wb.setCell(sh, box.r1, box.c1 + i, n, ''); }); });
    var wire = { sheetName: sh.name, area: { startRow: box.r1, endRow: box.r2, startColumn: box.c1, endColumn: box.c2 }, name: name, columnNames: names, style: s.style, bandedRows: !!s.band };
    sh.tables.push({ name: name, ref: rng, style: s.style, banded: !!s.band, totals: false }); sh._tb = null; (sh.tablesNew = sh.tablesNew || []).push({ wire: wire });
    D.close(); Book.touch(); G.paint(); Ui.toast(t('tbl.done'));
  };

  // ---- a table that is already there: name, size, style, rows and columns of the style, or back to a plain range ---------------------
  function find(sh) { var a = G.act(), x = T.at(sh, a.r, a.c); return x; }
  function editForm() {
    var s = D.st; return D.fld(t('tbl.range'), D.input('tbRange', s.range, 'A1:D10')) + D.fld(t('tbl.name'), D.input('tbName', s.name, 'Table1')) + D.fld(t('tbl.style'), D.sel('style', s.style, STYLES.map(function (x) { return { v: x[0], t: t('tbl.s.' + x[1]) }; }).concat(STYLES.some(function (x) { return x[0] === s.style; }) ? [] : [{ v: s.style, t: s.style }])))
      + '<div class="df-tg">' + D.tgl('header', t('tbl.o.header'), s.header) + D.tgl('totals', t('tbl.o.totals'), s.totals) + D.tgl('band', t('tbl.band'), s.band) + D.tgl('bcols', t('tbl.o.bcols'), s.bcols) + D.tgl('first', t('tbl.o.first'), s.first) + D.tgl('last', t('tbl.o.last'), s.last) + D.tgl('filt', t('tbl.o.filter'), s.filt) + '</div>';
  }
  T.props = function () {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh, x = find(sh); if (!x) return Ui.toast(t('tbl.none'));
    D.st = { range: x.ref, name: x.name, style: x.style || 'TableStyleMedium2', band: !!x.banded, totals: !!x.totals, header: x.header !== false, bcols: !!x.bcols, first: !!x.first, last: !!x.last, filt: x.filter !== false, was: x };
    D.show('tprops', t('tbl.props'), editForm(), [{ act: 'tb-unlist', label: t('tbl.unlist'), kind: 'ghost' }, { act: 'tb-update', label: t('a.apply') }]);
  };
  function pending(sh, name) { return (sh.tablesNew || []).filter(function (n) { return n.wire.name.toLowerCase() === name.toLowerCase(); })[0]; }
  A['tb-update'] = function () {
    var sh = G.geo.sh, s = D.st, x = s.was, rng = D.val('tbRange').trim().toUpperCase().replace(/\$/g, ''), name = D.val('tbName').trim(), m = /^([A-Z]{1,3}\d+):([A-Z]{1,3}\d+)$/.exec(rng);
    if (!m) return Ui.toast(t('dv.bad')); var a = SheetSvc.addr(m[1]), b = SheetSvc.addr(m[2]); if (b.r <= a.r) return Ui.toast(t('tbl.small'));
    if (!/^[A-Za-z_\\][A-Za-z0-9_.]*$/.test(name) || /^[A-Za-z]{1,3}\d+$/.test(name)) return Ui.toast(t('tbl.badname'));
    var taken = false; Wb.sheets.forEach(function (y) { y.tables.forEach(function (z) { if (z !== x && z.name.toLowerCase() === name.toLowerCase()) taken = true; }); }); if (taken) return Ui.toast(t('tbl.taken'));
    var box = { r1: a.r, c1: a.c, r2: b.r, c2: b.c }, others = areas(sh).filter(function (o) { return o.t !== x; });
    if (others.some(function (o) { return box.r1 <= o.r2 && box.r2 >= o.r1 && box.c1 <= o.c2 && box.c2 >= o.c1; })) return Ui.toast(t('tbl.overlap'));
    var was = x.ref.split(':'), wa = SheetSvc.addr(was[0]), wb = SheetSvc.addr(was[1] || was[0]), grew = s.totals && !x.totals && box.r2 === wb.r;
    if (grew) { box.r2++; }
    var names = [], seen = {}, c;
    for (c = box.c1; c <= box.c2; c++) { var h = String(Fmt.cell(sh, box.r1, c).t || '').trim() || 'Column' + (c - box.c1 + 1), base = h, k = 1; while (seen[h.toLowerCase()]) h = base + (++k); seen[h.toLowerCase()] = 1; names.push(h); }
    if (grew) Wb.batch(function () { for (var q = box.c1; q <= box.c2; q++) { var col = SheetSvc.col(q), num = false, r; for (r = box.r1 + 1; r < box.r2; r++) if (typeof Calc.value(sh, r, q) === 'number') num = true; if (q === box.c1) Wb.setCell(sh, box.r2, q, t('tbl.total'), ''); else if (num) Wb.setCell(sh, box.r2, q, null, 'SUBTOTAL(109,' + col + (box.r1 + 2) + ':' + col + box.r2 + ')'); } });
    var edit = { sheetName: sh.name, tableName: x.name, name: name, area: { startRow: box.r1, endRow: box.r2, startColumn: box.c1, endColumn: box.c2 }, columnNames: names, style: s.style, bandedRows: !!s.band, headerRow: !!s.header, totalsRow: !!s.totals, firstColumn: !!s.first, lastColumn: !!s.last, bandedColumns: !!s.bcols, filterButton: !!s.filt }, np = pending(sh, x.name);
    if (np) { Object.assign(np.wire, { name: name, area: edit.area, columnNames: names, style: s.style, bandedRows: !!s.band }); } else (sh.tableEdits = sh.tableEdits || []).push(edit);
    x.name = name; x.ref = SheetSvc.ref(box.r1, box.c1) + ':' + SheetSvc.ref(box.r2, box.c2); x.style = s.style; x.banded = !!s.band; x.totals = !!s.totals; x.header = !!s.header; x.bcols = !!s.bcols; x.first = !!s.first; x.last = !!s.last; x.filter = !!s.filt; sh._tb = null;
    D.close(); Book.touch(); G.paint(); Ui.toast(t('tbl.updated'));
  };
  A['tb-unlist'] = function () {
    var sh = G.geo.sh, x = D.st.was, np = pending(sh, x.name); if (np) sh.tablesNew.splice(sh.tablesNew.indexOf(np), 1); else (sh.tableEdits = sh.tableEdits || []).push({ sheetName: sh.name, tableName: x.name, remove: true });
    sh.tables.splice(sh.tables.indexOf(x), 1); sh._tb = null; D.close(); Book.touch(); G.paint(); Ui.toast(t('tbl.unlisted'));
  };
  if (window.Menus) Menus.add('insert', function () { var inT = G.geo && find(G.geo.sh); return [{ t: t('tbl.title') + '…', off: Wb.readOnly, go: T.open }, { t: t('tbl.props') + '…', off: Wb.readOnly || !inT, go: T.props }]; });
})();
