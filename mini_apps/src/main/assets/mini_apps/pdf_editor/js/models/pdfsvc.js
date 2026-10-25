// PdfSvc — talks to the PDF engine (js/engine/pdf-engine.min.js: GenOffice's PDF engine on PDFium) in a Web Worker, so drawing, searching and saving never freeze the screen.
(function () {
  'use strict';
  var w = null, seq = 0, pend = {}, ready = null;
  // the file names the engine looks for are answered by the look-alike fonts in fonts/engine/
  var FONTS = {
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf': 'Carlito-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf': 'Arimo.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf': 'Tinos-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf': 'Tinos-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf': 'Cousine-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf': 'Cousine-Bold.ttf'
  };
  function start() {
    if (w) return;
    w = new Worker('js/engine/pdf-engine.min.js');
    w.onmessage = function (e) { var p = pend[e.data.id]; if (!p) return; delete pend[e.data.id]; if (e.data.ok) p.res(e.data); else p.rej(new Error(e.data.error)); };
    w.onerror = function (e) { var m = e && e.message || 'engine failed'; Object.keys(pend).forEach(function (k) { pend[k].rej(new Error(m)); delete pend[k]; }); w = null; ready = null; };
  }
  function raw(op, payload, transfer) {
    start();
    return new Promise(function (res, rej) { var id = ++seq; pend[id] = { res: res, rej: rej }; w.postMessage(Object.assign({ id: id, op: op }, payload), transfer || []); });
  }
  // the wasm and the fonts are fetched once, on first use
  function call(op, payload, transfer) {
    if (!ready) { start(); ready = raw('init', { base: new URL('js/engine/', document.baseURI).href, fonts: FONTS }); }
    return ready.then(function () { return raw(op, payload, transfer); });
  }
  window.PdfSvc = {
    open: function (buf, password) { return call('open', { bytes: buf, password: password || '' }, [buf]); },
    // RGBA pixels of one page drawn into w × h pixels
    render: function (page, wpx, hpx) { return call('render', { page: page, w: wpx, h: hpx }).then(function (r) { return r.px; }); },
    blocks: function (page) { return call('blocks', { page: page }).then(function (r) { return r.blocks; }); },
    find: function (q, matchCase) { return call('find', { q: q, matchCase: matchCase }).then(function (r) { return r.hits; }); },
    edit: function (edits) { return call('edit', { edits: edits }); },
    insert: function (inserts) { return call('insert', { inserts: inserts }); },
    annotate: function (a) { return call('annotate', a); },
    pages: function (kind, a) { return call('pages', Object.assign({ kind: kind }, a || {})); },
    stamp: function (a) { return call('stamp', a); },
    outline: function () { return call('outline', {}).then(function (r) { return r.items; }); },
    links: function (page) { return call('links', { page: page }).then(function (r) { return r.links; }); },
    forms: function () { return call('forms', {}).then(function (r) { return r.fields; }); },
    formSet: function (values, flatten) { return call('formSet', { values: values, flatten: !!flatten }); },
    shape: function (a) { return call('shape', a); },
    numbers: function (a) { return call('numbers', a); },
    crop: function (a) { return call('crop', a); },
    insertPages: function (a) { return call('insertPages', a); },
    imagePage: function (a) { return call('imagePage', a); },
    save: function () { return call('save', {}).then(function (r) { return r.bytes; }); }
  };
})();
