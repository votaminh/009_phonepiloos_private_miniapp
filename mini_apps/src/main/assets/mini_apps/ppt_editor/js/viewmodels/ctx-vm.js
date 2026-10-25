// Ctx — the menu a right click opens: on a box (cut, copy, paste, order, align, group, delete), on the empty slide (paste, layout, background, notes) and on a small slide in the column (new, duplicate, hide, move, delete).
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, K = Menus.K, C = window.Ctx = {};
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }

  C.canvas = function (x, y, onBox) {
    var many = Sel.count() > 1, n = Deck.sel && Stage.node(Deck.sel), items;
    if (onBox) {
      items = [it('dk.cut', K + 'X', function () { Sel.copy(true); }), it('dk.copy', K + 'C', function () { Sel.copy(false); }), it('dk.paste', K + 'V', function () { Sel.paste(); }, { off: !Sel.clip }), it('dk.dup', K + 'D', function () { Sel.dup(); }), '-',
        { t: t('q.layer'), sub: [it('q.front', K + '⇧]', function () { Sel.order('front'); }), it('q.fwd', K + ']', function () { Sel.order('forward'); }), it('q.bwd', K + '[', function () { Sel.order('backward'); }), it('q.back', K + '⇧[', function () { Sel.order('back'); })] },
        { t: t('q.align'), sub: ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'].map(function (m) { return { t: t('al.' + m), go: function () { Sel.align(m); } }; }) }, '-',
        it('dk.group', K + 'G', function () { Sel.group(); }, { off: !many }), it('dk.ungroup', K + '⇧G', function () { Sel.ungroup(); }, { off: !(n && n.type === 'group') }), '-']
        .concat(n && n.text && n.type !== 'picture' ? [it('q.edit', 'Enter', function () { if (window.Inline) Inline.open(n); else Text.open(true); })] : [])
        .concat(n && n.type === 'picture' ? [it('q.crop', '', A['q-crop'])] : []).concat([it('in.link', K + 'K', A['i-link']), '-', it('fl.delete', 'Del', function () { Sel.remove(); }, { danger: true })]);
    } else {
      items = [it('dk.paste', K + 'V', function () { Sel.paste(); }, { off: !Sel.clip }), it('dk.selall', K + 'A', function () { Sel.all(); }), '-', it('dk.new', K + 'M', function () { Layout.open('add'); }), it('tl.layout', '', function () { Layout.open('slide'); }), it('q.bg', '', A['m-bg']), '-',
        it(Deck.slide() && Deck.slide().hidden ? 'q.show' : 'q.hide', '', A['d-hide']), it('tl.notes', '', function () { Desk.showNotes(true); })];
    }
    PopMenu.show(x, y, items);
  };
  C.film = function (x, y, i) {
    var n = Deck.count(), ps = Slides.sel && Slides.sel.length > 1 && Slides.sel.indexOf(i) >= 0 ? Slides.sel.slice().sort(function (a, b) { return a - b; }) : [i], hid = Deck.info.slides[i].hidden;
    PopMenu.show(x, y, [it('dk.new', '', function () { Layout.pick(Deck.info.layouts[0] && Deck.info.layouts[0].name, true); }), it('dk.dupslide', '', function () { Slides.sel = ps; A['o-dup'](); }), '-',
      it('dk.fromcur', '', function () { Present.open(i); }), it(hid ? 'q.show' : 'q.hide', '', function () { Slides.sel = ps; A['o-hide'](); }), '-',
      it('dk.moveup', '', function () { Slides.moveBy(ps, -1); }, { off: ps[0] < 1 }), it('dk.movedown', '', function () { Slides.moveBy(ps, 1); }, { off: ps[ps.length - 1] >= n - 1 }), '-',
      it('dk.delslide', 'Del', function () { Slides.sel = ps; A['o-del'](); }, { danger: true, off: ps.length >= n })]);
  };
})();
