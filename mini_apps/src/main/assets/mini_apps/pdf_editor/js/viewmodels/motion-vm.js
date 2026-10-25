// Motion — the touch answers of the page. Tapping a text box lifts only its content (a copy drawn above the page); the frame never moves and always stays on top.
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var PAD = 3;
  // a copy of the page region under box b, over a white cut-out that hides the original text; multiply keeps the page's white from covering its neighbours
  function lift(pg, b) {
    var cv = pg.querySelector('.pc'), ov = pg.querySelector('.ov'); if (!cv || !cv.width || !pg.clientWidth) return null;
    var k = cv.width / pg.clientWidth, bn = document.createElement('div'), c = document.createElement('canvas');
    bn.className = 'bn'; bn.style.cssText = 'left:' + (b.l - PAD) + 'px;top:' + (b.t - PAD) + 'px;width:' + (b.w + PAD * 2) + 'px;height:' + (b.h + PAD * 2) + 'px';
    c.width = Math.max(1, Math.round((b.w + PAD * 2) * k)); c.height = Math.max(1, Math.round((b.h + PAD * 2) * k));
    try { c.getContext('2d').drawImage(cv, (b.l - PAD) * k, (b.t - PAD) * k, c.width, c.height, 0, 0, c.width, c.height); } catch (e) { return null; }
    bn.appendChild(c); ov.insertBefore(bn, ov.firstChild); return { bn: bn, cv: c };
  }
  window.Motion = {
    lift: lift,
    bounce: function (pg, b) {
      if (calm && calm.matches) return;
      var l = lift(pg, b); if (!l) return;
      var a = l.cv.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-3px) scale(1.05)', offset: .42 }, { transform: 'translateY(0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      a.onfinish = a.oncancel = function () { l.bn.remove(); };
    },
    drop: function (l) { if (l) l.bn.remove(); }
  };
})();
