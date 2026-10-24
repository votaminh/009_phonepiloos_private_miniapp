// Find — find and replace across the current sheet or all sheets. The panel replaces the title bar while it is open.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, F = window.Find = { open: false }, st = { q: '', rep: '', all: false, cs: false }, hits = [], at = -1, timer = 0;

  function paint() {
    var p = $('fdPanel'); if (!F.open) { p.classList.add('hidden'); p.innerHTML = ''; return; }
    var q = $('fdQ'), r = $('fdR'), keepQ = q && document.activeElement === q, keepR = r && document.activeElement === r;
    p.classList.remove('hidden');
    if (!q) p.innerHTML = SheetsView.find({ q: st.q, rep: st.rep, all: st.all, cs: st.cs, ro: Wb.readOnly, count: count() });
    else { var c = p.querySelector('.fd-in span'); if (c) c.textContent = count(); }
    if (!keepQ && !keepR && !q) setTimeout(function () { var i = $('fdQ'); if (i) i.focus(); }, 60);
  }
  function count() { return st.q ? (hits.length ? t('fd.count', { i: at + 1, n: hits.length }) : t('fd.none')) : ''; }
  // accents do not matter: "pham" finds "phẩm" (one character in, one out, so positions line up)
  function fold(s) { var o = '', i, c; s = String(s).normalize('NFC'); for (i = 0; i < s.length; i++) { c = s[i].normalize('NFD')[0]; o += c === 'đ' ? 'd' : c === 'Đ' ? 'D' : c; } return st.cs ? o : o.toLowerCase(); }
  var norm = fold;
  function run() {
    hits = []; at = -1; var q = norm(st.q); if (!q) return paint();
    Wb.sheets.forEach(function (sh, si) {
      if (!st.all && si !== Wb.on) return;
      Object.keys(sh.cells).forEach(function (a) {
        if (hits.length >= 5000) return; var p = SheetSvc.addr(a), f = Fmt.cell(sh, p.r, p.c);
        if (norm(f.t).indexOf(q) >= 0 || (sh.cells[a].f && norm(sh.cells[a].f).indexOf(q) >= 0)) hits.push({ si: si, r: p.r, c: p.c });
      });
    });
    hits.sort(function (a, b) { return a.si - b.si || a.r - b.r || a.c - b.c; });
    if (hits.length) go(hits.findIndex(function (h) { return h.si === Wb.on && (h.r > Grid.sel.r1 || (h.r === Grid.sel.r1 && h.c >= Grid.sel.c1)); }) >= 0 ? hits.findIndex(function (h) { return h.si === Wb.on && (h.r > Grid.sel.r1 || (h.r === Grid.sel.r1 && h.c >= Grid.sel.c1)); }) : 0, true); else paint();
  }
  function go(i, keepFocus) {
    if (!hits.length) return; at = (i + hits.length) % hits.length; var h = hits[at];
    if (h.si !== Wb.on) Book.show(h.si);
    Grid.select(h.r, h.c); paint(); if (!keepFocus) { var q = $('fdQ'); if (q) q.blur(); }
  }
  A['fd-open'] = function () { Ui.closeSheet(); F.open = true; paint(); if (st.q) run(); };
  A['fd-close'] = function () { F.open = false; hits = []; paint(); };
  A['fd-next'] = function () { go(at + 1, true); }; A['fd-prev'] = function () { go(at - 1, true); };
  A['fd-all-sheets'] = function () { st.all = !st.all; $('fdPanel').innerHTML = ''; paint(); run(); };
  A['fd-case'] = function () { st.cs = !st.cs; $('fdPanel').innerHTML = ''; paint(); run(); };
  document.addEventListener('input', function (e) {
    if (e.target.id === 'fdQ') { st.q = e.target.value; clearTimeout(timer); timer = setTimeout(run, 140); }
    else if (e.target.id === 'fdR') st.rep = e.target.value;
  });
  function replaceIn(h) {
    var sh = Wb.sheets[h.si], cell = sh.cells[SheetSvc.ref(h.r, h.c)]; if (!cell || cell.f) return false;
    var raw = Fmt.raw(sh, h.r, h.c).normalize('NFC'), base = fold(raw), q = fold(st.q), next = '', pos = 0, i;
    if (!q) return false;
    while ((i = base.indexOf(q, pos)) >= 0) { next += raw.slice(pos, i) + st.rep; pos = i + q.length; }
    next += raw.slice(pos); if (next === raw) return false; var p = Clip.parse(next, Wb.style(sh, h.r, h.c));
    return Wb.setCell(sh, h.r, h.c, p.v === undefined ? null : p.v, p.f || '');
  }
  A['fd-one'] = function () { if (at < 0 || Wb.readOnly) return; var h = hits[at]; Wb.batch(function () { replaceIn(h); }); Grid.changed(); run(); };
  A['fd-all'] = function () { if (!hits.length || Wb.readOnly) return; var n = 0; Wb.batch(function () { hits.forEach(function (h) { if (replaceIn(h)) n++; }); }); Grid.changed(); run(); Ui.toast(t('fd.done', { n: n })); };
  F.close = function () { if (!F.open) return false; A['fd-close'](); return true; };
})();
