// Sign — your saved signatures (drawn or typed, kept on this phone), and placing one on a page: drag to move, the corners to resize, then it is stamped into the file.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var S = window.Sign = { active: false, sigs: [], cur: '', date: true, box: null };
  function save() { S.sigs = S.sigs.slice(0, 8); Store.savePrefs({ sigs: S.sigs }); }

  // ---- the list sheet -----------------------------------------------------------------------------------------------------------------
  S.open = function () { S.sigs = Store.prefs().sigs || S.sigs; if (!S.cur || !S.sigs.some(function (x) { return x.id === S.cur; })) S.cur = S.sigs.length ? S.sigs[0].id : ''; Ui.sheet('sign', SheetsView.signs(S.sigs, S.cur, S.date)); };
  A['s-pick'] = function (el) { S.cur = el.dataset.id; S.open(); };
  A['s-date'] = function () { S.date = !S.date; S.open(); };
  A['s-del'] = function () { var gone = S.sigs.filter(function (x) { return x.id === S.cur; })[0]; if (gone) Store.dropFile(gone.path); S.sigs = S.sigs.filter(function (x) { return x.id !== S.cur; }); save(); S.cur = ''; S.open(); };
  A['s-go'] = function () {
    var sg = S.sigs.filter(function (x) { return x.id === S.cur; })[0]; if (!sg) return Ui.toast(t('sg.none'));
    Ui.closeSheet(); var i = Read.current(), w = Doc.pageW() * 0.4, im = new Image();
    im.onload = function () {
      var h = w * im.height / im.width; S.active = true; S.img = sg.path;
      S.box = { page: i, l: (Doc.pageW() - w) / 2, t: Math.max(10, Math.min(Doc.pageH(i) - h - 10, (Doc.pageH(i) - h) / 2)), w: w, h: h };
      Read.setMode('read'); Read.chrome(); Read.repaint();
    };
    im.src = sg.path;
  };
  S.cancel = function () { if (!S.active) return; S.active = false; S.box = null; Read.repaint(); Read.chrome(); };
  A['s-cancel'] = function () { S.cancel(); };

  // ---- the box on the page ------------------------------------------------------------------------------------------------------------------
  Read.layers.push(function (ov, i) {
    if (!S.active || !S.box || S.box.page !== i) return;
    var b = S.box; ov.insertAdjacentHTML('beforeend', '<div class="sgbox" style="left:' + b.l + 'px;top:' + b.t + 'px;width:' + b.w + 'px;height:' + b.h + 'px"><img alt="" src="' + S.img + '"><i class="h tl" data-h="tl"></i><i class="h tr" data-h="tr"></i><i class="h bl" data-h="bl"></i><i class="h br" data-h="br"></i></div>');
  });
  var d = null;
  function el() { var pg = Read.pg(S.box.page); return pg && pg.querySelector('.sgbox'); }
  function put() { var e = el(); if (e) { var b = S.box; e.style.cssText = 'left:' + b.l + 'px;top:' + b.t + 'px;width:' + b.w + 'px;height:' + b.h + 'px'; } }
  $('rdScroll').addEventListener('pointerdown', function (e) {
    if (!S.active || !e.target.closest('.sgbox')) return; var h = e.target.dataset.h, b = S.box;
    d = { id: e.pointerId, x: e.clientX, y: e.clientY, h: h || '', b: { l: b.l, t: b.t, w: b.w, h: b.h } }; e.preventDefault(); try { e.target.setPointerCapture(e.pointerId); } catch (x) { /* a finger that already lifted */ }
  });
  $('rdScroll').addEventListener('pointermove', function (e) {
    if (!d || e.pointerId !== d.id) return; var dx = e.clientX - d.x, dy = e.clientY - d.y, b = S.box, o = d.b, W = Doc.pageW(), H = Doc.pageH(b.page);
    if (!d.h) { b.l = Math.max(0, Math.min(W - o.w, o.l + dx)); b.t = Math.max(0, Math.min(H - o.h, o.t + dy)); }
    else {
      // the corner opposite the handle stays; the box keeps its shape
      var k = o.h / o.w, left = d.h.indexOf('l') >= 0, top = d.h.indexOf('t') >= 0, nw = Math.max(40, Math.min(W, o.w + (left ? -dx : dx))), nh = nw * k;
      b.w = nw; b.h = nh; b.l = left ? o.l + o.w - nw : o.l; b.t = top ? o.t + o.h - nh : o.t;
    }
    put();
  });
  function end(e) { if (d && e.pointerId === d.id) d = null; }
  $('rdScroll').addEventListener('pointerup', end); $('rdScroll').addEventListener('pointercancel', end);

  // the picture the way the page needs it: on a turned page the stamp is turned back so it reads upright
  async function pngFor(src, rot) {
    var buf = await (await fetch(src)).arrayBuffer(); if (!rot) return buf;
    var bm = await createImageBitmap(new Blob([buf], { type: 'image/png' })), swap = rot % 180, c = document.createElement('canvas'), g;
    c.width = swap ? bm.height : bm.width; c.height = swap ? bm.width : bm.height; g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2); g.rotate(-rot * Math.PI / 180); g.drawImage(bm, -bm.width / 2, -bm.height / 2);
    return new Promise(function (res) { c.toBlob(function (bl) { bl.arrayBuffer().then(res); }, 'image/png'); });
  }
  A['s-place'] = function () {
    var b = S.box; if (!b) return; var i = b.page, k = Doc.scale(i), rot = Read.rot(i), p1 = Read.pdf(i, b.l, b.t), p2 = Read.pdf(i, b.l + b.w, b.t + b.h);
    var rect = [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])], img = S.img, date = S.date, below = Read.pdf(i, b.l, b.t + b.h + 11 * k);
    S.active = false; S.box = null; Read.chrome();
    Viewer.run(async function () {
      var r = await PdfSvc.stamp({ page: i, png: await pngFor(img, rot), rect: rect });
      if (date) { await PdfSvc.insert([{ pageIndex: i, origin: below, rotate: rot, text: new Date().toLocaleDateString(I18n.locale()), fontSize: 9, color: [95, 99, 108], font: 'arial' }]); }
      return r;
    }, 'busy.sign');
  };

  // ---- drawing or typing a new one ---------------------------------------------------------------------------------------------------------------
  var pad = null;
  A['s-new'] = function () { Ui.sheet('signnew', SheetsView.signNew('draw')); setTimeout(initPad, 60); };
  A['s-tab'] = function (el) { Ui.sheet('signnew', SheetsView.signNew(el.dataset.k)); setTimeout(initPad, 60); };
  function initPad() {
    var c = $('sgPad'); if (!c) return; var dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr; var g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = C('ink_navy'); pad = { c: c, g: g, on: false, ink: false };
    c.onpointerdown = function (e) { var r = c.getBoundingClientRect(); pad.on = true; pad.ink = true; g.beginPath(); g.moveTo(e.clientX - r.left, e.clientY - r.top); try { c.setPointerCapture(e.pointerId); } catch (x) { /* a finger that already lifted */ } $('sgHint').classList.add('hidden'); };
    c.onpointermove = function (e) { if (!pad.on) return; var r = c.getBoundingClientRect(); g.lineTo(e.clientX - r.left, e.clientY - r.top); g.stroke(); };
    c.onpointerup = c.onpointercancel = function () { pad.on = false; };
  }
  A['s-back'] = function () { S.open(); };
  A['s-clear'] = function () { if (!pad) return; pad.g.clearRect(0, 0, pad.c.width, pad.c.height); pad.ink = false; var h = $('sgHint'); if (h) h.classList.remove('hidden'); };
  // the ink only, cut to its edges
  function crop(c) {
    var g = c.getContext('2d'), w = c.width, h = c.height, px = g.getImageData(0, 0, w, h).data, x1 = w, y1 = h, x2 = 0, y2 = 0, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    if (x2 <= x1 || y2 <= y1) return null; var p = 6, o = document.createElement('canvas'); o.width = x2 - x1 + p * 2; o.height = y2 - y1 + p * 2;
    o.getContext('2d').drawImage(c, x1, y1, x2 - x1, y2 - y1, p, p, x2 - x1, y2 - y1); return o.toDataURL('image/png');
  }
  A['s-save'] = async function () {
    var png = null, typed = $('sgType');
    if (typed) {
      var v = typed.value.trim(); if (!v) return; var c = document.createElement('canvas'); c.width = 900; c.height = 220; var g = c.getContext('2d');
      g.font = 'italic 600 110px Georgia, serif'; g.fillStyle = C('ink_navy'); g.textBaseline = 'middle'; g.fillText(v, 20, 110); png = crop(c);
    } else if (pad && pad.ink) png = crop(pad.c);
    if (!png) return Ui.toast(t('sg.empty'));
    try {
      var r = await NativeTools.call('save_local_file', { fileName: 'signature.png', base64: png.split(',')[1], reason: 'Keep your signature on this phone' }), id = 's' + Ui.nextId();
      S.sigs.unshift({ id: id, path: r.data.path }); S.cur = id; save(); S.open();
    } catch (e) { App.fail('err.generic', e); }
  };
})();
