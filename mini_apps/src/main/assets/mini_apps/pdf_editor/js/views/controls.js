// Controls — Ui.slider: a drawn range slider (no system control). Put an empty element with class "sld" in the page, then
//   var s = Ui.slider(el, { min: 0, max: 30, step: .1, value: 7, onInput: function (v) {...} });   s.set(v) moves it without calling onInput.
(function () {
  'use strict';
  Ui.slider = function (el, o) {
    el.innerHTML = '<span class="sf"></span><span class="sk" tabindex="0" role="slider"></span>'; var f = el.firstChild, k = el.lastChild, val = o.value;
    function paint(v) { var p = (v - o.min) / (o.max - o.min) * 100; f.style.width = p + '%'; k.style.left = p + '%'; k.setAttribute('aria-valuenow', v); k.setAttribute('aria-valuemin', o.min); k.setAttribute('aria-valuemax', o.max); }
    function at(e) { var r = el.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), v = o.min + p * (o.max - o.min); v = Math.round(v / o.step) * o.step; return Math.max(o.min, Math.min(o.max, +v.toFixed(6))); }
    function move(e) { var v = at(e); if (v !== val) { val = v; paint(v); if (o.onInput) o.onInput(v); } }
    el.addEventListener('pointerdown', function (e) { el.setPointerCapture(e.pointerId); el.classList.add('drag'); move(e); });
    el.addEventListener('pointermove', function (e) { if (el.classList.contains('drag')) move(e); });
    el.addEventListener('pointerup', function () { el.classList.remove('drag'); }); el.addEventListener('pointercancel', function () { el.classList.remove('drag'); });
    k.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { val = Math.max(o.min, Math.min(o.max, +(val + d * o.step).toFixed(6))); paint(val); if (o.onInput) o.onInput(val); } });
    paint(val); return { set: function (v) { val = Math.max(o.min, Math.min(o.max, v)); paint(val); } };
  };
})();
