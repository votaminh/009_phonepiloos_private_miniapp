// Pages — the page manager: every page as a small picture; pick some, then rotate, copy, take out, delete, add a blank page, add another PDF, or move one.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var P = window.Pages = { isOpen: false, sel: [], io: null };

  P.open = function () {
    P.isOpen = true; P.sel = [Read.current()]; var el = $('pgsPanel'); el.classList.remove('hidden'); P.render(); requestAnimationFrame(function () { el.classList.add('on'); });
  };
  P.close = function () {
    if (!P.isOpen) return false; P.isOpen = false; if (P.io) P.io.disconnect(); var el = $('pgsPanel'); el.classList.remove('on'); setTimeout(function () { if (!P.isOpen) el.classList.add('hidden'); }, 240); return true;
  };
  P.render = function () {
    $('pgsPanel').innerHTML = PagesView.panel(Doc.sizes, P.sel); if (P.io) P.io.disconnect();
    P.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { P.io.unobserve(e.target); thumb(e.target); } }); }, { root: $('pgsGrid'), rootMargin: '200px' });
    Array.prototype.forEach.call($('pgsGrid').querySelectorAll('.pgc'), function (c) { P.io.observe(c); });
  };
  function thumb(card) {
    var i = +card.dataset.i, cv = card.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(card.clientWidth * dpr), h = Math.round(w * Doc.sizes[i][1] / Doc.sizes[i][0]), g = Doc.gen;
    cv.width = w; cv.height = h; cv.style.aspectRatio = Doc.sizes[i][0] + ' / ' + Doc.sizes[i][1];
    PdfSvc.render(i, w, h).then(function (px) { if (g !== Doc.gen) return; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0); card.classList.add('rdy'); }).catch(function () {});
  }
  A['p-close'] = function () { P.close(); };
  A['p-sel'] = function (el) {
    var i = +el.dataset.i, k = P.sel.indexOf(i); if (k >= 0) P.sel.splice(k, 1); else P.sel.push(i); P.sel.sort(function (a, b) { return a - b; });
    el.classList.toggle('on', k < 0); P.bar();
  };
  A['p-all'] = function () { P.sel = P.sel.length === Doc.sizes.length ? [] : Doc.sizes.map(function (_, i) { return i; }); P.render(); };
  A['p-open'] = function (el) { var i = +el.dataset.i; P.close(); Read.goto(i); };
  P.bar = function () { $('pgsBar').innerHTML = PagesView.bar(P.sel.length); $('pgsCount').textContent = P.sel.length ? t('pg.picked', { n: P.sel.length }) : t('pg.count', { n: Doc.sizes.length }); };

  function op(kind, extra) {
    if (!P.sel.length && kind !== 'blank' && kind !== 'merge') return Ui.toast(t('pg.none'));
    Doc.fresh = true;
    return Viewer.run(function () { return PdfSvc.pages(kind, Object.assign({ pages: P.sel.slice() }, extra || {})); }, 'busy.pages').then(function (r) { return r; });
  }
  A['p-rot'] = async function () { if (await op('rotate', { by: 90 })) P.render(); };
  A['p-dup'] = async function () { var n = P.sel.length; if (await op('duplicate')) { P.sel = P.sel.map(function (x, k) { return x + k + 1; }); P.render(); Ui.toast(t('pg.dup', { n: n })); } };
  A['p-blank'] = async function () { var at = P.sel.length ? P.sel[P.sel.length - 1] + 1 : Doc.sizes.length; if (await op('blank', { at: at })) { P.sel = [at]; P.render(); } };
  A['p-del'] = function () {
    if (!P.sel.length) return Ui.toast(t('pg.none'));
    if (P.sel.length >= Doc.sizes.length) return Ui.toast(t('pg.keep'));
    Ui.dialog(t('pg.del.t', { n: P.sel.length }), t('pg.del.s'), t('a.delete'), async function () { if (await op('delete')) { P.sel = []; P.render(); Ui.toast(t('pg.deleted')); } }, true);
  };
  function move(by) {
    if (P.sel.length !== 1) return Ui.toast(t('pg.one')); var from = P.sel[0], to = from + by; if (to < 0 || to >= Doc.sizes.length) return;
    Doc.fresh = true; Viewer.run(function () { return PdfSvc.pages('move', { from: from, to: to }); }, 'busy.pages').then(function (r) { if (r) { P.sel = [to]; P.render(); } });
  }
  A['p-up'] = function () { move(-1); }; A['p-down'] = function () { move(1); };
  A['p-merge'] = async function () {
    var r; try { r = await NativeTools.call('pick_file', { type: 'document', mimeTypes: ['application/pdf'], multiple: false, reason: 'Add pages from another PDF' }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return; }
    var f = ((r && r.data && r.data.files) || [])[0]; if (!f) return;
    try { await Files.request(f.url); var buf = await (await fetch(f.url)).arrayBuffer(); Doc.fresh = true; if (await Viewer.run(function () { return PdfSvc.pages('merge', { other: buf }); }, 'busy.pages')) { P.sel = []; P.render(); Ui.toast(t('pg.merged')); } }
    catch (e) { App.fail('err.generic', e); }
  };
  A['p-take'] = async function () {
    if (!P.sel.length) return Ui.toast(t('pg.none'));
    Read.busy(t('busy.pages'));
    try {
      var r = await PdfSvc.pages('extract', { pages: P.sel.slice() }), buf = r.extract.buffer ? r.extract.buffer.slice(r.extract.byteOffset, r.extract.byteOffset + r.extract.byteLength) : r.extract;
      var name = Viewer.rec.name.replace(/\.pdf$/i, '') + ' (' + t('pg.part') + ').pdf', s = await NativeTools.call('save_local_file', { fileName: name, base64: App.b64(buf), reason: 'Save the chosen pages as a new PDF' }), f = s.data;
      await Store.put({ key: 'p' + Ui.nextId(), name: name, size: f.sizeBytes || buf.byteLength, url: f.path, path: f.path, openedAt: Date.now(), editedAt: Date.now() }); Ui.toast(t('pg.took', { n: P.sel.length }));
    } catch (e) { App.fail('err.generic', e); }
    Read.idle();
  };
})();
