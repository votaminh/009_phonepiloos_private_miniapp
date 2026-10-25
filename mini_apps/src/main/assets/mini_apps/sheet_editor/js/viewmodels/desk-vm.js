// Desk — the tool bar of a computer (laptop and desktop): undo and redo, print, paint format, zoom, number formats, font and size, bold / italic / underline / strike, colours, borders, merge, alignment, wrapping, link, note, chart, filter, functions.
// One row of buttons that stay in step with the selected cell. The menus above it are in desk-menu.js. A tablet and a phone keep the tabs at the bottom.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, F = window.Format, X = window.Fmt2, D = window.Desk = { items: {} };
  function b(name, icon, label, o) { o = o || {}; return '<button type="button" class="dk-b' + (o.cls ? ' ' + o.cls : '') + '" data-dk="' + name + '" title="' + Ui.esc(label) + '" aria-label="' + Ui.esc(label) + '">' + icon + (o.caret ? Ui.ic('down', 12, 2.6) : '') + '</button>'; }
  function sep() { return '<i class="dk-sep"></i>'; }
  function ic(n, s) { return Ui.ic(n, s || 20, 1.8); }

  D.build = function () {
    var el = $('dkTools'); if (!el) return;
    el.innerHTML = b('undo', ic('undo'), t('tb.undo')) + b('redo', ic('redo'), t('tb.redo')) + b('print', ic('print'), t('tb.print')) + b('paint', ic('paint'), t('tb.paint')) + sep()
      + '<button type="button" class="dk-b dk-w" data-dk="zoom" title="' + Ui.esc(t('tb.zoom')) + '"><span id="dkZoom">100%</span>' + Ui.ic('down', 12, 2.6) + '</button>' + sep()
      + b('currency', ic('money'), t('tb.currency')) + b('percent', ic('percent'), t('tb.percent')) + b('decless', ic('decless'), t('tb.decless')) + b('decmore', ic('decmore'), t('tb.decmore'))
      + '<button type="button" class="dk-b dk-w" data-dk="nf" title="' + Ui.esc(t('tb.moreformats')) + '">123' + Ui.ic('down', 12, 2.6) + '</button>' + sep()
      + '<button type="button" class="dk-b dk-font" data-dk="font" title="' + Ui.esc(t('tb.font')) + '"><span id="dkFont">Calibri</span>' + Ui.ic('down', 12, 2.6) + '</button>'
      + '<span class="dk-size"><button type="button" class="dk-b sm" data-dk="sizedec" aria-label="−">' + Ui.ic('minus', 14, 2.4) + '</button><input id="dkSize" type="text" inputmode="numeric" value="11" aria-label="' + Ui.esc(t('tb.size')) + '"><button type="button" class="dk-b sm" data-dk="sizeinc" aria-label="+">' + Ui.ic('plus', 14, 2.4) + '</button></span>' + sep()
      + b('bold', '<b>B</b>', t('f.bold'), { cls: 'tx' }) + b('italic', '<i>I</i>', t('f.italic'), { cls: 'tx' }) + b('under', '<u>U</u>', t('f.underline'), { cls: 'tx' }) + b('strike', '<s>S</s>', t('f.strike'), { cls: 'tx' })
      + b('textc', ic('textc') + '<span class="dk-bar" id="dkTc"></span>', t('tb.textcolor'), { cls: 'col', caret: 1 }) + b('fill', ic('marker') + '<span class="dk-bar" id="dkFc"></span>', t('tb.fill'), { cls: 'col', caret: 1 }) + b('borders', ic('bdall'), t('tb.borders'), { caret: 1 }) + b('merge', ic('merge'), t('tb.merge'), { caret: 1 }) + sep()
      + b('halign', ic('alignl'), t('tb.halign'), { caret: 1 }) + b('valign', ic('valbot'), t('tb.valign'), { caret: 1 }) + b('wrap', ic('wrap'), t('tb.wrap'), { caret: 1 }) + sep()
      + b('link', ic('link'), t('tb.link')) + b('note', ic('note'), t('tb.note')) + b('chart', ic('chart'), t('tb.chart')) + b('filter', ic('filter'), t('tb.filter')) + b('sum', ic('sigma'), t('tb.functions'), { caret: 1 });
    D.sync();
  };

  // ---- what each button does ------------------------------------------------------------------------------------------------------
  var DO = {
    undo: function () { A['b-undo'](); }, redo: function () { A['b-redo'](); }, print: function () { A['m-pdf'](); }, paint: function (el, e) { X.pick(e && e.detail > 1); },
    zoom: function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map(function (z) { return { t: Math.round(z * 100) + '%', on: Math.abs(G.z - z) < 0.02, go: function () { G.setZoom(z); } }; }), { from: el }); },
    currency: function () { F.apply({ nf: D.currency() }); }, percent: function () { F.apply({ nf: '0%' }); }, decless: function () { D.decimals(-1); }, decmore: function () { D.decimals(1); },
    nf: function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, D.numberItems(), { from: el }); },
    font: function (el) { X.fontMenu(el); }, sizeinc: function () { A['f-size-inc'](); }, sizedec: function () { A['f-size-dec'](); },
    bold: function () { A['f-bold'](); }, italic: function () { A['f-italic'](); }, under: function () { A['f-under'](); }, strike: function () { A['f-strike'](); },
    textc: function (el) { X.colors(el, F.cur().c, function (c) { F.apply({ c: c }); }); }, fill: function (el) { X.colors(el, F.cur().bg, function (c) { F.apply({ bg: c }); }, { none: true }); },
    borders: function (el) { X.bordersPop(el); }, merge: function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, D.mergeItems(), { from: el }); },
    halign: function (el) { X.halign(el); }, valign: function (el) { X.valign(el); }, wrap: function (el) { X.wrap(el); },
    link: function () { if (window.Link) Link.open(); }, note: function () { if (window.Note) Note.open(); }, chart: function () { A['ch-open'](); }, filter: function () { A['sf-open'](); },
    sum: function (el) { var r = el.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, D.sumItems(), { from: el }); }
  };
  D.items = DO;
  D.currency = function () { return I18n.locale().indexOf('vi') === 0 ? '#,##0 "₫"' : '"$"#,##0.00'; };
  // +1 / -1 decimal place of the number format now in the cell
  D.decimals = function (d) {
    var nf = F.cur().nf || '', m = /\.(0+)/.exec(nf), n = m ? m[1].length : 0, to = Math.max(0, Math.min(10, (nf ? n : (d > 0 ? 0 : 1)) + d)), zero = to ? '.' + new Array(to + 1).join('0') : '';
    var out = !nf ? '0' + zero : m ? nf.replace(/\.0+/, zero) : /0/.test(nf) ? nf.replace(/0(?!.*0)/, '0' + zero) : '0' + zero;
    F.apply({ nf: out });
  };
  D.numberItems = function () {
    var cur = F.cur().nf || '', mk = function (key, code) { return { t: t(key), on: (code || '') === cur, go: function () { F.apply({ nf: code }); } }; };
    return [mk('nfm.auto', null), mk('nfm.text', '@'), '-', mk('nfm.number', '#,##0.00'), mk('nfm.percent', '0.00%'), mk('nfm.sci', '0.00E+00'), '-', mk('nfm.acct', '#,##0.00_);(#,##0.00)'), mk('nfm.currency', D.currency()), '-',
      mk('nfm.date', 'dd/mm/yyyy'), mk('nfm.time', 'hh:mm:ss'), mk('nfm.datetime', 'dd/mm/yyyy hh:mm'), mk('nfm.dur', '[h]:mm:ss')].concat(window.Dlg ? ['-', { t: t('nfm.custom'), go: function () { Dlg.customNumber(); } }] : []);
  };
  D.mergeItems = function () {
    return [{ t: t('mg.all'), go: function () { D.merge('all'); } }, { t: t('mg.h'), go: function () { D.merge('h'); } }, { t: t('mg.v'), go: function () { D.merge('v'); } }, '-', { t: t('mg.un'), go: function () { D.merge('un'); } }];
  };
  // merge the whole selection, each row, each column; or take the merge apart
  D.merge = function (kind) {
    var s = G.sel, sh = G.geo.sh, m = Wb.mergeAt(sh, s.r1, s.c1); if (Wb.readOnly) return;
    function one(r1, c1, r2, c2) { if (r1 === r2 && c1 === c2) return; Wb.batch(function () { var r, c; for (r = r1; r <= r2; r++) for (c = c1; c <= c2; c++) if (r !== r1 || c !== c1) Wb.setCell(sh, r, c, null, ''); }); sh.merges.push({ r1: r1, c1: c1, r2: r2, c2: c2 }); sh.ops.push({ kind: 'merge-cells', range: { startRow: r1, endRow: r2, startColumn: c1, endColumn: c2 } }); }
    if (kind === 'un') { sh.merges.filter(function (q) { return q.r1 <= s.r2 && q.r2 >= s.r1 && q.c1 <= s.c2 && q.c2 >= s.c1; }).forEach(function (q) { sh.merges.splice(sh.merges.indexOf(q), 1); sh.ops.push({ kind: 'unmerge-cells', range: { startRow: q.r1, endRow: q.r2, startColumn: q.c1, endColumn: q.c2 } }); }); }
    else if (kind === 'h') { for (var r = s.r1; r <= s.r2; r++) one(r, s.c1, r, s.c2); } else if (kind === 'v') { for (var c = s.c1; c <= s.c2; c++) one(s.r1, c, s.r2, c); } else one(s.r1, s.c1, s.r2, s.c2);
    G.changed();
  };
  // Σ: put a function over the numbers around the selection, like the ∑ of the phone
  D.sumItems = function () {
    var names = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN']; return names.map(function (n) { return { t: n, go: function () { D.autoFn(n); } }; }).concat(['-', { t: t('fx.insert'), go: function () { A['fn-open'](); } }]);
  };
  D.autoFn = function (name) {
    var s = G.sel, sh = G.geo.sh, a = G.act(); if (Wb.readOnly) return;
    function ref(r1, c1, r2, c2) { return SheetSvc.ref(r1, c1) + ':' + SheetSvc.ref(r2, c2); }
    function num(r, c) { return typeof Calc.value(sh, r, c) === 'number'; }
    Wb.batch(function () {
      if (s.r1 !== s.r2 || s.c1 !== s.c2) { if (s.r2 - s.r1 >= s.c2 - s.c1) { for (var c = s.c1; c <= s.c2; c++) Wb.setCell(sh, s.r2 + 1, c, null, '=' + name + '(' + ref(s.r1, c, s.r2, c) + ')'); } else for (var r = s.r1; r <= s.r2; r++) Wb.setCell(sh, r, s.c2 + 1, null, '=' + name + '(' + ref(r, s.c1, r, s.c2) + ')'); }
      else { var r0 = a.r - 1; while (r0 >= 0 && num(r0, a.c)) r0--; if (r0 < a.r - 1) Wb.setCell(sh, a.r, a.c, null, '=' + name + '(' + ref(r0 + 1, a.c, a.r - 1, a.c) + ')'); else { var c0 = a.c - 1; while (c0 >= 0 && num(a.r, c0)) c0--; Wb.setCell(sh, a.r, a.c, null, '=' + name + '(' + (c0 < a.c - 1 ? ref(a.r, c0 + 1, a.r, a.c - 1) : '') + ')'); } }
    });
    G.changed();
  };

  // ---- the buttons follow the selected cell ---------------------------------------------------------------------------------------
  D.sync = function () {
    var el = $('dkTools'); if (!el || !el.firstChild || !G.geo) return; var st = Wb.style(G.geo.sh, G.sel.r1, G.sel.c1);
    function on(n, v) { var x = el.querySelector('[data-dk="' + n + '"]'); if (x) x.classList.toggle('on', !!v); }
    function off(n, v) { var x = el.querySelector('[data-dk="' + n + '"]'); if (x) x.classList.toggle('off', !!v); }
    on('bold', st.b); on('italic', st.i); on('under', st.u); on('strike', st.s); on('wrap', st.wrap); on('merge', !!Wb.mergeAt(G.geo.sh, G.sel.r1, G.sel.c1)); on('paint', X.painting());
    off('undo', !Wb.canUndo()); off('redo', !Wb.canRedo());
    var f = $('dkFont'); if (f) { f.textContent = st.f || Fonts.def; f.style.fontFamily = Fonts.css(st.f || Fonts.def); }
    var sz = $('dkSize'); if (sz && document.activeElement !== sz) sz.value = st.sz || 11;
    var tc = $('dkTc'), fc = $('dkFc'); if (tc) tc.style.background = st.c || C('ink'); if (fc) fc.style.background = st.bg || 'transparent';
    var al = el.querySelector('[data-dk="halign"]'); if (al) al.innerHTML = Ui.ic(st.al === 'center' ? 'alignc' : st.al === 'right' ? 'alignr' : 'alignl', 20, 1.8) + Ui.ic('down', 12, 2.6);
    var va = el.querySelector('[data-dk="valign"]'); if (va) va.innerHTML = Ui.ic(st.va === 'top' ? 'valtop' : st.va === 'center' ? 'valmid' : 'valbot', 20, 1.8) + Ui.ic('down', 12, 2.6);
    var z = $('dkZoom'); if (z) z.textContent = Math.round(G.z * 100) + '%';
    el.classList.toggle('ro', !!Wb.readOnly);
  };
  D.init = function () {
    var el = $('dkTools'); if (!el) return; D.build();
    el.addEventListener('click', function (e) { var x = e.target.closest('[data-dk]'); if (!x || (Wb.readOnly && !/^(zoom|print|undo|redo)$/.test(x.dataset.dk))) return; if (DO[x.dataset.dk]) DO[x.dataset.dk](x, e); });
    el.addEventListener('mousedown', function (e) { if (e.target.closest('.dk-b')) e.preventDefault(); });   // the cell keeps the focus
    el.addEventListener('keydown', function (e) { if (e.target.id === 'dkSize' && e.key === 'Enter') { X.setSize(e.target.value); e.target.blur(); } });
    $('dkSize').addEventListener('change', function () { X.setSize(this.value); });
    window.addEventListener('language:changed', D.build);
  };
})();
