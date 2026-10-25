// PresX — what a computer adds to the slide show: a bar of tools (back, on, pen, highlighter, eraser, laser, colour, clear, black screen, notes, full screen, leave), ink drawn on the slide, the keys (arrows, Space, B, W,
// a number and Enter to jump, Esc), and the full screen. Ink stays on its slide while the show runs and goes away with it. A touch screen keeps the big buttons.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, P = window.Present, X = window.PresX = { tool: '', ink: {}, col: '', num: '', screen: '', cv: null };
  var COLS = ['sw_red', 'sw_orange', 'fl_yellow', 'sw_green', 'sw_blue', 'sw_purple', 'sw_white', 'sw_black'];

  function b(k, icon, label, extra) { return '<button type="button" class="pr-t' + (extra || '') + '" data-px="' + k + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + icon + '</button>'; }
  X.markup = function () {
    if (!Wide.pc) return ''; X.col = X.col || C('sw_red');
    return '<canvas class="pr-ink" id="prInk" aria-hidden="true"></canvas><div class="pr-scr off" id="prScr"></div>'
      + '<div class="pr-tools" id="prTools">' + b('prev', ic('back', 20, 2.2), t('pr.prev')) + '<span class="pr-pg" id="prPg"></span>' + b('next', ic('chev', 20, 2.2), t('pr.next')) + '<i class="pr-sp"></i>'
      + b('pen', ic('edit', 18, 2), t('px.pen'), '') + b('hl', ic('brush', 18, 2), t('px.hl')) + b('erase', ic('close', 18, 2), t('px.erase')) + b('laser', ic('laser', 18, 2), t('pr.laser'))
      + '<button type="button" class="pr-t col" data-px="color" title="' + esc(t('q.color')) + '" aria-label="' + esc(t('q.color')) + '"><i id="prCol" style="background:' + X.col + '"></i></button>' + b('clear', ic('trash', 18, 2), t('px.clear')) + '<i class="pr-sp"></i>'
      + b('black', ic('moon', 18, 2), t('px.black')) + b('notes', ic('notes', 18, 2), t('pr.notes')) + b('full', ic('width', 18, 2), t('dk.fullscreen')) + b('exit', ic('close', 18, 2.2), t('pr.exit'), ' exit') + '</div>';
  };

  // ---- ink -----------------------------------------------------------------------------------------------------------------------------------------
  function slide() { return P.list[P.at]; }
  function sync() {
    var cv = $('prInk'); if (!cv) return; var f = P.fit(), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(f.w * dpr); cv.height = Math.round(f.h * dpr); cv.style.width = f.w + 'px'; cv.style.height = f.h + 'px'; X.cv = cv; draw();
  }
  function draw() {
    var cv = X.cv; if (!cv) return; var c = cv.getContext('2d'), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h); c.lineCap = 'round'; c.lineJoin = 'round';
    (X.ink[slide()] || []).forEach(function (s) {
      c.globalAlpha = s.hl ? 0.38 : 1; c.strokeStyle = s.c; c.lineWidth = (s.hl ? 0.026 : 0.0065) * w; c.beginPath();
      s.p.forEach(function (p, i) { if (i) c.lineTo(p[0] * w, p[1] * h); else c.moveTo(p[0] * w, p[1] * h); }); if (s.p.length === 1) c.lineTo(s.p[0][0] * w + 0.1, s.p[0][1] * h); c.stroke();
    }); c.globalAlpha = 1;
  }
  function pt(e) { var r = X.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
  var cur = null;
  function down(e) {
    if (!P.isOpen || !X.tool || X.tool === 'laser' || !X.cv || e.button > 0 || e.target.closest('.pr-tools,.pr-notes,.pr-top')) return;
    e.preventDefault(); var p = pt(e); if (X.tool === 'erase') { cur = { erase: true }; erase(p); return; }
    cur = { c: X.col, hl: X.tool === 'hl', p: [p] }; (X.ink[slide()] = X.ink[slide()] || []).push(cur); draw();
  }
  function erase(p) {
    var list = X.ink[slide()] || [], keep = list.filter(function (s) { return !s.p.some(function (q) { return Math.hypot((q[0] - p[0]) * X.cv.width, (q[1] - p[1]) * X.cv.height) < 22; }); });
    if (keep.length !== list.length) { X.ink[slide()] = keep; draw(); }
  }
  function move(e) { if (!cur) return; var p = pt(e); if (cur.erase) erase(p); else { cur.p.push(p); draw(); } }
  function up() { cur = null; }

  // ---- the tools and the keys ------------------------------------------------------------------------------------------------------------------------
  function mark() {
    ['pen', 'hl', 'erase', 'laser'].forEach(function (k) { var el = document.querySelector('[data-px="' + k + '"]'); if (el) el.classList.toggle('on', X.tool === k); });
    var pg = $('prPg'); if (pg) pg.textContent = (P.at + 1) + ' / ' + P.list.length; var s = $('presPanel'); if (s) s.classList.toggle('inking', !!X.tool && X.tool !== 'laser');
  }
  function use(k) { X.tool = X.tool === k ? '' : k; P.laser = X.tool === 'laser'; var lb = $('prLaserBtn'); if (lb) lb.classList.toggle('on', P.laser); if (!P.laser) $('prLaser').classList.add('hidden'); mark(); P.wake(); }
  function screen(k) { var el = $('prScr'); X.screen = X.screen === k ? '' : k; el.className = 'pr-scr ' + (X.screen || 'off'); }
  function fullscreen() { var d = document, el = $('presPanel'); if (d.fullscreenElement) d.exitFullscreen(); else if (el && el.requestFullscreen) el.requestFullscreen().catch(function () {}); }
  var DO = {
    prev: function () { P.prev(); }, next: function () { P.next(); }, pen: function () { use('pen'); }, hl: function () { use('hl'); }, erase: function () { use('erase'); }, laser: function () { use('laser'); },
    color: function (el) {
      var r = el.getBoundingClientRect(), items = COLS.map(function (n) { var c = C(n); return { t: t('c.' + n), on: c === X.col, go: function () { X.col = c; $('prCol').style.background = c; if (X.tool !== 'pen' && X.tool !== 'hl') use('pen'); } }; });
      PopMenu.show(r.left, Math.max(8, r.top - items.length * 34 - 16), items, { from: el });
    },
    clear: function () { X.ink[slide()] = []; draw(); }, black: function () { screen('black'); }, notes: function () { $('prNotes').classList.toggle('open'); }, full: fullscreen, exit: function () { P.close(); }
  };
  function onKey(e) {
    if (!P.isOpen || !Wide.pc || e.ctrlKey && !e.shiftKey && e.key.toLowerCase() !== 'p' || e.metaKey) return; var k = e.key, low = k.toLowerCase(), did = true;
    if (X.screen && k !== 'Escape') { if (low === 'b' || low === 'w' || k === ' ' || k === 'Enter' || /Arrow/.test(k)) screen(X.screen); else did = false; if (did) e.preventDefault(); return; }
    if (k === 'Escape') { if (X.screen) screen(X.screen); else if (X.tool) use(X.tool); else P.close(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || low === 'n' || (k === 'Enter' && !X.num)) P.next();
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace' && !X.num || low === 'p' && !e.ctrlKey) P.prev();
    else if (k === 'Home') P.goto(0); else if (k === 'End') P.goto(P.list.length - 1);
    else if (low === 'b') screen('black'); else if (low === 'w') screen('white'); else if (low === 'l') use('laser'); else if (low === 'f') fullscreen();
    else if (e.ctrlKey && low === 'p') use('pen'); else if (low === 'h' && e.ctrlKey) use('hl'); else if (low === 'e') use('erase');
    else if (/^\d$/.test(k)) { X.num += k; num(); }
    else if (k === 'Enter' && X.num) { P.goto(Math.min(P.list.length, Math.max(1, +X.num)) - 1); X.num = ''; num(); }
    else if (k === 'Backspace' && X.num) { X.num = X.num.slice(0, -1); num(); }
    else did = false;
    if (did) { e.preventDefault(); e.stopPropagation(); }
  }
  // the number being typed shows in the corner until Enter
  function num() { var pg = $('prPg'); if (pg) pg.textContent = X.num ? '→ ' + X.num : (P.at + 1) + ' / ' + P.list.length; }

  X.changed = function () { sync(); mark(); num(); };

  // ---- hooks ------------------------------------------------------------------------------------------------------------------------------------------
  X.init = function () {
    document.addEventListener('keydown', onKey, true); document.addEventListener('pointerdown', down, true); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    document.addEventListener('click', function (e) { var bt = e.target.closest && e.target.closest('[data-px]'); if (bt && DO[bt.dataset.px]) { e.stopPropagation(); DO[bt.dataset.px](bt); } }, true);
    document.addEventListener('fullscreenchange', function () { if (P.isOpen && P.fs && !document.fullscreenElement) { P.fs = false; P.close(); } });
    var open = P.open; P.open = async function (from) {
      if (P.isOpen) return; X.ink = {}; X.tool = ''; X.screen = ''; X.num = ''; await open.call(P, from); sync(); mark();
      if (Wide.pc && $('presPanel').requestFullscreen) $('presPanel').requestFullscreen().then(function () { P.fs = true; }).catch(function () { /* the show runs in the window */ });
    };
    var close = P.close; P.close = function () { var was = P.isOpen; X.tool = ''; if (document.fullscreenElement) { P.fs = false; document.exitFullscreen().catch(function () {}); } return was ? close.call(P) : false; };
    window.addEventListener('resize', function () { if (P.isOpen) setTimeout(sync, 150); });
  };
})();
