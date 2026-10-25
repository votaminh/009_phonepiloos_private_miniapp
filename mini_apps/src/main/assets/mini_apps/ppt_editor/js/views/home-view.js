// HomeView — the list of recent decks, the empty state, the two buttons under them and the sheet for a new deck. Strings only; no event code.
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
  // a tiny page: a heading bar and a few lines of text
  function grid(cls) { return '<span class="' + cls + '" aria-hidden="true"><i></i><b></b><b></b><b></b><b></b></span>'; }
  window.HomeView = {
    size: size, ago: ago,
    top: function (s) {
      if (s.search) return '<div class="hm-find"><span>' + Ui.ic('search', 20) + '</span><input class="hm-in" id="homeQ" type="text" value="' + esc(s.q) + '" placeholder="' + esc(t('h.search.ph')) + '" aria-label="' + esc(t('h.search')) + '" autocomplete="off"><button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('a.close')) + '">' + Ui.ic('close', 22) + '</button></div>';
      return '<div class="hm-ttl"><h1 class="shell-title">' + esc(t('app.title')) + '</h1><p class="hm-sub">' + esc(t('app.sub')) + '</p></div>' + (s.count ? '<button type="button" class="ib" data-act="h-search" aria-label="' + esc(t('h.search')) + '">' + Ui.ic('search', 24, 1.8) + '</button>' : '');
    },
    head: function (label) { return '<span class="hm-hd">' + esc(label) + '</span>'; },
    row: function (d) {
      var sub = d.draft ? '<span class="hm-dot warn"></span>' + esc(t('m.draft')) : '<span class="hm-dot ok"></span>' + esc(t(d.editedAt && d.editedAt >= (d.openedAt || 0) - 1000 ? 'm.edited' : 'm.opened', { t: ago(d.openedAt || 0) }));
      return '<div class="hm-card" data-act="h-open" data-id="' + esc(d.key) + '" role="button" tabindex="0">' + (d.thumb ? '<span class="hm-th pic"><img alt="" src="' + esc(d.thumb) + '"></span>' : grid('hm-th'))
        + '<span class="hm-txt"><b>' + esc(d.name) + '</b><small>' + size(d.size) + ' · ' + sub + '</small></span>'
        + '<button type="button" class="ib hm-more" data-act="h-more" data-id="' + esc(d.key) + '" aria-label="' + esc(t('r.menu')) + '">' + Ui.ic('more', 20) + '</button></div>';
    },
    // a new deck: the look, the first slide, the page shape
    newDeck: function (nd) {
      var looks = ['tide', 'paper', 'night', 'fresh'].map(function (id) { return [id, AppLooks[id].bg, AppLooks[id].ac]; });
      function chip(act, k, label, on) { return '<button type="button" class="sx-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-k="' + k + '">' + esc(label) + '</button>'; }
      return '<div class="sx-hd"><div><h2>' + esc(t('nd.new')) + '</h2></div></div><div class="sx-sec">' + esc(t('nd.look')) + '</div><div class="lks">'
        + looks.map(function (l) { return '<button type="button" class="lk' + (nd.look === l[0] ? ' on' : '') + '" data-act="n-look" data-k="' + l[0] + '"><span style="background:' + l[1] + '"><i style="background:' + l[2] + '"></i></span><b>' + esc(t('lk.' + l[0])) + '</b></button>'; }).join('') + '</div>'
        + '<div class="sx-sec">' + esc(t('nd.first')) + '</div><div class="sx-chips">' + chip('n-first', 'title', t('nd.f.title'), nd.first === 'title') + chip('n-first', 'text', t('nd.f.text'), nd.first === 'text') + chip('n-first', 'blank', t('nd.f.blank'), nd.first === 'blank') + '</div>'
        + '<div class="sx-sec">' + esc(t('nd.size')) + '</div><div class="sx-chips">' + chip('n-size', '16:9', '16:9', nd.size === '16:9') + chip('n-size', '4:3', '4:3', nd.size === '4:3') + '</div>'
        + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="n-go">' + esc(t('nd.create')) + '</button></div>';
    },
    none: function () { return '<p class="hm-none">' + esc(t('h.none')) + '</p>'; },
    empty: function () {
      return '<div class="hm-empty"><div class="hm-art" aria-hidden="true"><span class="p1"></span><span class="p2"></span>' + grid('p3') + '<span class="pen">' + Ui.ic('edit', 22, 2.1) + '</span></div>'
        + '<h2>' + esc(t('empty.title')) + '</h2><p>' + esc(t('empty.body')) + '</p>'
        + '<div class="hm-tip"><span class="ti">' + Ui.ic('share', 18) + '</span><span><b>' + esc(t('empty.tip.t')) + '</b><small>' + esc(t('empty.tip')) + '</small></span></div></div>';
    },
    actions: function () {
      return '<button type="button" class="btn ol" data-act="h-new">' + Ui.ic('plus', 18, 2.2) + esc(t('home.new')) + '</button><button type="button" class="btn" data-act="h-pick">' + Ui.ic('doc', 18) + esc(t('a.open')) + '</button>';
    },
    error: function (title, body) { return '<div class="er"><span class="er-i">' + Ui.ic('alert', 22, 2.2) + '</span><div><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p></div></div><button type="button" class="btn ol" data-act="h-pick">' + esc(t('err.again')) + '</button>'; }
  };
})();
