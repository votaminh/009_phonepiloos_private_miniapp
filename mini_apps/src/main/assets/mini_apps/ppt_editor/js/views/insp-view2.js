// InspView, the rest: size and place, arrange, picture, table, the link, and the whole panel for a slide when nothing is picked. InspView.panel(state) puts the sections together.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, V = window.InspView, SHUT = {};
  V.shut = SHUT;

  V.size = function (s) {
    var u = s.u, b = s.bb, f = function (v) { return v == null ? '' : Math.round(v / u.f * 100) / 100; };
    return V.row('X', V.num('z-x', f(b.x), 'X', 62) + '<span class="ip-u">' + u.n + '</span>' + V.row2('Y', V.num('z-y', f(b.y), 'Y', 62) + '<span class="ip-u">' + u.n + '</span>'))
      + V.row(t('ip.w'), V.num('z-w', f(b.cx), t('ip.w'), 62) + '<span class="ip-u">' + u.n + '</span>' + V.row2(t('ip.h'), V.num('z-h', f(b.cy), t('ip.h'), 62) + '<span class="ip-u">' + u.n + '</span>') + V.ib('z-lock', 'lock', t('ip.lock'), s.lock))
      + (s.one ? V.row(t('ip.rot'), V.num('z-rot', Math.round((b.rot || 0) * 10) / 10, t('ip.rot'), 56) + '<span class="ip-u">°</span>' + V.ib('a-rot', 'rotate', t('q.rot'), false) + V.ib('a-flip', 'flip', t('dk.fliph'), false, 'h') + V.ib('a-flip', 'flip', t('dk.flipv'), false, 'v')) : '');
  };
  V.arrange = function (s) {
    var al = ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'], ai = ['alignl', 'alignc', 'alignr', 'anchort', 'anchorm', 'anchorb'];
    return V.row(t('q.layer'), V.ib('a-order', 'tofront', t('q.front'), false, 'front') + V.ib('a-order', 'up', t('q.fwd'), false, 'forward') + V.ib('a-order', 'down', t('q.bwd'), false, 'backward') + V.ib('a-order', 'toback', t('q.back'), false, 'back'))
      + V.row(t('q.align'), al.map(function (m, i) { return V.ib('a-align', ai[i], t('al.' + m), false, m); }).join(''))
      + V.row(t('ip.rel'), V.seg([V.chip('a-to', t('ip.toslide'), s.alignTo === 'slide', 'slide'), V.chip('a-to', t('ip.tosel'), s.alignTo !== 'slide', 'selection')]))
      + V.row(t('dk.distribute'), V.ib('a-dist', 'width', t('dk.disth'), false, 'horizontal') + V.ib('a-dist', 'height', t('dk.distv'), false, 'vertical') + V.ib('a-group', 'dup', t('dk.group'), false, 'group') + V.ib('a-group', 'restore', t('dk.ungroup'), false, 'ungroup'));
  };
  V.picture = function (s) {
    var o = s.q.opacity == null ? 1 : s.q.opacity;
    return V.row(t('q.opacity'), V.step('p-op', Math.round(o * 100), t('q.opacity')) + '<span class="ip-u">%</span>') + V.row(t('q.crop'), V.ib('p-crop', 'scissors', t('q.crop'), false) + V.chip('p-crop-reset', t('ip.resetcrop'), false) + V.chip('p-replace', t('ip.replace'), false));
  };
  V.table = function (s) {
    var q = s.q;
    return V.row(t('ip.rows'), V.step('tb-rows', q.rows, t('ip.rows'))) + V.row(t('ip.cols'), V.step('tb-cols', q.cols, t('ip.cols'))) + V.row(t('ip.cells'), V.chip('tb-edit', t('tb.edit'), false));
  };
  V.link = function (s) {
    var l = s.q.more && s.q.more.link, url = l && (l.url || l.target || '');
    return V.row(t('in.link'), V.sel('k-link', url || t('ip.nolink'), t('in.link')) + (url ? V.ib('k-none', 'close', t('in.link.none'), false) : ''));
  };

  // ---- a slide: nothing is picked ------------------------------------------------------------------------------------------------------------------
  V.slide = function (s) {
    var sl = s.slide || {}, adv = sl.advance ? Math.round(sl.advance / 1000) : 0, tr = sl.transition || 'none', ly = (Deck.info && Deck.info.layouts) || [];
    var h = V.sec('layout', t('tl.layout'), '<div class="ip-ly">' + ly.map(function (l) { return V.chip('s-layout', l.name, false, l.name); }).join('') + '</div>')
      + V.sec('bg', t('q.bg'), V.row(t('q.color'), V.col('s-bg', s.bg, t('q.bg')) + V.chip('s-bg-reset', t('ip.reset'), false)))
      + V.sec('trans', t('ip.transition'), V.row(t('ip.effect'), V.sel('s-trans', t('mo.' + tr), t('ip.transition'))) + V.row(t('ip.after'), V.step('s-adv', adv, t('ip.after')) + '<span class="ip-u">s</span>') + V.row('', V.chip('s-trans-all', t('ip.applyall'), false)))
      + V.sec('anim', t('mo.title'), '<div id="ipAnim"></div>', SHUT.anim)
      + V.sec('slide', t('ip.slide'), V.row(t('q.hide'), V.sw('s-hide', !!sl.hidden, t('q.hide'))) + V.row(t('m.size'), V.sel('s-size', s.shape, t('m.size'))) + V.row(t('m.look'), (window.Layout ? Layout.looks() : []).map(function (l) { return V.chip('s-look', t('lk.' + l.id), false, l.id); }).join('')) + V.row(t('m.footer'), V.chip('s-footer', t('ip.edit'), false)));
    return V.head(t('dk.slide', { n: Deck.cur + 1, t: Deck.count() }), (sl.hidden ? t('q.show') + ' · ' : '') + t('ip.nothing')) + h;
  };

  // ---- the whole panel ------------------------------------------------------------------------------------------------------------------------------------
  V.panel = function (s) {
    if (!s.n) return V.slide(s);
    var h = V.head(s.n > 1 ? t('ip.many', { n: s.n }) : t('ip.type.' + (s.type || 'shape')), s.n > 1 ? '' : (s.q.more && s.q.more.name) || ''), sec = function (k, title, body) { return V.sec(k, title, body, SHUT[k]); };
    if (s.hasText) h += sec('text', t('q.text'), V.text(s));
    if (s.canFill) h += sec('fill', t('q.fill'), V.fill(s));
    if (s.canLine) h += sec('line', t('q.line'), V.line(s));
    if (s.canFx) h += sec('fx', t('ip.effects'), V.effects(s));
    if (s.isChart) h += sec('chart', t('ch.chart'), V.chart(s));
    if (s.isPic) h += sec('pic', t('ip.picture'), V.picture(s));
    if (s.isTable) h += sec('tbl', t('q.table'), V.table(s));
    h += sec('size', t('ip.size'), V.size(s)) + sec('arr', t('q.arr'), V.arrange(s));
    if (s.one && s.canLink) h += sec('link', t('in.link'), V.link(s));
    h += sec('anim', t('mo.title'), '<div id="ipAnim"></div>');
    return h;
  };
})();
