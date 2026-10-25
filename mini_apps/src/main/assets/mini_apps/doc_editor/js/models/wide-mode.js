// Wide — which size of screen this is: phone, tablet (700+), laptop (1000+) or desktop (1280+). Set as html[data-w] so the style sheet can follow it; the small set of things CSS cannot do (tile counts, the Contents list) listen with Wide.on.
(function () {
  'use strict';
  var Wide = window.Wide = { mode: 'phone', subs: [] }, tm = 0;
  function calc() { var w = window.innerWidth; return w >= 1280 ? 'desktop' : w >= 1000 ? 'laptop' : w >= 700 ? 'tablet' : 'phone'; }
  function apply() { var m = calc(), changed = m !== Wide.mode; Wide.mode = m; document.documentElement.dataset.w = m; return changed; }
  Wide.on = function (f) { Wide.subs.push(f); };
  Wide.is = function () { return Wide.mode !== 'phone'; };
  apply();
  window.addEventListener('resize', function () {
    clearTimeout(tm);
    tm = setTimeout(function () { var changed = apply(); Wide.subs.forEach(function (f) { f(changed); }); }, 120);
  });
})();
