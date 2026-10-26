// Sec — the sections of the file: which one the caret is in, and the section break (the thin rule) that ends each of them. Section i ends at the i-th break; the last one ends the file.
(function () {
  'use strict';
  var S = window.Sec = {};
  S.list = function () { var d = window.DocRich && DocRich.doc; return d ? d.sects : []; };
  S.breaks = function () { return Array.prototype.filter.call(Doc.paper().children, function (b) { return b.classList.contains('sb'); }); };
  // the section the caret (or the given block) is in
  S.at = function (block) {
    var b = block || (window.Edit && Edit.block()); if (!b) { var r = Doc.range, n = r && r.startContainer, el = n && (n.nodeType === 3 ? n.parentElement : n); b = el && el.closest ? el.closest('#paper > .b') : null; }
    if (!b) return 0; var i = 0; for (var el2 = Doc.paper().firstElementChild; el2 && el2 !== b; el2 = el2.nextElementSibling) if (el2.classList.contains('sb')) i++;
    return Math.min(i, Math.max(0, S.list().length - 1));
  };
  // do the sections differ in sheet size or margins (then each block carries its own offsets)?
  S.multi = function () { var l = S.list(); if (l.length < 2) return false; var a = l[0]; return l.some(function (s) { return s.w !== a.w || s.h !== a.h || s.t !== a.t || s.b !== a.b || s.l !== a.l || s.r !== a.r; }); };
  S.many = function () { return S.list().length > 1; };
  // page numbers as Word writes them: decimal, lowerRoman, upperRoman, lowerLetter, upperLetter
  function roman(n) { var m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], o = ''; m.forEach(function (p) { while (n >= p[0]) { o += p[1]; n -= p[0]; } }); return o; }
  function letters(n) { var o = ''; while (n > 0) { n--; o = String.fromCharCode(97 + n % 26) + o; n = Math.floor(n / 26); } return o; }
  S.num = function (n, fmt) {
    if (n < 1) return String(n);
    if (fmt === 'lowerRoman') return roman(n); if (fmt === 'upperRoman') return roman(n).toUpperCase();
    if (fmt === 'lowerLetter') return letters(n); if (fmt === 'upperLetter') return letters(n).toUpperCase();
    return String(n);
  };
  // the number of every sheet: a section that names a start begins there, otherwise it goes on from the sheet before; each section shows its own format. `sheets` = [{ s: section, first: its first sheet? }]
  S.counts = function (sheets) {
    var cur = 0; return sheets.map(function (p) { var s = p.s || {}; cur = p.first && s.pgStart !== null && s.pgStart !== undefined ? s.pgStart : cur + 1; return cur; });
  };
  S.numbers = function (sheets) { return S.counts(sheets).map(function (n, i) { return S.num(n, (sheets[i].s || {}).pgFmt); }); };
  // the header (w = 'hdr') or footer ('ftr') a sheet shows: the first-page one when its section asks for it, the even-page one on even page numbers when the file has odd and even pages, else the usual one
  S.pick = function (s, w, first, n) {
    var d = window.DocRich && DocRich.doc; if (first && s.title) return s[w].first;
    if (d && d.evenOdd && n % 2 === 0) return s[w].even || '';
    return s[w]['default'];
  };
  // the scope control of a dialog: this section or the whole file (only when there are several)
  S.scopeHtml = function (cur) {
    if (!S.many()) return ''; var t = Ui.t;
    return '<div class="pa-f"><span>' + Ui.esc(t('sc.apply')) + '</span><span class="pa-seg" id="scScope"><button type="button" data-v="one" class="on">' + Ui.esc(t('sc.this', { i: cur + 1, n: S.list().length })) + '</button><button type="button" data-v="all">' + Ui.esc(t('sc.all')) + '</button></span></div>';
  };
  S.targets = function (cur) { var o = document.querySelector('#scScope .on'), all = o && o.dataset.v === 'all'; return all ? S.list().map(function (s, i) { return i; }) : [cur]; };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#scScope button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
})();
