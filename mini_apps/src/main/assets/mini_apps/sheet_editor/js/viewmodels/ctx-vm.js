// Ctx — the menu that opens on a right click: on a cell, on a column letter, on a row number. The same actions the tool bar has, one click away.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, X = window.Ctx = { extra: [] };
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform), CMD = MAC ? '⌘' : 'Ctrl+';
  function call(a) { return function () { A[a](); }; }
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  function clipItems() {
    return [it('cx.cut', CMD + 'X', function () { Clip.copy(true); }), it('cx.copy', CMD + 'C', function () { Clip.copy(false); }), it('cx.paste', CMD + 'V', function () { Clip.paste(); }),
      { t: t('cx.pspecial'), sub: [it('cx.psvalues', '', function () { Clip.pasteMode('values'); }), it('cx.psformulas', '', function () { Clip.pasteMode('formulas'); }), it('cx.psformats', '', function () { Clip.pasteMode('formats'); }), it('cx.pstranspose', '', function () { Clip.pasteMode('transpose'); })] }];
  }
  function shape() {
    var s = G.sel, rows = s.r2 - s.r1 + 1, cols = s.c2 - s.c1 + 1;
    return [it('cx.insrowa', '', call('rc-rowa')), it('cx.insrowb', '', call('rc-rowb')), it('cx.inscola', '', call('rc-cola')), it('cx.inscolb', '', call('rc-colb')),
      it(rows > 1 ? 'cx.delrows' : 'cx.delrow', '', call('rc-rowd'), { danger: true }), it(cols > 1 ? 'cx.delcols' : 'cx.delcol', '', call('rc-cold'), { danger: true })];
  }
  function build(kind) {
    var ro = Wb.readOnly, off = function (o) { return Object.assign({ off: ro }, o); };
    var items = clipItems().map(function (x, i) { return i === 3 ? Object.assign(x, { off: ro }) : (i === 0 || i === 2 ? Object.assign(x, { off: ro }) : x); });
    if (kind === 'cell') {
      items = items.concat(['-'], shape().map(off), ['-', it('cx.clear', 'Del', function () { Clip.clear(); }, off()), it('cx.fill', CMD + 'D', function () { Fill.down(); }, off()), '-',
        it('cx.sort', '', call('sf-asc'), off()), it('cx.sortz', '', call('sf-desc'), off()), '-', it('cx.format', CMD + '1', call('fm-open'), off())]);
    } else if (kind === 'row') {
      var s = G.sel, hid = !!G.geo.sh.hidR[s.r1];
      items = items.concat(['-'], shape().slice(0, 2).map(off), [it(s.r2 > s.r1 ? 'cx.delrows' : 'cx.delrow', '', call('rc-rowd'), off({ danger: true })), '-', it(hid ? 'cx.unhide' : 'cx.hide', '', call('rc-rowh'), off()), it('cx.height', '', call('rc-open'), off()), '-', it('cx.clear', 'Del', function () { Clip.clear(); }, off())]);
    } else {
      var q = G.sel, hc = !!G.geo.sh.hidC[q.c1];
      items = items.concat(['-'], shape().slice(2, 4).map(off), [it(q.c2 > q.c1 ? 'cx.delcols' : 'cx.delcol', '', call('rc-cold'), off({ danger: true })), '-', it(hc ? 'cx.unhide' : 'cx.hide', '', call('rc-colh'), off()), it('cx.width', '', call('rc-open'), off()), it('cx.autofit', '', function () { Resize.fit('col'); }, off()), '-', it('cx.clear', 'Del', function () { Clip.clear(); }, off())]);
    }
    X.extra.forEach(function (f) { var more = f(kind); if (more && more.length) items = items.concat(['-'], more); });
    return items;
  }
  X.open = function (x, y, kind) { PopMenu.show(x, y, build(kind)); };
  X.init = function () {
    $('gWrap').addEventListener('contextmenu', function (e) {
      if (!G.geo || (e.target.closest && e.target.closest('.ce,.gquick'))) return; e.preventDefault();
      var head = e.target.closest && e.target.closest('.gh'), p = Mouse.at(e), s = G.sel, g = G.geo;
      if (window.CellEdit && CellEdit.on) G.commit(false);
      if (head && !head.classList.contains('gh-corner')) {
        var col = !head.classList.contains('gr-h'), i = +(col ? head.dataset.c : head.dataset.r), inside = col ? (s.whole === 'col' && i >= s.c1 && i <= s.c2) : (s.whole === 'row' && i >= s.r1 && i <= s.r2);
        if (!inside) { if (col) G.select(0, i, g.rows - 1, i, 'col'); else G.select(i, 0, i, g.cols - 1, 'row'); }
        X.open(e.clientX, e.clientY, col ? 'col' : 'row'); return;
      }
      if (!p) return; if (!(p.r >= s.r1 && p.r <= s.r2 && p.c >= s.c1 && p.c <= s.c2)) G.select(p.r, p.c);
      X.open(e.clientX, e.clientY, 'cell');
    });
  };
})();
