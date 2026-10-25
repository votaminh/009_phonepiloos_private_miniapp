// SheetsView — the bottom sheets and dialogs: text, note, signatures, the document menu, rename, password. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function head(title, sub, act, label) { return '<div class="sx-hd"><div><h2>' + esc(title) + '</h2>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button type="button" class="pill solid" data-act="' + act + '">' + esc(label) + '</button></div>'; }
  function sec(label) { return '<div class="sx-sec">' + esc(label) + '</div>'; }
  function row(act, icon, title, sub, danger) { return '<button type="button" class="opt' + (danger ? ' danger' : '') + '" data-act="' + act + '">' + ic(icon, 22, 1.75) + '<span class="op-t"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; }
  function swatches(act, names, cur) {
    return '<div class="sx-sws">' + names.map(function (n) { var col = C(n); return '<button type="button" class="sx-sw' + ((cur || '').toUpperCase() === col.toUpperCase() ? ' on' : '') + '" data-act="' + act + '" data-v="' + col + '" style="background:' + col + '" aria-label="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>';
  }
  function chip(act, k, label, on) { return '<button type="button" class="sx-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-k="' + k + '">' + esc(label) + '</button>'; }
  window.SheetsView = {
    // edit a box of text, or write new text
    text: function (d) {
      var add = d.mode === 'add', fonts = (add ? [] : [['orig', t('tx.orig')]]).concat([['arial', 'Arial'], ['times', 'Times'], ['courier', 'Courier']]);
      return head(t(add ? 'tx.add' : 'tx.edit'), '', 'tx-apply', t(add ? 'a.add' : 'tx.apply'))
        + sec(t('tx.text')) + '<textarea class="tx-in" id="txIn" rows="4" aria-label="' + esc(t('tx.text')) + '">' + esc(d.text) + '</textarea>'
        + sec(t('tx.font')) + '<div class="sx-chips">' + fonts.map(function (f) { return chip('tx-font', f[0], f[1], (d.font || 'orig') === f[0]); }).join('') + '</div>'
        + '<div class="sx-step"><span>' + esc(t('tx.size')) + '</span><span><button type="button" data-act="tx-size" data-v="-" aria-label="−">−</button><b id="txSz">' + d.fs + '</b><button type="button" data-act="tx-size" data-v="+" aria-label="+">+</button></span></div>'
        + '<div class="sx-g2"><button type="button" class="sx-b" data-act="tx-b" aria-pressed="false"><b>B</b></button><button type="button" class="sx-b" data-act="tx-i" aria-pressed="false"><em>I</em></button></div>'
        + sec(t('tx.color')) + swatches('tx-color', ['sw_black', 'sw_gray', 'sw_red', 'sw_orange', 'sw_green', 'sw_blue', 'sw_purple'], d.color)
        + (add ? '' : '<p class="sx-note">' + esc(t('tx.note')) + '</p>');
    },
    note: function () { return head(t('nt.title'), '', 'nt-apply', t('a.add')) + '<textarea class="tx-in" id="ntIn" rows="4" placeholder="' + esc(t('nt.ph')) + '" aria-label="' + esc(t('nt.title')) + '"></textarea>'; },
    // saved signatures and the choice of placing one
    signs: function (sigs, cur, date) {
      var tiles = sigs.map(function (s) { return '<button type="button" class="sg-t' + (s.id === cur ? ' on' : '') + '" data-act="s-pick" data-id="' + s.id + '" aria-pressed="' + (s.id === cur) + '"><img alt="" src="' + s.path + '"></button>'; }).join('');
      return '<div class="sx-hd"><div><h2>' + esc(t('sg.title')) + '</h2><small>' + esc(t('sg.sub')) + '</small></div></div>'
        + '<div class="sg-row">' + tiles + '<button type="button" class="sg-t new" data-act="s-new">' + ic('plus', 22, 2.2) + '<span>' + esc(t('sg.new')) + '</span></button></div>'
        + '<div class="sx-card"><button type="button" class="sx-line" data-act="s-date" role="switch" aria-checked="' + date + '"><span>' + esc(t('sg.date')) + '</span><span class="sx-sw2' + (date ? ' on' : '') + '"><i></i></span></button>'
        + (cur ? '<button type="button" class="sx-line" data-act="s-del"><span style="color:var(--danger)">' + esc(t('sg.del')) + '</span></button>' : '') + '</div>'
        + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="s-go"' + (cur ? '' : ' disabled') + '>' + esc(t('sg.go')) + '</button></div>';
    },
    signNew: function (tab) {
      return '<div class="sx-hd"><div><h2>' + esc(t('sg.new.t')) + '</h2></div></div><div class="sx-chips">' + chip('s-tab', 'draw', t('sg.draw'), tab === 'draw') + chip('s-tab', 'type', t('sg.type'), tab === 'type') + '</div>'
        + (tab === 'draw' ? '<div class="sg-pad"><canvas id="sgPad"></canvas><p id="sgHint">' + esc(t('sg.hint')) + '</p></div>' : '<label class="sx-find"><input id="sgType" type="text" placeholder="' + esc(t('sg.type.ph')) + '" aria-label="' + esc(t('sg.type')) + '" autocomplete="off" style="font:italic 600 22px Georgia,serif"></label>')
        + '<div class="btns">' + (tab === 'draw' ? '<button type="button" class="btn light" data-act="s-clear">' + esc(t('sg.clear')) + '</button>' : '<button type="button" class="btn light" data-act="s-back">' + esc(t('a.back')) + '</button>') + '<button type="button" class="btn" data-act="s-save">' + esc(t('a.save')) + '</button></div>';
    },
    menu: function (m) {
      return '<h2 class="sh-h">' + esc(m.name) + '</h2><p class="sx-meta">' + esc(m.info) + '</p>'
        + row('m-save', 'save', t('mn.save'), m.dirty ? t('mn.save.s') : '') + row('m-copy', 'download', t('mn.copy'), t('mn.copy.s')) + row('m-share', 'share', t('mn.share'))
        + row('all-open', 'sliders', t('all.title'), t('all.sub')) + row('fd-open', 'search', t('fd.title')) + row('m-rename', 'edit', t('mn.rename')) + row('m-remove', 'trash', t('r.remove'), t('r.remove.s'), true) + (m.dirty ? row('m-discard', 'close', t('mn.discard'), t('mn.discard.s'), true) : '');
    },
    rename: function (v) { return '<h2 class="sh-h">' + esc(t('rn.title')) + '</h2><label class="sx-find"><input id="rnName" type="text" value="' + esc(v) + '" placeholder="' + esc(t('rn.ph')) + '" aria-label="' + esc(t('rn.ph')) + '" autocomplete="off"></label><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rn-apply">' + esc(t('a.done')) + '</button></div>'; },
    choice: function (title, body, acts) { return '<h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="btns">' + acts.map(function (a) { return '<button type="button" class="btn ' + (a.kind === 'danger' ? 'red' : a.kind === 'solid' ? '' : 'light') + '" data-act="' + a.act + '">' + esc(a.label) + '</button>'; }).join('') + '</div>'; },
    password: function (again) { return '<h2>' + esc(t('pw.title')) + '</h2><p>' + esc(t(again ? 'pw.again' : 'pw.body')) + '</p><label class="sx-find"><input id="pwIn" type="password" placeholder="' + esc(t('pw.ph')) + '" aria-label="' + esc(t('pw.ph')) + '" autocomplete="off"></label><div class="btns"><button type="button" class="btn light" data-act="pw-no">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="pw-ok">' + esc(t('a.open')) + '</button></div>'; }
  };
})();
