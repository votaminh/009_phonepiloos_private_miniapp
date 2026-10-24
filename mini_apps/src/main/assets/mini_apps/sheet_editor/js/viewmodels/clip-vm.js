// Clip — what is typed into a cell (numbers, percents, dates, formulas), copy / cut / paste, the automatic sum and the numbers shown under a selected range.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, G = window.Grid, EPOCH = Date.UTC(1899, 11, 30), mem = null;
  var Clip = window.Clip = {};

  function serial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000); }
  // the text typed into the formula bar -> { v, f, nf }
  Clip.parse = function (text, st) {
    if (text === '') return { v: null };
    if (text[0] === '=' && text.length > 1) return { f: text };
    if (text[0] === "'") return { v: text.slice(1) };
    if (st && st.nf === '@') return { v: text };
    var s = text.trim(), m;
    if (/^(true|false)$/i.test(s)) return { v: s.toUpperCase() === 'TRUE' };
    if (/^[-+]?\d+([.,]\d+)?$/.test(s) && s.length < 16) return { v: Number(s.replace(',', '.')) };
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { v: Number(s.replace(/,/g, '')) };
    if ((m = /^([-+]?\d+(?:[.,]\d+)?)%$/.exec(s))) return { v: Number(m[1].replace(',', '.')) / 100, nf: st && st.nf ? undefined : '0.##%' };
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s)) && +m[2] <= 12 && +m[1] <= 31) return { v: serial(+m[3], +m[2], +m[1]), nf: st && st.nf ? undefined : 'dd/mm/yyyy' };
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)) && +m[2] <= 12) return { v: serial(+m[1], +m[2], +m[3]), nf: st && st.nf ? undefined : 'dd/mm/yyyy' };
    return { v: text };
  };
  // formula text moved by (dr, dc): relative references follow, $ ones stay
  function shift(f, dr, dc) {
    return f.replace(/(^|[^A-Za-z0-9_'!.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, function (all, pre, ca, col, ra, row) {
      var c = ca ? col : SheetSvc.col(CalcParse.colNum(col) + dc), r = ra ? +row : +row + dr;
      return pre + ca + (CalcParse.colNum(c) < 0 || r < 1 ? '#REF!' : c) + ra + (r < 1 ? '' : r);
    });
  }

  function copy(cut) {
    var s = G.sel, sh = G.geo.sh, r2 = s.whole === 'col' ? Math.max(sh.rows - 1, 0) : s.r2, c2 = s.whole === 'row' ? Math.max(sh.cols - 1, 0) : s.c2, rows = [], tsv = [], r, c;
    for (r = s.r1; r <= r2; r++) {
      var row = [], line = [];
      for (c = s.c1; c <= c2; c++) { var cell = sh.cells[SheetSvc.ref(r, c)]; row.push({ v: cell ? cell.v : null, f: cell && cell.f || '', st: Object.assign({}, sh.ov[SheetSvc.ref(r, c)] || {}) }); line.push(Fmt.cell(sh, r, c).t); }
      rows.push(row); tsv.push(line.join('\t'));
    }
    mem = { rows: rows, r: s.r1, c: s.c1, text: tsv.join('\n') };
    try { if (navigator.clipboard) navigator.clipboard.writeText(mem.text).catch(function () {}); } catch (e) { /* the page's own clipboard still works */ }
    if (cut) { Wb.batch(function () { for (r = s.r1; r <= r2; r++) for (c = s.c1; c <= c2; c++) Wb.setCell(sh, r, c, null, ''); }); G.changed(); }
    Ui.toast(t(cut ? 'q.cutd' : 'q.copied'));
  }
  async function paste() {
    var s = G.sel, sh = G.geo.sh, src = mem;
    if (!src) { try { var tx = await navigator.clipboard.readText(); if (tx) src = { rows: tx.split(/\r?\n/).filter(function (l, i, a) { return l !== '' || i < a.length - 1; }).map(function (l) { return l.split('\t').map(function (x) { var p = Clip.parse(x, null); return { v: p.v === undefined ? null : p.v, f: p.f || '', st: p.nf ? { nf: p.nf } : {} }; }); }), r: 0, c: 0 }; } catch (e) { /* no access to the system clipboard */ } }
    if (!src) return Ui.toast(t('q.empty'));
    Wb.batch(function () {
      src.rows.forEach(function (row, i) { row.forEach(function (x, j) {
        var r = s.r1 + i, c = s.c1 + j; if (r >= 1048576 || c >= 16384) return;
        Wb.setCell(sh, r, c, x.v, x.f ? shift(x.f, r - src.r - i, c - src.c - j) : '');
        Wb.setStyle(sh, { r1: r, c1: c, r2: r, c2: c }, Object.assign({}, x.st));
      }); });
    });
    G.select(s.r1, s.c1, s.r1 + src.rows.length - 1, s.c1 + src.rows[0].length - 1); G.changed();
  }
  A['q-copy'] = function () { copy(false); G.qk = false; G.place(); };
  A['q-cut'] = function () { copy(true); G.qk = false; G.place(); };
  A['q-paste'] = function () { G.qk = false; paste(); };
  A['q-more'] = function () { Ui.sheet('qmore', SheetsView.more()); };

  // ∑: a range of numbers gets its total under it (or beside it); one cell looks for the numbers above, then to the left
  A['q-sum'] = function () {
    var s = G.sel, sh = G.geo.sh, w = s.c2 - s.c1 + 1, h = s.r2 - s.r1 + 1, c, r;
    function ref(a, b, c1, c2) { return SheetSvc.ref(a, c1) + ':' + SheetSvc.ref(b, c2); }
    function numeric(r, c) { return typeof Calc.value(sh, r, c) === 'number'; }
    Wb.batch(function () {
      if (w * h > 1) {
        if (h > 1 || w === 1) for (c = s.c1; c <= s.c2; c++) Wb.setCell(sh, s.r2 + 1, c, null, '=SUM(' + ref(s.r1, s.r2, c, c) + ')');
        else Wb.setCell(sh, s.r1, s.c2 + 1, null, '=SUM(' + ref(s.r1, s.r1, s.c1, s.c2) + ')');
      } else {
        for (r = s.r1 - 1; r >= 0 && numeric(r, s.c1); r--);
        if (r < s.r1 - 1) Wb.setCell(sh, s.r1, s.c1, null, '=SUM(' + ref(r + 1, s.r1 - 1, s.c1, s.c1) + ')');
        else { for (c = s.c1 - 1; c >= 0 && numeric(s.r1, c); c--); Wb.setCell(sh, s.r1, s.c1, null, c < s.c1 - 1 ? '=SUM(' + ref(s.r1, s.r1, c + 1, s.c1 - 1) + ')' : '=SUM()'); }
      }
    });
    G.qk = false; G.changed();
  };

  // Sum / Avg / Min / Max / Count of the numbers in the selection: a floating pill that fades in; a number that changes fades across
  Clip.stats = function () {
    var el = $('bookStats'), s = G.sel, sh = G.geo.sh; if (!el) return;
    if (s.r1 === s.r2 && s.c1 === s.c2) { el.classList.remove('on'); return; }
    var n = [], r, c, r2 = s.whole === 'col' ? Math.min(s.r2, sh.rows) : s.r2, c2 = s.whole === 'row' ? Math.min(s.c2, sh.cols) : s.c2;
    for (r = s.r1; r <= r2 && n.length < 200000; r++) for (c = s.c1; c <= c2; c++) { var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell) continue; var v = Calc.value(sh, r, c); if (typeof v === 'number') n.push(v); }
    if (!n.length) { el.classList.remove('on'); return; }
    var sum = n.reduce(function (a, b) { return a + b; }, 0), f = function (x) { return String(+x.toFixed(4)); };
    var vals = [f(sum), f(sum / n.length), f(Math.min.apply(null, n)), f(Math.max.apply(null, n)), String(n.length)], spans = el.children;
    if (spans.length !== 5 || el.dataset.l !== I18n.locale()) { el.innerHTML = GridView.stats({ sum: vals[0], avg: vals[1], min: vals[2], max: vals[3], count: vals[4] }); el.dataset.l = I18n.locale(); }
    else Array.prototype.forEach.call(spans, function (sp, i) { var tn = sp.lastChild; if (tn.nodeValue !== ' ' + vals[i]) { tn.nodeValue = ' ' + vals[i]; Motion.anim(sp, [{ opacity: 0.3 }, { opacity: 1 }], { duration: 150 }); } });
    el.classList.add('on');
  };
  Clip.clear = function () { var s = G.sel, sh = G.geo.sh, r, c; Wb.batch(function () { for (r = s.r1; r <= Math.min(s.r2, sh.rows); r++) for (c = s.c1; c <= Math.min(s.c2, sh.cols); c++) Wb.setCell(sh, r, c, null, ''); }); G.changed(); };
  A['q-clear'] = function () { Ui.closeSheet(); Clip.clear(); };
})();
