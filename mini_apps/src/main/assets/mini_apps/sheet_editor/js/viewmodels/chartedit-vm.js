// ChartEdit — double-click (or double-tap) a chart that is already in the file: its title, kind, legend, data labels, gridlines and stacking can be changed. The engine rewrites the chart part;
// the chart is then drawn again from the file. Moving, resizing and deleting charts is not offered (the engine refuses to delete charts).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, C = window.ChartEdit = {}, cur = null;
  var TYPES = ['column', 'bar', 'line', 'area', 'pie', 'doughnut'], LEG = { r: 'right', b: 'bottom', t: 'top', l: 'left' };
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function val(el, n) { var k = all(el, n)[0]; return k ? k.getAttribute('val') : null; }
  // what the chart part says now
  function read(xml) {
    var d = new DOMParser().parseFromString(xml, 'application/xml'), plot = all(d, 'plotArea')[0], ttl = all(d, 'title')[0], tag = function (n) { return all(plot, n).length > 0; };
    var type = tag('doughnutChart') ? 'doughnut' : tag('pieChart') ? 'pie' : tag('areaChart') ? 'area' : tag('lineChart') ? 'line' : tag('barChart') ? (val(plot, 'barDir') === 'bar' ? 'bar' : 'column') : 'column';
    var lbls = all(plot, 'dLbls')[0], show = lbls && val(lbls, 'showVal') === '1' ? 'value' : lbls && val(lbls, 'showPercent') === '1' ? 'percent' : 'none', g = val(plot, 'grouping');
    return { title: ttl ? all(ttl, 't').map(function (x) { return x.textContent; }).join('') : '', type: type, legend: all(d, 'legend')[0] ? LEG[val(all(d, 'legend')[0], 'legendPos')] || 'right' : 'none', labels: show, grid: all(plot, 'majorGridlines').length > 0, grouping: g === 'stacked' ? 'stacked' : g === 'percentStacked' ? 'percentStacked' : 'clustered' };
  }
  function form() {
    var s = D.st, sel = function (id, v, items) { return D.sel(id, v, items.map(function (x) { return { v: x[0], t: t(x[1]) }; })); }, axis = s.type !== 'pie' && s.type !== 'doughnut';
    return D.fld(t('ce.name'), D.input('ceTitle', s.title, '')) + D.fld(t('ce.kind'), sel('type', s.type, TYPES.map(function (x) { return [x, 'ce.t.' + x]; }))) + D.fld(t('ce.legend'), sel('legend', s.legend, ['none', 'right', 'bottom', 'top', 'left'].map(function (x) { return [x, 'ce.l.' + x]; })))
      + D.fld(t('ce.labels'), sel('labels', s.labels, [['none', 'ce.d.none'], ['value', 'ce.d.value'], ['percent', 'ce.d.percent']])) + (axis ? D.fld(t('ce.stack'), sel('grouping', s.grouping, [['clustered', 'ce.s.clustered'], ['stacked', 'ce.s.stacked'], ['percentStacked', 'ce.s.percent']])) + '<div class="df-tg">' + D.tgl('grid', t('ce.grid'), s.grid) + '</div>' : '');
  }
  function draw() { var e = $('ceTitle'); if (e) D.st.title = e.value; D.show('chart', t('ce.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'ce-apply', label: t('a.apply') }]); D.change = function (id) { if (id === 'type') draw(); }; }
  C.open = function (o) { if (Wb.readOnly || !o || !o.cpath) return; cur = o; D.st = Object.assign({}, read(o.chart)); D.st.was = Object.assign({}, D.st); draw(); };
  A['ce-apply'] = async function () {
    var e = $('ceTitle'); if (e) D.st.title = e.value; var s = D.st, w = s.was, edit = { chartPath: cur.cpath };
    if (s.title !== w.title) edit.title = s.title; if (s.type !== w.type) edit.chartType = s.type; if (s.legend !== w.legend) edit.legend = s.legend; if (s.labels !== w.labels) edit.dataLabels = s.labels;
    if (s.grid !== w.grid) edit.gridlines = !!s.grid; if (s.grouping !== w.grouping) edit.grouping = s.grouping; D.close();
    if (Object.keys(edit).length < 2) return;
    try { var out = await Book.flush({ chartEdits: [edit] }); if (out) { await Xrich.load(out.slice(0)); G.mount(); } Book.touch(); Ui.toast(t('ce.done')); } catch (x) { App.fail('err.generic', x); }
  };
  document.addEventListener('dblclick', function (e) {
    var el = e.target.closest && e.target.closest('.gobj-i.ch'); if (!el || !G.geo) return; var s = Xrich.sheets[Wb.sheets.indexOf(G.geo.sh)]; C.open(s && s.objs[+el.dataset.k]);
  });
})();
