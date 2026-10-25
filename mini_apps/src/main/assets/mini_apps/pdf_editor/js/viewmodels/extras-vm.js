// Extras — what a computer's PDF reader has beyond the basics: the place where the file was left, page bookmarks, a page as a picture, the text of a page or of the whole file, the properties of the file, a night look for the pages.
// Each one is an item in a menu (Menus.add), so the touch layout reaches them from "All features" too.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, X = window.Extras = {}, saveT = 0;
  function rec() { return Viewer.rec; }
  function base() { return (rec() ? rec().name : 'document').replace(/\.pdf$/i, ''); }
  function done(e) { if (e && String(e.message) !== 'cancelled') App.fail('err.generic', e); }

  // ---- where the file was left ------------------------------------------------------------------------------------------------------
  function remember() {
    clearTimeout(saveT); saveT = setTimeout(function () { var r = rec(); if (!r || Router.getCurrent() !== 'doc' || !Doc.sizes.length) return; var p = Desk.cur(); if (p === (r.lastPage || 0)) return; r.lastPage = p; Store.put(r); }, 700);
  }
  function restore() {
    var r = rec(), p = r && r.lastPage; if (!p || p >= Doc.sizes.length || (Viewer.edit0)) return; var tries = 0;
    (function go() {
      if (window.Reflow && Reflow.on) { if (Reflow.built) return Desk.go(p, true); if (++tries < 20) return setTimeout(go, 150); return; }
      if (!Read.list) { if (++tries < 20) setTimeout(go, 150); return; }
      var sc = $('rdScroll'); sc.scrollTop = Math.max(0, $('rdHost').offsetTop + Read.tops[p] - 8); Read.counter();
    })();
  }

  // ---- bookmarks ---------------------------------------------------------------------------------------------------------------------------
  X.marks = function () { var r = rec(); return r && r.bookmarks ? r.bookmarks.slice().sort(function (a, b) { return a - b; }) : []; };
  X.toggleMark = function () {
    var r = rec(); if (!r) return; var p = Desk.cur(), m = X.marks(), i = m.indexOf(p); if (i >= 0) m.splice(i, 1); else m.push(p);
    r.bookmarks = m; Store.put(r); Ui.toast(t(i >= 0 ? 'xt.unmarked' : 'xt.marked', { n: p + 1 })); if (window.Desk) Desk.panel();
  };
  X.panel = function () {
    var m = X.marks(); if (!m.length) return '';
    return '<section class="dk-sec"><h3>' + esc(t('xt.marks')) + '</h3><div class="xt-list">' + m.map(function (p) { return '<button type="button" class="xt-bm" data-act="dk-go" data-p="' + p + '">' + ic('flag', 16, 2) + '<span>' + esc(t('rf.pg', { n: p + 1 })) + '</span></button>'; }).join('') + '</div></section>';
  };
  X.marksSheet = function () {
    var m = X.marks();
    Ui.sheet('marks', '<h2 class="sh-h">' + esc(t('xt.marks')) + '</h2><div class="al-list">' + (m.length ? m.map(function (p) { return '<button type="button" class="opt al-row" data-act="dk-go" data-p="' + p + '">' + ic('flag', 20, 2) + '<span class="op-t"><b>' + esc(t('rf.pg', { n: p + 1 })) + '</b></span></button>'; }).join('') : '<p class="dp-hint">' + esc(t('xt.nomarks')) + '</p>') + '</div>');
  };
  var goOld = A['dk-go']; A['dk-go'] = function (el) { if (Ui.state.sheet === 'marks') Ui.closeSheet(); goOld(el); };

  // ---- a page as a picture; the text -----------------------------------------------------------------------------------------------
  async function shot(i, kind) {
    var s = Doc.sizes[i], w = 1600, h = Math.round(w * s[1] / s[0]), px = await PdfSvc.render(i, w, h), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
    var blob = await new Promise(function (r) { cv.toBlob(r, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.92); }); return App.b64(await blob.arrayBuffer());
  }
  X.pic = async function (kind, all) {
    try {
      var from = all ? 0 : Desk.cur(), to = all ? Doc.sizes.length - 1 : from, last = null;
      for (var i = from; i <= to; i++) { if (all) Ui.toast(t('xt.progress', { n: i + 1, t: Doc.sizes.length })); last = await NativeTools.call('export_file_device', { fileName: base() + '-' + (i + 1) + '.' + kind, base64: await shot(i, kind), reason: 'Save a page as a picture' }); }
      Ui.toast(t(all ? 'xt.allsaved' : 'xt.saved', { n: to - from + 1, p: (last && last.data && last.data.displayPath) || '' }));
    } catch (e) { done(e); }
  };
  async function textOf(pages) {
    var out = []; for (var i = 0; i < pages.length; i++) { var ps = await Doc.paras(pages[i]); out.push(ps.slice().sort(function (a, b) { return b.rect[3] - a.rect[3] || a.rect[0] - b.rect[0]; }).map(function (q) { return q.text; }).join('\n')); } return out.join('\n\n');
  }
  X.copyText = async function () {
    var txt = await textOf([Desk.cur()]); if (!txt.trim()) return Ui.toast(t('xt.notext'));
    try { await navigator.clipboard.writeText(txt); Ui.toast(t('xt.copied')); } catch (e) { Ui.toast(t('xt.copyfail')); }
  };
  X.saveText = async function () {
    try {
      var all = []; for (var i = 0; i < Doc.sizes.length; i++) all.push(i); var txt = await textOf(all); if (!txt.trim()) return Ui.toast(t('xt.notext'));
      var r = await NativeTools.call('export_file_device', { fileName: base() + '.txt', base64: btoa(unescape(encodeURIComponent(txt))), reason: 'Save the text of the PDF' }); Ui.toast(t('xt.textsaved', { p: (r && r.data && r.data.displayPath) || '' }));
    } catch (e) { done(e); }
  };

  // ---- properties; night -----------------------------------------------------------------------------------------------------------
  X.props = function () {
    var r = rec(); if (!r) return; var sizes = {}, mm = function (v) { return Math.round(v / 72 * 25.4); };
    Doc.sizes.forEach(function (z) { var k = mm(z[0]) + ' × ' + mm(z[1]) + ' mm'; sizes[k] = (sizes[k] || 0) + 1; });
    function line(k, v) { return '<div class="pr-row"><span>' + esc(t(k)) + '</span><b>' + esc(v) + '</b></div>'; }
    Ui.sheet('props', '<h2 class="sh-h">' + esc(t('xt.props')) + '</h2>' + line('xt.name', r.name) + line('xt.pages', String(Doc.sizes.length)) + line('xt.size', HomeView.size(r.size || 0))
      + line('xt.pgsize', Object.keys(sizes).map(function (k) { return k + (Object.keys(sizes).length > 1 ? ' (' + sizes[k] + ')' : ''); }).join(', ')) + line('xt.where', (r.path || '').split('/').slice(-1)[0] || '-') + '<div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>');
  };
  X.night = function () { return !!Store.prefs().night; };
  X.applyNight = function () { document.documentElement.classList.toggle('night-pg', X.night()); };
  X.toggleNight = function () { Store.savePrefs({ night: !X.night() }); X.applyNight(); };

  Menus.add('file', function () { return [{ t: t('xt.png'), go: function () { X.pic('png'); } }, { t: t('xt.jpg'), go: function () { X.pic('jpg'); } }, { t: t('xt.allpng'), go: function () { X.pic('png', true); } }, '-', { t: t('xt.savetext'), go: X.saveText }, { t: t('xt.props'), go: X.props }]; });
  Menus.add('edit', function () { return [{ t: t('xt.copytext'), go: X.copyText }]; });
  Menus.add('view', function () { return [{ t: t('xt.night'), on: X.night(), go: X.toggleNight }]; });
  Menus.add('page', function () { return [{ t: t(X.marks().indexOf(Desk.cur()) >= 0 ? 'xt.unmark' : 'xt.mark'), go: X.toggleMark }, { t: t('xt.marks') + '…', go: X.marksSheet }]; });

  X.init = function () {
    X.applyNight(); $('rdScroll').addEventListener('scroll', remember, { passive: true }); $('rfScroll').addEventListener('scroll', remember, { passive: true });
    var o = Desk.opened; Desk.opened = function () { var r = o.apply(this, arguments); setTimeout(restore, 200); return r; };
  };
})();
