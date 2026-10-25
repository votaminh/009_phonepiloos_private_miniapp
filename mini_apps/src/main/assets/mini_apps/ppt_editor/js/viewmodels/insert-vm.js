// Insert — new things on the slide: a text box, a shape, a picture from the phone, a table, a link on the selected box. They land in the middle; the new box is selected so it can be moved at once.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, MAXPX = 1600;
  function middle(wf, hf) {
    var s = Deck.info.size, w = Math.round(s.cx * wf), h = Math.round(s.cy * hf); return { x: Math.round((s.cx - w) / 2), y: Math.round((s.cy - h) / 2), cx: w, cy: h };
  }
  function add(op, text) { return Viewer.run([op], 'busy.edit', { select: true }).then(function (r) { if (r && text) Text.open(true); return r; }); }
  A['m-insert'] = function () { Ui.sheet('insert', SheetsView.insert()); };
  A['i-text'] = function () {
    Ui.closeSheet(); add(Deck.op('addElement', null, { kind: 'textbox', offset: middle(0.5, 0.14), paragraphs: [{ runs: [{ text: t('in.sample'), fontSize: 24 }], align: 'left' }] }), true);
  };
  A['i-shape'] = function (b) { Ui.closeSheet(); add(Deck.op('addElement', null, { kind: b.dataset.k, offset: middle(0.3, 0.3 * Deck.info.size.cx / Deck.info.size.cy * (b.dataset.k === 'rightArrow' ? 0.5 : 1)), fill: C('accent'), stroke: null })); };
  A['i-line'] = function () { Ui.closeSheet(); add(Deck.op('addElement', null, { kind: 'rightArrow', offset: middle(0.35, 0.12), fill: C('sw_navy'), stroke: null })); };
  A['i-table'] = function () { Ui.closeSheet(); add(Deck.op('addTable', null, { rows: 3, cols: 3, offset: middle(0.7, 0.3) })); };

  // a picture from the phone, shrunk so the deck stays light; webp and the like are turned into PNG first
  function load(url) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error(t('in.picfail'))); }; i.src = url; }); }
  A['i-pic'] = async function () {
    Ui.closeSheet(); var r;
    try { r = await NativeTools.call('pick_file', { type: 'image', multiple: false, reason: 'Add a picture' }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return; }
    var f = ((r && r.data && r.data.files) || [])[0]; if (!f) return;
    try {
      var img = await load(f.url), w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAXPX / Math.max(w, h)), jpeg = /jpe?g/i.test(f.mimeType || f.fileName || '');
      var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var blob = await new Promise(function (ok) { cv.toBlob(ok, jpeg ? 'image/jpeg' : 'image/png', 0.9); }), buf = await blob.arrayBuffer();
      var s = Deck.info.size, fit = Math.min(s.cx * 0.7 / w, s.cy * 0.7 / h), bw = Math.round(w * fit), bh = Math.round(h * fit);
      await add(Deck.op('addPicture', null, { bytes: App.b64(buf), ext: jpeg ? 'jpg' : 'png', offset: { x: Math.round((s.cx - bw) / 2), y: Math.round((s.cy - bh) / 2), cx: bw, cy: bh } }));
    } catch (e) { App.fail('err.generic', e); }
  };
  // a link on the selected box (the web address a tap opens when the deck is shown)
  A['i-link'] = function () {
    if (!Deck.sel) return Ui.toast(t('in.pickfirst'));
    Ui.sheet('link', SheetsView.head(t('in.link'), t('in.link.s'), 'lk-apply', t('a.apply')) + '<label class="sx-find"><input id="lkUrl" type="url" placeholder="https://" aria-label="' + Ui.esc(t('in.link')) + '" autocomplete="off"></label><div class="btns"><button type="button" class="btn light" data-act="lk-none">' + Ui.esc(t('in.link.none')) + '</button></div>');
    setTimeout(function () { var i = $('lkUrl'); if (i) i.focus(); }, 380);
  };
  A['lk-apply'] = function () { var v = $('lkUrl').value.trim(); Ui.closeSheet(); if (!v) return; if (!/^[a-z]+:/i.test(v)) v = 'https://' + v; Viewer.run([Deck.op('setLink', Deck.sel, { link: { kind: 'url', url: v } })]); };
  A['lk-none'] = function () { Ui.closeSheet(); Viewer.run([Deck.op('setLink', Deck.sel, { link: null })]); };
})();
