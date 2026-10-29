// McpVm — the tools an agent can call in Piloos Doc (declared in manifest.json "mcp.tools"). Each one drives the same code the buttons use:
// it puts the caret where the tool says, then calls Struct / Edit / Table / Insert, so undo, autosave and saving to .docx all behave as for a person.
(function () {
  'use strict';
  var A = App.acts, M = window.PiloMcp;
  if (!M) return;

  function blocks() { return Array.prototype.filter.call(Doc.paper().children, function (c) { return c.classList.contains('b') && !c.hidden; }); }
  function kind(b) {
    if (b.classList.contains('tbl')) return 'table';
    if (b.classList.contains('lk')) return b.querySelector('img') ? 'picture' : 'object';
    if (b.dataset.t === 'h') return 'heading' + (b.dataset.lv || 1);
    if (b.dataset.t === 'l') return b.dataset.k === 'ordered' ? 'numbered' : 'bullet';
    return 'paragraph';
  }
  function text(b) { return b.textContent.replace(/ /g, ' '); }
  function at(i, want) {
    var list = blocks(), b = list[i];
    if (!b) throw new Error('no_block:' + i + ' (document has ' + list.length + ' blocks, index starts at 0)');
    if (want === 'table' && !b.classList.contains('tbl')) throw new Error('block ' + i + ' is not a table');
    if (want === 'text' && !b.classList.contains('ed')) throw new Error('block ' + i + ' is not editable text (it is a ' + kind(b) + ')');
    return b;
  }
  function caretIn(b, end) { if (window.Surface) Surface.focus(); Struct.putCaret(b, end ? { a: text(b).length, z: text(b).length } : { a: 0, z: 0 }); }
  // where a block inserted "after" block i goes: after a text block the caret sits at its end; after a picture or a table Doc's own range is put on that block
  function anchorAfter(i) {
    var b = at(i); if (b.classList.contains('ed')) return caretIn(b, true);
    var r = document.createRange(); r.selectNodeContents(b); Doc.range = r;
  }
  function ready() { if (Doc.mode !== 'edit') throw new Error('document_not_open_for_editing: call doc_new_document first'); }
  // "h1".."h6", "normal", "bullet", "numbered" on the block the caret is in
  function style(b, s) {
    caretIn(b, true);
    var h = /^h([1-6])$/.exec(s);
    if (h) Struct.setStyle(+h[1]);
    else if (s === 'normal') Struct.setStyle(0);
    else if (s === 'bullet') { if (b.dataset.t !== 'l' || b.dataset.k !== 'bullet') A['e-bul'](); }
    else if (s === 'numbered') { if (b.dataset.t !== 'l' || b.dataset.k !== 'ordered') A['e-num'](); }
    return Edit.block() || b;
  }
  function done(b) { Doc.snap(); Edit.sync(); return b; }
  function row(b, i) { var o = { index: i, type: kind(b), text: text(b).slice(0, 120) }; if (b.classList.contains('tbl')) { o.rows = b.querySelectorAll('tr').length; o.cols = b.querySelector('tr') ? b.querySelector('tr').children.length : 0; } return o; }

  // shared with the other mcp-*-vm.js files
  window.McpDoc = { anchorAfter: anchorAfter, blocks: blocks, kind: kind, text: text, at: at, caretIn: caretIn, ready: ready, done: done, style: style };

  M.tool('doc_read_outline', function (a) {
    var list = blocks(), from = a.from || 0, to = Math.min(list.length, a.to === undefined ? from + 40 : a.to + 1);
    return { summary: list.length + ' blocks, showing ' + from + '..' + (to - 1), data: { total: list.length, blocks: list.slice(from, to).map(function (b, k) { return row(b, from + k); }) } };
  });

  M.tool('doc_read_block', function (a) {
    var b = at(a.index);
    if (kind(b) === 'table') {
      var cells = Array.prototype.map.call(b.querySelectorAll('tr'), function (tr) { return Array.prototype.map.call(tr.children, text); });
      return { summary: 'Table ' + cells.length + 'x' + (cells[0] || []).length, data: { type: 'table', cells: cells } };
    }
    return { summary: kind(b) + ', ' + text(b).length + ' characters', data: { type: kind(b), text: text(b) } };
  });

  M.tool('doc_insert_paragraph', function (a) {
    ready();
    var list = blocks(), after = a.after === undefined ? list[list.length - 1] : at(a.after), like = after && after.classList.contains('ed') ? after : { dataset: {} };
    var p = Struct.fresh(like, 'p'); p.dataset.t = 'p'; p.textContent = a.text || ''; if (!a.text) p.innerHTML = '<br data-ph>';
    if (after) after.after(p); else Doc.paper().appendChild(p);
    if (a.style && a.style !== 'normal') p = style(p, a.style);
    done(p);
    return { summary: 'Inserted a ' + kind(p) + ' at index ' + blocks().indexOf(p), data: { index: blocks().indexOf(p) } };
  });

  M.tool('doc_set_paragraph_style', function (a) {
    ready(); var b = at(a.index, 'text'); b = style(b, a.style); done(b);
    return { summary: 'Block ' + a.index + ' is now ' + kind(b), data: null };
  });

  M.tool('doc_set_paragraph_text', function (a) {
    ready(); var b = at(a.index, 'text');
    Edit.mark(); b.textContent = a.text; if (!a.text) b.innerHTML = '<br data-ph>'; b.dataset.m = '1'; done(b);
    return { summary: 'Replaced the text of block ' + a.index + ' (character formatting inside it was reset)', data: null };
  });

  M.tool('doc_align_paragraph', function (a) {
    ready(); var b = at(a.index, 'text');
    Edit.mark(); a.align === 'left' ? b.removeAttribute('data-al') : b.dataset.al = a.align; b.dataset.m = '1'; done(b);
    return { summary: 'Block ' + a.index + ' aligned ' + a.align, data: null };
  });

  M.tool('doc_replace_text', function (a) {
    ready(); var n = 0, w = document.createTreeWalker(Doc.paper(), NodeFilter.SHOW_TEXT), t, hit = [];
    while ((t = w.nextNode())) { if (t.nodeValue.indexOf(a.find) >= 0 && t.parentNode.closest('.b.ed')) hit.push(t); }
    hit.forEach(function (t) {
      var parts = t.nodeValue.split(a.find); if (a.all === false) parts = [parts[0], parts.slice(1).join(a.find)];
      n += parts.length - 1; t.nodeValue = parts.join(a.replace); t.parentNode.closest('.b').dataset.m = '1';
    });
    if (n) { Edit.mark(); done(); }
    return { summary: n ? 'Replaced ' + n + ' match(es) (text inside one run of formatting only)' : 'No match', data: { replaced: n } };
  });

  M.tool('doc_insert_table', async function (a) {
    ready();
    if (a.cells && (!Array.isArray(a.cells) || a.cells.some(function (r) { return !Array.isArray(r); }))) throw new Error('cells_must_be_rows: pass cells as an array of rows, each row an array of strings, for example [["Date","Day"],["2 Nov","Mon"]]');
    if (a.after !== undefined) anchorAfter(a.after);
    var before = blocks();
    A['i-tsize']({ dataset: { r: a.rows, c: a.cols } });
    await A['i-tins']();
    var tb = blocks().filter(function (b) { return b.classList.contains('tbl') && before.indexOf(b) < 0; }).pop();
    if (!tb) throw new Error('table_not_created');
    if (a.cells) Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr, r) { Array.prototype.forEach.call(tr.children, function (td, c) { var v = a.cells[r] && a.cells[r][c]; if (v !== undefined && v !== null) { td.textContent = String(v); td.dataset.m = '1'; } }); });
    tb.dataset.m = '1'; done(tb);
    return { summary: 'Inserted a ' + a.rows + 'x' + a.cols + ' table at index ' + blocks().indexOf(tb), data: { index: blocks().indexOf(tb) } };
  });

  M.tool('doc_set_cell', function (a) {
    ready(); var tb = at(a.table, 'table'), tr = tb.querySelectorAll('tr')[a.row], td = tr && tr.children[a.col];
    if (!td) throw new Error('no_cell:' + a.row + ',' + a.col);
    td.textContent = a.text; if (!a.text) td.innerHTML = '<br data-ph>'; td.dataset.m = '1'; tb.dataset.m = '1'; Edit.mark(); done(tb);
    return { summary: 'Cell (' + a.row + ',' + a.col + ') set', data: null };
  });

  M.tool('doc_delete_block', function (a) {
    ready(); var b = at(a.index); var k = kind(b); Edit.mark(); b.remove(); done();
    return { summary: 'Deleted the ' + k + ' at index ' + a.index, data: null };
  });

  M.tool('doc_new_document', async function () {
    if (Doc.mode !== 'edit') { await A['h-new'](); await new Promise(function (r) { setTimeout(r, 900); }); }
    if (Doc.mode !== 'edit') throw new Error('could_not_open_new_document');
    return { summary: 'A new empty document is open for editing', data: null };
  });

  M.tool('doc_save_draft', async function () {
    await Doc.draftNow(); return { summary: 'Draft saved', data: null };
  });
})();
