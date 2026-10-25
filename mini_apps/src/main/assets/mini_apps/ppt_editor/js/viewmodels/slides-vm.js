// Slides — the strip of small slides under the stage, and the page with every slide where you hold one and drag it to a new place, copy, hide or delete.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, io = null, seen = {};
  var Film = window.Film = {}, Slides = window.Slides = { isOpen: false, sel: [], multi: false };

  // a slide drawn small: the tree built for the stage, scaled
  function thumb(btn, wcss) {
    var i = +btn.dataset.i, g = Deck.gen, cv = btn.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), h = Math.round(wcss * Deck.ratio());
    if (cv.dataset.g === String(g)) return; cv.dataset.g = String(g);
    Deck.tree(i).then(function (tree) {
      if (g !== Deck.gen) return; var w = Math.round(wcss * dpr), hh = Math.round(h * dpr); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      var c = cv.getContext('2d'); c.setTransform(w / tree.widthPx, 0, 0, w / tree.widthPx, 0, 0); SlideDraw.draw(c, tree); btn.classList.add('rdy');
    }).catch(function () { cv.dataset.g = ''; });
  }
  Film.build = function () {
    var info = Deck.info, el = $('film'); if (io) io.disconnect(); seen = {};
    el.innerHTML = EditView.film(info.slides.length, Deck.cur, info.slides.map(function (s) { return s.hidden; }));
    io = new IntersectionObserver(function (es) { es.forEach(function (e) { var b = e.target; if (e.isIntersecting) { seen[b.dataset.i] = b; thumb(b, 96); } else delete seen[b.dataset.i]; }); }, { root: el, rootMargin: '160px' });
    Array.prototype.forEach.call(el.querySelectorAll('.th[data-i]'), function (b) { var c = b.querySelector('canvas'); c.style.aspectRatio = '1 / ' + Deck.ratio(); io.observe(b); });
  };
  // the current slide is marked and kept in view; the small slides in view are drawn again after a change
  Film.update = function () {
    var el = $('film'), cur = null;
    Array.prototype.forEach.call(el.querySelectorAll('.th[data-i]'), function (b) { var on = +b.dataset.i === Deck.cur; b.classList.toggle('on', on); if (on) cur = b; });
    if (cur) { var l = cur.offsetLeft - (el.clientWidth - cur.offsetWidth) / 2; el.scrollTo({ left: Math.max(0, l), behavior: 'smooth' }); }
    Object.keys(seen).forEach(function (k) { thumb(seen[k], 96); });
    if (Slides.isOpen) Slides.paint();
  };
  Slides.go = function (i) {
    if (i === Deck.cur || i < 0 || i >= Deck.count()) return; var dir = i > Deck.cur ? 1 : -1;
    Deck.cur = i; Stage.resetZoom(); Stage.select(null); $('slideBox').animate([{ transform: 'translateX(' + dir * 28 + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }); Stage.show();
  };

  // ---- every slide ---------------------------------------------------------------------------------------------------------------
  Slides.open = function () {
    Slides.isOpen = true; Slides.sel = [Deck.cur]; Slides.multi = false; var el = $('ovPanel'); el.classList.remove('hidden'); Slides.paint(true); requestAnimationFrame(function () { el.classList.add('on'); });
  };
  Slides.close = function () {
    if (!Slides.isOpen) return false; Slides.isOpen = false; var el = $('ovPanel'); el.classList.remove('on'); setTimeout(function () { if (!Slides.isOpen) el.classList.add('hidden'); }, 240); return true;
  };
  Slides.paint = function (full) {
    var el = $('ovPanel'), grid = $('ovGrid'), top = grid ? grid.scrollTop : 0;
    if (full || !grid) el.innerHTML = SlidesView.panel(Deck.info.slides, Slides.sel, Slides.multi);
    else { grid.innerHTML = SlidesView.cards(Deck.info.slides, Slides.sel); $('ovCount').textContent = t('sl.count', { n: Deck.count() }); }
    var g2 = $('ovGrid'); g2.scrollTop = top; Array.prototype.forEach.call(g2.querySelectorAll('.oc'), function (c) { c.querySelector('canvas').style.aspectRatio = '1 / ' + Deck.ratio(); thumb(c, Math.round((g2.clientWidth - 44) / 2)); });
  };
  A['m-slides'] = function () { Slides.open(); };
  A['o-close'] = function () { Slides.close(); };
  A['o-multi'] = function () { Slides.multi = !Slides.multi; Slides.paint(true); };
  A['o-pick'] = function (b) {
    if (justDragged) return; var i = +b.dataset.i, k = Slides.sel.indexOf(i);
    if (!Slides.multi) { if (k >= 0 && Slides.sel.length === 1) { Slides.close(); Slides.go(i); if (i === Deck.cur) Stage.show(); return; } Slides.sel = [i]; }
    else if (k >= 0) Slides.sel.splice(k, 1); else Slides.sel.push(i);
    Slides.paint();
  };
  function picked() { return Slides.sel.slice().sort(function (a, b) { return a - b; }); }
  A['o-new'] = function () { Slides.close(); Layout.open('add'); };
  A['o-dup'] = async function () { var ps = picked(); if (!ps.length) return; var ops = []; ps.slice().reverse().forEach(function (i) { ops.push(Deck.op('duplicateSlide', null, {}, i)); }); if (await Viewer.run(ops, 'busy.slides', { rebuild: true })) { Slides.sel = [ps[ps.length - 1] + ps.length]; Slides.paint(); } };
  A['o-hide'] = async function () { var ps = picked(), allHid = ps.every(function (i) { return Deck.info.slides[i].hidden; }); if (ps.length && await Viewer.run(ps.map(function (i) { return Deck.op('setHidden', null, { hidden: !allHid }, i); }), 'busy.slides', { rebuild: true })) Slides.paint(true); };
  A['o-del'] = function () {
    var ps = picked(); if (!ps.length) return Ui.toast(t('sl.none')); if (ps.length >= Deck.count()) return Ui.toast(t('sl.keep'));
    Ui.dialog(t('sl.del.t', { n: ps.length }), t('sl.del.s'), t('a.delete'), async function () { if (await Viewer.run(ps.slice().reverse().map(function (i) { return Deck.op('deleteSlide', null, {}, i); }), 'busy.slides', { rebuild: true })) { Slides.sel = [Math.min(ps[0], Deck.count() - 1)]; Slides.paint(true); } }, true);
  };

  // hold a card, then drag it over another one: the slide takes that place
  var drag = null, justDragged = false;
  function cardAt(x, y) { var e = document.elementFromPoint(x, y); return e && e.closest && e.closest('.oc'); }
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('#ovGrid .oc'); if (!c || Slides.multi) return;
    var d = { c: c, i: +c.dataset.i, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, to: -1 };
    d.timer = setTimeout(function () { d.on = true; c.classList.add('lift'); if (navigator.vibrate) navigator.vibrate(8); }, 380); drag = d;
  });
  document.addEventListener('pointermove', function (e) {
    var d = drag; if (!d || e.pointerId !== d.id) return;
    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) { clearTimeout(d.timer); drag = null; } return; }
    e.preventDefault(); d.c.style.transform = 'translate(' + (e.clientX - d.x) + 'px,' + (e.clientY - d.y) + 'px) rotate(-2deg) scale(1.04)';
    var o = cardAt(e.clientX, e.clientY); Array.prototype.forEach.call(document.querySelectorAll('#ovGrid .oc.into'), function (x) { x.classList.remove('into'); });
    d.to = o && o !== d.c ? +o.dataset.i : -1; if (o && o !== d.c) o.classList.add('into');
  }, { passive: false });
  function release(e) {
    var d = drag; if (!d || e.pointerId !== d.id) return; clearTimeout(d.timer); drag = null; if (!d.on) return;
    d.c.classList.remove('lift'); d.c.style.transform = ''; Array.prototype.forEach.call(document.querySelectorAll('#ovGrid .oc.into'), function (x) { x.classList.remove('into'); });
    if (e.type === 'pointerup' && d.to >= 0 && d.to !== d.i) { Slides.sel = [d.to]; Viewer.run([Deck.op('moveSlide', null, { to: d.to }, d.i)], 'busy.slides', { rebuild: true }).then(function () { Slides.paint(); }); }
    justDragged = true; setTimeout(function () { justDragged = false; }, 120);
  }
  document.addEventListener('pointerup', release); document.addEventListener('pointercancel', release);
})();
