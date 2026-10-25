// HomeView — the list of recent documents, the empty state and the two buttons under them. Strings only; no event code.
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
  // the picture of page 1 when there is one, otherwise a plain page of lines
  function pic(d, i) { var src = d.thumb || Thumb.mem[d.key]; return src ? '<span class="hm-th pic" aria-hidden="true"><img src="' + esc(src) + '" alt=""></span>' : thumb(i); }
  function thumb(seed) {
    var w = [60, 50, 70, 55, 65][seed % 5], x = [100, 80, 100, 85, 100][(seed >> 1) % 5];
    return '<span class="hm-th" aria-hidden="true"><i style="width:' + w + '%"></i><b></b><b style="width:' + x + '%"></b><b></b><b style="width:' + (40 + (seed % 4) * 12) + '%"></b></span>';
  }
  window.HomeView = {
    size: size, ago: ago,
    // tablet and desktop: title, search, the list/grid switch and both buttons live in the top bar (the phone's bottom buttons are hidden there)
    wide: function (s) {
      var seg = function (k, ic, lab) { var on = (k === 'grid') === !!s.grid; return '<button type="button" class="' + (on ? 'on' : '') + '" data-act="h-vs" data-k="' + k + '" aria-pressed="' + on + '" aria-label="' + esc(lab) + '">' + Ui.ic(ic, 20, 1.8) + '</button>'; };
      return '<div class="hm-w"><div class="hm-ttl"><h1 class="shell-title">' + esc(t('app.title')) + '</h1><p class="hm-sub">' + esc(t('app.sub')) + '</p></div>'
        + '<label class="hm-ws">' + Ui.ic('search', 20) + '<input class="hm-in" id="homeQw" type="text" value="' + esc(s.q) + '" placeholder="' + esc(t('h.search.ph')) + '" aria-label="' + esc(t('h.search')) + '" autocomplete="off"></label>'
        + '<i class="hm-br"></i><span class="hm-sp"></span>'
        + (s.count ? '<div class="hm-seg" role="group">' + seg('list', 'viewlist', t('h.list')) + seg('grid', 'viewgrid', t('h.grid')) + '</div>' : '')
        + '<button type="button" class="btn ol hm-wn" data-act="h-new">' + Ui.ic('plus', 18, 2.2) + '<span class="lg">' + esc(t('a.new')) + '</span><span class="sm">' + esc(t('home.new')) + '</span></button><button type="button" class="btn hm-wo" data-act="h-pick">' + Ui.ic('doc', 18) + '<span>' + esc(t('a.open')) + '</span></button></div>';
    },
    top: function (s) { return '<div class="hm-ph">' + HomeView.phoneTop(s) + '</div>' + HomeView.wide(s); },
    phoneTop: function (s) {
      if (s.search) return '<div class="hm-find"><span>' + Ui.ic('search', 20) + '</span><input class="hm-in" id="homeQ" type="text" value="' + esc(s.q) + '" placeholder="' + esc(t('h.search.ph')) + '" aria-label="' + esc(t('h.search')) + '" autocomplete="off"><button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('a.close')) + '">' + Ui.ic('close', 22) + '</button></div>';
      return '<div class="hm-ttl"><h1 class="shell-title">' + esc(t('app.title')) + '</h1><p class="hm-sub">' + esc(t('app.sub')) + '</p></div>' + (s.count ? '<button type="button" class="ib" data-act="h-view" aria-label="' + esc(t(s.grid ? 'h.list' : 'h.grid')) + '">' + Ui.ic(s.grid ? 'viewlist' : 'viewgrid', 24, 1.8) + '</button><button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('h.search')) + '">' + Ui.ic('search', 24, 1.8) + '</button>' : '');
    },
    head: function (label) { return '<span class="hm-hd">' + esc(label) + '</span>'; },
    row: function (d, i) {
      var sub = d.draft ? '<span class="hm-dot warn"></span>' + esc(t('m.draft')) : '<span class="hm-dot ok"></span>' + esc(t(d.editedAt && d.editedAt >= (d.openedAt || 0) - 1000 ? 'm.edited' : 'm.opened', { t: ago(d.openedAt || 0) }));
      return '<div class="hm-card" data-act="h-open" data-id="' + esc(d.key) + '" role="button" tabindex="0">' + pic(d, i)
        + '<span class="hm-txt"><b>' + esc(d.name) + '</b><small>' + size(d.size) + ' · ' + sub + '</small></span>'
        + '<button type="button" class="ib hm-more" data-act="h-more" data-id="' + esc(d.key) + '" aria-label="' + esc(t('r.menu')) + '">' + Ui.ic('more', 20) + '</button></div>';
    },
    // the same file as a tile (grid view): a big page preview over the name; two tiles make one row of the list
    tile: function (d, i) {
      var sub = d.draft ? '<span class="hm-dot warn"></span>' + esc(t('m.draft')) : '<span class="hm-dot ok"></span>' + esc(t(d.editedAt && d.editedAt >= (d.openedAt || 0) - 1000 ? 'm.edited' : 'm.opened', { t: ago(d.openedAt || 0) }));
      return '<div class="hm-card hm-tile" data-act="h-open" data-id="' + esc(d.key) + '" role="button" tabindex="0">' + pic(d, i) + '<span class="hm-txt"><b>' + esc(d.name) + '</b><small>' + size(d.size) + ' · ' + sub + '</small></span>'
        + '<button type="button" class="ib hm-more" data-act="h-more" data-id="' + esc(d.key) + '" aria-label="' + esc(t('r.menu')) + '">' + Ui.ic('more', 20) + '</button></div>';
    },
    pair: function (ds, i, g) { g = g || {}; return '<div class="hm-pair"' + (g.n ? ' style="--n:' + g.n + ';--gap:' + g.gap + 'px;--th:' + g.th + 'px"' : '') + '>' + ds.map(function (d, k) { return HomeView.tile(d, i + k); }).join('') + '</div>'; },
    none: function () { return '<p class="hm-none">' + esc(t('h.none')) + '</p>'; },
    empty: function () {
      return '<div class="hm-empty"><div class="hm-art" aria-hidden="true"><span class="p1"></span><span class="p2"></span><span class="p3"><i></i><b></b><b></b><b></b></span><span class="pen">' + Ui.ic('edit', 22, 2.1) + '</span></div>'
        + '<h2>' + esc(t('empty.title')) + '</h2><p>' + esc(t('empty.body')) + '</p>'
        + '<div class="hm-tip"><span class="ti">' + Ui.ic('share', 18) + '</span><span><b>' + esc(t('empty.tip.t')) + '</b><small>' + esc(t('empty.tip')) + '</small></span></div></div>';
    },
    actions: function () {
      return '<button type="button" class="btn ol" data-act="h-new">' + Ui.ic('plus', 18, 2.2) + esc(t('home.new')) + '</button><button type="button" class="btn" data-act="h-pick">' + Ui.ic('doc', 18) + esc(t('a.open')) + '</button>';
    }
  };
})();
