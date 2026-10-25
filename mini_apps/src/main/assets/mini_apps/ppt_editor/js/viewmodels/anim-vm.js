// Anim — what moves on a slide, in the order it plays, inside the format panel: add an effect to the picked box (it comes in, stresses, goes out, or follows a path), pick one to change how it starts and how long it takes, move it in the order, take it away.
// An effect is changed by taking it out and putting the same one back with the new numbers, in one step (one undo).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, V = window.InspView, M = window.Anim = { items: [], pick: -1, slide: -1 };

  function label(a) {
    var n = a.el && window.Stage && Stage.node(a.el); if (!n) return a.el || '';
    var tx = n.text && n.text.lines ? n.text.lines.map(function (l) { return (l.runs || []).map(function (r) { return r.text; }).join(''); }).join(' ').trim() : '';
    return tx ? tx.slice(0, 28) : t('ip.type.' + (n.type === 'text' ? 'text' : n.type));
  }
  M.paint = function () { var host = $('ipAnim'); if (host) host.innerHTML = V.anim(M.items, M.pick, label); };
  M.load = async function () {
    if (!Wide.pc || !Deck.info) return; var i = Deck.cur, items = [];
    try { items = await PptSvc.animations(i); } catch (e) { /* none */ }
    if (i !== Deck.cur) return; M.items = items; M.slide = i;
    if (Deck.sel) { var k = items.findIndex(function (a) { return a.el === Deck.sel; }); if (k >= 0) M.pick = k; }
    if (M.pick >= items.length) M.pick = items.length - 1; M.paint();
  };
  function opsFor(a, patch, after) {
    var o = Object.assign({ effect: a.effect, trigger: a.trigger, duration: a.durationMs, delay: a.delayMs }, a.direction ? { direction: a.direction } : {}, a.paragraph != null ? { paragraph: a.paragraph } : {}, patch);
    if (after !== undefined && after >= 0) o.after = after; return [Deck.op('removeAnimation', null, { seq: a.seq }), Deck.op('addAnimation', a.el, o)];
  }
  function edit(patch) { var a = M.items[M.pick]; if (!a) return; Viewer.run(opsFor(a, patch, a.seq - 1), 'busy.edit').then(function () { M.load(); }); }
  var H = Insp.H, N = Insp.N;
  function menu(btn, items) { var r = btn.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, items, { from: btn }); }

  H['an-pick'] = function (b) { M.pick = +b.dataset.v; var a = M.items[M.pick]; if (a && a.el && Stage.node(a.el)) Sel.set([a.el]); else M.paint(); };
  H['an-trig'] = function (b) { var a = M.items[M.pick]; menu(b, V.TRIG.map(function (k) { return { t: t('an.t.' + k), on: a.trigger === k, go: function () { edit({ trigger: k }); } }; })); };
  H['an-eff'] = function (b) { var a = M.items[M.pick]; menu(b, kindMenu(a.kind, function (k) { return a.effect === k; }, function (k) { edit({ effect: k }); })); };
  H['an-dir'] = function (b) { var a = M.items[M.pick]; menu(b, V.DIR.map(function (k) { return { t: t('an.d.' + k), on: a.direction === k, go: function () { edit({ direction: k }); } }; })); };
  H['an-dur'] = function (b) { var a = M.items[M.pick]; edit({ duration: Math.max(100, a.durationMs + (b.dataset.v === '+' ? 100 : -100)) }); };
  H['an-delay'] = function (b) { var a = M.items[M.pick]; edit({ delay: Math.max(0, a.delayMs + (b.dataset.v === '+' ? 100 : -100)) }); };
  N['an-dur'] = function (v) { if (v >= 0.1 && v <= 60) edit({ duration: Math.round(v * 1000) }); }; N['an-delay'] = function (v) { if (v >= 0 && v <= 60) edit({ delay: Math.round(v * 1000) }); };
  H['an-up'] = function () { var a = M.items[M.pick]; if (a && a.seq > 0) { M.pick--; Viewer.run([Deck.op('reorderAnimation', null, { seq: a.seq, to: a.seq - 1 })], 'busy.edit').then(M.load); } };
  H['an-down'] = function () { var a = M.items[M.pick]; if (a && a.seq < M.items.length - 1) { M.pick++; Viewer.run([Deck.op('reorderAnimation', null, { seq: a.seq, to: a.seq + 1 })], 'busy.edit').then(M.load); } };
  H['an-del'] = function () { var a = M.items[M.pick]; if (a) Viewer.run([Deck.op('removeAnimation', null, { seq: a.seq })], 'busy.edit').then(M.load); };
  H['an-play'] = function () { Present.open(Deck.cur); };
  H['an-add'] = function (b) {
    if (!Deck.sel) return Ui.toast(t('mo.pick'));
    function add(k) { Viewer.run([Deck.op('addAnimation', Deck.sel, { effect: k, trigger: 'onClick' })], 'busy.edit').then(function () { M.pick = M.items.length; M.load(); }); }
    var sub = function (title, kind) { return { t: title, sub: kindMenu(kind, function () { return false; }, add) }; };
    menu(b, [sub(t('an.entr'), 'entr'), sub(t('an.emph'), 'emph'), sub(t('an.exit'), 'exit'), sub(t('an.path'), 'path')]);
  };
  function kindMenu(kind, isOn, go) { return (V.ANIM[kind] || []).map(function (k) { return { t: t('an.k.' + k), on: isOn(k), go: function () { go(k); } }; }); }
})();
