// Format 2 — the pickers a computer's tool bar needs: colours (a palette and a hex box), borders (all, outer, inner, one side; style and colour), font size and font lists, alignment (across and up/down), wrapping, clearing formats, and copying a look to other cells.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, G = window.Grid, F = window.Format, X = window.Fmt2 = { bd: { style: 'thin', color: '' } }, pop = null, paint = null;

  // ---- colour picker ------------------------------------------------------------------------------------------------------------
  function sw(c, cur) { return '<button type="button" class="cp-s' + (cur && cur.toUpperCase() === c.toUpperCase() ? ' on' : '') + (c.toUpperCase() === window.AppPalette.base[9] ? ' white' : '') + '" data-v="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }
  X.closePop = function () { if (pop && pop.parentNode) pop.parentNode.removeChild(pop); pop = null; document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc, true); };
  function away(e) { if (pop && !pop.contains(e.target) && !(pop.from && pop.from.contains(e.target))) X.closePop(); }
  function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); X.closePop(); } }
  function at(el, anchor) {
    document.body.appendChild(el); var r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px'; el.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    pop = el; el.from = anchor; setTimeout(function () { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc, true); }, 0);
  }
  // onPick(colour | null)
  X.colors = function (anchor, cur, onPick, o) {
    X.closePop(); var P = window.AppPalette, d = document.createElement('div'); d.className = 'cpop'; o = o || {};
    d.innerHTML = '<button type="button" class="cp-reset" data-v="">' + Ui.esc(t(o.none ? 'cp.none' : 'cp.reset')) + '</button>'
      + '<div class="cp-row">' + P.base.map(function (c) { return sw(c, cur); }).join('') + '</div><div class="cp-row">' + P.vivid.map(function (c) { return sw(c, cur); }).join('') + '</div>'
      + P.shades.map(function (r) { return '<div class="cp-row">' + r.map(function (c) { return sw(c, cur); }).join('') + '</div>'; }).join('')
      + '<label class="cp-hex"><span>' + Ui.esc(t('cp.hex')) + '</span><input type="text" maxlength="7" placeholder="#RRGGBB" value="' + Ui.esc(cur || '') + '" autocomplete="off" spellcheck="false"></label>';
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; X.closePop(); onPick(b.dataset.v || null); });
    d.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = this.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { X.closePop(); onPick('#' + v.replace('#', '').toUpperCase()); } } });
    at(d, anchor);
  };

  // ---- borders ------------------------------------------------------------------------------------------------------------------
  var STY = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double'];
  // where is (r, c) in the block: which of its sides lie on the outside / inside of the block
  function edges(kind, b, r, c) {
    var top = r === b.r1, bot = r === b.r2, lef = c === b.c1, rig = c === b.c2, o = [0, 0, 0, 0];   // top, right, bottom, left
    if (kind === 'all') o = [1, 1, 1, 1]; else if (kind === 'outer') o = [top, rig, bot, lef]; else if (kind === 'inner') o = [!top, !rig, !bot, !lef];
    else if (kind === 'h') o = [!top, 0, !bot, 0]; else if (kind === 'v') o = [0, !rig, 0, !lef];
    else if (kind === 'top') o = [top, 0, 0, 0]; else if (kind === 'bottom') o = [0, 0, bot, 0]; else if (kind === 'left') o = [0, 0, 0, lef]; else if (kind === 'right') o = [0, rig, 0, 0];
    return o.map(function (x) { return x ? 1 : 0; });
  }
  X.border = function (kind) {
    if (Wb.readOnly) return; var b = F.bounds(), sh = G.geo.sh, line = X.bd.color || X.bd.style !== 'thin' ? { s: X.bd.style, c: X.bd.color || undefined } : 1;
    Wb.batch(function () {
      var r, c;
      for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) {
        var cur = (Wb.style(sh, r, c).bd || [0, 0, 0, 0]).slice(), add = edges(kind, b, r, c), out = [0, 1, 2, 3].map(function (k) { return kind === 'none' ? 0 : add[k] ? line : (cur[k] || 0); });
        Wb.setStyle(sh, { r1: r, c1: c, r2: r, c2: c }, { bd: kind === 'none' ? null : out });
        // the neighbour shares the line: keep both sides in step so the screen and the file agree
        if (kind !== 'none') { [[-1, 0, 2, 0], [0, -1, 1, 3], [1, 0, 0, 2], [0, 1, 3, 1]].forEach(function (d, k) { if (!add[k]) return; var nr = r + d[0], nc = c + d[1]; if (nr < 0 || nc < 0 || (nr >= b.r1 && nr <= b.r2 && nc >= b.c1 && nc <= b.c2)) return; var ns = (Wb.style(sh, nr, nc).bd || [0, 0, 0, 0]).slice(); ns[d[3]] = line; Wb.setStyle(sh, { r1: nr, c1: nc, r2: nr, c2: nc }, { bd: ns }); }); }
      }
    });
    G.changed(); if (window.Desk) Desk.sync();
  };
  X.bordersPop = function (anchor) {
    X.closePop(); var d = document.createElement('div'); d.className = 'bpop';
    var kinds = ['all', 'outer', 'inner', 'h', 'v', 'top', 'bottom', 'left', 'right', 'none'], ic = { all: 'bdall', outer: 'bdout', inner: 'bdin', h: 'bdh', v: 'bdv', top: 'bdt', bottom: 'bdb', left: 'bdl', right: 'bdr', none: 'bdn' };
    d.innerHTML = '<div class="bp-grid">' + kinds.map(function (k) { return '<button type="button" class="bp-b" data-k="' + k + '" title="' + Ui.esc(t('bd.' + k)) + '" aria-label="' + Ui.esc(t('bd.' + k)) + '">' + Ui.ic(ic[k], 20, 1.6) + '</button>'; }).join('') + '</div>'
      + '<div class="bp-tools"><button type="button" class="bp-t" data-a="color"><span class="bp-sw" style="background:' + (X.bd.color || 'currentColor') + '"></span>' + Ui.esc(t('bd.color')) + '</button>'
      + '<button type="button" class="bp-t" data-a="style">' + Ui.esc(t('bd.style')) + ': ' + Ui.esc(t('bd.' + X.bd.style)) + '</button></div>';
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'), tl = e.target.closest('[data-a]');
      if (b) { X.closePop(); X.border(b.dataset.k); }
      else if (tl && tl.dataset.a === 'color') X.colors(anchor, X.bd.color, function (c) { X.bd.color = c || ''; X.bordersPop(anchor); });
      else if (tl) { X.closePop(); PopMenu.show(anchor.getBoundingClientRect().left, anchor.getBoundingClientRect().bottom + 4, STY.map(function (s) { return { t: t('bd.' + s), on: X.bd.style === s, go: function () { X.bd.style = s; X.bordersPop(anchor); } }; })); }
    });
    at(d, anchor);
  };

  // ---- lists: font, size, alignment, wrapping ---------------------------------------------------------------------------------------
  X.fontMenu = function (anchor) {
    var cur = F.cur().f || Fonts.def, r = anchor.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 4, Fonts.list.map(function (f) { return { t: f.n, on: f.n === cur, go: function () { A['f-font']({ dataset: { n: f.n } }); } }; }), { from: anchor });
  };
  var SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  X.sizeMenu = function (anchor) {
    var cur = F.cur().sz || 11, r = anchor.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 4, SIZES.map(function (n) { return { t: String(n), on: n === cur, go: function () { F.apply({ sz: n }); } }; }), { from: anchor });
  };
  X.setSize = function (n) { n = Math.max(6, Math.min(400, Math.round(+n))); if (!isNaN(n)) F.apply({ sz: n }); };
  X.halign = function (anchor) { var cur = F.cur().al || '', r = anchor.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, ['left', 'center', 'right'].map(function (k) { return { t: t('al.' + k), on: cur === k, go: function () { F.apply({ al: cur === k ? null : k }); } }; }), { from: anchor }); };
  X.valign = function (anchor) { var cur = F.cur().va || 'bottom', r = anchor.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, [['top', 'al.top'], ['center', 'al.middle'], ['bottom', 'al.bottom']].map(function (p) { return { t: t(p[1]), on: cur === p[0], go: function () { F.apply({ va: p[0] === 'bottom' ? null : p[0] }); } }; }), { from: anchor }); };
  X.wrap = function (anchor) { var on = !!F.cur().wrap, r = anchor.getBoundingClientRect(); PopMenu.show(r.left, r.bottom + 4, [{ t: t('wr.overflow'), on: !on, go: function () { F.apply({ wrap: null }); } }, { t: t('wr.wrap'), on: on, go: function () { F.apply({ wrap: 1 }); } }, { t: t('wr.clip'), go: function () { F.apply({ wrap: null }); } }], { from: anchor }); };

  // ---- clear formats, copy a look ------------------------------------------------------------------------------------------------
  X.clearFormats = function () {
    if (Wb.readOnly) return; var b = F.bounds(), sh = G.geo.sh;
    Wb.batch(function () { var r, c; for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) { var st = Wb.style(sh, r, c), k = {}; Object.keys(st).forEach(function (n) { k[n] = null; }); k.bd = null; if (Object.keys(st).length) Wb.setStyle(sh, { r1: r, c1: c, r2: r, c2: c }, k); } });
    G.changed();
  };
  // paint format: pick up the look of the active cell, then drag over the cells that should have it (one use; double click on the button keeps it)
  X.pick = function (keep) { paint = { st: Object.assign({}, Wb.style(G.geo.sh, G.act().r, G.act().c)), keep: !!keep }; document.body.classList.add('painting'); };
  X.painting = function () { return !!paint; };
  X.drop = function () {
    if (!paint) return; var b = F.bounds(), sh = G.geo.sh, st = paint.st, keys = ['b', 'i', 'u', 's', 'sz', 'f', 'c', 'bg', 'al', 'va', 'wrap', 'nf', 'bd', 'in'];
    Wb.batch(function () { var r, c; for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) { var p = {}; keys.forEach(function (k) { p[k] = st[k] === undefined ? null : st[k]; }); Wb.setStyle(sh, { r1: r, c1: c, r2: r, c2: c }, p); } });
    if (!paint.keep) { paint = null; document.body.classList.remove('painting'); } G.changed();
  };
  X.cancelPaint = function () { paint = null; document.body.classList.remove('painting'); };
  A['pt-cancel'] = X.cancelPaint;
})();
