// Find — search the whole deck: the bar with the count and arrows, the list of results under the slide, replace on this slide or in the whole deck.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, timer = 0, run = 0;
  var F = window.Find = { open: false, q: '', rep: '', cs: false, hits: [], cur: -1, searching: false };

  function bar() {
    var n = F.hits.length, cnt = F.q ? (n ? (F.cur + 1) + ' / ' + n : '0') : '', i = $('fdQ');
    if (F.open && i) {
      i.nextElementSibling.textContent = cnt;
      Array.prototype.forEach.call($('deckTop').querySelectorAll('[data-act="fd-prev"],[data-act="fd-next"]'), function (b) { b.classList.toggle('off', !n); });
      var c = $('deckTop').querySelector('.fd-cs'); if (c) { c.classList.toggle('on', F.cs); c.setAttribute('aria-pressed', String(F.cs)); }
    } else $('deckTop').innerHTML = FindView.bar({ q: F.q, rep: F.rep, count: cnt, cs: F.cs, none: !n });
    $('fdPanel').innerHTML = FindView.list(F.hits, F.cur, F.q, F.searching);
  }
  F.show = function () {
    if (F.open) return; F.open = true; F.hits = []; F.cur = -1; $('pgDeck').classList.add('finding'); $('fdPanel').classList.remove('hidden'); bar(); Stage.layout(); Stage.show();
    setTimeout(function () { var i = $('fdQ'); if (i) { i.focus(); i.select(); } }, 80);
  };
  F.close = function () {
    if (!F.open) return false; F.open = false; F.hits = []; clearTimeout(timer); $('pgDeck').classList.remove('finding'); $('fdPanel').classList.add('hidden'); Viewer.chrome(); Stage.layout(); Stage.show(); return true;
  };
  async function search() {
    var my = ++run, q = F.q; if (!q) { F.hits = []; F.cur = -1; F.searching = false; bar(); return; }
    F.searching = true; bar();
    try { var hits = await PptSvc.find(q, F.cs); if (my !== run) return; F.hits = hits; F.cur = hits.length ? 0 : -1; F.searching = false; bar(); if (hits.length) reveal(); }
    catch (e) { F.searching = false; bar(); }
  }
  function reveal() {
    var h = F.hits[F.cur]; if (!h) return;
    if (h.slide !== Deck.cur) { Deck.cur = h.slide; Deck.sel = null; Stage.show().then(function () { Stage.select(h.el); }); } else Stage.select(h.el);
  }
  function go(d) { if (!F.hits.length) return; F.cur = (F.cur + d + F.hits.length) % F.hits.length; bar(); reveal(); var el = $('fdPanel').querySelector('.res.on'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  A['fd-open'] = function () { Ui.closeSheet(); F.show(); };
  A['fd-close'] = function () { F.close(); };
  A['fd-next'] = function () { go(1); }; A['fd-prev'] = function () { go(-1); };
  A['fd-case'] = function () { F.cs = !F.cs; bar(); search(); };
  A['fd-pick'] = function (el) { F.cur = +el.dataset.k; bar(); reveal(); };
  function replace(onlyThis) {
    if (!F.q) return; var op = Deck.op('findReplace', null, { find: F.q, replace: F.rep, matchCase: F.cs }); if (onlyThis) op.slideIndex = Deck.cur;
    Viewer.run([op], 'busy.edit').then(function (r) { if (r) { Ui.toast(t('fd.done')); search(); } });
  }
  A['fd-one'] = function () { replace(true); }; A['fd-all'] = function () { replace(false); };
  $('deckTop').addEventListener('input', function (e) {
    if (e.target.id === 'fdQ') { F.q = e.target.value; clearTimeout(timer); timer = setTimeout(search, 260); } else if (e.target.id === 'fdR') F.rep = e.target.value;
  });
  $('deckTop').addEventListener('keydown', function (e) { if (e.target.id === 'fdQ' && e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); if (F.hits.length) go(1); else search(); } });
})();
