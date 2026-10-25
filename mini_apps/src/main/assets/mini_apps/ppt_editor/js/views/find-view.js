// FindView — the search bar (with replace) and the list of results. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  window.FindView = {
    bar: function (f) {
      return '<div class="fd-top"><button type="button" class="ib" data-act="fd-close" aria-label="' + esc(t('fd.close')) + '">' + ic('back', 24, 2) + '</button>'
        + '<label class="fd-in"><input id="fdQ" type="text" value="' + esc(f.q) + '" placeholder="' + esc(t('fd.ph')) + '" aria-label="' + esc(t('fd.ph')) + '" autocomplete="off"><span>' + esc(f.count) + '</span></label>'
        + '<button type="button" class="ib' + (f.none ? ' off' : '') + '" data-act="fd-prev" aria-label="' + esc(t('fd.prev')) + '">' + ic('up', 22, 2) + '</button><button type="button" class="ib' + (f.none ? ' off' : '') + '" data-act="fd-next" aria-label="' + esc(t('fd.next')) + '">' + ic('down', 22, 2) + '</button>'
        + '<button type="button" class="sx-chip fd-cs' + (f.cs ? ' on' : '') + '" data-act="fd-case" aria-pressed="' + !!f.cs + '" aria-label="' + esc(t('fd.case')) + '" title="' + esc(t('fd.case')) + '">Aa</button></div>'
        + '<div class="fd-rep"><label class="fd-in plain"><input id="fdR" type="text" value="' + esc(f.rep) + '" placeholder="' + esc(t('fd.with')) + '" aria-label="' + esc(t('fd.with')) + '" autocomplete="off"></label><button type="button" class="pill" data-act="fd-one">' + esc(t('fd.slide')) + '</button><button type="button" class="pill solid" data-act="fd-all">' + esc(t('fd.all')) + '</button></div>';
    },
    list: function (hits, cur, q, busy) {
      if (!q) return '<p class="sx-none">' + esc(t('fd.type')) + '</p>';
      if (busy) return '<p class="sx-none">' + esc(t('fd.busy')) + '</p>';
      if (!hits.length) return '<p class="sx-none">' + esc(t('fd.none')) + '</p>';
      var s = {}; hits.forEach(function (h) { s[h.slide] = 1; });
      return '<div class="fd-sum">' + esc(t('fd.sum', { n: hits.length, p: Object.keys(s).length })) + '</div>' + hits.map(function (h, k) {
        return '<button type="button" class="res' + (k === cur ? ' on' : '') + '" data-act="fd-pick" data-k="' + k + '"><span class="chip">' + esc(t('fd.s', { n: h.slide + 1 })) + '</span><span class="snip">' + esc(h.before.slice(-30)) + '<b>' + esc(h.hit) + '</b>' + esc(h.after.slice(0, 40)) + '</span></button>';
      }).join('');
    }
  };
})();
