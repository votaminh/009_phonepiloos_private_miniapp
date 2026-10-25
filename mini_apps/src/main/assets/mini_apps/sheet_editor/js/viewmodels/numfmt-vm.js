// NumFmtDlg — Format > Number > Custom: a format code typed by hand (or picked from the examples) with a live preview made from the value of the cell that is selected.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, D = window.Dlg, G = window.Grid;
  var EXAMPLES = ['#,##0', '#,##0.00', '0.0%', '#,##0.00;[Red]-#,##0.00', '"$"#,##0.00', '#,##0 "₫"', '0.00E+00', '# ?/?', '000000', 'dd/mm/yyyy', 'dddd, d mmmm yyyy', 'hh:mm:ss', '[h]:mm', 'yyyy-mm-dd hh:mm', '@'];
  function sample() { var a = G.act(), v = Calc.value(G.geo.sh, a.r, a.c); return typeof v === 'number' ? v : 1234.5678; }
  function shown(code) { try { return NumFmt.format(code, sample()); } catch (e) { return ''; } }
  function form() {
    return D.fld(t('nc.code'), D.input('ncCode', D.st.code, '#,##0.00')) + '<div class="nc-pre"><small>' + esc(t('nc.preview')) + '</small><b id="ncPre">' + esc(shown(D.st.code)) + '</b></div>'
      + '<div class="df-l">' + esc(t('nc.examples')) + '</div><div class="sx-chips">' + EXAMPLES.map(function (c) { return '<button type="button" class="sx-chip" data-act="nc-pick" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
  }
  D.customNumber = function () {
    if (Wb.readOnly || !G.geo) return; var a = G.act(); D.st = { code: Wb.style(G.geo.sh, a.r, a.c).nf || '' };
    D.show('numfmt', t('nc.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'nc-apply', label: t('a.apply') }]);
  };
  A['nc-pick'] = function (el) { D.st.code = el.dataset.c; $('ncCode').value = D.st.code; $('ncPre').textContent = shown(D.st.code); };
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'ncCode') { D.st.code = e.target.value; $('ncPre').textContent = shown(D.st.code); } });
  A['nc-apply'] = function () { var code = D.val('ncCode').trim(); D.close(); Format.apply({ nf: code || null }); };
})();
