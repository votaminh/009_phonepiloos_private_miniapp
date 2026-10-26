// Bookmarks and links inside the file — Insert ▸ Bookmark (name a place; go to it; delete it) and Insert ▸ Link to… (turn the selected text into a link to a bookmark or to a heading, written as a Word internal hyperlink).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, B = window.Bookmarks = {};
  function blocks() { return Array.prototype.filter.call(Doc.paper().children, function (b) { return b.classList.contains('b') && !b.hidden; }); }
  // [{ name, el }] user bookmarks of the file
  B.list = function () { var out = []; blocks().forEach(function (b) { (b.dataset.bm || '').split(',').filter(Boolean).forEach(function (n) { out.push({ name: n, el: b }); }); }); return out; };
  function valid(n) { return /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(n); }
  function clean(s) { var n = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''); if (!/^[A-Za-z_]/.test(n)) n = 'bm_' + n; return n.slice(0, 40); }
  A['bm-open'] = function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var b = Edit.block(); B.at = b; var l = B.list();
    Ui.sheet('bookmarks', '<h2 class="sh-h">' + esc(t('bm.title')) + '</h2><div class="pa-f hf-f"><input id="bmName" type="text" value="' + esc(b ? clean(b.textContent.slice(0, 24)) : '') + '" placeholder="' + esc(t('bm.name')) + '" autocomplete="off"><button type="button" class="btn" data-act="bm-add">' + esc(t('bm.add')) + '</button></div>'
      + '<div class="rv-list">' + (l.length ? l.map(function (x) { return '<div class="rv-c"><div class="rv-h"><b>' + esc(x.name) + '</b></div><p>' + esc(x.el.textContent.slice(0, 80)) + '</p><button type="button" class="rv-b" data-act="bm-go" data-n="' + esc(x.name) + '">' + esc(t('bm.go')) + '</button><button type="button" class="rv-b" data-act="bm-del" data-n="' + esc(x.name) + '">' + esc(t('cm.delete')) + '</button></div>'; }).join('') : '<p class="rv-none">' + esc(t('bm.none')) + '</p>') + '</div><div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>');
  };
  A['bm-add'] = function () {
    var n = ($('bmName').value || '').trim(), b = B.at; if (!b || !b.classList.contains('ed')) return Ui.toast(t('e.tap')); if (!valid(n)) return Ui.toast(t('bm.bad'));
    if (B.list().some(function (x) { return x.name === n; })) return Ui.toast(t('bm.dup')); var l = (b.dataset.bm || '').split(',').filter(Boolean); l.push(n); b.dataset.bm = l.join(','); b.dataset.m = '1'; Doc.snap(); Doc.dirty = true; Doc.chrome(); A['bm-open']();
  };
  A['bm-del'] = function (el) { var n = el.dataset.n; blocks().forEach(function (b) { if (!b.dataset.bm) return; var l = b.dataset.bm.split(',').filter(function (x) { return x && x !== n; }); if (l.length) b.dataset.bm = l.join(','); else b.dataset.bm = ''; b.dataset.m = '1'; }); Doc.snap(); Doc.dirty = true; A['bm-open'](); };
  function jump(name) { var x = B.list().filter(function (y) { return y.name === name; })[0]; if (!x) return Ui.toast(t('bm.missing')); x.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  A['bm-go'] = function (el) { Ui.closeSheet(); jump(el.dataset.n); };
  B.jump = jump;
  // Link to…: the selected text becomes a link to a bookmark, or to a heading (which gets a bookmark of its own first)
  A['bm-link'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var s = getSelection(); if (!s.rangeCount || s.isCollapsed || !Edit.block()) return Ui.toast(t('bm.sel')); B.range = s.getRangeAt(0).cloneRange();
    var r = el.getBoundingClientRect(), items = B.list().map(function (x) { return { t: x.name, go: function () { apply(x.name); } }; }), heads = blocks().filter(function (b) { return b.dataset.t === 'h' && b.textContent.trim(); });
    if (items.length && heads.length) items.push('-');
    heads.slice(0, 30).forEach(function (h) { items.push({ t: h.textContent.trim().slice(0, 40), go: function () { var l = (h.dataset.bm || '').split(',').filter(Boolean), n = l[0]; if (!n) { n = clean(h.textContent.slice(0, 24)); var k = 0, base = n; while (B.list().some(function (x) { return x.name === n; })) n = base + '_' + (++k); l.push(n); h.dataset.bm = l.join(','); h.dataset.m = '1'; } apply(n); } }); });
    if (!items.length) return Ui.toast(t('bm.none')); PopMenu.show(r.left, r.bottom + 2, items, { from: el });
  };
  function apply(name) {
    Surface.focus(); var s = getSelection(); s.removeAllRanges(); s.addRange(B.range); document.execCommand('createLink', false, '#' + name);
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('a[href]'), function (a) { a.dataset.href = a.getAttribute('href'); a.className = 'lnk'; a.removeAttribute('href'); });
    Edit.mark(); Doc.touch();
  }
  // a link to a place of the file goes there (while editing: with Ctrl / Cmd held)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.lnk'); if (!a || !/^#/.test(a.dataset.href || '')) return; if (Doc.mode === 'edit' && !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopPropagation(); jump(a.dataset.href.slice(1));
  }, true);
})();
