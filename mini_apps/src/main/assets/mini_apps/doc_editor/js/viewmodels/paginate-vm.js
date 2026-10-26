// Paginate — the editing page as sheets of paper, like Print Layout in Word: white sheets of the file's own size with a gap between them, the margins, the header and footer, and the text running from one sheet
// to the next as you type. The text stays ONE editing surface: the sheets are drawn behind it, and where a sheet ends the text is pushed down to the next one — a block that does not fit is moved by its top margin,
// a paragraph that crosses the edge is cut between two lines by a zero-width marker that is as high as the gap. Markers and margins are only for the eye: they are taken out before a snapshot, a copy or a save.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, PX = 1 / 15, GAP = 28, P = window.Paginate = { pages: 1, on: false, ms: 0 }, timer = 0, composing = false, running = false;
  // the geometry of a section: sheet size, margins, header and footer distance (px of the sheet), and where the sheet sits across the paper (the paper is as wide as the widest sheet)
  var DEF = { w: 11906, h: 16838, t: 1440, r: 1440, b: 1440, l: 1440, hd: 720, ft: 720, title: false, hdr: {}, ftr: {} };
  function secs() { var l = window.Sec ? Sec.list() : []; return l.length ? l : [DEF]; }
  function widest() { return Math.max.apply(null, secs().map(function (s) { return s.w * PX; })); }
  function secGeo(i, W) { var l = secs(), s = l[Math.max(0, Math.min(i, l.length - 1))]; W = W || widest(); return { i: i, s: s, w: s.w * PX, h: s.h * PX, mt: s.t * PX, mb: s.b * PX, ml: s.l * PX, mr: s.r * PX, hd: s.hd * PX, ft: s.ft * PX, xoff: (W - s.w * PX) / 2 }; }
  function sigOf() { return secs().map(function (s) { return [s.w, s.h, s.t, s.b, s.l, s.r, s.kind].join(','); }).join('|'); }
  var pgs = [];   // the sheets: { y (top, in paper px), g (the section's geometry), sec, first (the first sheet of its section) }
  P.pgs = pgs;
  P.active = function () { return Doc.mode === 'edit' && !!Doc.blocks && Doc.paper().classList.contains('pgedit'); };

  // what a snapshot, a copy or a save must not carry
  P.strip = function (h) {
    return h.replace(/<div id="pgov"[\s\S]*?<!--pgov-end-->/g, '').replace(/<span class="pgsp"[^>]*><\/span>/g, '').replace(/ data-pgp="[^"]*"/g, '').replace(/\s*--pgp:\s*[^;"]*;?/g, '').replace(/\s*--(?:bml|bmr|sdl|sdr):\s*[^;"]*;?/g, '').replace(/ data-sdl="[^"]*"/g, '').replace(/ style=""/g, '');
  };
  function clear(p) {
    Array.prototype.forEach.call(p.querySelectorAll('.pgsp'), function (s) { var par = s.parentNode; s.remove(); if (par && par.normalize) par.normalize(); });
    Array.prototype.forEach.call(p.querySelectorAll('[data-pgp]'), function (b) { b.removeAttribute('data-pgp'); b.style.removeProperty('--pgp'); if (!b.getAttribute('style')) b.removeAttribute('style'); });
    var ov = $('pgov'); if (ov) { var c = ov.nextSibling; ov.remove(); if (c && c.nodeType === 8) c.remove(); }
  }

  // ---- the lines of a paragraph -------------------------------------------------------------------------------------------------------
  function lineH(b) { var cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight); return isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.25; }
  // [{ node, idx, top, bottom }] one entry per line, in reading order (positions in the sheet's own pixels)
  function lines(b, top0) {
    var out = [], w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n, lh = lineH(b), cur = null;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.length || (n.parentElement && n.parentElement.closest('.pgsp'))) continue;
      var r = document.createRange(); r.selectNodeContents(n); var rs = r.getClientRects();
      for (var i = 0; i < rs.length; i++) {
        var q = rs[i]; if (q.width < 0.5 && q.height < 0.5) continue; var top = q.top - top0 - (lh - q.height) / 2, bottom = top + lh;
        if (cur && Math.abs(top - cur.top) < lh * 0.6) { cur.bottom = Math.max(cur.bottom, bottom); continue; }
        cur = { node: n, idx: i, top: top, bottom: bottom, rh: q.height }; out.push(cur);
      }
    }
    return out;
  }
  // the character offset in a text node where its idx-th line fragment begins
  function startOf(node, idx) {
    if (idx === 0) return 0; var r = document.createRange(), lo = 1, hi = node.nodeValue.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; r.setStart(node, 0); r.setEnd(node, mid); if (r.getClientRects().length >= idx + 1) hi = mid; else lo = mid + 1; }
    return Math.max(0, lo - 1);
  }
  function mk() { var s = document.createElement('span'); s.className = 'pgsp'; s.contentEditable = 'false'; s.style.height = '1px'; return s; }
  // the marker goes before the first character of the line that no longer fits; its height is tuned until that line starts at the top of the next sheet
  function cut(line, want, top0) {
    var off = startOf(line.node, line.idx), r = document.createRange(), sp = mk(); r.setStart(line.node, off); r.collapse(true); r.insertNode(sp);
    var nx = sp.nextSibling, h = Math.max(1, want - line.top + 4);
    for (var k = 0; k < 4; k++) {
      sp.style.height = h + 'px'; var probe = document.createRange(); if (nx && nx.nodeType === 3 && nx.nodeValue.length) { probe.setStart(nx, 0); probe.setEnd(nx, 1); } else probe.selectNode(sp);
      var rc = probe.getClientRects()[0]; if (!rc) break; var at = rc.top - top0 - (lineH(line.node.parentElement) - rc.height) / 2, err = want - at; if (Math.abs(err) < 0.6) break; h = Math.max(1, h + err);
    }
    return sp;
  }

  // ---- the run ---------------------------------------------------------------------------------------------------------------------------
  // What each block came to the last time: the sheet it started on (k0), the sheet it ended on (k1), whether it was pushed to the next sheet, and where its last cut was (as a character offset).
  // A run after an edit starts at the first changed block and stops as soon as a block lands exactly where it did before, past the last changed block: everything after it is as it was.
  var st = new WeakMap(), dirty = [], dirtyAll = true;
  P.touch = function (el) { if (!el) { dirtyAll = true; return; } var b = el.nodeType === 1 ? el : el.parentElement; b = b && b.closest ? b.closest('#paper > .b') : null; if (b) { if (dirty.indexOf(b) < 0) dirty.push(b); } else dirtyAll = true; };
  function clearBlock(b) {
    Array.prototype.forEach.call(b.querySelectorAll('.pgsp'), function (s) { var par = s.parentNode; s.remove(); if (par && par.normalize) par.normalize(); });
    if (b.hasAttribute('data-pgp')) { b.removeAttribute('data-pgp'); b.style.removeProperty('--pgp'); if (!b.getAttribute('style')) b.removeAttribute('style'); }
  }
  function clearOverlay(p) { var ov = $('pgov'); if (ov) { var c = ov.nextSibling; ov.remove(); if (c && c.nodeType === 8) c.remove(); } }
  function cutOffset(b) { var sp = b.querySelectorAll('.pgsp'); if (!sp.length) return -1; var r = document.createRange(); r.selectNodeContents(b); r.setEndBefore(sp[sp.length - 1]); return r.toString().length; }
  // margins of every block follow its section when the sections differ: the paper is as wide as the widest sheet and each block carries its own left and right offset
  function setVar(b, k, v) { if (v === null || v === undefined) { if (b.style.getPropertyValue(k)) b.style.removeProperty(k); } else if (b.style.getPropertyValue(k) !== v) b.style.setProperty(k, v); }
  function marginsFor(children, multi, W) {
    var sec = 0;
    children.forEach(function (b) {
      if (b.classList.contains('sb')) { sec++; }
      var secNow = b.classList.contains('sb') ? sec - 1 : sec;
      if (!multi) { if (b.hasAttribute('data-sdl')) { b.removeAttribute('data-sdl'); setVar(b, '--bml'); setVar(b, '--bmr'); setVar(b, '--sdl'); setVar(b, '--sdr'); if (!b.getAttribute('style')) b.removeAttribute('style'); } return; }
      var g = secGeo(secNow, W), ml = parseFloat(b.style.marginLeft), mr = parseFloat(b.style.marginRight);
      setVar(b, '--bml', isFinite(ml) && b.style.marginLeft ? ml + 'px' : null); setVar(b, '--bmr', isFinite(mr) && b.style.marginRight ? mr + 'px' : null);
      setVar(b, '--sdl', (g.xoff + g.ml) + 'px'); setVar(b, '--sdr', (g.xoff + g.mr) + 'px'); if (b.dataset.sdl !== '1') b.dataset.sdl = '1';
    });
  }
  P.run = function () {
    if (running || !P.active()) return; running = true; var sc0; var t0 = performance.now(), p = Doc.paper(), sel = window.Surface && Surface.sel(), z = p.style.zoom;
    try {
      p.style.zoom = ''; var body = $('docBody'); sc0 = body.scrollTop; body.style.overflowAnchor = 'none';   // the page grows and shrinks while it is laid out: the view must not follow it, and every position is read against the paper's top as it is right then
      var W = widest(), multi = !!(window.Sec && Sec.multi()), L = secs(), children = Array.prototype.filter.call(p.children, function (el) { return el.classList.contains('b'); });
      p.classList.toggle('multi', multi); marginsFor(children, multi, W);
      // the section of every block, and which blocks open a section on a sheet of its own
      var blocks = [], bsec = [], opens = [], sec = 0, pendingOpen = false;
      children.forEach(function (el) {
        if (el.classList.contains('sb')) { sec++; var kd = (L[sec] && L[sec].kind) || 'nextPage'; pendingOpen = kd !== 'continuous'; return; }
        if (el.hidden) return; blocks.push(el); bsec.push(Math.min(sec, L.length - 1)); opens.push(pendingOpen); pendingOpen = false;
      });
      var key = sigOf() + '#' + multi, start = 0, full = dirtyAll || !dirty.length || P.gkey !== key;
      if (!full) { start = blocks.length; dirty.forEach(function (d) { var i = blocks.indexOf(d); if (i < 0) { full = true; } else if (i < start) start = i; }); }
      var last = 0; if (!full) dirty.forEach(function (d) { last = Math.max(last, blocks.indexOf(d)); });
      var old = full ? new WeakMap() : st; if (full) { st = new WeakMap(); clearOverlay(p); Array.prototype.forEach.call(blocks, clearBlock); start = 0; last = 0; pgs.length = 0; } else { clearOverlay(p); }
      var top0 = p.getBoundingClientRect().top, k = 0;
      function ensure(n, sc, first) { var y = n ? pgs[n - 1].y + pgs[n - 1].g.h + GAP : 0; pgs[n] = { y: y, g: secGeo(sc, W), sec: sc, first: !!first }; }
      if (start > 0) { var pv = st.get(blocks[start - 1]); if (!pv || !pgs[pv.k1]) { full = true; start = 0; st = new WeakMap(); pgs.length = 0; Array.prototype.forEach.call(blocks, clearBlock); } else k = pv.k1; }
      if (!pgs[k]) ensure(k, bsec[start] || 0, k === 0);
      var stopped = false, bi;
      for (bi = start; bi < blocks.length; bi++) {
        var b = blocks[bi], was = full ? null : old.get(b), guard = 0, k0 = k, pushed = false, forced = !!opens[bi] && bi > 0, sc = bsec[bi]; if (!full) clearBlock(b);
        while (guard++ < 60) {
          top0 = p.getBoundingClientRect().top; var r = b.getBoundingClientRect(), bt = r.top - top0, bb = r.bottom - top0, PG = pgs[k], limit = PG.y + PG.g.h - PG.g.mb, ctop = PG.y + PG.g.mt;
          if (!forced) {
            if (bb <= limit + 0.5) break;
            var ln = b.classList.contains('ed') ? lines(b, top0) : [], at = -1, i;
            for (i = 0; i < ln.length; i++) if (ln[i].bottom > limit + 0.5) { at = i; break; }
            if (at > 0) { ensure(k + 1, sc, false); cut(ln[at], pgs[k + 1].y + pgs[k + 1].g.mt, top0); k++; continue; }
            if (bt <= ctop + 1.5) { while (bb > pgs[k].y + pgs[k].g.h - pgs[k].g.mb + 0.5) { ensure(k + 1, sc, false); k++; } break; }   // taller than a sheet: it runs on over the next ones
          }
          ensure(k + 1, sc, forced); var prev = bi ? blocks[bi - 1].getBoundingClientRect().bottom - top0 : bt, gap = Math.max(0, bt - prev), by = pgs[k + 1].y + pgs[k + 1].g.mt - bt;
          b.dataset.pgp = '1'; b.style.setProperty('--pgp', (gap + by) + 'px'); k++; pushed = true; forced = false;
        }
        var now = { k0: k0, k1: k, push: pushed, cut: cutOffset(b), sec: sc }; st.set(b, now);
        // past the last changed block and landing exactly where it did before: the rest is as it was
        if (!full && bi > last && was && was.k0 === now.k0 && was.k1 === now.k1 && was.push === now.push && was.cut === now.cut && was.sec === now.sec && (now.push || now.cut >= 0)) { stopped = true; break; }
      }
      var n = stopped ? pgs.length : k + 1; pgs.length = n; top0 = p.getBoundingClientRect().top;
      P.pages = n; P.W = W; P.g = secGeo(0, W); P.gkey = key; var lp = pgs[n - 1]; p.style.minHeight = (lp.y + lp.g.h) + 'px'; draw(p, W, n); dirty = []; dirtyAll = false; P.last = { full: full, from: start, to: bi, stopped: stopped };
    } finally {
      $('docBody').style.overflowAnchor = ''; if (sc0 !== undefined) $('docBody').scrollTop = sc0; p.style.zoom = z; running = false; P.ms = Math.round(performance.now() - t0);
      if (sel && document.activeElement === p) Surface.restore(sel); else if (sel && getSelection().rangeCount && p.contains(getSelection().anchorNode)) Surface.restore(sel);
      if (window.Desk) Desk.status(); if (window.Wide && Wide.renderSide) { try { Wide.renderSide(); } catch (e) { /* the side column is not there */ } }
    }
  };
  function tok(h, at, n) { return (h || '').replace('{PAGE}', at).replace('{NUMPAGES}', n); }
  function draw(p, W, n) {
    var h = '<div id="pgov" class="pgov" contenteditable="false" aria-hidden="true">';
    var sheets = pgs.slice(0, n).map(function (q) { return { s: q.g.s, first: q.first }; }), nums = Sec.numbers(sheets), cnt = Sec.counts(sheets);
    for (var i = 0; i < n; i++) {
      var pg = pgs[i], g = pg.g, s = g.s, first = s.title && pg.first, hd = tok(Sec.pick(s, 'hdr', pg.first, cnt[i]), nums[i], n), ft = tok(Sec.pick(s, 'ftr', pg.first, cnt[i]), nums[i], n), x = g.xoff, st1 = 'left:' + (x + g.ml) + 'px;width:' + (g.w - g.ml - g.mr) + 'px;';
      var wmS = window.Extras ? Extras.wmSpec() : null, wm = wmS ? wmS.text : '';
      h += (wm ? '<div class="pgw' + (wmS.diagonal ? '' : ' flat') + '" style="top:' + (pg.y + g.h / 2) + 'px;left:' + (x + g.w / 2) + 'px;color:#' + wmS.colorHex + ';opacity:' + wmS.opacity + ';font-size:' + Math.round(Math.min(g.w / (wm.length * 0.62 + 1) * (wmS.diagonal ? 1.1 : 0.9), g.h / (wmS.diagonal ? 6 : 8))) + 'px">' + wm.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' : '');
      h += (s.border ? '<div class="pgb" style="top:' + (pg.y + 32) + 'px;left:' + (x + 32) + 'px;width:' + (g.w - 64) + 'px;height:' + (g.h - 64) + 'px"></div>' : '');
      h += '<div class="pgs" style="top:' + pg.y + 'px;height:' + g.h + 'px;left:' + x + 'px;width:' + g.w + 'px"></div>' + (hd ? '<div class="pgh" style="' + st1 + 'top:' + (pg.y + g.hd) + 'px">' + hd + '</div>' : '') + (ft ? '<div class="pgf" style="' + st1 + 'top:' + (pg.y + g.h - g.ft) + 'px;transform:translateY(-100%)">' + ft + '</div>' : '');
    }
    p.insertAdjacentHTML('afterbegin', h + '</div><!--pgov-end-->');
  }
  // the sheet at a height of the paper (index, 0-based)
  function sheetAt(y) { var k = 0; for (var i = 0; i < pgs.length; i++) { if (pgs[i].y <= y + 1) k = i; else break; } return k; }
  function paperY(rect) { var p = Doc.paper(), pr = p.getBoundingClientRect(), sc = pr.width / (P.W || pr.width) || 1; return (rect.top - pr.top) / sc; }
  // the sheet the caret is on (1-based)
  P.at = function () {
    var s = getSelection(); if (!s.rangeCount || !pgs.length) return 1; var r = s.getRangeAt(0).getBoundingClientRect(); if (!r || (!r.top && !r.bottom)) return 1;
    return sheetAt(paperY(r)) + 1;
  };
  // the sheet an element starts on (1-based)
  P.pageOf = function (el) { return pgs.length ? sheetAt(paperY(el.getBoundingClientRect())) + 1 : 1; };
  // the geometry of the sheet a block starts on (its section's sheet size and margins, and where the sheet sits across the paper)
  P.geoFor = function (el) { var s = el && st.get(el), pg = s && pgs[s.k0]; if (!pg && el) { pg = pgs[sheetAt(paperY(el.getBoundingClientRect()))]; } return pg ? pg.g : (pgs[0] && pgs[0].g) || null; };
  P.schedule = function (ms) { if (ms === 0) dirtyAll = true; clearTimeout(timer); timer = setTimeout(function () { if (composing) return P.schedule(200); P.run(); }, ms == null ? 300 : ms); };

  // ---- wiring ----------------------------------------------------------------------------------------------------------------------------
  var p0 = Doc.paper();
  p0.addEventListener('compositionstart', function () { composing = true; }); p0.addEventListener('compositionend', function () { composing = false; P.schedule(200); });
  document.addEventListener('input', function (e) { if (e.target && (e.target === p0 || (e.target.closest && e.target.closest('#paper')))) { P.touch(getSelection().anchorNode && p0.contains(getSelection().anchorNode) ? getSelection().anchorNode : null); P.schedule(350); } });
  var apply0 = Read.apply; Read.apply = function () { apply0.apply(this, arguments); if (P.active()) { p0.classList.add('paged'); P.schedule(0); } else { p0.classList.remove('paged'); p0.classList.remove('multi'); clear(p0); p0.style.minHeight = ''; } dirtyAll = true; };
  var touch0 = Doc.touch; var inInput = false; document.addEventListener('input', function () { inInput = true; Promise.resolve().then(function () { inInput = false; }); }, true);   // a change that is not typing is not known block by block: the whole page is laid out again
  Doc.touch = function () { touch0.apply(this, arguments); if (P.active()) { if (!inInput) dirtyAll = true; P.schedule(350); } };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (P.active()) P.schedule(0); });
  window.addEventListener('resize', function () { if (P.active()) P.schedule(200); });
})();
