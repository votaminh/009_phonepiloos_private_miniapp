// Find — find and replace inside the page. Matches are painted with the browser's highlight (no marks written into the text); Replace only works while editing.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, HL = !!(window.CSS && CSS.highlights && window.Highlight);
  var Find = window.Find = { active: false, q: '', hits: [], at: -1 };
  function top() { $('docTop').innerHTML = SheetsView.find({ q: Find.q, count: Find.label(), edit: Doc.mode === 'edit' }); }
  Find.label = function () { return !Find.q ? '' : Find.hits.length ? t('fd.count', { i: Find.at + 1, n: Find.hits.length }) : t('fd.none'); };
  Find.open = function () { Ui.closeSheet(); Find.active = true; top(); setTimeout(function () { var i = $('fdQ'); if (i) { i.focus(); i.select(); } }, 80); };
  Find.close = function () { if (!Find.active) return false; Find.active = false; Find.q = ''; Find.hits = []; paint(); Doc.chrome(); return true; };
  function search(q) {
    Find.q = q; Find.hits = []; Find.at = -1;
    if (q) {
      var w = document.createTreeWalker(Doc.paper(), NodeFilter.SHOW_TEXT), n, ql = q.toLowerCase();
      while ((n = w.nextNode())) { var tx = n.nodeValue.toLowerCase(), i = 0; while ((i = tx.indexOf(ql, i)) >= 0) { var r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); Find.hits.push(r); i += q.length; } }
      if (Find.hits.length) { var y = $('docBody').scrollTop, k = Find.hits.findIndex(function (r) { return r.getBoundingClientRect().top + y >= y; }); Find.at = Math.max(0, k); }
    }
    paint(); goto();
  }
  function paint() {
    if (!HL) return;
    CSS.highlights.delete('find'); CSS.highlights.delete('findcur');
    if (!Find.hits.length) return;
    CSS.highlights.set('find', new Highlight(...Find.hits)); if (Find.at >= 0) CSS.highlights.set('findcur', new Highlight(Find.hits[Find.at]));
  }
  function goto() {
    var n = $('fdN'); if (n) n.textContent = Find.label();
    var r = Find.hits[Find.at]; if (!r) return;
    var el = r.startContainer.parentElement, body = $('docBody'), y = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
    body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    if (!HL) { var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  }
  function step(d) { if (!Find.hits.length) return; Find.at = (Find.at + d + Find.hits.length) % Find.hits.length; paint(); goto(); }
  A['d-find'] = Find.open; A['m-find'] = Find.open; A['f-close'] = Find.close;
  A['f-next'] = function () { step(1); }; A['f-prev'] = function () { step(-1); };
  function put(r, text) {
    var b = r.startContainer.parentElement.closest('.b.ed'); if (!b) return false;
    r.deleteContents(); r.insertNode(document.createTextNode(text)); b.dataset.m = '1'; return true;
  }
  A['f-rep'] = function () {
    var r = Find.hits[Find.at], to = ($('fdR') || {}).value || ''; if (!r) return;
    var keep = Find.at; if (put(r, to)) { Doc.snap(); search(Find.q); Find.at = Math.min(keep, Find.hits.length - 1); paint(); goto(); }
  };
  A['f-all'] = function () {
    var to = ($('fdR') || {}).value || '', n = 0; for (var i = Find.hits.length - 1; i >= 0; i--) if (put(Find.hits[i], to)) n++;
    Doc.snap(); search(Find.q); Ui.toast(t('fd.done', { n: n }));
  };
  document.addEventListener('input', function (e) { if (e.target.id === 'fdQ') search(e.target.value); });
})();
