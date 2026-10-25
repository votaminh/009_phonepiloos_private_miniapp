// Menu — the document menu and what it does: save, a copy to Downloads, share, rename, remove from the list, throw the edits away.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, PDF = 'application/pdf';
  A['v-menu'] = function () {
    var r = Viewer.rec; if (!r) return;
    Ui.sheet('menu', SheetsView.menu({ name: r.name, info: HomeView.size(r.size || 0) + ' · ' + t(Doc.sizes.length === 1 ? 'pg.one.n' : 'pg.n', { n: Doc.sizes.length }), dirty: Viewer.dirty }));
  };
  // the document as it is now: what the engine holds
  A['m-save'] = function () { Ui.closeSheet(); Viewer.save(); };
  A['m-share'] = async function () {
    Ui.closeSheet();
    try { var buf = await PdfSvc.save(); await NativeTools.call('share_files', { fileName: Viewer.rec.name, base64: App.b64(buf), mimeType: PDF, title: Viewer.rec.name, reason: 'Share the PDF' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  };
  A['m-copy'] = async function () {
    Ui.closeSheet();
    try { var buf = await PdfSvc.save(), r = await NativeTools.call('export_file_device', { fileName: Viewer.rec.name, base64: App.b64(buf), reason: 'Save a copy to the phone' }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  A['m-rename'] = function () { Ui.sheet('rename', SheetsView.rename(Viewer.rec.name.replace(/\.pdf$/i, ''))); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); };
  A['rn-apply'] = function () {
    var v = $('rnName').value.replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad'));
    Viewer.rec.name = v + '.pdf'; Store.put(Viewer.rec); Ui.closeSheet(); Viewer.chrome();
  };
  A['m-remove'] = function () {
    var rec = Viewer.rec, copy = JSON.parse(JSON.stringify(rec)); Ui.closeSheet(); Viewer.dirty = false;
    Store.del(rec.key).then(function () { Viewer.rec = null; Router.back(); Ui.toast(t('t.removed'), function () { Store.put(copy).then(App.renderHome); }); });
  };
  A['m-discard'] = function () { Ui.closeSheet(); Ui.dialog(t('lv.title2'), t('lv.body2'), t('lv.discard'), async function () { await Viewer.dropDraft(); Viewer.open(Viewer.rec, { edit: true }); }, true); };
})();
