// Note — notes on cells: a small red corner on the cell, the text in a card when the pointer rests on it (or the cell is selected), a form to write, change and delete it.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, N = window.Note = {}, tip = null;

  function active() { var a = G.act(), sh = G.geo.sh; return { sh: sh, r: a.r, c: a.c, note: Marks.note(sh, a.r, a.c) }; }

  // ---- the form ------------------------------------------------------------------------------------------------------------------
  N.open = function () {
    if (Wb.readOnly || !G.geo) return; var a = active(); D.st = { r: a.r, c: a.c };
    var btns = (a.note ? [{ act: 'nt-delete', label: t('nt.delete'), kind: 'ghost' }] : [{ act: 'dl-cancel', label: t('dl.cancel'), kind: 'ghost' }]).concat([{ act: 'nt-save', label: t('dl.save') }]);
    D.show('nt', a.note ? t('nt.edit') : t('nt.insert'), D.fld(t('nt.title'), D.area('ntText', a.note ? a.note.text : '', t('nt.ph'))), btns);
    setTimeout(function () { var i = $('ntText'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 80);
  };
  A['nt-save'] = function () {
    var sh = G.geo.sh, text = D.val('ntText').trim(); Marks.setNote(sh, D.st.r, D.st.c, text, ''); D.close(); Ui.toast(t(text ? 'nt.saved' : 'nt.deleted')); Book.touch(); G.paint();
  };
  A['nt-delete'] = function () { Marks.setNote(G.geo.sh, D.st.r, D.st.c, '', ''); D.close(); Ui.toast(t('nt.deleted')); Book.touch(); G.paint(); };

  // ---- the card -------------------------------------------------------------------------------------------------------------------
  function hide() { if (tip && tip.parentNode) tip.parentNode.removeChild(tip); }
  function show(note, rect) {
    hide(); tip = tip || document.createElement('div'); tip.className = 'ntip'; tip.textContent = note.text; document.body.appendChild(tip);
    var w = tip.offsetWidth, x = Math.min(window.innerWidth - w - 8, rect.right + 6), y = Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8, rect.top));
    tip.style.cssText = 'left:' + Math.max(8, x) + 'px;top:' + y + 'px';
  }
  document.addEventListener('mouseover', function (e) {
    var cell = e.target.closest && e.target.closest('.gc.nt'); if (!cell || !G.geo) return hide();
    var row = cell.parentNode, note = Marks.note(G.geo.sh, +row.dataset.r, +cell.dataset.c); if (note) show(note, cell.getBoundingClientRect());
  });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.gc.nt')) hide(); });
  document.addEventListener('scroll', hide, true);

  if (window.Menus) Menus.add('insert', function () { var a = G.geo && active(); return [{ t: a && a.note ? t('nt.edit') : t('nt.insert'), k: 'Shift+F2', off: Wb.readOnly, go: N.open }]; });
  if (window.Ctx) Ctx.extra.push(function (kind) {
    if (kind !== 'cell' || !G.geo) return []; var a = active(), out = [{ t: a.note ? t('nt.edit') : t('nt.insert'), off: Wb.readOnly, go: N.open }];
    if (a.note) out.push({ t: t('nt.delete'), off: Wb.readOnly, go: function () { D.st = { r: a.r, c: a.c }; A['nt-delete'](); } });
    return out;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'F2' || !e.shiftKey || !G.geo || App.state.page !== 'book') return; e.preventDefault(); N.open();
  });
})();
