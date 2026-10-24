// SheetsView (1) — the bottom sheets for formatting: cell format, number format, functions, rows and columns. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function head(title, sub, act, label) { return '<div class="sx-hd"><div><h2>' + esc(title) + '</h2>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button type="button" class="pill solid" data-act="' + (act || 'sheet-done') + '">' + esc(label || t('a.done')) + '</button></div>'; }
  function sec(label) { return '<div class="sx-sec">' + esc(label) + '</div>'; }
  function btn(act, label, on, extra) { return '<button type="button" class="sx-b' + (on ? ' on' : '') + '" data-act="' + act + '" aria-pressed="' + !!on + '"' + (extra || '') + '>' + label + '</button>'; }
  function swatches(act, names, cur, none) {
    return '<div class="sx-sws">' + names.map(function (n) { var col = C(n), on = (cur || '').toUpperCase() === col.toUpperCase() || (!cur && none && n === none); return '<button type="button" class="sx-sw' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + (n === none ? '' : col) + '" style="background:' + col + '" aria-label="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>';
  }
  window.SheetsView = {
    head: head, sec: sec, btn: btn,
    show: function (name, html) { var el = Ui.$('sheet'), y = el.scrollTop, same = Ui.state.sheet === name; Ui.sheet(name, html); if (same) el.scrollTop = y; },
    format: function (st, label) {
      return head(t('fm.title'), label)
        + sec(t('fm.text')) + '<button type="button" class="sx-line card" data-act="fo-open"><span>' + esc(t('fm.font')) + '</span><b class="lk" style="font-family:' + Fonts.css(st.f || Fonts.def) + '">' + esc(st.f || Fonts.def) + '</b></button><div class="sx-g4">' + btn('f-bold', '<b>B</b>', st.b, ' aria-label="' + esc(t('f.bold')) + '"') + btn('f-italic', '<em>I</em>', st.i, ' aria-label="' + esc(t('f.italic')) + '"') + btn('f-under', '<u>U</u>', st.u, ' aria-label="' + esc(t('f.underline')) + '"') + btn('f-strike', '<s>S</s>', st.s, ' aria-label="' + esc(t('f.strike')) + '"') + '</div>'
        + '<div class="sx-step"><span>' + esc(t('fm.size')) + '</span><span><button type="button" data-act="f-size-dec" aria-label="' + esc(t('f.smaller')) + '">−</button><b>' + (st.sz || 11) + '</b><button type="button" data-act="f-size-inc" aria-label="' + esc(t('f.larger')) + '">+</button></span></div>'
        + sec(t('fm.color')) + swatches('f-color', ['sw_black', 'sw_gray', 'sw_red', 'sw_orange', 'sw_green', 'sw_blue', 'sw_purple'], st.c, 'sw_black')
        + sec(t('fm.fill')) + swatches('f-fill', ['fl_none', 'fl_yellow', 'fl_pink', 'fl_peach', 'fl_mint', 'fl_sky', 'fl_lilac'], st.bg, 'fl_none')
        + sec(t('fm.align')) + '<div class="sx-g4">' + btn('f-al-left', ic('alignl', 22, 1.9), st.al === 'left', ' aria-label="' + esc(t('f.alignl')) + '"') + btn('f-al-center', ic('alignc', 22, 1.9), st.al === 'center', ' aria-label="' + esc(t('f.alignc')) + '"') + btn('f-al-right', ic('alignr', 22, 1.9), st.al === 'right', ' aria-label="' + esc(t('f.alignr')) + '"') + btn('f-border', ic('grid', 22, 1.9), !!st.bd, ' aria-label="' + esc(t('f.border')) + '"') + '</div>'
        + '<div class="sx-g2">' + btn('f-wrap', esc(t('f.wrap')), st.wrap) + btn('rc-merge', esc(t('rc.merge')), false) + '</div>';
    },
    // the font list: every name drawn in its own font, with a short line of sample text
    fonts: function (cur) {
      function row(f) { var on = String(cur).toLowerCase() === f.n.toLowerCase(); return '<button type="button" class="sx-fo' + (on ? ' on' : '') + '" data-act="f-font" data-n="' + esc(f.n) + '" style="font-family:' + Fonts.css(f.n) + '"><span><b>' + esc(f.n) + '</b><small>' + esc(t('fo.sample')) + '</small></span><i aria-hidden="true">' + ic('check', 20, 2.4) + '</i></button>'; }
      return head(t('fo.title'), cur, 'fm-open', t('a.back'))
        + sec(t('fo.common')) + Fonts.list.filter(function (f) { return f.g === 'excel'; }).map(row).join('')
        + sec(t('fo.own')) + Fonts.list.filter(function (f) { return f.g === 'more'; }).map(row).join('') + '<p class="sx-note">' + esc(t('fo.note')) + '</p>';
    },
    numfmt: function (n) {
      var rows = Fmt.formats.map(function (f) { var on = f.id === n.kind; return '<button type="button" class="sx-rad' + (on ? ' on' : '') + '" data-act="nf-kind" data-k="' + f.id + '"><i></i><span>' + esc(t('nf.' + f.id)) + '</span><small>' + esc(n.samples[f.id]) + '</small></button>'; }).join('');
      var canDec = n.kind === 'number' || n.kind === 'percent' || n.kind === 'currency', canSym = n.kind === 'currency', canSep = n.kind === 'number' || n.kind === 'currency';
      return head(t('nf.title'), n.label) + '<div class="sx-list">' + rows + '</div>' + (canDec || canSym || canSep ? '<div class="sx-card">'
        + (canDec ? '<div class="sx-line"><span>' + esc(t('nf.dec')) + '</span><span class="sx-st"><button type="button" data-act="nf-dec" aria-label="' + esc(t('nf.fewer')) + '">−</button><b>' + n.dec + '</b><button type="button" data-act="nf-inc" aria-label="' + esc(t('nf.more')) + '">+</button></span></div>' : '')
        + (canSym ? '<button type="button" class="sx-line" data-act="nf-sym"><span>' + esc(t('nf.sym')) + '</span><b class="lk">' + esc(n.sym) + '</b></button>' : '')
        + (canSep ? '<button type="button" class="sx-line" data-act="nf-sep" role="switch" aria-checked="' + n.sep + '"><span>' + esc(t('nf.sep')) + '</span><span class="sx-sw2' + (n.sep ? ' on' : '') + '"><i></i></span></button>' : '') + '</div>' : '');
    },
    functions: function (cats, cat, list) {
      return head(t('fx.insert'), '', 'sheet-done', t('a.close'))
        + '<label class="sx-find">' + ic('search', 20) + '<input id="fnQ" type="text" placeholder="' + esc(t('fx.search')) + '" aria-label="' + esc(t('fx.search')) + '" autocomplete="off"></label>'
        + '<div class="sx-chips">' + cats.map(function (c) { return '<button type="button" class="sx-chip' + (c === cat ? ' on' : '') + '" data-act="fn-cat" data-k="' + c + '">' + esc(t('fc.' + c)) + '</button>'; }).join('') + '</div>'
        + '<div id="fnList">' + SheetsView.fnList(list) + '</div>';
    },
    fnList: function (list) { return list.length ? list.map(function (f) { return '<button type="button" class="sx-fn" data-act="fn-pick" data-n="' + f.n + '"><b>' + esc(f.sig) + '</b><small>' + esc(t('fn.' + f.n)) + '</small></button>'; }).join('') : '<p class="sx-none">' + esc(t('fx.none')) + '</p>'; },
    rows: function (info) {
      function g(a) { return a.map(function (x) { return '<button type="button" class="sx-b wide' + (x[3] ? ' danger' : '') + '" data-act="' + x[0] + '">' + ic(x[2], 20, 1.8) + '<span>' + esc(t(x[1])) + '</span></button>'; }).join(''); }
      return head(t('rc.title'), info.label)
        + sec(info.rowLabel) + '<div class="sx-g2">' + g([['rc-rowa', 'rc.rowa', 'rowabove'], ['rc-rowb', 'rc.rowb', 'rowbelow'], ['rc-rowd', 'rc.rowd', 'delrow', 1], ['rc-rowh', info.rowHidden ? 'rc.show' : 'rc.hide', 'hide']]) + '</div>'
        + '<div class="sx-card"><div class="sx-line"><span>' + esc(t('rc.rowh')) + '</span><span class="sx-st"><button type="button" data-act="rc-rh-dec" aria-label="−">−</button><b>' + info.rh + '</b><button type="button" data-act="rc-rh-inc" aria-label="+">+</button></span></div></div>'
        + sec(info.colLabel) + '<div class="sx-g2">' + g([['rc-cola', 'rc.cola', 'colleft'], ['rc-colb', 'rc.colb', 'colright'], ['rc-cold', 'rc.cold', 'delcol', 1], ['rc-colh', info.colHidden ? 'rc.show' : 'rc.hide', 'hide']]) + '</div>'
        + '<div class="sx-card"><div class="sx-line"><span>' + esc(t('rc.colw')) + '</span><span class="sx-st"><button type="button" data-act="rc-cw-dec" aria-label="−">−</button><b>' + info.cw + '</b><button type="button" data-act="rc-cw-inc" aria-label="+">+</button></span></div></div>'
        + sec(t('rc.freezeh')) + '<div class="sx-g2">' + btn('rc-fz-row', esc(t('rc.fzrow')), info.fy === 1) + btn('rc-fz-col', esc(t('rc.fzcol')), info.fx === 1) + '</div>';
    }
  };
})();
