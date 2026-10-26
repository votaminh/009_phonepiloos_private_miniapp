// Equation — Insert ▸ Equation: a formula written as LaTeX (with a live picture of it) becomes a real Word formula (OMML); double-click a formula of the file to change it.
// The engine turns the LaTeX into OMML and MathML (DocSvc.math); the block on the page is drawn from the MathML, the file keeps the OMML.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, E = window.Equation = {}, editing = null, tm = 0, seq = 0;
  var SNIP = [['a/b', '\\frac{a}{b}'], ['\u221ax', '\\sqrt{x}'], ['x\u00b2', 'x^{2}'], ['x\u1d62', 'x_{i}'], ['\u03a3', '\\sum_{i=1}^{n} x_i'], ['\u222b', '\\int_{a}^{b} f(x)\\,dx'], ['\u03b1', '\\alpha'], ['\u03c0', '\\pi'], ['\u2264', '\\leq'], ['\u221e', '\\infty'], ['\u00b1', '\\pm'], ['lim', '\\lim_{x \\to 0}']];
  function align() { var o = $('eqAl') && $('eqAl').querySelector('.on'); return o ? o.dataset.v : 'center'; }
  function show(m, err) { var p = $('eqPrev'); if (!p) return; p.classList.toggle('bad', !!err); p.innerHTML = err ? esc(err) : Render.math(m); }
  function preview() {
    clearTimeout(tm); var v = ($('eqTx').value || '').trim(); if (!v) { show('', ''); return; } var mine = ++seq;
    tm = setTimeout(function () { DocSvc.math(v, align()).then(function (r) { if (mine === seq) show(r.mathml, ''); }).catch(function (e) { if (mine === seq) show('', t('eq.err') + ' ' + String(e.message || '').slice(0, 80)); }); }, 180);
  }
  function open(latex, al, block) {
    editing = block || null;
    Ui.sheet('eq', '<h2 class="sh-h">' + esc(t('eq.title')) + '</h2>'
      + '<div class="eq-sn">' + SNIP.map(function (s, i) { return '<button type="button" class="chip" data-act="eq-snip" data-i="' + i + '">' + esc(s[0]) + '</button>'; }).join('') + '</div>'
      + '<div class="pa-f hf-f"><textarea id="eqTx" rows="3" spellcheck="false" autocomplete="off" placeholder="' + esc(t('eq.hint')) + '">' + esc(latex || '') + '</textarea></div>'
      + '<div id="eqPrev" class="eq-prev"></div>'
      + '<div class="pa-f"><span>' + esc(t('eq.align')) + '</span><span class="pa-seg" id="eqAl">' + [['left', t('p.left')], ['center', t('p.center')], ['right', t('p.right')]].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === (al || 'center') ? 'on' : '') + '">' + esc(String(x[1]).replace(/^Align /, '').replace(/^Căn /, '')) + '</button>'; }).join('') + '</span></div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="eq-go">' + esc(t('a.apply')) + '</button></div>');
    setTimeout(function () { var i = $('eqTx'); if (i) { i.focus(); preview(); } }, 300);
  }
  A['i-eq'] = function () { if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); open('', 'center', null); };
  A['eq-snip'] = function (el) { var i = $('eqTx'), s = SNIP[+el.dataset.i][1], a = i.selectionStart == null ? i.value.length : i.selectionStart; i.value = i.value.slice(0, a) + s + i.value.slice(i.selectionEnd == null ? a : i.selectionEnd); i.focus(); var p = a + s.length; i.setSelectionRange(p, p); preview(); };
  A['eq-go'] = async function () {
    var v = ($('eqTx').value || '').trim(), al = align(); if (!v) return Ui.toast(t('eq.empty'));
    try {
      var r = await DocSvc.math(v, al), el = Insert.block('eq al-' + al, Render.math(r.mathml), r.xml); el.dataset.latex = v; Ui.closeSheet();
      if (editing && editing.isConnected) { editing.replaceWith(el); Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); } else Insert.place(el);
      editing = null;
    } catch (e) { Ui.toast(t('eq.err') + ' ' + String(e.message || '').slice(0, 80)); }
  };
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'eqTx') preview(); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#eqAl button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); preview(); });
  // a formula of the file (or one made here): double-click to change it
  document.addEventListener('dblclick', function (e) {
    var b = Doc.mode === 'edit' && e.target.closest && e.target.closest('#paper .b.eq'); if (!b) return;
    if (!b.dataset.latex) return Ui.toast(t('eq.nolatex'));
    open(b.dataset.latex, /al-(left|right)/.test(b.className) ? RegExp.$1 : 'center', b);
  });
})();
