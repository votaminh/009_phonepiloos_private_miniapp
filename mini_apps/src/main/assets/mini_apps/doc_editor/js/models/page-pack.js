// PagePack — pages of a document that has a CONTINUOUS section (a section that starts right below the one before it, on the same page, maybe with another number of columns).
// The reading view normally lets CSS columns break the lines; that cannot put two different column layouts on one page. Here the blocks are measured one by one in a column of the right width and
// placed by hand: column after column, page after page. A block that is taller than what is left goes to the next column (a block taller than a whole column is cut into slices), and the columns of a section
// that a continuous break follows are balanced, as Word does. Each page is { s, d, j, base, bands: [{ s, d, y, h, cols: [[{ html, dy, clip }]] }] }.
(function () {
  'use strict';
  var P = window.PagePack = {}, LINE = 24;
  function srcOf(html) { var m = /data-src="(\d+)"/.exec(html); return m ? m[1] : null; }
  // the room each block takes in a column of width colW (its margins included): the distance to the next block's top
  function measure(blocks, s, d, colW, base, meas, flowStyle) {
    var box = document.createElement('div'); box.className = 'pgx-flow'; box.style.cssText = flowStyle(s, d, base) + ';column-count:1;column-gap:0;width:' + colW + 'px;height:auto'; box.innerHTML = blocks.join(''); meas.appendChild(box);
    var kids = Array.prototype.slice.call(box.children), top = kids.map(function (k) { return k.offsetTop; }), total = box.scrollHeight;
    var h = kids.map(function (k, i) { return Math.max(1, (i + 1 < kids.length ? top[i + 1] : total) - top[i]); }); meas.removeChild(box); return h;
  }
  // fill ncols columns of height cap from block i (offset off inside it); returns the columns and where it stopped
  function fill(blocks, hts, i, off, ncols, cap) {
    var cols = [], n = blocks.length;
    for (var c = 0; c < ncols && i < n; c++) {
      var col = [], room = cap;
      while (i < n) {
        var rem = hts[i] - off;
        if (rem <= room) { col.push({ html: blocks[i], dy: off, clip: rem }); room -= rem; i++; off = 0; }
        else if (col.length === 0 || off > 0) { var take = Math.floor(Math.max(1, room)); col.push({ html: blocks[i], dy: off, clip: take }); off += take; room = 0; break; }
        else break;
      }
      col.used = cap - room; cols.push(col);
    }
    return { cols: cols, i: i, off: off, h: Math.max.apply(null, cols.map(function (c) { return c.used; }).concat([0])) };
  }
  P.layout = function (ss, g, base, meas, dims, flowStyle) {
    var pages = [], cur = null, map = {}, minR = LINE * 2;
    function sameSize(a, b) { return Math.abs(a.w - b.w) < 2 && Math.abs(a.h - b.h) < 2; }
    function newPage(s, d, again) { cur = { s: s, d: d, j: again && cur && cur.s === s ? cur.j + 1 : 0, n: 1, base: base, bands: [], used: 0 }; pages.push(cur); }
    ss.forEach(function (s, k) {
      var d = dims(s), blocks = g[k] || []; if (!blocks.length) { if (!cur || !(k > 0 && s.kind === 'continuous')) newPage(s, d); return; }
      if (!(k > 0 && s.kind === 'continuous' && cur && sameSize(cur.d, d))) newPage(s, d);
      var ncols = Math.max(1, s.cols || 1), gap = ncols > 1 ? s.space * PX() : 0, colW = (d.cw - gap * (ncols - 1)) / ncols, hts = measure(blocks, s, d, colW, base, meas, flowStyle);
      var nextCont = !!(ss[k + 1] && ss[k + 1].kind === 'continuous'), i = 0, off = 0, first = true;
      while (i < blocks.length) {
        var R = d.ch - cur.used; if (R < minR && cur.bands.length) { newPage(s, d, true); R = d.ch; }
        var r = fill(blocks, hts, i, off, ncols, R), done = r.i >= blocks.length, h = R;
        if (done) {
          h = r.h;
          if (nextCont && ncols > 1 && first) {   // the columns above a continuous break are balanced: the shortest height that still holds everything
            var total = 0; r.cols.forEach(function (c) { total += c.used; });
            for (var cap = Math.max(LINE, Math.ceil(total / ncols)); cap <= R; cap += 4) { var b = fill(blocks, hts, i, off, ncols, cap); if (b.i >= blocks.length) { r = b; h = b.h; break; } }
          }
        }
        r.cols.forEach(function (c) { c.forEach(function (sl) { var sr = srcOf(sl.html); if (sr !== null && map[sr] === undefined) map[sr] = pages.length - 1; }); });
        cur.bands.push({ s: s, d: d, y: cur.used, h: Math.ceil(h), cols: r.cols, colW: colW, gap: gap }); cur.used += Math.ceil(h);
        i = r.i; off = r.off; first = false; if (!done) cur.used = d.ch;
      }
    });
    return { defs: pages, map: map };
  };
  function PX() { return 1 / 15; }
  // the HTML of the bands of one page (inside the page's own box): every column is a stack of slices
  P.html = function (p, flowStyle) {
    return p.bands.map(function (b) {
      var st = flowStyle(b.s, b.d, p.base) + ';column-count:1;column-gap:0;width:' + b.colW + 'px;height:' + b.h + 'px';
      return '<div class="pgx-band" style="left:' + b.d.l + 'px;top:' + (b.d.t + b.y) + 'px;width:' + b.d.cw + 'px;height:' + b.h + 'px">' + b.cols.map(function (c, ci) {
        return '<div class="pgx-flow pgx-col" style="' + st + ';left:' + ci * (b.colW + b.gap) + 'px">' + c.map(function (sl) { return '<div class="pgx-sl" style="height:' + sl.clip + 'px"><div style="margin-top:-' + sl.dy + 'px">' + sl.html + '</div></div>'; }).join('') + '</div>';
      }).join('') + '</div>';
    }).join('');
  };
})();
