// Ribbon — the computer's toolbar the way Word draws it: tabs (File, Home, Insert, Layout, References, Review, View), and under the active tab groups of tools with their names below.
// Every tool is an existing action (data-act); the touch layout keeps its own bar and reaches the same features through "All features" (Menus.items).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, R = window.Ribbon = { tab: 'home', tabs: ['home', 'insert', 'layout', 'refs', 'review', 'view'] };
  function b(act, inner, label, o) { o = o || {}; return '<button type="button" class="rb' + (o.big ? ' big' : '') + (o.cls ? ' ' + o.cls : '') + '" data-act="' + act + '"' + (o.data || '') + ' aria-label="' + esc(label) + '" title="' + esc(label) + '">' + inner + (o.big ? '<span>' + esc(label) + '</span>' : '') + '</button>'; }
  function icb(act, icon, label, o) { return b(act, ic(icon, (o && o.big) ? 26 : 20, 1.8), label, o); }
  function g(name, body) { return '<div class="rg"><div class="rg-b">' + body + '</div><div class="rg-n">' + esc(t('rb.' + name)) + '</div></div>'; }
  function sep() { return '<i class="rg-sep"></i>'; }

  // ---- the gallery of styles (each tile is drawn in its own look by the page's style rules) ---------------------------------------------
  function gallery() {
    var cur = window.Para && Para.blocks()[0] ? Para.styleOf(Para.blocks()[0]) : Styles.def;
    return '<div class="rb-galw"><div class="rb-gal" id="rbGal">' + Styles.gallery().map(function (s) {
      return '<button type="button" class="gt' + (s.id === cur ? ' on' : '') + '" data-act="st-set" data-id="' + esc(s.id) + '" title="' + esc(Styles.label(s)) + '"><span class="paper gal"><span class="b" data-st="' + esc(s.id) + '">' + esc(t('rb.sample')) + '</span></span><em>' + esc(s.name) + '</em></button>';
    }).join('') + '</div><button type="button" class="rb gal-more" data-act="st-more" aria-label="' + esc(t('rb.styles')) + '">' + ic('down', 16, 2.2) + '</button></div>';
  }
  A['st-set'] = function (el) { Para.setStyle(el.dataset.id); };
  A['st-more'] = function (el) {
    var r = el.getBoundingClientRect(), cur = Para.blocks()[0] ? Para.styleOf(Para.blocks()[0]) : Styles.def;
    PopMenu.show(r.left - 220, r.bottom + 2, Styles.paragraph().map(function (s) { return { t: Styles.label(s), on: s.id === cur, go: function () { Para.setStyle(s.id); } }; }), { from: el });
  };

  // ---- the tabs ---------------------------------------------------------------------------------------------------------------------------
  var TAB = {
    home: function () {
      return g('clip', b('q-paste', ic('clip', 26, 1.7) + '<span>' + esc(t('q.paste')) + '</span>', t('q.paste'), { big: false, cls: 'big' }) + '<div class="rb-col">' + b('q-cut', 'Cut', t('q.cut'), { cls: 'tx' }) + b('q-copy', 'Copy', t('q.copy'), { cls: 'tx' }) + b('rb-paint', t('rb.painter'), t('rb.painter'), { cls: 'tx', data: '' }) + '</div>')
        + sep() + g('font', '<div class="rb-row"><button type="button" class="tl-chip rb-font" data-act="rb-fontmenu"><span id="tlFont">Calibri</span>' + ic('down', 14, 2.4) + '</button><button type="button" class="tl-chip rb-size" data-act="rb-sizemenu"><span id="tlSize">11</span>' + ic('down', 14, 2.4) + '</button>' + b('e-larger', 'A+', t('f.larger')) + b('e-smaller', 'A−', t('f.smaller')) + b('e-clear', '×', t('fo.clear')) + '</div>'
          + '<div class="rb-row">' + b('e-bold', '<b>B</b>', t('f.bold')) + b('e-italic', '<i>I</i>', t('f.italic')) + b('e-underline', '<u>U</u>', t('f.underline')) + b('e-strike', '<s>S</s>', t('f.strike')) + b('e-sub', 'x<sub>2</sub>', t('fo.sub')) + b('e-sup', 'x<sup>2</sup>', t('fo.sup'))
          + b('e-hl', ic('marker', 20, 1.8), t('f.highlight')) + b('e-color', '<span class="tl-a">A<i style="background:var(--ink)"></i></span>', t('f.color')) + '</div>')
        + sep() + g('para', '<div class="rb-row">' + icb('e-bul', 'list', t('p.bullets')) + b('ls-menu', ic('down', 12, 2.6), t('ls.bullets'), { data: ' data-k="bullet"', cls: 'rb-dd' }) + icb('e-num', 'numlist', t('p.numbers')) + b('ls-menu', ic('down', 12, 2.6), t('ls.numbers'), { data: ' data-k="ordered"', cls: 'rb-dd' }) + icb('e-outdent', 'outdent', t('p.outdent')) + icb('e-indent', 'indent', t('p.indent')) + b('pa-line', '1.5', t('pa.line')) + '</div>'
          + '<div class="rb-row">' + [['left', 'alignl'], ['center', 'alignc'], ['right', 'alignr'], ['justify', 'alignj']].map(function (x) { return icb('e-al-' + x[0], x[1], t('p.' + x[0])); }).join('') + b('pa-open', '¶', t('pa.title')) + '</div>')
        + sep() + g('styles', gallery())
        + sep() + g('edit', b('d-find', ic('search', 20, 1.8) + '<span>' + esc(t('mn.find')) + '</span>', t('mn.find'), { cls: 'big' }));
    },
    insert: function () {
      var e = Doc.mode === 'edit';
      return g('pages', icb('i-brk', 'pagebreak', t('i.pagebreak'), { big: true })) + sep() + g('tables', icb('i-table', 'table', t('i.table'), { big: true }) + b('t-fromtext', ic('table', 26, 1.7) + '<span>' + esc(t('ft.title')) + '</span>', t('ft.title'), { cls: 'big' })) + sep() + g('illus', icb('i-pic', 'image', t('i.picture'), { big: true })) + sep() + g('hfg', b('hf-open', ic('doc', 26, 1.7) + '<span>' + esc(t('hf.title')) + '</span>', t('hf.title'), { cls: 'big' })) + sep() + g('links', icb('e-link', 'link', t('i.link'), { big: true }) + b('bm-link', ic('link', 26, 1.7) + '<span>' + esc(t('bm.link')) + '</span>', t('bm.link'), { cls: 'big' }) + b('bm-open', ic('pin', 26, 1.7) + '<span>' + esc(t('bm.title')) + '</span>', t('bm.title'), { cls: 'big' })) + sep() + g('symbols', icb('i-div', 'divider', t('i.divider'), { big: true }) + b('sy-open', '<b>\u03a9</b>', t('sy.title'), { big: true }) + b('i-eq', '<b>\u03c0</b>', t('eq.title'), { big: true }) + b('i-shape', ic('indent', 26, 1.7) + '<span>' + esc(t('shp.title')) + '</span>', t('shp.title'), { cls: 'big' }) + b('dt-open', ic('calendar', 26, 1.7) + '<span>' + esc(t('dt.title')) + '</span>', t('dt.title'), { cls: 'big' }));
    },
    layout: function () {
      return g('pagesetup', b('ps-open', ic('pages', 26, 1.7) + '<span>' + esc(t('ps.title')) + '</span>', t('ps.title'), { cls: 'big' }) + b('cols-menu', ic('table', 26, 1.7) + '<span>' + esc(t('ps.cols')) + '</span>', t('ps.cols'), { cls: 'big' })) + sep() + g('para', b('pa-open', '¶', t('pa.title'), { big: true }) + b('tb-open', ic('indent', 26, 1.7) + '<span>' + esc(t('tb.title')) + '</span>', t('tb.title'), { cls: 'big' }) + b('pa-line', '1.5', t('pa.line'), { big: true }))
        + sep() + g('pagebreakg', icb('i-brk', 'pagebreak', t('i.pagebreak'), { big: true }) + b('sb-menu', ic('pages', 26, 1.7) + '<span>' + esc(t('sb.title')) + '</span>', t('sb.title'), { cls: 'big' })) + sep() + g('wmg', b('wm-menu', ic('doc', 26, 1.7) + '<span>' + esc(t('wm.title')) + '</span>', t('wm.title'), { cls: 'big' }) + b('pg-color', ic('pages', 26, 1.7) + '<span>' + esc(t('pc.title')) + '</span>', t('pc.title'), { cls: 'big' }));
    },
    picture: function () {
      var al = function (a, ico, k) { return icb('pic-al', ico, t(k), { big: true, data: ' data-a="' + a + '"' }); }, sz = function (p) { return b('pic-size', '<b>' + p + '%</b>', p + '%', { data: ' data-p="' + p + '"', cls: 'tx2' }); };
      return g('picsize', sz(25) + sz(50) + sz(75) + sz(100))
        + sep() + g('picalign', al('left', 'alignl', 'p.left') + al('center', 'alignc', 'p.center') + al('right', 'alignr', 'p.right'))
        + sep() + g('picfmt', b('pic-rot', '&#8634;', t('pic.rotl'), { data: ' data-d="-90"', cls: 'tx2' }) + b('pic-rot', '&#8635;', t('pic.rotr'), { data: ' data-d="90"', cls: 'tx2' }) + b('pic-crop', ic('pages', 26, 1.7) + '<span>' + esc(t('pic.crop')) + '</span>', t('pic.crop'), { cls: 'big' }) + b('pic-wrap', ic('indent', 26, 1.7) + '<span>' + esc(t('pic.wrap')) + '</span>', t('pic.wrap'), { cls: 'big' }))
        + sep() + g('picdel', icb('pic-del', 'trash', t('g.del'), { big: true }));
    },
    shape: function () {
      return g('shpg', b('shp-edit', ic('edit', 26, 1.7) + '<span>' + esc(t('a.edit')) + '</span>', t('a.edit'), { cls: 'big' })) + sep() + g('picdel', icb('shp-del', 'trash', t('g.del'), { big: true }));
    },
    table: function () {
      var T = function (a, ico, k) { return icb(a, ico, t(k), { big: true }); };
      return g('rowscols', T('t-rowa', 'rowabove', 'tb.rowa') + T('t-rowb', 'rowbelow', 'tb.rowb') + T('t-cola', 'colleft', 'tb.cola') + T('t-colb', 'colright', 'tb.colb') + T('t-delrow', 'delrow', 'tb.delrow') + T('t-delcol', 'delcol', 'tb.delcol'))
        + sep() + g('merge', b('t-merge', ic('table', 26, 1.7) + '<span>' + esc(t('tb.merge')) + '</span>', t('tb.merge'), { cls: 'big' }) + b('t-split', ic('grid', 26, 1.7) + '<span>' + esc(t('tb.split')) + '</span>', t('tb.split'), { cls: 'big' }) + b('t-vmerge', ic('table', 26, 1.7) + '<span>' + esc(t('tb.vmerge')) + '</span>', t('tb.vmerge'), { cls: 'big' }) + b('t-vsplit', ic('grid', 26, 1.7) + '<span>' + esc(t('tb.vsplit')) + '</span>', t('tb.vsplit'), { cls: 'big' }))
        + sep() + g('shading', b('t-borders', ic('table', 26, 1.7) + '<span>' + esc(t('bd.title')) + '</span>', t('bd.title'), { cls: 'big' }) + b('t-shade', ic('marker', 26, 1.7) + '<span>' + esc(t('tb.shade')) + '</span>', t('tb.shade'), { cls: 'big' }))
        + sep() + g('tsort', b('t-sort', ic('sort', 26, 1.7) + '<span>' + esc(t('so.title')) + '</span>', t('so.title'), { cls: 'big' })) + sep() + g('tdel', T('t-deltable', 'trash', 'tb.deltable'));
    },
    refs: function () { return g('toc', b('rf-toc', ic('list', 26, 1.7) + '<span>' + esc(t('toc.title')) + '</span>', t('toc.title'), { cls: 'big' })) + sep() + g('fng', b('rf-fn', ic('note', 26, 1.7) + '<span>' + esc(t('fn.new')) + '</span>', t('fn.new'), { cls: 'big' }) + b('rf-fns', ic('viewlist', 26, 1.7) + '<span>' + esc(t('fn.title')) + '</span>', t('fn.title'), { cls: 'big' })); },
    review: function () {
      return g('comg', b('rv-new', ic('note', 26, 1.7) + '<span>' + esc(t('cm.new')) + '</span>', t('cm.new'), { cls: 'big' }) + b('rv-comments', ic('users', 26, 1.7) + '<span>' + esc(t('cm.title')) + '</span>', t('cm.title'), { cls: 'big' })) + sep() + g('tcg', b('rv-track', ic('edit', 26, 1.7) + '<span>' + esc(t('tc.track')) + '</span>', t('tc.track'), { cls: 'big' + (Doc.track ? ' on' : '') }) + b('rv-changes', ic('refresh', 26, 1.7) + '<span>' + esc(t('tc.title')) + '</span>', t('tc.title'), { cls: 'big' })) + sep() + g('proof', b('rv-spell', '<b>abc</b>', t('sp.title'), { big: true, cls: Extras.spellOn() ? 'on' : '' }) + b('d-words', ic('list', 26, 1.7) + '<span>' + esc(t('dk.words')) + '</span>', t('dk.words'), { cls: 'big' }));
    },
    view: function () {
      var pg = Store.prefs().layout === 'page';
      return g('views', b('r-layout', ic('pages', 26, 1.7) + '<span>' + esc(t('w.pages')) + '</span>', t('w.pages'), { cls: 'big' + (pg ? ' on' : ''), data: ' data-k="page"' }) + b('r-layout', ic('reflow', 26, 1.7) + '<span>' + esc(t('w.wrap')) + '</span>', t('w.wrap'), { cls: 'big' + (!pg ? ' on' : ''), data: ' data-k="fit"' }))
        + sep() + g('zoom', icb('z-in', 'plus', t('w.zin'), { big: true }) + icb('z-out', 'minus', t('w.zout'), { big: true }) + b('z-fit', ic('viewgrid', 26, 1.7) + '<span>' + esc(t('w.fit')) + '</span>', t('w.fit'), { cls: 'big' }))
        + sep() + g('show', (Wide.pc ? b('sd-toggle', ic('viewlist', 26, 1.7) + '<span>' + esc(t('o.title')) + '</span>', t('o.title'), { cls: 'big' }) : b('m-contents', ic('viewlist', 26, 1.7) + '<span>' + esc(t('o.title')) + '</span>', t('o.title'), { cls: 'big' })));
    }
  };
  // a picked shape: edit (the same dialog as a double click) or delete
  function pickedShape() { return Doc.paper().querySelector('.b.shp.sel'); }
  A['shp-edit'] = function () { var s = pickedShape(); if (s && window.Shape) Shape.edit(s); };
  A['shp-del'] = function () { var s = pickedShape(); if (!s) return; var nx = s.nextElementSibling; s.remove(); Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); if (window.Struct) Struct.hide(); if (nx && nx.focus) nx.focus(); };
  A['q-cut'] = function () { Surface.focus(); document.execCommand('cut'); Edit.mark(); Doc.touch(); };
  A['q-copy'] = function () { Surface.focus(); document.execCommand('copy'); };
  A['d-words'] = function () { Desk.words(); };

  var FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Courier New'], SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
  A['rb-fontmenu'] = function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 2, FONTS.map(function (f) { return { t: f, go: function () { A['e-setfont']({ dataset: { f: f } }); } }; }), { from: el }); };
  A['rb-sizemenu'] = function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 2, SIZES.map(function (n) { return { t: String(n), go: function () { A['e-setsize']({ dataset: { s: n } }); } }; }), { from: el }); };
  var sync0 = Edit.sync; Edit.sync = function () { sync0.apply(this, arguments); var c = $('tlFont'); if (c && c.textContent.indexOf(' · ') > 0) { var p = c.textContent.split(' · '); c.textContent = p[0]; if ($('tlSize')) $('tlSize').textContent = p[1]; } };

  // the format painter: take the look of the text at the caret, then paint it on the next selection (the paragraph's own format and style come along)
  var paint = null;
  function q(c) { try { return document.queryCommandState(c); } catch (e) { return false; } }
  A['rb-paint'] = function () {
    var bl = Edit.block(); if (!bl) return Ui.toast(t('e.tap')); var n = getSelection().anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), cs = el && getComputedStyle(el), f = el && el.closest('[data-f]');
    paint = { b: q('bold'), i: q('italic'), u: q('underline'), s: q('strikeThrough'), color: cs && cs.color, size: cs && Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2, font: f && f.dataset.f, fmt: bl.dataset.fmt || '', st: bl.dataset.st || '' };
    document.documentElement.classList.add('painting'); Ui.toast(t('rb.painter.on'));
  };
  document.addEventListener('pointerup', function () {
    if (!paint) return; setTimeout(function () {
      var s = getSelection(); if (!paint || !s.rangeCount || s.isCollapsed || !Doc.paper().contains(s.anchorNode)) return; var p = paint; paint = null; document.documentElement.classList.remove('painting');
      var tgt = ['bold:b', 'italic:i', 'underline:u', 'strikeThrough:s']; tgt.forEach(function (x) { var a = x.split(':'); if (q(a[0]) !== !!p[a[1]]) document.execCommand(a[0]); });
      if (p.font) A['e-setfont']({ dataset: { f: p.font } }); if (p.size) A['e-setsize']({ dataset: { s: p.size } }); if (p.color) document.execCommand('foreColor', false, p.color);
      if (window.Para) { if (p.st) Para.setStyle(p.st); Para.set(p.fmt ? JSON.parse(p.fmt) : {}); }
      Edit.mark && Edit.mark(); Doc.touch();
    }, 0);
  });
  R.render = function () {
    if (!Wide.pc) return R.phone();
    var host = $('dkBar'); if (!host) return;
    if (!Wide.pc || !Doc.rec || !Doc.blocks) { host.innerHTML = ''; host.classList.remove('on'); return; }
    host.classList.add('on', 'rib');
    host.innerHTML = '<div id="tlBody" class="rb-body" data-tab="' + R.tab + '">' + TAB[R.tab]() + '</div>';
    var edit = Doc.mode === 'edit'; host.classList.toggle('ro', !edit && R.tab !== 'view');
    if (edit) Edit.sync(); R.sync();
  };
  // a tab that appears with what is picked: Table when the caret is in a cell, Picture when a picture added in this session is picked
  function ctx() { if (Doc.mode !== 'edit') return ''; if (pickedShape()) return 'shape'; if (window.Table && (Table.cell() || Table.selection())) return 'table'; var p = Doc.paper().querySelector('.b.imgp.sel'); return p && (Doc.pics[p.dataset.n] || p.dataset.src !== undefined) ? 'picture' : ''; }
  R.ctx = ctx;
  function tabsNow() { var c = ctx(); return c ? R.tabs.concat([c]) : R.tabs; }
  R.menu = function () {
    var bar = $('dkMenu'); if (!Wide.pc) return;
    bar.innerHTML = '<button type="button" class="dk-m file" data-mn="file">' + esc(t('mu.file')) + '</button>' + tabsNow().map(function (k) { return '<button type="button" class="dk-m tab' + (k === R.tab ? ' on' : '') + '" data-rt="' + k + '">' + esc(t('rb.t.' + k)) + '</button>'; }).join('');
    bar.dataset.l = I18n.locale();
  };
  R.sync = function () {
    var cur = $('rbGal'); if (!cur || !window.Para) return; var b0 = Para.blocks()[0], id = b0 ? Para.styleOf(b0) : null;
    Array.prototype.forEach.call(cur.children, function (x) { x.classList.toggle('on', x.dataset.id === id); });
  };
  R.go = function (k) { R.tab = k; R.menu(); R.render(); };
  // the phone and the touch tablet have their own bottom bar (dock-vm.js)
  R.phone = function () { if (window.Dock) Dock.render(); };

  // the ribbon replaces the menu bar and the strip
  Desk.chrome = function () { if (!Wide.pc) return; R.menu(); Desk.status(); };
  Desk.bar = function () { R.render(); };
  document.addEventListener('click', function (e) { var x = e.target.closest && e.target.closest('[data-rt]'); if (x) { e.preventDefault(); R.go(x.dataset.rt); } });
  document.addEventListener('selectionchange', function () {
    if (Doc.mode !== 'edit') return; clearTimeout(R.t);
    R.t = setTimeout(R.follow, 60);
  });
  // the contextual tab follows what is picked
  R.follow = function () {
    var c = ctx(); if (c !== (R.cur || '')) { if (c) { if (!R.cur) R.back = R.tab; R.tab = c; } else if (R.tab === R.cur) R.tab = R.back || 'home'; R.cur = c; R.menu(); R.render(); } R.sync();
  };
  document.addEventListener('click', function () { if (Doc.mode === 'edit') setTimeout(R.follow, 30); });
  if (Wide.pc && Doc.rec) { R.menu(); }
})();
