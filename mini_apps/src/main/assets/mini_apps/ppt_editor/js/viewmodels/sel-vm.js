// Sel — what is selected on the slide when it is more than one box: the list (the main box is Deck.sel, the others Deck.more), the frame round all of them, and the things that work on many at once
// (delete, copy, cut, paste, duplicate, group, align, order, nudge). A phone selects one box; a computer selects many (Shift + click, a box dragged over the slide, Ctrl + A).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, S = window.Stage, M = window.Sel = { clip: null };

  // ---- the list ------------------------------------------------------------------------------------------------------------------------------
  M.ids = function () { return Deck.sel ? [Deck.sel].concat(Deck.more || []) : []; };
  M.count = function () { return Deck.sel ? 1 + (Deck.more || []).length : 0; };
  // in the order the slide is drawn (back to front)
  M.ordered = function () { var have = {}; M.ids().forEach(function (i) { have[i] = 1; }); return (S.tree ? S.tree.nodes : []).filter(function (n) { return have[n.sourceId]; }).map(function (n) { return n.sourceId; }); };
  M.nodes = function () { return M.ordered().map(function (i) { return S.node(i); }).filter(Boolean); };
  M.has = function (id) { return M.ids().indexOf(id) >= 0; };
  M.set = function (ids, main) {
    ids = ids.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    if (!ids.length) { S.select(null); return; }
    main = main && ids.indexOf(main) >= 0 ? main : ids[ids.length - 1];
    S.select(main); Deck.more = ids.filter(function (i) { return i !== main; }); S.frame(); if (Deck.more.length) Quick.render(); if (window.Desk) Desk.sync();
  };
  M.toggle = function (id) { var ids = M.ids(), k = ids.indexOf(id); if (k >= 0) ids.splice(k, 1); else ids.push(id); M.set(ids, k >= 0 ? null : id); };
  M.all = function () { if (!S.tree) return; M.set(S.tree.nodes.filter(function (n) { return !n.decoration && !n.background && !n.empty; }).map(function (n) { return n.sourceId; })); };
  // boxes that vanished after an edit leave the list
  M.prune = function () { if (Deck.more) Deck.more = Deck.more.filter(function (i) { return !!S.node(i); }); };

  // ---- the frame round many ------------------------------------------------------------------------------------------------------------
  M.bounds = function (ns) {
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    (ns || M.nodes()).forEach(function (n) {
      var b = n.box, a = (b.rotationDeg || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), w = b.w * c + b.h * s, h = b.w * s + b.h * c;
      x1 = Math.min(x1, b.centerX - w / 2); y1 = Math.min(y1, b.centerY - h / 2); x2 = Math.max(x2, b.centerX + w / 2); y2 = Math.max(y2, b.centerY + h / 2);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  // the outlines of the other boxes, and the one frame with the handles round all of them
  M.paint = function () {
    var host = $('msel'); if (!host) return; var n = M.count();
    if (n < 2) { host.innerHTML = ''; return; }
    host.innerHTML = M.nodes().map(function (x) { var b = x.box; return '<i class="mf" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;transform:rotate(' + (b.rotationDeg || 0) + 'deg)"></i>'; }).join('');
  };
  M.frame = function () {
    var fr = $('frame'), bb = M.bounds(); fr.style.cssText = 'left:' + bb.x + 'px;top:' + bb.y + 'px;width:' + bb.w + 'px;height:' + bb.h + 'px;transform:none';
    fr.dataset.k = 'multi'; if (fr.dataset.s !== 'multi') { fr.innerHTML = EditView.frame(false); fr.dataset.s = 'multi'; } fr.classList.add('on'); $('stFloat').classList.remove('on'); M.paint();
  };

  // ---- the same op on each box ----------------------------------------------------------------------------------------------------------
  function each(name, extra) { return M.ordered().map(function (id) { return Deck.op(name, id, typeof extra === 'function' ? extra(id) : extra); }); }
  M.run = async function (ops, key, opt) { if (window.Inline && Inline.on) await Inline.commit(); return ops.length ? Viewer.run(ops, key || 'busy.edit', opt) : false; };
  M.remove = function () { var ops = each('deleteElement'); if (!ops.length) return; Deck.sel = null; Deck.more = []; return M.run(ops).then(function () { S.select(null); }); };
  M.fill = function (v) { return M.run(each('setFill', { fill: v })); };
  M.font = function (patch) { if (window.Inline && Inline.on) return Inline.font(patch); return M.run(each('setFont', { font: patch })); };
  M.para = function (patch) { if (window.Inline && Inline.on) return Inline.para(patch); return M.run(each('setParagraphFormat', { format: patch })); };
  M.anchor = function (a) { return M.run(each('setTextAnchor', { anchor: a })); };
  M.body = function (props) { return M.run(each('setTextBodyProps', { props: props })); };
  M.stroke = function (st) { return M.run(each('setStroke', { stroke: st })); };
  M.effects = function (fx) { return M.run(each('setEffects', { effects: fx })); };
  // the boxes get a new place and size as a whole (a box alone: exactly; many: scaled inside the frame round them); nb in slide pixels
  M.setBounds = function (nb) {
    var ns = M.nodes(); if (!ns.length) return; var B = M.bounds(ns), sx = nb.w / (B.w || 1), sy = nb.h / (B.h || 1), k = Deck.k(), e = Math.round;
    if (ns.length === 1) { var b = ns[0].box; return M.run([Deck.op('setTransform', ns[0].sourceId, { box: { x: e(nb.x * k), y: e(nb.y * k), cx: e(nb.w * k), cy: e(nb.h * k) }, rotDeg: Math.round((b.rotationDeg || 0) * 10) / 10 })]); }
    return M.run(ns.map(function (n) { var b = n.box; return Deck.op('setTransform', n.sourceId, { box: { x: e((nb.x + (b.x - B.x) * sx) * k), y: e((nb.y + (b.y - B.y) * sy) * k), cx: e(b.w * sx * k), cy: e(b.h * sy * k) }, rotDeg: Math.round((b.rotationDeg || 0) * 10) / 10 }); }));
  };
  M.rotate = function (deg) { var n = M.nodes()[0]; if (!n) return; var b = n.box, k = Deck.k(), e = Math.round; return M.run([Deck.op('setTransform', n.sourceId, { box: { x: e(b.x * k), y: e(b.y * k), cx: e(b.w * k), cy: e(b.h * k) }, rotDeg: ((deg % 360) + 360) % 360 })]); };

  // ---- copy, cut, paste, duplicate ----------------------------------------------------------------------------------------------------------
  // the boxes are copied by the engine (its own clipboard data), kept here so a paste can go to another slide too
  M.copy = async function (cut) {
    var ids = M.ordered(); if (!ids.length) return false;
    try { M.clip = { items: await PptSvc.copy(Deck.cur, ids), n: ids.length, at: 0 }; } catch (e) { App.fail('err.generic', e); return false; }
    if (!cut) Ui.toast(t('dk.copied', { n: ids.length }));
    if (cut) await M.remove(); return true;
  };
  M.paste = async function () {
    var c = M.clip; if (!c) return; c.at++; var off = 228600 * Math.min(c.at, 6);
    var r = await Viewer.run([Deck.op('pasteElements', null, { items: c.items, dx: c.at > 1 || true ? off : 0, dy: off })], 'busy.edit', {});
    if (r && r.added && r.added.length) M.set(r.added); return r;
  };
  M.dup = async function () { if (!await M.copy(false)) return; M.clip.at = 0; return M.paste(); };

  // ---- group, order, align ----------------------------------------------------------------------------------------------------------------
  M.group = async function () { var ids = M.ordered(); if (ids.length < 2) return; var r = await Viewer.run([Deck.op('groupElements', null, { els: ids })], 'busy.edit', { select: true }); if (r && r.added && r.added[0]) S.select(r.added[0]); };
  M.ungroup = async function () { var n = Deck.sel && S.node(Deck.sel); if (!n || n.type !== 'group') return; var r = await Viewer.run([Deck.op('ungroupElement', Deck.sel)], 'busy.edit'); if (r && r.added && r.added.length) M.set(r.added); };
  M.order = function (dir) {
    var ids = M.ordered(); if (!ids.length) return; if (dir === 'front' || dir === 'forward') ids = ids.slice().reverse();
    return M.run(ids.map(function (id) { return Deck.op('reorderElement', id, { dir: dir }); }));
  };
  M.align = function (mode, to) { var ids = M.ordered(); if (!ids.length) return; return M.run([Deck.op('alignElements', null, { els: ids, mode: mode, to: to || (ids.length > 1 ? 'selection' : 'slide') })]); };
  M.distribute = function (axis, to) { var ids = M.ordered(); if (ids.length < 3 && to !== 'slide') return Ui.toast(t('dk.need3')); return M.run([Deck.op('distributeElements', null, { els: ids, axis: axis, to: to || 'selection' })]); };
  M.flip = function (axis) { return M.run([Deck.op('flipElements', null, { els: M.ordered(), axis: axis })]); };
  // arrow keys: one step is a little (Shift: a lot)
  M.nudge = function (dx, dy, big) {
    var ns = M.nodes(); if (!ns.length) return; var k = Deck.k(), st = (big ? 10 : 1) * 1.0, e = Math.round;
    return M.run(ns.map(function (n) { var b = n.box; return Deck.op('setTransform', n.sourceId, { box: { x: e((b.x + dx * st) * k), y: e((b.y + dy * st) * k), cx: e(b.w * k), cy: e(b.h * k) }, rotDeg: Math.round((b.rotationDeg || 0) * 10) / 10 }); }));
  };
})();
