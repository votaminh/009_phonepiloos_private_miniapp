// Group — outline levels of rows and columns (Data > Group rows / columns, Ungroup, Collapse, Expand). A level is stored on each row / column of the file; the headers of grouped rows and columns carry a coloured edge,
// and collapsing hides the grouped rows or columns the way Excel does. The levels go to the engine as outline operations at Save.
(function () {
  'use strict';
  var t = Ui.t, G = window.Grid, MAX = 7;
  function runs(map, from, to, fn) {
    var i = from; while (i <= to) { var j = i, v = map[i] || 0; while (j + 1 <= to && (map[j + 1] || 0) === v) j++; fn(i, j, v); i = j + 1; }
  }
  function lvl(kind, delta) {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh, s = G.sel, rows = kind === 'rows', map = rows ? sh.lvlR : sh.lvlC, a = rows ? s.r1 : s.c1, b = rows ? s.r2 : s.c2;
    if (sh.prot) return Prot.say('struct'); var next = {}, i, changed = false;
    for (i = a; i <= b; i++) { var v = Math.max(0, Math.min(MAX, (map[i] || 0) + delta)); if (v !== (map[i] || 0)) changed = true; next[i] = v; }
    if (!changed) return Ui.toast(t(delta > 0 ? 'gp.max' : 'gp.none'));
    runs(next, a, b, function (x, y, v) { sh.ops.push({ kind: rows ? 'set-rows-outline' : 'set-cols-outline', start: x, end: y, level: v }); });
    for (i = a; i <= b; i++) { if (next[i]) map[i] = next[i]; else delete map[i]; }
    Book.touch(); G.mount();
  }
  // hide / show every grouped row or column; the row (column) after a group is its summary and carries the "collapsed" mark
  function fold(on) {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh;
    [['rows', sh.lvlR, sh.hidR, sh.rows], ['cols', sh.lvlC, sh.hidC, sh.cols]].forEach(function (k) {
      var rows = k[0] === 'rows', map = k[1], hid = k[2], keys = Object.keys(map).map(Number).sort(function (x, y) { return x - y; }), i = 0;
      while (i < keys.length) {
        var j = i; while (j + 1 < keys.length && keys[j + 1] === keys[j] + 1) j++; var a = keys[i], b = keys[j];
        for (var x = a; x <= b; x++) { if (on) hid[x] = 1; else delete hid[x]; }
        sh.ops.push({ kind: rows ? 'set-rows-hidden' : 'set-cols-hidden', start: a, end: b, hidden: on });
        sh.ops.push({ kind: rows ? 'set-rows-outline' : 'set-cols-outline', start: b + 1, end: b + 1, level: map[b + 1] || 0, collapsed: on });
        i = j + 1;
      }
    });
    Book.touch(); G.mount();
  }
  // the +/− on the summary row (column) after a group: hide or show the group's rows (columns)
  App.acts['gp-toggle'] = function (el) {
    if (!G.geo) return; var sh = G.geo.sh, rows = el.dataset.k === 'r', i = +el.dataset.i, map = rows ? sh.lvlR : sh.lvlC, hid = rows ? sh.hidR : sh.hidC, L = map[i - 1] || 0, a = i - 1, on = !hid[i - 1];
    while (a - 1 >= 0 && (map[a - 1] || 0) >= L) a--;
    for (var x = a; x < i; x++) if ((map[x] || 0) >= L) { if (on) hid[x] = 1; else delete hid[x]; }
    sh.ops.push({ kind: rows ? 'set-rows-hidden' : 'set-cols-hidden', start: a, end: i - 1, hidden: on }); sh.ops.push({ kind: rows ? 'set-rows-outline' : 'set-cols-outline', start: i, end: i, level: map[i] || 0, collapsed: on });
    Book.touch(); G.mount();
  };
  if (window.Menus) Menus.add('data', function () {
    var off = Wb.readOnly; return [{ t: t('gp.rows'), off: off, go: function () { lvl('rows', 1); } }, { t: t('gp.unrows'), off: off, go: function () { lvl('rows', -1); } }, { t: t('gp.cols'), off: off, go: function () { lvl('cols', 1); } }, { t: t('gp.uncols'), off: off, go: function () { lvl('cols', -1); } },
      { t: t('gp.collapse'), off: off, go: function () { fold(true); } }, { t: t('gp.expand'), off: off, go: function () { fold(false); } }];
  });
})();
