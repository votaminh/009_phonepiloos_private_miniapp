// McpFmt — the agent tools that format text and paragraphs. Each one puts a selection where the tool says and calls the code the ribbon uses
// (Edit.cmd, the font and size actions, Para.set), so the result is what a person would get and the .docx is written the same way.
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc, A = App.acts;
  if (!M || !D) return;

  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) throw new Error('bad_color:' + c + ' (use RRGGBB)'); return '#' + m[1].toUpperCase(); }
  function cellOf(tb, a) {
    var tr = tb.querySelectorAll('tr')[a.row], td = tr && tr.children[a.col];
    if (!td) throw new Error('no_cell:' + a.row + ',' + a.col + ' (give row and col for a table)');
    return td;
  }
  // select [from, to) characters of a text block, or the whole text of one table cell
  function select(a) {
    var b = D.at(a.index), s = getSelection(), r = document.createRange();
    if (b.classList.contains('tbl')) {
      var td = cellOf(b, a); if (window.Surface) Surface.focus(); r.selectNodeContents(td); s.removeAllRanges(); s.addRange(r); Doc.range = r.cloneRange(); return { b: b, td: td };
    }
    D.at(a.index, 'text');
    var len = D.text(b).length, from = a.from === undefined ? 0 : a.from, to = a.to === undefined ? len : a.to;
    if (from < 0 || to > len || from >= to) throw new Error('bad_range:' + from + '..' + to + ' (block has ' + len + ' characters)');
    Struct.putCaret(b, { a: from, z: to }); return { b: b };
  }
  function toggle(cmd, want) { if (want === undefined) return; var on = false; try { on = document.queryCommandState(cmd); } catch (e) { on = false; } if (on !== !!want) Edit.cmd(cmd); }

  M.tool('doc_format_text', function (a) {
    D.ready(); var t = select(a), n = 0;
    ['bold', 'italic', 'underline'].forEach(function (k) { if (a[k] !== undefined) { toggle(k, a[k]); n++; } });
    if (a.strikethrough !== undefined) { toggle('strikeThrough', a.strikethrough); n++; }
    if (a.superscript !== undefined) { toggle('superscript', a.superscript); n++; }
    if (a.subscript !== undefined) { toggle('subscript', a.subscript); n++; }
    if (a.color) { Edit.cmd('foreColor', hex(a.color)); n++; }
    if (a.highlight) { Edit.cmd('hiliteColor', a.highlight === 'none' ? 'transparent' : hex(a.highlight)); n++; }
    if (a.font) { A['e-setfont']({ dataset: { f: a.font } }); n++; }
    if (a.size) { A['e-setsize']({ dataset: { s: String(a.size) } }); n++; }
    if (!n) throw new Error('nothing_to_apply');
    D.done(t.b); return { summary: 'Formatted block ' + a.index + (a.from === undefined ? '' : ' [' + a.from + '..' + (a.to === undefined ? 'end' : a.to) + ']') + ' (' + n + ' change' + (n > 1 ? 's' : '') + ')', data: null };
  });

  M.tool('doc_clear_format', function (a) {
    D.ready(); var t = select(a); Edit.cmd('removeFormat'); Array.prototype.forEach.call(t.b.querySelectorAll('[data-f]'), function (x) { x.removeAttribute('data-f'); });
    D.done(t.b); return { summary: 'Cleared character formatting of block ' + a.index, data: null };
  });

  M.tool('doc_set_paragraph_format', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), p = {}, tw = function (pt) { return Math.round(pt * 20); };
    if (a.spaceBefore !== undefined) p.sb = tw(a.spaceBefore);
    if (a.spaceAfter !== undefined) p.sa = tw(a.spaceAfter);
    if (a.lineSpacing !== undefined) p.ln = a.lineSpacing;
    if (a.indentLeft !== undefined) p.il = tw(a.indentLeft);
    if (a.indentRight !== undefined) p.ir = tw(a.indentRight);
    if (a.firstLine !== undefined) p.fi = tw(a.firstLine);
    if (a.keepWithNext !== undefined) p.kn = !!a.keepWithNext;
    if (a.pageBreakBefore !== undefined) p.pb = !!a.pageBreakBefore;
    if (a.align !== undefined) p.al = a.align;
    if (!Object.keys(p).length) throw new Error('nothing_to_apply');
    Para.set(p, [b]); return { summary: 'Paragraph ' + a.index + ' updated: ' + Object.keys(a).filter(function (k) { return k !== 'index'; }).join(', '), data: null };
  });

  M.tool('doc_indent_paragraph', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), n = Math.abs(a.levels || 1), k;
    D.caretIn(b, true); for (k = 0; k < n; k++) A[a.levels < 0 ? 'e-outdent' : 'e-indent']();
    return { summary: 'Indented block ' + a.index + ' by ' + (a.levels || 1) + ' level(s)', data: null };
  });

  M.tool('doc_set_link', function (a) {
    D.ready(); var t = select(a), url = String(a.url || '').trim(); if (!url) throw new Error('missing_url');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    document.execCommand('createLink', false, url);
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('a[href]'), function (x) { x.dataset.href = x.getAttribute('href'); x.className = 'lnk'; x.removeAttribute('href'); });
    t.b.dataset.m = '1'; Doc.touch(); D.done(t.b); return { summary: 'Linked block ' + a.index + ' to ' + url, data: null };
  });

  M.tool('doc_remove_link', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), links = b.querySelectorAll('a.lnk'), n = links.length;
    Array.prototype.forEach.call(links, function (x) { while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x); x.remove(); });
    b.dataset.m = '1'; D.done(b); return { summary: n ? 'Removed ' + n + ' link(s) from block ' + a.index : 'No link in block ' + a.index, data: null };
  });

  M.tool('doc_add_comment', function (a) {
    D.ready(); var b = D.at(a.index, 'text'); if (a.from !== undefined || a.to !== undefined) select(a); else D.caretIn(b, true);
    A['rv-new'](); var i = document.getElementById('cmText'); if (!i) throw new Error('comment_dialog_missing'); i.value = a.text; A['rv-add']();
    return { summary: 'Added a comment to block ' + a.index, data: null };
  });
})();
