// PageSetup — Word's Page Setup dialog: paper size, orientation and the four margins. The change is written into the document's section properties (Plan sends it as the replacement of that block) and the sheets are drawn again at once.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, S = window.PageSetup = {};
  var PAPER = { a4: [11906, 16838], letter: [12240, 15840], legal: [12240, 20160], a5: [8391, 11906], a3: [16838, 23811] }, NAMES = { a4: 'A4', letter: 'Letter', legal: 'Legal', a5: 'A5', a3: 'A3' };
  var FMTS = [['decimal', '1, 2'], ['lowerRoman', 'i, ii'], ['upperRoman', 'I, II'], ['lowerLetter', 'a, b'], ['upperLetter', 'A, B']];
  var curSec = 0;
  function sect() { var l = Sec.list(); return l[Sec.many() ? curSec : 0] || null; }
  function cm(tw) { return Math.round(tw / 567 * 100) / 100; }
  function kind(s) { var w = Math.min(s.w, s.h), h = Math.max(s.w, s.h), k = Object.keys(PAPER).filter(function (n) { return Math.abs(PAPER[n][0] - w) < 40 && Math.abs(PAPER[n][1] - h) < 40; })[0]; return k || 'custom'; }
  function f(id, label, v) { return '<label class="pa-f"><span>' + esc(label) + '</span><input id="' + id + '" type="text" inputmode="decimal" value="' + v + '" autocomplete="off"><em>cm</em></label>'; }
  function seg(id, list, cur) { return '<span class="pa-seg" id="' + id + '">' + list.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === cur ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</span>'; }
  A['ps-open'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); curSec = Sec.at(); var s = sect(); if (!s) return Ui.toast(t('ps.fail'));
    var k = kind(s), land = s.w > s.h;
    Ui.sheet('psetup', '<h2 class="sh-h">' + esc(t('ps.title')) + '</h2>' + Sec.scopeHtml(curSec) + '<div class="pa-f"><span>' + esc(t('ps.paper')) + '</span>' + seg('psPaper', Object.keys(PAPER).map(function (n) { return [n, NAMES[n]]; }), k) + '</div>'
      + '<div class="pa-f"><span>' + esc(t('ps.orient')) + '</span>' + seg('psOr', [['p', t('ps.portrait')], ['l', t('ps.landscape')]], land ? 'l' : 'p') + '</div>'
      + '<div class="pa-grid">' + f('psT', t('ps.top'), cm(s.t)) + f('psB', t('ps.bottom'), cm(s.b)) + f('psL', t('ps.left'), cm(s.l)) + f('psR', t('ps.right'), cm(s.r)) + '</div>'
      + '<div class="pa-f"><span>' + esc(t('ps.cols')) + '</span>' + seg('psCols', [[1, '1'], [2, '2'], [3, '3']], s.cols || 1) + '</div>'
      + '<div class="pa-grid">' + f('psGap', t('ps.gap'), cm(s.space || 720)) + '</div>'
      + '<div class="pa-f chk"><button type="button" id="psBorder" class="pa-tg' + (s.border ? ' on' : '') + '" data-act="ps-border"></button><span>' + esc(t('ps.border')) + '</span></div>'
      + '<label class="pa-f"><span>' + esc(t('ps.pgstart')) + '</span><input id="psStart" type="text" inputmode="numeric" value="' + (s.pgStart === null || s.pgStart === undefined ? '' : s.pgStart) + '" placeholder="' + esc(t('ps.pgcont')) + '" autocomplete="off"></label>'
      + '<div class="pa-f"><span>' + esc(t('ps.pgfmt')) + '</span>' + seg('psFmt', FMTS, s.pgFmt || 'decimal') + '</div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="ps-go">' + esc(t('a.apply')) + '</button></div>');
  };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#psPaper button, #psOr button, #psFmt button, #psCols button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
  function pick(id) { var o = $(id) && $(id).querySelector('.on'); return o ? o.dataset.v : null; }
  function tw(id) { return Math.max(0, Math.round((parseFloat(String($(id).value).replace(',', '.')) || 0) * 567)); }
  // a field the person did not touch keeps the value each section already has (the box shows centimetres rounded to two places: writing that back would shift 1800 twips to 1797)
  function changed(id, orig) { var v = parseFloat(String($(id).value).replace(',', '.')); return !isFinite(v) || Math.abs(v - cm(orig)) >= 0.006; }
  A['ps-border'] = function () { $('psBorder').classList.toggle('on'); };
  // one section's page settings written whole (columns and border included: leaving them out would drop them from the file); a section in the middle of the file keeps them beside its break
  function fullSet(sc) { return { pageWidth: sc.w, pageHeight: sc.h, orientation: sc.w > sc.h ? 'landscape' : 'portrait', marginTop: sc.t, marginBottom: sc.b, marginLeft: sc.l, marginRight: sc.r, pageBorder: !!sc.border, columns: sc.cols || 1, colSpace: sc.space }; }
  function store(i, list, brk, set, pg) {
    if (i === list.length - 1) { if (set) Doc.sectOpts = set; if (pg) Doc.pgOpts = pg; }
    else if (brk[i]) { var cur = brk[i].dataset.sset ? JSON.parse(brk[i].dataset.sset) : {}; brk[i].dataset.sset = JSON.stringify(Object.assign(cur, set || {}, pg ? { pg: pg } : {})); brk[i].dataset.m = '1'; }   // merged: the first-page flag of the header dialog lives in the same JSON
  }
  function done() {
    var p = Doc.paper(); if (window.PageView && p.classList.contains('pgedit')) PageView.editStyle(p, true);   // one section more or less alike: the sheet's padding follows
    if (window.PageView) PageView.sig = null;   // the pages of the reading view are built again (the columns changed, the text did not)
    Doc.snap(); Doc.touch(); if (window.Paginate) Paginate.schedule(0); Doc.dirty = true; Doc.chrome();
  }
  A['ps-go'] = function () {
    var s = sect(), pk = pick('psPaper'), land = pick('psOr') === 'l', paperMoved = pk !== kind(s) || land !== (s.w > s.h), base = PAPER[pk] || [Math.min(s.w, s.h), Math.max(s.w, s.h)];
    var targets = Sec.many() ? Sec.targets(curSec) : [0], list = Sec.list(), brk = Sec.breaks(); Ui.closeSheet();
    var st = parseInt(String($('psStart').value).replace(/\D/g, ''), 10), start = isFinite(st) ? st : null, fmt = pick('psFmt') || 'decimal', pg = { fmt: fmt === 'decimal' ? undefined : fmt, start: start === null ? undefined : start };
    var edge = { t: changed('psT', s.t), b: changed('psB', s.b), l: changed('psL', s.l), r: changed('psR', s.r) }, border = $('psBorder').classList.contains('on'), borderMoved = border !== !!s.border;
    var nc = +pick('psCols') || 1, colsMoved = nc !== (s.cols || 1), gapMoved = changed('psGap', s.space || 720), sizeMoved = paperMoved || edge.t || edge.b || edge.l || edge.r || borderMoved || colsMoved || gapMoved;
    targets.forEach(function (i) {
      var sc = list[i], set = null;
      if (sizeMoved) {
        if (paperMoved) { sc.w = land ? base[1] : base[0]; sc.h = land ? base[0] : base[1]; }
        if (edge.t) sc.t = tw('psT'); if (edge.b) sc.b = tw('psB'); if (edge.l) sc.l = tw('psL'); if (edge.r) sc.r = tw('psR');
        if (borderMoved) sc.border = border; if (colsMoved) sc.cols = nc; if (gapMoved) sc.space = Math.max(0, tw('psGap')); set = fullSet(sc);
      }
      sc.pgStart = start; sc.pgFmt = fmt; store(i, list, brk, set, pg);
    });
    done(); if (colsMoved && nc > 1) Ui.toast(t('ps.colsnote'));
  };
  // Layout ▸ Columns: the number of columns of the section the caret is in
  // the margins of one section, from the rulers (twips; only the sides given)
  S.setMargins = function (i, m) {
    var list = Sec.list(), sc = list[i]; if (!sc) return; ['t', 'b', 'l', 'r'].forEach(function (k) { if (m[k] !== undefined) sc[k] = m[k]; });
    store(i, list, Sec.breaks(), fullSet(sc), null); done();
  };
  S.setCols = function (n) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var i = Sec.at(), list = Sec.list(), sc = list[i]; if (!sc) return Ui.toast(t('ps.fail'));
    if ((sc.cols || 1) === n) return; sc.cols = n; store(i, list, Sec.breaks(), fullSet(sc), null); done(); if (n > 1) Ui.toast(t('ps.colsnote'));
  };
  A['cols-menu'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var r = el.getBoundingClientRect(), s = Sec.list()[Sec.at()], cur = s ? s.cols || 1 : 1;
    PopMenu.show(r.left, r.bottom + 2, [[1, 'cols.one'], [2, 'cols.two'], [3, 'cols.three']].map(function (c) { return { t: t(c[1]), on: cur === c[0], go: function () { S.setCols(c[0]); } }; }).concat(['-', { t: t('cols.more'), go: function () { A['ps-open'](); } }]), { from: el });
  };
})();
