// Layout — the button that switches the reading view between flowing text (wrap) and real pages, and the move between the two. The choice is kept; the first time it follows the device (a phone wraps, a desktop shows pages).
(function () {
  'use strict';
  var $ = Ui.$, A = App.acts, calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var Layout = window.Layout = {};
  function still() { return calm && calm.matches; }
  function showing() { return $('pages').classList.contains('on'); }
  // the sheet that leaves, then the other one comes in: pages rise one after another, text settles from a slightly smaller size
  Layout.swap = function (toPage, mid) {
    var body = $('docBody'), out = toPage ? Doc.paper() : $('pages'), ratio = body.scrollTop / Math.max(1, body.scrollHeight - body.clientHeight);
    function go() {
      mid(); body.scrollTop = ratio * Math.max(0, body.scrollHeight - body.clientHeight);
      if (still()) return;
      if (toPage) PageView.pages.slice(0, 3).forEach(function (pg, i) { pg.el.animate([{ opacity: 0, transform: 'translateY(22px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 55, easing: 'cubic-bezier(.2,.9,.25,1.06)', fill: 'backwards' }); });
      else Doc.paper().animate([{ opacity: 0, transform: 'translateY(12px) scale(.965)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1.06)', fill: 'backwards' });
    }
    if (still() || !out || out.style.display === 'none' || (!toPage && !showing())) return go();
    var a = out.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 130, easing: 'ease-in', fill: 'forwards' }), end = function () { a.cancel(); go(); };
    a.finished.then(end, end);
  };
  Layout.set = function (k) {
    if (Store.prefs().layout === k) return; Store.savePrefs({ layout: k });
    var ready = !!Doc.blocks && Doc.mode === 'read';
    var done = function () { Read.pz = 0; Read.apply(); Doc.chrome(); var ic = document.querySelector('#docTop [data-act="d-layout"] svg'); if (ic && !still()) ic.animate([{ transform: 'rotate(-70deg) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' }); };
    if (ready) Layout.swap(k === 'page', done); else done();
  };
  A['d-layout'] = function () { Layout.set(Store.prefs().layout === 'page' ? 'fit' : 'page'); };
  A['r-layout'] = function (el) { Layout.set(el.dataset.k); Ui.closeSheet(); };
  // editing and searching happen on the flowing text: from the pages, go there first
  var edit0 = A['d-edit'];
  A['d-edit'] = function () { if (showing()) Layout.swap(false, function () { Read.pz = 0; Doc.setMode('edit'); Ui.toast(Ui.t('e.hint')); }); else edit0(); };
  var find0 = A['d-find'];
  A['d-find'] = A['m-find'] = function () { if (showing()) { Layout.set('fit'); setTimeout(find0, 460); } else find0(); };
  // hold Space and drag with the mouse to move the page around (not while typing)
  var space = false, drag = null, body = $('docBody');
  function typing(el) { return !!el && !!el.closest && !!el.closest('input,textarea,select,button,[contenteditable="true"]'); }
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || App.state.page !== 'doc' || typing(e.target)) return; e.preventDefault(); if (!space) { space = true; body.classList.add('pan'); }
  });
  function stop() { space = false; drag = null; body.classList.remove('pan', 'panning'); }
  document.addEventListener('keyup', function (e) { if (e.code === 'Space') stop(); }); window.addEventListener('blur', stop);
  body.addEventListener('pointerdown', function (e) {
    if (!space || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); drag = { x: e.clientX, y: e.clientY, l: body.scrollLeft, t: body.scrollTop, id: e.pointerId }; body.classList.add('panning'); try { body.setPointerCapture(e.pointerId); } catch (x) { /* gone */ }
  }, true);
  body.addEventListener('mousedown', function (e) { if (space) { e.preventDefault(); e.stopPropagation(); } }, true);
  body.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) { body.scrollLeft = drag.l - (e.clientX - drag.x); body.scrollTop = drag.t - (e.clientY - drag.y); } });
  body.addEventListener('pointerup', function () { drag = null; body.classList.remove('panning'); });
  PageView.init();
})();
