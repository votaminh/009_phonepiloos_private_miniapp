// All — every feature of the computer's menu bar on a touch screen, in the touch layout: a bottom sheet with the menu names as chips (File, Edit, View, Insert, Page) and the items of the chosen menu as large rows.
// An item with more under it opens that list in place with a Back row. The items are the very ones the menu bar shows (Menus.items), so a feature added there shows up here too. Opened from the \u22ef menu.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, W = window.AllFeatures = {}, cur = 'insert', stack = [], list = [];
  function row(it, i) {
    if (it === '-') return '<i class="al-sep"></i>';
    return '<button type="button" class="opt al-row' + (it.off ? ' off' : '') + '" data-act="all-go" data-i="' + i + '"' + (it.off ? ' aria-disabled="true"' : '') + '><span class="op-t"><b>' + esc(it.t) + '</b></span>'
      + (it.on ? ic('check', 20, 2.4) : it.sub ? ic('right', 18, 2.2) : '') + '</button>';
  }
  function draw() {
    var top = stack.length ? stack[stack.length - 1] : null; list = top ? top.items : Menus.items(cur);
    var head = top ? '<button type="button" class="opt al-row al-back" data-act="all-back">' + ic('back', 20, 2.2) + '<span class="op-t"><b>' + esc(top.title) + '</b></span></button>'
      : '<div class="sx-chips al-chips">' + Menus.names.map(function (n) { return '<button type="button" class="sx-chip' + (n === cur ? ' on' : '') + '" data-act="all-menu" data-k="' + n + '">' + esc(t('mu.' + n)) + '</button>'; }).join('') + '</div>';
    Ui.sheet('all', '<h2 class="sh-h">' + esc(t('all.title')) + '</h2>' + head + '<div class="al-list">' + list.map(row).join('') + '</div>');
  }
  W.open = function () { if (!Doc.sizes.length) return; stack = []; Ui.closeSheet(); setTimeout(draw, 80); };
  A['all-open'] = W.open;
  A['all-menu'] = function (el) { cur = el.dataset.k; stack = []; draw(); };
  A['all-back'] = function () { stack.pop(); draw(); };
  A['all-go'] = function (el) {
    var it = list[+el.dataset.i]; if (!it || it === '-' || it.off) return;
    if (it.sub) { stack.push({ title: it.t, items: typeof it.sub === 'function' ? it.sub() : it.sub }); return draw(); }
    Ui.closeSheet(); setTimeout(function () { if (it.go) it.go(); }, 220);
  };
})();
