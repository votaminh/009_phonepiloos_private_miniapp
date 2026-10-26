// Review — comments, footnotes and tracked changes.
// A new comment sits on the selected text (a span, data-cm) or, with nothing selected, on the whole paragraph; a new footnote is a superscript mark in the text (data-fn) with its text kept in Doc.newNotes; both are written by the engine on save.
// Changes already in the file can be accepted or rejected one by one or all together; the decision is applied on save.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, V = window.Review = {};
  function max(list) { return list.reduce(function (m, x) { var n = parseInt(x.id, 10); return isFinite(n) && n > m ? n : m; }, 0); }
  function mark() { Doc.dirty = true; Doc.touch(); Doc.chrome(); }
  function when(d) { try { return d ? new Date(d).toLocaleDateString(I18n.locale()) : ''; } catch (e) { return ''; } }
  function card(h, body, foot) { return '<h2 class="sh-h">' + esc(h) + '</h2><div class="rv-list">' + body + '</div><div class="btns">' + foot + '</div>'; }
  function doneBtn() { return '<button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button>'; }

  // ---- comments ------------------------------------------------------------------------------------------------------------------
  A['rv-new'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var b = Edit.block(); if (!b) return Ui.toast(t('e.tap')); V.at = b;
    var sl = getSelection(); V.sel = sl.rangeCount && !sl.isCollapsed && b.contains(sl.getRangeAt(0).startContainer) && b.contains(sl.getRangeAt(0).endContainer) ? sl.getRangeAt(0).cloneRange() : null;
    Ui.sheet('cmnew', '<h2 class="sh-h">' + esc(t('cm.new')) + '</h2><div class="pa-f hf-f"><input id="cmText" type="text" placeholder="' + esc(t('cm.ph')) + '" autocomplete="off"></div><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rv-add">' + esc(t('cm.add')) + '</button></div>');
    setTimeout(function () { var i = $('cmText'); if (i) i.focus(); }, 300);
  };
  A['rv-add'] = function () {
    var tx = ($('cmText').value || '').trim(), b = V.at; if (!tx || !b) return; Ui.closeSheet();
    var id = String(Math.max(max(Doc.comments), max(Doc.newComments)) + 1); Doc.newComments.push({ id: id, author: t('cm.me'), initials: '', date: new Date().toISOString(), text: tx });
    if (V.sel) { var sp = document.createElement('span'); sp.className = 'cmr'; sp.dataset.cm = id; sp.appendChild(V.sel.extractContents()); V.sel.insertNode(sp); V.sel = null; }
    else b.dataset.cm = (b.dataset.cm ? b.dataset.cm + ',' : '') + id;
    b.dataset.m = '1'; mark(); Ui.toast(t('cm.added'));
  };
  A['rv-comments'] = function () {
    var flat = Doc.comments.map(function (c) { return Object.assign({ old: true }, c); }).concat(Doc.newComments), all = [];
    flat.forEach(function (c) { if (!c.parentId) { all.push(c); flat.forEach(function (r) { if (String(r.parentId) === String(c.id)) all.push(r); }); } });
    flat.forEach(function (c) { if (c.parentId && all.indexOf(c) < 0) all.push(c); });
    var body = all.length ? all.map(function (c) {
      var res = c.old ? (Doc.resolve.indexOf(c.id) >= 0 ? !c.done : !!c.done) : false;
      return '<div class="rv-c' + (c.parentId ? ' re' : '') + (res ? ' dn' : '') + '"><div class="rv-h"><b>' + esc(c.author || '') + '</b><span>' + esc(when(c.date)) + '</span></div><p>' + esc(c.text) + '</p>'
        + (Doc.mode === 'edit' ? '<button type="button" class="rv-b" data-act="rv-reply" data-id="' + esc(c.id) + '">' + esc(t('cm.reply')) + '</button>' : '')
        + (c.old ? '<button type="button" class="rv-b" data-act="rv-resolve" data-id="' + esc(c.id) + '">' + esc(t(res ? 'cm.reopen' : 'cm.resolve')) + '</button>' : '<button type="button" class="rv-b" data-act="rv-delcm" data-id="' + esc(c.id) + '">' + esc(t('cm.delete')) + '</button>') + '</div>';
    }).join('') : '<p class="rv-none">' + esc(t('cm.none')) + '</p>';
    Ui.sheet('cmlist', card(t('cm.title'), body, doneBtn()));
  };
  // a reply sits on the same words as the comment it answers (Word keeps a thread flat: the reply of a reply answers the first comment)
  A['rv-reply'] = function (el) {
    var all = Doc.comments.concat(Doc.newComments), c = all.filter(function (x) { return String(x.id) === el.dataset.id; })[0]; if (!c) return;
    V.root = String(c.parentId || c.id);
    Ui.sheet('cmreply', '<h2 class="sh-h">' + esc(t('cm.reply')) + '</h2><p class="rv-q">' + esc(c.text) + '</p><div class="pa-f hf-f"><input id="cmReplyText" type="text" placeholder="' + esc(t('cm.ph')) + '" autocomplete="off"></div><div class="btns"><button type="button" class="btn light" data-act="rv-comments">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rv-replygo">' + esc(t('cm.reply')) + '</button></div>');
    setTimeout(function () { var i = $('cmReplyText'); if (i) i.focus(); }, 300);
  };
  A['rv-replygo'] = function () {
    var tx = ($('cmReplyText').value || '').trim(); if (!tx) return;
    var id = String(Math.max(max(Doc.comments), max(Doc.newComments)) + 1), hits = 0;
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('[data-cm]'), function (e) {
      if (e.dataset.cm.split(',').indexOf(V.root) < 0) return; e.dataset.cm += ',' + id; hits++;
      var b = e.closest('.b'); if (b) b.dataset.m = '1';
    });
    if (!hits) { Ui.toast(t('cm.noanchor')); return A['rv-comments'](); }
    Doc.newComments.push({ id: id, author: t('cm.me'), initials: '', date: new Date().toISOString(), text: tx, parentId: V.root }); mark(); A['rv-comments']();
  };
  A['rv-resolve'] = function (el) { var i = Doc.resolve.indexOf(el.dataset.id); if (i >= 0) Doc.resolve.splice(i, 1); else Doc.resolve.push(el.dataset.id); mark(); A['rv-comments'](); };
  A['rv-delcm'] = function (el) {
    var id = el.dataset.id, gone = [id]; Doc.newComments.forEach(function (c) { if (String(c.parentId) === id) gone.push(String(c.id)); });
    Doc.newComments = Doc.newComments.filter(function (c) { return gone.indexOf(String(c.id)) < 0; });
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('span.cmr[data-cm]'), function (sp) {
      var l = sp.dataset.cm.split(',').filter(function (x) { return x && gone.indexOf(x) < 0; }); if (l.length) { sp.dataset.cm = l.join(','); return; }
      var par = sp.parentNode; while (sp.firstChild) par.insertBefore(sp.firstChild, sp); par.removeChild(sp); var bb = par.closest && par.closest('.b'); if (bb) bb.dataset.m = '1';
    });
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('.b[data-cm]'), function (b) { var l = b.dataset.cm.split(',').filter(function (x) { return x && gone.indexOf(x) < 0; }); if (l.length) b.dataset.cm = l.join(','); else b.removeAttribute('data-cm'); b.dataset.m = '1'; });
    mark(); A['rv-comments']();
  };

  // ---- footnotes -----------------------------------------------------------------------------------------------------------------
  A['rf-fn'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var b = Edit.block(), s = getSelection(); if (!b || !s.rangeCount) return Ui.toast(t('e.tap')); V.range = s.getRangeAt(0).cloneRange(); V.at = b;
    Ui.sheet('fnnew', '<h2 class="sh-h">' + esc(t('fn.new')) + '</h2><div class="pa-f hf-f"><input id="fnText" type="text" placeholder="' + esc(t('fn.ph')) + '" autocomplete="off"></div><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rf-fnadd">' + esc(t('cm.add')) + '</button></div>');
    setTimeout(function () { var i = $('fnText'); if (i) i.focus(); }, 300);
  };
  A['rf-fnadd'] = function () {
    var tx = ($('fnText').value || '').trim(), b = V.at, r = V.range; if (!tx || !b || !r) return; Ui.closeSheet();
    var id = String(Math.max(max(Doc.notes), max(Doc.newNotes), 0) + 1), sup = document.createElement('sup'); sup.className = 'fnref'; sup.dataset.fn = id; sup.contentEditable = 'false'; sup.textContent = String(Doc.notes.length - 1 > 0 ? Doc.notes.length + Doc.newNotes.length : Doc.newNotes.length + 1);
    r.collapse(false); r.insertNode(sup); Doc.newNotes.push({ id: id, text: tx }); b.dataset.m = '1'; mark(); Ui.toast(t('fn.added'));
  };
  function noteText(n) { return Doc.noteEdits[n.id] !== undefined ? Doc.noteEdits[n.id] : n.text; }
  A['rf-fns'] = function () {
    var all = Doc.notes.map(function (n, i) { return { n: i + 1, id: n.id, text: noteText(n), old: true }; }).concat(Doc.newNotes.map(function (n, i) { return { n: Doc.notes.length + i + 1, id: n.id, text: n.text }; }));
    Ui.sheet('fnlist', card(t('fn.title'), all.length ? all.map(function (n) {
      return '<div class="rv-c"><p><b>' + n.n + '</b> ' + esc(n.text) + '</p>' + (Doc.mode === 'edit' ? '<button type="button" class="rv-b" data-act="rf-fnedit" data-id="' + esc(n.id) + '" data-old="' + (n.old ? 1 : 0) + '">' + esc(t('fn.edit')) + '</button>' : '') + '</div>';
    }).join('') : '<p class="rv-none">' + esc(t('fn.none')) + '</p>', doneBtn()));
  };
  // the text of a note, old or new, can be changed; an old note is rewritten as plain text on save
  A['rf-fnedit'] = function (el) {
    var old = el.dataset.old === '1', list = old ? Doc.notes : Doc.newNotes, n = list.filter(function (x) { return String(x.id) === el.dataset.id; })[0]; if (!n) return;
    V.note = { id: String(n.id), old: old };
    Ui.sheet('fnedit', '<h2 class="sh-h">' + esc(t('fn.edit')) + '</h2><div class="pa-f hf-f"><textarea id="fnEditText" rows="3" autocomplete="off">' + esc(old ? noteText(n) : n.text) + '</textarea></div><div class="btns"><button type="button" class="btn light" data-act="rf-fns">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rf-fnsave">' + esc(t('a.apply')) + '</button></div>');
    setTimeout(function () { var i = $('fnEditText'); if (i) i.focus(); }, 300);
  };
  A['rf-fnsave'] = function () {
    var tx = ($('fnEditText').value || '').trim(), n = V.note; if (!tx || !n) return;
    if (n.old) Doc.noteEdits[n.id] = tx; else Doc.newNotes.forEach(function (x) { if (String(x.id) === n.id) x.text = tx; });
    mark(); A['rf-fns']();
  };

  // ---- tracked changes ----------------------------------------------------------------------------------------------------------
  async function changes() {
    var out = [], z = Doc.zbuf && await Zipx.open(Doc.zbuf.slice(0)), xml = z && await z.text('word/document.xml'); if (!xml) return out;
    var re = /<w:(ins|del)\b([^>]*[^/])>([\s\S]*?)<\/w:\1>/g, m, n = 0;
    while ((m = re.exec(xml))) { var a = /w:author="([^"]*)"/.exec(m[2]), d = /w:date="([^"]*)"/.exec(m[2]); out.push({ n: n++, kind: m[1], author: a ? a[1] : '', date: d ? d[1] : '', text: m[3].replace(/<[^>]+>/g, '').slice(0, 120) }); }
    return out;
  }
  function decided(n) { var r = Doc.revs.filter(function (x) { return x.n === n || x.all; })[0]; return r ? (r.act || r.all) : ''; }
  A['rv-changes'] = async function () {
    var list = await changes(), body = list.length ? list.map(function (c) {
      var d = decided(c.n);
      return '<div class="rv-c ' + c.kind + (d ? ' dn' : '') + '"><div class="rv-h"><b>' + esc(t(c.kind === 'ins' ? 'tc.ins' : 'tc.del')) + '</b><span>' + esc(c.author) + ' ' + esc(when(c.date)) + '</span></div><p>' + esc(c.text || '…') + '</p>'
        + (d ? '<span class="rv-st">' + esc(t(d === 'accept' ? 'tc.accepted' : 'tc.rejected')) + '</span>' : '<button type="button" class="rv-b" data-act="rv-rev" data-n="' + c.n + '" data-a="accept">' + esc(t('tc.accept')) + '</button><button type="button" class="rv-b" data-act="rv-rev" data-n="' + c.n + '" data-a="reject">' + esc(t('tc.reject')) + '</button>') + '</div>';
    }).join('') : '<p class="rv-none">' + esc(t('tc.none')) + '</p>';
    var foot = list.length ? '<button type="button" class="btn light" data-act="rv-revall" data-a="reject">' + esc(t('tc.rejall')) + '</button><button type="button" class="btn" data-act="rv-revall" data-a="accept">' + esc(t('tc.accall')) + '</button>' : doneBtn();
    Ui.sheet('tclist', card(t('tc.title'), body, foot));
  };
  A['rv-track'] = function () { Doc.track = !Doc.track; Ui.toast(t(Doc.track ? 'tc.on' : 'tc.off')); if (window.Ribbon) Ribbon.render(); };
  A['rv-rev'] = function (el) { Doc.revs.push({ n: +el.dataset.n, act: el.dataset.a }); mark(); A['rv-changes'](); };
  A['rv-revall'] = function (el) { Doc.revs = [{ all: el.dataset.a }]; mark(); Ui.closeSheet(); Ui.toast(t('tc.onsave')); };
})();
