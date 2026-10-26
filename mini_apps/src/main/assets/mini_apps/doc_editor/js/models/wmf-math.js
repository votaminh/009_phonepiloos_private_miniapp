// WmfMath — draws the picture of a MathType formula (a small WMF: text in MathType's own fonts, a few lines and rectangles) as SVG. The engine's WMF converter puts the text at the wrong place
// (these files set "text goes at the current position"), and the fonts of MathType (Euclid, Euclid Symbol) are not on a phone, so letters are drawn with a serif font and Symbol codes are turned into Unicode.
(function () {
  'use strict';
  // the Symbol font: code -> character (the codes a formula uses)
  var SYM = {}; (function () {
    var t = '20 21 2200 23 2203 25 26 220B 28 29 2217 2B 2C 2212 2E 2F 30 31 32 33 34 35 36 37 38 39 3A 3B 3C 3D 3E 3F 2245 391 392 3A7 394 395 3A6 393 397 399 3D1 39A 39B 39C 39D 39F 3A0 398 3A1 3A3 3A4 3A5 3C2 3A9 39E 3A8 396 5B 2234 5D 22A5 5F 203E 3B1 3B2 3C7 3B4 3B5 3C6 3B3 3B7 3B9 3D5 3BA 3BB 3BC 3BD 3BF 3C0 3B8 3C1 3C3 3C4 3C5 3D6 3C9 3BE 3C8 3B6 7B 7C 7D 223C'.split(' ');
    t.forEach(function (h, i) { SYM[0x20 + i] = String.fromCharCode(parseInt(h, 16)); });
    var hi = 'A0:20AC A1:3D2 A2:2032 A3:2264 A4:2044 A5:221E A6:192 A7:2663 A8:2666 A9:2665 AA:2660 AB:2194 AC:2190 AD:2191 AE:2192 AF:2193 B0:B0 B1:B1 B2:2033 B3:2265 B4:D7 B5:221D B6:2202 B7:2022 B8:F7 B9:2260 BA:2261 BB:2248 BC:2026 BD:23D0 BE:23AF BF:21B5 C0:2135 C1:2111 C2:211C C3:2118 C4:2297 C5:2295 C6:2205 C7:2229 C8:222A C9:2283 CA:2287 CB:2284 CC:2282 CD:2286 CE:2208 CF:2209 D0:2220 D1:2207 D2:AE D3:A9 D4:2122 D5:220F D6:221A D7:22C5 D8:AC D9:2227 DA:2228 DB:21D4 DC:21D0 DD:21D1 DE:21D2 DF:21D3 E0:25CA E1:2329 E5:2211 F1:232A F2:222B'.split(' ');
    hi.forEach(function (p) { var kv = p.split(':'); SYM[parseInt(kv[0], 16)] = String.fromCharCode(parseInt(kv[1], 16)); });
  })();
  var EXTRA_MAP = { r: '\u2192', u: '\u2212', '^': '\u02C6', '~': '\u02DC' };   // MathType's extra font: the head and the shaft of a vector arrow, hat, tilde
  var SYMFONT = /symbol$|^mt symbol|euclid symbol/i, EXTRA = /extra/i, SERIF = "'Times New Roman',Times,'Noto Serif',serif";
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function str(v, o, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; }
  var meas = null;
  function width(text, font, size) { if (!meas) meas = document.createElement('canvas').getContext('2d'); meas.font = font + ' ' + size + 'px ' + SERIF; return meas.measureText(text).width; }

  // bytes -> '<svg ...>' or null when this is not a WMF it can read
  window.WmfMath = { svg: function (bytes) {
    try {
      var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), o = 0, l = 0, t = 0, r = 0, b = 0;
      if (v.getUint32(0, true) === 0x9AC6CDD7) { l = v.getInt16(6, true); t = v.getInt16(8, true); r = v.getInt16(10, true); b = v.getInt16(12, true); o = 22; }
      var hs = v.getUint16(o + 2, true) * 2 || 18; o += hs;
      var org = { x: l, y: t }, ext = { x: r - l || 1, y: b - t || 1 }, objs = [], sel = { font: null, pen: null, brush: null }, st = { align: 0, color: '#000', x: 0, y: 0 }, out = '';
      function free() { var i = 0; while (objs[i]) i++; return i; }
      while (o + 6 <= v.byteLength) {
        var sz = v.getUint32(o, true) * 2, fn = v.getUint16(o + 4, true), p = o + 6; if (sz < 6 || o + sz > v.byteLength) break; if (fn === 0) break;
        switch (fn) {
          case 0x020B: org = { y: v.getInt16(p, true), x: v.getInt16(p + 2, true) }; break;
          case 0x020C: ext = { y: v.getInt16(p, true) || 1, x: v.getInt16(p + 2, true) || 1 }; break;
          case 0x012E: st.align = v.getUint16(p, true); break;
          case 0x0209: st.color = 'rgb(' + v.getUint8(p) + ',' + v.getUint8(p + 1) + ',' + v.getUint8(p + 2) + ')'; break;
          case 0x02FB: { var fh = v.getInt16(p, true), face = ''; for (var k = 18; k < 50 && v.getUint8(p + k); k++) face += String.fromCharCode(v.getUint8(p + k)); objs[free()] = { t: 'font', h: Math.abs(fh), w: v.getInt16(p + 8, true), it: v.getUint8(p + 10) !== 0, face: face }; break; }
          case 0x02FA: objs[free()] = { t: 'pen', style: v.getUint16(p, true), w: Math.max(1, v.getInt16(p + 2, true)), c: 'rgb(' + v.getUint8(p + 6) + ',' + v.getUint8(p + 7) + ',' + v.getUint8(p + 8) + ')' }; break;
          case 0x02FC: objs[free()] = { t: 'brush', style: v.getUint16(p, true), c: 'rgb(' + v.getUint8(p + 2) + ',' + v.getUint8(p + 3) + ',' + v.getUint8(p + 4) + ')' }; break;
          case 0x012D: { var ob = objs[v.getUint16(p, true)]; if (ob) sel[ob.t] = ob; break; }
          case 0x01F0: objs[v.getUint16(p, true)] = null; break;
          case 0x0214: st.y = v.getInt16(p, true); st.x = v.getInt16(p + 2, true); break;
          case 0x0213: { var ny = v.getInt16(p, true), nx = v.getInt16(p + 2, true), pn = sel.pen; if (pn && pn.style !== 5) out += '<line x1="' + st.x + '" y1="' + st.y + '" x2="' + nx + '" y2="' + ny + '" stroke="' + pn.c + '" stroke-width="' + pn.w + '"/>'; st.x = nx; st.y = ny; break; }
          case 0x0324: case 0x0325: { var n = v.getInt16(p, true), pts = ''; for (var q = 0; q < n; q++) pts += v.getInt16(p + 2 + q * 4, true) + ',' + v.getInt16(p + 4 + q * 4, true) + ' '; var pn2 = sel.pen, br = sel.brush; out += (fn === 0x0324 ? '<polygon' : '<polyline') + ' points="' + pts + '" fill="' + (fn === 0x0324 && br && br.style !== 1 ? br.c : 'none') + '" stroke="' + (pn2 && pn2.style !== 5 ? pn2.c : 'none') + '" stroke-width="' + (pn2 ? pn2.w : 1) + '"/>'; break; }
          case 0x041B: { var bt = v.getInt16(p, true), rt = v.getInt16(p + 2, true), tp = v.getInt16(p + 4, true), lf = v.getInt16(p + 6, true), br2 = sel.brush, pn3 = sel.pen; out += '<rect x="' + lf + '" y="' + tp + '" width="' + (rt - lf) + '" height="' + (bt - tp) + '" fill="' + (br2 && br2.style !== 1 ? br2.c : 'none') + '" stroke="' + (pn3 && pn3.style !== 5 ? pn3.c : 'none') + '" stroke-width="' + (pn3 ? pn3.w : 1) + '"/>'; break; }
          case 0x0A32: case 0x0521: {
            var x, y, cnt, txt, dx = null, so;
            if (fn === 0x0A32) { y = v.getInt16(p, true); x = v.getInt16(p + 2, true); cnt = v.getUint16(p + 4, true); var opt = v.getUint16(p + 6, true); so = p + 8 + ((opt & 6) ? 8 : 0); txt = str(v, so, cnt); var da = so + cnt + (cnt & 1); if (da + cnt * 2 <= o + sz) { dx = []; for (var d = 0; d < cnt; d++) dx.push(v.getInt16(da + d * 2, true)); } }
            else { cnt = v.getUint16(p, true); so = p + 2; txt = str(v, so, cnt); var ya = so + cnt + (cnt & 1); y = v.getInt16(ya, true); x = v.getInt16(ya + 2, true); }
            var f = sel.font || { h: 16, face: 'Times New Roman', it: false, w: 400 }, sym = SYMFONT.test(f.face), mapped = '';
            for (var c = 0; c < txt.length; c++) { var code = txt.charCodeAt(c); mapped += sym ? (SYM[code] || String.fromCharCode(code)) : EXTRA.test(f.face) ? (EXTRA_MAP[txt[c]] || txt[c]) : txt[c]; }
            if (st.align & 1) { x = st.x; y = st.y; }
            var italic = (f.it || /^euclid$|^mt ?(italic)?$/i.test(f.face)) && !sym && /[A-Za-z]/.test(mapped), size = f.h, anchor = (st.align & 6) === 6 ? 'middle' : (st.align & 2) ? 'end' : 'start', ay = (st.align & 24) === 24 ? y : (st.align & 8) ? y - size * 0.2 : y + size * 0.8;
            var xs = '', cur = x; if (dx && dx.length === mapped.length && mapped.length > 1) { for (var e = 0; e < mapped.length; e++) { xs += cur + ' '; cur += dx[e]; } } else { cur = x + width(mapped, (italic ? 'italic' : 'normal'), size); }
            out += '<text ' + (xs ? 'x="' + xs.trim() + '"' : 'x="' + x + '"') + ' y="' + ay + '" font-size="' + size + '" fill="' + st.color + '"' + (italic ? ' font-style="italic"' : '') + (f.w >= 700 ? ' font-weight="bold"' : '') + (xs ? '' : ' text-anchor="' + anchor + '"') + ' xml:space="preserve" style="font-family:' + SERIF + '">' + esc(mapped) + '</text>';
            if (st.align & 1) { st.x = dx ? cur : x + width(mapped, italic ? 'italic' : 'normal', size); }
            break;
          }
        }
        o += sz;
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + org.x + ' ' + org.y + ' ' + ext.x + ' ' + ext.y + '" width="' + ext.x + '" height="' + ext.y + '">' + out + '</svg>';
    } catch (e) { return null; }
  } };
})();
