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
    var td = window.Table && Table.cell(); if (td) { td.dataset.m = '1'; td.closest('.b.tbl').dataset.m = '1'; }   // the cell the caret is in, and its table (only marked cells are written back)
  }
  Edit.mark = mark;
  // with a block of table cells selected (no text selection of the browser) the look is given to each cell in turn
  var cellsBusy = false;
  function onCells(fn) {
    var sel = window.Table && Table.selection(); if (!sel || cellsBusy) return false;
    cellsBusy = true;
    try {
      var s = getSelection(); Table.h.cellsOf(sel).forEach(function (td) { if (td.hidden) return; var r = document.createRange(); r.selectNodeContents(td); s.removeAllRanges(); s.addRange(r); fn(); td.dataset.m = '1'; });
      sel.b.dataset.m = '1'; s.removeAllRanges();
    } finally { cellsBusy = false; }
    Doc.touch(); Edit.sync(); return true;
  }
  Edit.onCells = onCells;
  Edit.cmd = function (name, arg, whole) {
    if (onCells(function () { Edit.cmd(name, arg); })) return true;
    var b = cur() || Table.cell(); if (!b) { Ui.toast(t('e.tap')); return false; }
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
    var b = cur(), cellB = !b && Table.cell(), body = $('tlBody'); if ((!b && !cellB) || Doc.mode !== 'edit') return;
    // the phone has no tool body (its bar is the dock): the block actions and the quick bar of a selection still follow the caret, and a picked picture is let go
    Edit.paintColor(); Edit.paintHl();
    var n = getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), f = el && el.closest('[data-f]'), sz = el && el.closest('[style*="font-size"]');
    var live = Edit.pendLive(), chip = $('tlFont'); if (chip) chip.textContent = ((live && live.font) || (f && f.dataset.f) || t('f.default')) + ' · ' + ((live && live.size) || (sz ? Math.round(px2pt(getComputedStyle(sz).fontSize)) : 11));
    if (!body) { if (b && typeof Struct !== 'undefined') Struct.follow(b); return; }
    function on(act, v) { var x = body.querySelector('[data-act="' + act + '"]'); if (x) { x.classList.toggle('on', !!v); x.setAttribute('aria-pressed', !!v); } }
    var q = function (c) { try { return document.queryCommandState(c); } catch (e) { return false; } };
    on('e-bold', q('bold')); on('e-italic', q('italic')); on('e-underline', q('underline')); on('e-strike', q('strikeThrough'));
    var al = b ? (b.dataset.al || 'left') : (cellB.style.textAlign || 'left'); ['left', 'center', 'right', 'justify'].forEach(function (a) { on('e-al-' + a, al === a); });
    if (!b) return;   // in a cell: no list, style or paragraph block
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
    if (p.clear) {   // the browser copies the old span (data-f included) around the plain text: the name must not outlive its font
      var n = getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), f = el && el.closest('[data-f]'), b = el && el.closest('#paper .b');
      if (f && b && getComputedStyle(f).fontFamily.split(',')[0] !== Render.family(f.dataset.f).split(',')[0]) f.removeAttribute('data-f');
    }
  }, true);
  function resize(delta, to) {
    if (onCells(function () { resize(delta, to); })) return;
    var b = cur() || Table.cell(); if (!b) return Ui.toast(t('e.tap'));
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
  // Return at the end of formatted text: the new paragraph carries on with the same look (colour, font, size, bold...), as in a word processor.
  // Takes the look at the caret now; the returned function arms it as the typing style of the new, empty paragraph. Nothing to carry: null.
  Edit.carry = function () {
    var b = cur(), s = getSelection(); if (!b || !s.isCollapsed || b.dataset.t === 'h') return null;
    var n = s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n); if (!el) return null;
    var cs = getComputedStyle(el), bs = getComputedStyle(b), f = el.closest('[data-f]'), sz = el.closest('[style*="font-size"]');
    var q = function (c) { try { return document.queryCommandState(c); } catch (e) { return false; } };
    var hl = ''; try { hl = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor'); } catch (e) { hl = ''; }
    if (/^(rgba\(0, 0, 0, 0\)|transparent|)$/.test(hl) || hl === bs.backgroundColor) hl = '';
    var live = Edit.pendLive(), col = ''; try { col = document.queryCommandValue('foreColor') || cs.color; } catch (e) { col = cs.color; }   // typing-aware: a second Return in a row has nothing in the DOM yet to read
    var spec = { color: col !== bs.color ? col : '', font: (live && live.font) || (f ? f.dataset.f : ''), size: (live && live.size) || (sz && sz !== b && b.contains(sz) ? px2pt(cs.fontSize) : 0), st: ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript'].filter(q), hl: hl };
    if (!spec.color && !spec.font && !spec.size && !spec.st.length && !spec.hl) return null;
    return function () {
      if (!cur()) return;
      if (spec.color) { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, spec.color); }
      if (spec.font) A['e-setfont']({ dataset: { f: spec.font } });
      if (spec.size) resize(0, spec.size);
      if (spec.hl) { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, spec.hl); }
      spec.st.forEach(function (c) { document.execCommand(c); });
      Edit.sync();
    };
  };
  A['e-smaller'] = function () { resize(-1); }; A['e-larger'] = function () { resize(1); };
  A['e-setsize'] = function (el) { resize(0, +el.dataset.s); Array.prototype.forEach.call(document.querySelectorAll('.fo-sz'), function (b) { b.classList.toggle('on', b === el); }); };
  A['e-setfont'] = function (el) {
    if (onCells(function () { A['e-setfont'](el); })) return;
    var b = cur() || Table.cell(); if (!b) return Ui.toast(t('e.tap'));
    var collapsed = getSelection().isCollapsed, live = Edit.pendLive();
    if (!collapsed) Edit.pend = null;
    document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, 'PiloFont');
    fixFonts(el.dataset.f);
    if (collapsed) Edit.pend = { at: pendAt(), font: el.dataset.f, size: live && live.size };
    if (!collapsed) { mark(); Doc.touch(); }
    Edit.sync(); Array.prototype.forEach.call(document.querySelectorAll('.fo-it'), function (x) { x.classList.toggle('on', x === el); });
  };
  A['e-sup'] = function () { Edit.cmd('superscript'); }; A['e-sub'] = function () { Edit.cmd('subscript'); };
  // Clear formatting at a bare caret: the text already there is left alone; what is typed next is plain (it may sit inside coloured, bold... text, so each look is switched off on purpose).
  function clearTyping(b) {
    var s = getSelection(), r = s.getRangeAt(0).cloneRange(); Edit.pend = null; s.removeAllRanges(); s.addRange(r);   // drops a typing style armed here
    var n = s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n); if (!el) return;
    var cs = getComputedStyle(el), bs = getComputedStyle(b), f = el.closest('[data-f]'), sz = el.closest('[style*="font-size"]');
    var q = function (c) { try { return document.queryCommandState(c); } catch (e) { return false; } };
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, 'initial');   // 'transparent' would stay inside the highlighted span; 'initial' makes the next text step out of it, with no style of its own
    ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript'].forEach(function (c) { if (q(c)) document.execCommand(c); });
    if (cs.color !== bs.color) document.execCommand('foreColor', false, bs.color);
    if (f) document.execCommand('fontName', false, bs.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
    if (sz && sz !== b && b.contains(sz)) resize(0, px2pt(bs.fontSize));
    Edit.pend = Object.assign(Edit.pend || { at: pendAt() }, { clear: true });   // on the first typed character the stale font name is dropped (see the input listener)
    Edit.sync();
  }
  A['e-clear'] = function () { if (onCells(function () { A['e-clear'](); })) return; var b = cur() || Table.cell(); if (!b) return Ui.toast(t('e.tap')); if (getSelection().isCollapsed) return clearTyping(b); Edit.cmd('removeFormat'); Array.prototype.forEach.call(b.querySelectorAll('[data-f]'), function (n) { n.removeAttribute('data-f'); }); };
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
  // the bar under the marker shows the highlight at the caret (none = no bar)
  Edit.paintHl = function (col) {
    if (col === undefined) { try { col = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor'); } catch (e) { col = ''; } }
    if (/^(rgba\(0, 0, 0, 0\)|transparent|initial|)$/.test(col || '')) col = '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="e-hl"]'), function (b) { if (col) b.style.setProperty('--hl', col); else b.style.removeProperty('--hl'); });
  };
  A['e-color'] = function (el) { Edit.pop(SheetsView.colors(false), el, 'sw'); };
  A['e-hl'] = function (el) { Edit.pop(SheetsView.colors(true), el, 'sw'); };
  A['e-setcolor'] = function (el) { Edit.hidePops(); Edit.cmd('foreColor', C(el.dataset.k)); Edit.paintColor(C(el.dataset.k)); };
  A['e-setbg'] = function (el) { Edit.hidePops(); Edit.cmd('hiliteColor', el.dataset.k ? C(el.dataset.k) : getSelection().isCollapsed ? 'initial' : 'transparent'); Edit.paintHl(el.dataset.k ? C(el.dataset.k) : ''); };

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
