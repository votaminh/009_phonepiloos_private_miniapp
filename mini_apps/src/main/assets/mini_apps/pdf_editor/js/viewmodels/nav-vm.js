// Nav — moving about inside a PDF: its links (a tap on one opens the address or goes to the page) and its table of contents (the bookmarks the file carries).
// The links are drawn over the pages in reading mode; the contents show in the left column on a computer (next to the thumbnails) and in a sheet from the Page menu.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, N = window.Nav = { items: [], tab: 'pages' }, cache = {};

  // ---- links ------------------------------------------------------------------------------------------------------------------------
  function ver() { return window.Desk ? Desk.ver : 0; }
  function get(i) { var k = i + ':' + ver(); if (!cache[k]) cache[k] = PdfSvc.links(i).catch(function () { return []; }); return cache[k]; }
  Read.layers.push(function (ov, i) {
    if (Read.mode !== 'read') return;
    get(i).then(function (ls) {
      if (!ov.isConnected || Read.mode !== 'read') return;
      ov.insertAdjacentHTML('beforeend', ls.map(function (l) {
        var b = Read.box(i, l.rect); return '<a class="lk" role="link" tabindex="-1" data-act="lk-go"' + (l.uri ? ' data-u="' + esc(l.uri) + '" title="' + esc(l.uri) + '"' : ' data-p="' + l.page + '"') + ' style="left:' + b.l + 'px;top:' + b.t + 'px;width:' + b.w + 'px;height:' + b.h + 'px"></a>';
      }).join(''));
    });
  });
  A['lk-go'] = function (el) {
    if (el.dataset.u) { NativeTools.call('open_url', { url: el.dataset.u, reason: 'Open a link of the PDF' }).catch(function () { Ui.toast(t('nv.nolink')); }); return; }
    if (el.dataset.p != null) { if (window.Reflow && Reflow.on) Reflow.apply('page'); setTimeout(function () { Desk.go(+el.dataset.p); }, 30); }
  };

  // ---- contents -----------------------------------------------------------------------------------------------------------------------
  N.load = async function () {
    N.items = []; N.tab = 'pages';
    try { N.items = (await PdfSvc.outline()).filter(function (x) { return x.title && x.page >= 0 && x.page < Doc.sizes.length; }); } catch (e) { /* none */ }
    if (window.Desk) Desk.thumbs();
  };
  N.tabs = function () {
    if (!N.items.length) return '';
    return '<div class="dk-tabs" role="tablist">' + ['pages', 'toc'].map(function (k) { return '<button type="button" role="tab" aria-selected="' + (N.tab === k) + '" class="' + (N.tab === k ? 'on' : '') + '" data-act="nv-tab" data-k="' + k + '">' + esc(t(k === 'pages' ? 'nv.pages' : 'nv.toc')) + '</button>'; }).join('') + '</div>';
  };
  N.list = function (cls) {
    var cur = Desk.cur();
    return '<div class="' + cls + '">' + N.items.map(function (x) { return '<button type="button" class="nv-i' + (x.page === cur ? ' on' : '') + '" data-act="nv-go" data-p="' + x.page + '" style="padding-left:' + (10 + x.level * 14) + 'px"><span>' + esc(x.title) + '</span><small>' + (x.page + 1) + '</small></button>'; }).join('') + '</div>';
  };
  A['nv-tab'] = function (el) { N.tab = el.dataset.k; Desk.thumbs(); };
  A['nv-go'] = function (el) { if (Ui.state.sheet === 'toc') Ui.closeSheet(); if (window.Reflow && Reflow.on) { Desk.go(+el.dataset.p); return; } Desk.go(+el.dataset.p); };
  N.sheet = function () { Ui.sheet('toc', '<h2 class="sh-h">' + esc(t('nv.toc')) + '</h2>' + (N.items.length ? N.list('nv-sheet') : '<p class="dp-hint">' + esc(t('nv.none')) + '</p>')); };

  Menus.add('page', function () { return [{ t: t('nv.toc') + '…', off: !N.items.length, go: N.sheet }]; });
  var o = Desk.opened; Desk.opened = function () { var r = o.apply(this, arguments); cache = {}; N.load(); return r; };
})();
