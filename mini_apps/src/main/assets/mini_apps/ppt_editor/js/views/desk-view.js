// DeskView — the markup of the computer's deck page: the title row, the menu bar, the tool bar, the notes under the slide and the status bar. Strings only; no event code (desk-vm.js).
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  var MENUS = ['file', 'edit', 'view', 'insert', 'format', 'slide', 'arrange', 'show'];
  function b(name, icon, label, o) {
    o = o || {};
    return '<button type="button" class="dk-b' + (o.cls ? ' ' + o.cls : '') + '" data-dk="' + name + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + icon + (o.caret ? ic('down', 12, 2.6) : '') + '</button>';
  }
  function sep() { return '<i class="dk-sep"></i>'; }
  function i(n) { return ic(n, 20, 1.8); }

  window.DeskView = {
    menus: MENUS,
    // back, the name, then what is always at hand
    top: function (name, st, o) {
      return '<button type="button" class="ib" data-act="v-back" aria-label="' + esc(t('a.back')) + '">' + ic('back', 22, 2) + '</button>'
        + '<div class="bk-ttl"><b>' + esc(name) + '</b><small class="' + st.c + '"><i></i>' + esc(st.t) + '</small></div><span class="dk-fill"></span>'
        + '<button type="button" class="ib' + (o.undo ? '' : ' off') + '" data-act="d-undo" title="' + esc(t('a.undo')) + '" aria-label="' + esc(t('a.undo')) + '">' + ic('undo', 20, 1.9) + '</button>'
        + '<button type="button" class="ib' + (o.redo ? '' : ' off') + '" data-act="d-redo" title="' + esc(t('a.redo')) + '" aria-label="' + esc(t('a.redo')) + '">' + ic('redo', 20, 1.9) + '</button>'
        + '<button type="button" class="pill' + (o.dirty ? ' solid' : '') + '" data-act="v-save"' + (o.dirty ? '' : ' disabled') + '>' + esc(t('a.save')) + '</button>'
        + '<button type="button" class="pill solid dk-play" data-act="p-open">' + ic('play', 16, 2.2) + '<span>' + esc(t('dk.present')) + '</span></button>';
    },
    menu: function () { return MENUS.map(function (m) { return '<button type="button" class="dk-m" data-mn="' + m + '">' + esc(t('mu.' + m)) + '</button>'; }).join(''); },
    // one row: slide, insert, text, arrange; the buttons that name a state (bold…) are kept in step by Desk.sync
    tools: function () {
      return b('newslide', i('plus') + '<span>' + esc(t('dk.new')) + '</span>', t('sl.add'), { cls: 'wd', caret: 1 }) + b('layout', i('layout'), t('tl.layout'), { caret: 1 }) + sep()
        + b('text', i('textbox'), t('in.text')) + b('shape', i('shape'), t('in.shape'), { caret: 1 }) + b('pic', i('image'), t('in.pic')) + b('table', i('table'), t('in.table')) + b('chart', i('sliders'), t('ch.chart'), { caret: 1 }) + b('link', i('link'), t('in.link')) + sep()
        + '<button type="button" class="dk-b dk-font" data-dk="font" title="' + esc(t('q.font')) + '"><span id="dkFont">Calibri</span>' + ic('down', 12, 2.6) + '</button>'
        + '<span class="dk-size"><button type="button" class="dk-b sm" data-dk="sizedec" aria-label="−">' + ic('minus', 14, 2.4) + '</button><input id="dkSize" type="text" inputmode="numeric" value="18" aria-label="' + esc(t('q.size')) + '"><button type="button" class="dk-b sm" data-dk="sizeinc" aria-label="+">' + ic('plus', 14, 2.4) + '</button></span>'
        + b('bold', '<b>B</b>', t('f.bold'), { cls: 'tx' }) + b('italic', '<i>I</i>', t('f.italic'), { cls: 'tx' }) + b('under', '<u>U</u>', t('f.under'), { cls: 'tx' }) + b('strike', '<s>S</s>', t('f.strike'), { cls: 'tx' })
        + b('textc', i('brush') + '<span class="dk-bar" id="dkTc"></span>', t('q.color'), { cls: 'col', caret: 1 }) + sep()
        + b('alignl', i('alignl'), t('f.alignl')) + b('alignc', i('alignc'), t('f.alignc')) + b('alignr', i('alignr'), t('f.alignr')) + b('bullets', i('bullets'), t('f.bullets')) + sep()
        + b('fill', i('drop') + '<span class="dk-bar" id="dkFc"></span>', t('q.fill'), { cls: 'col', caret: 1 }) + b('line', i('width'), t('q.line'), { caret: 1 }) + b('arrange', i('toback'), t('q.arr'), { caret: 1 });
    },
    notes: function (text) { return '<div class="dk-nh"><b>' + esc(t('tl.notes')) + '</b><button type="button" class="dk-b sm" data-dk="notesx" aria-label="' + esc(t('dk.hidenotes')) + '">' + ic('down', 14, 2.4) + '</button></div><textarea id="dkNote" rows="3" placeholder="' + esc(t('nt.ph')) + '" aria-label="' + esc(t('tl.notes')) + '">' + esc(text || '') + '</textarea>'; },
    status: function (o) {
      return '<span class="dk-sl" id="dkSl">' + esc(t('dk.slide', { n: o.n, t: o.t })) + '</span><span class="dk-sel" id="dkSelT">' + esc(o.sel || '') + '</span><span class="dk-fill"></span>'
        + '<button type="button" class="dk-s' + (o.notes ? ' on' : '') + '" id="dkNt" data-dk="notes">' + ic('notes', 16, 1.9) + '<span>' + esc(t('tl.notes')) + '</span></button>' + sep()
        + '<button type="button" class="dk-s' + (o.view === 'edit' ? ' on' : '') + '" data-dk="v-edit" title="' + esc(t('dk.normal')) + '" aria-label="' + esc(t('dk.normal')) + '">' + ic('doc', 16, 1.9) + '</button>'
        + '<button type="button" class="dk-s' + (o.view === 'sort' ? ' on' : '') + '" data-dk="v-sort" title="' + esc(t('dk.sorter')) + '" aria-label="' + esc(t('dk.sorter')) + '">' + ic('viewgrid', 16, 1.9) + '</button>'
        + '<button type="button" class="dk-s' + (o.view === 'outline' ? ' on' : '') + '" data-dk="v-out" title="' + esc(t('ol.outline')) + '" aria-label="' + esc(t('ol.outline')) + '">' + ic('list', 16, 1.9) + '</button>' + sep()
        + '<button type="button" class="dk-s sq" data-dk="zout" aria-label="' + esc(t('dk.zout')) + '">' + ic('minus', 14, 2.4) + '</button><div class="sld dk-zr" id="dkZr" aria-label="' + esc(t('dk.zoom')) + '"></div>'
        + '<button type="button" class="dk-s sq" data-dk="zin" aria-label="' + esc(t('dk.zin')) + '">' + ic('plus', 14, 2.4) + '</button>'
        + '<button type="button" class="dk-s wd" id="dkZt" data-dk="zoom">' + esc(o.z + '%') + '</button><button type="button" class="dk-s' + (o.fit ? ' on' : '') + '" id="dkFit" data-dk="fit">' + esc(t('dk.fit')) + '</button>';
    }
  };
})();
