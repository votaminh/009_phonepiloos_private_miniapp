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
    var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  Struct.putCaret = putCaret;
  function swap(b, tag, set) {
    var c = caretOffsets(b), n = document.createElement(tag);
    Array.prototype.forEach.call(b.attributes, function (a) { n.setAttribute(a.name, a.value); });
    while (b.firstChild) n.appendChild(b.firstChild);
    b.parentNode.replaceChild(n, b); set(n); n.dataset.m = '1'; n.contentEditable = 'true'; n.focus(); putCaret(n, c); return n;
  }
  function plain(n) { n.classList.remove('li', 'bul', 'ord'); n.removeAttribute('data-k'); n.removeAttribute('data-il'); n.removeAttribute('data-lv'); n.dataset.t = 'p'; }
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
    var n = document.createElement(tag || 'p'); n.className = 'b ed'; n.dataset.n = Doc.nid(); n.dataset.m = '1'; n.contentEditable = 'true';
    if (like.dataset.al) n.dataset.al = like.dataset.al;
    return n;
  }
  Struct.fresh = fresh;
  Struct.split = function (b) {
    var s = getSelection(), r = s.getRangeAt(0); if (!r.collapsed) r.deleteContents();
    if (b.dataset.t === 'l' && empty(b)) { swap(b, 'p', plain); return done(); }   // Return on an empty list item leaves the list
    var tail = document.createRange(); tail.selectNodeContents(b); tail.setStart(r.startContainer, r.startOffset);
    var frag = tail.extractContents(), n = fresh(b, 'p'); n.dataset.t = 'p';
    if (b.dataset.t === 'l') { n.dataset.t = 'l'; n.dataset.k = b.dataset.k; n.dataset.il = b.dataset.il; n.className = 'b ed li ' + (b.dataset.k === 'ordered' ? 'ord' : 'bul'); }
    else if (b.dataset.t === 'p' && b.dataset.in) { n.dataset.in = b.dataset.in; n.style.marginLeft = b.style.marginLeft; }
    n.appendChild(frag); ph(n); ph(b); b.dataset.m = '1'; b.after(n); n.focus(); putCaret(n, { a: 0, z: 0 }); done();
  };
  Struct.back = function (b) {
    if (b.dataset.t === 'l') { swap(b, 'p', plain); return done(); }
    var prev = b.previousElementSibling;
    if (!prev || !prev.classList.contains('ed')) { if (prev && empty(b)) { b.remove(); } return done(); }
    var len = prev.textContent.length; var x = prev.querySelector('br[data-ph]'); if (x) x.remove();
    while (b.firstChild) prev.appendChild(b.firstChild); b.remove(); ph(prev); prev.dataset.m = '1'; prev.focus(); putCaret(prev, { a: len, z: len }); done();
  };
  function atStart() { var s = getSelection(), b = cur(); if (!b || !s.isCollapsed) return false; var p = document.createRange(); p.selectNodeContents(b); p.setEnd(s.anchorNode, s.anchorOffset); return !p.toString().replace(/ /g, '').length && !p.cloneContents().querySelector('img'); }
  $('paper').addEventListener('beforeinput', function (e) {
    var b = cur(); if (!b) return;
    if (e.inputType === 'insertParagraph') { e.preventDefault(); Struct.split(b); }
    else if (e.inputType === 'deleteContentBackward' && atStart()) { e.preventDefault(); Struct.back(b); }
  });

  // ---- the grip and the quick bar -----------------------------------------------------------------------------------------------
  function ensure() {
    var pw = $('pw'); if (grip) return;
    grip = document.createElement('button'); grip.type = 'button'; grip.className = 'grip hidden'; grip.dataset.act = 'g-grip'; grip.setAttribute('aria-label', t('g.grip')); grip.innerHTML = Ui.ic('grip', 14, 2); pw.appendChild(grip);
    quick = document.createElement('div'); quick.className = 'quick hidden'; quick.setAttribute('role', 'toolbar'); pw.appendChild(quick);
    quick.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    grip.addEventListener('pointerdown', function (e) { e.preventDefault(); });
  }
  // called when the caret moves: the grip sits beside the paragraph in focus, the quick bar above a selection
  Struct.follow = function (b) {
    ensure(); if (Doc.mode !== 'edit') { grip.classList.add('hidden'); quick.classList.add('hidden'); return; }
    var pw = $('pw').getBoundingClientRect(), br = b.getBoundingClientRect(), pr = Doc.paper().getBoundingClientRect(); gripFor = b;
    grip.style.top = (br.top - pw.top + 2) + 'px'; grip.style.left = (pr.left - pw.left + 3) + 'px'; grip.classList.remove('hidden');
    var s = getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
    if (r && !r.collapsed && b.contains(r.startContainer)) {
      quick.innerHTML = SheetsView.quick(document.queryCommandState('bold'));
      var q = r.getBoundingClientRect(), top = q.top - pw.top - 54; quick.classList.remove('hidden');
      var w = quick.offsetWidth, left = Math.max(4, Math.min(pw.width - w - 4, q.left - pw.left + q.width / 2 - w / 2));
      quick.style.left = left + 'px'; quick.style.top = (top < 0 ? q.bottom - pw.top + 18 : top) + 'px';
    } else quick.classList.add('hidden');
  };
  A['g-grip'] = function (el) { if (gripFor) Edit.pop(SheetsView.grip(), el, 'menu'); };
  function insertAt(b, where) { var n = fresh(b, 'p'); n.dataset.t = 'p'; n.innerHTML = '<br data-ph>'; where === 'above' ? b.before(n) : b.after(n); n.focus(); putCaret(n, { a: 0, z: 0 }); done(); }
  A['g-above'] = function () { Edit.hidePops(); if (gripFor) insertAt(gripFor, 'above'); };
  A['g-below'] = function () { Edit.hidePops(); if (gripFor) insertAt(gripFor, 'below'); };
  A['g-dup'] = function () {
    Edit.hidePops(); var b = gripFor; if (!b) return;
    var c = b.cloneNode(true); c.removeAttribute('data-src'); c.dataset.n = Doc.nid(); c.dataset.m = '1'; b.after(c); c.focus(); putCaret(c, { a: 0, z: 0 }); done();
  };
  A['g-del'] = function () {
    Edit.hidePops(); var b = gripFor; if (!b) return; var nx = b.nextElementSibling || b.previousElementSibling; b.remove(); gripFor = null; grip.classList.add('hidden'); quick.classList.add('hidden');
    Doc.snap(); if (nx && nx.classList.contains('ed')) { nx.focus(); putCaret(nx, { a: 0, z: 0 }); }
    Ui.toast(t('g.deleted'), function () { A['e-undo'](); });
  };
  A['q-cut'] = function () { document.execCommand('cut'); Edit.mark(); Doc.touch(); };
  A['q-copy'] = function () { document.execCommand('copy'); };
  A['q-paste'] = async function () { try { var tx = await navigator.clipboard.readText(); document.execCommand('insertText', false, tx.replace(/\s*\n\s*/g, ' ')); Edit.mark(); Doc.touch(); } catch (e) { document.execCommand('paste'); } };
})();
