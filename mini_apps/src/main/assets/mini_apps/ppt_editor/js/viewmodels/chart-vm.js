// Chartx — a chart on the slide: put one in (column, stacked, line, area, pie, ring, scatter, radar, column + line) with a few numbers to start from, change its kind and legend, and change its numbers in a table.
// The table of numbers is a sheet: the first column is the names of the categories, the first row the names of the series; every other cell is a number. A box left empty is left empty in the chart.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, V = window.InspView, X = window.Chartx = { kinds: ['bar', 'barStacked', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar', 'comboBarLine'], d: null };

  function middle(wf, hf) { var s = Deck.info.size, w = Math.round(s.cx * wf), h = Math.round(s.cy * hf); return { x: Math.round((s.cx - w) / 2), y: Math.round((s.cy - h) / 2), cx: w, cy: h }; }
  X.insert = function (kind) {
    var one = kind === 'pie' || kind === 'doughnut', cats = [1, 2, 3, 4].map(function (n) { return t('ch.cat', { n: n }); }), ser = [{ name: t('ch.series', { n: 1 }), values: [4.3, 2.5, 3.5, 4.5] }];
    if (!one) ser.push({ name: t('ch.series', { n: 2 }), values: [2.4, 4.4, 1.8, 2.8] });
    Viewer.run([Deck.op('addChart', null, { kind: kind, categories: cats, series: ser, offset: middle(0.62, 0.62) })], 'busy.edit', { select: true });
  };
  X.menu = function (btn) { var r = btn.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, X.kinds.map(function (k) { return { t: t('ch.k.' + k), go: function () { X.insert(k); } }; }), { from: btn }); };

  // ---- the table of numbers --------------------------------------------------------------------------------------------------------------------------
  function sheet() {
    var d = X.d, h = '<div class="sx-hd"><div><h2>' + esc(t('ch.data')) + '</h2></div></div><div class="ch-w"><table class="ch-t"><thead><tr><th></th>'
      + d.series.map(function (s, j) { return '<th><input data-ch="s" data-j="' + j + '" value="' + esc(s.name) + '" aria-label="' + esc(t('ch.series', { n: j + 1 })) + '"></th>'; }).join('') + '</tr></thead><tbody>'
      + d.categories.map(function (c, i) { return '<tr><th><input data-ch="c" data-i="' + i + '" value="' + esc(c) + '" aria-label="' + esc(t('ch.cat', { n: i + 1 })) + '"></th>' + d.series.map(function (s, j) { var v = s.values[i]; return '<td><input data-ch="v" data-i="' + i + '" data-j="' + j + '" inputmode="decimal" value="' + (v == null ? '' : esc(v)) + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'
      + '<div class="btns ch-b"><button type="button" class="btn light" data-act="ch-row">' + esc(t('ch.addrow')) + '</button><button type="button" class="btn light" data-act="ch-col">' + esc(t('ch.addcol')) + '</button><button type="button" class="btn light" data-act="ch-delrow">' + esc(t('ch.delrow')) + '</button><button type="button" class="btn light" data-act="ch-delcol">' + esc(t('ch.delcol')) + '</button></div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="ch-apply">' + esc(t('a.apply')) + '</button></div>';
    Ui.sheet('chart', h);
  }
  function grab() {
    var d = X.d; Array.prototype.forEach.call(document.querySelectorAll('#sheet [data-ch]'), function (i) {
      var k = i.dataset.ch, a = +i.dataset.i, b = +i.dataset.j;
      if (k === 's') d.series[b].name = i.value; else if (k === 'c') d.categories[a] = i.value;
      else { var v = parseFloat(String(i.value).replace(',', '.')); d.series[b].values[a] = isNaN(v) ? null : v; }
    });
  }
  X.edit = function () {
    var c = Quick.last && Quick.last.more && Quick.last.more.chart; if (!c) return;
    X.d = { id: Deck.sel, slide: Deck.cur, categories: c.categories.slice(), series: c.series.map(function (s) { return { name: s.name || '', values: s.values.slice() }; }) }; sheet();
  };
  A['ch-row'] = function () { grab(); var d = X.d; d.categories.push(t('ch.cat', { n: d.categories.length + 1 })); d.series.forEach(function (s) { s.values.push(null); }); sheet(); };
  A['ch-col'] = function () { grab(); var d = X.d; d.series.push({ name: t('ch.series', { n: d.series.length + 1 }), values: d.categories.map(function () { return null; }) }); sheet(); };
  A['ch-delrow'] = function () { grab(); var d = X.d; if (d.categories.length < 2) return; d.categories.pop(); d.series.forEach(function (s) { s.values.pop(); }); sheet(); };
  A['ch-delcol'] = function () { grab(); var d = X.d; if (d.series.length < 2) return; d.series.pop(); sheet(); };
  A['ch-apply'] = function () {
    grab(); var d = X.d; Ui.closeSheet();
    Viewer.run([Deck.op('setChart', d.id, { patch: { categories: d.categories, series: d.series.map(function (s) { return { name: s.name, values: s.values.map(function (v) { return v == null ? 0 : v; }) }; }) } }, d.slide)], 'busy.edit');
  };

  // ---- the panel ---------------------------------------------------------------------------------------------------------------------------------------
  V.chart = function (s) {
    var c = (s.q.more && s.q.more.chart) || {};
    return V.row(t('ch.kind'), V.sel('c-kind', t('ch.k.' + c.kind) === 'ch.k.' + c.kind ? String(c.kind) : t('ch.k.' + c.kind), t('ch.kind'))) + V.row(t('ch.legend'), V.sel('c-legend', t('ch.l.' + (c.legendPos || 'none')), t('ch.legend'))) + V.row(t('ch.data'), V.chip('c-data', t('ip.edit'), false));
  };
  var H = Insp.H;
  function menu(btn, items) { var r = btn.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, items, { from: btn }); }
  function patch(p) { Viewer.run([Deck.op('setChart', Deck.sel, { patch: p })], 'busy.edit'); }
  H['c-kind'] = function (b) { var c = Quick.last.more.chart; menu(b, X.kinds.map(function (k) { return { t: t('ch.k.' + k), on: c.kind === k, go: function () { patch({ kind: k }); } }; })); };
  H['c-legend'] = function (b) { var c = Quick.last.more.chart; menu(b, ['none', 't', 'b', 'l', 'r'].map(function (k) { return { t: t('ch.l.' + k), on: (c.legendPos || 'none') === k, go: function () { patch({ legendPos: k }); } }; })); };
  H['c-data'] = function () { X.edit(); };
})();
