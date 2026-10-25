// SheetsView — the bottom sheets and dialogs: text, fonts, insert, layout and look, motion, notes, the deck menu, rename. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function head(title, sub, act, label) { return '<div class="sx-hd"><div><h2>' + esc(title) + '</h2>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' + (act ? '<button type="button" class="pill solid" data-act="' + act + '">' + esc(label) + '</button>' : '') + '</div>'; }
  function sec(label) { return '<div class="sx-sec">' + esc(label) + '</div>'; }
  function row(act, icon, title, sub, danger) { return '<button type="button" class="opt' + (danger ? ' danger' : '') + '" data-act="' + act + '">' + ic(icon, 22, 1.75) + '<span class="op-t"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; }
  function chip(act, k, label, on) { return '<button type="button" class="sx-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-k="' + esc(k) + '">' + esc(label) + '</button>'; }
  function tile(act, icon, label, k) { return '<button type="button" class="tile" data-act="' + act + '"' + (k ? ' data-k="' + esc(k) + '"' : '') + '>' + ic(icon, 26, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  function tx(k, fb) { var v = t(k); return v === k ? fb : v; }
  var SHAPES = [['rect', 'rect'], ['roundRect', 'round'], ['ellipse', 'oval'], ['triangle', 'tri'], ['rightArrow', 'arrow'], ['star5', 'star'], ['diamond', 'diamond'], ['heart', 'heart']];
  var SHAPE_ICON = { rect: '<rect x="4" y="6" width="16" height="12"/>', round: '<rect x="4" y="6" width="16" height="12" rx="4"/>', oval: '<circle cx="12" cy="12" r="7.5"/>', tri: '<path d="M12 4l9 15H3z"/>', arrow: '<path d="M3 9h11V5l7 7-7 7v-4H3z"/>', star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>', diamond: '<path d="M12 3l9 9-9 9-9-9z"/>', heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>' };
  window.SheetsView = {
    head: head, sec: sec,
    text: function (d) { return head(t('tx.edit'), t('tx.sub'), 'tx-apply', t('a.apply')) + sec(t('tx.text')) + '<textarea class="tx-in" id="txIn" rows="7" aria-label="' + esc(t('tx.text')) + '">' + esc(d.text) + '</textarea><p class="sx-note">' + esc(t('tx.note')) + '</p>'; },
    fonts: function (cur) {
      function r(f) { var on = String(cur).toLowerCase() === f.n.toLowerCase(); return '<button type="button" class="sx-fo' + (on ? ' on' : '') + '" data-act="q-font" data-n="' + esc(f.n) + '" style="font-family:' + esc(f.css) + '"><span><b>' + esc(f.n) + '</b><small>' + esc(t('fo.sample')) + '</small></span><i>' + ic('check', 20, 2.6) + '</i></button>'; }
      return head(t('fo.title'), cur, 'sheet-done', t('a.close')) + sec(t('fo.common')) + Fonts.list.filter(function (f) { return f.g === 'common'; }).map(r).join('') + sec(t('fo.own')) + Fonts.list.filter(function (f) { return f.g === 'more'; }).map(r).join('') + '<p class="sx-note">' + esc(t('fo.note')) + '</p>';
    },
    insert: function () {
      return head(t('in.title'), '', '', '') + '<div class="tiles">' + tile('i-text', 'textbox', t('in.text')) + tile('i-pic', 'image', t('in.pic')) + tile('i-cam', 'camera', t('in.cam')) + tile('i-table', 'table', t('in.table')) + tile('i-line', 'arrowdiag', t('in.arrow')) + tile('i-link', 'link', t('in.link')) + '</div>' + sec(t('in.shapes'))
        + '<div class="shapes">' + SHAPES.map(function (s) { return '<button type="button" class="sh" data-act="i-shape" data-k="' + s[0] + '" aria-label="' + esc(t('sh.' + s[1])) + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">' + SHAPE_ICON[s[1]] + '</svg></button>'; }).join('') + '</div><p class="sx-note">' + esc(t('in.note')) + '</p>';
    },
    // layouts of the file (each with the boxes it brings) and the look of the whole deck
    layout: function (L) {
      var cards = L.layouts.map(function (l, i) { var ph = (l.placeholders || []).slice(0, 4).map(function (p, k) { return '<i style="top:' + (6 + k * 10) + 'px;width:' + (/title|ctrTitle/i.test(p) ? 60 : 44) + '%"></i>'; }).join(''); return '<button type="button" class="lo' + (l.on ? ' on' : '') + '" data-act="l-pick" data-k="' + esc(l.name) + '"><span class="lp">' + ph + '</span><b>' + esc(l.name) + '</b></button>'; }).join('');
      var looks = L.looks.map(function (k) { return '<button type="button" class="lk" data-act="l-look" data-k="' + k.id + '"><span style="background:' + k.bg + '"><i style="background:' + k.ac + '"></i></span><b>' + esc(t('lk.' + k.id)) + '</b></button>'; }).join('');
      return head(t(L.add ? 'ly.add' : 'ly.title'), '', '', '') + sec(t(L.add ? 'ly.new' : 'ly.this')) + '<div class="los">' + cards + '</div>' + sec(t('ly.look')) + '<div class="lks">' + looks + '</div><p class="sx-note">' + esc(t('ly.note')) + '</p>';
    },
    motion: function (m) {
      var kinds = ['none', 'fade', 'push', 'wipe', 'split', 'circle', 'cover'], effects = ['fade', 'appear', 'flyIn', 'zoom', 'wipe'];
      var items = m.items.map(function (a) { return '<div class="an-it"><span class="n">' + (a.seq + 1) + '</span><div><b>' + esc(a.label || t('mo.thing')) + '</b><small>' + esc(tx('ef.' + a.effect, a.effect) + ' · ' + ({ onClick: t('tg.onClick'), withPrev: t('tg.withPrev'), afterPrev: t('tg.afterPrev') })[a.trigger] || a.trigger) + '</small></div><button type="button" class="ib" data-act="mo-del" data-k="' + a.seq + '" aria-label="' + esc(t('a.delete')) + '">' + ic('trash', 20, 1.8) + '</button></div>'; }).join('');
      return head(t('mo.title'), t('mo.sub'), '', '') + sec(t('mo.when')) + '<div class="sx-chips">' + kinds.map(function (k) { return chip('mo-kind', k, t('mo.' + k), m.kind === k); }).join('') + '</div>'
        + '<div class="sx-card"><div class="sx-line"><span>' + esc(t('mo.auto')) + '</span><span class="sx-st"><button type="button" data-act="mo-adv" data-v="-" aria-label="−">−</button><b>' + esc(m.adv ? m.adv + ' s' : t('mo.off')) + '</b><button type="button" data-act="mo-adv" data-v="+" aria-label="+">+</button></span></div></div>'
        + '<div class="sx-hd2">' + sec(t('mo.things')) + '</div>' + (items || '<p class="sx-none">' + esc(t('mo.none')) + '</p>')
        + (m.canAdd ? sec(t('mo.add')) + '<div class="sx-chips">' + effects.map(function (k) { return chip('mo-add', k, t('ef.' + k), false); }).join('') + '</div>' : '<p class="sx-note">' + esc(t('mo.pick')) + '</p>') + '<p class="sx-note">' + esc(t('mo.note')) + '</p>';
    },
    // every cell of a table as a field; empty cells are fields too
    table: function (cells) {
      var h = cells.map(function (r, i) { return '<div class="tb-r">' + r.map(function (c, j) { return '<input class="tb-c" data-r="' + i + '" data-c="' + j + '" value="' + esc(c) + '" aria-label="' + esc(t('tb.cell', { r: i + 1, c: j + 1 })) + '" autocomplete="off">'; }).join('') + '</div>'; }).join('');
      return head(t('tb.title'), t('tb.sub', { r: cells.length, c: (cells[0] || []).length }), 'tb-apply', t('a.apply')) + '<div class="tb-g">' + h + '</div>';
    },
    // how much to cut from each edge of a picture, in steps of 5 %
    crop: function (c) {
      function r(k) { return '<div class="sx-card"><div class="sx-line"><span>' + esc(t('cr.' + k)) + '</span><span class="sx-st"><button type="button" data-act="cr-step" data-k="' + k + '" data-v="-" aria-label="−">−</button><b id="cr_' + k + '">' + Math.round((c[k] || 0) * 100) + '%</b><button type="button" data-act="cr-step" data-k="' + k + '" data-v="+" aria-label="+">+</button></span></div></div>'; }
      return head(t('cr.title'), '', 'cr-apply', t('a.apply')) + '<div class="cr-g">' + r('l') + r('t') + r('r') + r('b') + '</div><div class="btns"><button type="button" class="btn light" data-act="cr-reset">' + esc(t('cr.reset')) + '</button></div>';
    },
    // footer text and slide numbers for every slide, and the page shape of the deck
    footer: function (f) {
      return head(t('ft.title'), t('ft.sub'), 'ft-apply', t('a.apply')) + sec(t('ft.text')) + '<label class="sx-find"><input id="ftText" type="text" value="' + esc(f.text) + '" placeholder="' + esc(t('ft.ph')) + '" aria-label="' + esc(t('ft.text')) + '" autocomplete="off"></label>'
        + '<div class="sx-card"><button type="button" class="sx-line" data-act="ft-num" role="switch" aria-checked="' + !!f.num + '"><span>' + esc(t('ft.num')) + '</span><span class="sx-sw2' + (f.num ? ' on' : '') + '"><i></i></span></button></div>';
    },
    size: function (cur) { return head(t('sz.title'), t('sz.sub'), '', '') + '<div class="sx-chips">' + chip('sz-set', '16:9', '16:9 ' + t('sz.wide'), cur === '16:9') + chip('sz-set', '4:3', '4:3 ' + t('sz.classic'), cur === '4:3') + '</div><p class="sx-note">' + esc(t('sz.note')) + '</p>'; },
    notes: function (text) { return head(t('nt.title'), t('nt.sub'), 'nt-done', t('a.done')) + '<textarea class="tx-in" id="ntIn" rows="9" placeholder="' + esc(t('nt.ph')) + '" aria-label="' + esc(t('nt.title')) + '">' + esc(text) + '</textarea><div class="sx-meta2" id="ntMeta"></div>'; },
    bg: function (cur) {
      var cols = ['sw_white', 'fl_sand', 'fl_mint', 'fl_sky', 'fl_lilac', 'fl_yellow', 'sw_navy', 'sw_black', 'sw_teal', 'sw_orange'];
      return head(t('bg.title'), '', 'sheet-done', t('a.close')) + '<div class="sx-sws wrap">' + cols.map(function (n) { var c = C(n); return '<button type="button" class="sx-sw" data-act="bg-set" data-v="' + c + '" style="background:' + c + '" aria-label="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>'
        + '<div class="btns"><button type="button" class="btn light" data-act="bg-reset">' + esc(t('bg.reset')) + '</button></div>';
    },
    menu: function (m) {
      return '<h2 class="sh-h">' + esc(m.name) + '</h2><p class="sx-meta">' + esc(m.info) + '</p>'
        + row('all-open', 'grid', t('all.title'), t('all.sub')) + row('p-open', 'play', t('mn.present'), t('mn.present.s', { n: m.cur })) + row('m-save', 'save', t('mn.save'), m.dirty ? t('mn.save.s') : '') + row('m-copy', 'download', t('mn.copy'), t('mn.copy.s')) + row('m-share', 'share', t('mn.share'))
        + row('m-pdf', 'pdf', t('mn.pdf'), t('mn.pdf.s')) + row('fd-open', 'search', t('fd.title')) + row('m-footer', 'hash', t('mn.footer'), t('mn.footer.s')) + row('m-size', 'layout', t('mn.size'), t('mn.size.s')) + row('m-rename', 'edit', t('mn.rename')) + row('m-remove', 'trash', t('r.remove'), t('r.remove.s'), true) + (m.dirty ? row('m-discard', 'close', t('mn.discard'), t('mn.discard.s'), true) : '');
    },
    rename: function (v) { return '<h2 class="sh-h">' + esc(t('rn.title')) + '</h2><label class="sx-find"><input id="rnName" type="text" value="' + esc(v) + '" placeholder="' + esc(t('rn.ph')) + '" aria-label="' + esc(t('rn.ph')) + '" autocomplete="off"></label><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rn-apply">' + esc(t('a.done')) + '</button></div>'; },
    choice: function (title, body, acts) { return '<h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="btns">' + acts.map(function (a) { return '<button type="button" class="btn ' + (a.kind === 'danger' ? 'red' : a.kind === 'solid' ? '' : 'light') + '" data-act="' + a.act + '">' + esc(a.label) + '</button>'; }).join('') + '</div>'; }
  };
})();
