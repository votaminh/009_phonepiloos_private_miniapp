// Surface — the page as ONE editing surface, the way a word processor on a computer behaves: the caret and the selection run through paragraphs, Return splits, Backspace and Delete join,
// a selection over several paragraphs is deleted, typed over and pasted over as one thing, and undo and redo put the caret back. The browser types the letters (so the phone's own keyboard,
// the Vietnamese input methods and spell checking work); everything that changes the SHAPE of the page (paragraphs split, joined, removed, pasted) is done here.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, S = window.Surface = {};
  function paper() { return Doc.paper(); }
  function blocks() { return Array.prototype.filter.call(paper().children, function (n) { return n.classList.contains('b'); }); }
  S.blocks = blocks;
  function isEd(b) { return !!b && b.classList.contains('ed'); }
  function empty(b) { return !b.textContent.replace(/ /g, '').length && !b.querySelector('img'); }
  function ph(b) { if (empty(b) && !b.querySelector('br')) b.innerHTML = '<br data-ph>'; else if (!empty(b)) { var x = b.querySelector('br[data-ph]'); if (x) x.remove(); } }
  function mark(b) { if (b) b.dataset.m = '1'; }

  // ---- where things are ------------------------------------------------------------------------------------------------------
  // the block (a direct child of the page) that holds a node; the node may be the page itself, then the offset says which child
  S.top = function (node, off) {
    var p = paper(); if (!node) return null;
    if (node === p) { var bs = blocks(), n = p.childNodes[Math.max(0, Math.min(off == null ? 0 : off, p.childNodes.length - 1))]; while (n && !(n.nodeType === 1 && n.classList.contains('b'))) n = n.nextSibling; return n || bs[bs.length - 1] || null; }
    while (node && node.parentNode !== p) node = node.parentNode;
    return node && node.nodeType === 1 && node.classList.contains('b') ? node : null;
  };
  S.range = function () { var s = getSelection(); return s.rangeCount && paper().contains(s.anchorNode) ? s.getRangeAt(0) : null; };
  S.span = function (r) {
    var p = paper(), a = S.top(r.startContainer, r.startOffset), z = r.endContainer === p ? S.top(p, Math.max(0, r.endOffset - 1)) : S.top(r.endContainer);
    return { a: a, z: z };
  };
  S.focus = function () { var p = paper(); if (document.activeElement !== p) p.focus({ preventScroll: true }); };
  function caretAt(b, off) { S.focus(); Struct.putCaret(b, { a: off, z: off }); }
  function fresh() { var n = Struct.fresh(document.createElement('p'), 'p'); n.dataset.t = 'p'; n.innerHTML = '<br data-ph>'; return n; }
  // a page never has no paragraph, and nothing sits on it that is not a block
  S.normalize = function () {
    var p = paper(), kids = Array.prototype.slice.call(p.childNodes);
    kids.forEach(function (n) {
      if (n.nodeType === 8 || (n.nodeType === 1 && (n.classList.contains('b') || n.id === 'pgov'))) return;
      if (n.nodeType === 3 && !n.nodeValue.trim()) { n.remove(); return; }
      if (n.nodeType === 1 && /^(P|DIV|H[1-6])$/.test(n.tagName) && !n.classList.contains('b')) { var b = fresh(); b.innerHTML = n.innerHTML || '<br data-ph>'; p.replaceChild(b, n); return; }
      var w = fresh(); w.innerHTML = ''; p.replaceChild(w, n); if (n.nodeType === 1 || n.nodeType === 3) w.appendChild(n); ph(w);
    });
    if (!p.querySelector('.b')) p.appendChild(fresh());
  };

  // ordered lists are numbered here (1. 2. 3. then a. b. then i. ii.), a run of items at the same level counting on until something else interrupts it
  function roman(n) { var m = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], o = ''; m.forEach(function (p) { while (n >= p[0]) { o += p[1]; n -= p[0]; } }); return o; }
  function mark(n, lv) { return lv === 0 ? String(n) : lv === 1 ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : roman(n); }
  S.renumber = function () {
    var def = {}, byId = {}, last = null;   // counters of the lists with no id (they stop at any other paragraph) and of the lists with one (they go on across other paragraphs, as in Word)
    blocks().forEach(function (b) {
      if (b.hidden) return;
      if (!b.classList.contains('li')) { if (!b.classList.contains('lk')) { def = {}; } return; }
      var nid = b.dataset.nid, kind = b.dataset.k || 'bullet', ls = b.dataset.ls, lv = Math.min(8, +b.dataset.il || 0), key = nid ? 'n' + nid : 'd' + kind, store = nid ? byId : def, c = store[key] = store[key] || [];
      c[lv] = (c[lv] || 0) + 1; for (var i = lv + 1; i < 9; i++) c[i] = 0;
      var fd = !ls && nid && window.Doc && Doc.nums ? Doc.nums[nid] : null, tx = (fd && Lists.fileLabel(fd, lv, c)) || (kind === 'ordered' || ls ? Lists.label(ls, kind, lv, c) : '\u2022'); if (b.dataset.no !== tx) b.dataset.no = tx;
    });
  };
  // ---- the selection saved and put back (for undo) ------------------------------------------------------------------------------
  function pos(node, off) {
    var p = paper(), b = S.top(node, off); if (!b) return null; var i = blocks().indexOf(b), r = document.createRange(); r.selectNodeContents(b);
    if (node !== p) { try { r.setEnd(node, off); } catch (e) { /* the node left the page */ } } else r.collapse(true);
    return { i: i, o: node === p ? 0 : r.toString().length };
  }
  S.sel = function () { var r = S.range(); if (!r) return null; var a = pos(r.startContainer, r.startOffset), z = pos(r.endContainer, r.endOffset); return a && z ? { a: a, z: z } : null; };
  function setPos(p, at) {
    var bs = blocks(), b = bs[Math.min(at.i, bs.length - 1)]; if (!b) return null; var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n, left = at.o;
    while ((n = w.nextNode())) { if (left <= n.nodeValue.length) return [n, left]; left -= n.nodeValue.length; }
    return [b, b.childNodes.length];
  }
  S.restore = function (sel) {
    if (!sel) return; var a = setPos(paper(), sel.a), z = setPos(paper(), sel.z); if (!a || !z) return; S.focus();
    var r = document.createRange(); try { r.setStart(a[0], a[1]); r.setEnd(z[0], z[1]); } catch (e) { return; } var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  };

  // ---- deleting what is selected ---------------------------------------------------------------------------------------------------
  // one block, or many: the ends are cut, what lies between goes, and the two ends become one paragraph (the first one's kind wins)
  S.deleteRange = function (r) {
    var p = paper(), sp = S.span(r), a = sp.a, z = sp.z, caret = null;
    if (!a || !z) { r.deleteContents(); S.normalize(); return; }
    // a table keeps its shape: a selection that starts or ends inside one leaves it alone
    if (a !== z && a.classList.contains('tbl')) a = a.nextElementSibling; if (a !== z && z.classList.contains('tbl')) z = z.previousElementSibling;
    if (!a || !z) { S.normalize(); return; }
    if (a === z) {
      if (isEd(a)) { r.deleteContents(); ph(a); mark(a); caretAt(a, Math.min(pos(r.startContainer, r.startOffset).o, a.textContent.length)); }
      else if (!a.classList.contains('tbl')) { var nx = a.nextElementSibling || a.previousElementSibling; a.remove(); S.normalize(); if (nx && isEd(nx)) caretAt(nx, 0); }
      Doc.touch(); return;
    }
    var n, nxt, off = 0;
    if (isEd(a)) {
      var r1 = document.createRange(); r1.setStart(r.startContainer === p ? a : r.startContainer, r.startContainer === p ? 0 : r.startOffset); r1.setEnd(a, a.childNodes.length); r1.deleteContents();
      var x = a.querySelector('br[data-ph]'); if (x) x.remove(); off = a.textContent.length; mark(a);
    }
    var head = null;
    if (isEd(z)) {
      var r2 = document.createRange(); r2.setStart(z, 0); if (r.endContainer === p) r2.setEnd(z, z.childNodes.length); else r2.setEnd(r.endContainer, r.endOffset); r2.deleteContents(); head = z;
    }
    for (n = a.nextElementSibling; n && n !== z;) { nxt = n.nextElementSibling; n.remove(); n = nxt; }
    if (isEd(a) && head) { var y = head.querySelector('br[data-ph]'); if (y) y.remove(); while (head.firstChild) a.appendChild(head.firstChild); head.remove(); ph(a); caret = [a, off]; }
    else if (isEd(a)) { if (z.parentNode) z.remove(); ph(a); caret = [a, off]; }
    else if (head) { if (a.parentNode) a.remove(); mark(head); ph(head); caret = [head, 0]; }
    else { var f = fresh(); if (z.parentNode) { z.before(f); z.remove(); } if (a.parentNode) a.remove(); caret = [f, 0]; }
    S.normalize(); if (caret && caret[0].isConnected) caretAt(caret[0], caret[1]); Doc.touch();
  };

  // ---- Delete joins the next paragraph; Return on a list item that is empty leaves the list --------------------------------------------
  function atEnd(b) {
    var s = getSelection(); if (!s.isCollapsed || !s.rangeCount) return false; var r = document.createRange(); r.selectNodeContents(b); r.setStart(s.anchorNode, s.anchorOffset);
    return !r.toString().replace(/ /g, '').length && !r.cloneContents().querySelector('img');
  }
  function atStart(b) {
    var s = getSelection(); if (!s.isCollapsed || !s.rangeCount) return false; var r = document.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset);
    return !r.toString().replace(/ /g, '').length && !r.cloneContents().querySelector('img');
  }
  Struct.forward = function (b) {
    var nx = b.nextElementSibling; if (!nx) return;
    if (!isEd(nx)) { if (empty(b)) { b.remove(); caretAt(nx.nextElementSibling && isEd(nx.nextElementSibling) ? nx.nextElementSibling : nx, 0); Doc.snap(); } return; }
    var len = b.textContent.length, x = b.querySelector('br[data-ph]'); if (x) x.remove(); var y = nx.querySelector('br[data-ph]'); if (y) y.remove();
    while (nx.firstChild) b.appendChild(nx.firstChild); nx.remove(); ph(b); mark(b); caretAt(b, len); Doc.snap(); Edit.sync();
  };

  // ---- what the browser tells us before it changes the page ----------------------------------------------------------------------------
  function spans(r) { var sp = S.span(r); return !!sp.a && !!sp.z && sp.a !== sp.z; }
  var busy = false;
  paper().addEventListener('beforeinput', function (e) {
    if (Doc.mode !== 'edit' || busy) return; var r = S.range(); if (!r) return; var ty = e.inputType, b = Edit.block();
    if (ty === 'historyUndo') { e.preventDefault(); A['e-undo'](); return; }
    if (ty === 'historyRedo') { e.preventDefault(); A['e-redo'](); return; }
    if (ty === 'insertFromPaste' || ty === 'insertFromDrop' || ty === 'insertFromYank') { e.preventDefault(); S.paste(e.dataTransfer); return; }
    if (ty === 'deleteByDrag') { e.preventDefault(); return; }
    if (!r.collapsed) {
      var many = spans(r) || (S.span(r).a && !isEd(S.span(r).a));
      if (/^delete/.test(ty)) { if (many) { e.preventDefault(); S.deleteRange(r); } return; }
      if (ty === 'insertParagraph') { e.preventDefault(); S.deleteRange(r); var c = Edit.block(); if (c) Struct.split(c); return; }
      if (many && (ty === 'insertText' || ty === 'insertReplacementText')) { e.preventDefault(); busy = true; S.deleteRange(r); document.execCommand('insertText', false, e.data || ''); busy = false; return; }
      return;
    }
    if (!b) return;
    if (ty === 'insertParagraph') { e.preventDefault(); Struct.split(b); }
    else if (ty === 'deleteContentBackward' && atStart(b)) { e.preventDefault(); Struct.back(b); }
    else if (ty === 'deleteContentForward' && atEnd(b)) { e.preventDefault(); Struct.forward(b); }
  });
  paper().addEventListener('paste', function (e) { if (Doc.mode !== 'edit') return; var r = S.range(); if (!r || !Edit.block() && !(r && !r.collapsed)) return; e.preventDefault(); S.paste(e.clipboardData || window.clipboardData); });
  // a letter composed with an input method over a selection of several paragraphs: the selection goes first
  paper().addEventListener('compositionstart', function () { if (Doc.mode !== 'edit') return; var r = S.range(); if (r && !r.collapsed && spans(r)) S.deleteRange(r); });
  // anything the browser did inside the page: every block touched is marked; a stray node is wrapped; the history is told
  paper().addEventListener('input', function () { if (Doc.mode !== 'edit') return; S.normalize(); Edit.mark(); Doc.touch(); });

  // ---- paste -----------------------------------------------------------------------------------------------------------------------------
  // inline markup from anywhere (Word, Docs, a web page) cut down to what the document knows: bold, italic, underline, strike, sup, sub, a link, colour, size, highlight
  function clean(node) {
    var h = '';
    Array.prototype.forEach.call(node.childNodes, function (c) {
      if (c.nodeType === 3) { h += Ui.esc(c.nodeValue.replace(/[\r\n]+/g, ' ')); return; }
      if (c.nodeType !== 1) return; var tag = c.tagName;
      if (tag === 'BR') { h += '<br>'; return; }
      if (/^(SCRIPT|STYLE|IMG|META|LINK|HEAD)$/.test(tag)) return;
      var inner = clean(c); if (!inner) return; var st = c.style || {}, td = st.textDecorationLine || st.textDecoration || '', css = '';
      if (st.color && st.color !== 'rgb(0, 0, 0)' && !/^(inherit|windowtext)/.test(st.color)) css += 'color:' + st.color + ';';
      if (st.fontSize) css += 'font-size:' + st.fontSize + ';';
      if (st.backgroundColor && st.backgroundColor !== 'transparent') css += 'background-color:' + st.backgroundColor + ';';
      var u = tag === 'U' || /underline/.test(td), s2 = /^(S|STRIKE|DEL)$/.test(tag) || /line-through/.test(td);
      if (u || s2) css += 'text-decoration:' + [u ? 'underline' : '', s2 ? 'line-through' : ''].filter(Boolean).join(' ') + ';';
      if (css) inner = '<span style="' + css + '">' + inner + '</span>';
      if (/^(B|STRONG)$/.test(tag) || st.fontWeight === 'bold' || +st.fontWeight >= 600) inner = '<b>' + inner + '</b>';
      if (/^(I|EM)$/.test(tag) || st.fontStyle === 'italic') inner = '<i>' + inner + '</i>';
      if (tag === 'SUP' || st.verticalAlign === 'super') inner = '<sup>' + inner + '</sup>'; else if (tag === 'SUB' || st.verticalAlign === 'sub') inner = '<sub>' + inner + '</sub>';
      if (tag === 'A' && c.getAttribute('href')) inner = '<a class="lnk" data-href="' + Ui.esc(c.getAttribute('href')) + '">' + inner + '</a>';
      h += inner;
    });
    return h;
  }
  // the paragraphs of a piece of HTML: [{ t: 'p'|'h'|'l', lv, k, il, html }]
  S.fromHtml = function (html) {
    var doc = new DOMParser().parseFromString(html, 'text/html'), out = [], own = doc.querySelectorAll('.b.ed, .b.lk');
    if (own.length) {   // blocks copied from this editor
      Array.prototype.forEach.call(own, function (el) { if (el.classList.contains('lk')) { return; } out.push({ own: el }); });
      if (out.length) return out;
    }
    function push(el, spec) { var h = clean(el); spec.html = h; out.push(spec); }
    (function walk(n) {
      Array.prototype.forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) { if (c.nodeValue.trim()) { var d = document.createElement('div'); d.textContent = c.nodeValue; out.push({ t: 'p', html: d.innerHTML }); } return; }
        if (c.nodeType !== 1) return; var tag = c.tagName;
        if (/^H[1-6]$/.test(tag)) push(c, { t: 'h', lv: Math.min(3, +tag[1]) });
        else if (tag === 'LI') push(c, { t: 'l', k: c.parentNode.tagName === 'OL' ? 'ordered' : 'bullet', il: 0 });
        else if (tag === 'P') push(c, { t: 'p' });
        else if (tag === 'TR') { var cells = Array.prototype.map.call(c.children, function (td) { return td.textContent.trim(); }); var d2 = document.createElement('div'); d2.textContent = cells.join('\t'); out.push({ t: 'p', html: d2.innerHTML }); }
        else if (/^(UL|OL|DIV|BODY|SECTION|ARTICLE|TABLE|TBODY|THEAD|BLOCKQUOTE|FORM|MAIN)$/.test(tag)) { var hasBlock = c.querySelector('p,h1,h2,h3,h4,h5,h6,li,tr,div'); if (hasBlock || /^(UL|OL|TABLE|TBODY|THEAD)$/.test(tag)) walk(c); else push(c, { t: 'p' }); }
        else if (/^(SCRIPT|STYLE|META|LINK|HEAD)$/.test(tag)) return;
        else { var last = out[out.length - 1]; var span = document.createElement('div'); span.appendChild(c.cloneNode(true)); var h = clean(span); if (h.trim()) { if (last && last.inline) last.html += h; else out.push({ t: 'p', html: h, inline: true }); } }
      });
    })(doc.body);
    return out.filter(function (s) { return s.own || (s.html && s.html.replace(/<[^>]*>/g, '').trim() !== '') || s.t === 'p'; });
  };
  S.fromText = function (txt) { return String(txt).replace(/\r\n?/g, '\n').split('\n').map(function (l) { var d = document.createElement('div'); d.textContent = l; return { t: 'p', html: d.innerHTML }; }); };
  function build(spec, like) {
    var n;
    if (spec.own) {
      n = spec.own.cloneNode(true); n.removeAttribute('data-src'); n.removeAttribute('contenteditable'); n.classList.remove('sel');
    } else {
      var tag = spec.t === 'h' ? 'h' + spec.lv : 'p'; n = document.createElement(tag); n.className = 'b ed'; n.dataset.t = spec.t;
      if (spec.t === 'h') n.dataset.lv = String(spec.lv); if (spec.t === 'l') { n.dataset.k = spec.k; n.dataset.il = String(spec.il || 0); n.classList.add('li', spec.k === 'ordered' ? 'ord' : 'bul'); }
      n.innerHTML = spec.html || '';
    }
    n.dataset.n = Doc.nid(); n.dataset.m = '1'; ph(n); return n;
  }
  function inlineOf(spec) { if (spec.own) return spec.own.innerHTML; return spec.html || ''; }
  S.paste = function (dt) {
    var r = S.range(); if (!r) return; if (!r.collapsed) { S.deleteRange(r); r = S.range(); } var b = Edit.block(); if (!b || !r) return;
    var html = dt && dt.getData ? dt.getData('text/html') : '', text = dt && dt.getData ? dt.getData('text/plain') : '', specs = html ? S.fromHtml(html) : S.fromText(text);
    if (!specs.length) specs = S.fromText(text); if (!specs.length) return;
    if (specs.length === 1) {   // inside one paragraph
      var h = inlineOf(specs[0]); document.execCommand('insertHTML', false, h); Edit.mark(); S.normalize(); Doc.snap(); return;
    }
    var tail = document.createRange(); tail.selectNodeContents(b); tail.setStart(r.startContainer, r.startOffset); var frag = tail.extractContents(), n2 = b.cloneNode(false);
    n2.removeAttribute('data-src'); n2.dataset.n = Doc.nid(); n2.appendChild(frag); b.after(n2);
    var first = specs[0], last = specs[specs.length - 1], prev = b;
    var x = b.querySelector('br[data-ph]'); if (x) x.remove(); b.insertAdjacentHTML('beforeend', inlineOf(first));
    specs.slice(1, -1).forEach(function (s) { var nb = build(s, b); prev.after(nb); prev = nb; });
    var y = n2.querySelector('br[data-ph]'); if (y) y.remove(); n2.insertAdjacentHTML('afterbegin', inlineOf(last)); ph(b); ph(n2); mark(b); mark(n2);
    n2.after(document.createComment('')); n2.nextSibling.remove();
    // the pasted paragraphs sit between the two halves
    if (prev !== b) { /* middle blocks were inserted after b in order */ }
    var len = (last.own ? last.own.textContent : (function () { var d = document.createElement('div'); d.innerHTML = last.html || ''; return d.textContent; })()).length;
    S.normalize(); caretAt(n2, len); Doc.snap(); Edit.sync();
  };

})();
