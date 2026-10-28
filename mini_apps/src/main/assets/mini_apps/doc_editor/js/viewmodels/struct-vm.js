// Struct — the shape of the document while editing: paragraph style, alignment, lists, indent, Return and Backspace, the grip beside a paragraph and the quick bar over a selection.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var Struct = window.Struct = {}, grip = null, quick = null, gripFor = null;
  function cur() { return Edit.block(); }
  function caretOffsets(b) {   // character offsets of the selection inside block b, to put the caret back after b is rebuilt
    var s = getSelection(); if (!s.rangeCount) return null; var r = s.getRangeAt(0);
    function off(node, o) { var p = document.createRange(); p.selectNodeContents(b); p.setEnd(node, o); return p.toString().length; }
    return { a: off(r.startContainer, r.startOffset), z: off(r.endContainer, r.endOffset) };
  }
  function putCaret(b, c) {
    var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n, pos = 0, r = document.createRange(), a = null, z = null; c = c || { a: 0, z: 0 };
    while ((n = w.nextNode())) { var l = n.nodeValue.length; if (!a && pos + l >= c.a) a = [n, c.a - pos]; if (!z && pos + l >= c.z) { z = [n, c.z - pos]; break; } pos += l; }
    if (!a) { r.selectNodeContents(b); r.collapse(false); } else { r.setStart(a[0], a[1]); r.setEnd((z || a)[0], (z || a)[1]); }
    if (window.Surface) Surface.focus(); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  Struct.putCaret = putCaret;
  function swap(b, tag, set) {
    var c = caretOffsets(b), n = document.createElement(tag);
    Array.prototype.forEach.call(b.attributes, function (a) { n.setAttribute(a.name, a.value); });
    while (b.firstChild) n.appendChild(b.firstChild);
    b.parentNode.replaceChild(n, b); set(n); n.dataset.m = '1'; putCaret(n, c); return n;
  }
  function plain(n) { n.classList.remove('li', 'bul', 'ord'); n.removeAttribute('data-k'); n.removeAttribute('data-il'); n.removeAttribute('data-lv'); n.removeAttribute('data-nid'); n.removeAttribute('data-ls'); n.removeAttribute('data-no'); n.dataset.t = 'p'; }
  function done() { Doc.snap(); Edit.sync(); }

  // ---- style, alignment, lists, indent -------------------------------------------------------------------------------------
  Struct.setStyle = function (k) {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    var n = swap(b, k ? 'h' + k : 'p', function (e) { plain(e); if (k) { e.dataset.t = 'h'; e.dataset.lv = String(k); e.removeAttribute('data-in'); e.style.marginLeft = ''; } });
    done(); return n;
  };
  A['e-style'] = function (el) { var b = cur(); Edit.pop(SheetsView.styles(b && b.dataset.t === 'h' ? 'st.h' + b.dataset.lv : 'st.normal'), el, 'menu'); };
  A['e-setstyle'] = function (el) { Edit.hidePops(); Struct.setStyle(+el.dataset.k); };
  function align(a) { var b = cur(); if (!b) return Ui.toast(t('e.tap')); Edit.mark(); a === 'left' ? b.removeAttribute('data-al') : b.dataset.al = a; b.dataset.m = '1'; done(); }
  ['left', 'center', 'right', 'justify'].forEach(function (a) { A['e-al-' + a] = function () { align(a); }; });
  function list(kind) {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    if (b.dataset.t === 'l' && b.dataset.k === kind) { swap(b, 'p', plain); return done(); }
    swap(b, 'p', function (e) { plain(e); e.dataset.t = 'l'; e.dataset.k = kind; e.dataset.il = '0'; e.classList.add('li', kind === 'ordered' ? 'ord' : 'bul'); e.removeAttribute('data-in'); e.style.marginLeft = ''; e.removeAttribute('data-lv'); });
    done();
  }
  // a paragraph becomes an item of a list of the given kind (the new element is returned)
  Struct.toList = function (b, kind) { return b.dataset.t === 'l' ? b : swap(b, 'p', function (e) { plain(e); e.dataset.t = 'l'; e.dataset.k = kind; e.dataset.il = '0'; e.classList.add('li', kind === 'ordered' ? 'ord' : 'bul'); e.removeAttribute('data-in'); e.style.marginLeft = ''; e.removeAttribute('data-lv'); }); };
  A['e-bul'] = function () { list('bullet'); }; A['e-num'] = function () { list('ordered'); };
  function indent(d) {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    if (b.dataset.t === 'l') b.dataset.il = String(Math.max(0, Math.min(3, (+b.dataset.il || 0) + d)));
    else { var v = Math.max(0, Math.min(4320, (+b.dataset.in || 0) + d * 720)); if (v) { b.dataset.in = String(v); b.style.marginLeft = Math.round(v / 15) + 'px'; } else { b.removeAttribute('data-in'); b.style.marginLeft = ''; } }
    b.dataset.m = '1'; done();
  }
  A['e-indent'] = function () { indent(1); }; A['e-outdent'] = function () { indent(-1); };

  // ---- Return and Backspace ---------------------------------------------------------------------------------------------------
  function empty(b) { return !b.textContent.replace(/ /g, '').length && !b.querySelector('img'); }
  function ph(b) { if (empty(b) && !b.querySelector('br')) b.innerHTML = '<br data-ph>'; else if (!empty(b)) { var x = b.querySelector('br[data-ph]'); if (x) x.remove(); } }
  function fresh(like, tag) {
    var n = document.createElement(tag || 'p'); n.className = 'b ed'; n.dataset.n = Doc.nid(); n.dataset.m = '1';
    if (like.dataset.al) n.dataset.al = like.dataset.al;
    return n;
  }
  Struct.fresh = fresh;
  Struct.split = function (b) {
    var s = getSelection(), r = s.getRangeAt(0); if (!r.collapsed) { Surface.deleteRange(r); b = cur(); if (!b) return; r = getSelection().getRangeAt(0); }
    if (b.dataset.t === 'l' && empty(b)) { swap(b, 'p', plain); return done(); }   // Return on an empty list item leaves the list
    var carry = window.Edit && Edit.carry ? Edit.carry() : null;
    var tail = document.createRange(); tail.selectNodeContents(b); tail.setStart(r.startContainer, r.startOffset);
    var frag = tail.extractContents(), n = fresh(b, 'p'); n.dataset.t = 'p';
    if (b.dataset.t !== 'h') { if (b.dataset.st) n.dataset.st = b.dataset.st; if (b.getAttribute('style')) n.setAttribute('style', b.getAttribute('style').replace(/margin-top:[^;]*;?/, '')); }   // the next paragraph looks like this one (a heading is followed by Normal text)
    if (b.dataset.t === 'l') { n.dataset.t = 'l'; n.dataset.k = b.dataset.k; n.dataset.il = b.dataset.il; n.className = 'b ed li ' + (b.dataset.k === 'ordered' ? 'ord' : 'bul'); }
    else if (b.dataset.t === 'p' && b.dataset.in) { n.dataset.in = b.dataset.in; n.style.marginLeft = b.style.marginLeft; }
    n.appendChild(frag); var atEnd = empty(n); ph(n); ph(b); b.dataset.m = '1'; b.after(n); n.focus(); putCaret(n, { a: 0, z: 0 }); done();
    if (carry && atEnd) carry();
  };
  Struct.back = function (b) {
    if (b.dataset.t === 'l') { swap(b, 'p', plain); return done(); }
    var prev = b.previousElementSibling;
    if (!prev || !prev.classList.contains('ed')) { if (prev && empty(b)) { b.remove(); } return done(); }
    var len = prev.textContent.length; var x = prev.querySelector('br[data-ph]'); if (x) x.remove();
    while (b.firstChild) prev.appendChild(b.firstChild); b.remove(); ph(prev); prev.dataset.m = '1'; prev.focus(); putCaret(prev, { a: len, z: len }); done();
  };
  function atStart() { var s = getSelection(), b = cur(); if (!b || !s.isCollapsed) return false; var p = document.createRange(); p.selectNodeContents(b); p.setEnd(s.anchorNode, s.anchorOffset); return !p.toString().replace(/ /g, '').length && !p.cloneContents().querySelector('img'); }
  // what the browser does before it changes the page (Return, Backspace, Delete, paste, undo) is decided in surface-vm.js

  // ---- the actions block and the quick bar -------------------------------------------------------------------------------------
  // one block that holds the paragraph menu (three dots) and Done; it sits next to the rect in focus, as near as the screen allows, and stays within reach of a thumb
  function ensure() {
    var pw = $('pw'); if (grip) return;
    grip = document.createElement('div'); grip.className = 'gcl hidden'; grip.setAttribute('role', 'toolbar'); grip.setAttribute('aria-label', t('g.grip'));
    grip.innerHTML = '<button type="button" class="gc-m" data-act="g-grip" aria-label="' + Ui.esc(t('g.grip')) + '">' + Ui.ic('grip', 18, 2) + '</button>'; pw.appendChild(grip);
    quick = document.createElement('div'); quick.className = 'quick hidden'; quick.setAttribute('role', 'toolbar'); pw.appendChild(quick);
    quick.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    grip.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    var raf = 0; function again() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }
    // while the page moves under the finger the block and the bar step aside (they come back where they belong when it stops): placing them on every frame made them flicker and cost a layout per frame
    var idle = 0;
    $('docBody').addEventListener('scroll', function () {
      grip.classList.add('moving'); quick.classList.add('moving'); clearTimeout(idle);
      idle = setTimeout(function () { grip.classList.remove('moving'); quick.classList.remove('moving'); place(); placeQuick(); }, 150);
    }, { passive: true });
    var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { again(); placeQuick(); }, 120); });   // once the window stops changing, not on every step of the keyboard
  }
  function clearSel() { Array.prototype.forEach.call(Doc.paper().querySelectorAll('.b.lk.sel'), function (el) { el.classList.remove('sel'); }); }
  // the block goes above the rect, right edges aligned; below it when there is no room above (or the quick bar is there); inside its top corner when the rect fills the screen
  function place() {
    if (!grip || !gripFor || !gripFor.isConnected || grip.classList.contains('hidden')) return;
    var pw = $('pw').getBoundingClientRect(), vis = $('docBody').getBoundingClientRect(), r = gripFor.getBoundingClientRect(), w = grip.offsetWidth || 120, h = grip.offsetHeight || 44, M = 8, y;
    grip.style.visibility = r.bottom < vis.top || r.top > vis.bottom ? 'hidden' : '';
    var x = Math.max(vis.left + M, Math.min(vis.right - w - M, r.right - w)), above = r.top - h - 6, below = r.bottom + 6, qv = !quick.classList.contains('hidden');
    if (qv && below + h <= vis.bottom - M) y = below; else if (above >= vis.top + M) y = above; else if (below + h <= vis.bottom - M) y = below; else y = Math.max(vis.top + M, Math.min(vis.bottom - h - M, r.top + 6));
    grip.style.left = (x - pw.left) + 'px'; grip.style.top = (y - pw.top) + 'px';
  }
  // the quick bar of a selection: the phone's own menu (Cut, Copy, Paste) and the handles of the selection are above and just under the words, so the bar goes below the handles;
  // when that is out of the screen (the keyboard) it goes to the top of the page area, never over the words
  var quickAt = null, quickNew = true;
  function placeQuick() {
    if (!quickAt || !quick || quick.classList.contains('hidden')) return;
    var pw = $('pw').getBoundingClientRect(), vis = $('docBody').getBoundingClientRect(), q = quickAt.getBoundingClientRect(), w = quick.offsetWidth, h = quick.offsetHeight || 46;
    if (!q.width && !q.height) { quick.classList.add('hidden'); return; }
    var y = q.bottom + 64; if (y + h > vis.bottom - 6) y = q.top - h - 70; if (y < vis.top + 6) y = vis.top + 8;
    var x = Math.max(vis.left + 6, Math.min(vis.right - w - 6, q.left + q.width / 2 - w / 2));   // inside what is on screen (the page can be wider than the screen when zoomed)
    var fresh = quickNew; quickNew = false;
    if (fresh) quick.style.transition = 'none';   // the first place is taken at once; after that the bar glides to each new place
    quick.style.left = (x - pw.left) + 'px'; quick.style.top = (y - pw.top) + 'px';
    if (fresh) { void quick.offsetWidth; requestAnimationFrame(function () { quick.style.transition = ''; }); }
  }
  Struct.placeQuick = placeQuick;
  // called when the caret moves: the actions block sits by the paragraph in focus, the quick bar near a selection
  Struct.follow = function (b) {
    ensure(); if (Doc.mode !== 'edit') { Struct.hide(); return; }
    gripFor = b; clearSel(); grip.classList.remove('hidden');
    var pw = $('pw').getBoundingClientRect(), s = getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
    if (r && !r.collapsed && b.contains(r.startContainer)) {
      quick.innerHTML = SheetsView.quick(document.queryCommandState('bold'));
      if (quick.classList.contains('hidden')) quickNew = true;
      quick.classList.remove("hidden"); quickAt = r.cloneRange(); placeQuick();
    } else { quick.classList.add('hidden'); quickAt = null; }
    place();
  };
  // a read-only block (table of contents, picture, chart, divider...) is picked by a tap: it gets the same block, with fewer actions
  Struct.pick = function (b) {
    ensure(); clearSel(); b.classList.add('sel'); gripFor = b; quick.classList.add('hidden'); grip.classList.remove('hidden'); place();
  };
  Struct.hide = function () { if (!grip) return; clearSel(); gripFor = null; grip.classList.add('hidden'); quick.classList.add('hidden'); };
  Struct.place = place;
  $('paper').addEventListener('click', function (e) {
    if (Doc.mode !== 'edit') return; var b = e.target.closest && e.target.closest('.b.lk');
    if (!b || b.hidden || b.classList.contains('tbl') || b.classList.contains('sb')) return;
    e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); getSelection().removeAllRanges(); Edit.hidePops(); Struct.pick(b);
  });
  A['g-grip'] = function (el) { if (gripFor) Edit.pop(SheetsView.grip(gripFor.classList.contains('lk')), el, 'menu'); };
  A['g-done'] = function () { Edit.hidePops(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); getSelection().removeAllRanges(); Struct.hide(); };
  function insertAt(b, where) { var n = fresh(b, 'p'); n.dataset.t = 'p'; n.innerHTML = '<br data-ph>'; where === 'above' ? b.before(n) : b.after(n); n.focus(); putCaret(n, { a: 0, z: 0 }); done(); }
  A['g-above'] = function () { Edit.hidePops(); if (gripFor) insertAt(gripFor, 'above'); };
  A['g-below'] = function () { Edit.hidePops(); if (gripFor) insertAt(gripFor, 'below'); };
  A['g-dup'] = function () {
    Edit.hidePops(); var b = gripFor; if (!b) return;
    var c = b.cloneNode(true); c.removeAttribute('data-src'); c.dataset.n = Doc.nid(); c.dataset.m = '1'; b.after(c); c.focus(); putCaret(c, { a: 0, z: 0 }); done();
  };
  A['g-del'] = function () {
    Edit.hidePops(); var b = gripFor; if (!b) return; var nx = b.nextElementSibling || b.previousElementSibling; b.remove(); Struct.hide();
    Doc.snap(); if (nx && nx.classList.contains('ed')) { nx.focus(); putCaret(nx, { a: 0, z: 0 }); }
    Ui.toast(t('g.deleted'), function () { A['e-undo'](); });
  };
  A['q-cut'] = function () { document.execCommand('cut'); Edit.mark(); Doc.touch(); };
  A['q-copy'] = function () { document.execCommand('copy'); };
  A['q-paste'] = async function () { try { var tx = await navigator.clipboard.readText(); document.execCommand('insertText', false, tx.replace(/\s*\n\s*/g, ' ')); Edit.mark(); Doc.touch(); } catch (e) { document.execCommand('paste'); } };
})();
