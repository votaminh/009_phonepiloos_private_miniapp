// HomeDesk — what the list of files has on a computer besides the table: a menu on right click (open, rename, share, remove) and a PDF dropped from the desktop onto the page.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, H = window.HomeDesk = {}, renaming = null;
  function it(key, go, o) { return Object.assign({ t: t(key), go: go }, o || {}); }

  async function share(rec) {
    try {
      var res = await fetch(rec.path); if (!res.ok) throw new Error(t('err.missing'));
      await NativeTools.call('share_files', { fileName: rec.name, base64: App.b64(await res.arrayBuffer()), mimeType: 'application/pdf', title: rec.name, reason: 'Share the PDF' });
    } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  }
  function rename(rec) { renaming = rec.key; Ui.sheet('rename', SheetsView.rename(rec.name.replace(/\.pdf$/i, ''))); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); }
  var rn = A['rn-apply'];
  A['rn-apply'] = function () {
    if (!renaming) return rn.apply(this, arguments);
    var rec = Store.get(renaming), v = $('rnName').value.replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad'));
    renaming = null; if (!rec) return Ui.closeSheet(); rec.name = v + '.pdf'; Store.put(rec).then(App.renderHome); Ui.closeSheet();
  };
  A['sheet-done'] = (function (f) { return function () { renaming = null; return f.apply(this, arguments); }; })(A['sheet-done']);

  function menu(ev) {
    var card = ev.target.closest && ev.target.closest('.hm-card[data-id]'); if (!card || !Wide.pc) return;
    var rec = Store.get(card.dataset.id); if (!rec) return; ev.preventDefault();
    PopMenu.show(ev.clientX, ev.clientY, [it('r.open', function () { A['h-open'](card); }), it('mn.rename', function () { rename(rec); }), it('mn.share', function () { share(rec); }), '-', it('r.remove', function () { A['h-remove']({ dataset: { id: rec.key } }); }, { danger: true })]);
  }

  // a PDF dropped from the desktop: kept as a file of the app, then opened
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  async function take(file) {
    var buf = await file.arrayBuffer(), r = await NativeTools.call('save_local_file', { fileName: file.name, base64: App.b64(buf), reason: 'Open a PDF dropped on the page' }), f = r && r.data;
    if (!f || !f.path) throw new Error('no file');
    return App.add({ fileName: file.name, url: f.path, sizeBytes: f.sizeBytes || buf.byteLength });
  }
  H.init = function () {
    var pg = $('pgHome');
    $('homeList').addEventListener('contextmenu', menu);
    document.addEventListener('dragover', function (e) { if (Router.getCurrent() !== 'home' || !hasFiles(e)) return; e.preventDefault(); pg.dataset.drop = t('h.drop'); pg.classList.add('drop'); });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) pg.classList.remove('drop'); });
    document.addEventListener('drop', async function (e) {
      if (Router.getCurrent() !== 'home' || !hasFiles(e)) return; e.preventDefault(); pg.classList.remove('drop');
      var files = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
      if (!files.length) return Ui.toast(t('h.droperr'));
      try { var recs = []; for (var i = 0; i < files.length; i++) recs.push(await take(files[i])); if (recs.length === 1) Viewer.open(recs[0]); else App.renderHome(); } catch (err) { App.fail('err.generic', err); }
    });
  };
})();
