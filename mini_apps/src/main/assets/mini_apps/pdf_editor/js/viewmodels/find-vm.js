// Find — search the whole PDF: the bar with the count and the arrows, the list of results under the pages, and the matches lit on the pages.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, timer = 0, run = 0;
  var F = window.Find = { open: false, q: '', cs: false, hits: [], cur: -1, rep: '' };

  Read.layers.push(function (ov, i) {
    if (!F.open || !F.hits.length) return;
    ov.insertAdjacentHTML('beforeend', F.hits.map(function (h, k) { if (h.page !== i) return ''; var b = Read.box(i, h.rect); return '<i class="hit' + (k === F.cur ? ' cur' : '') + '" style="left:' + (b.l - 1) + 'px;top:' + (b.t - 1) + 'px;width:' + (b.w + 2) + 'px;height:' + (b.h + 2) + 'px"></i>'; }).join(''));
  });
  // the bar is written once; later only the count and the arrows change, so the keyboard stays up while you type
  function bar() {
    var n = F.hits.length, cnt = F.q ? (n ? (F.cur + 1) + ' / ' + n : '0') : '', i = $('fdQ');
    if (F.open && i) {
      i.nextElementSibling.textContent = cnt;
      Array.prototype.forEach.call($('docTop').querySelectorAll('[data-act="fd-prev"],[data-act="fd-next"]'), function (b) { b.classList.toggle('off', !n); });
      var c = $('docTop').querySelector('.fd-cs'); if (c) { c.classList.toggle('on', F.cs); c.setAttribute('aria-pressed', String(F.cs)); }
    } else $('docTop').innerHTML = FindView.bar({ q: F.q, count: cnt, cs: F.cs, none: !n });
    $('fdPanel').innerHTML = FindView.list(F.hits, F.cur, F.q, F.searching, F.rep);
  }
  F.show = function () {
    if (F.open) return; Text.clear(); F.open = true; F.hits = []; F.cur = -1; $('pgDoc').classList.add('finding'); $('fdPanel').classList.remove('hidden'); bar();
    setTimeout(function () { var i = $('fdQ'); if (i) { i.focus(); i.select(); } }, 80); Read.floatAt();
  };
  F.close = function () {
    if (!F.open) return false; F.open = false; F.hits = []; clearTimeout(timer); $('pgDoc').classList.remove('finding'); $('fdPanel').classList.add('hidden'); Read.repaint(); Read.chrome(); return true;
  };
  async function search() {
    var my = ++run, q = F.q; if (!q) { F.hits = []; F.cur = -1; F.searching = false; bar(); Read.repaint(); return; }
    F.searching = true; bar();
    try { var hits = await PdfSvc.find(q, F.cs); if (my !== run) return; F.hits = hits; F.cur = hits.length ? 0 : -1; F.searching = false; bar(); Read.repaint(); if (hits.length) reveal(); }
    catch (e) { F.searching = false; bar(); }
    var i = $('fdQ'); if (i && document.activeElement !== i && my === run && !F.hits.length) { /* leave the keyboard as it is */ }
  }
  function reveal() { var h = F.hits[F.cur]; if (!h) return; Read.goto(h.page, Read.box(h.page, h.rect).t); }
  function go(d) { if (!F.hits.length) return; F.cur = (F.cur + d + F.hits.length) % F.hits.length; bar(); Read.repaint(); reveal(); var el = $('fdPanel').querySelector('.res.on'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  // ---- replace, redact ---------------------------------------------------------------------------------------------------------------------
  function inBlock(h, bl) { var cx = (h.rect[0] + h.rect[2]) / 2, cy = (h.rect[1] + h.rect[3]) / 2; return bl.filter(function (b) { return cx >= b.rect[0] - 2 && cx <= b.rect[2] + 2 && cy >= b.rect[1] - 2 && cy <= b.rect[3] + 2; })[0]; }
  function nth(text, q, rep, n, cs) {   // n = -1: every one; else the n-th (from 0)
    var src = cs ? text : text.toLowerCase(), key = cs ? q : q.toLowerCase(), out = '', at = 0, k = 0, j;
    while ((j = src.indexOf(key, at)) >= 0) { out += text.slice(at, j) + (n < 0 || n === k ? rep : text.substr(j, q.length)); at = j + q.length; k++; }
    return out + text.slice(at);
  }
  async function replace(which) {
    var rep = F.rep, list = which === 'one' ? [F.hits[F.cur]] : F.hits; if (!list[0]) return; var by = {};
    list.forEach(function (h) { (by[h.page] = by[h.page] || []).push(h); });
    var edits = [];
    for (var p in by) {
      var bl = await Doc.blocks(+p), groups = {};
      by[p].forEach(function (h) { var b = inBlock(h, bl); if (b) (groups[b.id] = groups[b.id] || { b: b, hs: [] }).hs.push(h); });
      Object.keys(groups).forEach(function (id) {
        var g = groups[id], text = g.b.text;
        if (which === 'one') { var same = F.hits.filter(function (h) { return h.page === +p && inBlock(h, bl) === g.b; }).sort(function (a, b) { return a.rect[0] - b.rect[0]; }); text = nth(text, F.q, rep, same.indexOf(F.hits[F.cur]), F.cs); }
        else text = nth(text, F.q, rep, -1, F.cs);
        edits.push({ pageIndex: +p, rect: g.b.rect, oldText: g.b.text, newText: text, fontSize: g.b.fs });
      });
    }
    if (!edits.length) return Ui.toast(t('fd.rep.none'));
    var r = await Viewer.run(function () { return PdfSvc.edit(edits); }); if (!r) return;
    Ui.toast(r.skipped && r.skipped.length ? t('tx.skipped') : t('fd.rep.done', { n: edits.length })); search();
  }
  A['fd-rep1'] = function () { replace('one'); }; A['fd-repall'] = function () { replace('all'); };
  A['fd-redact'] = function () {
    if (!F.hits.length) return; var hits = F.hits.slice(); F.close(); Read.setMode('redact'); Mark.area = false;
    hits.forEach(function (h) { Mark.marks.push({ page: h.page, rect: h.rect.slice() }); }); Read.repaint(); Read.chrome(); Ui.toast(t('fd.redact.n', { n: hits.length }));
  };
  $('fdPanel').addEventListener('input', function (e) { if (e.target.id === 'fdR') F.rep = e.target.value; });
  A['fd-open'] = function () { Ui.closeSheet(); F.show(); };
  A['fd-close'] = function () { F.close(); };
  A['fd-next'] = function () { go(1); }; A['fd-prev'] = function () { go(-1); };
  A['fd-case'] = function () { F.cs = !F.cs; bar(); search(); };
  A['fd-pick'] = function (el) { F.cur = +el.dataset.k; bar(); Read.repaint(); reveal(); };
  $('docTop').addEventListener('input', function (e) {
    if (e.target.id !== 'fdQ') return; F.q = e.target.value; clearTimeout(timer); timer = setTimeout(search, 260);
  });
  $('docTop').addEventListener('keydown', function (e) { if (e.target.id === 'fdQ' && e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); if (F.hits.length) go(1); else search(); } });
})();
