// Format — looks of the selected cells (bold, colours, alignment, borders), the number format, and merging cells. Every change is one undo step.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, N = { kind: 'auto', dec: 2, sep: true, sym: '₫' }, SYMS = ['₫', '$', '€', '£', '¥'];
  var F = window.Format = {};

  // the cells the selection really means (a whole column or row stops at the used area plus a margin)
  F.bounds = function () {
    var s = Grid.sel, sh = Grid.geo.sh, g = Grid.geo;
    return { r1: s.r1, c1: s.c1, r2: s.whole === 'col' ? Math.min(g.rows - 1, sh.rows + 49) : s.r2, c2: s.whole === 'row' ? Math.min(g.cols - 1, sh.cols + 5) : s.c2 };
  };
  function cur() { var s = Grid.sel; return Wb.style(Grid.geo.sh, s.r1, s.c1); }
  function apply(patch) {
    if (Wb.readOnly) return;
    Wb.batch(function () { Wb.setStyle(Grid.geo.sh, F.bounds(), patch); }); Grid.changed(); F.refresh();
  }
  F.label = function () { var s = Grid.sel; return SheetSvc.ref(s.r1, s.c1) + (s.r1 !== s.r2 || s.c1 !== s.c2 ? ':' + SheetSvc.ref(s.r2, s.c2) : ''); };
  F.refresh = function () {
    var n = Ui.state.sheet;
    if (n === 'format') SheetsView.show('format', SheetsView.format(cur(), F.label()));
    else if (n === 'numfmt') SheetsView.show('numfmt', SheetsView.numfmt(nfState()));
    else if (n === 'fonts') SheetsView.show('fonts', SheetsView.fonts(cur().f || Fonts.def));
  };
  function toggle(k) { var on = !cur()[k]; apply((function () { var p = {}; p[k] = on; return p; })()); }
  A['f-bold'] = function () { toggle('b'); }; A['f-italic'] = function () { toggle('i'); }; A['f-under'] = function () { toggle('u'); }; A['f-strike'] = function () { toggle('s'); };
  A['f-wrap'] = function () { toggle('wrap'); };
  ['left', 'center', 'right'].forEach(function (k) { A['f-al-' + k] = function () { apply({ al: cur().al === k ? null : k }); }; });
  A['f-size-inc'] = function () { apply({ sz: Math.min(72, (cur().sz || 11) + 1) }); };
  A['f-size-dec'] = function () { apply({ sz: Math.max(6, (cur().sz || 11) - 1) }); };
  A['f-color'] = function (el) { apply({ c: el.dataset.v || null }); };
  A['f-fill'] = function (el) { apply({ bg: el.dataset.v || null }); };
  A['f-border'] = function () { apply({ bd: cur().bd ? null : [1, 1, 1, 1] }); };
  A['fo-open'] = function () { Ui.closeSheet(); SheetsView.show('fonts', SheetsView.fonts(cur().f || Fonts.def)); };
  A['f-font'] = function (el) { apply({ f: el.dataset.n }); };
  A['fm-open'] = function () { Ui.closeSheet(); SheetsView.show('format', SheetsView.format(cur(), F.label())); };

  // ---- number format -----------------------------------------------------------------------------------------------------------
  function code(k) {
    var d = N.dec ? '.' + new Array(N.dec + 1).join('0') : '', base = (N.sep ? '#,##0' : '0') + d;
    switch (k) {
      case 'number': return base; case 'percent': return '0' + d + '%';
      case 'currency': return N.sym === '₫' ? base + ' "₫"' : '"' + N.sym + '"' + base;
      case 'date': return 'dd/mm/yyyy'; case 'time': return 'hh:mm'; case 'text': return '@';
    }
    return '';
  }
  var SAMPLE = { auto: 1234.5, number: 1234.5, percent: 0.1234, currency: 1234.5, date: 46320, time: 0.604166, text: 1234.5 };
  function nfState() {
    var samples = {}; Fmt.formats.forEach(function (f) { samples[f.id] = Fmt.text(SAMPLE[f.id], code(f.id) || null); });
    return { kind: N.kind, dec: N.dec, sep: N.sep, sym: N.sym, samples: samples, label: code(N.kind) || t('nf.auto') };
  }
  A['nf-open'] = function () {
    var nf = cur().nf || '', m = /\.(0+)/.exec(nf);
    N.kind = Fmt.kindOf(nf); N.dec = m ? m[1].length : nf ? 0 : 2; N.sep = !nf || /#,##0/.test(nf) || N.kind !== 'number' && N.kind !== 'currency';
    SYMS.forEach(function (s) { if (nf.indexOf(s) >= 0) N.sym = s; });
    SheetsView.show('numfmt', SheetsView.numfmt(nfState()));
  };
  function setNf() { apply({ nf: code(N.kind) || null }); }
  A['nf-kind'] = function (el) { N.kind = el.dataset.k; if (N.kind === 'percent' && !cur().nf) N.dec = 0; if (N.kind === 'currency' && N.sym === '₫') N.dec = 0; setNf(); };
  A['nf-dec'] = function () { N.dec = Math.max(0, N.dec - 1); setNf(); };
  A['nf-inc'] = function () { N.dec = Math.min(10, N.dec + 1); setNf(); };
  A['nf-sep'] = function () { N.sep = !N.sep; setNf(); };
  A['nf-sym'] = function () { N.sym = SYMS[(SYMS.indexOf(N.sym) + 1) % SYMS.length]; setNf(); };

  // ---- merge ------------------------------------------------------------------------------------------------------------------
  A['rc-merge'] = function () {
    var s = Grid.sel, sh = Grid.geo.sh, m = Wb.mergeAt(sh, s.r1, s.c1); Ui.closeSheet();
    if (m && s.r1 === s.r2 && s.c1 === s.c2) {
      sh.merges.splice(sh.merges.indexOf(m), 1); sh.ops.push({ kind: 'unmerge-cells', range: { startRow: m.r1, endRow: m.r2, startColumn: m.c1, endColumn: m.c2 } });
    } else if (s.r1 !== s.r2 || s.c1 !== s.c2) {
      Wb.batch(function () { var r, c; for (r = s.r1; r <= s.r2; r++) for (c = s.c1; c <= s.c2; c++) if (r !== s.r1 || c !== s.c1) Wb.setCell(sh, r, c, null, ''); });
      sh.merges.push({ r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 }); sh.ops.push({ kind: 'merge-cells', range: { startRow: s.r1, endRow: s.r2, startColumn: s.c1, endColumn: s.c2 } });
    } else return Ui.toast(t('rc.pick'));
    Grid.changed();
  };
})();
