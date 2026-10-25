// GridView — the markup of the grid: column letters, one row of cells, the formula bar, the tool bars, the sheet tabs and the number summary. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, RH = 40, HW = 40;
  function Z() { return window.Grid && Grid.z || 1; }
  function hw() { return Math.round(HW * Z()); }

  function cellStyle(st, fx) {
    var s = '';
    if (st.c) s += 'color:' + st.c + ';'; if (st.bg) s += 'background:' + st.bg + ';';
    if (st.b) s += 'font-weight:700;'; if (st.i) s += 'font-style:italic;';
    if (st.u || st.s) s += 'text-decoration:' + (st.u ? 'underline' + (st.u === 2 ? ' double' : '') : '') + (st.u && st.s ? ' ' : '') + (st.s ? 'line-through' : '') + ';';
    if (Fonts.custom(st.f)) s += 'font-family:' + Fonts.css(st.f) + ';';
    if (st.sz && st.sz !== 11) s += 'font-size:' + Math.round(st.sz * 1.36 * Z() * 10) / 10 + 'px;';
    if (st.al) s += 'justify-content:' + (st.al === 'center' ? 'center' : st.al === 'right' ? 'flex-end' : 'flex-start') + ';';
    if (st.wrap) s += 'white-space:normal;line-height:1.15;';
    if (st.bd) {
      var o = [], d = ['0 $', '-$ 0', '0 -$', '$ 0'], W = { thin: 1, hair: 1, dotted: 1, dashed: 1, medium: 2, mediumDashed: 2, thick: 3, double: 3 };
      st.bd.forEach(function (e, k) { if (!e) return; var s1 = e === 1 || e === true ? 'thin' : typeof e === 'string' ? e : e.s || 'thin', col = e && e.c ? e.c : C('ink_soft'), w = (W[s1] || 1) * Z(); o.push('inset ' + d[k].replace(/\$/g, w + 'px') + ' 0 0 ' + col); });
      if (o.length) s += 'box-shadow:' + o.join(',') + ';';
    }
    if (st.va) s += 'align-items:' + (st.va === 'top' ? 'flex-start' : st.va === 'bottom' ? 'flex-end' : 'center') + ';';
    if (st['in']) s += 'padding-left:' + (8 + st['in'] * 9) * Z() + 'px;';
    if (fx) s += 'position:sticky;left:' + (hw() + fx) + 'px;z-index:2;';
    return s;
  }

  // a long text runs on over the empty cells to its right (it stops at the first cell that holds something)
  function spills(g, sh, r, c, text, st, w) {
    var need = (text.length * (st.sz || 11) * 0.62 + 18) * Z(); if (need <= w) return false;
    for (var k = c + 1, total = w; k < g.cols && total < need; k++) { if (Wb.mergeAt(sh, r, k) || Fmt.cell(sh, r, k).t !== '') return total > w; total += g.colW(k); }
    return total > w;
  }

  window.GridView = {
    RH: RH, HW: HW, hw: hw, cellStyle: cellStyle,
    // title bar: back, name and state, undo / redo, menu, Save
    top: function (name, st, o) {
      return '<button type="button" class="ib" data-act="b-back" aria-label="' + esc(t('a.back')) + '">' + Ui.ic('back', 24, 2) + '</button>'
        + '<div class="bk-ttl"><b>' + esc(name) + '</b><small class="' + st.c + '"><i></i>' + esc(st.t) + '</small></div>'
        + (o.ro ? '' : '<button type="button" class="ib' + (o.undo ? '' : ' off') + '" data-act="b-undo" aria-label="' + esc(t('a.undo')) + '">' + Ui.ic('undo', 22, 1.9) + '</button><button type="button" class="ib' + (o.redo ? '' : ' off') + '" data-act="b-redo" aria-label="' + esc(t('a.redo')) + '">' + Ui.ic('redo', 22, 1.9) + '</button>')
        + '<button type="button" class="ib" data-act="b-page" aria-label="' + esc(t(o.page ? 'xp.grid' : 'xp.page')) + '">' + Ui.ic(o.page ? 'gridv' : 'pagesv', 22, 1.9) + '</button>'
        + '<button type="button" class="ib" data-act="b-menu" aria-label="' + esc(t('a.more')) + '">' + Ui.ic('more', 22) + '</button>'
        + (o.ro ? '' : '<button type="button" class="pill solid" data-act="b-save"' + (o.dirty ? '' : ' disabled') + '>' + esc(t('a.save')) + '</button>');
    },
    // letters above the grid; the whole strip slides sideways with the grid
    colHead: function (g, sel) {
      var h = '<span class="gh gh-corner" style="width:' + hw() + 'px"></span>', c;
      for (c = 0; c < g.cols; c++) {
        var w = g.colW(c), on = sel && c >= sel.c1 && c <= sel.c2;
        h += '<span class="gh' + (on ? ' on' : '') + (g.sh.lvlC && g.sh.lvlC[c] ? ' lvc' + Math.min(3, g.sh.lvlC[c]) : '') + '" data-act="g-col" data-c="' + c + '" style="width:' + w + 'px">' + (w ? SheetSvc.col(c) + (g.sh.lvlC && (g.sh.lvlC[c - 1] || 0) > (g.sh.lvlC[c] || 0) ? '<b class="gbtn" data-act="gp-toggle" data-k="c" data-i="' + c + '">' + (g.sh.hidC[c - 1] ? '+' : '−') + '</b>' : '') + '<b class="rs" data-c="' + c + '" aria-hidden="true"></b>' : '') + '</span>';
      }
      return h;
    },
    row: function (g, r, sel) {
      var sh = g.sh, on = sel && r >= sel.r1 && r <= sel.r2, h = '<div class="gr" data-r="' + r + '" style="width:' + g.width + 'px"><span class="gh gr-h' + (on ? ' on' : '') + (sh.lvlR && sh.lvlR[r] ? ' lvr' + Math.min(3, sh.lvlR[r]) : '') + '" data-act="g-row" data-r="' + r + '">' + (r + 1) + (sh.lvlR && (sh.lvlR[r - 1] || 0) > (sh.lvlR[r] || 0) ? '<b class="gbtn" data-act="gp-toggle" data-k="r" data-i="' + r + '">' + (sh.hidR[r - 1] ? '+' : '−') + '</b>' : '') + '<b class="rs r" data-r="' + r + '" aria-hidden="true"></b></span>', c, skip = 0;
      for (c = 0; c < g.cols; c++) {
        var w = g.colW(c), m = Wb.mergeAt(sh, r, c);
        if (m && (c > m.c1 || r > m.r1)) { h += '<span class="gc" style="width:' + w + 'px"></span>'; continue; }
        if (m) { w = 0; for (var k = m.c1; k <= m.c2; k++) w += g.colW(k); }
        var f = Fmt.cell(sh, r, c), st = Wb.style(sh, r, c);
        if (!w) { h += '<span class="gc" style="width:0;border:0"></span>'; continue; }
        var cf = window.Xrich && Xrich.has(sh) ? Xrich.cf(sh, r, c, f.v) : null, over = !f.n && !f.x && f.t && !st.wrap && (!st.al || st.al === 'left') && spills(g, sh, r, c, f.t, st, w);
        h += '<span class="gc' + (f.n ? ' num' : '') + (f.x ? ' err' : '') + (window.Marks ? Marks.cls(sh, r, c) : '') + (window.Tbl ? Tbl.cls(sh, r, c) : '') + (g.fx && c < g.fx ? ' fz' : '') + '" data-c="' + c + '" style="width:' + w + 'px;' + cellStyle(st, g.fx && c < g.fx ? g.colX[c] : 0) + (cf ? cf.css : '') + (over ? 'overflow:visible;z-index:1;' : '') + '">' + (cf && cf.icon ? '<i class="cfi" style="color:' + cf.icon.c + '">' + cf.icon.g + '</i>' : '') + (f.t ? esc(f.t) : '') + '</span>';
      }
      return h + '</div>';
    },
    // formula bar: the cell, fx, the text being edited
    bar: function (ref, raw, ro) {
      return '<input class="fb-ref" id="fbRef" type="text" value="' + esc(ref) + '" aria-label="' + esc(t('mi.goto')) + '" autocomplete="off" spellcheck="false" readonly><button type="button" class="fb-fx" data-act="fn-open" aria-label="' + esc(t('fx.insert')) + '"' + (ro ? ' disabled' : '') + '>fx</button>'
        + '<input class="fb-in" id="fbIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="' + esc(raw) + '" aria-label="' + esc(t('fb.label')) + '"' + (ro ? ' readonly' : '') + '>'
        + '<button type="button" class="fb-ok" data-act="fb-cancel" aria-label="' + esc(t('a.cancel')) + '">' + Ui.ic('close', 20, 2) + '</button><button type="button" class="fb-ok go" data-act="fb-ok" aria-label="' + esc(t('a.done')) + '">' + Ui.ic('check', 20, 2.4) + '</button>';
    },
    stats: function (s) {
      return ['sum', 'avg', 'min', 'max', 'count'].map(function (k) { return '<span><small>' + esc(t('st.' + k)) + '</small> ' + esc(s[k]) + '</span>'; }).join('');
    },
    quick: function () {
      return '<button type="button" data-act="q-cut">' + esc(t('q.cut')) + '</button><button type="button" data-act="q-copy">' + esc(t('q.copy')) + '</button><button type="button" data-act="q-paste">' + esc(t('q.paste')) + '</button><i></i>'
        + '<button type="button" class="sum" data-act="q-sum">∑ ' + esc(t('q.sum')) + '</button><button type="button" class="mo" data-act="q-more" aria-label="' + esc(t('a.more')) + '">' + Ui.ic('more', 18) + '</button>';
    },
    tabs: function (sheets, on, edit) {
      return sheets.map(function (s, i) { return s.hiddenSheet ? '' : '<button type="button" class="bk-tab' + (i === on ? ' on' : '') + (s.tab ? ' tc' : '') + '" data-act="b-sheet" data-i="' + i + '"' + (s.tab ? ' style="--tc:' + esc(s.tab) + '"' : '') + '>' + esc(s.name) + '</button>'; }).join('')
        + (edit ? '<button type="button" class="bk-tab add" data-act="sh-open" aria-label="' + esc(t('sh.title')) + '">' + Ui.ic('plus', 20, 2.2) + '</button>' : '');
    },
    tools: function (tab, st, nfLabel) {
      var T = ['format', 'cells', 'data', 'insert'];
      return '<div class="tl-tabs">' + T.map(function (k) { return '<button type="button" class="tl-tab' + (k === tab ? ' on' : '') + '" data-act="tl-tab" data-k="' + k + '">' + esc(t('tl.' + k)) + '</button>'; }).join('') + '</div>' + GridView.toolRow(tab, st, nfLabel);
    },
    // the row of tools under the tabs
    toolRow: function (tab, st, nfLabel) {
      var h = '<div class="tl-row">';
      function tb(act, label, icon, on) { return '<button type="button" class="tl-b' + (on ? ' on' : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + icon + '</button>'; }
      if (tab === 'format') {
        h += '<button type="button" class="tl-pill" data-act="nf-open">' + esc(nfLabel) + Ui.ic('down', 14, 2.4) + '</button><button type="button" class="tl-pill fo" data-act="fo-open" aria-label="' + esc(t('fm.font')) + '"><span style="font-family:' + Fonts.css(st.f || Fonts.def) + '">' + esc(st.f || Fonts.def) + '</span>' + Ui.ic('down', 14, 2.4) + '</button><i></i>'
          + tb('f-bold', t('f.bold'), '<b>B</b>', st.b) + tb('f-italic', t('f.italic'), '<em>I</em>', st.i) + tb('f-under', t('f.underline'), '<u>U</u>', st.u)
          + tb('fm-open', t('f.fill'), Ui.ic('marker', 20, 1.8) + '<span class="sw" style="background:' + (st.bg || 'transparent') + '"></span>', !!st.bg)
          + tb('f-al-left', t('f.alignl'), Ui.ic('alignl', 22, 1.9), st.al === 'left') + tb('f-al-center', t('f.alignc'), Ui.ic('alignc', 22, 1.9), st.al === 'center') + tb('f-al-right', t('f.alignr'), Ui.ic('alignr', 22, 1.9), st.al === 'right');
      } else if (tab === 'cells') {
        h += '<button type="button" class="tl-pill" data-act="rc-open">' + esc(t('rc.title')) + '</button><button type="button" class="tl-pill" data-act="rc-merge">' + esc(t('rc.merge')) + '</button><button type="button" class="tl-pill" data-act="rc-freeze">' + esc(t('rc.freeze')) + '</button><button type="button" class="tl-pill" data-act="fm-open">' + esc(t('fm.title')) + '</button>';
      } else if (tab === 'data') {
        h += '<button type="button" class="tl-pill" data-act="sf-open">' + esc(t('sf.title')) + '</button><button type="button" class="tl-pill" data-act="fd-open">' + esc(t('fd.title')) + '</button><button type="button" class="tl-pill" data-act="q-sum">∑ ' + esc(t('q.sum')) + '</button>';
      } else {
        h += '<button type="button" class="tl-pill" data-act="ch-open">' + esc(t('ch.title')) + '</button><button type="button" class="tl-pill" data-act="fn-open">' + esc(t('fx.insert')) + '</button><button type="button" class="tl-pill" data-act="sh-open">' + esc(t('sh.title')) + '</button>';
      }
      return h + '</div>';
    }
  };
})();
