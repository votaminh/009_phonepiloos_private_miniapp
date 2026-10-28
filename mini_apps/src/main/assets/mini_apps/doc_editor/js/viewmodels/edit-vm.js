// Edit — the tools above the keyboard: tabs, text formatting, font and size, colours, links, and the small popovers they open.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, pop = null;
  var Edit = window.Edit = {};
  function cur() { var s = getSelection(); if (!s.rangeCount) return null; var n = s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n); return el && el.closest ? el.closest('#paper .b.ed') : null; }
  Edit.block = cur;
  // the paragraphs the selection touches are marked as changed (walks only from the first to the last, not the whole page)
  function mark() {
    var s = getSelection(); if (!s.rangeCount) return; var r = s.getRangeAt(0), up = function (n) { var el = n && (n.nodeType === 3 ? n.parentElement : n); return el && el.closest ? el.closest('#paper > .b') : null; };
    var a = up(r.startContainer), z = s.isCollapsed ? a : up(r.endContainer); if (!a) return;
    for (var el = a; el; el = el.nextElementSibling) { if (el.classList.contains('ed')) el.dataset.m = '1'; if (el === z) break; }
  }
  Edit.mark = mark;
  Edit.cmd = function (name, arg, whole) {
    if (Table.cell()) { Ui.toast(t('tb.nofmt')); return false; }
    var b = cur(); if (!b) { Ui.toast(t('e.tap')); return false; }
    var s = getSelection();
    if (whole && s.isCollapsed) { var r = document.createRange(); r.selectNodeContents(b); s.removeAllRanges(); s.addRange(r); }   // nothing selected: the whole paragraph
    if (!s.isCollapsed) Edit.pend = null;   // a selection is formatted now; an older "next typed text" choice must not run over it
    document.execCommand('styleWithCSS', false, true); document.execCommand(name, false, arg);
    if (!s.isCollapsed) { mark(); Doc.touch(); }   // a caret only arms the typing style: the text is unchanged, and re-paginating would put the caret back and drop that style
    Edit.sync(); return true;
  };

  // ---- the bar --------------------------------------------------------------------------------------------------------------
  Edit.buildTools = function () {
    if (window.Wide && Wide.pc) { if (window.Desk) Desk.bar(); return; }
    if (window.Ribbon) { Ribbon.phone(); return; }   // the touch layout shows the same ribbon as a dock
    var el = $('docTools');
    el.innerHTML = '<div id="tlTabs"></div><div id="tlBody"></div>';
    Edit.tab(Doc.tab || 'text', true);
  };
  Edit.tab = function (k, first) {
    Doc.tab = k; var tabs = $('tlTabs'), body = $('tlBody'); if (!tabs) return;
    if (first || !tabs.firstChild) tabs.innerHTML = DocView.tabs(k, !!Doc.inTable); else { var w = tabs.firstChild; w.style.setProperty('--i', ['text', 'para', 'insert', 'table'].indexOf(k) < 0 ? 0 : Math.min(['text', 'para', 'insert'].indexOf(k), 3)); Array.prototype.forEach.call(w.querySelectorAll('.tl-tab'), function (b) { b.classList.toggle('on', b.dataset.tab === k); }); }
    body.className = k === 'insert' ? 'tl-panel' : 'tl-row'; body.innerHTML = k === 'insert' ? DocView.panel() : DocView.row(k, {});
    if (k === 'insert') { var a = document.activeElement; if (a && a.blur && a.closest && a.closest('#paper')) a.blur(); }
    Edit.sync();
  };
  A['e-tab'] = function (el) { Edit.hidePops(); Edit.tab(el.dataset.tab); };
  function px2pt(px) { return Math.round(parseFloat(px) * 0.75 * 2) / 2; }
  // the state of the tools follows the caret (bold lit when the caret sits in bold text, the font chip shows the font and size there)
  Edit.sync = function () {
    var inCell = !!Table.cell(), tabs = $('tlTabs');
    if (tabs && inCell !== !!Doc.inTable && Doc.mode === 'edit') { Doc.inTable = inCell; if (inCell) Edit.tab('table', true); else if (Doc.tab === 'table') { Edit.tab('text', true); return; } else tabs.innerHTML = DocView.tabs(Doc.tab, false); }
    var b = cur(), body = $('tlBody'); if (!b || Doc.mode !== 'edit') return;
    // the phone has no tool body (its bar is the dock): the block actions and the quick bar of a selection still follow the caret, and a picked picture is let go
    Edit.paintColor();
    var n = getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), f = el && el.closest('[data-f]'), sz = el && el.closest('[style*="font-size"]');
    var live = Edit.pendLive(), chip = $('tlFont'); if (chip) chip.textContent = ((live && live.font) || (f && f.dataset.f) || t('f.default')) + ' · ' + ((live && live.size) || (sz ? Math.round(px2pt(getComputedStyle(sz).fontSize)) : 11));
    if (!body) { if (typeof Struct !== 'undefined') Struct.follow(b); return; }
    function on(act, v) { var x = body.querySelector('[data-act="' + act + '"]'); if (x) { x.classList.toggle('on', !!v); x.setAttribute('aria-pressed', !!v); } }
    var q = function (c) { try { return document.queryCommandState(c); } catch (e) { return false; } };
    on('e-bold', q('bold')); on('e-italic', q('italic')); on('e-underline', q('underline')); on('e-strike', q('strikeThrough'));
    var al = b.dataset.al || 'left'; ['left', 'center', 'right', 'justify'].forEach(function (a) { on('e-al-' + a, al === a); });
    on('e-bul', b.dataset.t === 'l' && b.dataset.k === 'bullet'); on('e-num', b.dataset.t === 'l' && b.dataset.k === 'ordered');
    var st = $('tlStyle'); if (st) st.textContent = t(b.dataset.t === 'h' ? 'st.h' + b.dataset.lv : 'st.normal');
    if (typeof Struct !== 'undefined') Struct.follow(b);
  };
  document.addEventListener('selectionchange', function () {
    if (Doc.mode !== 'edit') return;
    var b = cur(); if (b) { var s = getSelection(); Doc.range = s.getRangeAt(0).cloneRange(); Edit.sync(); }
    else if (Doc.inTable || Table.cell()) { Doc.range = getSelection().getRangeAt(0).cloneRange(); Edit.sync(); }
  });
  $('docTools').addEventListener('pointerdown', function (e) { if (!e.target.closest('input')) e.preventDefault(); });   // tapping a tool must not take the selection or close the keyboard

  // ---- text formatting -----------------------------------------------------------------------------------------------------
  A['e-bold'] = function () { Edit.cmd('bold'); }; A['e-italic'] = function () { Edit.cmd('italic'); };
  A['e-underline'] = function () { Edit.cmd('underline'); }; A['e-strike'] = function () { Edit.cmd('strikeThrough'); };
  // Nothing selected = the next typed text (the browser keeps a "typing style" at the caret and puts it on the span it creates when the user types).
  // The span arrives only on the first typed character, so its tidy-up is remembered in Edit.pend and runs on that input.
  Edit.pend = null;
  function pendAt() { var s = getSelection(); return { n: s.anchorNode, o: s.anchorOffset }; }
  Edit.pendLive = function () { var p = Edit.pend, s = getSelection(); return p && s.isCollapsed && s.anchorNode === p.at.n && s.anchorOffset === p.at.o ? p : null; };
  function fixSizes(next) {
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('font[size="7"]'), function (f) { var sp = document.createElement('span'); sp.style.fontSize = next + 'pt'; while (f.firstChild) sp.appendChild(f.firstChild); f.parentNode.replaceChild(sp, f); });
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('span[style*="xxx-large"]'), function (sp) { sp.style.fontSize = next + 'pt'; });
  }
  function fixFonts(name) {
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('[style*="PiloFont"],font[face="PiloFont"]'), function (n) {
      var sp = n.tagName === 'FONT' ? document.createElement('span') : n;
      if (sp !== n) { while (n.firstChild) sp.appendChild(n.firstChild); n.parentNode.replaceChild(sp, n); }
      sp.removeAttribute('face'); sp.dataset.f = name; sp.style.fontFamily = Render.family(name);
    });
  }
  document.addEventListener('input', function () {
    var p = Edit.pend; if (!p || Doc.mode !== 'edit') return;
    if (p.size) fixSizes(p.size); if (p.font) fixFonts(p.font);
  }, true);
  function resize(delta, to) {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    var s = getSelection(), collapsed = s.isCollapsed;
    var n = s.anchorNode, el = n.nodeType === 3 ? n.parentElement : n, sz = el.closest('[style*="font-size"]');
    var live = Edit.pendLive(), now = live && live.size ? live.size : sz ? px2pt(getComputedStyle(sz).fontSize) : 11, next = to || Math.max(6, Math.min(72, Math.round(now) + delta));
    if (!collapsed) Edit.pend = null;
    document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7');
    fixSizes(next);
    if (collapsed) { var keep = live && live.at ? live : { at: pendAt() }; Edit.pend = { at: pendAt(), size: next, font: keep.font }; }
    if (!collapsed) { mark(); Doc.touch(); }
    Edit.sync(); var fs = $('foSize'); if (fs) fs.textContent = next;
  }
  A['e-smaller'] = function () { resize(-1); }; A['e-larger'] = function () { resize(1); };
  A['e-setsize'] = function (el) { resize(0, +el.dataset.s); Array.prototype.forEach.call(document.querySelectorAll('.fo-sz'), function (b) { b.classList.toggle('on', b === el); }); };
  A['e-setfont'] = function (el) {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    var collapsed = getSelection().isCollapsed, live = Edit.pendLive();
    if (!collapsed) Edit.pend = null;
    document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, 'PiloFont');
    fixFonts(el.dataset.f);
    if (collapsed) Edit.pend = { at: pendAt(), font: el.dataset.f, size: live && live.size };
    if (!collapsed) { mark(); Doc.touch(); }
    Edit.sync(); Array.prototype.forEach.call(document.querySelectorAll('.fo-it'), function (x) { x.classList.toggle('on', x === el); });
  };
  A['e-sup'] = function () { Edit.cmd('superscript'); }; A['e-sub'] = function () { Edit.cmd('subscript'); };
  A['e-clear'] = function () { var b = cur(); if (!b) return Ui.toast(t('e.tap')); Edit.cmd('removeFormat', null, true); Array.prototype.forEach.call(b.querySelectorAll('[data-f]'), function (n) { n.removeAttribute('data-f'); }); };
  A['e-font'] = function () {
    var b = cur(), n = b && getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), f = el && el.closest('[data-f]'), sz = el && el.closest('[style*="font-size"]');
    var name = f && f.dataset.f, shown = name ? Render.family(name).split(',')[0].replace(/'/g, '') : '';
    Ui.sheet('font', SheetsView.font({ font: name || '', size: sz ? Math.round(px2pt(getComputedStyle(sz).fontSize)) : 11, missing: name && SheetsView.FONTS.indexOf(name) < 0 ? name : '', shown: shown }));
  };

  // ---- colours and the popovers --------------------------------------------------------------------------------------------
  Edit.hidePops = function () { var was = !!pop; if (pop) { pop.remove(); pop = null; } return was; };
  Edit.pop = function (html, anchor, cls) {
    Edit.hidePops();
    var p = document.createElement('div'); p.className = 'pop ' + (cls || ''); p.innerHTML = html; document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8; p.style.left = x + 'px'; p.style.top = y + 'px'; p.dataset.anchor = '1'; pop = p;
    return p;
  };
  document.addEventListener('pointerdown', function (e) { if (pop && !e.target.closest('.pop') && !e.target.closest('[data-act="e-style"],[data-act="e-color"],[data-act="e-hl"],[data-act="g-grip"]')) Edit.hidePops(); }, true);
  // the bar under the A shows the colour of the text at the caret (or of the next typed text, once one is picked there)
  Edit.paintColor = function (col) {
    if (!col) {
      var n = getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n);
      try { col = document.queryCommandValue('foreColor'); } catch (e) { col = ''; }
      if (!col && el) col = getComputedStyle(el).color;
    }
    if (!col) return;
    Array.prototype.forEach.call(document.querySelectorAll('.tl-a i'), function (i) { i.style.background = col; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="e-color"] span[style*="border-bottom"]'), function (i) { i.style.borderBottomColor = col; });
  };
  A['e-color'] = function (el) { Edit.pop(SheetsView.colors(false), el, 'sw'); };
  A['e-hl'] = function (el) { Edit.pop(SheetsView.colors(true), el, 'sw'); };
  A['e-setcolor'] = function (el) { Edit.hidePops(); Edit.cmd('foreColor', C(el.dataset.k)); Edit.paintColor(C(el.dataset.k)); };
  A['e-setbg'] = function (el) { Edit.hidePops(); Edit.cmd('hiliteColor', el.dataset.k ? C(el.dataset.k) : 'transparent'); };

  // ---- links ---------------------------------------------------------------------------------------------------------------------
  A['e-link'] = function () {
    var b = cur(); if (!b) return Ui.toast(t('e.tap'));
    var n = getSelection().anchorNode, a = n && (n.nodeType === 3 ? n.parentElement : n).closest('a.lnk');
    Edit.linkSaved = Doc.range; Ui.sheet('link', SheetsView.link('', a ? a.dataset.href : ''));
    setTimeout(function () { var i = $('lkUrl'); if (i) i.focus(); }, 380);
  };
  function withRange(fn) { var s = getSelection(); if (Edit.linkSaved) { s.removeAllRanges(); s.addRange(Edit.linkSaved); } fn(); }
  A['l-apply'] = function () {
    var url = ($('lkUrl').value || '').trim(); if (!url) return Ui.toast(t('l.bad'));
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    Ui.closeSheet();
    withRange(function () {
      var s = getSelection(); if (s.isCollapsed) { var tx = document.createTextNode(url); s.getRangeAt(0).insertNode(tx); var r = document.createRange(); r.selectNode(tx); s.removeAllRanges(); s.addRange(r); }
      document.execCommand('createLink', false, url);
      Array.prototype.forEach.call(Doc.paper().querySelectorAll('a[href]'), function (a) { a.dataset.href = a.getAttribute('href'); a.className = 'lnk'; a.removeAttribute('href'); });
      mark(); Doc.touch();
    });
  };
  A['l-remove'] = function () { Ui.closeSheet(); withRange(function () { var n = getSelection().anchorNode, a = n && (n.nodeType === 3 ? n.parentElement : n).closest('a.lnk'); if (a) { while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a); a.remove(); } mark(); Doc.touch(); }); };

  // paste is decided in surface-vm.js
})();
