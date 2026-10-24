// Plan — reads the page back into the list of blocks the engine saves. An untouched block is {o: index} (copied byte for byte); an edited or new one carries its type, list, alignment and runs.
(function () {
  'use strict';
  function hex(v) {
    var m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(v || '');
    if (m) return [m[1], m[2], m[3]].map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('').toUpperCase();
    m = /^#([0-9a-f]{6})$/i.exec(v || ''); return m ? m[1].toUpperCase() : undefined;
  }
  function halfPoints(v) { var m = /([\d.]+)(pt|px)/.exec(v || ''); return m ? Math.round((m[2] === 'pt' ? +m[1] : +m[1] * 0.75) * 2) : undefined; }
  var HLN = ['hl_yellow:yellow', 'hl_green:green', 'hl_pink:magenta', 'hl_blue:cyan'];
  function hlName(bg) {
    var h = hex(bg); if (!h) return undefined;
    for (var i = 0; i < HLN.length; i++) { var p = HLN[i].split(':'); if (hex(C(p[0])) === h) return p[1]; }
    return 'yellow';
  }
  // the runs of one block: { t, b, i, u, s, c, sz, f, h, va, link, k } — k is the original run the text came from (-1 = typed new). Only formatting written on the element chain counts.
  function extract(el) {
    var out = [];
    function push(t, f) {
      t = t.replace(/ /g, ' '); if (!t) return;
      var r = { t: t, b: !!f.b, i: !!f.i, u: !!f.u, s: !!f.s, c: f.c, sz: f.sz, f: f.f, h: f.h, va: f.va, link: f.link, k: f.k === undefined ? -1 : f.k }, p = out[out.length - 1];
      var same = p && ['b', 'i', 'u', 's', 'c', 'sz', 'f', 'h', 'va', 'link', 'k'].every(function (q) { return p[q] === r[q]; });
      if (same) p.t += t; else out.push(r);
    }
    function walk(n, f) {
      if (n.nodeType === 3) { push(n.nodeValue, f); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName, g = Object.assign({}, f);
      if (tag === 'BR') { if (!n.hasAttribute('data-ph')) push('\n', f); return; }
      if (tag === 'B' || tag === 'STRONG') g.b = true;
      if (tag === 'I' || tag === 'EM') g.i = true;
      if (tag === 'U') g.u = true;
      if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') g.s = true;
      if (tag === 'SUP') g.va = 'superscript'; if (tag === 'SUB') g.va = 'subscript';
      if (tag === 'A' && n.dataset.href) g.link = n.dataset.href;
      if (tag === 'FONT' && n.getAttribute('color')) g.c = hex(n.getAttribute('color')) || g.c;
      var st = n.style;
      if (st) {
        if (st.fontWeight) g.b = st.fontWeight === 'bold' || +st.fontWeight >= 600;
        if (st.fontStyle) g.i = st.fontStyle === 'italic';
        var td = st.textDecorationLine || st.textDecoration || '';
        if (/underline/.test(td)) g.u = true;
        if (/line-through/.test(td)) g.s = true;
        if (st.color) g.c = hex(st.color) || g.c;
        if (st.fontSize) g.sz = halfPoints(st.fontSize) || g.sz;
        if (st.backgroundColor) g.h = hlName(st.backgroundColor) || g.h;
        if (st.verticalAlign === 'super') g.va = 'superscript'; else if (st.verticalAlign === 'sub') g.va = 'subscript';
      }
      if (n.dataset && n.dataset.f) g.f = n.dataset.f;
      if (n.dataset && n.dataset.r !== undefined) g.k = +n.dataset.r;
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c, g);
    }
    walk(el, {});
    if (out.length) out[out.length - 1].t = out[out.length - 1].t.replace(/\n+$/, '');
    return out.filter(function (r) { return r.t !== ''; });
  }
  window.Plan = {
    extract: extract,
    // root: the element that holds the blocks; xmls: { n: '<w:p>…' } for blocks made in this session (table, divider, page break); pics: { n: { buf, mime, w, h } }
    build: function (root, xmls, pics) {
      var blocks = [], images = {};
      Array.prototype.forEach.call(root.children, function (el) {
        if (!el.classList.contains('b')) return;
        var src = el.dataset.src !== undefined ? +el.dataset.src : undefined, n = el.dataset.n;
        if (el.classList.contains('tbl') && el.dataset.m) { var tb = { cells: Table.cells(el) }; if (src !== undefined) tb.o = src; else tb.xml = xmls[n]; if (el.dataset.ops) tb.ops = JSON.parse(el.dataset.ops); blocks.push({ tbl: tb }); return; }
        if (el.classList.contains('lk')) {
          if (src !== undefined) blocks.push({ o: src }); else if (xmls && xmls[n]) blocks.push({ xml: xmls[n] });
          else if (pics && pics[n]) { images[n] = pics[n].buf.slice(0); blocks.push({ img: { ref: n, mime: pics[n].mime, w: pics[n].w, h: pics[n].h, align: pics[n].align } }); }
          return;
        }
        if (src !== undefined && !el.dataset.m) { blocks.push({ o: src }); return; }
        var t = el.dataset.t, g = { type: t === 'h' ? 'heading' : t === 'l' ? 'listItem' : 'paragraph', runs: extract(el) };
        if (t === 'h') g.level = +el.dataset.lv || 1;
        if (t === 'l') g.list = { kind: el.dataset.k || 'bullet', ilvl: +el.dataset.il || 0 };
        g.align = el.dataset.al || 'left'; g.indent = +el.dataset.in || 0;
        var it = { g: g }; if (src !== undefined) it.o = src; blocks.push(it);
      });
      return { blocks: blocks, images: images };
    }
  };
})();
