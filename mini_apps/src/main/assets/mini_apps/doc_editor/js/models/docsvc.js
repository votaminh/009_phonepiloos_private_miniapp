// DocSvc — talks to the Word engine (js/engine/docx-engine.min.js, GenOffice's docx-engine) in a Web Worker, so parsing and saving never freeze the screen.
(function () {
  'use strict';
  var w = null, seq = 0, pend = {};
  function start() {
    if (w) return;
    w = new Worker('js/engine/docx-engine.min.js');
    w.onmessage = function (e) { var p = pend[e.data.id]; if (!p) return; delete pend[e.data.id]; if (e.data.ok) p.res(e.data); else p.rej(new Error(e.data.error)); };
    w.onerror = function (e) { var m = e && e.message || 'engine failed'; Object.keys(pend).forEach(function (k) { pend[k].rej(new Error(m)); delete pend[k]; }); w = null; };
  }
  function call(op, payload, transfer) {
    start();
    return new Promise(function (res, rej) { var id = ++seq; pend[id] = { res: res, rej: rej }; w.postMessage(Object.assign({ id: id, op: op }, payload), transfer || []); });
  }
  window.DocSvc = {
    open: function (buf) { return call('open', { bytes: buf }, [buf]); },
    // plan: { blocks: [...], images: { ref: ArrayBuffer } } -> ArrayBuffer of the new .docx
    save: function (plan) { return call('save', { plan: plan }, Object.keys(plan.images || {}).map(function (k) { return plan.images[k]; })).then(function (r) { return r.bytes; }); },
    blank: function () { return call('blank', { options: {} }).then(function (r) { return r.bytes; }); },
    table: function (rows, cols) { return call('table', { rows: rows, cols: cols, header: true }).then(function (r) { return r.xml; }); }
  };
})();
