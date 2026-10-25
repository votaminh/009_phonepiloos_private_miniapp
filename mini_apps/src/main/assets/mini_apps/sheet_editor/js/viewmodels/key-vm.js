// Keys — the keyboard of a computer: arrows, Tab and Enter move the active cell, Shift extends, Ctrl / Cmd jumps to the edge of the data, typing starts a cell, Delete clears, and the usual shortcuts (copy, paste, undo, bold, find, save…).
(function () {
  'use strict';
  var $ = Ui.$, A = App.acts, G = window.Grid, K = window.Keys = {};

  function inField(el) { return !!el && !!el.closest && !!el.closest('input,textarea,select,[contenteditable="true"]'); }
  function busy() { return App.state.page !== 'book' || !G.geo || !!Ui.state.sheet || !!Ui.state.dlg || document.getElementById('ctxm') || (window.XPage && XPage.on); }
  function blank(sh, r, c) { var v = Calc.value(sh, r, c); return v === null || v === undefined || v === ''; }
  function visible(g, r, c) { return g.rowH(r) > 0 && g.colW(c) > 0; }

  // the cell Ctrl+arrow lands on: along the data, stopping at the last filled cell of a run, or the first filled one after a gap, or the edge
  function edge(r, c, dr, dc) {
    var g = G.geo, sh = g.sh, lr = g.rows - 1, lc = g.cols - 1, nr = r + dr, nc = c + dc;
    function ok(a, b) { return a >= 0 && b >= 0 && a <= lr && b <= lc; }
    if (!ok(nr, nc)) return { r: r, c: c };
    if (!blank(sh, r, c) && !blank(sh, nr, nc)) { while (ok(nr + dr, nc + dc) && !blank(sh, nr + dr, nc + dc)) { nr += dr; nc += dc; } return { r: nr, c: nc }; }
    while (ok(nr, nc) && blank(sh, nr, nc)) { nr += dr; nc += dc; }
    if (!ok(nr, nc)) return { r: Math.max(0, Math.min(lr, dr ? (dr > 0 ? lr : 0) : r)), c: Math.max(0, Math.min(lc, dc ? (dc > 0 ? lc : 0) : c)) };
    return { r: nr, c: nc };
  }
  // one step that skips hidden rows and columns
  function stepFrom(p, dr, dc) {
    var g = G.geo, r = p.r, c = p.c, n = 0;
    do { r += dr; c += dc; n++; } while (n < 2000 && r >= 0 && c >= 0 && r < g.rows && c < g.cols && !visible(g, r, c));
    return { r: Math.max(0, Math.min(g.rows - 1, r)), c: Math.max(0, Math.min(g.cols - 1, c)) };
  }
  function go(to, extend) {
    if (extend) { var a = G.anc || G.act(); G.select(a.r, a.c, to.r, to.c); } else G.select(to.r, to.c);
    G.reveal(to.r, to.c);
  }
  function move(dr, dc, e) {
    var ctrl = e.ctrlKey || e.metaKey, from = e.shiftKey ? (G.cur || G.act()) : G.act();
    go(ctrl ? edge(from.r, from.c, dr, dc) : stepFrom(from, dr, dc), e.shiftKey);
  }
  K.selectAll = function () { var sh = G.geo.sh; G.select(0, 0, Math.max(sh.rows - 1, 0), Math.max(sh.cols - 1, 0)); };

  var MAP = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  document.addEventListener('keydown', function (e) {
    if (busy() || e.defaultPrevented || inField(e.target) || e.isComposing) return;
    var k = e.key, ctrl = e.ctrlKey || e.metaKey, s = G.sel, g = G.geo, sh = g.sh, edit = !Wb.readOnly, ac = G.act();
    if (k === ' ' && !ctrl && !e.shiftKey) return;        // Space alone is the hand (zoom-vm.js)
    if (MAP[k]) { e.preventDefault(); move(MAP[k][0], MAP[k][1], e); return; }
    if (k === 'Tab') { e.preventDefault(); G.step(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'Enter') { e.preventDefault(); if (e.altKey) return; G.step(e.shiftKey ? -1 : 1, 0); return; }
    if (k === 'Home') { e.preventDefault(); go(ctrl ? { r: 0, c: 0 } : { r: ac.r, c: 0 }, e.shiftKey); return; }
    if (k === 'End') { e.preventDefault(); go(ctrl ? { r: Math.max(0, sh.rows - 1), c: Math.max(0, sh.cols - 1) } : { r: ac.r, c: Math.max(0, sh.cols - 1) }, e.shiftKey); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); var n = Math.max(1, Math.floor($('gScroll').clientHeight / Math.max(20, g.rowH(ac.r) || 40)) - 1); go({ r: Math.max(0, Math.min(g.rows - 1, ac.r + (k === 'PageDown' ? n : -n))), c: ac.c }, e.shiftKey); return; }
    if (k === 'Escape') { G.qk = false; G.place(); if (window.Clip && Clip.unmark) Clip.unmark(); return; }
    if (k === ' ' && ctrl) { e.preventDefault(); G.select(0, ac.c, g.rows - 1, ac.c, 'col'); return; }
    if (k === ' ' && e.shiftKey) { e.preventDefault(); G.select(ac.r, 0, ac.r, g.cols - 1, 'row'); return; }
    if (ctrl) { shortcut(e, k.toLowerCase(), edit); return; }
    if (k === 'F2') { e.preventDefault(); if (edit) G.edit(); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (edit) Clip.clear(); return; }
    if (e.altKey && k === '=') { e.preventDefault(); if (edit) A['q-sum'](); return; }
    if (k.length === 1 && !e.altKey && edit) { e.preventDefault(); G.edit(k); }   // typing replaces the cell
  });
  function shortcut(e, k, edit) {
    var map = {
      a: function () { K.selectAll(); }, z: function () { if (e.shiftKey) A['b-redo'](); else A['b-undo'](); }, y: function () { A['b-redo'](); },
      b: function () { if (edit) A['f-bold'](); }, i: function () { if (edit) A['f-italic'](); }, u: function () { if (edit) A['f-under'](); },
      f: function () { A['fd-open'](); }, h: function () { A['fd-open'](); }, s: function () { if (edit) A['b-save'](); },
      d: function () { if (edit && window.Fill) Fill.down(); }, r: function () { if (edit && window.Fill) Fill.right(); },
      ';': function () { if (edit) Clip.stamp(e.shiftKey); }, '1': function () { if (window.Dlg) Dlg.formatCells(); },
      k: function () { if (window.Link) Link.open(); }, p: function () { A['m-pdf'](); }
    };
    if (!map[k] || (e.altKey && k !== 'c')) return;
    e.preventDefault(); map[k]();
  }
  K.reset = function () { };
})();
