// DataTools — Data > Remove duplicates and Data > Split text to columns. Both rewrite cells of the selection through Wb.batch, so one Undo takes the whole change back.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg;
  var SEPS = [['comma', ','], ['semicolon', ';'], ['tab', '\t'], ['space', ' '], ['custom', '']];
  function box() { var s = G.sel, sh = G.geo.sh; return { sh: sh, r1: s.r1, r2: s.r2, c1: s.c1, c2: s.c2 }; }
  function raw(sh, r, c) { var x = sh.cells[SheetSvc.ref(r, c)]; return x ? (x.f ? { f: x.f } : { v: x.v === undefined ? null : x.v }) : { v: null }; }
  function put(sh, r, c, o) { Wb.setCell(sh, r, c, o.f ? null : o.v, o.f || ''); }

  // ---- remove duplicates ------------------------------------------------------------------------------------------------------------
  function dupForm() {
    var b = box(), h = D.tgl('hdr', t('dd.header'), D.st.hdr) + '<div class="df-l">' + t('dd.cols') + '</div><div class="df-tg">';
    for (var c = b.c1; c <= b.c2; c++) h += D.tgl('c' + c, SheetSvc.col(c) + (D.st.hdr ? ' · ' + String(Fmt.cell(b.sh, b.r1, c).t || '') : ''), D.st['c' + c] !== false);
    return h + '</div>';
  }
  function dupDraw() { var keep = D.st; D.show('dedupe', t('dd.title'), dupForm(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'dd-run', label: t('dd.run') }]); D.st = keep; D.change = function (id) { if (id === 'hdr') dupDraw(); }; }
  function openDup() {
    if (Wb.readOnly || !G.geo) return; var b = box(); if (b.r1 === b.r2) { var e = Wb.sh(); b.r2 = Math.max(b.r1, e.rows - 1); G.sel.r2 = b.r2; }
    D.st = { hdr: true }; dupDraw();
  }
  A['dd-run'] = function () {
    var b = box(), cols = [], c, r, i; for (c = b.c1; c <= b.c2; c++) if (D.st['c' + c] !== false) cols.push(c); if (!cols.length) return Ui.toast(t('dd.nocol'));
    var first = D.st.hdr ? b.r1 + 1 : b.r1, seen = {}, keep = [], dups = 0;
    for (r = first; r <= b.r2; r++) { var key = cols.map(function (k) { var v = Calc.value(b.sh, r, k); return v === null || v === undefined ? '' : typeof v === 'string' ? v.toLowerCase() : JSON.stringify(v); }).join('\u0001'); if (seen[key]) dups++; else { seen[key] = 1; keep.push(r); } }
    D.close(); if (!dups) return Ui.toast(t('dd.none'));
    var rows = keep.map(function (r0) { var o = []; for (var k = b.c1; k <= b.c2; k++) o.push(raw(b.sh, r0, k)); return o; });
    Wb.batch(function () {
      for (i = 0; i < rows.length; i++) for (c = b.c1; c <= b.c2; c++) put(b.sh, first + i, c, rows[i][c - b.c1]);
      for (r = first + rows.length; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) put(b.sh, r, c, { v: null });
    });
    G.changed(); Ui.toast(t('dd.done', { n: dups, k: keep.length }));
  };

  // ---- split text to columns ---------------------------------------------------------------------------------------------------------
  function splitForm() {
    return D.fld(t('tc2.sep'), D.sel('sep', D.st.sep, SEPS.map(function (p) { return { v: p[0], t: t('tc2.' + p[0]) }; }))) + (D.st.sep === 'custom' ? D.fld(t('tc2.char'), D.input('tcChar', D.st.ch, '|')) : '')
      + '<div class="df-tg">' + D.tgl('merge', t('tc2.merge'), D.st.merge) + '</div>';
  }
  function splitDraw() { var keep = D.st; if ($('tcChar')) keep.ch = $('tcChar').value; D.show('split', t('tc2.title'), splitForm(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'tc2-run', label: t('a.apply') }]); D.st = keep; D.change = function (id) { if (id === 'sep') splitDraw(); }; }
  function openSplit() { if (Wb.readOnly || !G.geo) return; D.st = { sep: 'comma', ch: '', merge: false }; splitDraw(); }
  A['tc2-run'] = function () {
    var b = box(), s = D.st, ch = s.sep === 'custom' ? ($('tcChar') ? $('tcChar').value : s.ch) : SEPS.filter(function (p) { return p[0] === s.sep; })[0][1];
    if (!ch) return Ui.toast(t('tc2.nochar')); if (b.r1 === b.r2 && b.c1 === b.c2) { b.r2 = Math.max(b.r1, b.sh.rows - 1); }
    D.close(); var out = [], wide = 0, r;
    for (r = b.r1; r <= b.r2; r++) { var v = Calc.value(b.sh, r, b.c1), txt = v === null || v === undefined ? '' : String(Fmt.text(v, null)), parts = txt === '' ? [] : txt.split(ch); if (s.merge) parts = parts.filter(function (x) { return x !== ''; }); out.push(parts); wide = Math.max(wide, parts.length); }
    if (!wide) return Ui.toast(t('tc2.none'));
    Wb.batch(function () {
      out.forEach(function (parts, i) { parts.forEach(function (x, j) { var p = Clip.parse(x.trim(), Wb.style(b.sh, b.r1 + i, b.c1 + j)); Wb.setCell(b.sh, b.r1 + i, b.c1 + j, p.v === undefined ? null : p.v, p.f || ''); }); });
    });
    G.changed(); Ui.toast(t('tc2.done', { n: wide }));
  };

  if (window.Menus) Menus.add('data', function () { return [{ t: t('dd.title') + '…', off: Wb.readOnly, go: openDup }, { t: t('tc2.title') + '…', off: Wb.readOnly, go: openSplit }]; });
})();
