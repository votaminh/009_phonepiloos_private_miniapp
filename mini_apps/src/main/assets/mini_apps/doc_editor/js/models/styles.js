// Styles — the paragraph and character styles the file defines (Normal, Title, Heading 1…): what each looks like (so the page draws them the way Word does) and the list the style gallery shows.
(function () {
  'use strict';
  var S = window.Styles = { list: [], map: {}, defaults: {}, def: 'Normal' }, el = null;
  function esc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  S.load = function (list, defaults) {
    S.list = list || []; S.map = {}; S.list.forEach(function (s) { S.map[s.id] = s; }); S.defaults = defaults || {};
    var d = S.list.filter(function (s) { return s.def && s.type === 'paragraph'; })[0]; S.def = d ? d.id : 'Normal'; S.inject();
  };
  S.get = function (id) { return S.map[id] || null; };
  // the look one style gives its text
  S.css = function (s) {
    var d = s.d || {}, css = '', fam = d.fontAscii || d.font;
    if (fam) css += 'font-family:' + Render.family(fam) + ';';
    if (d.sizeHalfPoints) css += 'font-size:' + (d.sizeHalfPoints / 2 * 96 / 72) + 'px;';
    if (d.bold !== undefined) css += 'font-weight:' + (d.bold ? 700 : 400) + ';';
    if (d.italic !== undefined) css += 'font-style:' + (d.italic ? 'italic' : 'normal') + ';';
    if (d.color && d.color !== 'auto') css += 'color:#' + d.color + ';';
    if (d.caps === 'all') css += 'text-transform:uppercase;'; else if (d.caps === 'small') css += 'font-variant:small-caps;';
    if (d.charSpacingTwips) css += 'letter-spacing:' + (d.charSpacingTwips / 15) + 'px;';
    var dec = (d.underline ? 'underline ' : '') + (d.strike ? 'line-through' : ''); if (dec) css += 'text-decoration:' + dec + ';';
    return css;
  };
  S.inject = function () {
    var css = S.list.filter(function (s) { return s.type === 'paragraph'; }).map(function (s) { return '.paper .b[data-st="' + esc(s.id) + '"]{' + S.css(s) + '}'; }).join('\n');
    var base = S.defaults || {}, f = Render.family(base.asciiFont || 'Calibri');
    css += '\n.paper.pgedit{font-family:' + f + ';' + (base.sizeHalfPoints ? 'font-size:' + (base.sizeHalfPoints / 2 * 96 / 72) + 'px;' : '') + '}';
    if (!el) { el = document.createElement('style'); el.id = 'docStyles'; document.head.appendChild(el); } el.textContent = css;
  };
  // the styles Word would offer in its gallery, in its order
  S.gallery = function () {
    return S.list.filter(function (s) { return s.type === 'paragraph' && !s.sem && (s.q || s.def || /^Heading [1-3]$/.test(s.name)) && !/^(Header|Footer)/.test(s.name); }).sort(function (a, b) { return rank(a) - rank(b) || (a.pri - b.pri); });
  };
  var ORDER = ['normal', 'no spacing', 'heading 1', 'heading 2', 'heading 3', 'title', 'subtitle', 'subtle emphasis', 'emphasis', 'intense emphasis', 'strong', 'quote', 'intense quote', 'list paragraph'];
  function rank(s) { var i = ORDER.indexOf(String(s.name).toLowerCase()); return i < 0 ? 99 : i; }
  S.label = function (s) { var n = String(s.name); return n.charAt(0).toUpperCase() + n.slice(1); };
  S.paragraph = function () { return S.list.filter(function (s) { return s.type === 'paragraph' && !s.sem; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); };
})();
