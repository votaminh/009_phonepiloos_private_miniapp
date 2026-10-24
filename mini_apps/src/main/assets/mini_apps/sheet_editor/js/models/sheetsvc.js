// SheetSvc — talks to the Excel engine (js/engine/xlsx-engine.min.js, GenOffice's xlsx-gateway) in a Web Worker, so opening and saving never freeze the screen.
(function () {
  'use strict';
  var w = null, seq = 0, pend = {};
  function start() {
    if (w) return;
    w = new Worker('js/engine/xlsx-engine.min.js');
    w.onmessage = function (e) { var p = pend[e.data.id]; if (!p) return; delete pend[e.data.id]; if (e.data.ok) p.res(e.data); else p.rej(new Error(e.data.error)); };
    w.onerror = function (e) { var m = e && e.message || 'engine failed'; Object.keys(pend).forEach(function (k) { pend[k].rej(new Error(m)); delete pend[k]; }); w = null; };
  }
  function call(op, payload, transfer) {
    start();
    return new Promise(function (res, rej) { var id = ++seq; pend[id] = { res: res, rej: rej }; w.postMessage(Object.assign({ id: id, op: op }, payload), transfer || []); });
  }
  function col(c) { var s = ''; for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; }
  window.SheetSvc = {
    col: col,
    ref: function (r, c) { return col(c) + (r + 1); },
    // "B7" -> { r: 6, c: 1 }
    addr: function (a) { var m = /^([A-Z]+)(\d+)$/.exec(a); return m ? { r: +m[2] - 1, c: CalcParse.colNum(m[1]) } : null; },
    // buf -> { xfs, sheets: [{ name, cells, cs, cv, cols, rows, merges, frozen, hidden }] }; the buffer is handed to the worker
    open: function (buf) { return call('open', { bytes: buf }, [buf]); },
    // a = { edits, structural, sheetPlan, visuals, formulaValues, freeze } -> ArrayBuffer of the new .xlsx; the worker keeps it as the base of the next call
    apply: function (a) { return call('apply', a).then(function (r) { return r.bytes; }); },
    bytes: function () { return call('bytes', {}).then(function (r) { return r.bytes; }); },
    blank: function (name) { return call('blank', { name: name }).then(function (r) { return r.bytes; }); }
  };
})();
