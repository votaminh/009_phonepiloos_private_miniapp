// Fmt — the text a cell shows: the value in its number format, calculated formulas included. Column letters and the format picker live here too.
(function () {
  'use strict';
  var FORMATS = [
    { id: 'auto', code: '' }, { id: 'number', code: '#,##0.00' }, { id: 'percent', code: '0.00%' }, { id: 'currency', code: '#,##0 "₫"' },
    { id: 'date', code: 'dd/mm/yyyy' }, { id: 'time', code: 'hh:mm' }, { id: 'text', code: '@' }
  ];
  function show(v, nf) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return v.e;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'string') return v;
    if (!isFinite(v)) return '#NUM!';
    if (nf && window.NumFmt) return NumFmt.format(nf, v);
    return String(+v.toPrecision(11));
  }
  window.Fmt = {
    formats: FORMATS,
    // the format picker's id for a code (what the number-format sheet marks)
    kindOf: function (nf) {
      if (!nf) return 'auto'; if (nf === '@') return 'text';
      if (/%/.test(nf)) return 'percent'; if (/[yd]/i.test(nf.replace(/"[^"]*"/g, '')) && /[ymd]/i.test(nf.replace(/"[^"]*"/g, '')) && window.NumFmt && NumFmt.isDate(nf)) return 'date';
      if (/h|s/i.test(nf.replace(/"[^"]*"/g, '')) && window.NumFmt && NumFmt.isDate(nf)) return 'time';
      if (/[₫$€£¥]|VND|USD/.test(nf)) return 'currency';
      return 'number';
    },
    // { t: text, n: right aligned (number), x: error } of one cell
    cell: function (sh, r, c) {
      var v = Calc.value(sh, r, c), st = Wb.style(sh, r, c), err = !!v && typeof v === 'object';
      return { t: show(v, st.nf), n: typeof v === 'number' && !err, x: err, v: v };
    },
    text: show,
    // the raw text the formula bar edits: the formula, or the value as typed
    raw: function (sh, r, c) {
      var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell) return '';
      if (cell.f) return cell.f;
      return cell.v === null || cell.v === undefined ? '' : (typeof cell.v === 'boolean' ? (cell.v ? 'TRUE' : 'FALSE') : String(cell.v));
    }
  };
})();
