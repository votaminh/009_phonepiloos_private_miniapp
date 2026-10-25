// Inline — writing in a box right on the slide (a computer): double click or Enter opens the box as a field over the slide, the same size and look; letters, bold / italic / underline / strike, colour, size, font and alignment apply to
// the words that are picked, Tab / Shift+Tab change the level, Esc or a click elsewhere keeps the change. The paragraphs and runs go to the engine as one setText op (what a run did not change is left as the file had it).
(function () {
  'use strict';
  var $ = Ui.$, S = window.Stage, I = window.Inline = { on: false }, st = null, saved = null;

  function pxPerPt() { return Deck.w / (Deck.info.size.cx / 12700); }
  function hexOf(c) { var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); if (!m) return null; return '#' + [1, 2, 3].map(function (i) { return ('0' + (+m[i]).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function runCss(r, base) {
    var k = pxPerPt(), size = r.size || base.size || 18, fam = r.family || base.family || Fonts.def, col = r.color || base.color || C('ink');
    return 'font-family:' + Fonts.css(fam) + ';font-size:' + Math.round(size * k * 100) / 100 + 'px;color:' + col + ';font-weight:' + (r.bold ? 700 : 400) + ';font-style:' + (r.italic ? 'italic' : 'normal')
      + ';text-decoration:' + [r.underline ? 'underline' : '', r.strike ? 'line-through' : ''].join(' ').trim() + (r.baseline ? ';vertical-align:' + (r.baseline > 0 ? 'super' : 'sub') + ';font-size:' + Math.round(size * k * 66) / 100 + 'px' : '');
  }
  function html(ps, base) {
    if (!ps.length) return '<div class="pp" data-p="0" data-l="0" data-b="none"><br></div>';
    return ps.map(function (p, pi) {
      var runs = p.runs.length ? p.runs : [{ i: 0, text: '' }];
      return '<div class="pp" data-p="' + pi + '" data-l="' + (p.level || 0) + '" data-b="' + (p.bullet || 'none') + '" style="text-align:' + (p.align || 'left') + ';margin-left:' + (p.level || 0) * 1.1 + 'em">'
        + (runs.every(function (r) { return !r.text; }) ? '<br>' : runs.map(function (r) { return '<span data-i="' + r.i + '" data-ff="' + esc(r.family || '') + '" style="' + runCss(r, base) + '">' + esc(r.text) + '</span>'; }).join('')) + '</div>';
    }).join('');
  }
  function esc(s) { return Ui.esc(s); }
  function tok(css) { return String(css || '').split(',')[0].replace(/["']/g, '').trim(); }
  // the name a font has in the deck, from the first family a span is drawn with
  function nameFor(t) { var f = Fonts.list.filter(function (x) { return x.n.toLowerCase() === t.toLowerCase(); })[0] || Fonts.list.filter(function (x) { return tok(x.css) === t; })[0]; return f ? f.n : t; }

  // ---- open and close --------------------------------------------------------------------------------------------------------------------------
  I.open = async function (n, o) {
    o = o || {}; if (I.on) await I.commit(); if (!n || !n.text && n.type !== 'text' && n.type !== 'shape') return; var r;
    try { r = await Deck.read(n.sourceId); } catch (e) { return; } if (!r.paragraphs) return;
    var m = r.more || {}, ins = m.insets || { l: 91440, t: 45720, r: 91440, b: 45720 }, e2p = Deck.w / Deck.info.size.cx, b = n.box, f = r.font || {};
    var box = document.createElement('div'); box.id = 'inl'; box.className = 'inl'; box.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;transform:rotate(' + (b.rotationDeg || 0) + 'deg);justify-content:' + (r.anchor === 'bottom' ? 'flex-end' : r.anchor === 'middle' ? 'center' : 'flex-start')
      + ';padding:' + [ins.t, ins.r, ins.b, ins.l].map(function (v) { return Math.round(v * e2p * 10) / 10 + 'px'; }).join(' ');
    var ed = document.createElement('div'); ed.className = 'inl-t'; ed.contentEditable = 'true'; ed.spellcheck = true; ed.setAttribute('role', 'textbox'); ed.setAttribute('aria-multiline', 'true');
    ed.style.cssText = 'line-height:' + ((r.lineHeight || 100) / 100 * 1.2) + ';' + (m.wrap === false ? 'white-space:pre' : 'white-space:pre-wrap');
    ed.innerHTML = html(r.paragraphs, { size: f.size, family: f.family, color: f.color }); box.appendChild(ed); $('slideBox').appendChild(box);
    st = { id: n.sourceId, slide: Deck.cur, ps: r.paragraphs, box: box, ed: ed, base: f, text: r.paragraphs.map(function (p) { return p.text; }).join('\n') }; I.on = true; S.g = { inline: true };
    S.endLift(); S.draw(n.sourceId); $('frame').classList.remove('on'); $('stFloat').classList.remove('on');
    document.execCommand('styleWithCSS', false, true); document.execCommand('defaultParagraphSeparator', false, 'div');
    ed.focus(); var sel = window.getSelection(), rg = document.createRange(); rg.selectNodeContents(ed); if (!o.all) rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg);
    ed.addEventListener('keydown', key); ed.addEventListener('paste', paste); ed.addEventListener('input', fixSizes);
    document.addEventListener('pointerdown', away, true); document.addEventListener('selectionchange', track);
    if (window.Desk) Desk.sync();
  };
  function away(e) { if (!I.on) return; if (e.target.closest && e.target.closest('#inl,#dkTools,#quick,#dkMenu,.ctxm,.cpop,#dkStatus,#dkNotes')) return; I.commit(); }
  function track() { var s = window.getSelection(); if (I.on && s.rangeCount && st.ed.contains(s.anchorNode)) { saved = s.getRangeAt(0).cloneRange(); if (window.Desk) Desk.sync(); } }
  function close() {
    document.removeEventListener('pointerdown', away, true); document.removeEventListener('selectionchange', track); if (st && st.box) st.box.remove(); I.on = false; S.g = null; st = null; saved = null;
  }
  I.cancel = function () { if (!I.on) return; close(); S.draw(); S.frame(); };
  I.commit = async function () {
    if (!I.on) return; var d = st, ps = parse(d); close();
    var now = ps.map(function (p) { return p.runs.map(function (r) { return r.text; }).join(''); }).join('\n');
    if (now === d.text && !d.fmt) { S.draw(); S.frame(); return; }
    await Viewer.run([Deck.op('setText', d.id, { paragraphs: ps }, d.slide)], 'busy.edit'); S.select(d.id);
  };

  // ---- the DOM back to paragraphs and runs --------------------------------------------------------------------------------------------------
  function runsOf(node, out) {
    if (node.nodeType === 3) {
      if (!node.nodeValue) return; var el = node.parentElement, cs = getComputedStyle(el), sp = el.closest('[data-i]'), line = (cs.textDecorationLine || '') + ' ' + (cs.textDecoration || '');
      out.push({ text: node.nodeValue.replace(/ /g, ' '), bold: parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === 'bold', italic: cs.fontStyle === 'italic', underline: /underline/.test(line), strike: /line-through/.test(line), color: hexOf(cs.color),
        fontSize: Math.round(parseFloat(cs.fontSize) / pxPerPt() * 2) / 2, famTok: tok(cs.fontFamily), baseline: /super/.test(cs.verticalAlign) ? 30 : /sub/.test(cs.verticalAlign) ? -25 : 0, src: sp ? +sp.dataset.i : -1 });
    } else if (node.nodeType === 1 && node.tagName !== 'BR') Array.prototype.forEach.call(node.childNodes, function (c) { runsOf(c, out); });
  }
  function parse(d) {
    var blocks = [], cur = null; function open(src, align, level) { cur = { src: src, align: align, level: level, raw: [] }; blocks.push(cur); }
    Array.prototype.forEach.call(d.ed.childNodes, function (ch) {
      if (ch.nodeType === 1 && /^(DIV|P)$/.test(ch.tagName)) { open(ch.dataset.p != null ? +ch.dataset.p : (blocks.length ? blocks[blocks.length - 1].src : 0), ch.style.textAlign || 'left', ch.dataset.l != null ? +ch.dataset.l : 0); runsOf(ch, cur.raw); cur = null; }
      else { if (!cur) open(blocks.length ? blocks[blocks.length - 1].src : 0, 'left', 0); runsOf(ch, cur.raw); }
    });
    return blocks.map(function (b) {
      var src = d.ps[Math.min(b.src, d.ps.length - 1)] || { runs: [] }, runs = [];
      b.raw.forEach(function (r) {
        var o = src.runs[r.src] || {}, last = runs[runs.length - 1], e = { text: r.text, srcRun: r.src >= 0 ? r.src : undefined }; ['bold', 'italic', 'underline', 'strike'].forEach(function (k) { if (r[k] || e.srcRun !== undefined) e[k] = r[k]; });
        if (r.fontSize && Math.abs(r.fontSize - (o.size || d.base.size || r.fontSize)) > 0.01) e.fontSize = r.fontSize; if (r.color && r.color !== (o.color || d.base.color || '').toUpperCase() && r.color !== C('ink').toUpperCase()) e.color = r.color;
        if (r.famTok && r.famTok !== tok(Fonts.css(o.family || d.base.family || Fonts.def))) e.fontFamily = nameFor(r.famTok); if ((r.baseline || 0) !== (o.baseline || 0)) e.baseline = r.baseline;
        if (last && ['bold', 'italic', 'underline', 'strike', 'fontSize', 'color', 'fontFamily', 'baseline', 'srcRun'].every(function (k) { return last[k] === e[k]; })) last.text += e.text; else runs.push(e);
      });
      var p = { runs: runs.length ? runs : [{ text: '' }], align: b.align, level: b.level, srcPara: Math.min(b.src, Math.max(0, d.ps.length - 1)) }; return p;
    });
  }

  // ---- keys and paste ------------------------------------------------------------------------------------------------------------------------------
  function key(e) {
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); I.commit(); return; }
    if (e.key === 'Tab') { e.preventDefault(); level(e.shiftKey ? -1 : 1); return; }
    if (mod && k === 'b') { e.preventDefault(); document.execCommand('bold'); } else if (mod && k === 'i') { e.preventDefault(); document.execCommand('italic'); } else if (mod && k === 'u') { e.preventDefault(); document.execCommand('underline'); }
    else if (mod && e.shiftKey && k === 'x') { e.preventDefault(); document.execCommand('strikeThrough'); }
    else if (mod && ['l', 'e', 'r', 'j'].indexOf(k) >= 0) { e.preventDefault(); I.para({ align: { l: 'left', e: 'center', r: 'right', j: 'justify' }[k] }); }
    e.stopPropagation();
  }
  function paste(e) { e.preventDefault(); var tx = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r/g, ''), lines = tx.split('\n'); lines.forEach(function (l, i) { if (i) document.execCommand('insertParagraph'); if (l) document.execCommand('insertText', false, l); }); }
  function blocks() {
    var s = window.getSelection(); if (!s.rangeCount) return []; var rg = s.getRangeAt(0);
    return Array.prototype.filter.call(st.ed.children, function (c) { return rg.intersectsNode(c) || c.contains(s.anchorNode); });
  }
  function level(d) { blocks().forEach(function (b) { var l = Math.max(0, Math.min(8, (+b.dataset.l || 0) + d)); b.dataset.l = l; b.style.marginLeft = l * 1.1 + 'em'; }); st.fmt = true; }

  // ---- formatting the picked words ----------------------------------------------------------------------------------------------------------------
  function restore() { if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); } st.ed.focus(); }
  function fixSizes() {
    Array.prototype.forEach.call(st.ed.querySelectorAll('[style*="xxx-large"],[style*="-webkit-xxx-large"]'), function (s) { s.style.fontSize = st.size + 'px'; });
  }
  I.font = function (p) {
    if (!I.on) return; restore(); var ex = document.execCommand, k = pxPerPt();
    if (p.bold !== undefined) ex.call(document, 'bold'); if (p.italic !== undefined) ex.call(document, 'italic'); if (p.underline !== undefined) ex.call(document, 'underline'); if (p.strike !== undefined) ex.call(document, 'strikeThrough');
    if (p.color) ex.call(document, 'foreColor', false, p.color);
    if (p.fontFamily) ex.call(document, 'fontName', false, p.fontFamily);
    if (p.fontSizePt) { st.size = Math.round(p.fontSizePt * k * 100) / 100; ex.call(document, 'fontSize', false, '7'); fixSizes(); }
    st.fmt = true; track();
  };
  I.para = function (p) { if (!I.on) return; restore(); if (p.align) blocks().forEach(function (b) { b.style.textAlign = p.align; }); if (p.indentDelta) level(p.indentDelta); st.fmt = true; };
  // what the words at the caret look like (the tool bar shows it)
  I.state = function () {
    var s = window.getSelection(), n = s.focusNode && (s.focusNode.nodeType === 3 ? s.focusNode.parentElement : s.focusNode); if (!n || !st || !st.ed.contains(n)) return null;
    var cs = getComputedStyle(n), line = (cs.textDecorationLine || '');
    return { bold: parseInt(cs.fontWeight, 10) >= 600, italic: cs.fontStyle === 'italic', underline: /underline/.test(line), strike: /line-through/.test(line), size: Math.round(parseFloat(cs.fontSize) / pxPerPt() * 2) / 2, color: hexOf(cs.color), family: nameFor(tok(cs.fontFamily)) };
  };
})();
