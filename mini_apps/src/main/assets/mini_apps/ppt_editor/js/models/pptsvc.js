// PptSvc — talks to the PPT engine (js/engine/pptx-engine.min.js: GenOffice's pptx engine) in a Web Worker, so opening, drawing and saving never freeze the screen.
(function () {
  'use strict';
  var w = null, seq = 0, pend = {}, ready = null;
  // the fonts of the app: a deck asks for Calibri, Arial, Times New Roman… and the engine measures with the look-alike that has the same letter widths
  var FONTS = [
    ['Carlito', 'Carlito-Regular.woff', '400'], ['Carlito', 'Carlito-Bold.woff', '700'], ['Arimo', 'Arimo.woff', '400 700'], ['Tinos', 'Tinos-Regular.woff', '400'], ['Tinos', 'Tinos-Bold.woff', '700'],
    ['Cousine', 'Cousine-Regular.woff', '400'], ['Cousine', 'Cousine-Bold.woff', '700'], ['Gelasio', 'Gelasio.woff', '400 700'], ['Lora', 'Lora.woff', '400 700'], ['Mulish', 'Mulish.woff', '200 900'], ['Roboto Mono', 'RobotoMono.woff', '100 700']
  ].map(function (f) { return { family: f[0], file: 'fonts/' + f[1], weight: f[2] }; });
  function start() {
    if (w) return;
    w = new Worker('js/engine/pptx-engine.min.js');
    w.onmessage = function (e) { var p = pend[e.data.id]; if (!p) return; delete pend[e.data.id]; if (e.data.ok) p.res(e.data); else p.rej(new Error(e.data.error)); };
    w.onerror = function (e) { var m = e && e.message || 'engine failed'; Object.keys(pend).forEach(function (k) { pend[k].rej(new Error(m)); delete pend[k]; }); w = null; ready = null; };
  }
  function raw(op, payload, transfer) {
    start();
    return new Promise(function (res, rej) { var id = ++seq; pend[id] = { res: res, rej: rej }; w.postMessage(Object.assign({ id: id, op: op }, payload), transfer || []); });
  }
  // the page draws with the same fonts; the engine loads its own copy once
  function call(op, payload, transfer) {
    if (!ready) { start(); ready = Promise.all([raw('init', { base: new URL('./', document.baseURI).href, fonts: FONTS }), loadFonts()]); }
    return ready.then(function () { return raw(op, payload, transfer); });
  }
  function loadFonts() {
    return Promise.all(FONTS.map(function (f) {
      var face = new FontFace(f.family, 'url(' + f.file + ')', { weight: f.weight });
      return face.load().then(function () { document.fonts.add(face); }).catch(function () { /* the system font stands in */ });
    }));
  }
  window.PptSvc = {
    fonts: FONTS,
    open: function (buf) { return call('open', { bytes: buf }, [buf]); },
    info: function () { return call('info', {}); },
    // the render tree of one slide at a width in css pixels
    render: function (slide, wpx) { return call('render', { slide: slide, w: wpx }).then(function (r) { return r.tree; }); },
    // a list of ops, all or nothing; the answer is the new deck info
    txn: function (ops) { return call('txn', { ops: ops, isolation: 'atomic' }); },
    undo: function () { return call('undo', {}); },
    redo: function () { return call('redo', {}); },
    save: function () { return call('save', {}).then(function (r) { return r.bytes; }); },
    comments: function (slide) { return call('comments', { slide: slide }).then(function (r) { return r.items; }); },
    notes: function (slide) { return call('notes', { slide: slide }).then(function (r) { return r.text; }); },
    animations: function (slide) { return call('animations', { slide: slide }).then(function (r) { return r.items; }); },
    elements: function (slide) { return call('elements', { slide: slide }).then(function (r) { return r.items; }); },
    copy: function (slide, els) { return call('copy', { slide: slide, els: els }).then(function (r) { return r.items; }); },
    find: function (q, matchCase) { return call('find', { q: q, matchCase: matchCase }).then(function (r) { return r.hits; }); },
    read: function (slide, el) { return call('read', { slide: slide, el: el }); }
  };
})();
