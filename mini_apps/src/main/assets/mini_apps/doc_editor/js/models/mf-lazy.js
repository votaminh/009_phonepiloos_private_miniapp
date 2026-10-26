// Mf — the pictures of formulas (WMF/EMF parts, <img data-mf="word/media/image7.wmf">) are made only when they come into view: WmfMath draws the part as SVG, in small batches.
// A picture is made once per part; every <img> with the same part (the page, the pages view, a history snapshot) gets it. Opening a file stays as quick as without formulas.
(function () {
  'use strict';
  var done = {}, wait = {}, queue = [], busy = false, io = null, BATCH = 12;
  function same(part) { return document.querySelectorAll('img[data-mf]'); }
  function paint(part, url) { Array.prototype.forEach.call(same(), function (im) { if (im.dataset.mf === part && im.src !== url) im.src = url; }); }
  async function pump() {
    if (busy) return; busy = true;
    try {
      while (queue.length) {
        var batch = queue.splice(0, BATCH), z = window.DocRich && DocRich.z; if (!z) break;
        for (var i = 0; i < batch.length; i++) {
          var bytes = await z.bytes(batch[i]), svg = bytes && /\.wmf$/i.test(batch[i]) ? WmfMath.svg(bytes) : null; if (!svg) continue;
          done[batch[i]] = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); paint(batch[i], done[batch[i]]);
        }
        await new Promise(function (r) { setTimeout(r, 0); });   // let the page breathe between batches
      }
    } catch (e) { /* a picture that cannot be made stays blank; the text around it is there */ }
    busy = false;
  }
  function want(im) {
    var part = im.dataset.mf; if (!part) return;
    if (done[part]) { if (im.src !== done[part]) im.src = done[part]; return; }
    if (!wait[part]) { wait[part] = 1; queue.push(part); }
    pump();
  }
  function watch(im) {
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); want(e.target); } }); }, { rootMargin: '600px 0px' });
    if (done[im.dataset.mf]) want(im); else io.observe(im);
  }
  // a new file: what was made for the old one is not valid
  window.Mf = { reset: function () { done = {}; wait = {}; queue = []; } };
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.matches && n.matches('img[data-mf]')) watch(n); else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('img[data-mf]'), watch); }); });
  }).observe(document.body, { childList: true, subtree: true });
})();
