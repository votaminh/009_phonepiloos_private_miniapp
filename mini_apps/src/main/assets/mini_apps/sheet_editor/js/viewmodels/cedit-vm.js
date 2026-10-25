// CellEdit — typing straight into the cell (desktop): the box grows over the cell, the formula bar shows the same text, and while a formula is being written a click or the arrow keys put the cell's address into it (point mode).
// The references in a formula are coloured and the cells they point to get a frame of the same colour. The phone keeps typing in the formula bar.
(function () {
  'use strict';
  var $ = Ui.$, G = window.Grid, t = Ui.t, box = null, input = null, hl = null, list = null, refs = [], pt = null, listAt = -1, COLS = ['ref_blue', 'ref_red', 'ref_green', 'ref_purple', 'ref_orange', 'ref_teal'];
  var CE = window.CellEdit = { on: false, fresh: false };
  var REF = /(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g;

  function build() {
    box = document.createElement('div'); box.className = 'ce'; box.innerHTML = '<div class="ce-hl" aria-hidden="true"></div><textarea class="ce-in" rows="1" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>';
    hl = box.firstChild; input = box.lastChild; input.setAttribute('aria-label', t('fb.label'));
    list = document.createElement('div'); list.className = 'ce-list'; list.setAttribute('role', 'listbox'); document.body.appendChild(list);
    input.addEventListener('input', onInput); input.addEventListener('keydown', onKey); input.addEventListener('blur', onBlur);
    input.addEventListener('scroll', function () { hl.scrollLeft = input.scrollLeft; });
    $('fbIn').addEventListener('input', function () { if (CE.on && input) { input.value = this.value; paint(); } });
  }
  // desktop: a fine pointer and a window wide enough; the phone edits in the formula bar
  CE.wanted = function () { return !Wb.readOnly && !!window.Wide && Wide.mode !== 'phone' && !(window.matchMedia && matchMedia('(pointer: coarse)').matches); };

  // ---- the box ------------------------------------------------------------------------------------------------------------------
  CE.begin = function (text, how) {
    if (!box) build();
    var a = G.act(), g = G.geo, sh = g.sh, st = Wb.style(sh, a.r, a.c), m = Wb.mergeAt(sh, a.r, a.c);
    CE.on = true; CE.fresh = how === 'fresh'; CE.cell = { r: a.r, c: a.c, r2: m ? m.r2 : a.r, c2: m ? m.c2 : a.c }; pt = null; CE.st = st;
    input.value = text; $('fbIn').value = text; G.editing = true; $('bookBar').classList.add('edit');
    var cs = input.style; cs.fontFamily = Fonts.css(st.f || Fonts.def); cs.fontSize = Math.round((st.sz || 11) * 1.36 * G.z * 10) / 10 + 'px'; cs.fontWeight = st.b ? '700' : '400'; cs.fontStyle = st.i ? 'italic' : 'normal';
    hl.style.cssText = cs.cssText;
    CE.place(true); input.focus();
    if (how === 'all') input.select(); else { var n = input.value.length; input.setSelectionRange(n, n); }
    paint(); G.place();
  };
  CE.hide = function () { if (!CE.on) return; CE.on = false; pt = null; if (box && box.parentNode) box.parentNode.removeChild(box); clearRefs(); closeList(); };
  // the box sits over the cell in the same container as the selection frame (so it scrolls with the cells) and grows to the right with the text
  CE.place = function (force) {
    if (!CE.on || !box) return; var g = G.geo, c = CE.cell, q = G.rect(c.r, c.c, c.r2, c.c2), host = c.r < g.fy ? $('gFzIn') : $('gHost'), y = c.r < g.fy ? q.y : q.y - g.tops[g.fy];
    if (box.parentNode !== host) host.appendChild(box);
    var lines = input.value.split('\n'), w = Math.max(q.w, Math.min(measure(lines) + 22, 900)), h = Math.max(q.h, lines.length * (parseFloat(input.style.fontSize) * 1.25 || 20) + 6);
    box.style.cssText = 'left:' + q.x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    input.style.lineHeight = Math.max(18, Math.round(parseFloat(input.style.fontSize) * 1.25)) + 'px'; hl.style.lineHeight = input.style.lineHeight;
  };
  var cv = null;
  function measure(lines) { cv = cv || document.createElement('canvas').getContext('2d'); cv.font = input.style.fontWeight + ' ' + input.style.fontStyle + ' ' + input.style.fontSize + ' ' + input.style.fontFamily; return Math.max.apply(null, lines.map(function (l) { return cv.measureText(l).width; })); }

  // ---- colours and frames for the references -----------------------------------------------------------------------------------
  function esc(s) { return Ui.esc(s); }
  function paint() {
    var v = input.value, isF = v[0] === '=', html = '', last = 0, n = 0, m, want = [];
    input.classList.toggle('ink', !isF); hl.style.display = isF ? '' : 'none';
    if (isF) {
      REF.lastIndex = 0;
      while ((m = REF.exec(v))) {
        if (m.index > 0 && /[A-Za-z0-9_.]/.test(v[m.index - 1]) || /[A-Za-z(]/.test(v[m.index + m[0].length] || '')) continue;
        var col = C(COLS[n % COLS.length]); n++;
        html += esc(v.slice(last, m.index)) + '<span style="color:' + col + '">' + esc(m[0]) + '</span>'; last = m.index + m[0].length; want.push({ a: m[1], b: m[2] || m[1], col: col, at: m.index, end: last });
      }
      html += esc(v.slice(last)) + '\n';
    }
    hl.innerHTML = html; showRefs(want); CE.place(); suggest();
  }
  function parse(a) { var m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(a); return m ? { c: CalcParse.colNum(m[1]), r: +m[2] - 1 } : null; }
  function clearRefs() { refs.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); refs = []; }
  function showRefs(want) {
    clearRefs(); var g = G.geo;
    want.forEach(function (w) {
      var p = parse(w.a), q = parse(w.b); if (!p || !q || p.r >= g.rows || q.r >= g.rows || p.c >= g.cols || q.c >= g.cols) return;
      var r1 = Math.min(p.r, q.r), r2 = Math.max(p.r, q.r), c1 = Math.min(p.c, q.c), c2 = Math.max(p.c, q.c), rect = G.rect(r1, c1, r2, c2), inFz = r2 < g.fy, host = inFz ? $('gFzIn') : $('gHost');
      var d = document.createElement('div'); d.className = 'ce-ref'; d.style.cssText = 'left:' + rect.x + 'px;top:' + (inFz ? rect.y : rect.y - g.tops[g.fy]) + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;border-color:' + w.col + ';background:' + w.col + '14';
      host.appendChild(d); refs.push(d);
    });
  }

  // ---- point mode ---------------------------------------------------------------------------------------------------------------
  // may a cell address go at the caret? after '=' or an operator, an opening bracket, a comma — or on the address just put there
  CE.pointing = function () {
    if (!CE.on || input.value[0] !== '=') return false; var at = input.selectionStart, v = input.value;
    if (pt && at === pt.end && input.selectionEnd === at) return true;
    var before = v.slice(0, at).replace(/\s+$/, ''); return /[=+\-*\/^&<>(,;:]$/.test(before) && input.selectionEnd === at;
  };
  // put the address of (r, c) — or the block from the first cell pointed at to it (extend) — into the formula
  CE.point = function (r, c, extend) {
    var v = input.value, at = input.selectionStart, from = pt && at === pt.end ? pt : { start: at, end: at, r: r, c: c }, a = SheetSvc.ref(r, c), ref = a;
    if (extend && pt) { var r0 = pt.r, c0 = pt.c; ref = SheetSvc.ref(Math.min(r0, r), Math.min(c0, c)) + ':' + SheetSvc.ref(Math.max(r0, r), Math.max(c0, c)); if (r0 === r && c0 === c) ref = a; }
    else from = { start: from.start, end: from.end, r: r, c: c };
    input.value = v.slice(0, from.start) + ref + v.slice(from.end); var end = from.start + ref.length; input.setSelectionRange(end, end);
    pt = { start: from.start, end: end, r: from.r, c: from.c, cr: r, cc: c }; $('fbIn').value = input.value; input.focus(); paint(); G.reveal(r, c);
  };
  CE.pointStart = function () { return pt; };
  CE.focus = function () { if (input) input.focus(); };

  // ---- keys ---------------------------------------------------------------------------------------------------------------------
  function onInput() { $('fbIn').value = input.value; pt = null; paint(); }
  function onKey(e) {
    var k = e.key;
    if (list.classList.contains('on') && (k === 'ArrowDown' || k === 'ArrowUp')) { e.preventDefault(); moveList(k === 'ArrowDown' ? 1 : -1); return; }
    if ((k === 'Tab' || k === 'Enter') && list.classList.contains('on') && listAt >= 0) { e.preventDefault(); pick(listAt); return; }
    if (k === 'Enter' && !e.altKey) { e.preventDefault(); done(e.shiftKey ? { dr: -1, dc: 0 } : true); }
    else if (k === 'Enter' && e.altKey) { e.preventDefault(); var s = input.selectionStart; input.setRangeText('\n', s, input.selectionEnd, 'end'); onInput(); }
    else if (k === 'Tab') { e.preventDefault(); done({ dr: 0, dc: e.shiftKey ? -1 : 1 }); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    else if (k === 'F4') { e.preventDefault(); absolute(); }
    else if (/^Arrow(Up|Down|Left|Right)$/.test(k) && !e.altKey) arrow(e);
  }
  function arrow(e) {
    var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (CE.pointing() && !e.ctrlKey && !e.metaKey) {   // the next cell becomes the reference
      e.preventDefault(); var r = pt ? pt.cr : CE.cell.r, c = pt ? pt.cc : CE.cell.c, g = G.geo; r = Math.max(0, Math.min(g.rows - 1, r + d[0])); c = Math.max(0, Math.min(g.cols - 1, c + d[1]));
      if (e.shiftKey && pt) CE.point(r, c, true); else { pt = pt && input.selectionStart === pt.end ? { start: pt.start, end: pt.end, r: r, c: c, cr: r, cc: c } : null; CE.point(r, c, false); }
      return;
    }
    if (CE.fresh && !e.shiftKey && !e.ctrlKey && !e.metaKey && !list.classList.contains('on')) { e.preventDefault(); done({ dr: d[0], dc: d[1] }); }
  }
  function done(move) { G.commit(move); if (window.Book) Book.focusGrid && Book.focusGrid(); }
  function cancel() { var i = $('fbIn'); i.value = G.raw; G.editing = false; $('bookBar').classList.remove('edit'); CE.hide(); G.paint(true); }
  CE.cancel = cancel;
  function onBlur() {
    setTimeout(function () { if (!CE.on || !G.editing) return; var a = document.activeElement; if (a === input || a === $('fbIn') || (a && a.closest && a.closest('.ce-list,.sheet,.dlg,.ctxm'))) return; G.commit(false, true); }, 0);
  }
  // F4: the address under the caret goes $A$1 → A$1 → $A1 → A1
  function absolute() {
    var v = input.value, at = input.selectionStart, m, hit = null; REF.lastIndex = 0;
    while ((m = REF.exec(v))) { if (at >= m.index && at <= m.index + m[0].length) { hit = m; break; } }
    if (!hit) return; var one = function (s) { var p = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/.exec(s); if (!p) return s; var ac = p[1], ar = p[3], n = ac && ar ? [ '', '$' ] : ac ? ['', ''] : ar ? ['$', ''] : ['$', '$']; return n[0] + p[2] + n[1] + p[4]; };
    var first = one(hit[1]), rep = hit[2] ? first + ':' + one(hit[2]) : first; input.value = v.slice(0, hit.index) + rep + v.slice(hit.index + hit[0].length); var end = hit.index + rep.length; input.setSelectionRange(end, end); onInput();
  }

  // ---- function names while typing ------------------------------------------------------------------------------------------------
  function names() { return Object.keys(Calc.fns).concat(Object.keys(Calc.lazy)).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(); }
  function closeList() { if (list) { list.classList.remove('on'); list.innerHTML = ''; } listAt = -1; }
  function token() { var v = input.value, at = input.selectionStart, m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(v.slice(0, at)); if (!m || v[0] !== '=' || input.selectionEnd !== at) return null; var before = v.slice(0, at - m[1].length).replace(/\s+$/, ''); return /[=+\-*\/^&<>(,;:]$/.test(before) ? { word: m[1], at: at - m[1].length } : null; }
  function suggest() {
    var tk = CE.on && token(); if (!tk) return closeList();
    var up = tk.word.toUpperCase(), hits = names().filter(function (n) { return n.indexOf(up) === 0; }).slice(0, 8); if (!hits.length || (hits.length === 1 && hits[0] === up)) return closeList();
    list.innerHTML = hits.map(function (n, i) { return '<button type="button" role="option" class="ce-opt' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" data-n="' + n + '"><b>' + n.slice(0, up.length) + '</b>' + n.slice(up.length) + '<small>' + esc(window.CalcDoc ? CalcDoc.sig(n) : '') + '</small></button>'; }).join('');
    var r = input.getBoundingClientRect(); list.style.left = r.left + 'px'; list.style.top = r.bottom + 4 + 'px'; list.classList.add('on'); listAt = 0;
  }
  function moveList(d) { var o = list.querySelectorAll('.ce-opt'); if (!o.length) return; listAt = (listAt + d + o.length) % o.length; Array.prototype.forEach.call(o, function (x, i) { x.classList.toggle('on', i === listAt); }); }
  function pick(i) {
    var o = list.querySelectorAll('.ce-opt')[i], tk = token(); if (!o || !tk) return closeList();
    var v = input.value, at = input.selectionStart, name = o.dataset.n + '('; input.value = v.slice(0, tk.at) + name + v.slice(at); var end = tk.at + name.length; input.setSelectionRange(end, end); closeList(); onInput(); input.focus();
  }
  document.addEventListener('mousedown', function (e) { var o = e.target.closest && e.target.closest('.ce-opt'); if (o) { e.preventDefault(); pick(+o.dataset.i); } }, true);
})();
