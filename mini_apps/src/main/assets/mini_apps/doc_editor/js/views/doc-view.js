// DocView — the top bar of the reading and editing page, and the bar of tools above the keyboard. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc;
  var TABS = ['text', 'para', 'insert'];
  function ib(act, icon, label, extra, size) { return '<button type="button" class="ib' + (extra ? ' ' + extra : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + Ui.ic(icon, size || 22, 1.9) + '</button>'; }
  function tool(act, inner, label, on, extra) { return '<button type="button" class="tl' + (on ? ' on' : '') + (extra ? ' ' + extra : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '"' + (on !== undefined ? ' aria-pressed="' + !!on + '"' : '') + '>' + inner + '</button>'; }
  window.DocView = {
    top: function (s) {
      var status = s.mode === 'edit' ? '<span class="dc-st ' + s.tone + '">' + (s.tone === 'busy' ? '<i class="dc-spin"></i>' : '<i class="dc-dot"></i>') + esc(s.status) + '</span>' : '<span class="dc-sub">' + esc(s.meta) + '</span>';
      var left = ib('d-back', 'back', t('a.back'), '', 24) + '<div class="dc-ttl"><b>' + esc(s.name) + '</b>' + status + '</div>';
      if (s.mode === 'edit') return left + ib('e-undo', 'undo', t('f.undo'), s.canUndo ? '' : 'off') + ib('e-redo', 'redo', t('f.redo'), s.canRedo ? '' : 'off') + '<button type="button" class="pill solid" data-act="e-save"' + (s.dirty ? '' : ' disabled') + '>' + esc(t('a.save')) + '</button>';
      return left + ib('d-find', 'search', t('d.find')) + ib('d-layout', s.pages ? 'reflow' : 'pages', t(s.pages ? 'rv.fit' : 'rv.page')) + '<button type="button" class="pill solid" data-act="d-edit">' + Ui.ic('edit', 16, 2.1) + esc(t('a.edit')) + '</button>' + ib('d-menu', 'more', t('a.more'), '', 20);
    },
    tabs: function (tab, table) {
      var tabs = TABS.concat(table ? ['table'] : []);
      return '<div class="tl-tabs" style="--n:' + tabs.length + ';--i:' + Math.max(0, tabs.indexOf(tab)) + '"><i class="tl-pill"></i>' + tabs.map(function (k) { return '<button type="button" class="tl-tab' + (k === tab ? ' on' : '') + '" data-act="e-tab" data-tab="' + k + '">' + esc(t('tab.' + (k === 'para' ? 'para' : k))) + '</button>'; }).join('') + '</div>';
    },
    row: function (tab, st) {
      st = st || {};
      if (tab === 'text') {
        return '<button type="button" class="tl-chip" data-act="e-font" aria-label="' + esc(t('f.font')) + '"><span id="tlFont">' + esc(st.font || 'Calibri') + ' · ' + (st.size || 11) + '</span>' + Ui.ic('down', 14, 2.4) + '</button><i class="tl-sep"></i>'
          + tool('e-bold', '<b>B</b>', t('f.bold'), !!st.b) + tool('e-italic', '<i>I</i>', t('f.italic'), !!st.i) + tool('e-underline', '<u>U</u>', t('f.underline'), !!st.u) + tool('e-strike', '<s>S</s>', t('f.strike'), !!st.s) + '<i class="tl-sep"></i>'
          + tool('e-smaller', 'A−', t('f.smaller')) + tool('e-larger', 'A+', t('f.larger')) + '<i class="tl-sep"></i>'
          + tool('e-color', '<span class="tl-a">A<i style="background:' + (st.c || C('sw_red')) + '"></i></span>', t('f.color')) + tool('e-hl', Ui.ic('marker', 22, 1.8), t('f.highlight')) + tool('e-link', Ui.ic('link', 22, 1.8), t('f.link'));
      }
      if (tab === 'para') {
        var al = st.al || 'left', ic = { left: 'alignl', center: 'alignc', right: 'alignr', justify: 'alignj' };
        return '<button type="button" class="tl-chip on" data-act="e-style" aria-label="' + esc(t('p.style')) + '"><span id="tlStyle">' + esc(t(st.style || 'st.normal')) + '</span>' + Ui.ic('up', 14, 2.4) + '</button><i class="tl-sep"></i>'
          + ['left', 'center', 'right', 'justify'].map(function (a) { return tool('e-al-' + a, Ui.ic(ic[a], 22, 1.9), t('p.' + a), al === a); }).join('') + '<i class="tl-sep"></i>'
          + tool('e-bul', Ui.ic('list', 22, 1.9), t('p.bullets'), st.list === 'bullet') + tool('e-num', Ui.ic('numlist', 22, 1.9), t('p.numbers'), st.list === 'ordered') + tool('e-outdent', Ui.ic('outdent', 22, 1.9), t('p.outdent')) + tool('e-indent', Ui.ic('indent', 22, 1.9), t('p.indent'));
      }
      if (tab === 'table') {
        return tool('t-rowa', Ui.ic('rowabove', 22, 1.8), t('tb.rowa')) + tool('t-rowb', Ui.ic('rowbelow', 22, 1.8), t('tb.rowb')) + tool('t-cola', Ui.ic('colleft', 22, 1.8), t('tb.cola')) + tool('t-colb', Ui.ic('colright', 22, 1.8), t('tb.colb')) + '<i class="tl-sep"></i>'
          + tool('t-delrow', Ui.ic('delrow', 22, 1.8), t('tb.delrow')) + tool('t-delcol', Ui.ic('delcol', 22, 1.8), t('tb.delcol')) + tool('t-deltable', Ui.ic('trash', 22, 1.8), t('tb.deltable'));
      }
      return '<span class="tl-hint">' + esc(t('i.hint')) + '</span>';
    },
    panel: function () {
      var tiles = [['i-table', 'table', 'i.table'], ['i-pic', 'image', 'i.picture'], ['i-link', 'link', 'i.link'], ['i-div', 'divider', 'i.divider'], ['i-brk', 'pagebreak', 'i.pagebreak']];
      return '<div class="tl-tiles">' + tiles.map(function (x, i) { return '<button type="button" class="tl-tile" style="--d:' + i * 30 + 'ms" data-act="' + x[0] + '">' + Ui.ic(x[1], 26, 1.7) + esc(t(x[2])) + '</button>'; }).join('') + '</div><p class="tl-pics">' + esc(t('i.pics')) + '</p>';
    }
  };
})();
