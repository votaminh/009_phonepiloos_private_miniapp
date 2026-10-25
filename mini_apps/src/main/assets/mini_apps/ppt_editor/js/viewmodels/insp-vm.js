// Insp — the format panel of a computer: what the picked boxes look like and what each control does. Every control is one op on every picked box (Sel); the panel is drawn again from the engine's answer.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, S = window.Stage, I = window.Insp = { lock: false, to: '' }, H = {}, N = {};

  function unit() { return I18n.locale().indexOf('vi') === 0 ? { n: 'cm', f: 360000 } : { n: 'in', f: 914400 }; }
  I.unit = unit;
  function cur() { return I.q || {}; }
  function fnt() { return cur().font || {}; }
  function pt(v) { return Math.round(v * 12700); }
  function hex8(c, pct) { c = String(c || '').slice(0, 7); if (!/^#[0-9a-f]{6}$/i.test(c)) return c; var a = Math.round(Math.max(0, Math.min(100, pct)) / 100 * 255); return pct >= 100 ? c : c + (a < 16 ? '0' : '') + a.toString(16).toUpperCase(); }
  function strokeNow() { var s = cur().stroke, m = cur().more || {}; return { color: s ? s.color : C('ink'), widthEmu: pt(s ? s.widthPt : 1.5), dash: m.dash && m.dash !== 'solid' ? m.dash : undefined }; }

  // the panel lives in the column on the right of a computer, or in a bottom sheet (the "Format" item of All features) on a touch screen
  I.host = function () { var sh = $('inspSheet'); if (sh && $('sheet').classList.contains('on')) return sh; return Wide.pc ? $('quick') : null; };
  I.open = function () { var el = $('inspSheet'); return !!el && $('sheet').classList.contains('on'); };

  // ---- drawing -----------------------------------------------------------------------------------------------------------------------------------
  I.render = function (q) {
    var el = I.host(); if (!el) return; var n = Sel.count(), s = { n: n, q: q || {}, one: n === 1, u: unit(), lock: I.lock, alignTo: I.to || (n > 1 ? 'selection' : 'slide') }; I.q = q;
    if (!n) { var sl = Deck.slide() || {}; s.slide = sl; s.bg = sl.bg || ''; s.shape = Math.abs(Deck.info.size.cx / Deck.info.size.cy - 4 / 3) < 0.05 ? '4:3' : '16:9'; }
    else {
      var node = S.node(Deck.sel), type = (q && q.type) || (node && node.type) || 'shape', line = !!(node && node.line), m = (q && q.more) || {}, k = Deck.k();
      s.type = line ? 'line' : type; s.isLine = line; s.hasText = (type === 'text' || type === 'shape') && !line; s.canFill = (type === 'text' || type === 'shape') && !line; s.canLine = type === 'text' || type === 'shape' || type === 'picture';
      s.canFx = type !== 'table' && type !== 'chart'; s.isChart = type === 'chart'; s.isPic = type === 'picture'; s.isTable = type === 'table'; s.canLink = type !== 'group'; s.cell = window.Cells ? Cells.valid() : null; s.tnode = node;
      if (n > 1) { var bb = Sel.bounds(); s.bb = { x: bb.x * k, y: bb.y * k, cx: bb.w * k, cy: bb.h * k, rot: 0 }; } else s.bb = { x: m.x, y: m.y, cx: m.cx, cy: m.cy, rot: m.rot };
    }
    if (I.tableSizes) I.tableSizes(s); var top = el.scrollTop; el.innerHTML = InspView.panel(s); el.scrollTop = top; if (window.Anim) { Anim.paint(); Anim.load(); }
  };

  // ---- the controls ---------------------------------------------------------------------------------------------------------------------------------
  function menu(btn, items) { var r = btn.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, items, { from: btn }); }
  var fx = function (name, on) { return function () { var f = {}; f[name] = on(); return Sel.effects(f); }; };

  H.sec = function (b) { var k = b.dataset.k; InspView.shut[k] = !InspView.shut[k]; b.parentNode.classList.toggle('shut', !!InspView.shut[k]); };
  // text
  H['t-font'] = function (b) { menu(b, Fonts.list.map(function (f) { return { t: f.n, on: String(fnt().family).toLowerCase() === f.n.toLowerCase(), go: function () { Sel.font({ fontFamily: f.n }); } }; })); };
  H['t-size'] = function (b) { var s = fnt().size || 18, d = b.dataset.v === '+' ? 1 : -1; Sel.font({ fontSizePt: Math.max(4, Math.min(200, Math.round((s + d * (s >= 36 ? 2 : 1)) * 2) / 2)) }); };
  H['t-b'] = function () { Sel.font({ bold: !fnt().bold }); }; H['t-i'] = function () { Sel.font({ italic: !fnt().italic }); };
  H['t-u'] = function () { Sel.font({ underline: !fnt().underline }); }; H['t-s'] = function () { Sel.font({ strike: !(cur().more || {}).strike }); };
  H['t-color'] = function (b) { ColorPop.show(b, fnt().color, function (c) { Sel.font({ color: c }); }); };
  H['t-al'] = function (b) { Sel.para({ align: b.dataset.v }); }; H['t-anc'] = function (b) { Sel.anchor(b.dataset.v); };
  H['t-bul'] = function () { var p = (cur().paragraphs || [])[0]; Sel.para({ bullet: p && p.bullet === 'char' ? 'none' : 'char' }); };
  H['t-num'] = function () { var p = (cur().paragraphs || [])[0]; Sel.para({ bullet: p && p.bullet === 'number' ? 'none' : 'number' }); };
  H['t-ind'] = function (b) { Sel.para({ indentDelta: +b.dataset.v }); };
  H['t-ls'] = function (b) { var c = Math.round(cur().lineHeight || 100); Sel.para({ lineSpacingPct: Math.max(60, Math.min(300, c + (b.dataset.v === '+' ? 10 : -10))) }); };
  H['t-fit'] = function (b) { var m = (cur().more || {}).autofit || 'none'; menu(b, ['none', 'shrink', 'resize'].map(function (k) { return { t: t('ip.fit.' + k), on: m === k, go: function () { Sel.body({ autofit: k }); } }; })); };
  N['t-size'] = function (v) { if (v >= 4 && v <= 200) Sel.font({ fontSizePt: Math.round(v * 2) / 2 }); };
  N['t-ls'] = function (v) { if (v >= 20 && v <= 500) Sel.para({ lineSpacingPct: Math.round(v) }); };
  N['t-sb'] = function (v) { if (v >= 0 && v <= 200) Sel.para({ spaceBeforePt: v }); }; N['t-sa'] = function (v) { if (v >= 0 && v <= 200) Sel.para({ spaceAfterPt: v }); };
  // fill
  function grad() { return (cur().more || {}).gradient; }
  function setGrad(stops, angle, path) { var g = { stops: stops, angle: angle }; if (path) g.path = path; return Sel.fill(g); }
  H['f-kind'] = function (b) {
    var k = b.dataset.v, q = cur(), c = q.fill && q.fill !== 'none' ? q.fill : (grad() ? grad().stops[0].color : C('accent'));
    if (k === 'none') Sel.fill('none'); else if (k === 'solid') Sel.fill(c); else setGrad([{ pos: 0, color: c }, { pos: 1, color: C('sw_white') }], 5400000);
  };
  H['f-color'] = function (b) { ColorPop.show(b, cur().fill, function (c) { Sel.fill(c); }); };
  N['f-alpha'] = function (v) { if (v >= 0 && v <= 100) Sel.fill(hex8(cur().fill, v)); };
  H['f-g0'] = function (b) { var g = grad(); ColorPop.show(b, g.stops[0].color, function (c) { var s = g.stops.slice(); s[0] = { pos: s[0].pos, color: c }; setGrad(s, g.angle, g.path); }); };
  H['f-g1'] = function (b) { var g = grad(), l = g.stops.length - 1; ColorPop.show(b, g.stops[l].color, function (c) { var s = g.stops.slice(); s[l] = { pos: s[l].pos, color: c }; setGrad(s, g.angle, g.path); }); };
  H['f-gswap'] = function () { var g = grad(), s = g.stops.map(function (x, i) { return { pos: x.pos, color: g.stops[g.stops.length - 1 - i].color }; }); setGrad(s, g.angle, g.path); };
  H['f-gtype'] = function () { var g = grad(); setGrad(g.stops, g.angle, g.path ? null : 'circle'); };
  N['f-gang'] = function (v) { var g = grad(); if (g) setGrad(g.stops, Math.round(((v % 360) + 360) % 360 * 60000), g.path); };
  // outline
  H['l-kind'] = function (b) { if (b.dataset.v === 'none') Sel.stroke(null); else Sel.stroke(strokeNow()); };
  H['l-color'] = function (b) { ColorPop.show(b, (cur().stroke || {}).color, function (c) { Sel.stroke(Object.assign(strokeNow(), { color: c })); }); };
  H['l-w'] = function (b) { var s = strokeNow(); s.widthEmu = pt(Math.max(0.25, Math.round((s.widthEmu / 12700 + (b.dataset.v === '+' ? 0.5 : -0.5)) * 100) / 100)); Sel.stroke(s); };
  N['l-w'] = function (v) { if (v > 0 && v <= 100) Sel.stroke(Object.assign(strokeNow(), { widthEmu: pt(v) })); };
  H['l-dash'] = function (b) { var m = (cur().more || {}).dash || 'solid'; menu(b, InspView.DASH.map(function (d) { return { t: InspView.dashName(d), on: m === d, go: function () { Sel.stroke(Object.assign(strokeNow(), { dash: d })); } }; })); };
  // effects
  H['e-shadow'] = function () { var on = !!(cur().shadow || (cur().more || {}).shadowFull); Sel.effects({ shadow: on ? null : { color: C('shadow_op'), blurRad: pt(6), dist: pt(3), dirDeg: 45 } }); };
  function shadow(patch) { var sh = (cur().more || {}).shadowFull || {}; return Sel.effects({ shadow: Object.assign({ color: sh.color || C('shadow_op'), blurRad: sh.blurRad != null ? sh.blurRad : pt(6), dist: sh.dist != null ? sh.dist : pt(3), dirDeg: sh.dirDeg != null ? sh.dirDeg : 45 }, patch) }); }
  H['e-sblur'] = function (b) { var sh = (cur().more || {}).shadowFull || {}; shadow({ blurRad: Math.max(0, (sh.blurRad != null ? sh.blurRad : pt(6)) + (b.dataset.v === '+' ? pt(1) : -pt(1))) }); };
  H['e-sdist'] = function (b) { var sh = (cur().more || {}).shadowFull || {}; shadow({ dist: Math.max(0, (sh.dist != null ? sh.dist : pt(3)) + (b.dataset.v === '+' ? pt(1) : -pt(1))) }); };
  N['e-sblur'] = function (v) { shadow({ blurRad: pt(Math.max(0, v)) }); }; N['e-sdist'] = function (v) { shadow({ dist: pt(Math.max(0, v)) }); };
  H['e-glow'] = function () { var g = (cur().more || {}).glow; Sel.effects({ glow: g ? null : { color: C('accent_hi'), radius: pt(8) } }); };
  H['e-gcolor'] = function (b) { var g = (cur().more || {}).glow; ColorPop.show(b, g.color, function (c) { Sel.effects({ glow: { color: c, radius: g.radius } }); }); };
  H['e-grad'] = function (b) { var g = (cur().more || {}).glow; Sel.effects({ glow: { color: g.color, radius: Math.max(pt(1), g.radius + (b.dataset.v === '+' ? pt(1) : -pt(1))) } }); };
  N['e-grad'] = function (v) { var g = (cur().more || {}).glow; if (g && v > 0) Sel.effects({ glow: { color: g.color, radius: pt(v) } }); };
  H['e-refl'] = function () { var on = (cur().more || {}).reflection; Sel.effects({ reflection: on ? null : { blurRad: pt(1), startA: 0.4, endPos: 0.5, dist: 0 } }); };
  H['e-soft'] = function (b) { var v = (cur().more || {}).softEdge || 0; Sel.effects({ softEdge: Math.max(0, v + (b.dataset.v === '+' ? pt(2) : -pt(2))) || null }); };
  N['e-soft'] = function (v) { Sel.effects({ softEdge: v > 0 ? pt(v) : null }); };
  // size and place
  function bounds() { var ns = Sel.nodes(); return ns.length ? Sel.bounds(ns) : null; }
  function put(field, v) {
    var b = bounds(), k = Deck.k(), u = unit(), px = v * u.f / k; if (!b || !(px >= 0)) return; var nb = { x: b.x, y: b.y, w: b.w, h: b.h };
    if (field === 'x') nb.x = px; else if (field === 'y') nb.y = px;
    else if (field === 'w') { nb.w = Math.max(4, px); if (I.lock) nb.h = b.h * nb.w / b.w; } else { nb.h = Math.max(4, px); if (I.lock) nb.w = b.w * nb.h / b.h; }
    Sel.setBounds(nb);
  }
  N['z-x'] = function (v) { put('x', v); }; N['z-y'] = function (v) { put('y', v); }; N['z-w'] = function (v) { put('w', v); }; N['z-h'] = function (v) { put('h', v); }; N['z-rot'] = function (v) { Sel.rotate(v); };
  H['z-lock'] = function () { I.lock = !I.lock; I.render(I.q); };
  H['a-rot'] = function () { Sel.rotate(((cur().more || {}).rot || 0) + 90); };
  H['a-flip'] = function (b) { Sel.flip(b.dataset.v); };
  H['a-order'] = function (b) { Sel.order(b.dataset.v); }; H['a-align'] = function (b) { Sel.align(b.dataset.v, I.to || undefined); };
  H['a-to'] = function (b) { I.to = b.dataset.v; I.render(I.q); }; H['a-dist'] = function (b) { Sel.distribute(b.dataset.v, I.to || undefined); };
  H['a-group'] = function (b) { if (b.dataset.v === 'group') Sel.group(); else Sel.ungroup(); };
  // picture, table, link
  H['p-op'] = function (b) { var o = cur().opacity == null ? 1 : cur().opacity; Sel.run(Sel.ordered().map(function (id) { return Deck.op('setPictureOpacity', id, { opacity: Math.max(0.1, Math.min(1, Math.round((o + (b.dataset.v === '+' ? 0.1 : -0.1)) * 10) / 10)) }); })); };
  N['p-op'] = function (v) { if (v >= 10 && v <= 100) Sel.run(Sel.ordered().map(function (id) { return Deck.op('setPictureOpacity', id, { opacity: v / 100 }); })); };
  H['p-crop'] = function () { A['q-crop'](); }; H['p-crop-reset'] = function () { A['cr-reset'](); }; H['p-replace'] = function () { A['p-replace'](); };
  H['tb-rows'] = function (b) { A['tb-do']({ dataset: { k: b.dataset.v === '+' ? 'insert-row' : 'delete-row' } }); };
  H['tb-cols'] = function (b) { A['tb-do']({ dataset: { k: b.dataset.v === '+' ? 'insert-col' : 'delete-col' } }); };
  H['tb-edit'] = function () { A['tb-edit'](); };
  H['k-link'] = function () { A['i-link'](); }; H['k-none'] = function () { A['lk-none'](); };
  // the slide
  H['s-layout'] = function (b) { Layout.pick(b.dataset.v, false); };
  H['s-bg'] = function (b) { ColorPop.show(b, '', function (c) { A['bg-set']({ dataset: { v: c } }); }); }; H['s-bg-reset'] = function () { A['bg-reset'](); };
  H['s-trans'] = function (b) { var m = (Deck.slide() || {}).transition || 'none'; menu(b, ['none', 'fade', 'push', 'wipe', 'split', 'circle', 'cover', 'pull', 'dissolve', 'zoom', 'morph', 'random'].map(function (k) { return { t: t('mo.' + k), on: m === k, go: function () { Viewer.run([Deck.op('setTransition', null, { kind: k })], 'busy.edit'); } }; })); };
  H['s-adv'] = function (b) { var s = Deck.slide(), c = s.advance ? Math.round(s.advance / 1000) : 0, nx = Math.max(0, Math.min(600, c + (b.dataset.v === '+' ? (c >= 10 ? 5 : 1) : (c > 10 ? -5 : -1)))); Viewer.run([Deck.op('setAdvanceTime', null, { ms: nx ? nx * 1000 : null })], 'busy.edit'); };
  N['s-adv'] = function (v) { if (v >= 0 && v <= 600) Viewer.run([Deck.op('setAdvanceTime', null, { ms: v ? Math.round(v) * 1000 : null })], 'busy.edit'); };
  H['s-trans-all'] = function () {
    var s = Deck.slide(), ops = []; for (var i = 0; i < Deck.count(); i++) { ops.push(Deck.op('setTransition', null, { kind: s.transition || 'none' }, i)); ops.push(Deck.op('setAdvanceTime', null, { ms: s.advance || null }, i)); }
    Viewer.run(ops, 'busy.slides', { rebuild: true });
  };
  H['s-hide'] = function () { A['d-hide'](); };
  H['s-size'] = function (b) { menu(b, ['16:9', '4:3'].map(function (k) { return { t: k, go: function () { A['sz-set']({ dataset: { k: k } }); } }; })); };
  H['s-look'] = function (b) { A['l-look']({ dataset: { k: b.dataset.v } }); }; H['s-footer'] = function () { A['m-footer'](); };

  // ---- events --------------------------------------------------------------------------------------------------------------------------------------
  I.init = function () {
    function click(e) { var b = e.target.closest('[data-ip]'); if (!b || !H[b.dataset.ip]) return; e.stopPropagation(); H[b.dataset.ip](b, e); }
    function change(e) { var i = e.target.dataset && e.target.dataset.ipn; if (!i || !N[i]) return; var v = parseFloat(String(e.target.value).replace(',', '.')); if (isNaN(v)) { I.render(I.q); return; } N[i](v); }
    function key(e) { if (e.target.dataset && e.target.dataset.ipn && e.key === 'Enter') e.target.blur(); }
    var el = $('quick'), sh = $('sheet');
    el.addEventListener('click', function (e) { if (Wide.pc) click(e); }); el.addEventListener('change', function (e) { if (Wide.pc) change(e); }); el.addEventListener('keydown', key);
    sh.addEventListener('click', function (e) { if ($('inspSheet') && $('inspSheet').contains(e.target)) click(e); }); sh.addEventListener('change', function (e) { if ($('inspSheet') && $('inspSheet').contains(e.target)) change(e); }); sh.addEventListener('keydown', key);
  };
  // touch: the same panel in a bottom sheet
  A['insp-open'] = function () { Ui.closeSheet(); setTimeout(function () { Ui.sheet('insp', '<h2 class="sh-h">' + Ui.esc(t('ip.title')) + '</h2><div id="inspSheet" class="ip-sheet"></div>'); Quick.render(); }, 80); };
  I.H = H; I.N = N;
})();
