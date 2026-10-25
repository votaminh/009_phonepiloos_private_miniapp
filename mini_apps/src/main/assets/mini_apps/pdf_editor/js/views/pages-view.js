// PagesView — the page manager: a grid of small pages and the bar of what to do with the picked ones. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function b(act, icon, label, danger) { return '<button type="button" class="pgb' + (danger ? ' danger' : '') + '" data-act="' + act + '">' + ic(icon, 22, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  window.PagesView = {
    bar: function () {
      return b('p-rot', 'refresh', t('pg.rot')) + b('p-dup', 'dup', t('pg.dup.b')) + b('p-take', 'download', t('pg.take')) + b('p-blank', 'plus', t('pg.blank')) + b('p-merge', 'merge', t('pg.merge')) + b('p-up', 'up', t('pg.up')) + b('p-down', 'down', t('pg.down')) + b('p-del', 'trash', t('a.delete'), true);
    },
    panel: function (sizes, sel) {
      var cards = sizes.map(function (s, i) { return '<button type="button" class="pgc' + (sel.indexOf(i) >= 0 ? ' on' : '') + '" data-act="p-sel" data-i="' + i + '" aria-label="' + esc(t('pg.page', { n: i + 1 })) + '"><canvas></canvas><b>' + (i + 1) + '</b><i>' + ic('check', 14, 3) + '</i></button>'; }).join('');
      return '<div class="pgs-top"><button type="button" class="ib" data-act="p-close" aria-label="' + esc(t('a.close')) + '">' + ic('close', 22, 2) + '</button><div class="bk-ttl"><b>' + esc(t('tl.pages')) + '</b><small id="pgsCount">' + esc(sel.length ? t('pg.picked', { n: sel.length }) : t('pg.count', { n: sizes.length })) + '</small></div><button type="button" class="pill" data-act="p-all">' + esc(t('pg.all')) + '</button></div>'
        + '<div class="pgs-grid" id="pgsGrid">' + cards + '</div><div class="pgs-bar" id="pgsBar">' + window.PagesView.bar() + '</div>';
    }
  };
})();
