// Deck — the open deck as the page sees it: the list of slides, the slide being edited, what is selected, and the drawn trees kept while nothing changes. The engine holds the real deck.
(function () {
  'use strict';
  var D = window.Deck = { rec: null, info: null, cur: 0, sel: null, w: 358, gen: 0, trees: {}, reads: {} };

  D.reset = function (info) { D.info = info; D.cur = 0; D.sel = null; D.gen++; D.trees = {}; D.reads = {}; };
  D.count = function () { return D.info ? D.info.slides.length : 0; };
  D.slide = function () { return D.info && D.info.slides[D.cur]; };
  // EMU per css pixel at the width the trees are built for
  D.k = function () { return D.info.size.cx / D.w; };
  D.ratio = function () { return D.info.size.cy / D.info.size.cx; };
  // the drawn tree of slide i at the stage width, built once per state of the deck
  D.tree = function (i) {
    var k = i + ':' + D.gen, c = D.trees[k]; if (c) return c;
    c = D.trees[k] = Promise.all([PptSvc.render(i, D.w), PptSvc.elements(i)]).then(function (r) {
      // empty placeholders are not drawn by the engine: they come back as boxes with a hint, so a new slide can still be filled in by touch
      var tree = r[0], have = {}, px = tree.widthPx / D.info.size.cx; tree.nodes.forEach(function (n) { have[n.sourceId] = 1; });
      r[1].forEach(function (e) {
        if (have[e.id]) return; var x = e.x * px, y = e.y * px, w = e.cx * px, h = e.cy * px;
        tree.nodes.push({ id: 'r_empty_' + e.id, type: 'text', sourceId: e.id, empty: true, placeholder: e.placeholder, fill: { kind: 'none' }, box: { x: x, y: y, w: w, h: h, rotationDeg: 0, flipH: false, flipV: false, centerX: x + w / 2, centerY: y + h / 2 } });
      }); return tree;
    }).catch(function (e) { delete D.trees[k]; throw e; }); return c;
  };
  D.read = function (el) { var k = D.cur + ':' + el + ':' + D.gen, c = D.reads[k]; if (c) return c; c = D.reads[k] = PptSvc.read(D.cur, el); return c; };
  // something in the deck changed: every tree is old
  D.changed = function (info) {
    var n = D.count(); D.info = info; D.gen++; D.trees = {}; D.reads = {};
    if (D.cur >= D.count()) D.cur = Math.max(0, D.count() - 1);
    return n;
  };
  // ops always name the slide being edited unless they say otherwise
  D.op = function (name, el, extra, slide) { return Object.assign({ op: name, target: Object.assign({ slide: slide == null ? D.cur : slide }, el ? { el: el } : {}) }, extra || {}); };
})();
