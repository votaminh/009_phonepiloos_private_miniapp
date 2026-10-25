// Zoom and pan with the mouse — Ctrl / Cmd + wheel (a trackpad pinch comes as the same wheel) zooms the grid about the point under the pointer; hold Space and drag to move the sheet (grid or print pages) like a hand. Nothing here runs while typing.
(function () {
  'use strict';
  var $ = Ui.$, G = window.Grid, MIN = 0.4, MAX = 3, want = 0, anchor = null, raf = 0, space = false, drag = null;
  function box() { return $('gWrap'); }
  window.Zoom = { hand: function () { return space; } };
  function print() { return Book.rec && Store.prefs().page && $('pgBook').classList.contains('xp-on'); }

  function apply() {
    raf = 0; var sc = $('gScroll'), z = G.z, nz = want; want = 0; if (!anchor || !nz || nz === z || !G.geo) return;
    var ax = (sc.scrollLeft + anchor.x) / z, ay = (sc.scrollTop + anchor.y) / z;
    G.z = nz; G.mount(); sc.scrollLeft = ax * nz - anchor.x; sc.scrollTop = ay * nz - anchor.y;
  }
  G.setZoom = function (z) { want = Math.max(MIN, Math.min(MAX, z)); var r = $('gScroll').getBoundingClientRect(); anchor = { x: r.width / 2, y: r.height / 2 }; if (!raf) raf = setTimeout(apply, 16); };
  box().addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !G.geo || print()) return; e.preventDefault();
    var f = Math.exp(-Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode ? 5 : 1))) * 0.0035), r = $('gScroll').getBoundingClientRect();
    want = Math.max(MIN, Math.min(MAX, (want || G.z) * f)); anchor = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!raf) raf = setTimeout(apply, 16);
  }, { passive: false });

  // ---- the hand: Space + drag --------------------------------------------------------------------------------------------------
  function typing(el) { return !!el && !!el.closest && !!el.closest('input,textarea,select,button,[contenteditable="true"]'); }
  function scroller() { return print() ? $('xpages') : $('gScroll'); }
  function stop() { space = false; drag = null; [$('gScroll'), $('xpages')].forEach(function (s) { s.classList.remove('pan', 'panning'); }); }
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || App.state.page !== 'book' || typing(e.target) || G.editing) return; e.preventDefault();
    if (!space) { space = true; scroller().classList.add('pan'); }
  });
  document.addEventListener('keyup', function (e) { if (e.code === 'Space') stop(); }); window.addEventListener('blur', stop);
  function down(e) {
    if (!space || e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    var s = e.currentTarget; drag = { x: e.clientX, y: e.clientY, l: s.scrollLeft, t: s.scrollTop, id: e.pointerId, s: s }; s.classList.add('panning'); try { s.setPointerCapture(e.pointerId); } catch (x) { /* gone */ }
  }
  [$('gScroll'), $('xpages')].forEach(function (s) {
    s.addEventListener('pointerdown', down, true);
    s.addEventListener('mousedown', function (e) { if (space) { e.preventDefault(); e.stopPropagation(); } }, true);
    s.addEventListener('click', function (e) { if (space) { e.preventDefault(); e.stopPropagation(); } }, true);
    s.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) { drag.s.scrollLeft = drag.l - (e.clientX - drag.x); drag.s.scrollTop = drag.t - (e.clientY - drag.y); } });
    s.addEventListener('pointerup', function () { if (drag) drag.s.classList.remove('panning'); drag = null; });
  });
})();
