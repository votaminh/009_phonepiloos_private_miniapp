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
  // ---- the keyboard of a computer ---------------------------------------------------------------------------------------------------------
  Doc.paper().addEventListener('keydown', function (e) {
    if (Doc.mode !== 'edit') return; var c = e.ctrlKey || e.metaKey, k = e.key, b = Edit.block();
    if (c && !e.altKey) {
      var kk = k.toLowerCase();
      if (kk === 'b') { e.preventDefault(); A['e-bold'](); return; } if (kk === 'i') { e.preventDefault(); A['e-italic'](); return; } if (kk === 'u') { e.preventDefault(); A['e-underline'](); return; }
      if (kk === 'z' && !e.shiftKey) { e.preventDefault(); A['e-undo'](); return; }
      if (kk === 'y' || (kk === 'z' && e.shiftKey)) { e.preventDefault(); A['e-redo'](); return; }
      if (kk === 's') { e.preventDefault(); A['e-save'](); return; }
      if (kk === 'k') { e.preventDefault(); A['e-link'](); return; }
      if (kk === 'e') { e.preventDefault(); A['e-al-center'](); return; } if (kk === 'l' && !e.shiftKey) { e.preventDefault(); A['e-al-left'](); return; }
      if (kk === 'r') { e.preventDefault(); A['e-al-right'](); return; } if (kk === 'j') { e.preventDefault(); A['e-al-justify'](); return; }
      if (kk === 'l' && e.shiftKey) { e.preventDefault(); A['e-bul'](); return; }
      if (k === 'Enter') { e.preventDefault(); A['i-brk'](); return; }
      if (k === ']' || (k === '>' && e.shiftKey)) { e.preventDefault(); A['e-larger'](); return; } if (k === '[' || (k === '<' && e.shiftKey)) { e.preventDefault(); A['e-smaller'](); return; }
    }
    if (c && e.altKey && /^[1-3]$/.test(k)) { e.preventDefault(); Struct.setStyle(+k); return; }
    if (c && e.altKey && k === '0') { e.preventDefault(); Struct.setStyle(0); return; }
    if (k === 'Tab' && b) { e.preventDefault(); if (b.dataset.t === 'l') A[e.shiftKey ? 'e-outdent' : 'e-indent'](); else if (!e.shiftKey) document.execCommand('insertText', false, '\t'); return; }
  });
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
