// TOC — References ▸ Table of Contents: a contents list made from the headings, written as a real TOC field (Word can update it) whose entries show the heading and the sheet it starts on.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, A = App.acts, TW = 9350;
  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function heads() {
    return Array.prototype.filter.call(Doc.paper().querySelectorAll('.b.ed[data-t="h"]'), function (h) { return h.textContent.trim(); }).map(function (h) { return { lv: Math.min(3, +h.dataset.lv || 1), tx: h.textContent.replace(/\s+/g, ' ').trim(), pg: window.Paginate && Paginate.active() ? Paginate.pageOf(h) : 1 }; });
  }
  function xml(list) {
    var title = '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>' + x(t('toc.title')) + '</w:t></w:r></w:p>';
    var ps = list.map(function (h, i) {
      var pre = i === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : '', post = i === list.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : '';
      return '<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="' + TW + '"/></w:tabs><w:spacing w:after="80"/><w:ind w:left="' + (h.lv - 1) * 240 + '"/></w:pPr>' + pre + '<w:r><w:t>' + x(h.tx) + '</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>' + h.pg + '</w:t></w:r>' + post + '</w:p>';
    }).join('');
    return title + ps;
  }
  function html(list) { return '<div class="toc-t">' + esc(t('toc.title')) + '</div>' + list.map(function (h) { return '<div class="toc-r l' + h.lv + '"><span>' + esc(h.tx) + '</span><i></i><b>' + h.pg + '</b></div>'; }).join(''); }
  A['rf-toc'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var list = heads(); if (!list.length) return Ui.toast(t('toc.none'));
    var old = Doc.paper().querySelector('.b.lk.toc'), el = Insert.block('toc', html(list), xml(list));
    if (old) { Doc.xmls[old.dataset.n] = xml(list); old.innerHTML = html(list); Doc.snap(); Doc.touch(); return Ui.toast(t('toc.updated')); }
    Insert.place(el);
  };
})();
