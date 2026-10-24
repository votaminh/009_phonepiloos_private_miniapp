// SheetsView (2) — the bottom sheets for data: sort and filter, sheets, chart, document menu, the quick bar's "more", and find. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic, V = window.SheetsView;
  function row(act, icon, title, sub, danger, data) { return '<button type="button" class="opt' + (danger ? ' danger' : '') + '" data-act="' + act + '"' + (data || '') + '>' + ic(icon, 22, 1.75) + '<span class="op-t"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; }
  Object.assign(V, {
    sortfilter: function (s) {
      var ops = ['gt', 'lt', 'eq', 'ne', 'ct', 'blank'];
      return V.head(t('sf.title'), s.label, 'sf-apply', t('a.apply'))
        + V.sec(t('sf.sort')) + '<button type="button" class="sx-line card" data-act="sf-col"><span>' + esc(t('sf.by')) + '</span><b class="lk">' + esc(s.colName) + '</b></button>'
        + '<div class="sx-g2">' + V.btn('sf-asc', esc(t('sf.asc')), s.dir === 'asc') + V.btn('sf-desc', esc(t('sf.desc')), s.dir === 'desc') + '</div>'
        + '<div class="sx-line" data-act="sf-hdr" role="switch" aria-checked="' + s.header + '"><span>' + esc(t('sf.header')) + '</span><span class="sx-sw2' + (s.header ? ' on' : '') + '"><i></i></span></div>'
        + '<div class="sx-hd2">' + V.sec(t('sf.filter') + ' · ' + s.colName) + '<button type="button" class="lnk" data-act="sf-clear">' + esc(t('sf.clear')) + '</button></div>'
        + '<div class="sx-chips">' + ops.map(function (o) { return '<button type="button" class="sx-chip' + (o === s.op ? ' on' : '') + '" data-act="sf-op" data-k="' + o + '">' + esc(t('so.' + o)) + '</button>'; }).join('') + '</div>'
        + (s.op === 'blank' ? '' : '<label class="sx-find"><input id="sfVal" type="text" value="' + esc(s.val) + '" placeholder="' + esc(t('sf.value')) + '" aria-label="' + esc(t('sf.value')) + '" autocomplete="off"></label>')
        + '<p class="sx-note">' + esc(t('sf.note')) + '</p>';
    },
    sheetsList: function (list, on, sel) {
      return V.head(t('sh.title'), t(list.length === 1 ? 'b.sheet1' : 'b.sheets', { n: list.length }))
        + list.map(function (s, i) { return '<div class="sx-sh' + (i === on ? ' on' : '') + '"><button type="button" class="sx-sh-m" data-act="sh-go" data-i="' + i + '"><b>' + esc(s.name) + '</b><small>' + esc(t('b.size', { r: s.rows, c: s.cols })) + (s.hiddenSheet ? ' · ' + esc(t('sh.hidden')) : '') + '</small></button><button type="button" class="ib" data-act="sh-more" data-i="' + i + '" aria-label="' + esc(t('a.more')) + '">' + ic('more', 20) + '</button></div>'; }).join('')
        + '<button type="button" class="sx-add" data-act="sh-add">' + ic('plus', 18, 2.4) + esc(t('sh.add')) + '</button>';
    },
    sheetMenu: function (s, i, last) {
      return '<h2 class="sh-h">' + esc(s.name) + '</h2>' + row('sh-rename', 'edit', t('sh.rename'), '', false, ' data-i="' + i + '"') + row('sh-dup', 'dup', t('sh.dup'), '', false, ' data-i="' + i + '"')
        + row('sh-hide', 'hide', t(s.hiddenSheet ? 'sh.unhide' : 'sh.hide'), '', false, ' data-i="' + i + '"') + (i > 0 ? row('sh-left', 'back', t('sh.left'), '', false, ' data-i="' + i + '"') : '') + (!last ? row('sh-right', 'chev', t('sh.right'), '', false, ' data-i="' + i + '"') : '')
        + (last && i === 0 ? '' : row('sh-del', 'trash', t('sh.del'), '', true, ' data-i="' + i + '"'));
    },
    chart: function (c) {
      var types = [['column', 'chart'], ['line', 'line'], ['pie', 'pie'], ['area', 'area']];
      return V.head(t('ch.title'), c.label, 'ch-insert', t('ch.insert'))
        + '<div class="sx-g4">' + types.map(function (x) { return V.btn('ch-type', ic(x[1], 20, 1.8) + '<small>' + esc(t('ch.' + x[0])) + '</small>', c.type === x[0], ' data-k="' + x[0] + '"'); }).join('') + '</div>'
        + '<div class="ch-prev" role="img" aria-label="' + esc(t('ch.preview')) + '"><b>' + esc(c.title) + '</b>' + c.svg + '</div>'
        + '<div class="sx-card"><div class="sx-line"><span>' + esc(t('ch.range')) + '</span><b class="lk">' + esc(c.range) + '</b></div>'
        + '<div class="sx-line" data-act="ch-legend" role="switch" aria-checked="' + c.legend + '"><span>' + esc(t('ch.legend')) + '</span><span class="sx-sw2' + (c.legend ? ' on' : '') + '"><i></i></span></div></div>';
    },
    menu: function (m) {
      return '<h2 class="sh-h">' + esc(m.name) + '</h2><p class="sx-meta">' + esc(m.info) + '</p>'
        + row('m-save', 'save', t('mn.save'), m.dirty ? t('mn.save.s') : '') + row('m-copy', 'download', t('mn.copy'), t('mn.copy.s')) + row('m-share', 'share', t('mn.share'))
        + row('m-pdf', 'pdf', t('mn.pdf')) + row('m-csv', 'csv', t('mn.csv'), t('mn.csv.s')) + row('fd-open', 'search', t('fd.title')) + row('m-rename', 'edit', t('mn.rename'))
        + row('m-remove', 'trash', t('r.remove'), t('r.remove.s'), true) + (m.dirty ? row('m-discard', 'close', t('mn.discard'), t('mn.discard.s'), true) : '');
    },
    more: function () { return '<h2 class="sh-h">' + esc(t('q.more')) + '</h2>' + row('q-clear', 'trash', t('q.clear'), '', true) + row('rc-merge', 'merge', t('rc.merge')) + row('fm-open', 'marker', t('fm.title')) + row('rc-open', 'sheet', t('rc.title')); },
    rename: function (v) { return '<h2 class="sh-h">' + esc(t('rn.title')) + '</h2><label class="sx-find"><input id="rnName" type="text" value="' + esc(v) + '" placeholder="' + esc(t('rn.ph')) + '" aria-label="' + esc(t('rn.ph')) + '" autocomplete="off"></label><div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="rn-apply">' + esc(t('a.done')) + '</button></div>'; },
    choice: function (title, body, acts) { return '<h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="btns">' + acts.map(function (a) { return '<button type="button" class="btn ' + (a.kind === 'danger' ? 'red' : a.kind === 'solid' ? '' : 'light') + '" data-act="' + a.act + '">' + esc(a.label) + '</button>'; }).join('') + '</div>'; },
    find: function (f) {
      return '<div class="fd-top"><button type="button" class="ib" data-act="fd-close" aria-label="' + esc(t('fd.close')) + '">' + ic('back', 24, 2) + '</button>'
        + '<label class="fd-in"><input id="fdQ" type="text" value="' + esc(f.q) + '" placeholder="' + esc(t('fd.ph')) + '" aria-label="' + esc(t('fd.ph')) + '" autocomplete="off"><span>' + esc(f.count) + '</span></label>'
        + '<button type="button" class="ib" data-act="fd-prev" aria-label="' + esc(t('fd.prev')) + '">' + ic('up', 22, 2) + '</button><button type="button" class="ib" data-act="fd-next" aria-label="' + esc(t('fd.next')) + '">' + ic('down', 22, 2) + '</button></div>'
        + (f.ro ? '' : '<div class="fd-rep"><label class="fd-in"><input id="fdR" type="text" value="' + esc(f.rep) + '" placeholder="' + esc(t('fd.replace')) + '" aria-label="' + esc(t('fd.replace')) + '" autocomplete="off"></label><button type="button" class="pill" data-act="fd-one">' + esc(t('fd.btn')) + '</button><button type="button" class="pill solid" data-act="fd-all">' + esc(t('fd.all')) + '</button></div>')
        + '<div class="fd-opts">' + V.btn('fd-all-sheets', esc(t(f.all ? 'fd.sheets' : 'fd.sheet')), true).replace('sx-b', 'sx-chip') + V.btn('fd-case', esc(t('fd.case')), f.cs).replace('sx-b', 'sx-chip') + '</div>';
    }
  });
})();
