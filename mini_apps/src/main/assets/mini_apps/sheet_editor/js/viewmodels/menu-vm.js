// Menu — the document menu and what it does: save, a copy to Downloads, share, PDF, CSV, rename, remove from the list.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var M = window.Menu = {};
  A['b-menu'] = function () {
    var r = Book.rec; if (!r) return;
    Ui.sheet('menu', SheetsView.menu({ name: r.name, info: HomeView.size(r.size || 0) + ' · ' + t(Wb.sheets.length === 1 ? 'b.sheet1' : 'b.sheets', { n: Wb.sheets.length }), dirty: Book.dirty }));
  };
  // the workbook as it is now: the saved file, or what the engine holds when there are unsaved edits
  async function current() { if (Book.dirty) return Book.bytes(); var res = await fetch(Book.rec.path); return res.arrayBuffer(); }
  A['m-save'] = function () { Ui.closeSheet(); Book.save(); };
  A['m-share'] = async function () {
    Ui.closeSheet();
    try { var buf = await current(); await NativeTools.call('share_files', { fileName: Book.rec.name, base64: App.b64(buf), mimeType: XLSX, title: Book.rec.name, reason: 'Share the workbook' }); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  };
  A['m-copy'] = async function () {
    Ui.closeSheet();
    try { var buf = await current(), r = await NativeTools.call('export_file_device', { fileName: Book.rec.name, base64: App.b64(buf), reason: 'Save a copy to the phone' }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  function csv() {
    var sh = Wb.sh(), out = [], r, c;
    for (r = 0; r < sh.rows; r++) { var line = []; for (c = 0; c < sh.cols; c++) { var x = Fmt.cell(sh, r, c).t; line.push(/[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x); } out.push(line.join(',')); }
    return out.join('\r\n');
  }
  A['m-csv'] = async function () {
    Ui.closeSheet();
    try { var name = Book.rec.name.replace(/\.xlsx$/i, '') + (Wb.sheets.length > 1 ? ' - ' + Wb.sh().name : '') + '.csv', r = await NativeTools.call('export_file_device', { fileName: name, text: '﻿' + csv(), reason: 'Save this sheet as CSV' }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  // PDF: Android's own print flow, with only a plain table of the sheet drawn (see @media print in style-sheets.css)
  A['m-pdf'] = async function () {
    Ui.closeSheet(); var sh = Wb.sh(), h = '<table>', r, c;
    for (r = 0; r < Math.min(sh.rows, 3000); r++) { if (sh.hidR[r]) continue; h += '<tr>'; for (c = 0; c < sh.cols; c++) { if (sh.hidC[c]) continue; var f = Fmt.cell(sh, r, c), st = Wb.style(sh, r, c); h += '<td' + (f.n ? ' class="n"' : '') + (st.b ? ' style="font-weight:700"' : '') + '>' + Ui.esc(f.t) + '</td>'; } h += '</tr>'; }
    $('printArea').innerHTML = h + '</table>'; document.documentElement.classList.add('printing');
    try { await NativeTools.call('export_webview_pdf', { title: Book.rec.name.replace(/\.xlsx$/i, '') }); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
    setTimeout(function () { document.documentElement.classList.remove('printing'); $('printArea').innerHTML = ''; }, 600);
  };
  A['m-rename'] = function () { Struct.startFileRename(); Ui.sheet('rename', SheetsView.rename(Book.rec.name.replace(/\.xlsx$/i, ''))); setTimeout(function () { var i = $('rnName'); if (i) { i.focus(); i.select(); } }, 380); };
  M.rename = function (v) { v = v.replace(/[\\/:*?"<>|]+/g, ' ').trim(); if (!v) return Ui.toast(t('rn.bad')); Book.rec.name = v + '.xlsx'; Store.put(Book.rec); Ui.closeSheet(); Book.chrome(); };
  A['m-remove'] = function () {
    var rec = Book.rec, copy = JSON.parse(JSON.stringify(rec)); Ui.closeSheet(); Book.dirty = false;
    Store.del(rec.key).then(function () { Book.rec = null; Router.back(); Ui.toast(t('t.removed'), function () { Store.put(copy).then(App.renderHome); }); });
  };
  A['m-discard'] = function () { Ui.closeSheet(); Ui.dialog(t('lv.title2'), t('lv.body2'), t('lv.discard'), async function () { await Book.dropDraft(); Book.open(Book.rec, { edit: true }); }, true); };
})();
