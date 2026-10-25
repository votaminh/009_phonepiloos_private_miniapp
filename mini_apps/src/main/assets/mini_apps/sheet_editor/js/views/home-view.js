// HomeView — the list of recent workbooks, the empty state and the two buttons under them. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc;
  function ago(ms) {
    var m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 1) return t('t.now'); if (m < 60) return t('t.min', { n: m }); if (m < 1440) return t('t.hour', { n: Math.round(m / 60) });
    if (m < 14400) return t('t.day', { n: Math.round(m / 1440) });
    return new Date(ms).toLocaleDateString(I18n.locale(), { day: 'numeric', month: 'short' });
  }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', I18n.locale() === 'vi-VN' ? ',' : '.') + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB'; }
  // a tiny grid: header row tinted, a few cells
  function grid(cls, cells) { var s = '', i; for (i = 0; i < cells; i++) s += i < 3 ? '<i></i>' : '<b></b>'; return '<span class="' + cls + '" aria-hidden="true">' + s + '</span>'; }
  // what the first cells of the first sheet look like (saved with the file's record when it was last opened), else a plain grid
  function peek(d, cls) {
    if (!d.peek || !d.peek.length) return grid(cls, 12);
    var h = '<span class="' + cls + ' pk" aria-hidden="true">';
    d.peek.forEach(function (r) { r.forEach(function (c) { h += '<u' + (c[1] ? ' style="background:' + esc(c[1]) + '"' : '') + (c[2] ? ' class="bd"' : '') + '>' + esc(c[0]) + '</u>'; }); });
    return h + '</span>';
  }
  window.HomeView = {
    size: size, ago: ago,
    top: function (s) {
      if (s.search) return '<div class="hm-find"><span>' + Ui.ic('search', 20) + '</span><input class="hm-in" id="homeQ" type="text" value="' + esc(s.q) + '" placeholder="' + esc(t('h.search.ph')) + '" aria-label="' + esc(t('h.search')) + '" autocomplete="off"><button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('a.close')) + '">' + Ui.ic('close', 22) + '</button></div>';
      return '<div class="hm-ttl"><h1 class="shell-title">' + esc(t('app.title')) + '</h1><p class="hm-sub">' + esc(t('app.sub')) + '</p></div>' + (s.count ? '<button type="button" class="ib" data-act="h-view" aria-label="' + esc(t(s.grid ? 'h.list' : 'h.grid')) + '">' + Ui.ic(s.grid ? 'viewlist' : 'viewgrid', 24, 1.8) + '</button><button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('h.search')) + '">' + Ui.ic('search', 24, 1.8) + '</button>' : '');
    },
    head: function (label) { return '<span class="hm-hd">' + esc(label) + '</span>'; },
    row: function (d) {
      var sub = d.draft ? '<span class="hm-dot warn"></span>' + esc(t('m.draft')) : '<span class="hm-dot ok"></span>' + esc(t(d.editedAt && d.editedAt >= (d.openedAt || 0) - 1000 ? 'm.edited' : 'm.opened', { t: ago(d.openedAt || 0) }));
      return '<div class="hm-card" data-act="h-open" data-id="' + esc(d.key) + '" role="button" tabindex="0">' + peek(d, 'hm-th')
        + '<span class="hm-txt"><b>' + esc(d.name) + '</b><small>' + size(d.size) + ' · ' + sub + '</small></span>'
        + '<button type="button" class="ib hm-more" data-act="h-more" data-id="' + esc(d.key) + '" aria-label="' + esc(t('r.menu')) + '">' + Ui.ic('more', 20) + '</button></div>';
    },
    // the same file as a tile (grid view): the first cells over the name; two tiles make one row of the list
    tile: function (d) {
      var sub = d.draft ? '<span class="hm-dot warn"></span>' + esc(t('m.draft')) : '<span class="hm-dot ok"></span>' + esc(t(d.editedAt && d.editedAt >= (d.openedAt || 0) - 1000 ? 'm.edited' : 'm.opened', { t: ago(d.openedAt || 0) }));
      return '<div class="hm-card hm-tile" data-act="h-open" data-id="' + esc(d.key) + '" role="button" tabindex="0">' + peek(d, 'hm-th')
        + '<span class="hm-txt"><b>' + esc(d.name) + '</b><small>' + size(d.size) + ' · ' + sub + '</small></span>'
        + '<button type="button" class="ib hm-more" data-act="h-more" data-id="' + esc(d.key) + '" aria-label="' + esc(t('r.menu')) + '">' + Ui.ic('more', 20) + '</button></div>';
    },
    pair: function (ds) { return '<div class="hm-pair">' + HomeView.tile(ds[0]) + (ds[1] ? HomeView.tile(ds[1]) : '<span></span>') + '</div>'; },
    none: function () { return '<p class="hm-none">' + esc(t('h.none')) + '</p>'; },
    empty: function () {
      return '<div class="hm-empty"><div class="hm-art" aria-hidden="true"><span class="p1"></span><span class="p2"></span>' + grid('p3', 18) + '<span class="pen">' + Ui.ic('edit', 22, 2.1) + '</span></div>'
        + '<h2>' + esc(t('empty.title')) + '</h2><p>' + esc(t('empty.body')) + '</p>'
        + '<div class="hm-tip"><span class="ti">' + Ui.ic('share', 18) + '</span><span><b>' + esc(t('empty.tip.t')) + '</b><small>' + esc(t('empty.tip')) + '</small></span></div></div>';
    },
    actions: function () {
      return '<button type="button" class="btn ol" data-act="h-new">' + Ui.ic('plus', 18, 2.2) + esc(t('home.new')) + '</button><button type="button" class="btn" data-act="h-pick">' + Ui.ic('sheet', 18) + esc(t('a.open')) + '</button>';
    },
    error: function (title, body) { return '<div class="er"><span class="er-i">' + Ui.ic('alert', 22, 2.2) + '</span><div><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p></div></div><button type="button" class="btn ol" data-act="h-pick">' + esc(t('err.again')) + '</button>'; }
  };
})();
