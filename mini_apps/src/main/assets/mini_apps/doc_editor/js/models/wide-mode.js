// Wide — which kind of screen this is (RULES 1.12), set as html[data-w] for the style sheet.
// A mouse on a screen at least as wide as it is tall (square to landscape) is the desktop, whatever its width. The rest keep the old rule: a mouse needs 1000px+ for a laptop (1280px+ a desktop); a touch screen is a tablet when its short side is 600px or more, else a phone.
// html.pc is the computer's look (menu bar, panels, mouse and keys): a mouse on a screen at least as wide as it is tall; a touch tablet of any size keeps the touch look.
(function () {
  'use strict';
  var W = window.Wide = { mode: 'phone', pc: false, subs: [] }, tm = 0, fine = window.matchMedia && matchMedia('(pointer: fine) and (hover: hover)');
  function calc() {
    var w = window.innerWidth, h = window.innerHeight, mouse = !!(fine && fine.matches);
    if (mouse && w >= h) return 'desktop';   // square to landscape with a mouse: the computer's look, however narrow the window
    if (mouse) return w >= 1280 ? 'desktop' : w >= 1000 ? 'laptop' : w >= 600 ? 'tablet' : 'phone';
    return Math.min(w, h) >= 600 ? 'tablet' : 'phone';   // touch: the short side, so a phone turned on its side stays a phone
  }
  function apply() {
    var m = calc(), pc = (m === 'laptop' || m === 'desktop') && !!(fine && fine.matches), changed = m !== W.mode || pc !== W.pc, h = document.documentElement;
    W.mode = m; W.pc = pc; h.dataset.w = m; h.classList.toggle('pc', pc); return changed;
  }
  W.on = function (f) { W.subs.push(f); };
  W.is = function () { return W.mode !== 'phone'; };
  apply();
  window.addEventListener('resize', function () {
    clearTimeout(tm);
    tm = setTimeout(function () { var changed = apply(); W.subs.forEach(function (f) { f(changed); }); }, 120);
  });
})();
