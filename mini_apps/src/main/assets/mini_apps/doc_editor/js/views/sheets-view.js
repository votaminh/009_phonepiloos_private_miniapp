// SheetsView — the bottom sheets, popovers and dialogs of the page: menu, contents, reading view, font, link, rename, find bar. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc;
  function opt(act, icon, label, sub, extra) { return '<button type="button" class="opt' + (extra ? ' ' + extra : '') + '" data-act="' + act + '">' + Ui.ic(icon, 22, 1.75) + '<span class="op-t"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; }
  var FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Courier New'];
  var SIZES = [9, 10, 11, 12, 14, 18, 24];
  window.SheetsView = {
    FONTS: FONTS,
    menu: function (m) {
      return '<h2 class="sh-h">' + esc(m.name) + '</h2><p class="sh-sub">' + esc(t('mn.info', { size: m.size, words: m.words })) + '</p>'
        + opt('m-contents', 'list', t('mn.contents'), t('mn.contents.s')) + opt('m-read', 'book', t('mn.read'), t('mn.read.s')) + opt('m-find', 'search', t('mn.find'))
        + opt('m-rename', 'edit', t('mn.rename')) + opt('m-share', 'share', t('mn.share')) + opt('m-copy', 'download', t('mn.copy'), t('mn.copy.s')) + opt('m-pdf', 'pdf', t('mn.pdf'))
        + opt('m-remove', 'trash', t('r.remove'), t('r.remove.s'), 'danger');
    },
    outline: function (items, here) {
      var body = items.length ? items.map(function (h, i) {
        return '<button type="button" class="ol-it l' + h.lv + (i === here ? ' here' : '') + '" data-act="o-go" data-i="' + i + '"><span class="ol-dot"></span><span class="ol-t">' + esc(h.text || '—') + '</span>' + (i === here ? '<small>' + esc(t('o.here')) + '</small>' : '') + '</button>';
      }).join('') : '<p class="sh-sub">' + esc(t('o.none')) + '</p>';
      return '<div class="sh-row"><h2 class="sh-h">' + esc(t('o.title')) + '</h2><span class="sh-sub">' + esc(t('o.count', { n: items.length })) + '</span></div><p class="sh-sub">' + esc(t('o.hint')) + '</p><div class="ol-list">' + body + '</div>';
    },
    reading: function (p) {
      function th(k) { return '<button type="button" class="rv-th ' + k + (p.theme === k ? ' on' : '') + '" data-act="r-theme" data-k="' + k + '" aria-pressed="' + (p.theme === k) + '"><b>Aa</b>' + esc(t('rv.' + k)) + '</button>'; }
      return '<h2 class="sh-h">' + esc(t('rv.title')) + '</h2><div class="sh-lab">' + esc(t('rv.layout')) + '</div>'
        + '<div class="rv-seg"><button type="button" class="' + (p.layout === 'page' ? 'on' : '') + '" data-act="r-layout" data-k="page">' + esc(t('rv.page')) + '</button><button type="button" class="' + (p.layout === 'fit' ? 'on' : '') + '" data-act="r-layout" data-k="fit">' + esc(t('rv.fit')) + '</button></div>'
        + '<p class="sh-sub">' + esc(t('rv.hint')) + '</p><div class="sh-lab">' + esc(t('rv.size')) + '</div>'
        + '<div class="rv-size"><span style="font-size:13px">A</span><div class="sld" id="rvSize"></div><span style="font-size:22px">A</span></div>'
        + '<div class="sh-lab">' + esc(t('rv.theme')) + '</div><div class="rv-themes">' + th('light') + th('sepia') + th('dark') + '</div><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button>';
    },
    font: function (st) {
      var note = st.missing ? '<div class="fo-note">' + Ui.ic('info', 18, 2) + '<span>' + esc(t('fo.note', { f: st.missing, g: st.shown })) + '</span></div>' : '<p class="sh-sub">' + esc(t('fo.same')) + '</p>';
      return '<h2 class="sh-h">' + esc(t('fo.title')) + '</h2>' + note
        + '<div class="fo-list">' + FONTS.map(function (f) { return '<button type="button" class="fo-it' + (st.font === f ? ' on' : '') + '" data-act="e-setfont" data-f="' + esc(f) + '" style="font-family:' + Render.family(f) + '"><span>' + esc(f) + '</span><small>Aa Bb 123</small>' + Ui.ic('check', 18, 2.6) + '</button>'; }).join('') + '</div>'
        + '<div class="sh-row"><span class="sh-lab">' + esc(t('fo.size')) + '</span><span class="fo-step"><button type="button" class="round" data-act="e-smaller" aria-label="' + esc(t('f.smaller')) + '">' + Ui.ic('minus', 20, 2.4) + '</button><b id="foSize">' + st.size + '</b><button type="button" class="round" data-act="e-larger" aria-label="' + esc(t('f.larger')) + '">' + Ui.ic('plus', 20, 2.4) + '</button></span></div>'
        + '<div class="fo-sizes">' + SIZES.map(function (s) { return '<button type="button" class="fo-sz' + (st.size === s ? ' on' : '') + '" data-act="e-setsize" data-s="' + s + '">' + s + '</button>'; }).join('') + '</div>'
        + '<div class="fo-extra"><button type="button" class="round" data-act="e-sup" aria-label="' + esc(t('fo.sup')) + '">x<sup>2</sup></button><button type="button" class="round" data-act="e-sub" aria-label="' + esc(t('fo.sub')) + '">x<sub>2</sub></button><button type="button" class="btn ol" data-act="e-clear">' + esc(t('fo.clear')) + '</button></div>'
        + '<button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button>';
    },
    link: function (text, url) {
      return '<h2 class="sh-h">' + esc(t('l.title')) + '</h2><label class="sh-lab" for="lkUrl">' + esc(t('l.url')) + '</label><input class="field" id="lkUrl" type="url" inputmode="url" value="' + esc(url || '') + '" placeholder="https://" autocomplete="off">'
        + '<div class="btns">' + (url ? '<button type="button" class="btn light" data-act="l-remove">' + esc(t('l.remove')) + '</button>' : '') + '<button type="button" class="btn" data-act="l-apply">' + esc(t('a.apply')) + '</button></div>';
    },
    rename: function (name) {
      return '<h2 class="sh-h">' + esc(t('rn.title')) + '</h2><input class="field" id="rnName" type="text" value="' + esc(name) + '" placeholder="' + esc(t('rn.ph')) + '" aria-label="' + esc(t('rn.ph')) + '" autocomplete="off"><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="n-apply">' + esc(t('a.save')) + '</button></div>';
    },
    // a dialog with three or two choices: [{act, label, kind: 'plain'|'danger'|'solid'}]
    choice: function (title, body, buttons) {
      return '<h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="dl-row">' + buttons.map(function (b) { return '<button type="button" class="dl-b ' + (b.kind || 'plain') + '" data-act="' + b.act + '">' + esc(b.label) + '</button>'; }).join('') + '</div>';
    },
    find: function (s) {
      return '<div class="fd-r"><button type="button" class="ib" data-act="f-close" aria-label="' + esc(t('fd.close')) + '">' + Ui.ic('close', 22, 2) + '</button><div class="fd-box">' + Ui.ic('search', 18, 1.9) + '<input id="fdQ" type="text" value="' + esc(s.q) + '" placeholder="' + esc(t('fd.ph')) + '" aria-label="' + esc(t('fd.ph')) + '" autocomplete="off"><span class="fd-n" id="fdN">' + esc(s.count) + '</span></div>'
        + '<button type="button" class="ib" data-act="f-prev" aria-label="' + esc(t('fd.prev')) + '">' + Ui.ic('up', 22, 2) + '</button><button type="button" class="ib" data-act="f-next" aria-label="' + esc(t('fd.next')) + '">' + Ui.ic('down', 22, 2) + '</button></div>'
        + (s.edit ? '<div class="fd-r fd-r2"><div class="fd-box2"><input id="fdR" type="text" placeholder="' + esc(t('fd.replace')) + '" aria-label="' + esc(t('fd.replace')) + '" autocomplete="off"></div><button type="button" class="pill" data-act="f-rep">' + esc(t('fd.btn')) + '</button><button type="button" class="pill solid" data-act="f-all">' + esc(t('fd.all')) + '</button></div>' : '');
    },
    styles: function (cur) {
      return ['st.normal', 'st.h1', 'st.h2', 'st.h3'].map(function (k, i) { return '<button type="button" class="pop-it s' + i + (cur === k ? ' on' : '') + '" data-act="e-setstyle" data-k="' + i + '"><span>' + esc(t(k)) + '</span>' + Ui.ic('check', 18, 2.6) + '</button>'; }).join('');
    },
    grip: function () {
      function it(a, ic, l, c) { return '<button type="button" class="pop-it' + (c ? ' ' + c : '') + '" data-act="' + a + '">' + Ui.ic(ic, 20, 1.8) + '<span>' + esc(t(l)) + '</span></button>'; }
      return it('g-above', 'addabove', 'g.above') + it('g-below', 'addbelow', 'g.below', 'on') + it('g-dup', 'dup', 'g.dup') + '<hr class="pop-hr">' + it('g-del', 'trash', 'g.del', 'danger');
    },
    quick: function (b) {
      return '<button type="button" data-act="q-cut">' + esc(t('q.cut')) + '</button><button type="button" data-act="q-copy">' + esc(t('q.copy')) + '</button><button type="button" data-act="q-paste">' + esc(t('q.paste')) + '</button><i></i>'
        + '<button type="button" class="sq' + (b ? ' on' : '') + '" data-act="e-bold" aria-label="' + esc(t('f.bold')) + '"><b>B</b></button><button type="button" class="sq" data-act="e-italic" aria-label="' + esc(t('f.italic')) + '"><i>I</i></button><button type="button" class="sq" data-act="e-underline" aria-label="' + esc(t('f.underline')) + '"><u>U</u></button>';
    },
    colors: function (hl) {
      var sw = hl ? ['hl_yellow', 'hl_green', 'hl_pink', 'hl_blue'] : ['sw_black', 'sw_red', 'sw_blue', 'sw_green', 'sw_orange', 'sw_purple'];
      return sw.map(function (k) { return '<button type="button" class="pop-sw" style="background:' + C(k) + '" data-act="' + (hl ? 'e-setbg' : 'e-setcolor') + '" data-k="' + k + '" aria-label="' + k + '"></button>'; }).join('') + (hl ? '<button type="button" class="pop-sw none" data-act="e-setbg" data-k="" aria-label="' + esc(t('f.nohl')) + '">' + Ui.ic('close', 16, 2.4) + '</button>' : '');
    },
    tablePick: function (r, c) {
      var cells = ''; for (var i = 0; i < 4; i++) for (var j = 0; j < 5; j++) cells += '<button type="button" class="tp-c' + (i < r && j < c ? ' on' : '') + '" data-act="i-tsize" data-r="' + (i + 1) + '" data-c="' + (j + 1) + '" aria-label="' + (j + 1) + ' × ' + (i + 1) + '"></button>';
      return '<div class="tp-h">' + esc(t('i.size')) + '</div><div class="tp-g">' + cells + '</div><div class="tp-f"><span>' + esc(t('i.cols', { c: c, r: r })) + '</span><button type="button" class="pill solid" data-act="i-tins">' + esc(t('i.insert')) + '</button></div>';
    },
    error: function (title, body) { return '<div class="er"><span class="er-i">' + Ui.ic('alert', 22, 2.2) + '</span><div><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p></div></div><button type="button" class="btn ol" data-act="h-pick">' + esc(t('err.again')) + '</button>'; }
  };
})();
