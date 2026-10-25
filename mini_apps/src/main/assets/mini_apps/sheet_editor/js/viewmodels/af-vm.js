// Af — AutoFilter: arrows in the header row of a filtered block, and for each column a list of its values to tick (or one text / number condition). Rows that do not match are hidden;
// the engine writes the criteria and the hidden rows, so Excel shows the same filter. The criteria of a file (including two-condition ones) are kept for columns that are not touched.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, G = window.Grid, D = window.Dlg, F = window.Af = {}, layer = null;
  var OPS = [['', 'af.nofilter'], ['contains', 'af.contains'], ['notContains', 'af.notcontains'], ['begins', 'af.begins'], ['ends', 'af.ends'], ['equal', 'af.equal'], ['notEqual', 'af.notequal'], ['greaterThan', 'af.gt'], ['greaterThanOrEqual', 'af.gte'], ['lessThan', 'af.lt'], ['lessThanOrEqual', 'af.lte']];
  var MAXV = 400;
  function cur() { return G.geo.sh; }
  function text(sh, r, c) { return Fmt.cell(sh, r, c).t; }

  // ---- does a row pass ----------------------------------------------------------------------------------------------------------------
  function wild(p) { return new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
  function custom(f, v, s) {
    var q = f.val, n = typeof q === 'number' || (q !== '' && !isNaN(Number(q))) ? Number(q) : null, op = f.operator || 'equal';
    if (op === 'equal' || op === 'notEqual') { var hit = n !== null && typeof v === 'number' ? v === n : wild(String(q)).test(s); return op === 'equal' ? hit : !hit; }
    if (n === null || typeof v !== 'number') return false;
    return op === 'greaterThan' ? v > n : op === 'greaterThanOrEqual' ? v >= n : op === 'lessThan' ? v < n : v <= n;
  }
  function passes(sh, r, c, crit) {
    var v = Calc.value(sh, r, c), s = text(sh, r, c);
    if (crit.values) { var ok = crit.values.indexOf(s) >= 0 || (!!crit.blank && s === ''); if (!ok) return false; }
    if (crit.customs) { var res = crit.customs.filters.map(function (f) { return custom(f, v, s); }); if (!(crit.customs.and ? res.every(Boolean) : res.some(Boolean))) return false; }
    return true;
  }
  // hide / show the rows of the block by what the columns ask for
  F.apply = function (sh) {
    var f = sh.af; if (!f) return; var cols = Object.keys(f.cols).map(Number), hid = [], r;
    f.hid.forEach(function (x) { delete sh.hidR[x]; });
    for (r = f.r1 + 1; r <= f.r2; r++) if (!cols.every(function (c) { return passes(sh, r, c, f.cols[c]); })) { hid.push(r); sh.hidR[r] = 1; }
    f.hid = hid; sh.afDirty = true;
  };
  function mounted() { G.mount(); Book.touch(); }

  // ---- create / remove ---------------------------------------------------------------------------------------------------------------
  function block() {
    var s = G.sel, sh = cur();
    if (s.r1 !== s.r2 || s.c1 !== s.c2) return { r1: s.r1, c1: s.c1, r2: Math.max(s.r2, s.r1 + 1), c2: s.c2 };
    var r1 = s.r1, c1 = s.c1, r2 = s.r1, c2 = s.c1, has = function (r, c) { return !!sh.cells[SheetSvc.ref(r, c)]; }, grow = true, r, c;
    while (grow) { grow = false;
      for (c = c1 - 1; c <= c2 + 1 && !grow; c++) if (c >= 0 && (c < c1 || c > c2)) for (r = r1; r <= r2; r++) if (has(r, c)) { if (c < c1) c1 = c; else c2 = c; grow = true; break; }
      for (r = r1 - 1; r <= r2 + 1 && !grow; r++) if (r >= 0 && (r < r1 || r > r2)) for (c = c1; c <= c2; c++) if (has(r, c)) { if (r < r1) r1 = r; else r2 = r; grow = true; break; }
    }
    return { r1: r1, c1: c1, r2: Math.max(r2, r1 + 1), c2: c2 };
  }
  F.toggle = function () {
    if (Wb.readOnly || !G.geo) return; var sh = cur();
    if (sh.af) { sh.afWas = { r1: sh.af.r1, c1: sh.af.c1, r2: sh.af.r2, c2: sh.af.c2 }; sh.af.hid.forEach(function (x) { delete sh.hidR[x]; }); sh.af = null; sh.afDirty = true; G.mount(); Book.touch(); return; }
    var b = block(); sh.af = { r1: b.r1, c1: b.c1, r2: b.r2, c2: b.c2, cols: {}, hid: [] }; sh.afDirty = true; G.paint(); Book.touch();
  };

  // ---- the arrows ---------------------------------------------------------------------------------------------------------------------
  F.paint = function () {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null;
    if (!G.geo || G.editing) return; var sh = G.geo.sh, f = sh.af; if (!f) return; var g = G.geo, host = f.r1 < g.fy ? $('gFzIn') : $('gHost'); if (!host) return;
    layer = document.createElement('div'); layer.className = 'afl'; var c, h = '';
    for (c = f.c1; c <= Math.min(f.c2, f.c1 + 79); c++) {
      var q = G.rect(f.r1, c, f.r1, c), y = f.r1 < g.fy ? q.y : q.y - g.tops[g.fy], on = !!f.cols[c];
      h += '<button type="button" class="afb' + (on ? ' on' : '') + '" data-act="af-open" data-c="' + c + '" aria-label="' + esc(t('af.open')) + '" style="left:' + (q.x + q.w - 22) + 'px;top:' + (y + Math.max(2, (q.h - 20) / 2)) + 'px">' + Ui.ic(on ? 'filter' : 'down', 13, 2.4) + '</button>';
    }
    layer.innerHTML = h; host.appendChild(layer);
  };
  document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('.afb')) { e.preventDefault(); e.stopPropagation(); } }, true);

  // ---- the list of one column ----------------------------------------------------------------------------------------------------------
  function distinct(sh, f, c) {
    var seen = {}, list = [], blank = false, r;
    for (r = f.r1 + 1; r <= f.r2; r++) { var s = text(sh, r, c); if (s === '') { blank = true; continue; } if (!seen[s]) { seen[s] = 1; list.push({ s: s, v: Calc.value(sh, r, c) }); } }
    list.sort(function (a, b) { return typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : a.s.localeCompare(b.s, undefined, { numeric: true, sensitivity: 'base' }); });
    return { list: list, blank: blank };
  }
  function opOf(crit) { var cf = crit && crit.customs && crit.customs.filters.length === 1 ? crit.customs.filters[0] : null; if (!cf) return { op: '', val: '' }; var v = String(cf.val), o = cf.operator || 'equal';
    if (o === 'equal') { if (/^\*.*\*$/.test(v)) return { op: 'contains', val: v.slice(1, -1) }; if (/^\*/.test(v)) return { op: 'ends', val: v.slice(1) }; if (/\*$/.test(v)) return { op: 'begins', val: v.slice(0, -1) }; }
    if (o === 'notEqual' && /^\*.*\*$/.test(v)) return { op: 'notContains', val: v.slice(1, -1) };
    return { op: o, val: v }; }
  function form() {
    var s = D.st, d = s.d, crit = s.crit, h = '<div class="df-two"><button type="button" class="btn ol" data-act="af-sort" data-d="asc">' + esc(t('af.sorta')) + '</button><button type="button" class="btn ol" data-act="af-sort" data-d="desc">' + esc(t('af.sortz')) + '</button></div>';
    h += D.fld(t('af.cond'), D.sel('op', s.op, OPS.map(function (o) { return { v: o[0], t: t(o[1]) }; })) + (s.op ? '<div class="af-gap"></div>' + D.input('afVal', s.val, '') : ''));
    if (!s.op) {
      h += '<input class="field df-i" id="afQ" type="text" placeholder="' + esc(t('af.search')) + '" autocomplete="off"><div class="af-all"><button type="button" class="lk" data-act="af-all" data-on="1">' + esc(t('af.all')) + '</button><button type="button" class="lk" data-act="af-all" data-on="0">' + esc(t('af.none')) + '</button></div><div class="nm-list af-vals">';
      d.list.slice(0, MAXV).forEach(function (x, i) { h += '<div class="af-v" data-t="' + esc(x.s.toLowerCase()) + '">' + D.tgl('v' + i, x.s, s.sel[x.s] !== false) + '</div>'; });
      if (d.blank) h += '<div class="af-v" data-t="">' + D.tgl('vb', t('af.blanks'), s.sel['\u0000'] !== false) + '</div>';
      h += '</div>' + (d.list.length > MAXV ? '<p class="df-hint">' + esc(t('af.many', { n: MAXV })) + '</p>' : '');
    }
    return h;
  }
  function draw() { remember(); D.show('af', t('af.title', { c: D.st.name }), form(), [{ act: 'af-clear', label: t('af.clear'), kind: 'ghost' }, { act: 'af-ok', label: t('a.apply') }]); D.change = function (id) { if (id === 'op') draw(); }; }
  function remember() { var s = D.st; if ($('afVal')) s.val = $('afVal').value; if (s.d && !s.op && $('afQ')) return; }
  A['af-open'] = function (el) {
    var sh = cur(), f = sh.af, c = +el.dataset.c, crit = f.cols[c], o = opOf(crit), d = distinct(sh, f, c), sel = {};
    if (crit && crit.values) { d.list.forEach(function (x) { sel[x.s] = crit.values.indexOf(x.s) >= 0; }); sel['\u0000'] = !!crit.blank; }
    D.st = { col: c, d: d, crit: crit, op: o.op, val: o.val, sel: sel, name: SheetSvc.col(c) + (text(sh, f.r1, c) ? ' · ' + text(sh, f.r1, c) : '') }; draw();
  };
  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'afQ') return; var q = e.target.value.toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('.af-v'), function (n) { n.hidden = !!q && n.dataset.t.indexOf(q) < 0; });
  });
  A['af-all'] = function (el) { var on = el.dataset.on === '1'; Array.prototype.forEach.call(document.querySelectorAll('.af-v'), function (n) { var b = n.querySelector('.df-t'); if (n.hidden || !b) return; D.st[b.dataset.id] = on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); };
  A['af-ok'] = function () {
    remember(); var s = D.st, sh = cur(), f = sh.af, c = s.col, d = s.d;
    if (s.op) {
      var v = String(s.val || '').trim(); if (!v) return Ui.toast(t('af.needval'));
      var map = { contains: ['equal', '*' + v + '*'], notContains: ['notEqual', '*' + v + '*'], begins: ['equal', v + '*'], ends: ['equal', '*' + v] }, p = map[s.op] || [s.op, v], n = Number(v);
      f.cols[c] = { customs: { and: false, filters: [{ operator: p[0], val: !map[s.op] && v !== '' && !isNaN(n) ? n : p[1] }] } };
    } else {
      var vals = [], all = true; d.list.slice(0, MAXV).forEach(function (x, i) { if (D.st['v' + i]) vals.push(x.s); else all = false; });
      var blank = d.blank ? !!D.st.vb : false; if (d.blank && !blank) all = false;
      if (all && d.list.length <= MAXV) delete f.cols[c]; else f.cols[c] = { values: vals, blank: blank };
    }
    D.close(); F.apply(sh); mounted();
  };
  A['af-clear'] = function () { var sh = cur(); delete sh.af.cols[D.st.col]; D.close(); F.apply(sh); mounted(); };
  A['af-sort'] = function (el) { var sh = cur(), f = sh.af, c = D.st.col; D.close(); Struct.sortRange({ r1: f.r1, c1: f.c1, r2: f.r2, c2: f.c2 }, c, el.dataset.d); F.apply(sh); mounted(); };

  if (window.Menus) Menus.add('data', function () { var on = G.geo && G.geo.sh.af; return [{ t: t(on ? 'af.remove' : 'af.create'), k: (/Mac/.test(navigator.platform) ? '⇧⌘' : 'Ctrl+Shift+') + 'L', off: Wb.readOnly, go: F.toggle }]; });
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l') && G.geo && !G.editing) { e.preventDefault(); F.toggle(); } });
})();
