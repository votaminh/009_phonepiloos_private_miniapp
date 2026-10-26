// Picture — a picture added in this session can be resized (a share of its natural size), aligned and removed from the Picture tab of the ribbon; Plan writes its new size and alignment on save.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts;
  function sel() { var p = Doc.paper().querySelector('.b.imgp.sel'); return p && (Doc.pics[p.dataset.n] || p.dataset.src !== undefined) ? p : null; }
  A['pic-size'] = function (el) {
    var p = sel(); if (!p) return; var d = Doc.pics[p.dataset.n], img = p.querySelector('img');
    if (!p.dataset.w0) { p.dataset.w0 = d ? d.w : img.getAttribute('width'); p.dataset.h0 = d ? d.h : img.getAttribute('height'); }
    var k = (+el.dataset.p || 100) / 100, w = Math.round(p.dataset.w0 * k), h = Math.round(p.dataset.h0 * k); if (d) { d.w = w; d.h = h; } else { p.dataset.rw = w; p.dataset.rh = h; }
    img.setAttribute('width', w); img.setAttribute('height', h); p.dataset.p = el.dataset.p; look(p);
    Doc.snap(); Doc.dirty = true; if (window.Paginate) Paginate.schedule(0);
  };
  A['pic-al'] = function (el) { var p = sel(); if (!p) return; if (!Doc.pics[p.dataset.n]) return Ui.toast(t('pic.noalign')); Doc.pics[p.dataset.n].align = el.dataset.a; p.style.textAlign = el.dataset.a; Doc.snap(); Doc.dirty = true; };
  A['pic-del'] = function () { var p = sel(); if (!p) return; var nx = p.nextElementSibling; if (!Doc.pics[p.dataset.n]) return Ui.toast(t('pic.nodel')); delete Doc.pics[p.dataset.n]; p.remove(); Doc.snap(); Doc.dirty = true; if (window.Paginate) Paginate.schedule(0); if (window.Ribbon) Ribbon.follow(); if (nx && nx.classList.contains('ed')) { nx.focus(); } };

  // ---- turn, crop and wrap (Picture tab) ---------------------------------------------------------------------------------------------------------
  // A picture of the file: its turn / crop / wrap are kept on the block (data-rot, data-crop, data-wrap, data-pf = changed) and written into its own XML on save.
  // A picture added in this session keeps its turn and wrap in Doc.pics (the engine writes them); its crop cuts the pixels themselves.
  var WRAPS = [['inline', 'pic.w.inline'], ['square-left', 'pic.w.sl'], ['square-right', 'pic.w.sr'], ['topBottom', 'pic.w.tb'], ['behind', 'pic.w.behind'], ['front', 'pic.w.front']];
  function look(p) {
    var d = Doc.pics[p.dataset.n], img = p.querySelector('img'), rot = d ? d.rot || 0 : +p.dataset.rot || 0, w = (d ? d.wrap : p.dataset.wrap) || 'inline', crop = !d && p.dataset.crop ? p.dataset.crop.split(',').map(Number) : null;
    p.classList.toggle('wf-l', w === 'square-left'); p.classList.toggle('wf-r', w === 'square-right');
    var nm = Render.picWrapName(w); if (nm) p.dataset.wl = nm; else delete p.dataset.wl;
    img.style.transform = rot ? 'rotate(' + rot + 'deg)' : ''; var iw = +img.getAttribute('width') || 0, ih = +img.getAttribute('height') || 0; img.style.margin = rot % 180 === 90 && iw && ih ? Math.round((iw - ih) / 2) + 'px 0' : ''; img.style.objectViewBox = crop && crop.some(function (v) { return v > 0; }) ? 'inset(' + crop[1] + '% ' + crop[2] + '% ' + crop[3] + '% ' + crop[0] + '%)' : ''; img.style.objectFit = img.style.objectViewBox ? 'fill' : '';
  }
  function changed(p) { if (!Doc.pics[p.dataset.n]) p.dataset.pf = '1'; look(p); Doc.snap(); Doc.dirty = true; Doc.touch(); if (window.Paginate) Paginate.schedule(0); }
  A['pic-rot'] = function (el) {
    var p = sel(); if (!p) return; var d = Doc.pics[p.dataset.n], cur = d ? d.rot || 0 : +p.dataset.rot || 0, nv = (((cur + (+el.dataset.d || 90)) % 360) + 360) % 360;
    if (d) d.rot = nv; else p.dataset.rot = nv; changed(p);
  };
  A['pic-wrap'] = function (el) {
    var p = sel(); if (!p) return; var d = Doc.pics[p.dataset.n], cur = (d ? d.wrap : p.dataset.wrap) || 'inline', r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 2, WRAPS.map(function (w) { return { t: t(w[1]), on: cur === w[0], go: function () { var q = sel(); if (!q) return; if (d) d.wrap = w[0]; else q.dataset.wrap = w[0]; changed(q); } }; }), { from: el });
  };
  function num(id) { var v = parseFloat(String(Ui.$(id).value).replace(',', '.')); return isFinite(v) ? Math.max(0, Math.min(45, v)) : 0; }
  A['pic-crop'] = function () {
    var p = sel(); if (!p) return; var dp = Doc.pics[p.dataset.n], c = dp ? dp.crop || [0, 0, 0, 0] : p.dataset.crop ? p.dataset.crop.split(',') : [0, 0, 0, 0], f = function (id, k, v) { return '<label class="pa-f"><span>' + Ui.esc(t(k)) + '</span><input id="' + id + '" type="text" inputmode="decimal" value="' + (+v || 0) + '" autocomplete="off"><em>%</em></label>'; };
    Ui.sheet('crop', '<h2 class="sh-h">' + Ui.esc(t('pic.crop')) + '</h2><div class="crop-g">' + f('crT', 'cr.top', c[1]) + f('crB', 'cr.bottom', c[3]) + f('crL', 'cr.left', c[0]) + f('crR', 'cr.right', c[2]) + '</div><div class="sub">' + Ui.esc(t('cr.hint')) + '</div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + Ui.esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="pic-cropgo">' + Ui.esc(t('a.apply')) + '</button></div>');
  };
  // A picture added in this session keeps its original (d.orig) and the shares cut off (d.crop): every crop starts again from the original, so a crop can be changed or taken back at any time.
  A['pic-cropgo'] = function () {
    var p = sel(); if (!p) return; var l = num('crL'), tp = num('crT'), r = num('crR'), b = num('crB'), d = Doc.pics[p.dataset.n]; Ui.closeSheet();
    if (!d) { p.dataset.crop = [l, tp, r, b].join(','); changed(p); return; }
    var img = p.querySelector('img'), none = !(l || tp || r || b); if (!d.orig && none) return;
    if (!d.orig) d.orig = { buf: d.buf, mime: d.mime, url: img.src, W: img.naturalWidth, H: img.naturalHeight, cw: img.naturalWidth };
    var o = d.orig, k = d.w / (d.cw || o.W), fin = function (buf, mime, url, cw, ch) {
      d.buf = buf; d.mime = mime; d.cw = cw; d.w = Math.max(1, Math.round(cw * k)); d.h = Math.max(1, Math.round(ch * k)); d.crop = none ? null : [l, tp, r, b]; img.src = url; img.setAttribute('width', d.w); img.setAttribute('height', d.h); p.dataset.w0 = d.w; p.dataset.h0 = d.h; changed(p);
    };
    if (none) return fin(o.buf, o.mime, o.url, o.W, o.H);
    var src = new Image(); src.onload = function () {
      var W = o.W, H = o.H, sx = Math.round(W * l / 100), sy = Math.round(H * tp / 100), sw = Math.max(1, W - sx - Math.round(W * r / 100)), sh = Math.max(1, H - sy - Math.round(H * b / 100));
      var cv = document.createElement('canvas'); cv.width = sw; cv.height = sh; cv.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
      cv.toBlob(function (blob) { if (!blob) return Ui.toast(t('i.picfail')); blob.arrayBuffer().then(function (buf) { fin(buf, blob.type, URL.createObjectURL(blob), sw, sh); }); }, o.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
    };
    src.onerror = function () { Ui.toast(t('i.picfail')); }; src.src = o.url;
  };
})();
