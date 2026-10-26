// SectionBreak — Layout ▸ Breaks: a page break, or a section break that starts the next section on a new page or right below (continuous, so the columns can change in mid-page).
// A new break copies the section it splits: same page size, margins, columns, header and footer; the engine writes it (Plan sends { sectbreak }), the section list here is split the same way.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, B = window.SectionBreak = {};
  // the break or the last page-settings block that ends the ORIGINAL section holding block b (new breaks of this session are skipped: they have no XML of their own)
  function originalEnd(k) {
    var brk = Sec.breaks(), i, e;
    for (i = k; i < brk.length; i++) { e = brk[i]; if (e.dataset.src !== undefined) return e.dataset.src; if (e.dataset.endsrc !== undefined) return e.dataset.endsrc; }
    var hb = (Doc.blocks || []).filter(function (b) { return b.hidden && /^Section properties/.test(b.label || ''); }).pop(); return hb ? String(hb.idx) : null;   // the page settings of the last section: a block the page does not draw
  }
  B.insert = function (kind) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var at = Insert.after(); if (!at) return Ui.toast(t('e.tap'));
    var list = Sec.list(), k = Sec.at(at), cur = list[k], end = originalEnd(k); if (!cur || end === null) return Ui.toast(t('ps.fail'));
    var el = document.createElement('div'); el.className = 'b lk sb'; el.dataset.t = 'x'; el.dataset.n = Doc.nid(); el.dataset.sbk = kind; el.dataset.endsrc = end; el.dataset.sbl = t(kind === 'continuous' ? 'sb.cont' : 'sb.next');
    var p = Struct.fresh(el, 'p'); p.dataset.t = 'p'; p.innerHTML = '<br data-ph>';
    // the section is split in the list: the part before the break is a copy, the part after is the old one and starts the way the break says
    var copy = Object.assign({}, cur, { end: undefined, hdr: Object.assign({}, cur.hdr), ftr: Object.assign({}, cur.ftr) });
    list.splice(k, 0, copy); list[k + 1].kind = kind === 'continuous' ? 'continuous' : 'nextPage'; list[k + 1].pgStart = null;
    // the break goes after the block holding the caret; the text after it moves into the new section
    var rest = at.nextElementSibling, after = [];
    at.after(el); if (!rest || !rest.classList.contains('ed')) el.after(p);
    Doc.snap(); Doc.dirty = true; if (window.PageView) PageView.sig = null; Doc.touch(); if (window.Paginate) Paginate.schedule(0); Doc.chrome();
    var f = el.nextElementSibling; if (f && f.classList.contains('ed')) { f.focus(); Struct.putCaret(f, { a: 0, z: 0 }); } Ui.toast(t('sb.added'));
  };
  A['sb-menu'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 2, [{ t: t('i.pagebreak'), go: function () { A['i-brk'](); } }, '-', { t: t('sb.next'), go: function () { B.insert('nextPage'); } }, { t: t('sb.cont'), go: function () { B.insert('continuous'); } }], { from: el });
  };
})();
