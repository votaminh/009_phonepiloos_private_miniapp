// Dock — the bottom bar of a phone or a touch tablet while editing (the computer has the ribbon). Drawn on the canvas "Piloos Doc - menu dưới":
// one row of what is used all the time (Aa, bold, italic, underline, bullets, alignment, + Insert, … More); the Aa tray over it for the rest of the text tools; the Insert sheet (tiles);
// the More sheet (a searchable list of everything else, each row an existing action); and, when a picture, a table or a shape is picked, a strip of its own tools in place of the row.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, D = window.Dock = { tray: false };
  var P = {
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 4 4 3-3 4 4"/>', table: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18M9 5v14M15 5v14"/>',
    shape: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/>', sigma: '<path d="M18 5H6l6 7-6 7h12"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    pagebreak: '<path d="M4 12h16M7 5h10M7 19h10" stroke-dasharray="2 3"/>', comment: '<path d="M4 5h16v11H9l-5 4z"/>', note: '<path d="M6 4h9l3 3v13H6zM9 11h6M9 15h6"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    num: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v5M4 14h2l-2 3h2"/>', align: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', plus: '<path d="M12 5v14M5 12h14"/>', dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    rotl: '<path d="M5 12a7 7 0 107-7H8M8 2L5 5l3 3"/>', rotr: '<path d="M19 12a7 7 0 11-7-7h4M16 2l3 3-3 3"/>', crop: '<path d="M6 2v14h14M2 6h14v14"/>', wrap: '<path d="M4 6h16M4 18h16M4 10h6v4H4zM13 10h7M13 14h7"/>', trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    chev: '<path d="M9 5l7 7-7 7"/>', down: '<path d="M6 9l6 6 6-6"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>', page: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h8"/>', cols: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>',
    brk: '<path d="M4 8h16M4 16h16M8 4v4M8 16v4" stroke-dasharray="2 3"/>', edit: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>', share: '<path d="M12 4v11M8 8l4-4 4 4M5 14v6h14v-6"/>', rowp: '<path d="M12 8v8M8 12h8M4 4h16"/>', colp: '<path d="M8 12h8M12 8v8M4 4v16"/>',
    sort: '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>', border: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>', paint: '<path d="M5 19l4-1 9-9-3-3-9 9zM14 6l3 3"/>', zoom: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4M9 11h4M11 9v4"/>', book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/>'
  };
  function svg(n, s) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (s ? ' style="width:' + s + 'px;height:' + s + 'px"' : '') + '>' + (P[n] || '') + '</svg>'; }
  function tb(act, inner, label, o) { o = o || {}; return '<button type="button" class="tb' + (o.cls ? ' ' + o.cls : '') + '" data-act="' + act + '"' + (o.data || '') + ' aria-label="' + esc(label) + '">' + inner + '</button>'; }
  function sep() { return '<i class="sep"></i>'; }
  function stub() {   // a place for a pop-up to hang from: the top edge of the dock
    var d = $('docTools').getBoundingClientRect(), s = document.createElement('div'); s.getBoundingClientRect = function () { return { left: d.left + d.width / 2 - 100, right: d.left + d.width / 2 + 100, top: d.top, bottom: d.top - 4, width: 200, height: 0 }; }; return s;
  }
  function pop(el, items) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.top - 8, items, { from: el }); }

  // ---- the dock ---------------------------------------------------------------------------------------------------------------------------
  function basics() {
    return '<div class="row"><div class="row sc dd-scroll" style="flex:1;min-width:0;padding:0">'
      + tb('dd-tray', 'Aa' + svg('down', 14), t('dd.text'), { cls: 'txt' + (D.tray ? ' on' : '') }) + tb('e-bold', '<b>B</b>', t('f.bold')) + tb('e-italic', '<em>I</em>', t('f.italic')) + tb('e-underline', '<span class="u">U</span>', t('f.underline'))
      + tb('e-bul', svg('list'), t('p.bullets')) + tb('dd-align', svg('align'), t('dk.align')) + '</div>'
      + '<div class="fix">' + tb('dd-insert', svg('plus'), t('dd.insert')) + tb('dd-more', svg('dots'), t('dd.more')) + '</div></div>';
  }
  function tray() {
    return '<div class="row tray" style="padding:0 10px"><button type="button" class="chip" data-act="rb-fontmenu" aria-label="' + esc(t('f.font')) + '"><span id="tlFont">Calibri</span>' + svg('down', 14) + '</button>'
      + '<div class="step"><button type="button" data-act="e-smaller" aria-label="' + esc(t('f.smaller')) + '">−</button><button type="button" data-act="e-larger" aria-label="' + esc(t('f.larger')) + '">+</button></div>'
      + tb('e-color', '<span style="font-weight:700;border-bottom:4px solid var(--ink);line-height:1">A</span>', t('f.color'), { cls: 'sp' }) + tb('e-hl', svg('paint'), t('f.highlight')) + '</div>'
      + '<div class="row tray sc" style="padding:0 6px;gap:6px">' + tb('e-strike', '<span style="text-decoration:line-through">S</span>', t('f.strike')) + tb('e-sup', 'x<sup style="font-size:10px">2</sup>', t('fo.sup')) + tb('e-sub', 'x<sub style="font-size:10px">2</sub>', t('fo.sub'))
      + tb('e-num', svg('num'), t('p.numbers')) + tb('e-indent', svg('chev'), t('p.indent')) + tb('e-outdent', '<span style="transform:scaleX(-1);display:flex">' + svg('chev') + '</span>', t('p.outdent'))
      + tb('e-clear', t('fo.clear'), t('fo.clear'), { cls: 'txt' }) + tb('rb-painter', t('rb.painter'), t('rb.painter'), { cls: 'txt' }) + '</div>';
  }
  function head(icon, label) { return '<div class="ctx"><b>' + svg(icon) + esc(label) + '</b><button type="button" data-act="dd-desel">' + esc(t('dd.deselect')) + '</button></div>'; }
  function strips(c) {
    var s = function (p) { return tb('pic-size', p + '%', p + '%', { cls: 'txt', data: ' data-p="' + p + '"' }); };
    if (c === 'picture') return head('image', t('dd.pic')) + '<div class="row sc" style="gap:6px">' + s(25) + s(50) + s(75) + s(100) + sep() + tb('pic-rot', svg('rotl'), t('pic.rotl'), { data: ' data-d="-90"' }) + tb('pic-rot', svg('rotr'), t('pic.rotr'), { data: ' data-d="90"' }) + sep()
      + tb('pic-crop', svg('crop') + t('pic.crop'), t('pic.crop'), { cls: 'txt' }) + tb('pic-wrap', svg('wrap') + t('pic.wrap'), t('pic.wrap'), { cls: 'txt' }) + tb('dd-picalign', svg('align') + t('rb.picalign'), t('rb.picalign'), { cls: 'txt' }) + sep() + tb('pic-del', svg('trash') + t('g.del'), t('g.del'), { cls: 'txt danger' }) + '</div>';
    if (c === 'table') return head('table', t('dd.cell')) + '<div class="row sc" style="gap:6px">'
      + tb('dd-tray', 'Aa' + svg('down', 14), t('dd.text'), { cls: 'txt' + (D.tray ? ' on' : '') }) + tb('e-bold', '<b>B</b>', t('f.bold')) + tb('e-italic', '<em>I</em>', t('f.italic')) + tb('e-underline', '<span class="u">U</span>', t('f.underline')) + tb('dd-align', svg('align'), t('dk.align')) + sep()   // the text in a cell is formatted from here
      + tb('dd-rows', svg('rowp') + t('dd.rows'), t('dd.rows'), { cls: 'txt' }) + tb('dd-cols', svg('colp') + t('dd.cols'), t('dd.cols'), { cls: 'txt' }) + tb('t-deltable', svg('trash') + t('g.del'), t('tb.deltable'), { cls: 'txt danger' }) + sep()
      + tb('t-merge', t('tb.merge'), t('tb.merge'), { cls: 'txt' }) + tb('t-split', t('tb.split'), t('tb.split'), { cls: 'txt' }) + tb('t-vmerge', t('tb.vmerge'), t('tb.vmerge'), { cls: 'txt' }) + tb('t-vsplit', t('tb.vsplit'), t('tb.vsplit'), { cls: 'txt' }) + sep()
      + tb('t-shade', svg('paint') + t('tb.shade'), t('tb.shade'), { cls: 'txt' }) + tb('t-borders', svg('border') + t('bd.title'), t('bd.title'), { cls: 'txt' }) + tb('t-sort', svg('sort') + t('so.title'), t('so.title'), { cls: 'txt' }) + '</div>';
    if (c === 'shape') return head('shape', t('dd.shp')) + '<div class="row sc" style="gap:6px">' + tb('shp-edit', svg('edit') + t('a.edit'), t('a.edit'), { cls: 'txt' }) + tb('shp-del', svg('trash') + t('g.del'), t('g.del'), { cls: 'txt danger' }) + '</div>';
    return '';
  }
  D.render = function () {
    var host = $('docTools'); if (!host || Wide.pc) return;
    if (!Doc.rec || !Doc.blocks || Doc.mode !== 'edit') { host.innerHTML = ''; return; }
    var c = window.Ribbon ? Ribbon.ctx() : '', at = host.querySelector('.dd-scroll'), keep = at ? at.scrollLeft : 0;
    host.innerHTML = '<div class="dock-in">' + (c ? (c === 'table' && D.tray ? tray() : '') + strips(c) : (D.tray ? tray() : '') + basics()) + '</div>';
    var s = host.querySelector('.dd-scroll'); if (s) s.scrollLeft = keep;
    D.sync(); if (window.Edit && Edit.sync) Edit.sync();
  };
  D.sync = function () {
    var host = $('docTools'); if (!host) return;
    [['e-bold', 'bold'], ['e-italic', 'italic'], ['e-underline', 'underline'], ['e-strike', 'strikeThrough'], ['e-sup', 'superscript'], ['e-sub', 'subscript']].forEach(function (p) {
      var on = false; try { on = document.queryCommandState(p[1]); } catch (e) { on = false; }
      var b = host.querySelector('[data-act="' + p[0] + '"]'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    });
  };
  A['dd-tray'] = function () { D.tray = !D.tray; D.render(); };
  A['dd-desel'] = function () {
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('.sel'), function (e) { e.classList.remove('sel'); }); if (window.Struct) Struct.hide();
    var s = getSelection(); if (s.rangeCount) s.collapseToEnd(); if (window.Ribbon) Ribbon.follow(); D.render();
  };
  A['dd-align'] = function (el) { var b = Edit.block(), td = !b && Table.cell(), cur = b ? (b.dataset.al || 'left') : td ? (td.style.textAlign || 'left') : ''; pop(el, ['left', 'center', 'right', 'justify'].map(function (a) { return { t: t('p.' + a), on: cur === a, go: function () { A['e-al-' + a](); } }; })); };
  A['dd-picalign'] = function (el) { pop(el, ['left', 'center', 'right'].map(function (a) { return { t: t('p.' + a), go: function () { A['pic-al']({ dataset: { a: a } }); } }; })); };
  A['dd-rows'] = function (el) { pop(el, [{ t: t('tb.rowa'), go: function () { A['t-rowa'](); } }, { t: t('tb.rowb'), go: function () { A['t-rowb'](); } }, { t: t('tb.delrow'), go: function () { A['t-delrow'](); } }]); };
  A['dd-cols'] = function (el) { pop(el, [{ t: t('tb.cola'), go: function () { A['t-cola'](); } }, { t: t('tb.colb'), go: function () { A['t-colb'](); } }, { t: t('tb.delcol'), go: function () { A['t-delcol'](); } }]); };

  // ---- the Insert sheet -----------------------------------------------------------------------------------------------------------------
  var TILES = [['i-pic', 'image', 'i.picture'], ['i-table', 'table', 'i.table'], ['i-shape', 'shape', 'shp.title'], ['i-eq', 'sigma', 'eq.title'], ['e-link', 'link', 'i.link'], ['i-brk', 'pagebreak', 'i.pagebreak'], ['rv-new', 'comment', 'cm.new'], ['rf-fn', 'note', 'fn.new']];
  function sheetHead(title, back) { return '<div class="dd-sh"><b>' + (back ? '<button type="button" class="dd-back" data-act="dd-more" aria-label="' + esc(t('a.back')) + '">' + svg('chev') + '</button>' : '') + esc(title) + '</b><button type="button" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>'; }
  A['dd-insert'] = function () {
    Ui.sheet('insert', sheetHead(t('dd.insert')) + '<div class="dd-tiles">' + TILES.map(function (x) { return '<button type="button" class="dd-tile" data-act="dd-do" data-a="' + x[0] + '">' + svg(x[1]) + esc(t(x[2])) + '</button>'; }).join('')
      + '</div><button type="button" class="dd-wide" data-act="dd-more"><span>' + esc(t('dd.more.hint')) + '</span>' + svg('chev', 18) + '</button>');
  };

  // ---- the More sheet: everything else, as a list --------------------------------------------------------------------------------------
  function toggle(on) { return on ? t('dd.on') : t('dd.off'); }
  function groups() {
    var pg = Store.prefs().layout === 'page';
    return [
      { g: 'dd.g.layout', rows: [['page', 'ps.title', 'ps-open'], ['cols', 'ps.cols', 'sub:cols'], ['brk', 'sb.title', 'sub:breaks'], ['page', 'hf.title', 'hf-open'], ['page', 'wm.title', 'wm-menu'], ['paint', 'pc.title', 'pg-color'], ['align', 'pa.title', 'pa-open'], ['align', 'tb.title', 'tb-open'], ['align', 'pa.line', 'pa-line']] },
      { g: 'dd.g.insert', rows: [['table', 'ft.title', 't-fromtext'], ['link', 'bm.link', 'bm-link'], ['book', 'bm.title', 'bm-open'], ['sigma', 'sy.title', 'sy-open'], ['page', 'dt.title', 'dt-open'], ['pagebreak', 'i.divider', 'i-div']] },
      { g: 'dd.g.review', rows: [['list', 'toc.title', 'rf-toc'], ['comment', 'cm.title', 'rv-comments'], ['note', 'fn.title', 'rf-fns'], ['edit', 'tc.track', 'rv-track', toggle(Doc.track)], ['edit', 'tc.title', 'rv-changes'], ['book', 'sp.title', 'rv-spell'], ['list', 'dk.words', 'd-words']] },
      { g: 'dd.g.view', rows: [['page', 'w.pages', 'r-layout:page', pg ? '✓' : ''], ['align', 'w.wrap', 'r-layout:fit', !pg ? '✓' : ''], ['zoom', 'w.zin', 'z-in'], ['zoom', 'w.zout', 'z-out'], ['zoom', 'w.fit', 'z-fit'], ['list', 'mn.contents', 'm-contents']] },
      { g: 'dd.g.file', rows: [['share', 'mn.share', 'm-share'], ['share', 'mn.copy', 'm-copy'], ['pdf', 'mn.pdf', 'm-pdf'], ['edit', 'mn.rename', 'm-rename']] }
    ];
  }
  function row(r) { return '<button type="button" class="dd-li" data-act="dd-do" data-a="' + r[2] + '" data-q="' + esc(t(r[1]).toLowerCase()) + '">' + svg(r[0]) + '<span>' + esc(t(r[1])) + '</span>' + (r[3] ? '<small>' + esc(r[3]) + '</small>' : '') + svg('chev', 18) + '</button>'; }
  A['dd-more'] = function () {
    Ui.sheet('more', sheetHead(t('dd.more')) + '<label class="dd-q">' + svg('search') + '<input id="ddQ" type="text" autocomplete="off" placeholder="' + esc(t('dd.find')) + '"></label><div class="dd-body" id="ddBody">'
      + groups().map(function (g) { return '<div class="dd-grp" data-g="1"><div class="dd-gh">' + esc(t(g.g)) + '</div><div class="dd-list">' + g.rows.map(row).join('') + '</div></div>'; }).join('') + '<p class="dd-none" id="ddNone" hidden>' + esc(t('dd.nothing')) + '</p></div>');
  };
  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'ddQ') return; var q = e.target.value.trim().toLowerCase(), any = false;
    Array.prototype.forEach.call(document.querySelectorAll('#ddBody .dd-grp'), function (g) {
      var n = 0; Array.prototype.forEach.call(g.querySelectorAll('.dd-li'), function (r) { var ok = !q || r.dataset.q.indexOf(q) >= 0; r.hidden = !ok; if (ok) n++; }); g.hidden = !n; if (n) any = true;
    });
    $('ddNone').hidden = any;
  });
  var SUB = {
    cols: function () { return [[1, 'cols.one'], [2, 'cols.two'], [3, 'cols.three']].map(function (c) { return ['cols', c[1], 'col:' + c[0]]; }); },
    breaks: function () { return [['brk', 'sb.next', 'brk:nextPage'], ['brk', 'sb.cont', 'brk:continuous'], ['pagebreak', 'i.pagebreak', 'i-brk']]; }
  };
  // one row was tapped: the sheet closes and the action runs (a pop-up action hangs from the top edge of the dock; "sub:x" opens a list one level down)
  A['dd-do'] = function (el) {
    var a = el.dataset.a || '';
    if (a.indexOf('sub:') === 0) { var k = a.slice(4); Ui.sheet('sub', sheetHead(t(k === 'cols' ? 'ps.cols' : 'sb.title'), true) + '<div class="dd-list" style="margin:8px 16px">' + SUB[k]().map(row).join('') + '</div>'); return; }
    Ui.closeSheet();
    setTimeout(function () {
      if (window.Surface) Surface.focus();
      if (a.indexOf('col:') === 0) PageSetup.setCols(+a.slice(4));
      else if (a.indexOf('brk:') === 0) SectionBreak.insert(a.slice(4));
      else if (a.indexOf('r-layout:') === 0) A['r-layout']({ dataset: { k: a.slice(9) } });
      else if (A[a]) A[a](stub());
    }, 160);
  };
  document.addEventListener('selectionchange', function () { if (Doc.mode === 'edit' && !Wide.pc) D.sync(); });
  // The keyboard takes half of the screen: the browser then scrolls to keep the caret in view, and on a page zoomed with CSS zoom it lands in the wrong place (the caret ends up off the screen).
  // After the window changes height the caret is looked up again and brought into the visible part of the page, a few times, since the browser moves the page more than once.
  function caretRect() {
    var s = getSelection(); if (!s.rangeCount) return null; var r = s.getRangeAt(0), box = r.getClientRects()[0] || r.getBoundingClientRect();
    if ((!box || (!box.width && !box.height)) && r.startContainer.nodeType === 1) box = r.startContainer.getBoundingClientRect();
    return box && (box.width || box.height) ? box : null;
  }
  function keepCaret() {
    if (Doc.mode !== 'edit' || Wide.pc) return; var s = getSelection(), body = $('docBody'); if (!s.rangeCount || !Doc.paper().contains(s.anchorNode)) return;
    var c = caretRect(), v = body.getBoundingClientRect(); if (!c) return;
    var dx = c.left < v.left + 24 ? c.left - v.left - 24 : c.right > v.right - 24 ? c.right - v.right + 24 : 0, dy = c.top < v.top + 48 ? c.top - v.top - 48 : c.bottom > v.bottom - 72 ? c.bottom - v.bottom + 72 : 0;
    if (dx || dy) { body.scrollLeft += dx; body.scrollTop += dy; if (window.DocLog) DocLog.log('caret kept in view dx=' + Math.round(dx) + ' dy=' + Math.round(dy)); }
  }
  var lastH = window.innerHeight;
  var kt = [];
  window.addEventListener('resize', function () {   // the keyboard moves the window step by step: look for the caret once the steps have stopped
    if (window.innerHeight === lastH) return; lastH = window.innerHeight; kt.forEach(clearTimeout); kt = [160, 450].map(function (ms) { return setTimeout(keepCaret, ms); });
  });
})();
