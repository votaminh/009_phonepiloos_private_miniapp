// Wide screens — the Contents column (a drawer on a tablet, a column or a thin rail beside the page on a laptop and desktop) and the zoom box. The phone keeps its sheets; all of this stays hidden there.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, sig = '', cur = [], raf = 0, tz = 0;
  var Wd = window.Wide;
  function heads() { return Array.prototype.map.call(Doc.paper().querySelectorAll('.b[data-t="h"]'), function (el) { return { lv: +el.dataset.lv || 1, text: el.textContent.trim(), el: el }; }).filter(function (h) { return h.text; }); }
  function onPages() { return $('pages').classList.contains('on'); }
  function pageOf(h) { if (window.Paginate && Paginate.active()) return Paginate.pageOf(h.el); var s = h.el.dataset.src; return onPages() && window.PageView && s !== undefined && PageView.map[s] !== undefined ? PageView.map[s] + 1 : ''; }

  // ---- Contents ------------------------------------------------------------------------------------------------------------------
  function render() {
    var side = $('docSide'); if (!side || !Doc.rec || !Wd.is()) return;
    var hs = heads(), qq = (Wd.q || '').toLowerCase(), key = Doc.rec.key + '|' + qq + '|' + hs.map(function (h) { return h.lv + h.text + pageOf(h); }).join('~');
    if (key === sig) return; sig = key; cur = hs;
    side.innerHTML = '<div class="sd-h">' + esc(t('o.title')) + '</div>'
      + '<button type="button" class="sd-i sd-doc" data-act="sd-top"><b class="sd-n">' + Ui.ic('doc', 18, 1.8) + '</b><span class="sd-t">' + esc(Doc.rec.name.replace(/\.docx$/i, '')) + '</span></button>'
      + (hs.length ? hs.map(function (h, i) { return '<button type="button" class="sd-i lv' + Math.min(h.lv, 3) + '" data-act="sd-go" data-i="' + i + '"><b class="sd-n">' + (i + 1) + '</b><span class="sd-t">' + esc(h.text) + '</span><em>' + pageOf(h) + '</em></button>'; }).join('') : '<p class="sd-none">' + esc(t('o.none')) + '</p>');
    mark();
  }
  Wd.renderSide = render;
  function here() {
    if (!cur.length) return -1; var at = -1;
    if (window.Paginate && Paginate.active()) { var cp = Paginate.at(); cur.forEach(function (h, i) { if (Paginate.pageOf(h.el) <= cp) at = i; }); return at; }
    if (onPages()) { var pg = PageView.here(); cur.forEach(function (h, i) { var p = PageView.map[h.el.dataset.src]; if (p !== undefined && p <= pg) at = i; }); return at; }
    var top = $('docBody').scrollTop + 60; cur.forEach(function (h, i) { if (h.el.offsetTop - Doc.paper().offsetTop <= top) at = i; }); return at;
  }
  function mark() {
    var side = $('docSide'), at = here(), on = side.querySelector('.sd-i.on'), next = at < 0 ? side.querySelector('.sd-doc') : side.querySelector('[data-i="' + at + '"]');
    if (on === next) return; if (on) on.classList.remove('on'); if (next) { next.classList.add('on'); if (next.scrollIntoView && getComputedStyle(side).overflowY !== 'visible') next.scrollIntoView({ block: 'nearest' }); }
  }
  $('docBody').addEventListener('scroll', function () { if (!Wd.is() || raf) return; raf = requestAnimationFrame(function () { raf = 0; mark(); }); }, { passive: true });
  function close() { $('pgDoc').classList.remove('side-open'); }
  Wd.close = close;
  A['sd-toggle'] = function () { var pg = $('pgDoc'); render(); pg.classList.toggle('side-open'); };
  A['sd-top'] = function () { $('docBody').scrollTo({ top: 0, behavior: 'smooth' }); if (Wd.mode === 'tablet') close(); };
  A['sd-go'] = function (el) { Read.heads = cur; A['o-go'](el); if (Wd.mode === 'tablet') close(); };
  $('sideScrim').addEventListener('click', close);

  // ---- zoom box (the pages and the page sheet; the flowing text has its own size in the reading menu) ---------------------------
  var box = $('zoomBox');
  box.innerHTML = '<button type="button" data-act="z-out" aria-label="' + esc(t('w.zout')) + '">' + Ui.ic('minus', 18, 2.2) + '</button><span id="zoomV"></span><button type="button" data-act="z-in" aria-label="' + esc(t('w.zin')) + '">' + Ui.ic('plus', 18, 2.2) + '</button><i></i><button type="button" class="fit" data-act="z-fit">' + esc(t('w.fit')) + '</button>';
  function zoomed() { return onPages() || Doc.paper().classList.contains('pgedit'); }
  function label() { var on = Wd.is() && !!Doc.blocks && zoomed(); box.classList.toggle('on', on); if (on) $('zoomV').textContent = Math.round((Read.pz || 1) * 100) + '%'; }
  function zoomTo(z) { z = Math.max(0.2, Math.min(3, z)); Read.pz = z; (onPages() ? $('pages') : Doc.paper()).style.zoom = z; label(); }
  A['z-in'] = function () { zoomTo((Read.pz || 1) * 1.1); }; A['z-out'] = function () { zoomTo((Read.pz || 1) / 1.1); };
  A['z-fit'] = function () { Read.pz = 0; Read.apply(); label(); };
  $('docBody').addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { clearTimeout(tz); tz = setTimeout(label, 80); } }, { passive: true });
  $('docBody').addEventListener('touchend', function () { setTimeout(label, 80); }, { passive: true });

  // the bars and the page redraw themselves: keep the Contents and the zoom in step with them
  var chrome0 = Doc.chrome, apply0 = Read.apply, tq = 0;
  Doc.chrome = function () { chrome0.apply(this, arguments); clearTimeout(tq); tq = setTimeout(function () { render(); label(); }, 250); };
  Read.apply = function () { apply0.apply(this, arguments); label(); sig = ''; clearTimeout(tq); tq = setTimeout(render, 250); };
  var lastW = window.innerWidth;
  Wd.on(function (changed) {
    var wpx = window.innerWidth, same = wpx === lastW; lastW = wpx;
    if (!changed && same) return;   // the keyboard of a phone only changes the height of the window: the zoom, the place in the page and the selection stay (a new width, a turned phone, still refits the page)
    close(); sig = '';
    if (App.state.page === 'home') App.renderHome(); else if (Doc.rec) { Read.pz = 0; Read.apply(); Doc.chrome(); }
  });
})();
