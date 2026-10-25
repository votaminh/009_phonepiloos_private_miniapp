// Shape — Insert > Shape: a rectangle, rounded rectangle, ellipse, triangle, diamond, arrow, pentagon, star or text box with its colours and text, put at the selected cell and written at once through the engine.
// Double-click (or double-tap) a shape to change its fill and line; move, resize and delete work like for pictures (Obj). The text of a shape is set when it is made.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, S = window.Shape = {}, cur = null;
  var KINDS = ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'rightArrow', 'leftArrow', 'pentagon', 'star5', 'textbox'];
  var COLORS = ['fl_none', 'fl_yellow', 'fl_pink', 'fl_peach', 'fl_mint', 'fl_sky', 'fl_lilac', 'sw_blue', 'sw_red', 'sw_green', 'sw_orange', 'sw_black'];
  function items(none) { return (none ? [{ v: 'none', t: t('sp.none') }] : []).concat(COLORS.map(function (c) { return { v: c, t: t('c.' + c) }; })); }
  function hex(k) { return k === 'none' ? 'none' : C(k).toUpperCase(); }
  function form(make) {
    var s = D.st; return (make ? D.fld(t('sp.kind'), D.sel('kind', s.kind, KINDS.map(function (k) { return { v: k, t: t('sp.k.' + k) }; }))) + D.fld(t('sp.text'), D.input('spText', s.text, '')) : '')
      + '<div class="df-two">' + D.fld(t('sp.fill'), D.sel('fill', s.fill, items(true))) + D.fld(t('sp.line'), D.sel('line', s.line, items(true))) + '</div>';
  }
  S.open = function () { if (Wb.readOnly || !G.geo) return; D.st = { kind: 'rect', text: '', fill: 'sw_blue', line: 'sw_blue' }; D.show('shape', t('sp.title'), form(true), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'sp-make', label: t('sp.make') }]); };
  A['sp-make'] = async function () {
    var s = D.st, text = D.val('spText'), box = s.kind === 'textbox', sh = G.geo.sh; D.close();
    var shape = { shapeType: box ? 'rect' : s.kind, fillColor: box && s.fill === 'fl_none' ? undefined : (s.fill === 'none' ? undefined : hex(s.fill)), lineColor: s.line === 'none' ? 'none' : hex(s.line), text: text || undefined, isTextBox: box };
    if (s.fill === 'none') delete shape.fillColor; Object.keys(shape).forEach(function (k) { if (shape[k] === undefined) delete shape[k]; });
    try { var out = await Book.flush({ visuals: [{ sheetName: sh.name, anchor: Img.anchor(box ? 200 : 150, box ? 60 : 100), shape: shape }] }); if (out) { await Xrich.load(out.slice(0)); G.mount(); } Book.touch(); Ui.toast(t('sp.added')); } catch (e) { App.fail('err.generic', e); }
  };
  // the colour a file gave back to its nearest name, for the form
  function nameOf(h) { var f = 'none'; if (!h) return f; COLORS.forEach(function (c) { if (C(c).toUpperCase() === String(h).toUpperCase()) f = c; }); return f; }
  S.props = function (o) {
    if (Wb.readOnly || !o || !o.shape || !o.dpath) return; cur = o; D.st = { fill: nameOf(o.shape.fill), line: nameOf(o.shape.line) };
    D.show('shape', t('sp.props'), form(false), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'sp-apply', label: t('a.apply') }]);
  };
  A['sp-apply'] = async function () {
    var s = D.st, edit = { drawingPath: cur.dpath, drawingIndex: cur.dix, fillColor: hex(s.fill), lineColor: hex(s.line) }; D.close();
    try { var out = await Book.flush({ visualEdits: [edit] }); if (out) await Xrich.load(out.slice(0)); Book.touch(); G.mount(); } catch (e) { App.fail('err.generic', e); }
  };
  document.addEventListener('dblclick', function (e) { var el = e.target.closest && e.target.closest('.gobj-i.shp'); if (!el || !G.geo) return; var x = Xrich.sheets[Wb.sheets.indexOf(G.geo.sh)]; S.props(x && x.objs[+el.dataset.k]); });
  if (window.Menus) Menus.add('insert', function () { return [{ t: t('sp.title') + '…', off: Wb.readOnly, go: S.open }]; });
})();
