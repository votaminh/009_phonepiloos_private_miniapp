// Struct — sorting and filtering a block of cells, and managing the sheets (add, rename, copy, hide, move, delete).
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, SF = { col: 0, dir: 'asc', header: true, op: 'gt', val: '' };
  var S = window.Struct = {};

  // the block sorted and filtered: the selection, or the used area when one cell is selected
  function range() {
    var s = Grid.sel, sh = Grid.geo.sh;
    if (s.r1 === s.r2 && s.c1 === s.c2) return { r1: 0, c1: 0, r2: Math.max(0, sh.rows - 1), c2: Math.max(0, sh.cols - 1) };
    return { r1: s.r1, c1: s.c1, r2: s.whole === 'col' ? Math.max(0, sh.rows - 1) : s.r2, c2: s.whole === 'row' ? Math.max(0, sh.cols - 1) : s.c2 };
  }
  function colName() {
    var sh = Grid.geo.sh, r = range(), h = SF.header ? Fmt.text(Calc.value(sh, r.r1, SF.col)) : '';
    return SheetSvc.col(SF.col) + (h ? ' · ' + h : '');
  }
  function state() { var r = range(); return { label: SheetSvc.ref(r.r1, r.c1) + ':' + SheetSvc.ref(r.r2, r.c2), colName: colName(), dir: SF.dir, header: SF.header, op: SF.op, val: SF.val }; }
  function show() { SheetsView.show('sf', SheetsView.sortfilter(state())); }
  A['sf-open'] = function () { var s = Grid.sel, r = range(); SF.col = Math.max(r.c1, Math.min(s.c1, r.c2)); SF.val = ''; Ui.closeSheet(); show(); };
  A['sf-col'] = function () { var r = range(); SF.col = SF.col + 1 > r.c2 ? r.c1 : SF.col + 1; show(); };
  A['sf-hdr'] = function () { SF.header = !SF.header; show(); };
  A['sf-op'] = function (el) { SF.op = el.dataset.k; var v = $('sfVal'); if (v) SF.val = v.value; show(); };

  function sortRows(dir) {
    SF.dir = dir; var sh = Grid.geo.sh, r = range(), first = r.r1 + (SF.header ? 1 : 0), rows = [], i, c, conv = 0;
    for (i = first; i <= r.r2; i++) {
      var cells = []; for (c = r.c1; c <= r.c2; c++) { var cell = sh.cells[SheetSvc.ref(i, c)]; cells.push({ v: cell ? (cell.f ? Calc.value(sh, i, c) : cell.v) : null, st: Wb.style(sh, i, c) }); if (cell && cell.f) conv++; }
      rows.push({ key: Calc.value(sh, i, SF.col), cells: cells, n: i });
    }
    rows.sort(function (a, b) {
      var x = a.key, y = b.key, bx = x === null || x === '', by = y === null || y === '';
      if (bx || by) return bx === by ? a.n - b.n : bx ? 1 : -1;
      var d = Calc.cmp(x, y); return d ? (dir === 'asc' ? d : -d) : a.n - b.n;
    });
    Wb.batch(function () { rows.forEach(function (row, k) { row.cells.forEach(function (cell, j) {
      var rr = first + k, cc = r.c1 + j, v = cell.v && typeof cell.v === 'object' ? null : cell.v;
      Wb.setCell(sh, rr, cc, v, '');
      var now = Wb.style(sh, rr, cc), patch = {}, same = true; Object.keys(cell.st).concat(Object.keys(now)).forEach(function (key) { if (JSON.stringify(cell.st[key]) !== JSON.stringify(now[key])) { patch[key] = cell.st[key] === undefined ? null : cell.st[key]; same = false; } });
      if (!same) Wb.setStyle(sh, { r1: rr, c1: cc, r2: rr, c2: cc }, patch);
    }); }); });
    Grid.changed(); show(); Ui.toast(t(conv ? 'sf.sorted.f' : 'sf.sorted'));
  }
  A['sf-asc'] = function () { sortRows('asc'); }; A['sf-desc'] = function () { sortRows('desc'); };

  // ---- filter: rows that do not match are hidden (the file stores them as hidden rows) -------------------------------------------
  function hideOps(sh, rows, on) {
    var i = 0; while (i < rows.length) { var j = i; while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++; sh.ops.push({ kind: 'set-rows-hidden', start: rows[i], end: rows[j], hidden: on }); i = j + 1; }
  }
  function clear(sh) { if (sh.filter) { sh.filter.rows.forEach(function (r) { delete sh.hidR[r]; }); hideOps(sh, sh.filter.rows, false); sh.filter = null; } }
  function matches(v, st) {
    var q = SF.val, blank = v === null || v === '', s = Fmt.text(v, st.nf);
    if (SF.op === 'blank') return blank;
    var a = Number(q), numeric = q !== '' && !isNaN(a) && typeof v === 'number';
    switch (SF.op) {
      case 'gt': return numeric ? v > a : false; case 'lt': return numeric ? v < a : false;
      case 'eq': return numeric ? v === a : s.toLowerCase() === q.toLowerCase(); case 'ne': return numeric ? v !== a : s.toLowerCase() !== q.toLowerCase();
      case 'ct': return s.toLowerCase().indexOf(q.toLowerCase()) >= 0;
    }
    return true;
  }
  A['sf-apply'] = function () {
    var v = $('sfVal'); if (v) SF.val = v.value;
    var sh = Grid.geo.sh, r = range(), first = r.r1 + (SF.header ? 1 : 0), hidden = [], i;
    clear(sh);
    if (SF.op === 'blank' || SF.val !== '') for (i = first; i <= r.r2; i++) if (!matches(Calc.value(sh, i, SF.col), Wb.style(sh, i, SF.col))) hidden.push(i);
    hidden.forEach(function (x) { sh.hidR[x] = 1; }); hideOps(sh, hidden, true);
    if (hidden.length) sh.filter = { col: SF.col, rows: hidden };
    Ui.closeSheet(); Grid.mount(); Book.touch(); Ui.toast(t('sf.hidden', { n: hidden.length }));
  };
  A['sf-clear'] = function () { var sh = Grid.geo.sh; clear(sh); SF.val = ''; Grid.mount(); Book.touch(); show(); };

  // ---- sheets -----------------------------------------------------------------------------------------------------------------
  function names() { return Wb.sheets.map(function (s) { return s.name; }); }
  function open() { Ui.closeSheet(); SheetsView.show('sheets', SheetsView.sheetsList(Wb.sheets.map(function (s) { return { name: s.name, hiddenSheet: s.hiddenSheet, rows: s.rows, cols: s.cols }; }), Wb.on)); }
  function fresh(base) { var n = names(), i = 1, name = base; while (n.indexOf(name) >= 0) name = base + ' ' + (++i); return name; }
  async function plan(p, focus) { try { Ui.closeSheet(); await Book.sheetPlan(p, focus); } catch (e) { App.fail('err.generic', e); } }
  A['sh-open'] = open;
  A['sh-go'] = function (el) { Ui.closeSheet(); Book.show(+el.dataset.i); };
  A['b-sheet'] = function (el) { Book.show(+el.dataset.i); };
  A['sh-add'] = function () { var name = fresh(t('sh.new')); plan({ renames: [], additions: [{ name: name }], removals: [], order: names().concat(name) }, name); };
  A['sh-more'] = function (el) { var i = +el.dataset.i; Ui.sheet('shmenu', SheetsView.sheetMenu(Wb.sheets[i], i, i === Wb.sheets.length - 1)); };
  A['sh-dup'] = function (el) {
    var i = +el.dataset.i, src = Wb.sheets[i].name, name = fresh(src + ' (2)'), order = names(); order.splice(i + 1, 0, name);
    plan({ renames: [], additions: [{ name: name, sourceSheetName: src }], removals: [], order: order }, name);
  };
  A['sh-hide'] = function (el) {
    var i = +el.dataset.i, s = Wb.sheets[i], vis = Wb.sheets.filter(function (x) { return !x.hiddenSheet; }).length;
    if (!s.hiddenSheet && vis < 2) return Ui.toast(t('sh.lastvis'));
    plan({ renames: [], additions: [], removals: [], order: names(), hiddenChanges: [{ sheetName: s.name, hidden: !s.hiddenSheet }] }, Wb.sheets[Wb.on].name);
  };
  function move(i, d) { var o = names(), n = o.splice(i, 1)[0]; o.splice(i + d, 0, n); plan({ renames: [], additions: [], removals: [], order: o, orderChanged: true }, Wb.sheets[Wb.on].name); }
  A['sh-left'] = function (el) { move(+el.dataset.i, -1); }; A['sh-right'] = function (el) { move(+el.dataset.i, 1); };
  A['sh-del'] = function (el) {
    var i = +el.dataset.i, s = Wb.sheets[i]; Ui.closeSheet();
    if (Wb.sheets.length < 2) return Ui.toast(t('sh.lastone'));
    Ui.dialog(t('sh.deltitle', { n: s.name }), t('sh.delbody'), t('sh.del'), function () { plan({ renames: [], additions: [], removals: [s.name], order: names().filter(function (x) { return x !== s.name; }) }, Wb.sheets[Wb.on === i ? 0 : Wb.on].name); }, true);
  };
  var renaming = -1;
  A['sh-rename'] = function (el) { renaming = +el.dataset.i; Ui.sheet('rename', SheetsView.rename(Wb.sheets[renaming].name)); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); };
  A['rn-apply'] = function () {
    var v = ($('rnName').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad'));
    if (renaming >= 0) {
      if (v.length > 31 || /[\[\]]/.test(v)) return Ui.toast(t('sh.badname'));
      if (names().some(function (n, i) { return i !== renaming && n.toLowerCase() === v.toLowerCase(); })) return Ui.toast(t('sh.dupname'));
      var old = Wb.sheets[renaming].name, o = names(); o[renaming] = v; renaming = -1; plan({ renames: [{ sheetName: old, newName: v }], additions: [], removals: [], order: o }, Wb.sheets[Wb.on].name === old ? v : Wb.sheets[Wb.on].name);
    } else Menu.rename(v);
  };
  S.startFileRename = function () { renaming = -1; };
})();
