// UiNav — the list and a document morph into each other with the browser's own View Transitions. The tapped row and the page share one name ("doc"); the browser grows the row into the page, and back again.
// Going back, the row returns to the place it came from; when that has finished the row hops up to the top of the list (App.settleOrder).
// The look (shape, fades, timing) is the CSS at the end of style-doc.css. Anything else that opens a page just slides in (Ui.pageIn).
(function () {
  'use strict';
  var $ = Ui.$, vt = !!document.startViewTransition, calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  // (not requestAnimationFrame: while the browser waits for the new state it paints nothing, so such a callback would never come)
  function frame() { return new Promise(function (r) { setTimeout(r, 30); }); }
  function clean(t, pg, cls, after) {
    t.finished.then(function () {}, function () {}).then(function () {
      pg.style.viewTransitionName = ''; Ui.vtOn = false; document.documentElement.classList.remove(cls);
      document.querySelectorAll('.hm-card').forEach(function (c) { c.style.viewTransitionName = ''; }); if (after) after();
    });
  }
  window.UiNav = {
    ok: function () { return vt && !(calm && calm.matches); },
    // the tapped row is named, then the page takes the name; the browser morphs one into the other
    open: function (card, work) {
      if (!UiNav.ok()) return work();
      var pg = $('pgDoc'); card.style.viewTransitionName = 'doc'; document.documentElement.classList.add('vt-open');
      var t = document.startViewTransition(function () {
        card.style.viewTransitionName = ''; Ui.vtOn = true; work(); pg.style.viewTransitionName = 'doc';
        return frame();   // the page shows what it has; the file keeps loading inside it while it grows
      });
      clean(t, pg, 'vt-open');
    },
    // back: the page is named, then the row of the same file (still at its old place in the list) takes the name
    back: function (go) {
      var pg = $('pgDoc'), id = Doc.rec && Doc.rec.key; pg.style.viewTransitionName = 'doc'; document.documentElement.classList.add('vt-back');
      var t = document.startViewTransition(function () {
        pg.style.viewTransitionName = ''; Ui.vtOn = true; go();
        if (Router.getCurrent() === 'doc') { t.skipTransition(); return; }   // a dialog asked first: nothing moved
        return frame().then(function () { var c = document.querySelector('[data-page="home"] [data-id="' + id + '"]'); if (c) c.style.viewTransitionName = 'doc'; });
      });
      clean(t, pg, 'vt-back', function () { if (Router.getCurrent() === 'home') App.settleOrder(); });
    }
  };
  var back0 = Router.back; Router.back = function () {
    var args = arguments, self = this; if (!UiNav.ok() || App.state.page !== 'doc') return back0.apply(self, args);
    UiNav.back(function () { back0.apply(self, args); });
  };
})();
