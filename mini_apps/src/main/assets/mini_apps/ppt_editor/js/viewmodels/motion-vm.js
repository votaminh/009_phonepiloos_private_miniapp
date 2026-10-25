// Motion — how a slide appears (transition, automatic advance) and the animations of its boxes. They are kept in the file; this phone plays the transition when presenting.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var Motion = window.Motion = {};
  async function open() {
    var s = Deck.slide(), items = []; try { items = await PptSvc.animations(Deck.cur); } catch (e) { /* a slide without animations */ }
    var n = Deck.sel && Stage.node(Deck.sel);
    Ui.sheet('motion', SheetsView.motion({ kind: s.transition || 'none', adv: s.advance ? Math.round(s.advance / 1000) : 0, items: items.map(function (a) { return { seq: a.seq, label: a.label || a.name || a.target || '', effect: a.effect, trigger: a.trigger }; }), canAdd: !!n }));
  }
  A['m-motion'] = function () { open(); };
  A['mo-kind'] = async function (b) { await Viewer.run([Deck.op('setTransition', null, { kind: b.dataset.k })], 'busy.edit'); open(); };
  A['mo-adv'] = async function (b) {
    var s = Deck.slide(), cur = s.advance ? Math.round(s.advance / 1000) : 0, next = Math.max(0, Math.min(120, cur + (b.dataset.v === '+' ? (cur >= 10 ? 5 : 1) : (cur > 10 ? -5 : -1))));
    await Viewer.run([Deck.op('setAdvanceTime', null, { ms: next ? next * 1000 : null })], 'busy.edit'); open();
  };
  A['mo-add'] = async function (b) { if (!Deck.sel) return; await Viewer.run([Deck.op('addAnimation', Deck.sel, { effect: b.dataset.k, trigger: 'onClick' })], 'busy.edit'); open(); };
  A['mo-del'] = async function (b) { await Viewer.run([Deck.op('removeAnimation', null, { seq: +b.dataset.k })], 'busy.edit'); open(); };
})();
