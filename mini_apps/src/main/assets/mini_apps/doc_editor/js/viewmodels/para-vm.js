// Para — the formatting of whole paragraphs the way Word's Paragraph group does it: space before and after, line spacing, indents (left, right, first line, hanging), shading, keep-with-next, page break before, and a style from the gallery.
// What the person sets is kept on the paragraph as data-fmt (the engine's own short keys, see entry.ts) and drawn at once; Plan sends it to the engine, which writes it into the paragraph's properties.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, P = window.Para = {};
  function isEd(b) { return !!b && b.classList.contains('ed'); }
  // the paragraphs the selection touches (the caret's paragraph when it is only a caret)
  P.blocks = function () {
    var r = Surface.range(); if (!r) { var b = Edit.block(); return b ? [b] : []; }
    var sp = Surface.span(r), bs = Surface.blocks(), i = bs.indexOf(sp.a), z = bs.indexOf(sp.z); if (i < 0) return []; if (z < i) z = i;
    return bs.slice(i, z + 1).filter(isEd);
  };
  function direct(b) { try { return JSON.parse(b.dataset.fmt || '{}'); } catch (e) { return {}; } }
  // what a style alone gives a paragraph
  function fromStyle(id) {
    var s = Styles.get(id) || Styles.get(Styles.def), d = (s && s.d) || {}, df = Styles.defaults || {}, e = {};
    e.sb = d.spaceBeforeTwips != null ? d.spaceBeforeTwips : (df.spaceBeforeTwips || 0); e.sa = d.spaceAfterTwips != null ? d.spaceAfterTwips : (df.spaceAfterTwips || 0);
    var lr = d.lineRule || df.lineRule || 'auto', lv = d.lineSpacing != null ? d.lineSpacing : df.lineSpacing; if (lr === 'auto') e.ln = { rule: 'auto', raw: Math.round((lv || 1) * 240) }; else e.ln = { rule: lr, raw: d.lineRawTwips || df.lineRawTwips || 240 };
    e.il = d.indentLeftTwips || 0; e.ir = d.indentRightTwips || 0; e.fi = d.indentFirstLineTwips || 0; e.al = d.align; e.sh = d.shadingFill; e.bd = d.borderSides; e.kn = !!d.keepNext; e.pb = !!d.pageBreakBefore;
    return e;
  }
  // the paragraph's formatting as it is drawn: what the file said (or its style says), then what was set here
  P.eff = function (b) {
    var src = b.dataset.src, o = src !== undefined && Doc.bmap && Doc.bmap[src], same = o && o.eff && (b.dataset.st || Styles.def) === (o.styleId || Styles.def), e = same ? Object.assign({}, o.eff) : fromStyle(b.dataset.st || (o && o.styleId));
    var f = direct(b);
    ['sb', 'sa', 'il', 'ir', 'fi', 'sh', 'kn', 'pb'].forEach(function (k) { if (f[k] !== undefined && f[k] !== null) e[k] = f[k]; });
    if (f.ln != null) e.ln = { rule: f.lr || 'auto', raw: f.lr && f.lr !== 'auto' ? f.lw : Math.round(f.ln * 240) };
    if (f.bd !== undefined) e.bd = f.bd ? borderObj(f.bd) : null;
    if (f.tabs) e.tabs = f.tabs;
    if (f.al) e.al = f.al; else if (b.dataset.al) e.al = b.dataset.al;
    return e;
  };
  function borderObj(str) { var o = {}; String(str).split('').forEach(function (k) { o[k] = { szPt: 0.75, color: '15171C' }; }); return o; }
  function borderStr(bd) { return bd ? ['t', 'b', 'l', 'r'].filter(function (k) { return bd[k] && !bd[k].none; }).join('') : ''; }
  P.paint = function (b) {
    var pgp = b.style.getPropertyValue('--pgp'); b.style.cssText = Render.effCss(P.eff(b), b.dataset.t === 'l'); if (pgp) b.style.setProperty('--pgp', pgp);
    if (window.Tabs) Tabs.layout(b);
    b.dataset.kn = P.eff(b).kn ? '1' : ''; if (!b.dataset.kn) b.removeAttribute('data-kn'); if (P.eff(b).pb) b.dataset.pbb = '1'; else b.removeAttribute('data-pbb');
  };
  // patch: { sb, sa, ln, il, ir, fi, sh, kn, pb, al }; a null value takes the setting back to the style's
  P.set = function (patch, bs) {
    bs = bs || P.blocks(); if (!bs.length) return Ui.toast(t('e.tap'));
    bs.forEach(function (b) {
      var f = direct(b); Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete f[k]; else f[k] = patch[k]; });
      if (patch.ln !== undefined && patch.ln !== null && patch.lr === undefined) { delete f.lr; delete f.lw; }
      b.dataset.fmt = JSON.stringify(f); if (!Object.keys(f).length) b.removeAttribute('data-fmt'); b.dataset.m = '1';
      if (patch.al !== undefined) { if (patch.al === 'left' || patch.al === null) b.removeAttribute('data-al'); else b.dataset.al = patch.al; }
      P.paint(b);
    });
    Doc.snap(); Edit.sync(); if (window.Paginate) Paginate.schedule(0); if (window.Ribbon) Ribbon.sync();
  };
  // what the first paragraph says now, for the controls
  P.read = function () { var b = P.blocks()[0]; if (!b) return null; var e = P.eff(b); return { sb: e.sb || 0, sa: e.sa || 0, ln: e.ln, il: e.il || 0, ir: e.ir || 0, fi: e.fi || 0, al: e.al || 'left', kn: !!e.kn, pb: !!e.pb, tabs: e.tabs || [], sh: e.sh, bd: typeof e.bd === 'string' ? e.bd : borderStr(e.bd) }; };

  // ---- the style of the paragraph --------------------------------------------------------------------------------------------------------
  P.setStyle = function (id) {
    var st = Styles.get(id), bs = P.blocks(); if (!st || !bs.length) return;
    bs.forEach(function (b) {
      var lv = st.lv && st.lv >= 1 && st.lv <= 3 ? st.lv : 0, n = b;
      if (lv || b.dataset.t === 'h') { Struct.putCaret(b, { a: 0, z: 0 }); n = Struct.setStyle(lv) || b; }
      n.dataset.st = id; if (lv === 0 && n.dataset.t !== 'l') { n.dataset.t = 'p'; }
      n.removeAttribute('data-fmt'); n.dataset.m = '1'; P.paint(n);
    });
    Doc.snap(); Edit.sync(); if (window.Paginate) Paginate.schedule(0); if (window.Ribbon) Ribbon.sync();
  };
  P.styleOf = function (b) { var id = b && (b.dataset.st || (b.dataset.src !== undefined && Doc.bmap && Doc.bmap[b.dataset.src] && Doc.bmap[b.dataset.src].styleId)) || Styles.def; return id; };

  // ---- spacing menu and the Paragraph dialog --------------------------------------------------------------------------------------------------------
  var LINES = [1, 1.15, 1.5, 2, 2.5, 3];
  A['pa-line'] = function (el) {
    var cur = P.read(), mult = cur && cur.ln && cur.ln.rule === 'auto' ? Math.round(cur.ln.raw / 240 * 100) / 100 : 0, r = el.getBoundingClientRect();
    var items = LINES.map(function (v) { return { t: v.toFixed(v % 1 ? 2 : 1).replace(/0$/, ''), on: mult === v, go: function () { P.set({ ln: v }); } }; });
    items.push('-'); items.push({ t: t('pa.before'), on: cur && cur.sb > 0, go: function () { P.set({ sb: cur && cur.sb > 0 ? 0 : 240 }); } }); items.push({ t: t('pa.after'), on: cur && cur.sa > 0, go: function () { P.set({ sa: cur && cur.sa > 0 ? 0 : 160 }); } });
    items.push('-'); items.push({ t: t('pa.opts') + '…', go: function () { A['pa-open'](); } });
    PopMenu.show(r.left, r.bottom + 2, items, { from: el });
  };
  function num(id, label, v, step, unit) { return '<label class="pa-f"><span>' + esc(label) + '</span><input id="' + id + '" type="text" inputmode="decimal" data-step="' + (step || 1) + '" value="' + v + '" autocomplete="off"><em>' + esc(unit || '') + '</em></label>'; }
  function opt(id, label, list, cur) { return '<label class="pa-f"><span>' + esc(label) + '</span><span class="pa-seg" id="' + id + '">' + list.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (String(x[0]) === String(cur) ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</span></label>'; }
  A['pa-open'] = function () {
    var c = P.read(); if (!c) return Ui.toast(t('e.tap'));
    var pt = function (tw) { return Math.round(tw / 20 * 10) / 10; }, mult = c.ln && c.ln.rule === 'auto' ? Math.round(c.ln.raw / 240 * 100) / 100 : 1, rule = c.ln ? c.ln.rule : 'auto', first = c.fi > 0 ? 'first' : c.fi < 0 ? 'hang' : 'none';
    Ui.sheet('para', '<h2 class="sh-h">' + esc(t('pa.title')) + '</h2>'
      + opt('paAl', t('pa.align'), [['left', t('p.left')], ['center', t('p.center')], ['right', t('p.right')], ['justify', t('p.justify')]], c.al)
      + '<div class="pa-grid">' + num('paIl', t('pa.left'), pt(c.il), 0.5, 'pt') + num('paIr', t('pa.right'), pt(c.ir), 0.5, 'pt') + '</div>'
      + opt('paSp', t('pa.special'), [['none', t('pa.none')], ['first', t('pa.first')], ['hang', t('pa.hang')]], first) + num('paBy', t('pa.by'), Math.abs(pt(c.fi)), 0.5, 'pt')
      + '<div class="pa-grid">' + num('paSb', t('pa.before'), pt(c.sb), 1, 'pt') + num('paSa', t('pa.after'), pt(c.sa), 1, 'pt') + '</div>'
      + opt('paRule', t('pa.line'), [['auto', t('pa.multiple')], ['atLeast', t('pa.atleast')], ['exact', t('pa.exact')]], rule) + num('paAt', t('pa.at'), rule === 'auto' ? mult : pt(c.ln.raw), 0.05, rule === 'auto' ? '×' : 'pt')
      + '<div class="pa-f"><span>' + esc(t('pa.shade')) + '</span><span class="pa-sws" id="paSh">' + ['', 'hl_yellow', 'hl_green', 'hl_pink', 'hl_blue', 'chip', 'accent_soft'].map(function (k) { var hx = k ? C(k).replace('#', '').toUpperCase() : ''; return '<button type="button" class="pa-sw' + (String(c.sh || '').toUpperCase() === hx ? ' on' : '') + (k ? '' : ' none') + '" data-v="' + hx + '" style="' + (k ? 'background:' + C(k) : '') + '" aria-label="' + esc(k || t('f.nohl')) + '"></button>'; }).join('') + '</span></div>'
      + opt('paBd', t('pa.border'), [['', t('pa.none')], ['tblr', t('pa.box')], ['b', t('pa.bottom')], ['t', t('pa.top')]], c.bd || '')
      + '<div class="pa-grid"><label class="pa-f chk"><button type="button" id="paKn" class="pa-tg' + (c.kn ? ' on' : '') + '"></button><span>' + esc(t('pa.keepnext')) + '</span></label><label class="pa-f chk"><button type="button" id="paPb" class="pa-tg' + (c.pb ? ' on' : '') + '"></button><span>' + esc(t('pa.pbb')) + '</span></label></div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="tb-open">' + esc(t('tb.title')) + '…</button><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="pa-go">' + esc(t('a.apply')) + '</button></div>');
  };
  document.addEventListener('click', function (e) { var sw = e.target.closest && e.target.closest('.pa-sw'); if (sw) { Array.prototype.forEach.call(sw.parentNode.children, function (x) { x.classList.toggle('on', x === sw); }); return; } var tg = e.target.closest && e.target.closest('.pa-tg'); if (tg) { tg.classList.toggle('on'); return; } var b = e.target.closest && e.target.closest('.pa-seg button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
  function segv(id) { var o = $(id) && $(id).querySelector('.on'); return o ? o.dataset.v : null; }
  function val(id) { return parseFloat(String($(id).value).replace(',', '.')) || 0; }
  function tw(id) { return Math.round(val(id) * 20); }
  A['pa-go'] = function () {
    var sp = segv('paSp'), by = tw('paBy'), rule = segv('paRule'), at = val('paAt') || 1, p = { al: segv('paAl'), il: tw('paIl'), ir: tw('paIr'), fi: sp === 'first' ? by : sp === 'hang' ? -by : 0, sb: tw('paSb'), sa: tw('paSa'), kn: $('paKn').classList.contains('on'), pb: $('paPb').classList.contains('on') };
    var shOn = $('paSh').querySelector('.on'); p.sh = shOn && shOn.dataset.v ? shOn.dataset.v : null; var bd = segv('paBd'); p.bd = bd || ''; if (!bd) p.bd = null;
    if (rule === 'auto') { p.ln = at; } else { p.ln = at; p.lr = rule; p.lw = Math.round(at * 20); }
    Ui.closeSheet(); if (p.il && p.fi < 0 && p.il < -p.fi) p.il = -p.fi; P.set(p);
  };
  // indents from the ribbon: Decrease / Increase move the left indent by half an inch (a list item changes level instead)
  A['pa-in'] = function (el) { var d = +el.dataset.v, c = P.read(); if (!c) return; P.set({ il: Math.max(0, c.il + d * 720) }); };
})();
