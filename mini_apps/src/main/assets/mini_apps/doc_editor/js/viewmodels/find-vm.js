// Find — find and replace inside the page. Matches are painted with the browser's highlight (no marks written into the text); Replace only works while editing.
// Options: match case, whole word, regular expression, ignore accents (Vietnamese tones). A match may run across formatting (bold in the middle of a word). On the computer it is a floating panel at the top right (Ctrl+F, Ctrl+H); on the phone it is the bar of the top.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, esc = Ui.esc, A = App.acts, HL = !!(window.CSS && CSS.highlights && window.Highlight);
  var Find = window.Find = { active: false, q: '', hits: [], meta: [], at: -1, opts: { c: false, w: false, r: false, a: false } };
  function pane() { return $('fdPane'); }
  function row() {
    var o = Find.opts; function tg(k, label, tip) { return '<button type="button" class="fd-o' + (o[k] ? ' on' : '') + '" data-act="f-opt" data-k="' + k + '" title="' + esc(t(tip)) + '" aria-pressed="' + !!o[k] + '">' + label + '</button>'; }
    return tg('c', 'Aa', 'fd.case') + tg('w', 'ab', 'fd.word') + tg('r', '.*', 'fd.regex') + tg('a', 'á', 'fd.accent');
  }
  function top() {
    var edit = Doc.mode === 'edit';
    if (Wide.pc) {
      var p = pane(); if (!p) { p = document.createElement('div'); p.id = 'fdPane'; p.className = 'fd-pane'; p.setAttribute('role', 'search'); $('pgDoc').appendChild(p); p.addEventListener('pointerdown', function (e) { if (!e.target.closest('input')) e.preventDefault(); }); }
      var q = ($('fdQ') || {}).value, r = ($('fdR') || {}).value;
      p.innerHTML = '<div class="fd-pr"><div class="fd-box">' + Ui.ic('search', 18, 1.9) + '<input id="fdQ" type="text" value="' + esc(q !== undefined ? q : Find.q) + '" placeholder="' + esc(t('fd.ph')) + '" autocomplete="off"><span class="fd-n" id="fdN">' + esc(Find.label()) + '</span></div>'
        + '<button type="button" class="ib" data-act="f-prev" aria-label="' + esc(t('fd.prev')) + '">' + Ui.ic('up', 20, 2) + '</button><button type="button" class="ib" data-act="f-next" aria-label="' + esc(t('fd.next')) + '">' + Ui.ic('down', 20, 2) + '</button><button type="button" class="ib" data-act="f-close" aria-label="' + esc(t('fd.close')) + '">' + Ui.ic('close', 20, 2) + '</button></div>'
        + '<div class="fd-pr fd-opts">' + row() + '</div>'
        + (edit ? '<div class="fd-pr"><div class="fd-box2"><input id="fdR" type="text" value="' + esc(r || '') + '" placeholder="' + esc(t('fd.replace')) + '" autocomplete="off"></div><button type="button" class="pill" data-act="f-rep">' + esc(t('fd.btn')) + '</button><button type="button" class="pill solid" data-act="f-all">' + esc(t('fd.all')) + '</button></div>' : '');
      p.classList.add('on'); return;
    }
    $('docTop').innerHTML = SheetsView.find({ q: Find.q, count: Find.label(), edit: edit });
  }
  Find.label = function () { return !Find.q ? '' : Find.bad ? t('fd.bad') : Find.hits.length ? t('fd.count', { i: Find.at + 1, n: Find.hits.length }) : t('fd.none'); };
  Find.open = function (replace) {
    Ui.closeSheet(); Find.active = true; var sel = String(getSelection()).trim(); if (sel && sel.length < 80 && sel.indexOf('\n') < 0) Find.q = sel; top(); if (Find.q) { if ($('fdQ')) $('fdQ').value = Find.q; search(Find.q); }
    setTimeout(function () { var i = $(replace === true && $('fdR') ? 'fdR' : 'fdQ'); if (i) { i.focus(); i.select(); } }, 80);
  };
  Find.close = function () { if (!Find.active) return false; Find.active = false; Find.q = ''; Find.hits = []; Find.meta = []; paint(); var p = pane(); if (p) p.classList.remove('on'); Doc.chrome(); return true; };

  // one character at a time, so the folded text is exactly as long as the original and a position in one is a position in the other
  function foldCh(c) { if (c === 'đ' || c === 'Đ') return c === 'đ' ? 'd' : 'D'; var d = c.normalize('NFD'); return d.length > 1 && /[̀-ͯ]/.test(d.slice(1)) ? d[0] : c; }
  function fold(s) { var o = ''; for (var i = 0; i < s.length; i++) o += foldCh(s[i]); return o; }
  function pattern(q) {
    var o = Find.opts, src = o.r ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (o.a && !o.r) src = fold(src);
    if (o.w) src = '(?<![\\p{L}\\p{N}_])(?:' + src + ')(?![\\p{L}\\p{N}_])';
    try { return new RegExp(src, 'gu' + (o.c ? '' : 'i')); } catch (e) { return null; }
  }
  // the text of one block with the place of every character: [{ n: node, o: offset }]
  function flat(b) {
    var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentElement && n.parentElement.closest('.pgsp') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n, tx = '', map = [];
    while ((n = w.nextNode())) { for (var i = 0; i < n.nodeValue.length; i++) map.push({ n: n, o: i }); tx += n.nodeValue; }
    return { tx: tx, map: map };
  }
  function search(q) {
    Find.q = q; Find.hits = []; Find.meta = []; Find.at = -1; Find.bad = false;
    if (q) {
      var re = pattern(q); if (!re) Find.bad = true;
      else Array.prototype.forEach.call(Doc.paper().children, function (b) {
        if (!b.classList.contains('b') || b.hidden) return; var f = flat(b); if (!f.tx) return; var hay = Find.opts.a ? fold(f.tx) : f.tx, m; re.lastIndex = 0;
        while ((m = re.exec(hay))) {
          if (!m[0].length) { re.lastIndex++; continue; }
          var a = f.map[m.index], z = f.map[m.index + m[0].length - 1]; if (!a || !z) continue;
          var r = document.createRange(); r.setStart(a.n, a.o); r.setEnd(z.n, z.o + 1); Find.hits.push(r); Find.meta.push(m);
        }
      });
      if (Find.hits.length) { var y = $('docBody').getBoundingClientRect().top, k = Find.hits.findIndex(function (r) { return r.getBoundingClientRect().top >= y; }); Find.at = Math.max(0, k); }
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
  A['d-find'] = function () { Find.open(); }; A['m-find'] = A['d-find']; A['f-close'] = Find.close;
  A['f-next'] = function () { step(1); }; A['f-prev'] = function () { step(-1); };
  A['f-opt'] = function (el) { var k = el.dataset.k; Find.opts[k] = !Find.opts[k]; var p = pane(); if (p) Array.prototype.forEach.call(p.querySelectorAll('.fd-o'), function (b) { b.classList.toggle('on', !!Find.opts[b.dataset.k]); b.setAttribute('aria-pressed', !!Find.opts[b.dataset.k]); }); search(($('fdQ') || {}).value || Find.q); };
  function repl(i) { var to = ($('fdR') || {}).value || '', m = Find.meta[i]; return Find.opts.r && m ? to.replace(/\$(\d|&)/g, function (x, d) { return d === '&' ? m[0] : (m[+d] || ''); }) : to; }
  function put(r, text) {
    var b = (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer).closest('.b.ed'); if (!b) return false;
    r.deleteContents(); if (text) r.insertNode(document.createTextNode(text)); b.dataset.m = '1'; return true;
  }
  A['f-rep'] = function () {
    var r = Find.hits[Find.at]; if (!r) return;
    var keep = Find.at; if (put(r, repl(keep))) { Doc.snap(); search(Find.q); Find.at = Math.min(keep, Find.hits.length - 1); paint(); goto(); }
  };
  A['f-all'] = function () {
    var n = 0; for (var i = Find.hits.length - 1; i >= 0; i--) if (put(Find.hits[i], repl(i))) n++;
    Doc.snap(); search(Find.q); Ui.toast(t('fd.done', { n: n }));
  };
  document.addEventListener('input', function (e) { if (e.target.id === 'fdQ') search(e.target.value); });
  document.addEventListener('keydown', function (e) {
    if (!Find.active || !e.target.closest || !e.target.closest('#fdPane, .fd-r')) return;
    if (e.key === 'Enter') { e.preventDefault(); if (e.target.id === 'fdR') A['f-rep'](); else step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); Find.close(); Surface.focus(); }
  }, true);
  // Ctrl+F and Ctrl+H
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !Doc.rec || App.state.page !== 'doc') return; var k = e.key.toLowerCase();
    if (k === 'f') { e.preventDefault(); Find.open(); } else if (k === 'h' && Doc.mode === 'edit') { e.preventDefault(); Find.open(true); }
  });
})();
