// FindView — the search bar and the list of results. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  window.FindView = {
    bar: function (f) {
      return '<button type="button" class="ib" data-act="fd-close" aria-label="' + esc(t('fd.close')) + '">' + ic('back', 24, 2) + '</button>'
        + '<label class="fd-in"><input id="fdQ" type="text" value="' + esc(f.q) + '" placeholder="' + esc(t('fd.ph')) + '" aria-label="' + esc(t('fd.ph')) + '" autocomplete="off"><span>' + esc(f.count) + '</span></label>'
        + '<button type="button" class="ib' + (f.none ? ' off' : '') + '" data-act="fd-prev" aria-label="' + esc(t('fd.prev')) + '">' + ic('up', 22, 2) + '</button><button type="button" class="ib' + (f.none ? ' off' : '') + '" data-act="fd-next" aria-label="' + esc(t('fd.next')) + '">' + ic('down', 22, 2) + '</button>'
        + '<button type="button" class="sx-chip fd-cs' + (f.cs ? ' on' : '') + '" data-act="fd-case" aria-pressed="' + !!f.cs + '" aria-label="' + esc(t('fd.case')) + '" title="' + esc(t('fd.case')) + '">Aa</button>';
    },
    list: function (hits, cur, q, busy) {
      if (!q) return '<p class="sx-none">' + esc(t('fd.type')) + '</p>';
      if (busy) return '<p class="sx-none">' + esc(t('fd.busy')) + '</p>';
      if (!hits.length) return '<p class="sx-none">' + esc(t('fd.none')) + '</p>';
      var pages = {}; hits.forEach(function (h) { pages[h.page] = 1; });
      return '<div class="fd-sum">' + esc(t('fd.sum', { n: hits.length, p: Object.keys(pages).length })) + '</div>' + hits.map(function (h, k) {
        return '<button type="button" class="res' + (k === cur ? ' on' : '') + '" data-act="fd-pick" data-k="' + k + '"><span class="chip">' + esc(t('fd.p', { n: h.page + 1 })) + '</span><span class="snip">' + esc(h.before.slice(-40)) + '<b>' + esc(h.hit) + '</b>' + esc(h.after.slice(0, 50)) + '</span></button>';
      }).join('');
    }
  };
})();
