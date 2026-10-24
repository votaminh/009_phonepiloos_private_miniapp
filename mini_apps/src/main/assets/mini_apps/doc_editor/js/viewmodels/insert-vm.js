// Insert — things added at the caret: a picture, a divider, a page break, and (see table-vm.js) a table.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, MAX_W = 600;
  var Insert = window.Insert = {};
  // the block after which a new block goes: the one holding the caret, else the last one
  Insert.after = function () {
    var r = Doc.range, n = r && r.startContainer, el = n && (n.nodeType === 3 ? n.parentElement : n), b = el && el.closest && el.closest('#paper .b');
    return b || Doc.paper().lastElementChild;
  };
  // a read-only block made in this session, then an empty paragraph after it so there is somewhere to type
  Insert.place = function (el) {
    var at = Insert.after(), p = Struct.fresh(el, 'p'); p.dataset.t = 'p'; p.innerHTML = '<br data-ph>';
    if (at) at.after(el); else Doc.paper().appendChild(el);
    if (!el.nextElementSibling || !el.nextElementSibling.classList.contains('ed')) el.after(p);
    Doc.snap(); Edit.tab('text'); var n = el.nextElementSibling; if (n && n.classList.contains('ed')) { n.focus(); Struct.putCaret(n, { a: 0, z: 0 }); }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  function block(cls, html, xml) { var el = document.createElement('div'); el.className = 'b lk ' + cls; el.dataset.t = 'x'; el.dataset.n = Doc.nid(); el.innerHTML = html; if (xml) Doc.xmls[el.dataset.n] = xml; return el; }
  Insert.block = block;
  A['i-div'] = function () { Insert.place(block('hr', '<hr>', '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>')); };
  A['i-brk'] = function () { Insert.place(block('pb', '<span>' + Ui.esc(t('i.pagebreak')) + '</span>', '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')); };
  A['i-link'] = function () { Edit.tab('text'); setTimeout(function () { A['e-link'](); }, 30); };

  // a picture from the phone, shrunk to fit the page width; webp/heic are turned into PNG first (Word reads png, jpeg and gif)
  function load(url) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('image')); }; i.src = url; }); }
  A['i-pic'] = async function () {
    var r;
    try { r = await NativeTools.call('pick_file', { type: 'image', multiple: false, reason: 'Add a picture' }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('i.picfail', e); return; }
    var f = ((r && r.data && r.data.files) || [])[0]; if (!f) return;
    try {
      var img = await load(f.url), w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAX_W / w), mime = /jpe?g/i.test(f.mimeType) ? 'image/jpeg' : /gif/i.test(f.mimeType) ? 'image/gif' : 'image/png';
      var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var blob = await new Promise(function (ok) { cv.toBlob(ok, mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9); }); if (!blob) throw new Error('image');
      mime = blob.type; var buf = await blob.arrayBuffer(), el = block('imgp', '<img src="' + URL.createObjectURL(blob) + '" width="' + cv.width + '" height="' + cv.height + '" alt="">');
      Doc.pics[el.dataset.n] = { buf: buf, mime: mime, w: cv.width, h: cv.height, align: 'left' };
      Insert.place(el);
    } catch (e) { App.fail('i.picfail', e); }
  };
})();
