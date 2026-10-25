// Keys — the shortcuts of a computer on the deck page: undo and redo, cut / copy / paste / duplicate, delete, arrows to nudge a box (or to go to the next slide), group, order, bold / italic / underline, save, present, zoom, find.
// They never run while a box of text, a sheet or a dialog has the keys, and the shortcuts of the slide show are in present-vm.js.
(function () {
  'use strict';
  var $ = Ui.$, A = App.acts, S = window.Stage, Kx = window.Keys = {}, space = false, pan = null;

  function typing(e) { var t = e.target; return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }
  function busy() { return !!(Ui.state.sheet || Ui.state.dlg || PopMenu.isOpen() || (window.Present && Present.isOpen) || (window.Find && Find.open) || (window.Inline && Inline.on)); }
  function go(d) { var i = Deck.cur + d; if (i >= 0 && i < Deck.count()) Slides.go(i); }
  function zoom(f) { Desk.zoomBy(f); }

  function onKey(e) {
    if (!Wide.pc || Router.getCurrent() !== 'deck' || !Deck.info) return;
    var k = e.key, mod = e.ctrlKey || e.metaKey, low = k.length === 1 ? k.toLowerCase() : k;
    if (k === 'Escape' && window.Find && Find.open && !Ui.state.sheet && !Ui.state.dlg && !PopMenu.isOpen()) { A['fd-close'](); e.preventDefault(); return; }
    if (k === ' ' && !typing(e) && !busy()) { if (!space) { space = true; $('stScroll').classList.add('hand'); } e.preventDefault(); return; }
    if (typing(e) || busy()) return;
    var one = !!Deck.sel, step = e.shiftKey ? 1 : 0, did = true;
    if (mod && !e.altKey) {
      if (low === 'z') { if (e.shiftKey) A['d-redo'](); else A['d-undo'](); }
      else if (low === 'y') A['d-redo']();
      else if (low === 'c') Sel.copy(false); else if (low === 'x') Sel.copy(true); else if (low === 'v') Sel.paste(); else if (low === 'd') Sel.dup();
      else if (low === 'a') Sel.all();
      else if (low === 'g') { if (e.shiftKey) Sel.ungroup(); else Sel.group(); }
      else if (low === 's') A['v-save']();
      else if (low === 'b' && one) A['q-b'](); else if (low === 'i' && one) A['q-i'](); else if (low === 'u' && one) A['q-u']();
      else if (low === 'l' && one) Desk.items.alignl(); else if (low === 'e' && one) Desk.items.alignc(); else if (low === 'r' && one) Desk.items.alignr();
      else if (low === 'k' && one) A['i-link'](); else if (low === 'f') A['fd-open'](); else if (low === 'p') A['m-pdf'](); else if (low === 'm') Layout.open('add');
      else if (k === ']' || k === '}') Sel.order(e.shiftKey ? 'front' : 'forward'); else if (k === '[' || k === '{') Sel.order(e.shiftKey ? 'back' : 'backward');
      else if (k === '=' || k === '+') zoom(1.25); else if (k === '-' || k === '_') zoom(0.8); else if (k === '0') Desk.zoom(0);
      else did = false;
    } else if (k === 'Delete' || k === 'Backspace') { if (one) Sel.remove(); else did = false; }
    else if (k === 'Escape') { if (one) Sel.set([]); else did = false; }
    else if (/^Arrow/.test(k)) {
      if (one) { var dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0; Sel.nudge(dx, dy, step); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft') go(-1); else go(1);
    }
    else if (k === 'PageUp') go(-1); else if (k === 'PageDown') go(1); else if (k === 'Home' && !one) go(-Deck.cur); else if (k === 'End' && !one) go(Deck.count());
    else if (k === 'Enter' && one) { var n = S.node(Deck.sel); if (n && window.Inline && (n.text || n.empty) && n.type !== 'picture') Inline.open(n); else if (n && n.text) Text.open(true); else did = false; }
    else if (k === 'Tab' && S.tree) { var ns = S.tree.nodes.filter(function (x) { return !x.decoration && !x.background && !x.empty; }), at = ns.findIndex(function (x) { return x.sourceId === Deck.sel; }), nx = ns[(at + (e.shiftKey ? ns.length - 1 : 1)) % ns.length]; if (nx) Sel.set([nx.sourceId]); }
    else if (k === 'F5') { Present.open(e.shiftKey ? Deck.cur : 0); }
    else did = false;
    if (did) e.preventDefault();
  }
  function onUp(e) { if (e.key === ' ' && space) { space = false; $('stScroll').classList.remove('hand'); } }

  // Space + drag: the slide is moved with the hand (it scrolls)
  function panDown(e) {
    if (!space || e.pointerType !== 'mouse' || e.button !== 0) return; var sc = $('stScroll');
    pan = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; e.preventDefault(); e.stopImmediatePropagation(); sc.classList.add('grab');
    function mv(ev) { sc.scrollLeft = pan.l - (ev.clientX - pan.x); sc.scrollTop = pan.t - (ev.clientY - pan.y); }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); sc.classList.remove('grab'); pan = null; }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  Kx.init = function () {
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onUp); window.addEventListener('blur', function () { space = false; $('stScroll').classList.remove('hand'); });
    $('stScroll').addEventListener('pointerdown', panDown, true);
  };
  Kx.go = go;
})();
