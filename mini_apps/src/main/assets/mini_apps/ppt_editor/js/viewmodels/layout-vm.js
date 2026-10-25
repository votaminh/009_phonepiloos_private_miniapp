// Layout — the layouts the file brings (change this slide, or add a new one), the look of the whole deck (colours and fonts), and the colour behind one slide.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, add = false;
  var Layout = window.Layout = {};
  // the four looks live in res/colors.js; each is the colours of a deck theme plus its fonts
  var LOOKS = ['tide', 'paper', 'night', 'fresh'].map(function (id) { return Object.assign({ id: id }, AppLooks[id]); });
  Layout.looks = function () { return LOOKS; };
  Layout.open = function (mode) {
    add = mode === 'add'; var cur = Deck.info.layouts.map(function (l) { return { name: l.name, placeholders: l.placeholders, on: false }; });
    Ui.sheet('layout', SheetsView.layout({ add: add, layouts: cur, looks: LOOKS }));
  };
  A['m-layout'] = function () { Layout.open('slide'); };
  A['l-pick'] = function (b) {
    Ui.closeSheet(); var name = b.dataset.k;
    if (add || !Deck.count()) Viewer.run([Deck.op('addSlideWithLayout', null, { layout: name }, Deck.cur)], 'busy.slides', { go: Deck.cur + 1, rebuild: true });
    else Viewer.run([Deck.op('setSlideLayout', null, { layout: name })], 'busy.slides');
  };
  A['l-look'] = function (b) {
    var l = LOOKS.filter(function (x) { return x.id === b.dataset.k; })[0]; if (!l) return; Ui.closeSheet();
    Viewer.run([Deck.op('applyTheme', null, { name: l.id, colors: l.colors, majorFont: l.major, minorFont: l.minor })], 'busy.look', { rebuild: true });
  };
  // footer text and slide numbers on every slide; the page shape of the deck
  var ft = { text: '', num: true };
  A['m-footer'] = function () { Ui.sheet('footer', SheetsView.footer(ft)); };
  A['ft-num'] = function () { ft.text = $('ftText').value; ft.num = !ft.num; Ui.sheet('footer', SheetsView.footer(ft)); };
  A['ft-apply'] = function () { ft.text = $('ftText').value; Ui.closeSheet(); Viewer.run([{ op: 'applyHeaderFooter', settings: { footer: ft.text || null, slideNum: ft.num } }], 'busy.edit', { rebuild: true }); };
  function shape() { var s = Deck.info.size; return Math.abs(s.cx / s.cy - 4 / 3) < 0.05 ? '4:3' : '16:9'; }
  A['m-size'] = function () { Ui.sheet('size', SheetsView.size(shape())); };
  A['sz-set'] = function (b) { Ui.closeSheet(); if (b.dataset.k === shape()) return; var s = Deck.info.size, cx = b.dataset.k === '4:3' ? Math.round(s.cy * 4 / 3) : Math.round(s.cy * 16 / 9); Viewer.run([{ op: 'setSlideSize', cx: cx, cy: s.cy }], 'busy.edit', { rebuild: true }).then(function () { Stage.layout(); Stage.show(); }); };
  // the colour behind this slide only
  A['m-bg'] = function () { Ui.sheet('bg', SheetsView.bg()); };
  A['bg-set'] = function (b) { Ui.closeSheet(); Viewer.run([Deck.op('setBackground', null, { kind: 'solid', color: b.dataset.v })], 'busy.edit', { rebuild: true }); };
  A['bg-reset'] = function () { Ui.closeSheet(); Viewer.run([Deck.op('setBackground', null, { kind: 'reset' })], 'busy.edit', { rebuild: true }); };
})();
