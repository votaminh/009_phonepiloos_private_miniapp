// SlidesView — the page with every slide: a grid of small slides, and the bar of what to do with the picked ones. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function b(act, icon, label, danger) { return '<button type="button" class="pgb' + (danger ? ' danger' : '') + '" data-act="' + act + '">' + ic(icon, 22, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  window.SlidesView = {
    cards: function (slides, sel) {
      return slides.map(function (s, i) {
        return '<button type="button" class="oc' + (sel.indexOf(i) >= 0 ? ' on' : '') + (s.hidden ? ' hid' : '') + '" data-act="o-pick" data-i="' + i + '" aria-label="' + esc(t('sl.n', { n: i + 1 })) + '"><span class="tc"><canvas></canvas>' + (s.hidden ? '<em>' + ic('hide', 14, 2) + '</em>' : '') + '</span><span class="ol"><b>' + (i + 1) + '</b>' + esc(s.title || t('sl.blank')) + '</span></button>';
      }).join('');
    },
    panel: function (slides, sel, multi) {
      return '<div class="pgs-top"><button type="button" class="ib" data-act="o-close" aria-label="' + esc(t('a.close')) + '">' + ic('close', 22, 2) + '</button><div class="bk-ttl"><b>' + esc(t('sl.all')) + '</b><small class="mute" id="ovCount">' + esc(t('sl.count', { n: slides.length })) + '</small></div><button type="button" class="pill' + (multi ? ' solid' : '') + '" data-act="o-multi">' + esc(t('sl.select')) + '</button></div>'
        + '<div class="pgs-grid ov-grid" id="ovGrid">' + window.SlidesView.cards(slides, sel) + '</div>'
        + '<div class="pgs-bar">' + b('o-new', 'plus', t('sl.new')) + b('o-dup', 'copy', t('sl.dup')) + b('o-hide', 'hide', t('sl.hide')) + b('o-del', 'trash', t('a.delete'), true) + '</div>';
    }
  };
})();
