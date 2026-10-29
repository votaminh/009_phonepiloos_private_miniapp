// McpDocTools — the agent tools about the document as a whole: facts, search, order of the blocks, breaks and contents, pictures, header and footer,
// page setup, track changes, undo. Header, footer and page setup drive their own dialogs (fill the fields, press Apply), so every rule of those dialogs applies.
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc, A = App.acts, $ = function (id) { return document.getElementById(id); };
  if (!M || !D) return;

  function words(s) { return (s.match(/\S+/g) || []).length; }
  function pressSeg(id, v) { var b = $(id) && $(id).querySelector('[data-v="' + v + '"]'); if (!b) throw new Error('unknown_option:' + v); b.click(); }

  M.tool('doc_get_info', function () {
    var list = D.blocks(), w = 0, ch = 0, kinds = {};
    list.forEach(function (b) { var s = D.text(b); w += words(s); ch += s.length; var k = D.kind(b).replace(/\d$/, ''); kinds[k] = (kinds[k] || 0) + 1; });
    var info = { name: Doc.rec && Doc.rec.name || null, mode: Doc.mode, unsaved: !!Doc.dirty, blocks: list.length, words: w, characters: ch, pages: window.Paginate && Paginate.pages || null, trackChanges: !!Doc.track, kinds: kinds };
    return { summary: info.blocks + ' blocks, ' + w + ' words, ' + (info.pages || '?') + ' page(s)' + (info.unsaved ? ', unsaved changes' : ''), data: info };
  });

  M.tool('doc_find', function (a) {
    var q = a.caseSensitive ? a.query : a.query.toLowerCase(), hits = [], max = a.limit || 50, cs = function (s) { return a.caseSensitive ? s : s.toLowerCase(); };
    function scan(s, at) { var i = cs(s).indexOf(q); while (i >= 0 && hits.length < max) { hits.push(Object.assign({ offset: i, context: s.slice(Math.max(0, i - 25), i + q.length + 25) }, at)); i = cs(s).indexOf(q, i + q.length); } }
    D.blocks().forEach(function (b, bi) {
      if (hits.length >= max) return;
      if (b.classList.contains('tbl')) Array.prototype.forEach.call(b.querySelectorAll('tr'), function (tr, r) { Array.prototype.forEach.call(tr.children, function (td, c) { scan(D.text(td), { index: bi, row: r, col: c }); }); });
      else scan(D.text(b), { index: bi });
    });
    return { summary: hits.length ? hits.length + ' match(es)' + (hits.length >= max ? ' (limit reached)' : '') : 'No match', data: { matches: hits } };
  });

  M.tool('doc_move_block', function (a) {
    D.ready(); var list = D.blocks(), b = D.at(a.index), to = Math.max(0, Math.min(list.length - 1, a.to)), ref = list[to];
    if (ref !== b) { to > a.index ? ref.after(b) : ref.before(b); D.done(b); }
    return { summary: 'Block moved to index ' + D.blocks().indexOf(b), data: { index: D.blocks().indexOf(b) } };
  });

  M.tool('doc_duplicate_block', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), c = b.cloneNode(true); c.dataset.n = Doc.nid(); c.removeAttribute('data-src'); c.dataset.m = '1'; c.removeAttribute('data-cm');
    b.after(c); D.done(c); return { summary: 'Duplicated block ' + a.index + ' as ' + D.blocks().indexOf(c), data: { index: D.blocks().indexOf(c) } };
  });

  function anchor(a) { D.ready(); if (a.after !== undefined) D.anchorAfter(a.after); }
  M.tool('doc_insert_page_break', function (a) { anchor(a); A['i-brk'](); return { summary: 'Inserted a page break', data: null }; });
  M.tool('doc_insert_divider', function (a) { anchor(a); A['i-div'](); return { summary: 'Inserted a horizontal line', data: null }; });
  M.tool('doc_insert_toc', function (a) {
    anchor(a); var had = !!Doc.paper().querySelector('.b.lk.toc'); A['rf-toc'](); if (!Doc.paper().querySelector('.b.lk.toc')) throw new Error('no_headings: add headings first');
    return { summary: had ? 'Updated the table of contents' : 'Inserted a table of contents', data: null };
  });

  M.tool('doc_insert_image', async function (a) {
    anchor(a);
    var mime = a.mime || 'image/png', bin = atob(String(a.base64).replace(/^data:[^,]*,/, '')), buf = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([buf], { type: mime })), img = new Image();
    await new Promise(function (ok, no) { img.onload = ok; img.onerror = function () { no(new Error('bad_image: not a readable ' + mime)); }; img.src = url; });
    var k = Math.min(1, (a.width || 600) / img.naturalWidth, 600 / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    var el = Insert.block('imgp', '<img src="' + url + '" width="' + w + '" height="' + h + '" alt="">'); Doc.pics[el.dataset.n] = { buf: buf.buffer, mime: mime, w: w, h: h, align: 'left' };
    Insert.place(el); return { summary: 'Inserted a ' + w + 'x' + h + ' picture at index ' + D.blocks().indexOf(el), data: { index: D.blocks().indexOf(el) } };
  });

  M.tool('doc_set_header_footer', function (a) {
    D.ready(); A['hf-open'](); if (!$('hfH')) throw new Error('header_dialog_missing');
    if (a.header !== undefined) $('hfH').value = a.header; if (a.footer !== undefined) $('hfF').value = a.footer;
    if (a.headerAlign) pressSeg('hfHA', a.headerAlign); if (a.footerAlign) pressSeg('hfFA', a.footerAlign);
    A['hf-go'](); return { summary: 'Header and footer set (use {PAGE} and {NUMPAGES} for page numbers)', data: null };
  });

  M.tool('doc_set_page_setup', function (a) {
    D.ready(); A['ps-open'](); if (!$('psPaper')) throw new Error('page_dialog_missing');
    if (a.paper) pressSeg('psPaper', a.paper); if (a.orientation) pressSeg('psOr', a.orientation === 'landscape' ? 'l' : 'p'); if (a.columns) pressSeg('psCols', a.columns);
    [['psT', 'marginTop'], ['psB', 'marginBottom'], ['psL', 'marginLeft'], ['psR', 'marginRight']].forEach(function (p) { if (a[p[1]] !== undefined) $(p[0]).value = String(a[p[1]]); });
    A['ps-go'](); return { summary: 'Page setup applied (paper ' + (a.paper || 'unchanged') + ', margins in cm)', data: null };
  });

  M.tool('doc_set_track_changes', function (a) { D.ready(); if (!!Doc.track !== !!a.on) A['rv-track'](); return { summary: 'Track changes ' + (Doc.track ? 'on' : 'off'), data: null }; });
  M.tool('doc_undo', function () { D.ready(); A['e-undo'](); return { summary: 'Undone', data: null }; });
  M.tool('doc_redo', function () { D.ready(); A['e-redo'](); return { summary: 'Redone', data: null }; });
})();
