// Find — search the whole PDF: the bar with the count and the arrows, the list of results under the pages, and the matches lit on the pages.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, timer = 0, run = 0;
  var F = window.Find = { open: false, q: '', cs: false, hits: [], cur: -1 };

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
    $('fdPanel').innerHTML = FindView.list(F.hits, F.cur, F.q, F.searching);
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
