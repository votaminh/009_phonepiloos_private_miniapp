// DocSect — the page setup of a .docx: the size, margins and columns of each section, its header and footer, and the base text size and spacing. Page view lays the pages out from this.
(function () {
  'use strict';
  var esc = function (s) { return Ui.esc(s); };
  function kids(el, n) { var o = []; for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (!n || c.localName === n) o.push(c); return o; }
  function kid(el, n) { return kids(el, n)[0] || null; }
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function num(el, a, d) { var v = el && el.getAttribute('w:' + a); return v === null || v === undefined || v === '' ? d : +v; }
  function xml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  var JC = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'justify' };

  // the text of a header or footer: runs as in the page, the page number fields left as {PAGE} and {NUMPAGES}
  function hfHtml(doc) {
    return kids(doc.documentElement, 'p').map(function (p) {
      var out = '', skip = false, instr = '', inField = false, jc = kid(kid(p, 'pPr'), 'jc');
      function token() { var s = instr.replace(/\s+/g, ' ').trim(); return /NUMPAGES/.test(s) ? '{NUMPAGES}' : /^PAGE/.test(s) ? '{PAGE}' : ''; }
      all(p, 'r').forEach(function (r) {
        var fc = kid(r, 'fldChar'), it = kid(r, 'instrText');
        if (fc) { var ty = fc.getAttribute('w:fldCharType'); if (ty === 'begin') { inField = true; instr = ''; skip = false; } else if (ty === 'separate') skip = true; else if (ty === 'end') { out += token(); inField = false; skip = false; instr = ''; } return; }
        if (it) { instr += it.textContent; return; }
        if (!skip && !inField) out += DocRich.run(r); else if (!skip) out += '';
      });
      all(p, 'fldSimple').forEach(function (f) { instr = f.getAttribute('w:instr') || ''; out += token(); });
      return '<p class="hf-p"' + (jc && JC[jc.getAttribute('w:val')] ? ' style="text-align:' + JC[jc.getAttribute('w:val')] + '"' : '') + '>' + (out || '<br>') + '</p>';
    }).join('');
  }

  window.DocSect = {
    // the body's children are the items; relOf(id) gives the part path of a header or footer
    read: async function (z, items, body, relOf) {
      var out = { sects: [], base: { pt: 11, after: 8, line: 1.1 } }, i;
      var sx = await z.text('word/styles.xml');
      if (sx) {
        var sd = xml(sx), dd = kid(sd.documentElement, 'docDefaults'), rp = dd && kid(kid(dd, 'rPrDefault'), 'rPr'), pp = dd && kid(kid(dd, 'pPrDefault'), 'pPr'), sz = rp && kid(rp, 'sz'), sp = pp && kid(pp, 'spacing');
        var nm = all(sd, 'style').filter(function (s) { return s.getAttribute('w:styleId') === 'Normal'; })[0], nsz = nm && kid(kid(nm, 'rPr'), 'sz'), nsp = nm && kid(kid(nm, 'pPr'), 'spacing');
        var h = nsz || sz, s2 = nsp || sp; if (h) out.base.pt = +h.getAttribute('w:val') / 2;
        if (s2) { var a = num(s2, 'after', null), l = num(s2, 'line', null); if (a !== null) out.base.after = a / 20; if (l !== null) out.base.line = l / 240; }
        else if (sp) { /* defaults without a Normal override */ }
      }
      async function part(ref) { if (!ref) return ''; var p = relOf(ref.getAttribute('r:id')); if (!p) return ''; var t = await z.text(p); return t ? hfHtml(xml(t)) : ''; }
      async function sect(sp, end) {
        var sz = kid(sp, 'pgSz'), mg = kid(sp, 'pgMar'), co = kids(sp, 'cols').pop(), o = {
          end: end, w: num(sz, 'w', 11906), h: num(sz, 'h', 16838), t: num(mg, 'top', 1440), r: num(mg, 'right', 1440), b: num(mg, 'bottom', 1440), l: num(mg, 'left', 1440), hd: num(mg, 'header', 720), ft: num(mg, 'footer', 720),
          cols: num(co, 'num', 1), space: num(co, 'space', 720), title: !!kid(sp, 'titlePg'), hdr: {}, ftr: {}
        };
        if (sz && sz.getAttribute('w:orient') === 'landscape' && o.w < o.h) { var q = o.w; o.w = o.h; o.h = q; }
        var refs = kids(sp, 'headerReference'), fr = kids(sp, 'footerReference'), k;
        for (k = 0; k < refs.length; k++) o.hdr[refs[k].getAttribute('w:type') || 'default'] = await part(refs[k]);
        for (k = 0; k < fr.length; k++) o.ftr[fr[k].getAttribute('w:type') || 'default'] = await part(fr[k]);
        return o;
      }
      for (i = 0; i < items.length; i++) {
        var pr = items[i].localName === 'p' ? kid(items[i], 'pPr') : null, sp = pr && kid(pr, 'sectPr');
        if (sp) out.sects.push(await sect(sp, i));
      }
      var last = kid(body, 'sectPr'); out.sects.push(await sect(last, Infinity));
      // a section that names no header or footer carries the one before it
      out.sects.forEach(function (s, k) { if (k) ['hdr', 'ftr'].forEach(function (w) { ['default', 'first'].forEach(function (ty) { if (s[w][ty] === undefined && out.sects[k - 1][w][ty] !== undefined) s[w][ty] = out.sects[k - 1][w][ty]; }); }); });
      return out;
    }
  };
})();
