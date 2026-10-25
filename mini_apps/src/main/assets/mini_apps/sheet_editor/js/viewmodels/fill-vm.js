// Fill — drag the little square at the corner of the selection (or Ctrl+D / Ctrl+R) to continue what the cells hold: a run of numbers goes on by the same step, dates go day by day, "Item 1" becomes "Item 2", month and day names go round,
// a formula moves its references, anything else is copied. The frame shows how far the fill will go; letting go writes it as one undo step.
(function () {
  'use strict';
  var $ = Ui.$, G = window.Grid, F = window.Fill = {}, ghost = null, drag = null, timer = 0;
  var LISTS = [
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'], ['thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'chủ nhật'], ['q1', 'q2', 'q3', 'q4']
  ];
  F.desktop = function () { return !!window.Wide && Wide.mode !== 'phone' && !(window.matchMedia && matchMedia('(pointer: coarse)').matches); };

  // a formula text moved by (dr, dc) cells: relative references follow, $ ones stay
  function shift(f, dr, dc) { return Clip.shift(f, dr, dc); }
  function cased(from, to) { return from === from.toUpperCase() ? to.toUpperCase() : from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to; }

  // the next values of one line of cells (src: [{ v, f, st }] in order), n of them, going on (dir 1) or backwards (dir -1)
  function series(src, n, dir, pos) {
    var out = [], i, k, vals = src.map(function (x) { return x.v; }), len = src.length;
    var nums = vals.every(function (v) { return typeof v === 'number'; }), noF = src.every(function (x) { return !x.f; });
    var date = nums && noF && src.every(function (x) { return Fmt.kindOf(x.st && x.st.nf) === 'date'; });
    if (!noF) { for (k = 0; k < n; k++) { var from = dir > 0 ? k : -k - 1, ix = ((from % len) + len) % len; out.push({ f: src[ix].f, idx: ix }); } return out; }
    if (nums && len >= 2 && !date || date && len >= 2) {
      var step = (vals[len - 1] - vals[0]) / (len - 1); if (vals.some(function (v, j) { return j && Math.abs((v - vals[j - 1]) - step) > 1e-9 * Math.max(1, Math.abs(step)); })) step = (vals[len - 1] - vals[len - 2]);
      for (k = 1; k <= n; k++) out.push({ v: dir > 0 ? vals[len - 1] + step * k : vals[0] - step * k }); return out;
    }
    if (date && len === 1) { for (k = 1; k <= n; k++) out.push({ v: vals[0] + dir * k }); return out; }
    if (len === 1 && typeof vals[0] === 'string') {
      var m = /^(.*?)(\d+)$/.exec(vals[0]);
      if (m) { for (k = 1; k <= n; k++) { var num = +m[2] + dir * k; out.push({ v: m[1] + (num < 0 ? 0 : String(num).padStart(m[2].length, '0')) }); } return out; }
    }
    for (i = 0; i < LISTS.length; i++) {
      var L = LISTS[i], at = vals.map(function (v) { return typeof v === 'string' ? L.indexOf(v.toLowerCase()) : -1; });
      if (at.every(function (x) { return x >= 0; })) {
        var st = len > 1 ? ((at[len - 1] - at[0] + L.length) % L.length) / (len - 1) || 1 : 1;
        for (k = 1; k <= n; k++) { var idx = dir > 0 ? at[len - 1] + st * k : at[0] - st * k; out.push({ v: cased(vals[0], L[((Math.round(idx) % L.length) + L.length) % L.length]) }); } return out;
      }
    }
    for (k = 0; k < n; k++) { var j = dir > 0 ? k % len : ((len - 1 - (k % len)) + len) % len; out.push({ v: vals[j], idx: j }); }
    return out;
  }

  // fill the cells in `to` from the selection `from` along the axis ('v' vertical, 'h' horizontal)
  F.apply = function (from, to, axis) {
    var sh = G.geo.sh, r, c, lines = axis === 'v' ? from.c2 - from.c1 + 1 : from.r2 - from.r1 + 1, j;
    var before = axis === 'v' ? from.r1 - to.r1 : from.c1 - to.c1, after = axis === 'v' ? to.r2 - from.r2 : to.c2 - from.c2;
    Wb.batch(function () {
      for (j = 0; j < lines; j++) {
        var src = [], len = axis === 'v' ? from.r2 - from.r1 + 1 : from.c2 - from.c1 + 1, i;
        for (i = 0; i < len; i++) {
          var rr = axis === 'v' ? from.r1 + i : from.r1 + j, cc = axis === 'v' ? from.c1 + j : from.c1 + i, cell = sh.cells[SheetSvc.ref(rr, cc)];
          src.push({ v: cell ? (cell.f ? Calc.value(sh, rr, cc) : cell.v) : null, f: cell && cell.f || '', st: Wb.style(sh, rr, cc), r: rr, c: cc });
        }
        [[after, 1], [before, -1]].forEach(function (pair) {
          var n = pair[0], dir = pair[1]; if (n <= 0) return;
          var gen = series(src, n, dir), k;
          for (k = 0; k < n; k++) {
            var off = (k + 1) * dir, tr = axis === 'v' ? (dir > 0 ? from.r2 + k + 1 : from.r1 - k - 1) : from.r1 + j, tc = axis === 'v' ? from.c1 + j : (dir > 0 ? from.c2 + k + 1 : from.c1 - k - 1), g = gen[k], s0;
            if (g.f !== undefined) { s0 = src[g.idx]; Wb.setCell(sh, tr, tc, null, shift(g.f, tr - s0.r, tc - s0.c)); }
            else { s0 = src[g.idx !== undefined ? g.idx : (dir > 0 ? len - 1 : 0)]; Wb.setCell(sh, tr, tc, g.v === undefined ? null : g.v, ''); }
            Wb.setStyle(sh, { r1: tr, c1: tc, r2: tr, c2: tc }, Object.assign({}, s0.st));
          }
        });
      }
    });
    G.select(Math.min(from.r1, to.r1), Math.min(from.c1, to.c1), Math.max(from.r2, to.r2), Math.max(from.c2, to.c2)); G.changed();
  };

  // ---- the keys ---------------------------------------------------------------------------------------------------------------------
  F.down = function () { var s = G.sel; if (s.r2 === s.r1) { if (s.r1 === 0) return; F.apply({ r1: s.r1 - 1, c1: s.c1, r2: s.r1 - 1, c2: s.c2 }, { r1: s.r1 - 1, c1: s.c1, r2: s.r1, c2: s.c2 }, 'v'); G.select(s.r1, s.c1, s.r1, s.c2); } else F.apply({ r1: s.r1, c1: s.c1, r2: s.r1, c2: s.c2 }, s, 'v'); };
  F.right = function () { var s = G.sel; if (s.c2 === s.c1) { if (s.c1 === 0) return; F.apply({ r1: s.r1, c1: s.c1 - 1, r2: s.r2, c2: s.c1 - 1 }, { r1: s.r1, c1: s.c1 - 1, r2: s.r2, c2: s.c1 }, 'h'); G.select(s.r1, s.c1, s.r2, s.c1); } else F.apply({ r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c1 }, s, 'h'); };
  // double click on the square: down as far as the column next to it has data
  F.auto = function () {
    var s = G.sel, sh = G.geo.sh, c = s.c1 > 0 ? s.c1 - 1 : s.c2 + 1, r = s.r2; function full(rr) { var v = Calc.value(sh, rr, c); return v !== null && v !== undefined && v !== ''; }
    if (!full(r + 1)) { c = s.c2 + 1; if (!full(r + 1)) return; }
    while (full(r + 1) && r < sh.rows + 1) r++;
    if (r > s.r2) F.apply(s, { r1: s.r1, c1: s.c1, r2: r, c2: s.c2 }, 'v');
  };

  // ---- the drag ---------------------------------------------------------------------------------------------------------------------
  function preview(to) {
    var g = G.geo, host = $('gHost'), q = G.rect(Math.max(to.r1, g.fy), to.c1, to.r2, to.c2);
    if (!ghost) { ghost = document.createElement('div'); ghost.className = 'gfill'; }
    if (ghost.parentNode !== host) host.appendChild(ghost);
    ghost.style.cssText = 'left:' + q.x + 'px;top:' + (q.y - g.tops[g.fy]) + 'px;width:' + q.w + 'px;height:' + q.h + 'px';
  }
  function stop() { clearInterval(timer); timer = 0; }
  F.begin = function (e) {
    var from = Object.assign({}, G.sel), h = e.target; e.preventDefault(); e.stopPropagation(); G.fillDrag = true;
    h.setPointerCapture(e.pointerId); Motion.drag = true; var to = Object.assign({}, from), axis = 'v', sc = $('gScroll');
    drag = { ev: e };
    function at(ev) { return Mouse.at(ev); }
    function move(ev) {
      drag.ev = ev; var p = at(ev); if (!p) return; var dr = p.r > from.r2 ? p.r - from.r2 : p.r < from.r1 ? p.r - from.r1 : 0, dc = p.c > from.c2 ? p.c - from.c2 : p.c < from.c1 ? p.c - from.c1 : 0;
      axis = Math.abs(dr) * 1 >= Math.abs(dc) ? 'v' : 'h'; to = Object.assign({}, from);
      if (axis === 'v') { if (dr > 0) to.r2 = p.r; else if (dr < 0) to.r1 = p.r; } else { if (dc > 0) to.c2 = p.c; else if (dc < 0) to.c1 = p.c; }
      preview(to); stop(); var box = sc.getBoundingClientRect(), dy = ev.clientY > box.bottom - 24 ? 22 : ev.clientY < box.top + 24 ? -22 : 0, dx = ev.clientX > box.right - 24 ? 22 : ev.clientX < box.left + 24 ? -22 : 0;
      if (dx || dy) timer = setInterval(function () { sc.scrollTop += dy; sc.scrollLeft += dx; move(drag.ev); }, 50);
    }
    function up() {
      stop(); h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); Motion.drag = false; G.fillDrag = false; G.noTap = Date.now() + 350;
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      var grew = to.r1 !== from.r1 || to.r2 !== from.r2 || to.c1 !== from.c1 || to.c2 !== from.c2; if (grew && !Wb.readOnly) F.apply(from, to, axis); else G.paint(true);
    }
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  };
})();
