// FilmPc — the column of small slides on a computer: a click goes to the slide, Shift + click picks a run, Ctrl + click adds one, a drag carries the picked slides to a new place (a line shows where), a right click opens the menu of the slide.
(function () {
  'use strict';
  var $ = Ui.$, A = App.acts, F = window.FilmPc = {}, drag = null, last = 0;

  function slideAt(el) { var b = el && el.closest && el.closest('.th[data-i]'); return b ? +b.dataset.i : -1; }
  function paint() { Array.prototype.forEach.call($('film').querySelectorAll('.th[data-i]'), function (b) { b.classList.toggle('sel', Slides.sel.indexOf(+b.dataset.i) >= 0 && Slides.sel.length > 1); }); }
  F.paint = paint;

  // ---- a new order: the picked slides land before slide `to` (0..n); the engine moves one slide at a time ---------------------------------------
  function order(ps, to) {
    var n = Deck.count(), rest = [], i; for (i = 0; i < n; i++) if (ps.indexOf(i) < 0) rest.push(i);
    var at = 0; for (i = 0; i < to; i++) if (ps.indexOf(i) < 0) at++;
    return rest.slice(0, at).concat(ps, rest.slice(at));
  }
  Slides.moveBy = function (ps, d) { var to = d < 0 ? ps[0] - 1 : ps[ps.length - 1] + 2; F.move(ps, to); };
  F.move = function (ps, to) {
    var want = order(ps, to), cur = []; for (var i = 0; i < Deck.count(); i++) cur.push(i); var ops = [];
    want.forEach(function (s, t) { if (cur[t] === s) return; var from = cur.indexOf(s); ops.push(Deck.op('moveSlide', null, { to: t }, from)); cur.splice(from, 1); cur.splice(t, 0, s); });
    if (!ops.length) return; var first = want.indexOf(ps[0]);
    Slides.sel = want.map(function (s, t) { return ps.indexOf(s) >= 0 ? t : -1; }).filter(function (t) { return t >= 0; });
    Viewer.run(ops, 'busy.slides', { rebuild: true, go: first }).then(paint);
  };

  // ---- pointer ----------------------------------------------------------------------------------------------------------------------------------
  function down(e) {
    if (!Wide.pc || e.pointerType !== 'mouse' || e.button !== 0) return; var i = slideAt(e.target); if (i < 0) return;
    var add = e.ctrlKey || e.metaKey, rng = e.shiftKey; e.preventDefault(); e.stopPropagation();
    if (rng) { var a = Math.min(last, i), b = Math.max(last, i); Slides.sel = []; for (var k = a; k <= b; k++) Slides.sel.push(k); }
    else if (add) { var at = Slides.sel.indexOf(i); if (at >= 0) Slides.sel.splice(at, 1); else Slides.sel.push(i); last = i; }
    else if (Slides.sel.indexOf(i) < 0 || Slides.sel.length < 2) { Slides.sel = [i]; last = i; }
    if (!rng && !add || Slides.sel.indexOf(i) >= 0) { if (i !== Deck.cur) Slides.go(i); }
    paint(); if (rng || add) return;
    drag = { i: i, x: e.clientX, y: e.clientY, on: false, to: -1, ps: Slides.sel.slice().sort(function (p, q) { return p - q; }) };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function drop(y) {
    var bs = Array.prototype.slice.call($('film').querySelectorAll('.th[data-i]')), to = bs.length;
    for (var k = 0; k < bs.length; k++) { var r = bs[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { to = k; break; } }
    return to;
  }
  function move(e) {
    var d = drag; if (!d) return;
    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return; d.on = true; $('film').classList.add('dnd'); }
    d.to = drop(e.clientY); var line = $('filmDrop'); if (!line) { line = document.createElement('i'); line.id = 'filmDrop'; line.className = 'th-drop'; $('film').appendChild(line); }
    var bs = $('film').querySelectorAll('.th[data-i]'), host = $('film').getBoundingClientRect(), ref = bs[Math.min(d.to, bs.length - 1)].getBoundingClientRect(), y = (d.to >= bs.length ? ref.bottom + 5 : ref.top - 5) - host.top + $('film').scrollTop;
    line.style.top = y + 'px';
  }
  function up() {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); var d = drag; drag = null; $('film').classList.remove('dnd'); var line = $('filmDrop'); if (line) line.remove();
    if (d && d.on && d.to >= 0 && !(d.to >= d.ps[0] && d.to <= d.ps[d.ps.length - 1] + 1)) F.move(d.ps, d.to);
  }
  F.init = function () {
    var f = $('film'); f.addEventListener('pointerdown', down, true);
    f.addEventListener('contextmenu', function (e) { if (!Wide.pc) return; var i = slideAt(e.target); if (i < 0) return; e.preventDefault(); if (Slides.sel.indexOf(i) < 0) { Slides.sel = [i]; Slides.go(i); paint(); } Ctx.film(e.clientX, e.clientY, i); });
    f.addEventListener('click', function (e) { if (Wide.pc && slideAt(e.target) >= 0) e.stopPropagation(); }, true);
  };
})();
