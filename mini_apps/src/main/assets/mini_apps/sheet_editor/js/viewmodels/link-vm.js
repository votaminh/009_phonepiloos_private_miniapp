// Link — links in cells: Ctrl+K opens the form, a cell with a link is blue and underlined, Ctrl/Cmd+click (or the chip under the selected cell) opens it, the chip also edits and removes it.
// A link goes to a web address (http, https, mailto, tel) or to a place in the workbook (Sheet2!A1, a name).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, L = window.Link = {}, chip = null;

  function isWeb(x) { return /^(https?:|mailto:|tel:|sms:|geo:)/i.test(x); }
  // what was typed, made into a target the file can keep: "piloos.com" becomes https://piloos.com, "a@b.com" a mailto link; null when it is neither a place nor an address
  L.clean = function (x) {
    x = String(x || '').trim(); if (!x) return null;
    if (isWeb(x)) return x; if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) return 'mailto:' + x;
    if (/^'?[^'!]+'?!\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(x) || /^\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(x)) return x;
    if (/^[^\s/]+\.[A-Za-z]{2,}(\/\S*)?$/.test(x)) return 'https://' + x;
    return null;
  };
  L.go = function (target) {
    target = String(target || '').replace(/^#/, '');
    if (isWeb(target)) {
      if (window.NativeToolsBridge) NativeTools.call('open_url', { url: target, reason: 'Open the link of a cell' }).catch(function () {}); else window.open(target, '_blank', 'noopener');
      return true;
    }
    if (window.Menus && Menus.goto(target)) return true; Ui.toast(t('lk.nogo')); return false;
  };
  function active() { var a = G.act(), sh = G.geo.sh; return { sh: sh, r: a.r, c: a.c, link: Marks.link(sh, a.r, a.c) }; }

  // ---- the form -------------------------------------------------------------------------------------------------------------------
  L.open = function () {
    if (Wb.readOnly || !G.geo) return; var a = active(), text = Fmt.cell(a.sh, a.r, a.c).t;
    D.st = { r: a.r, c: a.c };
    var btns = (a.link ? [{ act: 'lk-remove', label: t('dl.remove'), kind: 'ghost' }] : [{ act: 'dl-cancel', label: t('dl.cancel'), kind: 'ghost' }]).concat([{ act: 'lk-save', label: t('dl.save') }]);
    D.show('lk', t('lk.title'), D.fld(t('lk.text'), D.input('lkText', text, '')) + D.fld(t('lk.url'), D.input('lkUrl', a.link ? a.link.target : '', t('lk.ph'))), btns);
    setTimeout(function () { var i = $('lkUrl'); if (i) { i.focus(); i.select(); } }, 80);
  };
  A['lk-save'] = function () {
    var sh = G.geo.sh, r = D.st.r, c = D.st.c, target = L.clean(D.val('lkUrl')), text = D.val('lkText');
    if (!target) return Ui.toast(t('lk.bad'));
    Wb.batch(function () { var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell || !cell.f) { var want = text !== '' ? text : target; if (want !== Fmt.cell(sh, r, c).t) Wb.setCell(sh, r, c, want, null); } });
    Marks.setLink(sh, r, c, target); D.close(); Ui.toast(t('lk.saved')); Book.touch(); G.paint();
  };
  A['lk-remove'] = function () { var sh = G.geo.sh; Marks.setLink(sh, D.st.r, D.st.c, null); D.close(); Ui.toast(t('lk.removed')); Book.touch(); G.paint(); };

  // ---- the chip under a selected link cell ------------------------------------------------------------------------------------
  L.paint = function () {
    if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
    if (!G.geo || G.editing) return; var s = G.sel; if (s.r1 !== s.r2 || s.c1 !== s.c2) return;
    var a = active(); if (!a.link) return;
    var g = G.geo, m = Wb.mergeAt(a.sh, a.r, a.c), q = G.rect(a.r, a.c, m ? m.r2 : a.r, m ? m.c2 : a.c), fz = a.r < g.fy, host = fz ? $('gFzIn') : $('gHost'), y = fz ? q.y : q.y - g.tops[g.fy];
    chip = chip || document.createElement('div'); chip.className = 'lchip'; chip.setAttribute('role', 'toolbar');
    chip.innerHTML = '<button type="button" class="lc-go" data-act="lk-go" title="' + Ui.esc(t('lk.open')) + '"><span>' + Ui.esc(a.link.target.replace(/^(https?:\/\/|mailto:)/i, '')) + '</span></button>'
      + (Wb.readOnly ? '' : '<button type="button" class="lc-b" data-act="lk-edit" aria-label="' + Ui.esc(t('lk.edit')) + '">' + Ui.ic('edit', 16, 2) + '</button><button type="button" class="lc-b" data-act="lk-del" aria-label="' + Ui.esc(t('lk.remove')) + '">' + Ui.ic('trash', 16, 2) + '</button>');
    host.appendChild(chip); chip.style.cssText = 'left:' + q.x + 'px;top:' + (y + q.h + 6) + 'px';
    var room = $('gScroll').getBoundingClientRect().bottom - chip.getBoundingClientRect().bottom;   // no room below the cell: above it
    if (room < 4) chip.style.top = (y - chip.offsetHeight - 6) + 'px';
  };
  A['lk-go'] = function () { var a = active(); if (a.link) L.go(a.link.target); };
  A['lk-edit'] = L.open;
  A['lk-del'] = function () { var a = active(); D.st = { r: a.r, c: a.c }; A['lk-remove'](); };
  document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('.lchip')) { e.preventDefault(); e.stopPropagation(); } }, true);

  // Ctrl/Cmd+click opens, Ctrl+K edits
  document.addEventListener('click', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !G.geo || !e.target.closest) return; var cell = e.target.closest('.gc.lnk'), p = cell && window.Mouse && Mouse.at(e); if (!p) return;
    var link = Marks.link(G.geo.sh, p.r, p.c); if (link) { e.preventDefault(); L.go(link.target); }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'k' || !G.geo || App.state.page !== 'book') return;
    var el = document.activeElement; if (el && /^(input|textarea)$/i.test(el.tagName) && !el.classList.contains('ce')) return; e.preventDefault(); L.open();
  });

  if (window.Menus) Menus.add('insert', function () { return [{ t: t('lk.title') + '…', k: (/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+') + 'K', off: Wb.readOnly, go: L.open }]; });
  if (window.Ctx) Ctx.extra.push(function (kind) {
    if (kind !== 'cell' || !G.geo) return []; var a = active(), out = [{ t: a.link ? t('lk.edit') : t('lk.title') + '…', off: Wb.readOnly, go: L.open }];
    if (a.link) out.push({ t: t('lk.open'), go: function () { L.go(a.link.target); } }, { t: t('lk.remove'), off: Wb.readOnly, go: function () { D.st = { r: a.r, c: a.c }; A['lk-remove'](); } });
    return out;
  });
})();
