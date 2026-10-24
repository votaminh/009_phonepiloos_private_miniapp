// Menu — the document menu and what it does: rename, share, a copy to Downloads, PDF, remove from the list.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  A['d-menu'] = function () {
    var r = Doc.rec; if (!r) return;
    Ui.sheet('menu', SheetsView.menu({ name: r.name, size: HomeView.size(r.size || 0), words: Doc.words || 0 }));
  };
  // the document as it is now: the saved file, or what is on the page when there are unsaved edits
  async function current() { if (Doc.dirty) return Doc.bytes(); var res = await fetch(Doc.rec.path); return res.arrayBuffer(); }
  A['m-share'] = async function () {
    Ui.closeSheet();
    try { var buf = await current(); await NativeTools.call('share_files', { fileName: Doc.rec.name, base64: App.b64(buf), mimeType: DOCX, title: Doc.rec.name, reason: 'Share the document' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  };
  A['m-copy'] = async function () {
    Ui.closeSheet();
    try { var buf = await current(), r = await NativeTools.call('export_file_device', { fileName: Doc.rec.name, base64: App.b64(buf), reason: 'Save a copy to the phone' }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  // PDF: Android's own print flow for this screen, with only the page drawn (see @media print in style-doc.css)
  A['m-pdf'] = async function () {
    Ui.closeSheet(); document.documentElement.classList.add('printing');
    try { await NativeTools.call('export_webview_pdf', { title: Doc.rec.name.replace(/\.docx$/i, '') }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
    setTimeout(function () { document.documentElement.classList.remove('printing'); }, 600);
  };
  A['m-rename'] = function () { Ui.sheet('rename', SheetsView.rename(Doc.rec.name.replace(/\.docx$/i, ''))); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); };
  A['n-apply'] = function () {
    var v = ($('rnName').value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad'));
    Doc.rec.name = v + '.docx'; Store.put(Doc.rec); Ui.closeSheet(); Doc.chrome();
  };
  A['m-remove'] = function () {
    var rec = Doc.rec, copy = JSON.parse(JSON.stringify(rec)); Ui.closeSheet(); Doc.dirty = false;
    Store.del(rec.key).then(function () { Router.back(); Ui.toast(t('t.removed'), function () { Store.put(copy).then(App.renderHome); }); });
  };
  // a link in the page opens in the phone's browser
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a.lnk'); if (a && Doc.mode === 'read') { e.preventDefault(); NativeTools.call('open_url', { url: a.dataset.href, reason: 'Open a link' }).catch(function () {}); } });
})();
