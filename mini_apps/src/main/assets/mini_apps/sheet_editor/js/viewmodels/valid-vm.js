// Valid — data validation: the rules a file carries (a list in a cell, numbers in a range, dates, text length, a formula) are kept, shown (the arrow of a list, the help text) and enforced when a cell is typed into; the form (Data > Data validation) adds and removes them.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, V = window.Valid = {}, dd = null, tip = null;
  var OPS = ['between', 'notBetween', 'equal', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'];

  // ---- finding the rule of a cell ------------------------------------------------------------------------------------------------
  function areas(d) { return d._a || (d._a = Wb.areas(d.sqref)); }
  V.at = function (sh, r, c) {
    var i, j, a, found = null;
    for (i = 0; i < sh.dv.length; i++) { var as = areas(sh.dv[i]); for (j = 0; j < as.length; j++) { a = as[j]; if (r >= a.startRow && r <= a.endRow && c >= a.startColumn && c <= a.endColumn) found = sh.dv[i]; } }
    return found;
  };
  // the items of a list rule: "a,b,c" typed in, or the cells of a range
  V.options = function (sh, rule) {
    var f = String(rule.formula1 || '').trim();
    if (f[0] === '=') { var cells = Calc.cellsOf(sh, f.slice(1)); return cells ? cells.filter(function (v) { return v !== null && v !== ''; }).map(function (v) { return Fmt.text(v, null); }) : []; }
    return f.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
  };

  // ---- checking what was typed ----------------------------------------------------------------------------------------------------
  function num(sh, f) { var v = Calc.evalText(sh, String(f)); return typeof v === 'number' ? v : NaN; }
  function cmp(op, x, a, b) {
    switch (op) { case 'between': return x >= a && x <= b; case 'notBetween': return x < a || x > b; case 'equal': return x === a; case 'notEqual': return x !== a;
      case 'greaterThan': return x > a; case 'greaterThanOrEqual': return x >= a; case 'lessThan': return x < a; case 'lessThanOrEqual': return x <= a; }
    return true;
  }
  // p: what Clip.parse made of the text ({ v } or { f }). Returns null when it is allowed, else { msg, stop }
  V.check = function (sh, r, c, text, p) {
    var d = V.at(sh, r, c); if (!d) return null; var rule = d.rule, type = rule.type;
    if (!type || type === 'any' || !rule.showErrorMessage) return null;
    var bad = { msg: rule.error || t('dv.reject'), title: rule.errorTitle || '', stop: rule.errorStyle === 1 || rule.errorStyle === undefined };
    if (text === '' || text === null) return rule.allowBlank ? null : null;
    var v = p && p.f ? Calc.evalText(sh, p.f) : p ? p.v : text;
    if (type === 'list') { var o = V.options(sh, rule).map(function (x) { return String(x).toLowerCase(); }); return o.indexOf(String(p && p.f ? v : text).trim().toLowerCase()) >= 0 ? null : bad; }
    if (type === 'whole' || type === 'decimal' || type === 'date' || type === 'time') {
      if (typeof v !== 'number') return bad; if (type === 'whole' && Math.floor(v) !== v) return bad;
      return cmp(rule.operator || 'between', v, num(sh, rule.formula1), num(sh, rule.formula2)) ? null : bad;
    }
    if (type === 'textLength') return cmp(rule.operator || 'between', String(text).length, num(sh, rule.formula1), num(sh, rule.formula2)) ? null : bad;
    if (type === 'custom') {
      var cell = sh.cells[SheetSvc.ref(r, c)], keep = cell ? Object.assign({}, cell) : null, first = Wb.areas(d.sqref)[0] || { startRow: r, startColumn: c };
      sh.cells[SheetSvc.ref(r, c)] = p && p.f ? { v: null, f: p.f } : { v: v }; Calc.reset();
      var out = Calc.evalText(sh, Clip.shift(String(rule.formula1 || 'TRUE'), r - first.startRow, c - first.startColumn));
      if (keep) sh.cells[SheetSvc.ref(r, c)] = keep; else delete sh.cells[SheetSvc.ref(r, c)]; Calc.reset();
      return out === true || (typeof out === 'number' && out !== 0) ? null : bad;
    }
    return null;
  };

  // ---- the arrow of a list and the help text ---------------------------------------------------------------------------------------
  function box(host, cls) { var e = document.createElement('div'); e.className = cls; host.appendChild(e); return e; }
  V.paint = function () {
    if (dd && dd.parentNode) dd.parentNode.removeChild(dd); if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
    if (!G.geo || G.editing) return; var a = G.act(), sh = G.geo.sh, d = V.at(sh, a.r, a.c); if (!d || Wb.readOnly && !d) return;
    var g = G.geo, m = Wb.mergeAt(sh, a.r, a.c), q = G.rect(a.r, a.c, m ? m.r2 : a.r, m ? m.c2 : a.c), host = a.r < g.fy ? $('gFzIn') : $('gHost'), y = a.r < g.fy ? q.y : q.y - g.tops[g.fy], rule = d.rule;
    if (rule.type === 'list' && rule.showDropDown !== false && !Wb.readOnly) {
      dd = dd || document.createElement('button'); dd.type = 'button'; dd.className = 'gdd'; dd.setAttribute('aria-label', t('dv.open')); dd.innerHTML = Ui.ic('down', 14, 2.6); host.appendChild(dd);
      dd.style.cssText = 'left:' + (q.x + q.w - 24) + 'px;top:' + (y + Math.max(2, (q.h - 22) / 2)) + 'px';
    }
    if (rule.showInputMessage && (rule.prompt || rule.promptTitle)) {
      tip = tip || document.createElement('div'); tip.className = 'gtip'; tip.innerHTML = (rule.promptTitle ? '<b>' + Ui.esc(rule.promptTitle) + '</b>' : '') + Ui.esc(rule.prompt || ''); host.appendChild(tip);
      tip.style.cssText = 'left:' + q.x + 'px;top:' + (y + q.h + 6) + 'px';
    }
  };
  function openList() {
    var a = G.act(), sh = G.geo.sh, d = V.at(sh, a.r, a.c); if (!d || !dd) return; var cur = Fmt.cell(sh, a.r, a.c).t, r = dd.getBoundingClientRect(), items = V.options(sh, d.rule);
    PopMenu.show(r.right - 200, r.bottom + 4, items.map(function (x) { return { t: x, on: x === cur, go: function () { Wb.batch(function () { var p = Clip.parse(x, Wb.style(sh, a.r, a.c)); Wb.setCell(sh, a.r, a.c, p.v === undefined ? null : p.v, p.f || ''); }); G.changed(); } }; }), { from: dd });
  }
  document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('.gdd')) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.gdd')) openList(); });

  // ---- the form ---------------------------------------------------------------------------------------------------------------------
  function typeOf(rule) { return !rule ? 'list' : rule.type === 'list' ? (/^=/.test(rule.formula1 || '') ? 'range' : 'list') : rule.type === 'decimal' ? 'decimal' : rule.type === 'whole' ? 'whole' : rule.type === 'textLength' ? 'textLength' : rule.type === 'date' ? 'date' : rule.type === 'custom' ? 'custom' : 'list'; }
  function form() {
    var s = D.st, ty = s.type, ops = ty === 'decimal' || ty === 'whole' || ty === 'textLength' || ty === 'date', two = ops && (s.op === 'between' || s.op === 'notBetween');
    var h = D.fld(t('dv.range'), D.input('dvRange', s.range, 'A1:A10')) + D.fld(t('dv.criteria'), D.sel('type', ty, [['list', 'dv.list'], ['range', 'dv.listrange'], ['whole', 'dv.integer'], ['decimal', 'dv.number'], ['textLength', 'dv.textlen'], ['date', 'dv.date'], ['custom', 'dv.custom']].map(function (p) { return { v: p[0], t: t(p[1]) }; })));
    if (ty === 'list') h += D.fld(t('dv.items'), D.input('dvA', s.a, 'Open, Won, Lost'));
    else if (ty === 'range') h += D.fld(t('dv.source'), D.input('dvA', s.a, 'Sheet2!A1:A10'));
    else if (ty === 'custom') h += D.fld(t('dv.formula'), D.input('dvA', s.a, '=A1>0'));
    else { h += D.fld(' ', D.sel('op', s.op, OPS.map(function (o) { return { v: o, t: t('op.' + o) }; }))) + '<div class="df-two">' + D.fld(t('dv.value'), D.input('dvA', s.a, '', { num: 1 })) + (two ? D.fld(t('dv.value2'), D.input('dvB', s.b, '', { num: 1 })) : '') + '</div>'; }
    h += '<div class="df-tg">' + (ty === 'list' || ty === 'range' ? D.tgl('drop', t('dv.dropdown'), s.drop) : '') + D.tgl('blank', t('dv.blank'), s.blank) + D.tgl('warn', t('dv.warn'), s.warn) + D.tgl('help', t('dv.help'), s.help) + '</div>';
    if (s.help) h += D.fld(t('dv.helptext'), D.input('dvH', s.h, ''));
    h += D.fld(t('dv.errtext'), D.input('dvE', s.e, ''));
    return h;
  }
  function remember() { var s = D.st, g = function (id) { var e = $(id); return e ? e.value : undefined; }; ['dvRange:range', 'dvA:a', 'dvB:b', 'dvH:h', 'dvE:e'].forEach(function (p) { var k = p.split(':'), v = g(k[0]); if (v !== undefined) s[k[1]] = v; }); }
  function draw() { remember(); D.show('dv', t('dv.title'), form(), [{ act: 'dv-remove', label: t('dl.remove'), kind: 'ghost' }, { act: 'dv-save', label: t('dl.save') }]); D.change = onChange; }
  function onChange(id) { if (id === 'type' || id === 'op' || id === 'help') draw(); }
  V.open = function () {
    if (Wb.readOnly) return; var a = G.act(), s = G.sel, sh = G.geo.sh, d = V.at(sh, a.r, a.c), rule = d && d.rule || null, ref = SheetSvc.ref(s.r1, s.c1) + (s.r1 !== s.r2 || s.c1 !== s.c2 ? ':' + SheetSvc.ref(s.r2, s.c2) : '');
    D.st = { range: d ? d.sqref : ref, type: typeOf(rule), op: rule && rule.operator || 'between', a: rule ? String(rule.formula1 || '').replace(/^=/, '') : '', b: rule && rule.formula2 || '',
      drop: rule ? rule.showDropDown !== false : true, blank: rule ? !!rule.allowBlank : true, warn: !!rule && rule.errorStyle === 2, help: !!rule && !!rule.showInputMessage, h: rule && rule.prompt || '', e: rule && rule.error || '' };
    draw();
  };
  function inRange(ref) { return /^[A-Za-z]{1,3}\d+(:[A-Za-z]{1,3}\d+)?$/.test(String(ref).replace(/\$/g, '').trim()); }
  A['dv-save'] = function () {
    remember(); var s = D.st, sh = G.geo.sh, ty = s.type, rule;
    if (!inRange(String(s.range).split(/\s+/)[0])) return Ui.toast(t('dv.bad'));
    if (!String(s.a).trim() && ty !== 'custom' || (ty === 'custom' && !String(s.a).trim())) return Ui.toast(t('dv.badvalue'));
    rule = { type: ty === 'range' ? 'list' : ty, allowBlank: !!s.blank, showDropDown: !!s.drop, showInputMessage: !!(s.help && (s.h || '').trim()), showErrorMessage: true, errorStyle: s.warn ? 2 : 1 };
    if (ty === 'list') rule.formula1 = String(s.a).split(',').map(function (x) { return x.trim(); }).filter(Boolean).join(',');
    else if (ty === 'range') rule.formula1 = '=' + String(s.a).replace(/^=/, '');
    else if (ty === 'custom') rule.formula1 = String(s.a).replace(/^=/, '');
    else { rule.operator = s.op; rule.formula1 = String(s.a).trim(); if (s.op === 'between' || s.op === 'notBetween') rule.formula2 = String(s.b).trim(); }
    if (rule.showInputMessage) rule.prompt = (s.h || '').trim(); if ((s.e || '').trim()) rule.error = s.e.trim();
    var target = Wb.areas(s.range);
    sh.dv = sh.dv.filter(function (d) { return !areas(d).every(function (a) { return target.some(function (b) { return a.startRow >= b.startRow && a.endRow <= b.endRow && a.startColumn >= b.startColumn && a.endColumn <= b.endColumn; }); }); });
    sh.dv.push({ sqref: String(s.range).replace(/\$/g, '').toUpperCase(), rule: rule }); sh.dvDirty = true; D.close(); Ui.toast(t('dv.saved')); Book.touch(); G.paint(true);
  };
  A['dv-remove'] = function () {
    var sh = G.geo.sh, s = G.sel; remember(); var target = Wb.areas(D.st.range || (SheetSvc.ref(s.r1, s.c1) + ':' + SheetSvc.ref(s.r2, s.c2)));
    var n = sh.dv.length; sh.dv = sh.dv.filter(function (d) { return !areas(d).some(function (a) { return target.some(function (b) { return a.startRow <= b.endRow && a.endRow >= b.startRow && a.startColumn <= b.endColumn && a.endColumn >= b.startColumn; }); }); });
    if (sh.dv.length !== n) { sh.dvDirty = true; Book.touch(); Ui.toast(t('dv.removed')); } D.close(); G.paint(true);
  };
  if (window.Menus) Menus.add('data', function () { return [{ t: t('dv.title') + '…', off: Wb.readOnly, go: V.open }]; });
})();
