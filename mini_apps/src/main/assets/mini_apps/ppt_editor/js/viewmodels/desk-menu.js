// Menus — the menu bar of a computer: File, Edit, View, Insert, Format, Slide, Arrange, Slide show. Each item is an action the app already has, or one that only a computer needs (zoom, group, align, a shortcut).
// Other files add their items with Menus.add('arrange', function () { return [...]; }) when they load, so a feature shows up in the menu as soon as it exists.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, S = window.Stage, MAC = /Mac|iPhone|iPad/.test(navigator.platform), K = MAC ? '⌘' : 'Ctrl+', M = window.Menus = { extra: {}, K: K };
  M.add = function (menu, fn) { (M.extra[menu] = M.extra[menu] || []).push(fn); };
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  function act(a, arg) { return function () { A[a](arg || {}); }; }
  var SHAPES = ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon', 'star5', 'heart', 'cloud', 'lightningBolt', 'sun', 'moon', 'smileyFace',
    'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'leftRightArrow', 'chevron', 'homePlate', 'wedgeRectCallout', 'wedgeEllipseCallout', 'donut', 'plus'];
  function at(b) { var r = b.getBoundingClientRect(); return [r.left, r.bottom + 4]; }
  function ro() { return !Deck.info; }
  var one = function () { return !!Deck.sel; };

  // ---- lists the buttons open -----------------------------------------------------------------------------------------------------------
  M.layouts = function (b, mode) {
    var p = at(b), ls = (Deck.info && Deck.info.layouts) || [];
    PopMenu.show(p[0], p[1], ls.map(function (l) { return { t: l.name, go: function () { Layout.pick(l.name, mode === 'add'); } }; }), { from: b });
  };
  M.shapes = function (b) {
    var p = at(b); PopMenu.show(p[0], p[1], SHAPES.map(function (k) { return { t: t('sh.' + k), go: function () { A['i-shape']({ dataset: { k: k } }); } }; }), { from: b });
  };
  // lines and arrows (free), and a connector that holds two boxes together
  function lineOf(kind) {
    var sz = Deck.info.size, w = Math.round(sz.cx * 0.3), h = /Bent|Curved/.test(kind) ? Math.round(sz.cy * 0.12) : 0;
    Viewer.run([Deck.op('addElement', null, { kind: kind, offset: { x: Math.round((sz.cx - w) / 2), y: Math.round((sz.cy - h) / 2), cx: w, cy: h }, stroke: { color: C('ink'), widthEmu: 28575 } })], 'busy.edit', { select: true });
  }
  function connect(kind, arrow) {
    var ids = Sel.ordered(); if (ids.length !== 2) return Ui.toast(t('dk.need2'));
    Viewer.run([Deck.op('addConnector', null, { from: ids[0], to: ids[1], kind: kind, arrow: arrow || 'end', line: { color: C('ink'), widthEmu: 28575 } })], 'busy.edit', { select: true });
  }
  function lineItems() { return [['line', 'sh.line'], ['lineArrow', 'sh.lineArrow'], ['lineBent', 'sh.lineBent'], ['lineCurved', 'sh.lineCurved']].map(function (x) { return { t: t(x[1]), go: function () { lineOf(x[0]); } }; }); }
  function connectItems() { var h = []; ['straight', 'elbow', 'curved'].forEach(function (k) { h.push({ t: t('dk.c.' + k), go: function () { connect(k, 'end'); } }); h.push({ t: t('dk.c.' + k) + ' ↔', go: function () { connect(k, 'both'); } }); }); return h; }
  M.arrange = function (b) { var p = at(b); PopMenu.show(p[0], p[1], arrange(), { from: b }); };
  function arrange() {
    var many = Sel.count() > 1, g = Deck.sel && S.node(Deck.sel), off = { off: !one() };
    return [it('q.front', K + '⇧]', function () { Sel.order('front'); }, off), it('q.fwd', K + ']', function () { Sel.order('forward'); }, off), it('q.bwd', K + '[', function () { Sel.order('backward'); }, off), it('q.back', K + '⇧[', function () { Sel.order('back'); }, off), '-',
      { t: t('q.align'), off: !one(), sub: ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'].map(function (m) { return { t: t('al.' + m), go: function () { Sel.align(m); } }; }) },
      { t: t('dk.distribute'), off: Sel.count() < 3, sub: [{ t: t('dk.disth'), go: function () { Sel.distribute('horizontal'); } }, { t: t('dk.distv'), go: function () { Sel.distribute('vertical'); } }] }, '-',
      it('dk.group', K + 'G', function () { Sel.group(); }, { off: !many }), it('dk.ungroup', K + '⇧G', function () { Sel.ungroup(); }, { off: !(g && g.type === 'group') }), '-',
      it('q.rot', '', act('a-rot'), off), it('dk.fliph', '', function () { Sel.flip('h'); }, off), it('dk.flipv', '', function () { Sel.flip('v'); }, off)];
  }
  function zoomItems() { var z = Desk.pct(); return [25, 50, 75, 100, 150, 200].map(function (p) { return { t: p + '%', on: z === p && !!S.pcz, go: function () { Desk.zoom(p); } }; }).concat([{ t: t('dk.fit'), on: !S.pcz, go: function () { Desk.zoom(0); } }]); }
  function slideOp(kind) {
    return function () {
      var i = Deck.cur, n = Deck.count();
      if (kind === 'dup') Viewer.run([Deck.op('duplicateSlide', null, {}, i)], 'busy.slides', { go: i + 1, rebuild: true });
      else if (kind === 'del') { if (n < 2) return Ui.toast(t('sl.keep')); Viewer.run([Deck.op('deleteSlide', null, {}, i)], 'busy.slides', { go: Math.min(i, n - 2), rebuild: true }); }
      else if (kind === 'hide') A['d-hide']();
      else if (kind === 'up' && i > 0) Viewer.run([Deck.op('moveSlide', null, { to: i - 1 }, i)], 'busy.slides', { go: i - 1, rebuild: true });
      else if (kind === 'down' && i < n - 1) Viewer.run([Deck.op('moveSlide', null, { to: i + 1 }, i)], 'busy.slides', { go: i + 1, rebuild: true });
    };
  }

  // ---- the menus --------------------------------------------------------------------------------------------------------------------------
  var MENUS = {
    file: function () { return [it('a.save', K + 'S', act('v-save')), it('dk.copyfile', '', act('m-copy')), it('mn.pdf', K + 'P', act('m-pdf')), '-', it('mn.share', '', act('m-share')), it('mn.rename', '', act('m-rename')), it('mn.discard', '', act('m-discard')), '-', it('a.close', '', act('v-back'))]; },
    edit: function () {
      var off = { off: !one() };
      return [it('a.undo', K + 'Z', act('d-undo'), { off: !(Deck.info && Deck.info.canUndo) }), it('a.redo', K + 'Y', act('d-redo'), { off: !(Deck.info && Deck.info.canRedo) }), '-',
        it('dk.cut', K + 'X', function () { Sel.copy(true); }, off), it('dk.copy', K + 'C', function () { Sel.copy(false); }, off), it('dk.paste', K + 'V', function () { Sel.paste(); }, { off: !Sel.clip }), it('dk.dup', K + 'D', function () { Sel.dup(); }, off), it('fl.delete', 'Del', function () { Sel.remove(); }, off), '-',
        it('dk.selall', K + 'A', function () { Sel.all(); }), '-', it('dk.find', K + 'F', act('fd-open'))];
    },
    view: function () {
      return [it('dk.normal', '', function () { Desk.setView('edit'); }, { on: Desk.view === 'edit' }), it('dk.sorter', '', function () { Desk.setView('sort'); }, { on: Desk.view === 'sort' }), it('ol.outline', '', function () { Desk.setView('outline'); }, { on: Desk.view === 'outline' }), '-',
        { t: t('dk.zoom'), sub: zoomItems() }, it('dk.notesshow', '', function () { Desk.showNotes(!Desk.notes); }, { on: Desk.notes }), '-', it('dk.fullscreen', 'F11', function () { var d = document, el = d.documentElement; if (d.fullscreenElement) d.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); })];
    },
    insert: function () {
      return [{ t: t('dk.new'), sub: ((Deck.info && Deck.info.layouts) || []).map(function (l) { return { t: l.name, go: function () { Layout.pick(l.name, true); } }; }) }, '-',
        it('in.text', '', act('i-text')), { t: t('dk.lines'), sub: lineItems() }, { t: t('dk.connect'), off: Sel.count() !== 2, sub: connectItems() }, { t: t('ch.chart'), sub: Chartx.kinds.map(function (k) { return { t: t('ch.k.' + k), go: function () { Chartx.insert(k); } }; }) }, { t: t('in.shape'), sub: SHAPES.map(function (k) { return { t: t('sh.' + k), go: function () { A['i-shape']({ dataset: { k: k } }); } }; }) }, it('in.pic', '', act('i-pic')), it('in.table', '', act('i-table')), it('in.link', K + 'K', act('i-link'), { off: !one() }), '-', it('m.footer', '', act('m-footer'))];
    },
    format: function () {
      var off = { off: !one() }, f = ((Quick.last || {}).font || {});
      return [it('f.bold', K + 'B', act('q-b'), Object.assign({ on: f.bold }, off)), it('f.italic', K + 'I', act('q-i'), Object.assign({ on: f.italic }, off)), it('f.under', K + 'U', act('q-u'), Object.assign({ on: f.underline }, off)), it('f.strike', '', Desk.items.strike, Object.assign({ on: f.strike }, off)), '-',
        it('f.alignl', K + 'L', Desk.items.alignl, off), it('f.alignc', K + 'E', Desk.items.alignc, off), it('f.alignr', K + 'R', Desk.items.alignr, off), it('f.bullets', '', act('q-bul'), off), '-',
        it('q.bg', '', act('m-bg')), it('tl.layout', '', function () { Layout.open('slide'); }), it('m.look', '', function () { Layout.open('slide'); }), it('m.size', '', act('m-size'))];
    },
    slide: function () {
      return [it('dk.new', K + 'M', function () { Layout.open('add'); }), it('dk.dupslide', '', slideOp('dup')), it('dk.delslide', '', slideOp('del'), { danger: true }), it(Deck.slide() && Deck.slide().hidden ? 'q.show' : 'q.hide', '', slideOp('hide')), '-',
        it('dk.moveup', '', slideOp('up'), { off: Deck.cur < 1 }), it('dk.movedown', '', slideOp('down'), { off: Deck.cur >= Deck.count() - 1 }), '-', it('tl.layout', '', function () { Layout.open('slide'); }), it('tl.notes', '', function () { Desk.showNotes(true); setTimeout(function () { var n = $('dkNote'); if (n) n.focus(); }, 30); })];
    },
    arrange: arrange,
    show: function () { return [it('dk.fromstart', 'F5', function () { Present.open(0); }), it('dk.fromcur', '⇧F5', function () { Present.open(Deck.cur); })]; }
  };
  M.items = function (name) { var out = MENUS[name](); (M.extra[name] || []).forEach(function (f) { out = out.concat(['-'], f()); }); return out; };
  M.open = function (btn) { var r = btn.getBoundingClientRect(); if (PopMenu.isOpen() && PopMenu.from === btn) { PopMenu.close(); return; } PopMenu.show(r.left, r.bottom + 2, M.items(btn.dataset.mn), { from: btn }); };
  M.init = function () {
    var bar = $('dkMenu');
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-mn]'); if (b && !ro()) M.open(b); });
    // with one menu open, the pointer moves to the next one
    bar.addEventListener('pointerover', function (e) { var b = e.target.closest('[data-mn]'); if (b && PopMenu.isOpen() && PopMenu.from && PopMenu.from !== b && PopMenu.from.dataset.mn) { PopMenu.close(); M.open(b); } });
  };
})();
