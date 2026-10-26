// HeaderFooter — Insert ▸ Header & Footer: the text at the top and bottom of every sheet, its alignment, the page number ({PAGE}) and the page count ({NUMPAGES}), and a different one for the first sheet.
// The new text replaces the part in the file (the engine writes real PAGE / NUMPAGES fields); the sheets are drawn again at once.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, H = window.HeaderFooter = { last: 'hfH' }, PAGE = '', TOTAL = '';
  var JC = { left: 'left', center: 'center', right: 'right' };
  var curSec = 0;
  function sect() { var l = Sec.list(); return l[Sec.many() ? curSec : 0] || null; }
  function plain(h) { return (h || '').replace(/<\/p>\s*<p/g, '\n<p').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split('\n')[0]; }
  function alignOf(h) { var m = /text-align:\s*(left|center|right)/.exec(h || ''); return m ? m[1] : 'left'; }
  function field(id, label, v, al) { return '<div class="pa-f hf-f"><span>' + esc(label) + '</span><input id="' + id + '" type="text" value="' + esc(v) + '" autocomplete="off"><span class="pa-seg" id="' + id + 'A">' + ['left', 'center', 'right'].map(function (a) { return '<button type="button" data-v="' + a + '" class="' + (a === al ? 'on' : '') + '">' + esc(t('p.' + a).replace(/^Align /, '').replace(/^Căn /, '')) + '</button>'; }).join('') + '</span></div>'; }
  function build(first, even) {
    var s = sect(), o = H.draft || { first: s.title };
    return '<h2 class="sh-h">' + esc(t('hf.title')) + '</h2>' + Sec.scopeHtml(curSec) + field('hfH', t('hf.header'), plain(s.hdr['default']), alignOf(s.hdr['default'])) + field('hfF', t('hf.footer'), plain(s.ftr['default']), alignOf(s.ftr['default']))
      + '<div class="pa-f"><span>' + esc(t('hf.tokens')) + '</span><span class="pa-seg"><button type="button" data-act="hf-tok" data-v="{PAGE}">' + esc(t('hf.page')) + '</button><button type="button" data-act="hf-tok" data-v="{NUMPAGES}">' + esc(t('hf.pages')) + '</button></span></div>'
      + '<div class="pa-f chk"><button type="button" id="hfFirst" class="pa-tg' + (first ? ' on' : '') + '" data-act="hf-first"></button><span>' + esc(t('hf.first')) + '</span></div>'
      + (first ? field('hfH1', t('hf.header1'), plain(s.hdr.first), alignOf(s.hdr.first)) + field('hfF1', t('hf.footer1'), plain(s.ftr.first), alignOf(s.ftr.first)) : '')
      + '<div class="pa-f chk"><button type="button" id="hfEven" class="pa-tg' + (even ? ' on' : '') + '" data-act="hf-even"></button><span>' + esc(t('hf.even')) + '</span></div>'
      + (even ? field('hfH2', t('hf.header2'), plain(s.hdr.even), alignOf(s.hdr.even)) + field('hfF2', t('hf.footer2'), plain(s.ftr.even), alignOf(s.ftr.even)) : '')
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="hf-go">' + esc(t('a.apply')) + '</button></div>';
  }
  A['hf-open'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); curSec = Sec.at(); var s = sect(); if (!s) return Ui.toast(t('ps.fail'));
    Ui.sheet('hf', build(s.title, !!(DocRich.doc && DocRich.doc.evenOdd)));
  };
  document.addEventListener('focusin', function (e) { if (e.target && /^hf[HF][12]?$/.test(e.target.id)) H.last = e.target.id; });
  A['hf-tok'] = function (el) { var i = $(H.last) || $('hfF'); if (!i) return; var a = i.selectionStart == null ? i.value.length : i.selectionStart; i.value = i.value.slice(0, a) + el.dataset.v + i.value.slice(i.selectionEnd == null ? a : i.selectionEnd); i.focus(); var p = a + el.dataset.v.length; i.setSelectionRange(p, p); };
  // turning "first page" or "odd and even" on or off draws the dialog again: what was typed (and each alignment) stays
  var IDS = ['hfH', 'hfF', 'hfH1', 'hfF1', 'hfH2', 'hfF2'];
  function redraw(first, even) {
    var keep = {}, al = {}, sc = document.querySelector('#scScope .on'), scope = sc && sc.dataset.v; IDS.forEach(function (id) { if ($(id)) { keep[id] = $(id).value; al[id] = seg(id); } });
    Ui.sheet('hf', build(first, even));
    var sb = scope && document.querySelector('#scScope [data-v="' + scope + '"]'); if (sb) Array.prototype.forEach.call(sb.parentNode.children, function (x) { x.classList.toggle('on', x === sb); });
    IDS.forEach(function (id) { if (!$(id) || keep[id] === undefined) return; $(id).value = keep[id]; var b = $(id + 'A') && $(id + 'A').querySelector('[data-v="' + al[id] + '"]'); if (b) Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
  }
  A['hf-first'] = function () { redraw(!$('hfFirst').classList.contains('on'), $('hfEven').classList.contains('on')); };
  A['hf-even'] = function () { redraw($('hfFirst').classList.contains('on'), !$('hfEven').classList.contains('on')); };
  function seg(id) { var o = $(id + 'A') && $(id + 'A').querySelector('.on'); return o ? o.dataset.v : 'left'; }
  function toHtml(tx, al) { return tx ? '<p class="hf-p" style="text-align:' + al + '">' + esc(tx) + '</p>' : ''; }
  function part(tx, al) { return { text: tx.replace(/\{PAGE\}/g, PAGE).replace(/\{NUMPAGES\}/g, TOTAL), pageNumber: /\{PAGE\}/.test(tx), paras: [{ align: al, runs: [{ text: tx.replace(/\{PAGE\}/g, PAGE).replace(/\{NUMPAGES\}/g, TOTAL) }] }] }; }
  A['hf-go'] = function () {
    var s0 = sect(); if (!s0) return; var first = $('hfFirst').classList.contains('on'), o = { titlePg: first }, list = Sec.list(), last = list.length - 1, targets = Sec.many() ? Sec.targets(curSec) : [0];
    var h = $('hfH').value, f = $('hfF').value, ha = seg('hfH'), fa = seg('hfF'), h1, f1, ha1, fa1;
    if (first) { h1 = $('hfH1').value; f1 = $('hfF1').value; ha1 = seg('hfH1'); fa1 = seg('hfF1'); }
    var even = $('hfEven').classList.contains('on'), h2, f2, ha2, fa2; if (even) { h2 = $('hfH2').value; f2 = $('hfF2').value; ha2 = seg('hfH2'); fa2 = seg('hfF2'); }
    o.evenAndOddHeaders = even;   // the whole file, not one section
    targets.forEach(function (i) {
      var s = list[i]; s.hdr['default'] = toHtml(h, ha); s.ftr['default'] = toHtml(f, fa);
      if (i === last) { o.header = part(h, ha); o.footer = part(f, fa); if (first) { o.headerFirst = part(h1, ha1); o.footerFirst = part(f1, fa1); } if (even) { o.headerEven = part(h2, ha2); o.footerEven = part(f2, fa2); } }
      else {
        if (s.end === undefined) return;   // a section made by a new break in this session has no XML of its own yet: its header and footer show here, the saved file keeps the copied ones
        // a section in the middle of the file: its own header/footer parts, and (when asked) its own first-page ones, written beside its section break
        Doc.hfSect = Doc.hfSect.filter(function (e) { return !(e.lastBlockIndex === s.end && (!e.variant || (first && e.variant === 'first') || (even && e.variant === 'even'))); });
        Doc.hfSect.push({ lastBlockIndex: s.end, kind: 'header', hf: part(h, ha) }, { lastBlockIndex: s.end, kind: 'footer', hf: part(f, fa) });
        if (first) Doc.hfSect.push({ lastBlockIndex: s.end, kind: 'header', variant: 'first', hf: part(h1, ha1) }, { lastBlockIndex: s.end, kind: 'footer', variant: 'first', hf: part(f1, fa1) });
        if (even) Doc.hfSect.push({ lastBlockIndex: s.end, kind: 'header', variant: 'even', hf: part(h2, ha2) }, { lastBlockIndex: s.end, kind: 'footer', variant: 'even', hf: part(f2, fa2) });
        var brk = Sec.breaks()[i]; if (brk) { var cur = brk.dataset.sset ? JSON.parse(brk.dataset.sset) : {}; cur.tp = first; brk.dataset.sset = JSON.stringify(cur); brk.dataset.m = '1'; }
      }
      if (first) { s.hdr.first = toHtml(h1, ha1); s.ftr.first = toHtml(f1, fa1); }
      if (even) { s.hdr.even = toHtml(h2, ha2); s.ftr.even = toHtml(f2, fa2); }
      s.title = first;
    });
    if (DocRich.doc) DocRich.doc.evenOdd = even;
    Doc.hfOpts = Object.assign(targets.indexOf(last) >= 0 ? {} : (Doc.hfOpts || {}), targets.indexOf(last) >= 0 ? o : { evenAndOddHeaders: even });
    Ui.closeSheet(); Doc.touch(); Doc.dirty = true; if (window.Paginate) Paginate.schedule(0); Doc.chrome();
  };
})();
