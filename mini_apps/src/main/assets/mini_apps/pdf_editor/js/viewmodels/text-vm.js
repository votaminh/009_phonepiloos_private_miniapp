// Text — edit mode: the text boxes shown on every visible page, tapping one, and what the bar over it does (edit, style, move, delete); adding new text.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, seq = 0;
  var T = window.Text = { sel: null, d: null, moving: false };
  var FACES = { arial: 'PdfArimo', times: 'PdfTinos', courier: 'PdfCousine' };
  function rgb(h) { h = String(h || '').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  // ---- the boxes ---------------------------------------------------------------------------------------------------------------
  Read.layers.push(function (ov, i) {
    if (Read.mode !== 'text') return;
    var tok = ov._tok = ++seq, g = Doc.gen;
    Doc.paras(i).then(function (bl) {
      if (ov._tok !== tok || g !== Doc.gen || Read.mode !== 'text') return;
      ov.insertAdjacentHTML('beforeend', bl.map(function (b) {
        var x = Read.box(i, b.rect);
        return '<i class="blk' + (T.sel && T.sel.id === b.id ? ' sel' : '') + '" data-id="' + Ui.esc(b.id) + '" style="left:' + x.l + 'px;top:' + x.t + 'px;width:' + x.w + 'px;height:' + x.h + 'px"></i>';
      }).join(''));
    }).catch(function () {});
  });
  T.selEl = function () { if (!T.sel) return null; var pg = Read.pg(T.sel.page); return pg && pg.querySelector('.blk[data-id="' + T.sel.id + '"]'); };
  T.clear = function () {
    if (T.moving) T.endMove(false);
    T.sel = null; var f = $('rdFloat'); if (f) f.classList.remove('on');
    Array.prototype.forEach.call(document.querySelectorAll('.blk.sel'), function (e) { e.classList.remove('sel'); });
  };
  T.tap = function (ev, p) {
    if (T.moving) return;
    var b = ev.target.closest('.blk'); if (!b) { T.clear(); return; }
    if (T.sel && T.sel.id === b.dataset.id) { Motion.bounce(p.el, Read.box(p.i, T.sel.blk.rect)); return; }
    T.clear();
    Doc.paras(p.i).then(function (bl) {
      var blk = bl.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!blk) return;
      T.sel = { page: p.i, id: blk.id, blk: blk }; b.classList.add('sel');
      Motion.bounce(p.el, Read.box(p.i, blk.rect));
      var f = $('rdFloat'); f.innerHTML = ReadView.floatBar(); f.classList.remove('on'); Read.floatAt();
    });
  };

  // ---- the text sheet ------------------------------------------------------------------------------------------------------------
  function open(focus) { Ui.sheet('text', SheetsView.text(T.d)); if (focus) setTimeout(function () { var i = $('txIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 380); }
  A['t-edit'] = function () { if (!T.sel) return; var b = T.sel.blk; T.d = { mode: 'edit', text: b.text, fs: b.fs, fs0: b.fs, color: null, font: null, b: null, i: null, text0: b.text }; open(true); };
  A['t-style'] = function () { if (!T.sel) return; var b = T.sel.blk; T.d = { mode: 'edit', text: b.text, fs: b.fs, fs0: b.fs, color: null, font: null, b: null, i: null, text0: b.text }; open(false); };
  T.addAt = function (ev, p) {
    var l = Read.local(p.el, ev), pt = [l.x, l.y];
    T.d = { mode: 'add', page: p.i, at: pt, text: '', fs: 12, fs0: 12, color: null, font: 'arial', b: null, i: null }; open(true);
  };
  A['tx-size'] = function (el) { var d = T.d; d.fs = Math.max(4, Math.min(96, Math.round((d.fs + (el.dataset.v === '+' ? 0.5 : -0.5)) * 2) / 2)); $('txSz').textContent = String(d.fs); };
  A['tx-b'] = function (el) { T.d.b = !T.d.b; el.classList.toggle('on', T.d.b); el.setAttribute('aria-pressed', String(T.d.b)); };
  A['tx-i'] = function (el) { T.d.i = !T.d.i; el.classList.toggle('on', T.d.i); el.setAttribute('aria-pressed', String(T.d.i)); };
  A['tx-color'] = function (el) { T.d.color = el.dataset.v; Array.prototype.forEach.call(document.querySelectorAll('#sheet .sx-sw'), function (b) { b.classList.toggle('on', b === el); }); };
  A['tx-font'] = function (el) { T.d.font = el.dataset.k === 'orig' ? null : el.dataset.k; Array.prototype.forEach.call(document.querySelectorAll('#sheet [data-act="tx-font"]'), function (b) { b.classList.toggle('on', b === el); }); };

  A['tx-apply'] = async function () {
    var d = T.d, txt = $('txIn').value; Ui.closeSheet(); if (!d) return;
    if (d.mode === 'add') {
      if (!txt.trim()) return;
      var r0 = await Viewer.run(function () { return PdfSvc.insert([{ pageIndex: d.page, origin: Read.pdf(d.page, d.at[0], d.at[1] + d.fs * 0.8 * Doc.scale(d.page)), rotate: Read.rot(d.page), text: txt, fontSize: d.fs, color: rgb(d.color || C('sw_black')), font: d.font || 'arial', bold: !!d.b, italic: !!d.i }]); });
      if (r0 && r0.skipped && r0.skipped.length) Ui.toast(t('tx.skipped')); return;
    }
    var s = T.sel; if (!s) return; var b = s.blk;
    var e = { pageIndex: s.page, rect: b.rect, oldText: b.text, newText: txt, fontSize: b.fs };
    if (d.fs !== d.fs0) e.newFontSize = d.fs;
    if (d.color) e.newColor = rgb(d.color);
    if (d.font) e.newFont = d.font;
    if (d.b !== null) e.newBold = !!d.b;
    if (d.i !== null) e.newItalic = !!d.i;
    if (txt.trim() === '') e.newText = '';
    else if (b.lines.length > 1) {
      // a paragraph is broken into lines again at its own width, in the same face the engine will draw with, and anchored at its first baseline
      var fam = FACES[d.font] || FACES.arial, style = ((d.i ? 'italic ' : '') + (d.b ? 'bold' : '')).trim(), size = d.fs, lead = b.lh * (size / b.fs), width = b.rect[2] - b.rect[0];
      try { await document.fonts.load((style + ' 100px ' + fam).trim()); } catch (x) { /* the canvas falls back to the system face */ }
      var lines = txt.split('\n').reduce(function (a, q) { return q.trim() ? a.concat(Wrap.wrap(q, width, size, fam, style)) : a; }, []);
      if (Wrap.overflows(b, lines.length, lead, size, await Doc.paras(s.page))) return Ui.toast(t('tx.overflow'));
      e.newText = lines.join('\n'); e.origin = [b.rect[0], b.first]; e.lineLeading = lead;
      if (b.align !== 'left') e.lineXOffsets = lines.map(function (l) { var slack = width - Wrap.measure(l, size, fam, style); return Math.max(0, b.align === 'center' ? slack / 2 : slack); });
    }
    if (txt === d.text0 && e.newFontSize === undefined && !d.color && !d.font && d.b === null && d.i === null) return;
    T.clear();
    var r = await Viewer.run(function () { return PdfSvc.edit([e]); });
    if (r && r.skipped && r.skipped.length) Ui.toast(t('tx.skipped'));
  };
  A['t-delete'] = function () {
    var s = T.sel; if (!s) return; var b = s.blk; T.clear();
    Viewer.run(function () { return PdfSvc.edit([{ pageIndex: s.page, rect: b.rect, oldText: b.text, newText: '', fontSize: b.fs }]); });
  };

  // ---- moving a box: the lifted copy and the frame follow the finger, the engine moves the text when it lets go ------------------------
  var mv = null;
  A['t-move'] = function () {
    var s = T.sel, el = T.selEl(); if (!s || !el) return;
    var pg = Read.pg(s.page), l = Motion.lift(pg, Read.box(s.page, s.blk.rect)); T.moving = true; el.classList.add('mv'); mv = { el: el, l: l, dx: 0, dy: 0, x: 0, y: 0, id: null };
    $('rdFloat').innerHTML = '<button type="button" data-act="t-move-no">' + Ui.esc(t('a.cancel')) + '</button><button type="button" class="fl-a" data-act="t-move-ok">' + Ui.esc(t('a.done')) + '</button>'; Read.floatAt();
    el.onpointerdown = function (e) { mv.id = e.pointerId; mv.x = e.clientX; mv.y = e.clientY; try { el.setPointerCapture(e.pointerId); } catch (x) { /* a finger that already lifted */ } e.preventDefault(); };
    el.onpointermove = function (e) {
      if (e.pointerId !== mv.id) return; mv.dx = e.clientX - mv.x; mv.dy = e.clientY - mv.y;
      var tr = 'translate(' + mv.dx + 'px,' + mv.dy + 'px)'; el.style.transform = tr; if (mv.l) mv.l.cv.style.transform = tr; Read.floatAt();
    };
    el.onpointerup = el.onpointercancel = function (e) { if (e.pointerId === mv.id) mv.id = null; };
  };
  T.endMove = function (apply) {
    if (!mv) return; var m = mv, s = T.sel; mv = null; T.moving = false;
    m.el.onpointerdown = m.el.onpointermove = m.el.onpointerup = m.el.onpointercancel = null; m.el.style.transform = ''; m.el.classList.remove('mv'); Motion.drop(m.l);
    var f = $('rdFloat'); f.innerHTML = ReadView.floatBar(); Read.floatAt();
    if (apply && s && (Math.abs(m.dx) > 1 || Math.abs(m.dy) > 1)) {
      var v = Read.vec(s.page, m.dx, m.dy), b = s.blk; T.clear();
      Viewer.run(function () { return PdfSvc.edit([{ pageIndex: s.page, rect: b.rect, oldText: b.text, newText: b.text, fontSize: b.fs, translate: v }]); });
    }
  };
  A['t-move-ok'] = function () { T.endMove(true); };
  A['t-move-no'] = function () { T.endMove(false); };
})();
