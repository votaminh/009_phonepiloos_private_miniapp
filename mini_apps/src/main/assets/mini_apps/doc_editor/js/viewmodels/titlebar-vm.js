// TitleBar — the computer's title bar: Back, the quick-access tools (Save, Undo, Redo), the file's name with its save state in the middle, and on the right the mode switch (Editing / Viewing) and Share.
// A phone and a touch tablet keep DocView.top.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, T = window.TitleBar = {};
  function qa(act, icon, label, off, dot) { return '<button type="button" class="tb-q' + (off ? ' off' : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (off ? ' disabled' : '') + '>' + ic(icon, 20, 1.9) + (dot ? '<i class="tb-dot"></i>' : '') + '</button>'; }
  T.render = function () {
    var r = Doc.rec, h = $('docTop'); if (!Wide.pc || !r || !h) return;
    var e = Doc.mode === 'edit', st = Doc.statusText();
    h.classList.add('tb');
    h.innerHTML = '<button type="button" class="tb-back" data-act="d-back" aria-label="' + esc(t('a.back')) + '">' + ic('back', 22, 2) + '</button>'
      + '<div class="tb-qa">' + qa('e-autosave', 'check', t('tb.autosave'), !e || !Doc.dirty, e && Doc.dirty) + qa('e-undo', 'undo', t('f.undo'), !e || !(Doc.histAt > 0)) + qa('e-redo', 'redo', t('f.redo'), !e || !(Doc.histAt < Doc.hist.length - 1)) + '</div>'
      + '<div class="tb-name"><b>' + esc(r.name) + '</b><span class="tb-st ' + (e ? st.tone : '') + '">' + esc(e ? st.text : t('d.reading')) + '</span></div>'
      + '<button type="button" class="tb-mode' + (e ? ' ed' : '') + '" data-act="tb-mode" aria-haspopup="menu">' + ic(e ? 'edit' : 'book', 16, 2) + '<span>' + esc(t(e ? 'tb.editing' : 'tb.viewing')) + '</span>' + ic('down', 14, 2.4) + '</button>'
      + '<button type="button" class="tb-share" data-act="tb-share" aria-haspopup="menu">' + ic('share', 16, 2) + '<span>' + esc(t('mn.share')) + '</span></button>';
  };
  A['tb-mode'] = function (el) {
    var e = Doc.mode === 'edit', r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 4, [{ t: t('tb.editing'), on: e, go: function () { if (!e) A['d-edit'](); } }, { t: t('tb.viewing'), on: !e, go: function () { if (e) A['e-done'](); } }], { from: el });
  };
  // Share: what to do with this file. The tools are the phone's own (share_files, export_file_device); on the web the runtime answers them with the share sheet and a download. PDF is not supported yet (a toast says so).
  A['tb-share'] = function (el) {
    var r = el.getBoundingClientRect();
    PopMenu.show(r.right, r.bottom + 4, [
      { t: t('sh.file'), d: t('sh.file.d'), ic: 'share', go: function () { A['m-share'](); } },
      { t: t('sh.docx'), d: t('sh.docx.d'), ic: 'doc', go: function () { A['m-copy'](); } },
      { t: t('sh.pdf'), d: t('sh.pdf.d'), ic: 'pdf', go: function () { A['m-pdf'](); } }
    ], { from: el, cls: 'rich' });
  };
  var chrome0 = Desk.chrome; Desk.chrome = function () { chrome0.apply(this, arguments); T.render(); };
  var tm = 0; document.addEventListener('input', function () { if (Wide.pc && Doc.mode === 'edit') { clearTimeout(tm); tm = setTimeout(function () { if (!(window.Find && Find.active)) T.render(); }, 400); } });
})();
