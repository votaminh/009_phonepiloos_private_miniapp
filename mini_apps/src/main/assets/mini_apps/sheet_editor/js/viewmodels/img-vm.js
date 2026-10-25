// Img — Insert > Image: a picture from the phone / computer is put in the sheet, its top-left corner at the selected cell, and written into the file at once (the engine adds the drawing part).
(function () {
  'use strict';
  var t = Ui.t, G = window.Grid, I = window.Img = {};
  var TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/gif': 1 }, WIDTH = 320;
  function px(g, from, size, vert) { var i = from, left = size, w; for (; ;) { w = (vert ? g.rowH(i) : g.colW(i)) / (G.z || 1); if (left <= w || i > from + 400) return { at: i, off: Math.max(0, left) }; left -= w; i++; } }
  // the anchor of a picture / shape of w x h pixels whose top-left corner is the selected cell
  I.anchor = function (w, h) { var g = G.geo, a = G.act(), x = px(g, a.c, w, false), y = px(g, a.r, h, true); return { fromRow: a.r, fromColumn: a.c, fromRowOffset: 0, fromColumnOffset: 0, toRow: y.at, toColumn: x.at, toRowOffset: Math.round(y.off * 9525), toColumnOffset: Math.round(x.off * 9525) }; };
  // bytes of an image + its type → the picture in the sheet
  I.add = async function (buf, type, name) {
    var sh = G.geo.sh; if (!TYPES[type]) return Ui.toast(t('im.type'));
    var url = URL.createObjectURL(new Blob([buf], { type: type })), dim = await new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = no; im.src = url; });
    URL.revokeObjectURL(url); var w = Math.min(WIDTH, dim.w), h = Math.round(w * dim.h / dim.w);
    var visual = { sheetName: sh.name, anchor: I.anchor(w, h), image: { mediaType: type, base64: App.b64(buf), altText: name || '' } };
    var out = await Book.flush({ visuals: [visual] }); if (out) { await Xrich.load(out.slice(0)); G.mount(); } Book.touch(); Ui.toast(t('im.added'));
  };
  I.pick = async function () {
    if (Wb.readOnly || !G.geo) return; var r;
    try { r = await NativeTools.call('pick_file', { type: 'image', mimeTypes: Object.keys(TYPES), multiple: false, reason: 'Insert a picture' }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); return; }
    var f = ((r && r.data && r.data.files) || [])[0]; if (!f) return;
    try { var res = await fetch(f.url), buf = await res.arrayBuffer(), type = f.mimeType || res.headers.get('content-type') || (/\.png$/i.test(f.fileName || '') ? 'image/png' : /\.gif$/i.test(f.fileName || '') ? 'image/gif' : 'image/jpeg'); await I.add(buf, type, f.fileName); }
    catch (e) { App.fail('err.generic', e); }
  };
  if (window.Menus) Menus.add('insert', function () { return [{ t: t('im.title') + '…', off: Wb.readOnly, go: I.pick }]; });
})();
