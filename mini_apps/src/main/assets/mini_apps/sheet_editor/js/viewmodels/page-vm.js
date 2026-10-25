// PageSetup — File > Page setup: paper, orientation, scale or fit to pages, margins, gridlines and headings on paper, a centred header and footer, and the print area (the selection). Applied at once through the engine;
// the print view (XPage) reads the file again afterwards, so it shows the new page at once.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg;
  var PAPERS = [[9, 'A4'], [1, 'Letter'], [8, 'A3'], [5, 'Legal'], [11, 'A5']];
  function setup() { var i = Wb.sheets.indexOf(G.geo.sh), x = Xrich.sheets[i]; return x && x.setup || {}; }
  // the centre part of a header / footer string such as "&L…&C…&R…"
  function centre(s) { var m = /&C([\s\S]*?)(?:&[LR]|$)/.exec(s || ''); return m ? m[1] : ''; }
  function margins(m) { if (!m) return 'normal'; var eq = function (a, b) { return Math.abs(a - b) < 0.01; }; return eq(m.l, 0.7) && eq(m.t, 0.75) ? 'normal' : eq(m.l, 1) && eq(m.t, 1) ? 'wide' : eq(m.l, 0.25) && eq(m.t, 0.75) ? 'narrow' : 'keep'; }
  function form() {
    var s = D.st, mk = function (id, v, items) { return D.sel(id, v, items.map(function (x) { return { v: x[0], t: x[1] }; })); };
    return '<div class="df-two">' + D.fld(t('pg.paper'), mk('paper', s.paper, PAPERS.map(function (p) { return [p[0], p[1]]; }))) + D.fld(t('pg.orient'), mk('orient', s.orient, [['portrait', t('pg.portrait')], ['landscape', t('pg.landscape')]])) + '</div>'
      + D.fld(t('pg.scaling'), mk('mode', s.mode, [['scale', t('pg.scale')], ['fit', t('pg.fit')]])) + (s.mode === 'scale' ? D.fld(t('pg.percent'), D.input('pgScale', s.scale, '100', { num: 1 })) : D.fld(t('pg.fitw'), D.input('pgFit', s.fit, '1', { num: 1 })))
      + D.fld(t('pg.margins'), mk('margins', s.margins, [['normal', t('pg.m.normal')], ['wide', t('pg.m.wide')], ['narrow', t('pg.m.narrow')]].concat(s.margins === 'keep' ? [['keep', t('pg.m.keep')]] : [])))
      + D.fld(t('pg.header'), D.input('pgHead', s.head, '')) + D.fld(t('pg.footer'), D.input('pgFoot', s.foot, '&P / &N')) + '<p class="df-hint">' + t('pg.codes') + '</p>'
      + D.fld(t('pg.area'), mk('area', s.area, [['keep', t('pg.a.keep')], ['sel', t('pg.a.sel')], ['none', t('pg.a.none')]])) + '<div class="df-tg">' + D.tgl('grid', t('pg.grid'), s.grid) + D.tgl('heads', t('pg.heads'), s.heads) + '</div>';
  }
  function remember() { var s = D.st, g = function (id) { var e = document.getElementById(id); return e ? e.value : undefined; }; [['pgScale', 'scale'], ['pgFit', 'fit'], ['pgHead', 'head'], ['pgFoot', 'foot']].forEach(function (p) { var v = g(p[0]); if (v !== undefined) s[p[1]] = v; }); }
  function draw() { remember(); D.show('page', t('pg.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'pg-apply', label: t('a.apply') }]); D.change = function (id) { if (id === 'mode') draw(); }; }
  function open() {
    if (Wb.readOnly || !G.geo) return; var x = setup();
    D.st = { paper: x.paper || 9, orient: x.land ? 'landscape' : 'portrait', mode: x.fit ? 'fit' : 'scale', scale: String(x.scale || 100), fit: String(x.fit ? x.fit.w : 1), margins: margins(x.m), head: centre(x.header), foot: centre(x.footer), area: 'keep', grid: !!x.grid, heads: false, was: { head: centre(x.header), foot: centre(x.footer) } };
    draw();
  }
  A['pg-apply'] = async function () {
    remember(); var s = D.st, sh = G.geo.sh, st = { sheetName: sh.name, orientation: s.orient, paperSize: +s.paper, printGridlines: !!s.grid, printHeadings: !!s.heads };
    if (s.mode === 'fit') { st.fitToPage = true; st.fitToWidth = Math.max(1, Math.min(50, Math.round(+s.fit) || 1)); st.fitToHeight = 0; } else { st.fitToPage = false; st.scale = Math.max(10, Math.min(400, Math.round(+s.scale) || 100)); }
    if (s.margins !== 'keep') st.margins = s.margins;
    if (s.head !== s.was.head) st.header = s.head ? { center: s.head } : null; if (s.foot !== s.was.foot) st.footer = s.foot ? { center: s.foot } : null;
    if (s.area === 'sel') { var q = G.sel; st.printArea = SheetSvc.ref(q.r1, q.c1) + ':' + SheetSvc.ref(q.r2, q.c2); } else if (s.area === 'none') st.printArea = null;
    D.close(); try { var out = await Book.flush({ pageSetup: [st] }); if (out) { await Xrich.load(out.slice(0)); if (window.XPage && XPage.on) { XPage.sig = ''; XPage.pz = 0; XPage.render(); } } Book.touch(); Ui.toast(t('pg.done')); } catch (e) { App.fail('err.generic', e); }
  };
  if (window.Menus) Menus.add('file', function () { return [{ t: t('pg.title') + '…', off: Wb.readOnly, go: open }]; });
})();
