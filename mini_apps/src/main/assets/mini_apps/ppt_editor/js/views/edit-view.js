// EditView — the markup of the deck page: title bar, the bar under the slide (what the selection can do), the strip of slides, the tool bar, the box over the selection. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  var SW = ['sw_navy', 'sw_black', 'sw_gray', 'sw_red', 'sw_orange', 'sw_green', 'sw_teal', 'sw_blue', 'sw_purple', 'sw_white'];
  var FL = ['fl_none', 'sw_navy', 'sw_orange', 'sw_teal', 'sw_blue', 'fl_sand', 'fl_mint', 'fl_sky', 'fl_lilac', 'sw_white'];
  function sw(act, names, cur) {
    return '<div class="q-sws">' + names.map(function (n) {
      var c = C(n), on = (cur || 'none').toUpperCase() === c.toUpperCase();
      return '<button type="button" class="sx-sw' + (on ? ' on' : '') + (n === 'fl_none' ? ' none' : '') + '" data-act="' + act + '" data-v="' + c + '" style="background:' + (n === 'fl_none' ? 'transparent' : c) + '" aria-label="' + esc(t('c.' + n)) + '"></button>';
    }).join('') + '</div>';
  }
  function sq(act, icon, on, label, extra) { return '<button type="button" class="q-b' + (on ? ' on' : '') + '" data-act="' + act + '"' + (extra || '') + ' aria-label="' + esc(label) + '">' + ic(icon, 22, 1.9) + '</button>'; }
  function sqt(act, html, on, label) { return '<button type="button" class="q-b txt' + (on ? ' on' : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + html + '</button>'; }
  function tb(act, label, icon) { return '<button type="button" class="dc-b" data-act="' + act + '">' + ic(icon, 24, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  function step(act, label, val) { return '<div class="q-step"><span>' + esc(label) + '</span><span><button type="button" data-act="' + act + '" data-v="-" aria-label="−">−</button><b>' + esc(val) + '</b><button type="button" data-act="' + act + '" data-v="+" aria-label="+">+</button></span></div>'; }

  window.EditView = {
    top: function (name, st, o) {
      return '<button type="button" class="ib" data-act="v-back" aria-label="' + esc(t('a.back')) + '">' + ic('back', 24, 2) + '</button>'
        + '<div class="bk-ttl"><b>' + esc(name) + '</b><small class="' + st.c + '"><i></i>' + esc(st.t) + '</small></div>'
        + '<button type="button" class="ib" data-act="d-outline" aria-label="' + esc(t(o.outline ? 'ol.slides' : 'ol.outline')) + '">' + ic(o.outline ? 'slides' : 'list', 22, 1.9) + '</button>'
        + '<button type="button" class="ib' + (o.undo ? '' : ' off') + '" data-act="d-undo" aria-label="' + esc(t('a.undo')) + '">' + ic('undo', 22, 1.9) + '</button><button type="button" class="ib' + (o.redo ? '' : ' off') + '" data-act="d-redo" aria-label="' + esc(t('a.redo')) + '">' + ic('redo', 22, 1.9) + '</button>'
        + (o.dirty ? '<button type="button" class="pill solid" data-act="v-save">' + esc(t('a.save')) + '</button>' : '<button type="button" class="play" data-act="p-open" aria-label="' + esc(t('pr.start')) + '">' + ic('play', 20, 2) + '</button>')
        + '<button type="button" class="ib" data-act="v-menu" aria-label="' + esc(t('a.more')) + '">' + ic('more', 22) + '</button>';
    },
    tools: function () { return '<div class="dc-row">' + tb('m-insert', t('tl.insert'), 'plus') + tb('m-layout', t('tl.layout'), 'layout') + tb('m-motion', t('tl.motion'), 'motion') + tb('m-notes', t('tl.notes'), 'notes') + tb('m-slides', t('tl.slides'), 'slides') + '</div>'; },
    // the strip of small slides; the canvases are drawn by the stage after this markup is in
    film: function (n, cur, hidden) {
      var h = '';
      for (var i = 0; i < n; i++) h += '<button type="button" class="th' + (i === cur ? ' on' : '') + (hidden[i] ? ' hid' : '') + '" data-act="f-go" data-i="' + i + '" aria-label="' + esc(t('sl.n', { n: i + 1 })) + '"><span class="tc"><canvas></canvas></span><b>' + (i + 1) + '</b></button>';
      return h + '<button type="button" class="th add" data-act="m-layout" aria-label="' + esc(t('sl.add')) + '"><span class="tc">' + ic('plus', 24, 2.2) + '</span></button>';
    },
    // the bar under the slide: nothing selected, or a box with its text / box / arrange options
    quick: function (q) {
      if (!q.sel) return '<div class="q-none"><b>' + esc(t('q.none')) + '</b><span>' + esc(t('q.none.s')) + '</span><div class="q-act">' + qa('m-layout', 'layout', t('tl.layout')) + qa('m-bg', 'image', t('q.bg')) + qa('d-hide', q.hidden ? 'eye' : 'hide', t(q.hidden ? 'q.show' : 'q.hide')) + qa('m-notes', 'notes', t('tl.notes')) + '</div></div>';
      var tabs = [['text', t('q.text')], ['tbl', t('q.table')], ['box', t('q.box')], ['arr', t('q.arr')]].filter(function (x) { return x[0] === 'text' ? q.hasText : x[0] === 'tbl' ? q.isTable : true; });
      var h = '<div class="q-tabs">' + tabs.map(function (x) { return '<button type="button" class="' + (q.tab === x[0] ? 'on' : '') + '" data-act="q-tab" data-k="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div><div class="q-body">';
      var r = q.read || {}, f = r.font || {}, ps = r.paragraphs || [], al = ps[0] ? ps[0].align : 'left', bl = ps[0] && ps[0].bullet !== 'none';
      if (q.tab === 'text' && q.hasText) {
        h += '<div class="q-row"><button type="button" class="q-font" data-act="fo-open"><span>' + esc(t('q.font')) + '</span><b style="font-family:' + esc(Fonts.css(f.family || Fonts.def)) + '">' + esc(f.family || Fonts.def) + '</b></button>' + step('q-size', t('q.size'), f.size ? Math.round(f.size * 10) / 10 : '—') + '</div>'
          + '<div class="q-g6">' + sqt('q-b', '<b>B</b>', f.bold, t('f.bold')) + sqt('q-i', '<em>I</em>', f.italic, t('f.italic')) + sqt('q-u', '<u>U</u>', f.underline, t('f.under'))
          + sq('q-al', 'alignl', al === 'left', t('f.alignl'), ' data-v="left"') + sq('q-al', 'alignc', al === 'center', t('f.alignc'), ' data-v="center"') + sq('q-al', 'alignr', al === 'right', t('f.alignr'), ' data-v="right"') + '</div>'
          + '<div class="q-g6">' + sq('q-bul', 'bullets', bl, t('f.bullets')) + sq('q-ind', 'alignl', false, t('f.outdent'), ' data-v="-1"') + sq('q-ind', 'alignj', false, t('f.indent'), ' data-v="1"') + '<button type="button" class="q-edit" data-act="t-edit">' + ic('edit', 20, 2) + '<span>' + esc(t('q.edit')) + '</span></button></div>'
          + '<div class="q-row"><div class="q-seg">' + sq('q-anc', 'anchort', r.anchor === 'top', t('q.top'), ' data-v="top"') + sq('q-anc', 'anchorm', r.anchor === 'middle', t('q.mid'), ' data-v="middle"') + sq('q-anc', 'anchorb', r.anchor === 'bottom', t('q.bot'), ' data-v="bottom"') + '</div>' + step('q-ls', t('q.lines'), Math.round(r.lineHeight || 100) + '%') + '</div>'
          + '<div class="q-sec">' + esc(t('q.color')) + '</div>' + sw('q-color', SW, f.color);
      } else if (q.tab === 'tbl') {
        h += '<div class="q-g4 two">' + qb('tb-edit', 'edit', t('tb.edit')) + qb('tb-do', 'plus', t('tb.addrow'), '', ' data-k="insert-row"') + qb('tb-do', 'plus', t('tb.addcol'), '', ' data-k="insert-col"') + '</div><div class="q-g4 two">' + qb('tb-do', 'minus', t('tb.delrow'), 'danger', ' data-k="delete-row"') + qb('tb-do', 'minus', t('tb.delcol'), 'danger', ' data-k="delete-col"') + '</div><p class="sx-note">' + esc(t('tb.note')) + '</p>';
      } else if (q.tab === 'box') {
        h += '<div class="q-sec">' + esc(t('q.fill')) + '</div>' + sw('q-fill', FL, r.fill)
          + '<div class="q-sec">' + esc(t('q.line')) + '</div>' + sw('q-stroke', ['fl_none'].concat(SW.slice(0, 9)), r.stroke && r.stroke.color) + step('q-lw', t('q.width'), r.stroke ? Math.round(r.stroke.widthPt * 10) / 10 + ' pt' : '0')
          + '<div class="q-row">' + sqt('q-shadow', '<span>' + esc(t('q.shadow')) + '</span>', r.shadow, t('q.shadow')) + (r.type === 'picture' ? step('q-op', t('q.opacity'), Math.round((r.opacity == null ? 1 : r.opacity) * 100) + '%') + '<button type="button" class="q-b txt" data-act="q-crop">' + esc(t('q.crop')) + '</button>' : '') + '</div>';
      } else {
        h += '<div class="q-sec">' + esc(t('q.layer')) + '</div><div class="q-g4">' + qb('a-front', 'tofront', t('q.front')) + qb('a-back', 'toback', t('q.back')) + qb('a-fwd', 'up', t('q.fwd')) + qb('a-bwd', 'down', t('q.bwd')) + '</div>'
          + '<div class="q-sec">' + esc(t('q.align')) + '</div><div class="q-g6">' + ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'].map(function (m, i) { return sq('a-al', ['alignl', 'alignc', 'alignr', 'tofront', 'motion', 'toback'][i], false, t('al.' + m), ' data-v="' + m + '"'); }).join('') + '</div>'
          + '<div class="q-g4">' + qb('a-rot', 'rotate', t('q.rot')) + qb('a-flip', 'flip', t('q.flip')) + qb('a-dup', 'copy', t('q.dup')) + qb('a-del', 'trash', t('fl.delete'), 'danger') + '</div>';
      }
      return h + '</div>';
    },
    // the bar that follows the selected box
    floatBar: function (o) { return '<button type="button" class="fl-a" data-act="' + (o.text ? 't-edit' : 'q-tab') + '" data-k="box">' + esc(t(o.text ? 'fl.edit' : 'fl.style')) + '</button>' + (o.text ? '<button type="button" data-act="q-tab" data-k="text">' + esc(t('fl.style')) + '</button>' : '') + '<button type="button" data-act="q-tab" data-k="arr">' + esc(t('q.arr')) + '</button><button type="button" data-act="a-dup">' + esc(t('fl.copy')) + '</button><button type="button" class="dg" data-act="a-del">' + esc(t('fl.delete')) + '</button>'; },
    frame: function (rot) {
      var hd = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(function (h) { return '<i class="hdl ' + h + '" data-h="' + h + '"></i>'; }).join('');
      return hd + (rot ? '<i class="hdl rot" data-h="rot"></i><i class="rline"></i>' : '');
    },
    busy: function (text) { return '<i class="spin"></i>' + esc(text); },
    hint: function (text, act, label) { return '<b>' + esc(text) + '</b>' + (act ? '<button type="button" class="pill solid" data-act="' + act + '">' + esc(label) + '</button>' : ''); }
  };
  function qa(act, icon, label) { return '<button type="button" class="q-a" data-act="' + act + '">' + ic(icon, 22, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  function qb(act, icon, label, kind, extra) { return '<button type="button" class="q-c' + (kind ? ' ' + kind : '') + '" data-act="' + act + '"' + (extra || '') + '>' + ic(icon, 20, 1.9) + '<span>' + esc(label) + '</span></button>'; }
})();
