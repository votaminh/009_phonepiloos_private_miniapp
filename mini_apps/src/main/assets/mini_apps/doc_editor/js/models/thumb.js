// Thumb — the small picture of a document in the list: page 1 as it is laid out (PageView.first), drawn onto a canvas straight from the laid-out page (boxes, borders, pictures, charts, every word where the browser put it) and kept as a file.
(function () {
  'use strict';
  var W = 360, clear = /^(rgba\(0, 0, 0, 0\)|transparent)$/;
  function flags(node, stop) { var u = false, s = false; for (var e = node; e && e !== stop; e = e.parentElement) { var l = getComputedStyle(e).textDecorationLine; if (/underline/.test(l)) u = true; if (/line-through/.test(l)) s = true; } return { u: u, s: s }; }
  // every box, border, picture and word of the page, in painting order
  function collect(root, k) {
    var o = root.getBoundingClientRect(), ops = [], pics = [];
    function pos(r) { return { x: (r.left - o.left) * k, y: (r.top - o.top) * k, w: r.width * k, h: r.height * k }; }
    function el(e) {
      var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      var r = e.getBoundingClientRect(), b = pos(r);
      if (b.w && b.h) {
        if (!clear.test(cs.backgroundColor) && e !== root) ops.push({ t: 'r', c: cs.backgroundColor, b: b });
        ['Top', 'Right', 'Bottom', 'Left'].forEach(function (sd) {
          var w = parseFloat(cs['border' + sd + 'Width']); if (!w || cs['border' + sd + 'Style'] === 'none') return;
          var t = Math.max(1, w * k), c = cs['border' + sd + 'Color'];
          ops.push({ t: 'r', c: c, b: sd === 'Top' ? { x: b.x, y: b.y, w: b.w, h: t } : sd === 'Bottom' ? { x: b.x, y: b.y + b.h - t, w: b.w, h: t } : sd === 'Left' ? { x: b.x, y: b.y, w: t, h: b.h } : { x: b.x + b.w - t, y: b.y, w: t, h: b.h } });
        });
        var tag = e.tagName.toLowerCase();
        if (tag === 'img' || tag === 'svg') { var im = new Image(), src = tag === 'img' ? e.currentSrc || e.src : URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(e)], { type: 'image/svg+xml' })); pics.push(new Promise(function (ok) { im.onload = ok; im.onerror = ok; im.src = src; })); ops.push({ t: 'i', im: im, b: b }); return; }
        // list markers (the page draws them with ::before)
        if (e.classList.contains('li')) {
          var n = 0; if (e.classList.contains('ord')) for (var p = e; p && p.classList.contains('ord'); p = p.previousElementSibling) n++;
          var f = getComputedStyle(e), m = pos(e.getBoundingClientRect()); ops.push({ t: 's', s: e.classList.contains('ord') ? n + '.' : '•', c: f.color, f: f.fontStyle + ' ' + f.fontWeight + ' ' + parseFloat(f.fontSize) * k + 'px ' + f.fontFamily, x: m.x + 4 * k, y: m.y, h: parseFloat(f.lineHeight) * k || m.h });
        }
      }
      var clip = e.classList.contains('pgx-clip');   // the text area shows one page of a box of columns: what lies beyond it is the next pages
      if (clip) ops.push({ t: 'clip', b: b });
      Array.prototype.forEach.call(e.childNodes, function (c) { if (c.nodeType === 1) el(c); else if (c.nodeType === 3) text(c); });
      if (clip) ops.push({ t: 'unclip' });
    }
    function text(n) {
      var cs = getComputedStyle(n.parentElement), re = /\S+/g, m, v = n.nodeValue, d = flags(n.parentElement, root.parentElement);
      while ((m = re.exec(v))) {
        var rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); var rc = rg.getClientRects()[0]; if (!rc) continue; var b = pos(rc);
        ops.push({ t: 's', s: m[0], c: cs.color, f: cs.fontStyle + ' ' + cs.fontWeight + ' ' + parseFloat(cs.fontSize) * k + 'px ' + cs.fontFamily, x: b.x, y: b.y, h: b.h, w: b.w, d: d });
      }
    }
    el(root); return { ops: ops, pics: Promise.all(pics) };
  }
  async function render() {
    var pg = PageView.first(); try {
      var k = W / pg.w, cv = document.createElement('canvas'), c = cv.getContext('2d'); cv.width = W; cv.height = Math.round(pg.h * k);
      c.fillStyle = C('white'); c.fillRect(0, 0, cv.width, cv.height); var got = collect(pg.el, k); await got.pics;
      got.ops.forEach(function (p) {
        if (p.t === 'clip') { c.save(); c.beginPath(); c.rect(p.b.x, p.b.y, p.b.w, p.b.h); c.clip(); }
        else if (p.t === 'unclip') c.restore();
        else if (p.t === 'r') { c.fillStyle = p.c; c.fillRect(p.b.x, p.b.y, p.b.w, p.b.h); }
        else if (p.t === 'i') { if (p.im.naturalWidth) c.drawImage(p.im, p.b.x, p.b.y, p.b.w, p.b.h); }
        else { c.font = p.f; c.fillStyle = p.c; c.textBaseline = 'middle'; c.fillText(p.s, p.x, p.y + p.h / 2); if (p.d && p.d.u) c.fillRect(p.x, p.y + p.h - 1, p.w, 1); if (p.d && p.d.s) c.fillRect(p.x, p.y + p.h / 2, p.w, 1); }
      });
      return cv.toDataURL('image/jpeg', 0.82).split(',')[1];
    } finally { pg.done(); }
  }
  window.Thumb = {
    mem: {},   // pictures kept for this session only (a browser without a phone behind it cannot keep files)
    // make (or remake) the picture of the document in Doc.rec and keep it with the record; `force` after a save
    refresh: async function (rec, force) {
      if (!rec || ((rec.thumb || Thumb.mem[rec.key]) && !force)) return;
      try {
        var b64 = await render(), old = rec.thumb; Thumb.mem[rec.key] = 'data:image/jpeg;base64,' + b64;
        var r = await NativeTools.call('save_local_file', { fileName: 'thumb.jpg', base64: b64, reason: 'A small picture of the first page' });
        if (r && r.data && r.data.path) { rec.thumb = r.data.path; await Store.put(rec); if (old) Store.dropFile(old); }
      } catch (e) { /* with no phone to keep the file, the picture lives for this session only; with nothing at all the list shows a plain page */ }
      if (App.state.page === 'home') App.renderHome();
    }
  };
})();
