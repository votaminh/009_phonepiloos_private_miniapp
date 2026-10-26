// Tabs — tab stops the way Word keeps them. A tab character in the text is drawn as a box (span.tb) as wide as it takes to reach the next stop of the paragraph (left, centre or right stop, with a dotted, dashed or underscore leader), or the next half inch when no stop is left.
// The stops of a paragraph are its direct setting (data-fmt.tabs) or the ones the file has; positions are in twips from the left margin. The boxes are only for the eye: the text inside stays one tab character.
(function () {
  'use strict';
  var T = window.Tabs = {}, GRID = 48;   // default stop every 0.5 in (px at 96 dpi)
  function stops(b) { var l = (window.Para ? Para.eff(b).tabs : null) || []; return l.filter(function (s) { return s && s.val !== 'clear' && s.val !== 'bar'; }).map(function (s) { return { x: s.pos / 15, val: s.val || 'left', ld: s.leader && s.leader !== 'none' ? s.leader : '' }; }).sort(function (a, b) { return a.x - b.x; }); }
  function unwrap(b) {
    Array.prototype.forEach.call(b.querySelectorAll('span.tb'), function (sp) { var par = sp.parentNode; while (sp.firstChild) par.insertBefore(sp.firstChild, sp); par.removeChild(sp); });
    b.normalize();
  }
  function wrap(b) {
    var out = [], w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n, nodes = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf('\t') >= 0 && !(n.parentElement && n.parentElement.closest('.pgsp'))) nodes.push(n);
    nodes.forEach(function (n) {
      var parts = n.nodeValue.split('\t'), par = n.parentNode, ref = n.nextSibling; par.removeChild(n);
      parts.forEach(function (p, i) { if (i) { var sp = document.createElement('span'); sp.className = 'tb'; sp.textContent = '\t'; par.insertBefore(sp, ref); out.push(sp); } if (p) par.insertBefore(document.createTextNode(p), ref); });
    });
    return out;
  }
  // the width the text after a tab takes, up to the next tab or the end of the line
  function textAfter(sp, next) {
    var r = document.createRange(); r.setStartAfter(sp); if (next) r.setEndBefore(next); else r.setEndAfter(sp.closest('.b').lastChild); var rc = r.getBoundingClientRect(); return rc ? rc.width : 0;
  }
  // for a decimal stop: the width of the text after the tab up to the decimal mark (or all of it when there is none)
  function textBefore(sp, next) {
    var n = sp.nextSibling; if (!n || n.nodeType !== 3) return textAfter(sp, next); var m = /[.,]/.exec(n.nodeValue); if (!m) return textAfter(sp, next);
    var r = document.createRange(); r.setStartAfter(sp); r.setStart(n, 0); r.setEnd(n, m.index); return r.getBoundingClientRect().width;
  }
  T.layout = function (b) {
    if (!b || !b.classList || !b.classList.contains('ed')) return; var has = b.textContent.indexOf('\t') >= 0 || b.querySelector('span.tb'); if (!has) return;
    var p = Doc.paper(), z = p.style.zoom, sel = window.Surface && document.activeElement === p ? Surface.sel() : null; p.style.zoom = '';
    try {
      unwrap(b); var spans = wrap(b); if (!spans.length) return; var st = stops(b), origin = p.getBoundingClientRect().left + parseFloat(getComputedStyle(p).paddingLeft || 0), first = b.getBoundingClientRect().left;
      origin = b.getBoundingClientRect().left - (parseFloat(getComputedStyle(b).marginLeft) || 0);   // the left margin: where the stop positions count from
      spans.forEach(function (sp) { sp.style.width = '0px'; });
      spans.forEach(function (sp, i) {
        var x = sp.getBoundingClientRect().left - origin, next = null, k;
        for (k = 0; k < st.length; k++) if (st[k].x > x + 1) { next = st[k]; break; }
        var target, kind = 'left', ld = '';
        if (next) { target = next.x; kind = next.val; ld = next.ld; } else { target = (Math.floor((x + 1) / GRID) + 1) * GRID; }
        var w = target - x; if (kind === 'decimal') { var tw0 = textBefore(sp, spans[i + 1]); w = w - tw0; } else if (kind === 'right' || kind === 'center') { var tw = textAfter(sp, spans[i + 1]); w = kind === 'right' ? w - tw : w - tw / 2; }
        sp.style.width = Math.max(1, w) + 'px'; if (ld) sp.dataset.ld = ld; else sp.removeAttribute('data-ld');
      });
    } finally { p.style.zoom = z; if (sel) Surface.restore(sel); }
  };
  T.all = function () { Array.prototype.forEach.call(Doc.paper().querySelectorAll('.b.ed'), function (b) { if (b.textContent.indexOf('\t') >= 0) T.layout(b); }); };
  var raf = 0, dirty = null;
  document.addEventListener('input', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#paper > .b.ed'); if (!b || (b.textContent.indexOf('\t') < 0 && !b.querySelector('span.tb'))) return; dirty = b;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; var d = dirty; dirty = null; if (d && d.isConnected) T.layout(d); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(T.all);
  var render0 = Doc.render; Doc.render = async function () { var r = await render0.apply(this, arguments); T.all(); return r; };
  var apply0 = Read.apply; Read.apply = function () { apply0.apply(this, arguments); setTimeout(T.all, 50); };

  // ---- the Tabs dialog: every stop with its position (cm), alignment and leader -----------------------------------------------------------------------
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, draft = [];
  var AL = ['left', 'center', 'right', 'decimal'], LD = ['none', 'dot', 'hyphen', 'underscore'];
  function cm(tw) { return Math.round(tw / 567 * 100) / 100; }
  function seg(name, list, cur, key) { return '<span class="pa-seg tb-seg" data-n="' + name + '">' + list.map(function (x) { return '<button type="button" data-v="' + x + '" class="' + (x === cur ? 'on' : '') + '">' + esc(t(key + x)) + '</button>'; }).join('') + '</span>'; }
  function row(s, i) { return '<div class="tb-row" data-i="' + i + '"><input type="text" inputmode="decimal" class="tb-pos" value="' + cm(s.pos) + '" aria-label="cm"><em>cm</em>' + seg('al', AL, s.val || 'left', 'tb.a.') + seg('ld', LD, s.leader || 'none', 'tb.l.') + '<button type="button" class="rv-b" data-act="tb-del" data-i="' + i + '">' + esc(t('cm.delete')) + '</button></div>'; }
  function draw() {
    Ui.sheet('tabs', '<h2 class="sh-h">' + esc(t('tb.title')) + '</h2><div class="rv-list" id="tbList">' + (draft.length ? draft.map(row).join('') : '<p class="rv-none">' + esc(t('tb.none')) + '</p>') + '</div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="tb-add">' + esc(t('tb.add')) + '</button><button type="button" class="btn light" data-act="tb-clear">' + esc(t('tb.clear')) + '</button><button type="button" class="btn" data-act="tb-go">' + esc(t('a.apply')) + '</button></div>');
  }
  function read() { var rows = document.querySelectorAll('#tbList .tb-row'); return Array.prototype.map.call(rows, function (r) { var v = parseFloat(String(r.querySelector('.tb-pos').value).replace(',', '.')) || 0, al = r.querySelector('[data-n="al"] .on'), ld = r.querySelector('[data-n="ld"] .on'); return { pos: Math.max(0, Math.round(v * 567)), val: al ? al.dataset.v : 'left', leader: ld ? ld.dataset.v : 'none' }; }); }
  A['tb-open'] = function () { var c = window.Para && Para.read(); if (!c) return Ui.toast(t('e.tap')); draft = c.tabs.map(function (s) { return { pos: s.pos, val: s.val, leader: s.leader }; }); draw(); };
  A['tb-add'] = function () { draft = read(); var last = draft.length ? draft[draft.length - 1].pos : 0; draft.push({ pos: last + 1134, val: 'left', leader: 'none' }); draw(); };
  A['tb-del'] = function (el) { draft = read(); draft.splice(+el.dataset.i, 1); draw(); };
  A['tb-clear'] = function () { draft = []; draw(); };
  A['tb-go'] = function () { var l = read().filter(function (s) { return s.pos > 0; }).sort(function (a, b) { return a.pos - b.pos; }); Ui.closeSheet(); Para.set({ tabs: l }); };
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.tb-seg button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
})();
