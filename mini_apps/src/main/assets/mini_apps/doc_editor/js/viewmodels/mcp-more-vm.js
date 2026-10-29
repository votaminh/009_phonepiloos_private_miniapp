// McpMore — agent tools for pictures, lists, footnotes, bookmarks, comments and tracked changes. Each one fills in the same dialog or calls the same action the buttons use.
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc, A = App.acts, $ = function (id) { return document.getElementById(id); };
  if (!M || !D) return;

  function closeSheets() { try { Ui.closeSheet(); } catch (e) { /* none open */ } }
  function pic(i) {
    var b = D.at(i); if (!b.classList.contains('imgp')) throw new Error('block ' + i + ' is not a picture (it is a ' + D.kind(b) + ')');
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('.b.imgp.sel'), function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); return b;
  }

  // ---- pictures -------------------------------------------------------------------------------------------------------------------
  M.tool('doc_picture_resize', function (a) { D.ready(); var b = pic(a.index); A['pic-size']({ dataset: { p: String(a.percent) } }); b.classList.remove('sel'); return { summary: 'Picture ' + a.index + ' set to ' + a.percent + '% of its size', data: null }; });
  M.tool('doc_picture_align', function (a) { D.ready(); var b = pic(a.index); A['pic-al']({ dataset: { a: a.align } }); b.classList.remove('sel'); return { summary: 'Picture ' + a.index + ' aligned ' + a.align, data: null }; });
  M.tool('doc_picture_rotate', function (a) { D.ready(); var b = pic(a.index); A['pic-rot']({ dataset: { d: String(a.degrees || 90) } }); b.classList.remove('sel'); return { summary: 'Picture ' + a.index + ' rotated by ' + (a.degrees || 90) + ' degrees', data: null }; });
  M.tool('doc_picture_delete', function (a) { D.ready(); pic(a.index); A['pic-del'](); return { summary: 'Deleted picture ' + a.index, data: null }; });

  // ---- lists ----------------------------------------------------------------------------------------------------------------------
  M.tool('doc_list_formats', function () {
    var l = (window.Lists && Lists.presets || []).map(function (p) { return { id: p.id, kind: p.kind, sample: Lists.label(p.id, p.kind, 0, [1, 1, 1, 1]) + ' ' + Lists.label(p.id, p.kind, 1, [1, 1]) }; });
    return { summary: l.length + ' list formats', data: { formats: l } };
  });
  function inList(i) { var b = D.at(i, 'text'); if (!b.classList.contains('li')) throw new Error('block ' + i + ' is not a list item'); D.caretIn(b, true); return b; }
  M.tool('doc_list_set_format', function (a) {
    D.ready(); var b = D.at(a.index, 'text'); D.caretIn(b, true);
    if (!(window.Lists && Lists.get(a.format))) throw new Error('unknown_format:' + a.format + ' (see doc_list_formats)');
    A['ls-set']({ dataset: { id: a.format } }); return { summary: 'Block ' + a.index + ' and its list now use ' + a.format, data: null };
  });
  M.tool('doc_list_restart', function (a) { D.ready(); inList(a.index); A['ls-restart'](); return { summary: 'Numbering restarts at 1 from block ' + a.index, data: null }; });
  M.tool('doc_list_continue', function (a) { D.ready(); inList(a.index); A['ls-continue'](); return { summary: 'The list at block ' + a.index + ' continues the one before it', data: null }; });

  // ---- footnotes ------------------------------------------------------------------------------------------------------------------
  function notes() { return Doc.notes.map(function (n) { return { id: String(n.id), text: Doc.noteEdits[n.id] !== undefined ? Doc.noteEdits[n.id] : n.text }; }).concat(Doc.newNotes.map(function (n) { return { id: String(n.id), text: n.text }; })); }
  M.tool('doc_add_footnote', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), len = D.text(b).length, at = a.offset === undefined ? len : Math.min(a.offset, len);
    Struct.putCaret(b, { a: at, z: at }); A['rf-fn'](); if (!$('fnText')) throw new Error('footnote_dialog_missing'); $('fnText').value = a.text; A['rf-fnadd']();
    return { summary: 'Footnote added to block ' + a.index, data: { notes: notes().length } };
  });
  M.tool('doc_list_footnotes', function () { var l = notes(); return { summary: l.length + ' footnote(s)', data: { footnotes: l } }; });
  M.tool('doc_edit_footnote', function (a) {
    D.ready(); var id = String(a.id), old = Doc.notes.some(function (n) { return String(n.id) === id; });
    if (!old && !Doc.newNotes.some(function (n) { return String(n.id) === id; })) throw new Error('no_footnote:' + id);
    if (old) Doc.noteEdits[id] = a.text; else Doc.newNotes.forEach(function (n) { if (String(n.id) === id) n.text = a.text; });
    Doc.dirty = true; Doc.touch(); return { summary: 'Footnote ' + id + ' updated', data: null };
  });

  // ---- bookmarks ------------------------------------------------------------------------------------------------------------------
  function bookmarks() { var out = []; D.blocks().forEach(function (b, i) { (b.dataset.bm || '').split(',').filter(Boolean).forEach(function (n) { out.push({ name: n, index: i }); }); }); return out; }
  M.tool('doc_add_bookmark', function (a) {
    D.ready(); var b = D.at(a.index, 'text'); D.caretIn(b, true); A['bm-open'](); if (!$('bmName')) throw new Error('bookmark_dialog_missing'); $('bmName').value = a.name; A['bm-add'](); closeSheets();
    if (!bookmarks().some(function (x) { return x.name === a.name; })) throw new Error('bookmark_not_added: use letters, digits and _ (start with a letter), no duplicates');
    return { summary: 'Bookmark ' + a.name + ' set on block ' + a.index, data: null };
  });
  M.tool('doc_list_bookmarks', function () { var l = bookmarks(); return { summary: l.length + ' bookmark(s)', data: { bookmarks: l } }; });
  M.tool('doc_remove_bookmark', function (a) { D.ready(); D.caretIn(D.blocks().filter(function (b) { return b.classList.contains('ed'); })[0], false); A['bm-del']({ dataset: { n: a.name } }); closeSheets(); return { summary: 'Bookmark ' + a.name + ' removed', data: null }; });

  // ---- comments and tracked changes -----------------------------------------------------------------------------------------------
  function comments() { return Doc.comments.concat(Doc.newComments).map(function (c) { return { id: String(c.id), author: c.author || '', text: c.text, reply_to: c.parentId ? String(c.parentId) : null, resolved: Doc.resolve.indexOf(String(c.id)) >= 0 }; }); }
  function comment(id) { if (!comments().some(function (c) { return c.id === String(id); })) throw new Error('no_comment:' + id + ' (see doc_list_comments)'); }
  M.tool('doc_list_comments', function () { var l = comments(); return { summary: l.length + ' comment(s)', data: { comments: l } }; });
  M.tool('doc_reply_comment', function (a) { D.ready(); comment(a.id); A['rv-reply']({ dataset: { id: String(a.id) } }); if (!$('cmReplyText')) throw new Error('reply_dialog_missing'); $('cmReplyText').value = a.text; A['rv-replygo'](); closeSheets(); return { summary: 'Replied to comment ' + a.id, data: null }; });
  M.tool('doc_resolve_comment', function (a) {
    D.ready(); comment(a.id); var on = Doc.resolve.indexOf(String(a.id)) >= 0, want = a.resolved !== false;
    if (on !== want) A['rv-resolve']({ dataset: { id: String(a.id) } }); closeSheets(); return { summary: 'Comment ' + a.id + (want ? ' resolved' : ' reopened'), data: null };
  });
  M.tool('doc_delete_comment', function (a) { D.ready(); comment(a.id); A['rv-delcm']({ dataset: { id: String(a.id) } }); closeSheets(); return { summary: 'Comment ' + a.id + ' deleted', data: null }; });
  M.tool('doc_review_changes', function (a) { D.ready(); A['rv-revall']({ dataset: { a: a.action } }); closeSheets(); return { summary: 'All tracked changes will be ' + (a.action === 'accept' ? 'accepted' : 'rejected') + ' when the file is saved', data: null }; });
})();
