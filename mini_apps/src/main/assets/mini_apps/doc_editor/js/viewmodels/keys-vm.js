// Keys — the keyboard shortcuts of Word that the editor adds on top of the basic ones (those are in surface-vm.js), and the sheet that lists them all (F1 or Ctrl+/).
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, A = App.acts, K = /Mac/i.test(navigator.platform) ? 'Cmd+' : 'Ctrl+';
  var LIST = [
    ['ky.fmt', [['ky.bold', 'B / I / U'], ['ky.font', 'D'], ['ky.size', 'Shift+> / Shift+<'], ['ky.script', '= / Shift+='], ['ky.clear', 'Space'], ['ky.link', 'K']]],
    ['ky.para', [['ky.align', 'L / E / R / J'], ['ky.bul', 'Shift+L'], ['ky.ind', 'M / Shift+M'], ['ky.lnsp', '1 / 2 / 5'], ['ky.head', 'Alt+1 / 2 / 3 / 0'], ['ky.tab', 'Tab']]],
    ['ky.doc', [['ky.save', 'S'], ['ky.undo', 'Z / Y'], ['ky.find', 'F / H'], ['ky.pagebrk', 'Enter'], ['ky.comment', 'Alt+M'], ['ky.foot', 'Alt+F'], ['ky.track', 'Shift+E'], ['ky.print', 'P']]]
  ];
  A['ky-help'] = function () {
    Ui.sheet('keys', '<h2 class="sh-h">' + esc(t('ky.title')) + '</h2><div class="rv-list">' + LIST.map(function (g) {
      return '<div class="rv-c"><div class="rv-h"><b>' + esc(t(g[0])) + '</b></div>' + g[1].map(function (r) { return '<p class="ky-r"><span>' + esc(t(r[0])) + '</span><kbd>' + esc(r[1].replace(/^([A-Z=\\d])/, K + '$1').replace(/^(Shift|Alt)/, K + '$1')) + '</kbd></p>'; }).join('') + '</div>';
    }).join('') + '</div><div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>');
  };
  function line(v) { return function () { Para.set({ ln: v }); }; }
  Doc.paper().addEventListener('keydown', function (e) {
    if (Doc.mode !== 'edit') return; var c = e.ctrlKey || e.metaKey, k = e.key;
    if (!c || e.defaultPrevented) return;
    var go = null;
    if (e.altKey && !e.shiftKey) { var kk = k.toLowerCase(); if (kk === 'm' || e.code === 'KeyM') go = A['rv-new']; else if (kk === 'f' || e.code === 'KeyF') go = A['rf-fn']; }
    else if (!e.altKey && !e.shiftKey) {
      if (k === '=') go = A['e-sub']; else if (k === 'd' || k === 'D') go = A['e-font']; else if (k === ' ') go = A['e-clear'];
      else if (k === 'm') go = function () { A['pa-in']({ dataset: { v: 1 } }); }; else if (k === '1') go = line(1); else if (k === '2') go = line(2); else if (k === '5') go = line(1.5);
      else if (k === 'p') go = A['m-pdf'];
    } else if (e.shiftKey && !e.altKey) {
      if (k === '+' || k === '=') go = A['e-sup']; else if (k === 'M' || k === 'm') go = function () { A['pa-in']({ dataset: { v: -1 } }); }; else if (k === 'E' || k === 'e') go = A['rv-track'];
    }
    if (go) { e.preventDefault(); var el = document.createElement('div'), r = Edit.block() ? Edit.block().getBoundingClientRect() : { left: 0, bottom: 0 }; el.getBoundingClientRect = function () { return { left: r.left + 20, bottom: r.bottom }; }; go(el); }
  });
  document.addEventListener('keydown', function (e) {
    if (App.state.page !== 'doc' || !Doc.rec) return;
    if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === '/')) { e.preventDefault(); A['ky-help'](); }
  });
})();
