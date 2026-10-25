// ReadView — the markup of the document page: title bar, a page of the list, the tool bars of each mode, the floating bar over a selected block. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  function tb(act, label, icon, on, extra) { return '<button type="button" class="dc-b' + (on ? ' on' : '') + '" data-act="' + act + '"' + (extra || '') + '>' + ic(icon, 24, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  var SW = ['hl_yellow', 'hl_green', 'hl_pink', 'hl_blue', 'hl_orange', 'sw_red'];

  window.ReadView = {
    // back (or close the mode), name and state, undo / redo, find, menu, Save
    top: function (name, st, o) {
      var edit = o.mode !== 'read';
      return '<button type="button" class="ib" data-act="' + (edit ? 'm-done' : 'v-back') + '" aria-label="' + esc(t(edit ? 'a.close' : 'a.back')) + '">' + ic(edit ? 'close' : 'back', edit ? 22 : 24, 2) + '</button>'
        + '<div class="bk-ttl"><b>' + esc(name) + '</b><small class="' + st.c + '"><i></i>' + esc(st.t) + '</small></div>'
        + (o.undo || o.redo || edit ? '<button type="button" class="ib' + (o.undo ? '' : ' off') + '" data-act="d-undo" aria-label="' + esc(t('a.undo')) + '">' + ic('undo', 22, 1.9) + '</button><button type="button" class="ib' + (o.redo ? '' : ' off') + '" data-act="d-redo" aria-label="' + esc(t('a.redo')) + '">' + ic('redo', 22, 1.9) + '</button>' : '')
        + (window.Reflow ? Reflow.btns(edit) : '')
        + (edit ? '' : '<button type="button" class="ib" data-act="fd-open" aria-label="' + esc(t('fd.title')) + '">' + ic('search', 22, 1.9) + '</button>')
        + '<button type="button" class="ib" data-act="v-menu" aria-label="' + esc(t('a.more')) + '">' + ic('more', 22) + '</button>'
        + (o.dirty ? '<button type="button" class="pill solid" data-act="v-save">' + esc(t('a.save')) + '</button>' : '');
    },
    page: function (i, w, h) { return '<div class="pg" data-p="' + i + '" style="width:' + w + 'px;height:' + h + 'px"><canvas class="pc"></canvas><div class="ov"></div></div>'; },
    pill: function (i, n) { return esc(i + 1) + ' / ' + esc(n); },
    hint: function (text, action, label) { return '<b>' + esc(text) + '</b>' + (action ? '<button type="button" class="pill solid" data-act="' + action + '">' + esc(label) + '</button>' : ''); },
    // the bar under the pages for each mode
    tools: function (mode, o) {
      if (mode === 'read') return '<div class="dc-row">' + tb('m-text', t('tl.text'), 'edit') + tb('m-annot', t('tl.annot'), 'brush') + tb('m-sign', t('tl.sign'), 'sign') + tb('m-pages', t('tl.pages'), 'pages') + '</div>';
      if (mode === 'text' || mode === 'add') return '<div class="dc-row">' + tb('m-text', t('tl.text'), 'edit', mode === 'text') + tb('m-add', t('tl.add'), 'addtext', mode === 'add') + tb('m-redact', t('tl.redact'), 'redact') + tb('m-done', t('a.done'), 'check') + '</div>';
      if (mode === 'annot') {
        var K = [['highlight', 'hlight'], ['underline', 'under'], ['strike', 'strike'], ['pen', 'brush'], ['note', 'note'], ['rect', 'sqr'], ['ellipse', 'circ'], ['line', 'line'], ['arrow', 'arrow']];
        return '<div class="an-row">' + K.map(function (k) { return '<button type="button" class="an-b' + (o.tool === k[0] ? ' on' : '') + '" data-act="a-tool" data-k="' + k[0] + '">' + ic(k[1], 22, 1.8) + '<span>' + esc(t('an.' + k[0])) + '</span></button>'; }).join('') + '</div>'
          + '<div class="an-sw">' + SW.map(function (n) { var c = C(n); return '<button type="button" class="sx-sw' + (o.color === c ? ' on' : '') + '" data-act="a-color" data-v="' + c + '" style="background:' + c + '" aria-label="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>';
      }
      if (mode === 'redact') return '<div class="rx"><div class="an-row two"><button type="button" class="an-b' + (o.area ? '' : ' on') + '" data-act="x-text">' + ic('addtext', 22, 1.8) + '<span>' + esc(t('rx.text')) + '</span></button><button type="button" class="an-b' + (o.area ? ' on' : '') + '" data-act="x-area">' + ic('redact', 22, 1.8) + '<span>' + esc(t('rx.area')) + '</span></button></div><div class="rx-btns"><button type="button" class="btn light" data-act="x-clear">' + esc(t('rx.clear')) + '</button><button type="button" class="btn" data-act="x-apply"' + (o.marks ? '' : ' disabled') + '>' + esc(t('rx.apply', { n: o.marks })) + '</button></div></div>';
      return '';
    },
    // the small bar that follows the block tapped in edit mode
    floatBar: function () {
      return '<button type="button" class="fl-a" data-act="t-edit">' + esc(t('fl.edit')) + '</button><button type="button" data-act="t-style">' + esc(t('fl.style')) + '</button><button type="button" data-act="t-move">' + esc(t('fl.move')) + '</button><button type="button" class="dg" data-act="t-delete">' + esc(t('fl.delete')) + '</button>';
    },
    sigBar: function () { return '<div class="sg-bar"><button type="button" class="btn light" data-act="s-cancel">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="s-place">' + esc(t('sg.place')) + '</button></div>'; },
    busy: function (text) { return '<i class="spin"></i>' + esc(text); }
  };
})();
