// Cf — conditional formatting: the list of rules of a sheet and the form that adds one (a value, some text, duplicates, top / bottom, above / below average, a formula, a colour scale, a data bar, an icon set).
// Rules already in the file are listed and drawn but kept as they are; a rule made here is drawn at once (Xrich) and handed to the engine at Save (sh.cfNew), where it is appended to the sheet's rules.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, F = window.Cf = {};
  var KINDS = ['greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'notBetween', 'equal', 'notEqual', 'contains', 'notContains', 'begins', 'ends', 'textEq', 'dup', 'uniq', 'top', 'bottom', 'above', 'below', 'formula', 'scale2', 'scale3', 'bar', 'icon'];
  var NUMBER = { greaterThan: 1, greaterThanOrEqual: 1, lessThan: 1, lessThanOrEqual: 1, between: 1, notBetween: 1, equal: 1, notEqual: 1 }, TEXT = { contains: 'containsText', notContains: 'notContainsText', begins: 'beginsWith', ends: 'endsWith', textEq: 'equal' };
  var LOOKS = ['red', 'yel', 'grn', 'blu', 'gry'], SCALES = { gyr: ['cf_s_green', 'cf_s_yellow', 'cf_s_red'], ryg: ['cf_s_red', 'cf_s_yellow', 'cf_s_green'], wg: ['cf_s_white', 'cf_s_green'], gw: ['cf_s_green', 'cf_s_white'], wr: ['cf_s_white', 'cf_s_red'], bwr: ['cf_s_blue', 'cf_s_white', 'cf_s_red'] };
  var BARS = ['cf_s_bar', 'cf_s_green', 'cf_s_red', 'cf_s_orange'], ICONS = ['3TrafficLights1', '3TrafficLights2', '3Arrows', '3ArrowsGray', '3Flags', '3Signs', '3Symbols', '3Symbols2', '4Arrows', '4ArrowsGray', '4RedToBlack', '4Rating', '4TrafficLights', '5Arrows', '5ArrowsGray', '5Quarters', '5Rating'];
  function hex(k) { return window.C ? C(k) : window.AppColors[k]; }
  function ref(q) { var a = SheetSvc.ref(q.r1, q.c1); return q.r1 === q.r2 && q.c1 === q.c2 ? a : a + ':' + SheetSvc.ref(q.r2, q.c2); }
  function cur() { return G.geo.sh; }

  // ---- building a rule from the form ----------------------------------------------------------------------------------------------
  function dxf(look) { return { bg: hex('cf_' + look + '_bg'), color: hex('cf_' + look + '_ink'), b: false, i: false }; }
  function build(s, rs) {
    var k = s.kind, rule, xr = { rs: rs, prio: 9999, dxf: null, rank: 10, above: true, f: [] }, a = String(s.a).trim(), b = String(s.b).trim(), n = parseFloat(s.n);
    if (NUMBER[k]) {
      var x = parseFloat(a), y = parseFloat(b), two = k === 'between' || k === 'notBetween'; if (isNaN(x) || (two && isNaN(y))) return t('cf.badnum');
      rule = { type: 'highlightCell', subType: 'number', operator: k, value: two ? [x, y] : x }; xr.type = 'cellIs'; xr.op = k; xr.f = two ? [String(x), String(y)] : [String(x)];
    } else if (TEXT[k]) {
      if (!a) return t('cf.badtext');
      rule = { type: 'highlightCell', subType: 'text', operator: TEXT[k], value: a };
      if (k === 'textEq') { xr.type = 'cellIs'; xr.op = 'equal'; xr.f = ['"' + a + '"']; } else { xr.type = TEXT[k]; xr.text = a; }
    } else if (k === 'dup' || k === 'uniq') { rule = { type: 'highlightCell', subType: k === 'dup' ? 'duplicateValues' : 'uniqueValues' }; xr.type = rule.subType; }
    else if (k === 'top' || k === 'bottom') {
      if (!(n >= 1)) return t('cf.badnum'); n = Math.round(n);
      rule = { type: 'highlightCell', subType: 'rank', value: n, isBottom: k === 'bottom', isPercent: !!s.pct }; xr.type = 'top10'; xr.rank = n; xr.pct = !!s.pct; xr.bottom = k === 'bottom';
    } else if (k === 'above' || k === 'below') { rule = { type: 'highlightCell', subType: 'average', operator: k === 'above' ? 'greaterThan' : 'lessThan' }; xr.type = 'aboveAverage'; xr.above = k === 'above'; }
    else if (k === 'formula') {
      if (!a) return t('cf.badtext'); a = a.replace(/^=/, ''); rule = { type: 'highlightCell', subType: 'formula', value: a }; xr.type = 'expression'; xr.f = [a];
    }
    if (rule) { xr.dxf = dxf(s.look); rule.style = { bg: { rgb: xr.dxf.bg }, cl: { rgb: xr.dxf.color } }; return { rule: rule, xr: xr }; }
    if (k === 'scale2' || k === 'scale3') {
      var cs = SCALES[s.scale].map(hex); if ((k === 'scale3') !== (cs.length === 3)) cs = k === 'scale3' ? [cs[0], hex('cf_s_yellow'), cs[cs.length - 1]] : [cs[0], cs[cs.length - 1]];
      var vs = cs.length === 3 ? [{ t: 'min' }, { t: 'percentile', v: '50' }, { t: 'max' }] : [{ t: 'min' }, { t: 'max' }];
      rule = { type: 'colorScale', config: cs.map(function (c, i) { var o = vs[i]; return { index: i, color: c, value: o.t === 'percentile' ? { type: 'percentile', value: 50 } : { type: o.t } }; }) };
      xr.type = 'colorScale'; xr.scale = { v: vs, c: cs }; return { rule: rule, xr: xr };
    }
    if (k === 'bar') {
      var bc = hex(s.bar); rule = { type: 'dataBar', isShowValue: true, config: { min: { type: 'min' }, max: { type: 'max' }, positiveColor: bc, nativeColor: bc, isGradient: true } };
      xr.type = 'dataBar'; xr.bar = { v: [{ t: 'min' }, { t: 'max' }], c: bc }; return { rule: rule, xr: xr };
    }
    var set = s.icon, n = parseInt(set, 10), worst = /Rating$/.test(set), th = [], q; for (q = n - 1; q >= 0; q--) th.push(Math.round(q * 100 / n));
    rule = { type: 'iconSet', isShowValue: true, config: th.map(function (p, i) { return { iconType: set, iconId: String(worst ? n - 1 - i : i), operator: 'greaterThanOrEqual', value: { type: 'percent', value: p } }; }) };
    xr.type = 'iconSet'; xr.icon = { set: set, v: th.slice().reverse().map(function (p) { return { t: 'percent', v: String(p) }; }), rev: false }; return { rule: rule, xr: xr };
  }

  // ---- the list ---------------------------------------------------------------------------------------------------------------------
  function describe(r) {
    if (r.scale) return t('cf.k.scale' + r.scale.c.length); if (r.bar) return t('cf.k.bar'); if (r.icon) return t('cf.k.icon');
    var key = 'cf.k.' + (r.type === 'cellIs' ? (r.op || 'equal') : r.type === 'top10' ? (r.bottom ? 'bottom' : 'top') : r.type === 'aboveAverage' ? (r.above ? 'above' : 'below') : r.type), s = t(key);
    var extra = r.type === 'cellIs' ? ' ' + r.f.join(' – ') : r.text ? ' “' + r.text + '”' : r.type === 'top10' ? ' ' + r.rank + (r.pct ? '%' : '') : r.type === 'expression' ? ' ' + (r.f[0] || '') : '';
    return (s === key ? r.type : s) + extra;
  }
  function row(r, mine, i, at) {
    var sw = r.dxf ? '<i class="cf-sw" style="background:' + (r.dxf.bg || 'transparent') + ';color:' + (r.dxf.color || 'inherit') + '">Aa</i>' : r.scale ? '<i class="cf-sw" style="background:linear-gradient(90deg,' + r.scale.c.join(',') + ')"></i>' : r.bar ? '<i class="cf-sw" style="background:linear-gradient(90deg,' + r.bar.c + ' 60%,transparent 60%)"></i>' : '<i class="cf-sw">◆</i>';
    return '<div class="nm-row">' + sw + '<span class="nm-t"><b>' + Ui.esc(describe(r)) + '</b><small>' + Ui.esc(r.rs.map(ref).join(', ')) + '</small></span>'
      + (Wb.readOnly ? '' : (toForm(r) ? '<button type="button" class="ib" data-act="cf-edit" data-i="' + at + '" aria-label="' + t('nm.edit') + '">' + Ui.ic('edit', 18, 2) + '</button>' : '') + '<button type="button" class="ib" data-act="cf-del" data-i="' + at + '" aria-label="' + t('dl.remove') + '">' + Ui.ic('trash', 18, 2) + '</button>') + '</div>';
  }
  function list() {
    var sh = cur(), rules = Xrich.rulesOf(sh), body = rules.map(function (r, i) { return row(r, false, 0, i); }).join('');
    D.show('cf', t('cf.title'), '<div class="nm-list">' + (body || '<p class="df-hint">' + t('cf.none') + '</p>') + '</div>', [{ act: 'dl-cancel', label: t('a.close'), kind: 'ghost' }, { act: 'cf-new', label: t('cf.new') }]);
  }
  F.open = function () { if (!G.geo) return; list(); };
  // take a rule away: a rule made in this session just leaves the list, one in the file is removed by its position at Save
  function drop(sh, r) { var k = (sh.cfNew || []).map(function (n) { return n.xr; }).indexOf(r); if (k >= 0) sh.cfNew.splice(k, 1); else if (r.di !== undefined) (sh.cfDel = sh.cfDel || []).push(r.di); Xrich.drop(sh, r); }
  A['cf-del'] = function (el) { var sh = cur(), r = Xrich.rulesOf(sh)[+el.dataset.i]; if (!r) return; drop(sh, r); Book.touch(); G.paint(); list(); };

  // a rule read from the file, back into the form (null when the form cannot say what it does: its kind, or colours that are not in the presets)
  function toForm(r) {
    var s = { range: r.rs.map(ref).join(' '), kind: '', a: '', b: '', n: '10', pct: false, look: 'red', scale: 'gyr', bar: 'cf_s_bar', icon: '3TrafficLights1' }, k;
    function near(v) { var best = null; LOOKS.forEach(function (l) { if (hex('cf_' + l + '_bg').toUpperCase() === String(v && v.bg || '').toUpperCase()) best = l; }); return best; }
    if (r.type === 'cellIs') {
      var txt = /^"/.test(r.f[0] || ''); k = txt ? (r.op === 'equal' ? 'textEq' : null) : (NUMBER[r.op] ? r.op : null);
      if (!k) return null; s.a = txt ? r.f[0].slice(1, -1) : r.f[0]; s.b = r.f[1] || '';
    } else if (r.type === 'containsText') { k = 'contains'; s.a = r.text || ''; } else if (r.type === 'notContainsText') { k = 'notContains'; s.a = r.text || ''; } else if (r.type === 'beginsWith') { k = 'begins'; s.a = r.text || ''; } else if (r.type === 'endsWith') { k = 'ends'; s.a = r.text || ''; }
    else if (r.type === 'duplicateValues') k = 'dup'; else if (r.type === 'uniqueValues') k = 'uniq';
    else if (r.type === 'top10') { k = r.bottom ? 'bottom' : 'top'; s.n = String(r.rank); s.pct = !!r.pct; } else if (r.type === 'aboveAverage') k = r.above ? 'above' : 'below';
    else if (r.type === 'expression') { k = 'formula'; s.a = r.f[0] || ''; }
    else if (r.scale) { k = r.scale.c.length === 3 ? 'scale3' : 'scale2'; var sc = Object.keys(SCALES).filter(function (x) { return SCALES[x].length === r.scale.c.length; })[0]; Object.keys(SCALES).forEach(function (x) { if (SCALES[x].map(hex).join().toUpperCase() === r.scale.c.join().toUpperCase()) sc = x; }); s.scale = sc; }
    else if (r.bar) { k = 'bar'; BARS.forEach(function (b) { if (hex(b).toUpperCase() === String(r.bar.c).toUpperCase()) s.bar = b; }); }
    else if (r.icon) { if (ICONS.indexOf(r.icon.set) < 0 || r.icon.v.length !== parseInt(r.icon.set, 10)) return null; k = 'icon'; s.icon = r.icon.set; }
    else return null;
    s.kind = k; if (r.dxf) { var l = near(r.dxf); if (l) s.look = l; } return s;
  }
  A['cf-edit'] = function (el) { var sh = cur(), r = Xrich.rulesOf(sh)[+el.dataset.i], s = r && toForm(r); if (!s) return Ui.toast(t('cf.noedit')); D.st = s; D.st.editing = r; draw(); };

  // ---- the form ---------------------------------------------------------------------------------------------------------------------
  function pick(id, v, items) { return D.sel(id, v, items); }
  function form() {
    var s = D.st, k = s.kind, h = D.fld(t('cf.range'), D.input('cfRange', s.range, 'A1:A10')) + D.fld(t('cf.rule'), pick('kind', k, KINDS.map(function (x) { return { v: x, t: t('cf.k.' + x) }; })));
    if (NUMBER[k]) h += '<div class="df-two">' + D.fld(t('dv.value'), D.input('cfA', s.a, '', { num: 1 })) + ((k === 'between' || k === 'notBetween') ? D.fld(t('dv.value2'), D.input('cfB', s.b, '', { num: 1 })) : '') + '</div>';
    else if (TEXT[k]) h += D.fld(t('cf.text'), D.input('cfA', s.a, ''));
    else if (k === 'top' || k === 'bottom') h += D.fld(t('cf.count'), D.input('cfN', s.n, '10', { num: 1 })) + '<div class="df-tg">' + D.tgl('pct', t('cf.percent'), s.pct) + '</div>';
    else if (k === 'formula') h += D.fld(t('dv.formula'), D.input('cfA', s.a, '=A1>B1'));
    if (k === 'scale2' || k === 'scale3') h += D.fld(t('cf.colors'), pick('scale', s.scale, Object.keys(SCALES).filter(function (x) { return (SCALES[x].length === 3) === (k === 'scale3'); }).map(function (x) { return { v: x, t: t('cf.sc.' + x) }; })));
    else if (k === 'bar') h += D.fld(t('cf.colors'), pick('bar', s.bar, BARS.map(function (x) { return { v: x, t: t('cf.bar.' + x) }; })));
    else if (k === 'icon') h += D.fld(t('cf.icons'), pick('icon', s.icon, ICONS.map(function (x) { return { v: x, t: t('cf.ic.' + x) }; })));
    else h += D.fld(t('cf.look'), pick('look', s.look, LOOKS.map(function (x) { return { v: x, t: t('cf.lk.' + x) }; })));
    return h;
  }
  function remember() { var s = D.st, g = function (id) { var e = $(id); return e ? e.value : undefined; }; ['cfRange:range', 'cfA:a', 'cfB:b', 'cfN:n'].forEach(function (p) { var q = p.split(':'), v = g(q[0]); if (v !== undefined) s[q[1]] = v; }); }
  function draw() { remember(); D.show('cf', t(D.st.editing ? 'cf.edit' : 'cf.new'), form(), [{ act: 'cf-back', label: t('a.back'), kind: 'ghost' }, { act: 'cf-save', label: t('dl.save') }]); D.change = function (id) { if (id === 'kind') draw(); }; }
  A['cf-new'] = function () {
    var s = G.sel, def = D.st; D.st = { range: ref({ r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 }), kind: 'greaterThan', a: '', b: '', n: '10', pct: false, look: 'red', scale: 'gyr', bar: 'cf_s_bar', icon: '3TrafficLights1' }; draw();
  };
  A['cf-back'] = list;
  A['cf-save'] = function () {
    remember(); var s = D.st, sh = cur(), parts = String(s.range).trim().toUpperCase().replace(/\$/g, '').split(/\s+/).filter(Boolean), rs = parts.map(function (p) { return /^[A-Z]{1,3}\d+(:[A-Z]{1,3}\d+)?$/.test(p) ? Xrich.range(p) : null; });
    if (!parts.length || rs.some(function (q) { return !q; })) return Ui.toast(t('dv.bad'));
    var made = build(s, rs); if (typeof made === 'string') return Ui.toast(made);
    if (s.editing) drop(sh, s.editing);
    var wire = { ranges: Wb.areas(parts.join(' ')), stopIfTrue: !!(s.editing && s.editing.stop), rule: made.rule };
    (sh.cfNew = sh.cfNew || []).push({ wire: wire, xr: made.xr }); Xrich.add(sh, made.xr); Book.touch(); G.paint(); list(); Ui.toast(t('cf.saved'));
  };
  if (window.Menus) Menus.add('format', function () { return [{ t: t('cf.title') + '…', go: F.open }]; });
})();
