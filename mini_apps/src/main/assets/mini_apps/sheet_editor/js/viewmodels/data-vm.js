// Data — the function picker and inserting a chart built from the selected cells.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, CATS = ['common', 'math', 'text', 'logic', 'lookup', 'date'], cat = 'common';
  var FUNCS = [
    ['SUM', 'SUM(range)', 'common math'], ['AVERAGE', 'AVERAGE(range)', 'common math'], ['COUNT', 'COUNT(range)', 'common math'], ['MIN', 'MIN(range) · MAX(range)', 'common math'], ['MAX', 'MAX(range)', 'math'], ['ROUND', 'ROUND(number, digits)', 'common math'],
    ['IF', 'IF(test, then, else)', 'common logic'], ['AND', 'AND(a, b)', 'logic'], ['OR', 'OR(a, b)', 'logic'], ['IFERROR', 'IFERROR(value, other)', 'logic'], ['VLOOKUP', 'VLOOKUP(key, range, col)', 'common lookup'], ['INDEX', 'INDEX(range, row, col)', 'lookup'], ['MATCH', 'MATCH(key, range)', 'lookup'],
    ['COUNTIF', 'COUNTIF(range, test)', 'math'], ['SUMIF', 'SUMIF(range, test, sum)', 'math'], ['ABS', 'ABS(number)', 'math'], ['MOD', 'MOD(number, divisor)', 'math'], ['CONCAT', 'CONCAT(text1, text2)', 'common text'], ['LEFT', 'LEFT(text, n)', 'text'], ['RIGHT', 'RIGHT(text, n)', 'text'], ['LEN', 'LEN(text)', 'text'],
    ['UPPER', 'UPPER(text)', 'text'], ['LOWER', 'LOWER(text)', 'text'], ['TRIM', 'TRIM(text)', 'text'], ['TEXT', 'TEXT(value, format)', 'text'], ['TODAY', 'TODAY()', 'date'], ['DATE', 'DATE(year, month, day)', 'date'], ['YEAR', 'YEAR(date)', 'date'], ['MONTH', 'MONTH(date)', 'date'], ['DAY', 'DAY(date)', 'date']
  ].map(function (f) { return { n: f[0], sig: f[1], cats: f[2].split(' ') }; });
  function list(q) { q = (q || '').toLowerCase(); return FUNCS.filter(function (f) { return q ? f.n.toLowerCase().indexOf(q) >= 0 || t('fn.' + f.n).toLowerCase().indexOf(q) >= 0 : f.cats.indexOf(cat) >= 0; }); }
  A['fn-open'] = function () { if (Wb.readOnly) return; Ui.closeSheet(); SheetsView.show('functions', SheetsView.functions(CATS, cat, list(''))); };
  A['fn-cat'] = function (el) { cat = el.dataset.k; SheetsView.show('functions', SheetsView.functions(CATS, cat, list(''))); };
  document.addEventListener('input', function (e) { if (e.target.id === 'fnQ') $('fnList').innerHTML = SheetsView.fnList(list(e.target.value)); });
  // the function goes into the formula bar, the cursor between its brackets
  A['fn-pick'] = function (el) {
    Ui.closeSheet(); var i = $('fbIn'), name = el.dataset.n, v = i.value;
    i.value = (v.charAt(0) === '=' ? v : '=') + name + '()'; i.focus(); var at = i.value.length - 1; try { i.setSelectionRange(at, at); } catch (e) { /* not a text input */ }
  };

  // ---- chart ------------------------------------------------------------------------------------------------------------------
  var CH = { type: 'column', legend: true };
  function data() {
    var sh = Grid.geo.sh, s = Grid.sel, one = s.r1 === s.r2 && s.c1 === s.c2, r1 = one ? 0 : s.r1, r2 = one ? sh.rows - 1 : s.r2, c1 = one ? 0 : s.c1, c2 = one ? sh.cols - 1 : s.c2, r, c;
    if (r2 < r1 || c2 <= c1) return null;
    var head = [], series = [], cats = [], first = Calc.value(sh, r1, c1 + 1), hasHead = typeof first !== 'number';
    for (r = r1 + (hasHead ? 1 : 0); r <= r2; r++) cats.push(Fmt.text(Calc.value(sh, r, c1)));
    for (c = c1 + 1; c <= c2; c++) {
      var vals = [], any = false; for (r = r1 + (hasHead ? 1 : 0); r <= r2; r++) { var v = Calc.value(sh, r, c); vals.push(typeof v === 'number' ? v : 0); if (typeof v === 'number') any = true; }
      if (any) series.push({ name: hasHead ? Fmt.text(Calc.value(sh, r1, c)) : SheetSvc.col(c), values: vals, col: c });
    }
    if (!series.length || !cats.length) return null;
    return { r1: r1, r2: r2, c1: c1, c2: c2, first: r1 + (hasHead ? 1 : 0), cats: cats, series: series, hasHead: hasHead };
  }
  var COLORS = ['sw_green', 'sw_blue', 'sw_orange', 'sw_purple', 'sw_red', 'sw_gray'];
  function svg(d, type) {
    var W = 300, H = 150, pad = 14, max = Math.max.apply(null, [].concat.apply([], d.series.map(function (s) { return s.values; })).concat(1)), n = d.cats.length, k = d.series.length, o = '';
    if (type === 'pie') {
      var vals = d.series[0].values.map(function (v) { return Math.max(0, v); }), tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1, a0 = -Math.PI / 2, R = 62, cx = W / 2, cy = H / 2;
      vals.forEach(function (v, i) { var a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0; o += '<path d="M' + cx + ' ' + cy + ' L' + (cx + R * Math.cos(a0)) + ' ' + (cy + R * Math.sin(a0)) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(a1)) + ' ' + (cy + R * Math.sin(a1)) + ' Z" fill="' + C(COLORS[i % COLORS.length]) + '" stroke="' + C('card') + '" stroke-width="2"/>'; a0 = a1; });
    } else {
      var bw = (W - pad * 2) / n, base = H - 22;
      o += '<path d="M' + pad + ' ' + base + ' H' + (W - pad) + '" stroke="' + C('line') + '"/>';
      d.series.forEach(function (s, j) {
        var col = C(COLORS[j % COLORS.length]);
        if (type === 'column') s.values.forEach(function (v, i) { var h = Math.max(0, v) / max * (base - 14), w = bw * 0.7 / k; o += '<rect x="' + (pad + i * bw + bw * 0.15 + j * w) + '" y="' + (base - h) + '" width="' + (w - 2) + '" height="' + h + '" rx="2" fill="' + col + '"/>'; });
        else { var pts = s.values.map(function (v, i) { return (pad + i * bw + bw / 2) + ',' + (base - Math.max(0, v) / max * (base - 14)); }); o += (type === 'area' ? '<polygon points="' + (pad + bw / 2) + ',' + base + ' ' + pts.join(' ') + ' ' + (pad + (n - 1) * bw + bw / 2) + ',' + base + '" fill="' + col + '" opacity=".25"/>' : '') + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round"/>'; }
      });
      d.cats.slice(0, 8).forEach(function (c, i) { o += '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="' + C('muted') + '">' + Ui.esc(c.slice(0, 8)) + '</text>'; });
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + o + '</svg>';
  }
  function show() {
    var d = data(); if (!d) { Ui.closeSheet(); return Ui.toast(t('ch.nodata')); }
    SheetsView.show('chart', SheetsView.chart({ type: CH.type, legend: CH.legend, label: t('ch.series', { n: d.series.length }), range: SheetSvc.ref(d.r1, d.c1) + ':' + SheetSvc.ref(d.r2, d.c2), title: d.series.length === 1 ? d.series[0].name : t('ch.default'), svg: svg(d, CH.type) }));
  }
  A['ch-open'] = function () { Ui.closeSheet(); show(); };
  A['ch-type'] = function (el) { CH.type = el.dataset.k; show(); };
  A['ch-legend'] = function () { CH.legend = !CH.legend; show(); };
  A['ch-insert'] = async function () {
    var d = data(); if (!d) return; var sh = Grid.geo.sh, q = "'" + sh.name.replace(/'/g, "''") + "'!", top = d.r2 + 2, col = Math.max(0, d.c1);
    var rng = function (c, a, b) { return q + '$' + SheetSvc.col(c) + '$' + (a + 1) + ':$' + SheetSvc.col(c) + '$' + (b + 1); };
    var chart = { chartType: CH.type, title: d.series.length === 1 ? d.series[0].name : t('ch.default'), legend: CH.legend ? 'bottom' : 'none', series: d.series.map(function (s, j) { return { name: s.name, categories: d.cats, values: s.values, valuesRef: rng(s.col, d.first, d.r2), categoriesRef: rng(d.c1, d.first, d.r2), color: C(COLORS[j % COLORS.length]) }; }) };
    Ui.closeSheet();
    try { var out = await Book.flush({ visuals: [{ sheetName: sh.name, anchor: { fromRow: top, fromColumn: col, fromRowOffset: 0, fromColumnOffset: 0, toRow: top + 15, toColumn: col + 7, toRowOffset: 0, toColumnOffset: 0 }, chart: chart }] }); if (out) { await Xrich.load(out.slice(0)); Grid.mount(); } Book.touch(); Ui.toast(t('ch.added', { r: SheetSvc.ref(top, col) })); }
    catch (e) { App.fail('err.generic', e); }
  };
})();
