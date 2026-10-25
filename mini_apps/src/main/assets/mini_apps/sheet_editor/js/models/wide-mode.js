// Wide — which kind of screen this is (RULES 1.12): by the width of the window and by the pointer, never by the aspect ratio. A mouse or trackpad and 1000px+ makes a laptop (1280px+ a desktop); a touch screen is a tablet when its short side is 600px or more, else a phone. Set as html[data-w] so the style sheet can follow it; the small set of things CSS cannot do (tile counts, the Contents list) listen with Wide.on.
(function () {
  'use strict';
  var Wide = window.Wide = { mode: 'phone', subs: [] }, tm = 0;
  function fine() { return !!window.matchMedia && matchMedia('(pointer:fine)').matches && matchMedia('(hover:hover)').matches; }
  function calc() {
    var w = window.innerWidth, h = window.innerHeight;
    if (fine()) return w >= 1280 ? 'desktop' : w >= 1000 ? 'laptop' : w >= 600 ? 'tablet' : 'phone';
    return Math.min(w, h) >= 600 ? 'tablet' : 'phone';   // touch: the short side, so turning a phone on its side does not make it a tablet
  }
  function apply() { var m = calc(), changed = m !== Wide.mode; Wide.mode = m; document.documentElement.dataset.w = m; return changed; }
  Wide.on = function (f) { Wide.subs.push(f); };
  Wide.is = function () { return Wide.mode !== 'phone'; };
  apply();
  window.addEventListener('resize', function () {
    clearTimeout(tm);
    tm = setTimeout(function () { var changed = apply(); Wide.subs.forEach(function (f) { f(changed); }); }, 120);
  });
})();
