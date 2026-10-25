// Menu — the deck menu and what it does: save, a copy to Downloads, share, export as PDF, rename, remove from the list, throw the edits away.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  A['v-menu'] = function () {
    var r = Viewer.rec; if (!r) return;
    Ui.sheet('menu', SheetsView.menu({ name: r.name, info: HomeView.size(r.size || 0) + ' · ' + t(Deck.count() === 1 ? 'sl.one' : 'sl.many', { n: Deck.count() }), dirty: Viewer.dirty, cur: Deck.cur + 1 }));
  };
  A['m-save'] = function () { Ui.closeSheet(); Viewer.save(); };
  // the deck as it is now: what the engine holds
  A['m-share'] = async function () {
    Ui.closeSheet();
    try { var buf = await PptSvc.save(); await NativeTools.call('share_files', { fileName: Viewer.rec.name, base64: App.b64(buf), mimeType: PPTX, title: Viewer.rec.name, reason: 'Share the deck' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  };
  A['m-copy'] = async function () {
    Ui.closeSheet();
    try { var buf = await PptSvc.save(), r = await NativeTools.call('export_file_device', { fileName: Viewer.rec.name, base64: App.b64(buf), reason: 'Save a copy to the phone' }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  A['m-pdf'] = async function () {
    Ui.closeSheet(); $('stBusy').innerHTML = EditView.busy(t('busy.pdf')); $('stBusy').classList.remove('hidden');
    try {
      var b64 = await Pdf.build(), name = Viewer.rec.name.replace(/\.pptx$/i, '') + '.pdf', r = await NativeTools.call('export_file_device', { fileName: name, base64: b64, reason: 'Save the deck as a PDF' });
      Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' }));
    } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
    $('stBusy').classList.add('hidden');
  };
  A['m-rename'] = function () { Ui.sheet('rename', SheetsView.rename(Viewer.rec.name.replace(/\.pptx$/i, ''))); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); };
  A['rn-apply'] = function () {
    var v = $('rnName').value.replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad'));
    Viewer.rec.name = v + '.pptx'; Store.put(Viewer.rec); Ui.closeSheet(); Viewer.chrome();
  };
  A['m-remove'] = function () {
    var rec = Viewer.rec, copy = JSON.parse(JSON.stringify(rec)); Ui.closeSheet(); Viewer.dirty = false;
    Store.del(rec.key).then(function () { Viewer.rec = null; Router.back(); Ui.toast(t('t.removed'), function () { Store.put(copy).then(App.renderHome); }); });
  };
  A['m-discard'] = function () { Ui.closeSheet(); Ui.dialog(t('lv.title2'), t('lv.body2'), t('lv.discard'), async function () { await Viewer.dropDraft(); Viewer.open(Viewer.rec, {}); }, true); };

  // ---- a PDF made of the slides: each one is drawn as a picture (JPEG) and becomes a page of the same shape ---------------------------------------
  window.Pdf = {
    build: async function () {
      var W = 1280, H = Math.round(W * Deck.ratio()), pw = 720, ph = Math.round(720 * Deck.ratio()), n = Deck.count(), cv = document.createElement('canvas'), ctx = cv.getContext('2d'), i;
      cv.width = W; cv.height = H; var hidden = Deck.info.slides.map(function (s) { return s.hidden; });
      // object numbers: 1 catalog, 2 pages, then per page: page, content, image
      var enc = function (s) { return new TextEncoder().encode(s); }, list = [];
      for (i = 0; i < n; i++) {
        if (hidden[i]) continue;
        var tree = await PptSvc.render(i, W); ctx.setTransform(1, 0, 0, 1, 0, 0); SlideDraw.draw(ctx, tree);
        var jpg = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.88); }), bytes = new Uint8Array(await jpg.arrayBuffer()); list.push({ bytes: bytes, w: cv.width, h: cv.height });
      }
      var out = [], off = [], len = 0;
      function push(b) { out.push(b); len += b.length; }
      push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
      function obj(num, head, stream) { off[num] = len; push(enc(num + ' 0 obj\n' + head + (stream ? '\nstream\n' : '\n'))); if (stream) { push(stream); push(enc('\nendstream\n')); } push(enc('endobj\n')); }
      var total = 2 + list.length * 3, kidRefs = list.map(function (_, k) { return (3 + k * 3) + ' 0 R'; }).join(' ');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [' + kidRefs + '] /Count ' + list.length + ' >>');
      list.forEach(function (p, k) {
        var base = 3 + k * 3, content = enc('q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q');
        obj(base, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + (base + 2) + ' 0 R >> >> /Contents ' + (base + 1) + ' 0 R >>');
        obj(base + 1, '<< /Length ' + content.length + ' >>', content);
        obj(base + 2, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>', p.bytes);
      });
      var x = len, xr = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
      for (i = 1; i <= total; i++) xr += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
      push(enc(xr + 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n'));
      var all = new Uint8Array(len), p = 0; out.forEach(function (b) { all.set(b, p); p += b.length; });
      return App.b64(all.buffer);
    }
  };
})();
