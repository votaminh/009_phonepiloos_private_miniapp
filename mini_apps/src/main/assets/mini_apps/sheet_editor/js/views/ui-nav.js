// UiNav — every move of an item between two looks is a morph of ONE thing, drawn by the browser (View Transitions): the same item changes place and size instead of one picture fading into another.
//   open  : a list item  ->  its page          back : the page  ->  its item (still at its old place; a list sorted by recency lets it hop to the top afterwards, see flip)
//   swap  : the same items in another look (list <-> grid, sorted, filtered)
// No fallback is drawn by hand: without View Transitions (or with reduced motion) the change just happens, and pages slide (Ui.pageIn). The look is nav.css.
// Rules for a caller: items carry data-id; call before the change, never after; changes are made inside the callback you pass.
(function () {
  'use strict';
  var OUTER = '[data-id]:not([data-id] [data-id])',   // an item, not the buttons inside it that carry the same data-id
      root = document.documentElement, vt = !!document.startViewTransition, calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  // NOT requestAnimationFrame: while the browser waits for the new state it paints nothing, so such a callback would never come
  function tick() { return new Promise(function (r) { setTimeout(r, 30); }); }
  function names(host, on) { Array.prototype.forEach.call(host.querySelectorAll(OUTER), function (e) { e.style.viewTransitionName = on ? 'i-' + e.dataset.id : ''; }); }
  function finish(t, cls, undo) { t.finished.then(function () {}, function () {}).then(function () { Ui.vtOn = false; root.classList.remove(cls); if (undo) undo(); }); }
  var N = window.UiNav = {
    ok: function () { return vt && !(calm && calm.matches); },
    // opening: item = the tapped item, page = the page element that will show, work() navigates (Router.navigate) and fills the page
    open: function (item, page, work) {
      if (!N.ok()) return work();
      item.style.viewTransitionName = 'doc'; root.classList.add('vt-open');
      var t = document.startViewTransition(function () { item.style.viewTransitionName = ''; Ui.vtOn = true; work(); page.style.viewTransitionName = 'doc'; return tick(); });
      finish(t, 'vt-open', function () { page.style.viewTransitionName = ''; item.style.viewTransitionName = ''; });
    },
    // going back: page = the page now showing, list = the page of the list, id = data-id of the item the page came from, go() does the navigation, after() runs when the morph has finished
    back: function (page, list, id, go, after) {
      if (!N.ok()) return go();
      page.style.viewTransitionName = 'doc'; root.classList.add('vt-back'); var from = Router.getCurrent();
      var t = document.startViewTransition(function () {
        page.style.viewTransitionName = ''; Ui.vtOn = true; go();
        if (Router.getCurrent() === from) { t.skipTransition(); return; }   // a dialog asked first: nothing moved
        return tick().then(function () { var c = list.querySelector('[data-id="' + id + '"]'); if (c) c.style.viewTransitionName = 'doc'; });
      });
      finish(t, 'vt-back', function () { page.style.viewTransitionName = ''; names(list, false); if (after && Router.getCurrent() !== from) after(); });
    },
    // the device's Back button runs through Router.back: make it the same morph. cfg = { page: slot name of the page, el: () => page element, list: () => list page element, id: () => data-id to return to, after: fn }
    hookBack: function (cfg) {
      var back0 = Router.back; Router.back = function () {
        var args = arguments, self = this; if (!N.ok() || Router.getCurrent() !== cfg.page) return back0.apply(self, args);
        N.back(cfg.el(), cfg.list(), cfg.id(), function () { back0.apply(self, args); }, cfg.after);
      };
    },
    // the same items in another arrangement: change() redraws host (list <-> grid, sort, filter); every item with data-id moves from its old place to its new one
    swap: function (host, change) {
      if (!N.ok()) return change();
      names(host, true); root.classList.add('vt-swap');
      var t = document.startViewTransition(function () { change(); names(host, true); return tick(); });
      finish(t, 'vt-swap', function () { names(host, false); });
    },
    // items that change place with no morph running (the closed document hops to the top): First, Last, Invert, Play. lift = data-id of the item that rises.
    flip: function (host, change, lift) {
      function spots() { var m = {}; Array.prototype.forEach.call(host.querySelectorAll(OUTER), function (c) { var r = c.getBoundingClientRect(); m[c.dataset.id] = { x: r.left, y: r.top }; }); return m; }
      var a = spots(); change(); if (calm && calm.matches) return; var b = spots();
      Array.prototype.forEach.call(host.querySelectorAll(OUTER), function (c) {
        var p = a[c.dataset.id], q = b[c.dataset.id]; if (!p || !q) return; var dx = p.x - q.x, dy = p.y - q.y, up = c.dataset.id === lift; if (!dx && !dy && !up) return;
        if (up) c.style.zIndex = '2';
        c.animate([{ translate: dx + 'px ' + dy + 'px', scale: '1' }, { translate: dx / 2 + 'px ' + dy / 2 + 'px', scale: up ? '1.04' : '1', offset: .5 }, { translate: '0 0', scale: '1' }], { duration: 480, easing: 'cubic-bezier(.2,0,0,1)' }).onfinish = function () { c.style.zIndex = ''; };
      });
    }
  };
})();
