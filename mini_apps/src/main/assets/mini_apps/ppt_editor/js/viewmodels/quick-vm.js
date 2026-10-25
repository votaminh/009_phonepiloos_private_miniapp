// Quick — the bar under the slide: what the selected box can do (text, box, arrange) and what the slide itself can do when nothing is selected. Every button is one op for the engine.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var Q = window.Quick = { tab: null, last: null };

  Q.render = async function () {
    var el = $('quick'), id = Deck.sel, s = Deck.slide(); if (!s) return;
    if (!id) { el.innerHTML = EditView.quick({ sel: false, hidden: s.hidden }); return; }
    var n = Stage.node(id), g = Deck.gen, r = null;
    try { r = await Deck.read(id); } catch (e) { /* a box the engine cannot describe still moves */ }
    if (g !== Deck.gen || Deck.sel !== id) return;
    var hasText = !!r && (r.type === 'text' || r.type === 'shape') && !(n && n.line), isTable = !!r && r.type === 'table', tab = Q.tab || (hasText ? 'text' : isTable ? 'tbl' : 'box');
    if (tab === 'text' && !hasText) tab = isTable ? 'tbl' : 'box'; if (tab === 'tbl' && !isTable) tab = 'box';
    Q.last = r; el.innerHTML = EditView.quick({ sel: true, tab: tab, read: r, hasText: hasText, isTable: isTable, hidden: s.hidden });
  };
  function el() { return Deck.sel; }
  function run(op, key) { return Viewer.run([op], key); }
  function font(patch) { return run(Deck.op('setFont', el(), { font: patch })); }
  function fmt(patch) { return run(Deck.op('setParagraphFormat', el(), { format: patch })); }
  function cur() { return (Q.last && Q.last.font) || {}; }

  A['q-tab'] = function (b) { Q.tab = b.dataset.k; Q.render(); };
  A['q-size'] = function (b) { var f = cur(), s = f.size || 18, d = b.dataset.v === '+' ? 1 : -1; font({ fontSizePt: Math.max(4, Math.min(200, Math.round((s + d) * 2) / 2)) }); };
  A['q-b'] = function () { font({ bold: !cur().bold }); };
  A['q-i'] = function () { font({ italic: !cur().italic }); };
  A['q-u'] = function () { font({ underline: !cur().underline }); };
  A['q-al'] = function (b) { fmt({ align: b.dataset.v }); };
  A['q-bul'] = function () { var ps = (Q.last && Q.last.paragraphs) || [], on = ps[0] && ps[0].bullet !== 'none'; fmt({ bullet: on ? 'none' : 'char' }); };
  A['q-ind'] = function (b) { fmt({ indentDelta: +b.dataset.v }); };
  A['q-color'] = function (b) { font({ color: b.dataset.v }); };
  A['q-fill'] = function (b) { run(Deck.op('setFill', el(), { fill: b.dataset.v === 'none' || b.dataset.v === 'transparent' ? 'none' : b.dataset.v })); };
  A['q-stroke'] = function (b) {
    var r = Q.last || {}, w = r.stroke ? r.stroke.widthPt : 1.5;
    run(Deck.op('setStroke', el(), { stroke: b.dataset.v === 'none' || b.dataset.v === 'transparent' ? null : { color: b.dataset.v, widthEmu: Math.round(w * 12700) } }));
  };
  A['q-lw'] = function (b) { var r = Q.last || {}; if (!r.stroke) return Ui.toast(t('q.pickline')); run(Deck.op('setStroke', el(), { stroke: { color: r.stroke.color, widthEmu: Math.round(Math.max(0.25, r.stroke.widthPt + (b.dataset.v === '+' ? 0.5 : -0.5)) * 12700) } })); };
  // tables: every cell in a sheet, rows and columns added or taken away at the end
  A['tb-edit'] = function () { var r = Q.last; if (!r || !r.cells) return; Q.cells = r.cells; Ui.sheet('table', SheetsView.table(r.cells)); };
  A['tb-apply'] = function () {
    var ops = []; Array.prototype.forEach.call(document.querySelectorAll('#sheet .tb-c'), function (i) {
      var r = +i.dataset.r, c = +i.dataset.c; if (i.value !== Q.cells[r][c]) ops.push(Deck.op('setTableCell', el(), { row: r, col: c, paragraphs: i.value ? [{ runs: [{ text: i.value }] }] : [] }));
    }); Ui.closeSheet(); if (ops.length) Viewer.run(ops, 'busy.edit');
  };
  A['tb-do'] = function (b) { var r = Q.last, k = b.dataset.k; if (!r) return; var last = /row/.test(k) ? r.rows - 1 : r.cols - 1; if (/delete/.test(k) && last < 1) return Ui.toast(t('tb.keep')); Viewer.run([Deck.op('tableStructure', el(), { kind: k, index: last, before: false })], 'busy.edit'); };
  A['q-anc'] = function (b) { run(Deck.op('setTextAnchor', el(), { anchor: b.dataset.v })); };
  A['q-ls'] = function (b) { var c = Math.round((Q.last && Q.last.lineHeight) || 100); fmt({ lineSpacingPct: Math.max(60, Math.min(300, c + (b.dataset.v === '+' ? 10 : -10))) }); };
  A['q-shadow'] = function () { var on = Q.last && Q.last.shadow; run(Deck.op('setEffects', el(), { effects: { shadow: on ? null : { color: C('shadow_op'), blurRad: 76200, dist: 38100, dirDeg: 45 } } })); };
  A['q-op'] = function (b) { var o = Q.last && Q.last.opacity != null ? Q.last.opacity : 1; run(Deck.op('setPictureOpacity', el(), { opacity: Math.max(0.1, Math.min(1, Math.round((o + (b.dataset.v === '+' ? 0.1 : -0.1)) * 10) / 10)) })); };
  // cropping a picture: four sliders, the result is one op
  var crop = null;
  A['q-crop'] = function () { crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, (Q.last && Q.last.srcRect) || {}); Ui.sheet('crop', SheetsView.crop(crop)); };
  A['cr-step'] = function (b) { var k = b.dataset.k; crop[k] = Math.max(0, Math.min(0.45, Math.round((crop[k] + (b.dataset.v === '+' ? 0.05 : -0.05)) * 100) / 100)); $('cr_' + k).textContent = Math.round(crop[k] * 100) + '%'; };
  A['cr-apply'] = function () { var o = crop; Ui.closeSheet(); var none = !(o.l || o.t || o.r || o.b); run(Deck.op('setPictureSrcRect', el(), { srcRect: none ? null : o })); };
  A['cr-reset'] = function () { Ui.closeSheet(); run(Deck.op('setPictureSrcRect', el(), { srcRect: null })); };
  A['a-front'] = function () { run(Deck.op('reorderElement', el(), { dir: 'front' })); };
  A['a-back'] = function () { run(Deck.op('reorderElement', el(), { dir: 'back' })); };
  A['a-fwd'] = function () { run(Deck.op('reorderElement', el(), { dir: 'forward' })); };
  A['a-bwd'] = function () { run(Deck.op('reorderElement', el(), { dir: 'backward' })); };
  A['a-al'] = function (b) { run(Deck.op('alignElements', null, { els: [el()], mode: b.dataset.v, to: 'slide' })); };
  A['a-flip'] = function () { run(Deck.op('flipElements', null, { els: [el()], axis: 'h' })); };
  A['a-rot'] = function () {
    var n = Stage.node(el()); if (!n) return; var b = n.box, k = Deck.k(), e = Math.round;
    run(Deck.op('setTransform', el(), { box: { x: e(b.x * k), y: e(b.y * k), cx: e(b.w * k), cy: e(b.h * k) }, rotDeg: ((b.rotationDeg || 0) + 90) % 360 }));
  };
  A['a-del'] = function () { var id = el(); if (!id) return; Deck.sel = null; run(Deck.op('deleteElement', id)).then(function () { Stage.select(null); }); };
  // a copy goes a little down and to the right, and is the new selection
  A['a-dup'] = function () {
    var id = el(); if (!id) return; Viewer.dup(Deck.cur, id).then(function (added) { if (added) Stage.select(added); });
  };
  A['d-hide'] = function () { var s = Deck.slide(); run(Deck.op('setHidden', null, { hidden: !s.hidden })); };
})();
