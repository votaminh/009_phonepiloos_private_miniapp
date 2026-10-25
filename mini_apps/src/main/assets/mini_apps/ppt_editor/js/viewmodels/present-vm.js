// Present — the slide show on the phone: slides drawn at the size of the screen, the transition of each slide, tap sides to go, a laser pointer, the notes, a clock. Hidden slides are skipped.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var P = window.Present = { isOpen: false, list: [], at: 0, laser: false, front: 'prA', t0: 0, clock: 0, auto: 0, hideT: 0, busy: false };
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  function fit() { var w = window.innerWidth, h = window.innerHeight, r = Deck.ratio(); return w * r <= h ? { w: w, h: Math.round(w * r) } : { w: Math.round(h / r), h: h }; }
  // the slide on a canvas; boxes that enter by an animation are left out until their click. Returns what the animations need
  async function paint(cv, i, keep) {
    var f = fit(), dpr = Math.min(2, window.devicePixelRatio || 1), tree = await PptSvc.render(i, f.w), st = keep && PresentAnim.cur ? PresentAnim.cur : await PresentAnim.prepare(i, tree);
    cv.width = Math.round(f.w * dpr); cv.height = Math.round(f.h * dpr); cv.style.width = f.w + 'px'; cv.style.height = f.h + 'px'; var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); SlideDraw.draw(c, tree, st.hidden);
    return { st: st, f: f };
  }
  P.open = async function (from) {
    if (P.isOpen) return; Ui.closeSheet();
    P.list = []; Deck.info.slides.forEach(function (s, i) { if (!s.hidden) P.list.push(i); }); if (!P.list.length) return Ui.toast(t('pr.none'));
    P.at = Math.max(0, P.list.indexOf(from == null ? Deck.cur : from)); if (P.at < 0) P.at = 0;
    var el = $('presPanel'); el.innerHTML = PresentView.shell(); el.classList.remove('hidden'); P.isOpen = true; P.laser = false; P.front = 'prA'; P.t0 = Date.now();
    document.documentElement.classList.add('presenting'); requestAnimationFrame(function () { el.classList.add('on'); });
    P.clock = setInterval(tick, 1000); tick(); await show(0); wake();
  };
  P.close = function () {
    if (!P.isOpen) return false; P.isOpen = false; clearInterval(P.clock); clearTimeout(P.auto); clearTimeout(P.hideT); PresentAnim.reset(); document.documentElement.classList.remove('presenting');
    var el = $('presPanel'); el.classList.remove('on'); setTimeout(function () { if (!P.isOpen) { el.classList.add('hidden'); el.innerHTML = ''; } }, 220);
    Slides.go(P.list[P.at] != null ? P.list[P.at] : Deck.cur); return true;
  };
  function tick() { var s = Math.floor((Date.now() - P.t0) / 1000), m = Math.floor(s / 60); var e = $('prClock'); if (e) e.textContent = Ui.pad(m) + ':' + Ui.pad(s % 60); }
  function wake() { var el = $('presPanel'); el.classList.remove('quiet'); clearTimeout(P.hideT); P.hideT = setTimeout(function () { if (P.isOpen && !P.laser) el.classList.add('quiet'); }, 3200); }

  // dir 0: first draw, 1: forward, -1: back; the new slide is drawn on the hidden canvas, then the transition shows it
  async function show(dir) {
    if (P.busy) return; P.busy = true;
    var i = P.list[P.at], s = Deck.info.slides[i], back = $(P.front === 'prA' ? 'prB' : 'prA'), front = $(P.front);
    var made; PresentAnim.reset(); try { made = await paint(back, i); } catch (e) { P.busy = false; return; }
    $('prEnd').classList.add('hidden'); $('prN').textContent = (P.at + 1) + ' / ' + P.list.length; $('prBar').style.width = ((P.at + 1) / P.list.length * 100) + '%';
    PptSvc.notes(i).then(function (x) { var n = $('prNoteText'); if (n) { n.textContent = x || t('pr.nonotes'); $('prNotes').classList.toggle('empty', !x); } }).catch(function () {});
    var kind = dir === 0 || (calm && calm.matches) ? 'none' : (s.transition || 'none');
    back.className = 'pr-cv'; front.className = 'pr-cv'; back.style.zIndex = 2; front.style.zIndex = 1; back.style.display = 'block';
    var done = function () { front.style.display = 'none'; back.style.zIndex = 1; P.front = back.id; P.busy = false; PresentAnim.bind(made.st, back, made.f); };
    var A1 = anim(kind, back, front, dir || 1); if (A1) A1.finished.then(done, done); else done();
    clearTimeout(P.auto); if (s.advance && P.at < P.list.length - 1) P.auto = setTimeout(function () { if (P.isOpen) next(); }, s.advance);
  }
  // the transitions of the file, drawn with the browser's own animation
  function anim(kind, inc, out, dir) {
    var o = { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }, w = window.innerWidth;
    if (kind === 'fade' || kind === 'dissolve' || kind === 'morph' || kind === 'random') return inc.animate([{ opacity: 0 }, { opacity: 1 }], o);
    if (kind === 'push') { out.animate([{ transform: 'none' }, { transform: 'translateX(' + (-dir * w) + 'px)' }], o); return inc.animate([{ transform: 'translateX(' + (dir * w) + 'px)' }, { transform: 'none' }], o); }
    if (kind === 'cover') return inc.animate([{ transform: 'translateX(' + (dir * w) + 'px)' }, { transform: 'none' }], o);
    if (kind === 'zoom') return inc.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], o);
    if (kind === 'wipe' || kind === 'pull') return inc.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], o);
    if (kind === 'split') return inc.animate([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], o);
    if (kind === 'circle') return inc.animate([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], o);
    return null;
  }
  function next() { if (!P.busy && PresentAnim.click()) { wake(); return; } if (P.at >= P.list.length - 1) { clearTimeout(P.auto); $('prEnd').classList.remove('hidden'); wake(); return; } P.at++; show(1); wake(); }
  function prev() { if (P.at <= 0) return; $('prEnd').classList.add('hidden'); P.at--; show(-1); wake(); }
  A['p-open'] = function () { P.open(Deck.cur); };
  A['p-close'] = function () { P.close(); };
  A['p-next'] = next; A['p-prev'] = prev;
  A['p-notes'] = function () { $('prNotes').classList.toggle('open'); wake(); };
  A['p-laser'] = function () { P.laser = !P.laser; $('prLaserBtn').classList.toggle('on', P.laser); if (!P.laser) $('prLaser').classList.add('hidden'); wake(); };

  // a tap on the right goes on, on the left goes back; with the laser on a finger drags the red dot
  document.addEventListener('click', function (e) {
    if (!P.isOpen || e.target.closest('button')) return; var x = e.clientX / window.innerWidth;
    if ($('presPanel').classList.contains('quiet')) { wake(); return; }
    if (P.laser) return; if (x < 0.3) prev(); else next();
  });
  function dot(e) { if (!P.isOpen || !P.laser) return; var l = $('prLaser'), r = $('prStage').getBoundingClientRect(); l.style.left = (e.clientX - r.left) + 'px'; l.style.top = (e.clientY - r.top) + 'px'; l.classList.remove('hidden'); }
  document.addEventListener('pointerdown', function (e) { if (P.isOpen && P.laser && !e.target.closest('button')) dot(e); });
  document.addEventListener('pointermove', function (e) { if (P.isOpen && P.laser && e.buttons) dot(e); });
  document.addEventListener('pointerup', function () { if (P.laser) { var l = $('prLaser'); if (l) setTimeout(function () { l.classList.add('hidden'); }, 700); } });
  window.addEventListener('resize', function () { if (P.isOpen && !P.busy) { var i = P.list[P.at], c = $(P.front); paint(c, i, true).catch(function () {}); } });
})();
