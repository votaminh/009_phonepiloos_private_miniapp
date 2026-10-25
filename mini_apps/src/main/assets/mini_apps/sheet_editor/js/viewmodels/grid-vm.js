// Grid — the grid on screen: its sizes, scrolling, the selection and its handles, and editing a cell in the formula bar. The VList draws only the rows in view.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, RH = GridView.RH, hw = GridView.hw, DEFW = 88, MAXR = 1048576;
  var G = window.Grid = { z: 1, sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, list: null, geo: null, editing: false, tab: 'format', raw: '' };

  // ---- geometry ---------------------------------------------------------------------------------------------------------------
  // the zoom: sizes of the sheet are multiplied by Grid.z (the file keeps its own sizes); the CSS variables carry it to the headers and the font
  G.vars = function () { var w = $('gWrap'); w.style.setProperty('--gz', G.z); w.style.setProperty('--ghw', hw() + 'px'); w.style.setProperty('--gch', Math.round(28 * G.z) + 'px'); };
  G.layout = function () {
    G.vars();
    var sh = Wb.sh(), ext = Wb.extent(sh), rows = Math.max(ext.rows, sh.viewRows || 0), cols = ext.cols, g = { sh: sh, rows: rows, cols: cols, fx: sh.frozen.x, fy: sh.frozen.y, colX: [0], tops: [0] }, i;
    g.colW = function (c) { return sh.hidC[c] ? 0 : Math.round((sh.colW[c] || DEFW) * G.z); };
    g.rowH = function (r) { return sh.hidR[r] ? 0 : Math.round((sh.rowH[r] || RH) * G.z); };
    for (i = 0; i < cols; i++) g.colX.push(g.colX[i] + g.colW(i));
    for (i = 0; i < rows; i++) g.tops.push(g.tops[i] + g.rowH(i));
    g.width = hw() + g.colX[cols];
    sh.viewRows = rows; G.geo = g; return g;
  };
  function find(arr, v) { var lo = 0, hi = arr.length - 2; while (lo < hi) { var m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; }
  // the cell under a point of the grid (x from the left edge of the first column, y from the top of row 0)
  G.at = function (x, y) { var g = G.geo; return { r: find(g.tops, Math.max(0, y)), c: find(g.colX, Math.max(0, x)) }; };
  G.rect = function (r1, c1, r2, c2) { var g = G.geo; return { x: hw() + g.colX[c1], y: g.tops[r1], w: g.colX[c2 + 1] - g.colX[c1], h: g.tops[r2 + 1] - g.tops[r1] }; };

  // ---- drawing ----------------------------------------------------------------------------------------------------------------
  G.mount = function () {
    var g = G.layout(), sc = $('gScroll'), host = $('gHost');
    if (G.list) { G.list.destroy(); G.list = null; }
    host.innerHTML = ''; host.style.width = g.width + 'px'; $('gWrap').classList.toggle('nogrid', !!g.sh.noGrid);
    var fz = $('gFz'), fzH = g.tops[g.fy];
    fz.style.height = fzH ? fzH + 2 + 'px' : '0'; fz.style.display = fzH ? '' : 'none';
    G.list = VList.mount(sc, host, {
      count: function () { return g.rows - g.fy; },
      height: function (i) { return g.rowH(i + g.fy); },
      cls: function () { return 'gro'; },
      html: function (i) { return GridView.row(g, i + g.fy, G.sel); }
    });
    sc.scrollLeft = 0; Motion.reset(); G.paint();
  };
  // full: rebuild the letters and the frozen rows and redraw the rows in view (the contents changed); otherwise only what depends on the selection moves
  G.paint = function (light) {
    var g = G.geo, s = G.sel, fz = '', r;
    if (!light) {
      $('gColIn').innerHTML = GridView.colHead(g, s);
      for (r = 0; r < g.fy; r++) fz += '<div class="gfr" style="height:' + g.rowH(r) + 'px">' + GridView.row(g, r, s) + '</div>';
      $('gFzIn').innerHTML = fz; $('gFzIn').style.width = g.width + 'px'; $('gColIn').style.width = g.width + 'px';
      if (G.list) G.list.refresh();
      Xrich.place($('gHost'), g);
    }
    Motion.heads(s); G.place(); G.bar(); G.tools(); Clip.stats(); if (window.Desk) Desk.sync();
  };
  // selection frame (one element that glides), its handles and the quick bar
  G.place = function () {
    var g = G.geo, s = G.sel, m = s.r1 === s.r2 && s.c1 === s.c2 ? Wb.mergeAt(g.sh, s.r1, s.c1) : null, pop = G.pop; G.pop = false;
    var r1 = s.r1, c1 = s.c1, r2 = m ? m.r2 : s.r2, c2 = m ? m.c2 : s.c2, one = r1 === r2 && c1 === c2, hb = !G.editing;
    var inFz = r1 < g.fy, inMain = r2 >= g.fy, q;
    q = inFz ? G.rect(r1, c1, Math.min(r2, g.fy - 1), c2) : null;
    Motion.frame('fz', $('gFzIn'), q || { x: 0, y: 0, w: 0, h: 0 }, { show: inFz, one: one, tl: !one, br: hb && r2 < g.fy, pop: pop });
    q = inMain ? G.rect(Math.max(r1, g.fy), c1, r2, c2) : null; if (q) q.y -= g.tops[g.fy];
    Motion.frame('main', $('gHost'), q || { x: 0, y: 0, w: 0, h: 0 }, { show: inMain, one: one, tl: !one && r1 >= g.fy, br: hb, pop: pop });
    if (pop && one) { var row = document.querySelector('.gr[data-r="' + r1 + '"]'), cell = row && row.querySelector('.gc[data-c="' + c1 + '"]'); Motion.bounce(cell); }
    G.quick(); if (window.CellEdit && CellEdit.on) CellEdit.place(); if (window.Valid) Valid.paint(); if (window.Link) Link.paint(); if (window.Af) Af.paint();
  };
  G.quick = function () {
    var s = G.sel, g = G.geo, multi = s.r1 !== s.r2 || s.c1 !== s.c2;
    if (Wb.readOnly || G.editing || Motion.drag || !(multi || G.qk) || s.r2 < g.fy) return Motion.quick($('gHost'), null);
    var q = G.rect(Math.max(s.r1, g.fy), s.c1, s.r2, s.c2), y = q.y - g.tops[g.fy], top = y - 54;
    Motion.quick($('gHost'), { x: q.x, y: top < 0 ? y + q.h + 10 : top, html: GridView.quick(), label: t('q.label') });
  };
  // the formula bar is kept and updated in place (so its underline can grow and the keyboard stays up)
  G.bar = function () {
    var s = G.sel, sh = G.geo.sh, ref = SheetSvc.ref(s.r1, s.c1) + (s.r1 !== s.r2 || s.c1 !== s.c2 ? ':' + SheetSvc.ref(s.r2, s.c2) : ''), bar = $('bookBar'), inp = bar.querySelector('#fbIn');
    var ac = G.act(); G.raw = Fmt.raw(sh, ac.r, ac.c);
    if (inp && bar.dataset.ro === String(!!Wb.readOnly)) { var rf = bar.querySelector('.fb-ref'); if (document.activeElement !== rf) rf.value = ref; if (!G.editing) inp.value = G.raw; }
    else { bar.innerHTML = GridView.bar(ref, G.raw, Wb.readOnly); bar.dataset.ro = String(!!Wb.readOnly); }
    bar.classList.toggle('edit', G.editing); var rr = $('fbRef'); if (rr) rr.readOnly = !(window.Wide && Wide.mode !== 'phone');
  };
  // tool bar: built once, then updated in place; the tab pill slides and the row of tools fades when the tab changes
  G.tools = function () {
    var el = $('bookTools'), s = G.sel; el.style.display = Wb.readOnly ? 'none' : '';
    if (Wb.readOnly) { el.innerHTML = ''; return; }
    var st = Wb.style(G.geo.sh, s.r1, s.c1), label = '123 · ' + t('nf.' + Fmt.kindOf(st.nf)), tabs = el.querySelector('.tl-tabs');
    if (!tabs) { el.innerHTML = GridView.tools(G.tab, st, label); el.dataset.tab = G.tab; Motion.pill(el.querySelector('.tl-tabs'), '.tl-tab.on', false); return; }
    if (el.dataset.tab !== G.tab) {
      el.dataset.tab = G.tab; Array.prototype.forEach.call(tabs.querySelectorAll('.tl-tab'), function (b) { b.classList.toggle('on', b.dataset.k === G.tab); });
      var row = el.querySelector('.tl-row'); row.outerHTML = GridView.toolRow(G.tab, st, label); Motion.pill(tabs, '.tl-tab.on', true); Motion.anim(el.querySelector('.tl-row'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 180 });
      return;
    }
    if (G.tab !== 'format') return;
    var on = { 'f-bold': st.b, 'f-italic': st.i, 'f-under': st.u, 'fm-open': !!st.bg, 'f-al-left': st.al === 'left', 'f-al-center': st.al === 'center', 'f-al-right': st.al === 'right' };
    Object.keys(on).forEach(function (a) { var b = el.querySelector('.tl-b[data-act="' + a + '"]'); if (b) b.classList.toggle('on', !!on[a]); });
    var sw = el.querySelector('.sw'); if (sw) sw.style.background = st.bg || 'transparent';
    var fp = el.querySelector('.tl-pill.fo span'), fname = st.f || Fonts.def; if (fp && fp.textContent !== fname) { fp.textContent = fname; fp.style.fontFamily = Fonts.css(fname); }
    var pill = el.querySelector('.tl-pill[data-act="nf-open"]'); if (pill && pill.firstChild.nodeValue !== label) pill.firstChild.nodeValue = label;
  };
  G.refresh = function () { if (!G.geo) return; var s = G.sel; s.r2 = Math.min(s.r2, G.geo.rows - 1); G.paint(); };
  // after the contents changed (an edit, undo, paste): redraw what is in view; cells whose text changed flash softly
  G.changed = function () {
    var g = G.geo, sh = g.sh, snap = Motion.snap();
    if (sh.rows + 2 > g.rows || g.sh.viewRows < Wb.extent(sh).rows) G.mount(); else G.paint();
    Motion.flash(snap); Book.touch();
  };

  // the active cell: where typing goes (the corner the selection started from)
  G.act = function () { var s = G.sel, a = G.anc || { r: s.r1, c: s.c1 }; return { r: Math.max(s.r1, Math.min(s.r2, a.r)), c: Math.max(s.c1, Math.min(s.c2, a.c)) }; };
  // ---- selection --------------------------------------------------------------------------------------------------------------
  G.select = function (r1, c1, r2, c2, whole) {
    var g = G.geo; r2 = r2 === undefined ? r1 : r2; c2 = c2 === undefined ? c1 : c2;
    G.anc = { r: Math.max(0, r1), c: Math.max(0, c1) }; G.cur = { r: Math.max(0, r2), c: Math.max(0, c2) };
    G.sel = { r1: Math.max(0, Math.min(r1, r2)), c1: Math.max(0, Math.min(c1, c2)), r2: Math.min(g.rows - 1, Math.max(r1, r2)), c2: Math.min(g.cols - 1, Math.max(c1, c2)), whole: whole || '' };
    G.qk = false; G.pop = true; G.paint(true);
    var sc = $('gScroll'), q = G.rect(Math.max(G.sel.r1, g.fy), G.sel.c1, Math.max(G.sel.r1, g.fy), G.sel.c1), y = q.y - g.tops[g.fy], top = sc.scrollTop, left = sc.scrollLeft;
    if (y < top) top = y; else if (y + q.h > top + sc.clientHeight) top = y + q.h - sc.clientHeight + 6;
    if (q.x - hw() < left) left = q.x - hw(); else if (q.x + q.w > left + sc.clientWidth) left = q.x + q.w - sc.clientWidth + 6;
    if (top !== sc.scrollTop || left !== sc.scrollLeft) sc.scrollTo({ top: top, left: left, behavior: Motion.rm || Math.abs(top - sc.scrollTop) > 900 ? 'auto' : 'smooth' });
  };
  A['g-col'] = function (el) { if (Date.now() < (G.noHead || 0)) return; var c = +el.dataset.c; G.select(0, c, G.geo.rows - 1, c, 'col'); };
  A['g-row'] = function (el) { if (Date.now() < (G.noHead || 0)) return; var r = +el.dataset.r; G.select(r, 0, r, G.geo.cols - 1, 'row'); };

  function tap(e, inFz) {
    if (e.target.closest('[data-act],.gquick,.gsel i')) return;
    if (G.lp) { G.lp = false; return; }
    if (Date.now() < (G.noTap || 0)) return;   // the click that ends a handle drag is not a tap
    var sc = $('gScroll'), g = G.geo, box = (inFz ? $('gFz') : sc).getBoundingClientRect(), x = e.clientX - box.left + sc.scrollLeft - hw(), y = e.clientY - box.top + (inFz ? 0 : sc.scrollTop + g.tops[g.fy]);
    if (x < 0) return;
    var p = G.at(x, y), s = G.sel, same = s.r1 === s.r2 && s.c1 === s.c2 && s.r1 === p.r && s.c1 === p.c;
    if (G.editing) { var i = $('fbIn'); if (i) i.blur(); }
    if (same && !Wb.readOnly) { G.select(p.r, p.c); G.edit(); return; }
    G.select(p.r, p.c);
  }
  // pull the frame's handle to grow the selection; the cell under the finger is the new corner
  function handle(e) {
    var h = e.target.closest('.gsel i'); if (!h) return;
    if (h.dataset.h === 'br' && window.Fill && Fill.desktop() && !Wb.readOnly) { Fill.begin(e); return; }
    e.preventDefault(); var sc = $('gScroll'), g = G.geo, s0 = Object.assign({}, G.sel), corner = h.dataset.h, anchor = corner === 'br' ? { r: s0.r1, c: s0.c1 } : { r: s0.r2, c: s0.c2 };
    h.setPointerCapture(e.pointerId); Motion.drag = true; h.classList.add('grab'); G.place();
    function move(ev) {
      var box = sc.getBoundingClientRect(), p = G.at(ev.clientX - box.left + sc.scrollLeft - hw(), ev.clientY - box.top + sc.scrollTop + g.tops[g.fy]);
      var n = { r1: Math.min(anchor.r, p.r), c1: Math.min(anchor.c, p.c), r2: Math.max(anchor.r, p.r), c2: Math.max(anchor.c, p.c) };
      if (n.r1 !== G.sel.r1 || n.c1 !== G.sel.c1 || n.r2 !== G.sel.r2 || n.c2 !== G.sel.c2) { G.sel = Object.assign(n, { whole: '' }); G.paintLight(); }
      if (ev.clientY > box.bottom - 30) sc.scrollTop += 14; else if (ev.clientY < box.top + 30) sc.scrollTop -= 14;
      if (ev.clientX > box.right - 30) sc.scrollLeft += 14; else if (ev.clientX < box.left + 30) sc.scrollLeft -= 14;
    }
    function up() { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); Motion.drag = false; G.noTap = Date.now() + 350; h.classList.remove('grab'); G.paint(true); }
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }
  // while dragging: only the frame and the summary move
  G.paintLight = function () { Motion.heads(G.sel); G.place(); G.bar(); Clip.stats(); };

  // ---- editing ----------------------------------------------------------------------------------------------------------------
  G.edit = function (text) { var i = $('fbIn'); if (!i || Wb.readOnly) return; if (window.CellEdit && CellEdit.wanted()) { CellEdit.begin(text === undefined ? G.raw : text, text === undefined ? 'end' : 'fresh'); return; } i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* not a text input */ } };
  // move: true (down), { dr, dc } (a step after Enter / Tab), or nothing
  G.commit = function (move, lose) {
    var i = $('fbIn'); if (!i || !G.editing) return;
    if (!Wb.readOnly && window.Valid && i.value !== G.raw) {   // a rule of the cell may refuse what was typed
      var q = G.act(), p0 = Clip.parse(i.value, Wb.style(G.geo.sh, q.r, q.c)), bad = Valid.check(G.geo.sh, q.r, q.c, i.value, p0);
      if (bad && bad.stop) { Ui.toast(bad.msg); if (!lose) { if (window.CellEdit && CellEdit.on) CellEdit.focus(); else i.focus(); return; } i.value = G.raw; }
      else if (bad) Ui.toast(bad.msg);
    }
    G.editing = false; $('bookBar').classList.remove('edit'); if (window.CellEdit) CellEdit.hide();
    if (Wb.readOnly) { G.paint(true); return; }
    var sh = G.geo.sh, s = G.sel, a = G.act(), text = i.value;
    if (text !== G.raw) {
      Wb.batch(function () {
        var p = Clip.parse(text, Wb.style(sh, a.r, a.c));
        Wb.setCell(sh, a.r, a.c, p.v === undefined ? null : p.v, p.f || '');
        if (p.nf) Wb.setStyle(sh, { r1: a.r, c1: a.c, r2: a.r, c2: a.c }, { nf: p.nf });
      });
      G.changed();
    }
    if (move) { var d = move === true ? { dr: 1, dc: 0 } : move; G.step(d.dr, d.dc); } else G.paint(true);
  };
  // one cell on from the active one; inside a selection of several cells the step cycles within it (like Excel)
  G.step = function (dr, dc) {
    var s = G.sel, a = G.act(), g = G.geo, multi = s.r1 !== s.r2 || s.c1 !== s.c2, r = a.r + dr, c = a.c + dc;
    if (multi) {
      if (c > s.c2) { c = s.c1; r = a.r + 1; } else if (c < s.c1) { c = s.c2; r = a.r - 1; }
      if (r > s.r2) { r = s.r1; c = c + 1 > s.c2 ? s.c1 : c + 1; } else if (r < s.r1) { r = s.r2; c = c - 1 < s.c1 ? s.c2 : c - 1; }
      G.anc = { r: r, c: c }; G.paintLight(); G.reveal(r, c); return;
    }
    G.select(Math.max(0, Math.min(g.rows - 1, r)), Math.max(0, Math.min(g.cols - 1, c)));
  };
  // scroll so that the cell can be seen (only when it is not)
  G.reveal = function (r, c) {
    var g = G.geo, sc = $('gScroll'); if (!g || r < g.fy) return; var q = G.rect(r, c, r, c), y = q.y - g.tops[g.fy], top = sc.scrollTop, left = sc.scrollLeft;
    if (y < top) top = y; else if (y + q.h > top + sc.clientHeight) top = y + q.h - sc.clientHeight + 6;
    if (q.x - hw() < left) left = q.x - hw(); else if (q.x + q.w > left + sc.clientWidth) left = q.x + q.w - sc.clientWidth + 6;
    if (top !== sc.scrollTop || left !== sc.scrollLeft) sc.scrollTo({ top: top, left: left });
  };
  A['tl-tab'] = function (el) { G.tab = el.dataset.k; G.tools(); };
  A['fb-ok'] = function () { $('fbIn').blur(); };
  A['fb-cancel'] = function () { var i = $('fbIn'); i.value = G.raw; G.editing = false; i.blur(); $('bookBar').classList.remove('edit'); G.paint(true); };

  G.init = function () {
    var sc = $('gScroll');
    Resize.init(); if (window.Mouse) Mouse.init(); if (window.Ctx) Ctx.init(); if (window.Desk) Desk.init(); if (window.Menus) Menus.init();
    sc.addEventListener('click', function (e) { tap(e, false); });
    $('gFz').addEventListener('click', function (e) { tap(e, true); });
    ['gScroll', 'gFz'].forEach(function (id) { $(id).addEventListener('pointerdown', handle); });
    var lp = 0;
    sc.addEventListener('pointerdown', function (e) { if (e.target.closest('.gsel i,.gquick')) return; var x = e.clientX, y = e.clientY; clearTimeout(lp); lp = setTimeout(function () { if (Wb.readOnly) return; G.lp = true; G.qk = true; var s = G.sel; if (!(s.r1 !== s.r2 || s.c1 !== s.c2)) tap({ target: document.body, clientX: x, clientY: y }, false); G.lp = true; G.place(); }, 520); });
    ['pointermove', 'pointerup', 'pointercancel'].forEach(function (n) { sc.addEventListener(n, function (e) { if (n !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 3) clearTimeout(lp); }); });
    sc.addEventListener('scroll', function () {
      $('gColH').scrollLeft = sc.scrollLeft; $('gFz').scrollLeft = sc.scrollLeft;
      var g = G.geo; if (g && g.rows < MAXR && sc.scrollTop + sc.clientHeight > g.tops[g.rows] - g.tops[g.fy] - 400) { g.sh.viewRows = Math.min(MAXR, g.rows + 100); G.mount(); }
    }, { passive: true });
    // on a computer: Shift + wheel scrolls the grid sideways (over the letters and frozen rows too); the plain wheel still scrolls rows
    $('gWrap').addEventListener('wheel', function (e) {
      if (!e.shiftKey || e.ctrlKey) return;
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (e.deltaMode === 1) d *= 16;
      if (!d) return; e.preventDefault(); sc.scrollLeft += d;
    }, { passive: false });
    var bar = $('bookBar');
    bar.addEventListener('focusin', function (e) { if (e.target.id !== 'fbIn' || Wb.readOnly) return; G.editing = true; bar.classList.add('edit'); G.place(); });
    bar.addEventListener('focusout', function (e) { if (e.target.id === 'fbIn' && G.editing) setTimeout(function () { if (document.activeElement !== e.target) G.commit(false, true); }, 0); });
    bar.addEventListener('keydown', function (e) { if (e.target.id !== 'fbIn') return; if (e.key === 'Enter') { e.preventDefault(); G.commit(e.shiftKey ? { dr: -1, dc: 0 } : true); e.target.blur(); } else if (e.key === 'Tab') { e.preventDefault(); G.commit({ dr: 0, dc: e.shiftKey ? -1 : 1 }); e.target.blur(); } else if (e.key === 'Escape') A['fb-cancel'](); });
  };
})();
