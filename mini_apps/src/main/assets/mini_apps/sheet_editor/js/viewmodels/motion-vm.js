// Motion — the small movements of the grid: the selection frame gliding from cell to cell, the quick bar, header highlights, the flash on cells whose text changed,
// sliding pills under tabs and cross-fades. Only the one frame element, the pills and the quick bar move; rows redrawn by the list never replay anything.
(function () {
  'use strict';
  var $ = Ui.$, HW = 40, RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), fr = {}, qk = null;
  var M = window.Motion = { drag: false, rm: RM };
  var OUT = 'cubic-bezier(.2,.8,.2,1)', SPRING = 'cubic-bezier(.34,1.45,.5,1)', BOUNCE = 'cubic-bezier(.34,1.56,.64,1)';
  M.anim = function (el, kf, o) { return RM || !el || !el.animate ? null : el.animate(kf, Object.assign({ easing: OUT }, o)); };
  M.fade = function (el, from) { M.anim(el, [{ opacity: from || 0.2 }, { opacity: 1 }], { duration: 150 }); };
  // the grid of another sheet slides in from the side the tab pill travels toward (dir 1: from the right), with a soft settle
  M.slide = function (el, dir) { M.anim(el, [{ opacity: 0.25, transform: 'translateX(' + dir * 56 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.34,1.2,.5,1)' }); };
  M.reset = function () { Object.keys(fr).forEach(function (k) { fr[k].dataset.on = ''; }); };

  // ---- selection frame -----------------------------------------------------------------------------------------------------------
  function make() { var d = document.createElement('div'); d.className = 'gsel'; d.innerHTML = '<i class="tl" data-h="tl"></i><i class="br" data-h="br"></i>'; return d; }
  // rect: where the frame goes inside box; o: { show, one, tl, br, pop }. One element per box; it moves, it is never rebuilt.
  M.frame = function (key, box, rect, o) {
    var f = fr[key] || (fr[key] = make()); if (f.parentNode !== box) box.appendChild(f);
    if (!o.show) { f.style.opacity = '0'; f.dataset.on = ''; return; }
    var was = f.dataset.on === '1', dist = was ? Math.abs(rect.x - f._x) + Math.abs(rect.y - f._y) : 0;
    f.classList.toggle('one', !!o.one); f.classList.toggle('h-tl', !!o.tl); f.classList.toggle('h-br', !!o.br);
    function put() { f.style.transform = 'translate(' + rect.x + 'px,' + rect.y + 'px)'; f.style.width = rect.w + 'px'; f.style.height = rect.h + 'px'; }
    if (!was || M.drag || RM) { f.style.transition = 'none'; put(); f.style.opacity = '1'; void f.offsetWidth; f.style.transition = ''; }
    else if (dist > 420) { f.style.transition = 'none'; f.style.opacity = '0'; put(); void f.offsetWidth; f.style.transition = ''; f.style.opacity = '1'; }
    else { f.style.opacity = '1'; put(); }
    f._x = rect.x; f._y = rect.y; f.dataset.on = '1';
  };

  // the tapped cell's CONTENT hops: up 3 px and 8% larger, then settles. The cell box, its borders and the green frame do not move; the text stays inside the cell.
  M.bounce = function (cell) {
    if (RM || !cell || !cell.firstChild) return;
    var sp = document.createElement('span'); sp.style.cssText = 'display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;will-change:transform';
    while (cell.firstChild) sp.appendChild(cell.firstChild);
    cell.appendChild(sp);
    function done() { while (sp.firstChild) cell.insertBefore(sp.firstChild, sp); if (sp.parentNode === cell) cell.removeChild(sp); }
    var a = M.anim(sp, [{ transform: 'none' }, { transform: 'translateY(-3px) scale(1.08)', offset: 0.4 }, { transform: 'none' }], { duration: 280, easing: BOUNCE });
    if (a) a.onfinish = a.oncancel = done; else done();
  };

  // ---- quick bar: one element, shown and hidden, never recreated -------------------------------------------------------------------
  M.quick = function (host, o) {
    var d = qk || (qk = document.createElement('div')); d.className = 'gquick' + (d.classList.contains('on') ? ' on' : '');
    if (d.parentNode !== host) host.appendChild(d);
    if (!o) { d.classList.remove('on'); return; }
    var was = d.classList.contains('on'), sc = $('gScroll');
    if (!was) { d.innerHTML = o.html; d.setAttribute('role', 'toolbar'); d.setAttribute('aria-label', o.label); }
    var lo = sc.scrollLeft + HW + 4, hi = sc.scrollLeft + sc.clientWidth - d.offsetWidth - 6;
    d.style.left = Math.max(lo, Math.min(o.x, hi)) + 'px'; d.style.top = o.y + 'px';
    if (!was) { void d.offsetWidth; d.classList.add('on'); }
  };

  // ---- header highlight: toggle the class on the cells that exist, so the colour can fade ----------------------------------------
  M.heads = function (s) {
    Array.prototype.forEach.call(document.querySelectorAll('#gColIn .gh[data-c]'), function (h) { var on = +h.dataset.c >= s.c1 && +h.dataset.c <= s.c2; if (h.classList.contains('on') !== on) h.classList.toggle('on', on); });
    Array.prototype.forEach.call(document.querySelectorAll('#gHost .gr-h,#gFzIn .gr-h'), function (h) { var on = +h.dataset.r >= s.r1 && +h.dataset.r <= s.r2; if (h.classList.contains('on') !== on) h.classList.toggle('on', on); });
  };

  // ---- flash: cells whose shown text changed (an edit, a formula that moved, undo, sort) get a soft green wash that fades -----------
  function cells() { return document.querySelectorAll('#gHost .gc[data-c],#gFzIn .gc[data-c]'); }
  M.snap = function () { var o = {}; Array.prototype.forEach.call(cells(), function (c) { o[c.parentNode.dataset.r + ':' + c.dataset.c] = c.textContent; }); return o; };
  M.flash = function (before) {
    if (RM || !before) return;
    Array.prototype.forEach.call(cells(), function (c) {
      var k = c.parentNode.dataset.r + ':' + c.dataset.c;
      if (k in before && before[k] !== c.textContent) { c.classList.add('flash'); c.addEventListener('animationend', function () { c.classList.remove('flash'); }, { once: true }); }
    });
  };

  // ---- pill sliding under the active tab (a soft spring, a few percent of overshoot) ---------------------------------------------
  M.pill = function (wrap, sel, animate) {
    var pill = wrap.querySelector('.pl'), act = wrap.querySelector(sel);
    if (!pill) { pill = document.createElement('i'); pill.className = 'pl'; pill.setAttribute('aria-hidden', 'true'); wrap.insertBefore(pill, wrap.firstChild); }
    if (!act) { pill.style.opacity = '0'; return; }
    var x = act.offsetLeft, w = act.offsetWidth, px = pill._x, pw = pill._w;
    pill.style.opacity = '1'; pill.style.width = w + 'px'; pill.style.transform = 'translateX(' + x + 'px)';
    if (animate && px !== undefined && (px !== x || pw !== w)) M.anim(pill, [{ transform: 'translateX(' + px + 'px)', width: pw + 'px' }, { transform: 'translateX(' + x + 'px)', width: w + 'px' }], { duration: 350, easing: SPRING });
    pill._x = x; pill._w = w;
    if (animate && wrap.scrollWidth > wrap.clientWidth) wrap.scrollTo({ left: Math.max(0, x - (wrap.clientWidth - w) / 2), behavior: RM ? 'auto' : 'smooth' });
  };
})();
