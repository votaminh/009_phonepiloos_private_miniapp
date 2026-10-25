// Doc — the open PDF as the page sees it: page sizes, the zoom, drawn pages kept for a while, text blocks, and a few steps of undo. The engine holds the real document.
(function () {
  'use strict';
  var GAP = 14, SIDE = 12, HIST = 6, BUDGET = 40000000;
  var D = window.Doc = { rec: null, sizes: [], zoom: 1, viewW: 390, gen: 0, hist: [], redo: [], dirty: false, caches: {}, blocksOf: {}, parasOf: {}, order: [] };

  // the pictures of the page list before a change stay as a stand-in until the new ones are drawn, so an edit never flashes white
  D.prev = {}; D.fresh = false;
  D.reset = function (sizes) { var same = !D.fresh && sizes.length === D.sizes.length; D.fresh = false; D.prev = same ? D.caches : {}; D.sizes = sizes; D.gen++; D.caches = {}; D.cost = {}; D.blocksOf = {}; D.parasOf = {}; D.order = []; };
  D.previous = function (i) { var k = Object.keys(D.prev).filter(function (x) { return x.indexOf(i + ':') === 0 && D.prev[x] && D.prev[x].width; }); return k.length ? D.prev[k[k.length - 1]] : null; };
  // page width on screen: the phone width less the side margin, times the zoom
  D.baseW = function () { var a = D.viewW - SIDE * 2; return window.Wide && Wide.pc ? Math.min(a, 860) : a; };   // a computer shows a page at a readable width, centred
  D.pageW = function () { return Math.max(120, Math.round(D.baseW() * D.zoom)); };
  D.pageH = function (i) { var s = D.sizes[i]; return Math.round(D.pageW() * s[1] / s[0]); };
  D.rowH = function (i) { return D.pageH(i) + GAP; };
  D.scale = function (i) { return D.pageW() / D.sizes[i][0]; };   // css px per PDF point
  D.hostW = function () { return Math.max(D.viewW, D.pageW() + SIDE * 2); };
  D.gap = GAP;

  // a page drawn at the screen's pixel density; kept as an ImageBitmap so scrolling back is free
  // pixels per css pixel: the screen's density, lowered a little when zoomed so one page never costs more than ~20 MB
  D.dpr = function () { return Math.max(1, Math.min(2, window.devicePixelRatio || 1, 1800 / D.pageW())); };
  D.bitmap = function (i) {
    var dpr = D.dpr(), w = Math.round(D.pageW() * dpr), h = Math.round(D.pageH(i) * dpr), key = i + ':' + w + ':' + D.gen, c = D.caches[key];
    if (c) { return c.then ? c : Promise.resolve(c); }
    var p = PdfSvc.render(i, w, h).then(function (px) { return createImageBitmap(new ImageData(new Uint8ClampedArray(px), w, h)); }).then(function (bm) {
      D.caches[key] = bm; D.order.push(key); D.cost = D.cost || {}; D.cost[key] = w * h;
      // keep the newest pages while the pictures together stay under the budget (about 160 MB)
      var total = D.order.reduce(function (a, k) { return a + (D.cost[k] || 0); }, 0);
      while (D.order.length > 3 && total > BUDGET) { var old = D.order.shift(), b0 = D.caches[old]; total -= D.cost[old] || 0; if (b0 && b0.close) b0.close(); delete D.caches[old]; delete D.cost[old]; }
      return bm;
    });
    D.caches[key] = p; return p;
  };
  D.blocks = function (i) { var k = i + ':' + D.gen; if (!D.blocksOf[k]) D.blocksOf[k] = PdfSvc.blocks(i); return D.blocksOf[k]; };
  D.paras = function (i) { var k = i + ':' + D.gen; if (!D.parasOf[k]) D.parasOf[k] = D.blocks(i).then(function (l) { return Paragraphs.group(i, l); }); return D.parasOf[k]; };
  D.changed = function (sizes) { D.reset(sizes || D.sizes); D.dirty = true; };

  // one change to the document: the bytes before it are kept for undo, then fn runs in the engine
  D.mutate = async function (fn) {
    var before = await PdfSvc.save(); var r = await fn();
    D.hist.push(before); if (D.hist.length > HIST) D.hist.shift(); D.redo = [];
    D.changed(r && r.sizes); return r;
  };
  D.undo = async function () {
    if (!D.hist.length) return false; var now = await PdfSvc.save(), prev = D.hist.pop(); D.redo.push(now);
    var r = await PdfSvc.open(prev.slice(0)); D.changed(r.sizes); return true;
  };
  D.redoStep = async function () {
    if (!D.redo.length) return false; var now = await PdfSvc.save(), next = D.redo.pop(); D.hist.push(now);
    var r = await PdfSvc.open(next.slice(0)); D.changed(r.sizes); return true;
  };
  D.canUndo = function () { return D.hist.length > 0; };
  D.canRedo = function () { return D.redo.length > 0; };
  D.pageAt = function (y, tops) { var lo = 0, hi = tops.length - 2; while (lo < hi) { var m = (lo + hi + 1) >> 1; if (tops[m] <= y) lo = m; else hi = m - 1; } return lo; };
})();
