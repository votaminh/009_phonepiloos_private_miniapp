// TabColor — the colour of a sheet's tab: chosen from the sheet's menu (or the right-click menu of the tab), drawn as a bar under the tab name, written into the file at Save.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, A = App.acts, S = window.SheetsView, which = 0;
  var NAMES = ['sw_red', 'sw_orange', 'fl_yellow', 'sw_green', 'sw_blue', 'sw_purple', 'sw_gray', 'sw_black'];
  function view(sh) {
    return '<h2 class="sh-h">' + esc(sh.name) + '</h2><div class="sx-sws">' + NAMES.map(function (n) { var c = C(n); return '<button type="button" class="sx-sw' + (sh.tab && sh.tab.toUpperCase() === c.toUpperCase() ? ' on' : '') + '" data-act="tc-pick" data-v="' + c + '" style="background:' + c + '" aria-label="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>'
      + '<button type="button" class="btn ol" data-act="tc-pick" data-v="">' + esc(t('tc.none')) + '</button>';
  }
  A['sh-tabc'] = function (el) { which = +el.dataset.i; Ui.sheet('tabc', view(Wb.sheets[which])); };
  A['tc-pick'] = function (el) { var sh = Wb.sheets[which]; if (!sh || Wb.readOnly) return; sh.tab = el.dataset.v || null; sh.tabDirty = true; Ui.closeSheet(); Book.touch(); Book.chrome(); };
  document.addEventListener('contextmenu', function (e) {
    var b = e.target.closest && e.target.closest('.bk-tab[data-i]'); if (!b || Wb.readOnly) return; e.preventDefault(); var i = +b.dataset.i;
    Ui.sheet('shmenu', S.sheetMenu(Wb.sheets[i], i, i === Wb.sheets.length - 1));
  });
})();
