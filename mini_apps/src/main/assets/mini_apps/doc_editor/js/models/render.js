// Render — draws the blocks the engine parsed as flat page elements: one element per paragraph, heading, list item, table or picture, in order.
// Editable blocks (class "ed") carry data-src (their index in the original file; none for a new block) and data-t / data-lv / data-k / data-al / data-in, which Plan reads back on save.
(function () {
  'use strict';
  var esc = function (s) { return Ui.esc(s); };
  var HL = { yellow: 'hl_yellow', green: 'hl_green', magenta: 'hl_pink', cyan: 'hl_blue' };   // Word highlight name -> colour name in res/colors.js
  var blob = {};
  // a picture is kept as a small blob address instead of a long data: URL, so history snapshots stay light
  function imgUrl(dataUrl) {
    if (!dataUrl) return '';
    if (blob[dataUrl]) return blob[dataUrl];
    try {
      var m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl), bin = atob(m[2]), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return (blob[dataUrl] = URL.createObjectURL(new Blob([u], { type: m[1] })));
    } catch (e) { return dataUrl; }
  }
  function run(r) {
    if (r.v) return '';
    if (r.fn) return '<sup class="fnref" data-fn="' + esc(r.fn) + '" contenteditable="false">' + esc(r.t) + '</sup>';
    var h = esc(r.t).replace(/\n/g, '<br>'), st = '', at = ' data-r="' + r.k + '"';
    if (r.b) h = '<b>' + h + '</b>';
    if (r.i) h = '<i>' + h + '</i>';
    if (r.va === 'superscript') h = '<sup>' + h + '</sup>'; else if (r.va === 'subscript') h = '<sub>' + h + '</sub>';
    if (r.lk) h = '<a class="lnk" data-href="' + esc(r.lk) + '">' + h + '</a>';
    if (r.u) st += 'text-decoration:underline;';
    if (r.s) st += 'text-decoration:line-through;' + (r.u ? '' : '');
    if (r.c && /^[0-9a-f]{6}$/i.test(r.c)) st += 'color:#' + r.c + ';';
    if (r.sz && r.sz !== 22 && r.sz !== 20) st += 'font-size:' + (r.sz / 2) + 'pt;';
    if (r.h && HL[r.h]) st += 'background-color:' + C(HL[r.h]) + ';';
    if (r.f) at += ' data-f="' + esc(r.f) + '" style="font-family:' + Render.family(r.f) + ';' + st + '"'; else if (st) at += ' style="' + st + '"';
    h = '<span' + at + '>' + h + '</span>';
    return r.cm && r.cm.length ? '<span class="cmr" data-cm="' + esc(r.cm.join(',')) + '">' + h + '</span>' : h;
  }
  function attrs(b, t) {
    var a = (b.bm && b.bm.length ? ' data-bm="' + esc(b.bm.join(',')) + '"' : '') + (b.styleId ? ' data-st="' + esc(b.styleId) + '"' : '') + ' style="' + Render.eff(b, t === 'l') + '"' + (b.eff && b.eff.kn ? ' data-kn="1"' : '') + (b.eff && b.eff.pb ? ' data-pbb="1"' : '') + ' ' + (b.pb ? ' data-pb="' + b.pb + '"' : '') + ' data-t="' + t + '"' + (b.idx !== undefined ? ' data-src="' + b.idx + '"' : '') + (b.align ? ' data-al="' + b.align + '"' : '') + (b.indent ? ' data-in="' + b.indent + '"' : '');
    return a;
  }
  var Render = window.Render = {
    // a picture of the file: how the text goes round it (a class), and its turn / crop (on the <img>)
    // (the text does not really flow round a picture while editing: its blocks stay in a column; the file gets the real wrap, and the picture says which one)
    picCls: function (w) { return w === 'square-left' ? ' wf-l' : w === 'square-right' ? ' wf-r' : ''; },
    shpCls: function (w) { return Render.picCls(w); },
    picWrapName: function (w) { var k = { 'square-left': 'pic.w.sl', 'square-right': 'pic.w.sr', topBottom: 'pic.w.tb', behind: 'pic.w.behind', front: 'pic.w.front' }[w]; return k ? Ui.t(k) : ''; },
    picData: function (b) { return (b.wrap ? ' data-wrap="' + b.wrap + '"' : '') + (Render.picWrapName(b.wrap) ? ' data-wl="' + esc(Render.picWrapName(b.wrap)) + '"' : '') + (b.rot ? ' data-rot="' + b.rot + '"' : '') + (b.crop ? ' data-crop="' + b.crop.join(',') + '"' : ''); },
    picStyle: function (rot, crop, w, h) {
      var s = ''; if (rot) s += 'transform:rotate(' + rot + 'deg);'; // a picture turned on its side takes the room its sides need
      if (rot % 180 === 90 && w && h) s += 'margin:' + Math.round((w - h) / 2) + 'px 0;'; if (crop && crop.some(function (v) { return v > 0; })) s += 'object-view-box:inset(' + crop[1] + '% ' + crop[2] + '% ' + crop[3] + '% ' + crop[0] + '%);object-fit:fill;';
      return s ? ' style="' + s + '"' : '';
    },
    // a formula from the engine as MathML, with anything that could run code taken out (the file is somebody else's)
    math: function (m) { return String(m).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ''); },
    // the closest font this phone has for a Word font name (Android has Roboto, Noto Serif and a monospace)
    // the look-alike of a Word font that this device has (Carlito = Calibri, Arimo = Arial, Tinos = Times New Roman, Gelasio = Georgia, Cousine = Courier New: same letter widths, so the lines break where they do in Word)
    family: function (name) {
      var n = String(name || '').toLowerCase();
      if (/georgia|gelasio/.test(n)) return "'Gelasio','Tinos',serif";
      if (/times|cambria|garamond|palatino|book|minion|serif(?!.*sans)|tinos/.test(n)) return "'Tinos','Times New Roman',serif";
      if (/courier|consolas|mono|lucida console|cousine/.test(n)) return "'Cousine','Courier New',monospace";
      if (/arial|helvetica|verdana|tahoma|arimo|segoe|trebuchet|liberation/.test(n)) return "'Arimo','Arial',sans-serif";
      return "'Carlito','Calibri',sans-serif";
    },
    // what Word's own paragraph properties give a block: space before and after, line height, indents, shading, borders, alignment (a list item keeps its marker's indent)
    eff: function (b, list) { return b.eff ? Render.effCss(b.eff, list) : ''; },
    effCss: function (e, list) {
      var css = '', px = function (v) { return Math.round(v / 15 * 100) / 100 + 'px'; };
      css += 'margin-top:' + px(e.sb || 0) + ';margin-bottom:' + px(e.sa || 0) + ';';
      if (e.ln) { if (e.ln.rule === 'auto') css += 'line-height:' + Math.round(e.ln.raw / 240 * 1.2 * 1000) / 1000 + ';'; else css += 'line-height:' + px(e.ln.raw) + ';'; }
      if (!list) { if (e.il) css += 'margin-left:' + px(e.il) + ';'; if (e.fi) css += 'text-indent:' + px(e.fi) + ';'; }
      if (e.ir) css += 'margin-right:' + px(e.ir) + ';';
      if (e.al && e.al !== 'left') css += 'text-align:' + (e.al === 'justify' || e.al === 'distribute' ? 'justify' : e.al) + ';';
      if (e.sh && e.sh !== 'auto') css += 'background-color:#' + e.sh + ';';
      var bd = e.bd; if (bd) ['t', 'b', 'l', 'r'].forEach(function (k) { var s = bd[k]; if (s && !s.none) { var nm = { t: 'top', b: 'bottom', l: 'left', r: 'right' }[k]; css += 'border-' + nm + ':' + Math.max(1, Math.round((s.szPt || 0.5) * 4 / 3)) + 'px solid ' + (s.color && s.color !== 'auto' ? '#' + s.color : 'currentColor') + ';padding-' + nm + ':' + (s.spacePt || 1) + 'px;'; } });
      return css;
    },
    imgUrl: imgUrl,
    block: function (b) {
      if (b.hidden) return '';
      if (b.shp) return '<div class="b lk shp' + Render.picCls(b.wrap) + ' al-' + esc(b.shp.al || 'left') + '" data-t="x" data-src="' + b.idx + '" data-shp="' + esc(JSON.stringify(Object.assign({}, b.shp, { wrap: b.wrap || 'inline' }))) + '"' + (Render.picWrapName(b.wrap) ? ' data-wl="' + esc(Render.picWrapName(b.wrap)) + '"' : '') + '>' + Shape.html(b.shp) + '</div>';
      if (b.rich) return b.rich;
      // a section break or the page settings of the last section: kept in the file, nothing to read on a phone (the break shows as a thin rule)
      if (b.type === 'passthrough' && /^Section properties/.test(b.label || '')) return '<div class="b lk" hidden data-t="x" data-src="' + b.idx + '"></div>';
      if (b.type === 'passthrough' && /^Section break/.test(b.label || '')) return '<div class="b lk sb" data-t="x" data-src="' + b.idx + '"></div>';
      var cls = b.edit ? 'b ed' : 'b lk';
      if (b.type === 'heading') { var n = Math.min(b.level || 1, 3); return '<h' + n + ' class="' + cls + '"' + attrs(b, 'h') + ' data-lv="' + n + '">' + (b.runs || []).map(run).join('') + '</h' + n + '>'; }
      if (b.type === 'listItem') return '<p class="' + cls + ' li ' + (b.list && b.list.kind === 'ordered' ? 'ord' : 'bul') + '"' + attrs(b, 'l') + (b.list && b.list.numId ? ' data-nid="' + esc(b.list.numId) + '"' : '') + ' data-k="' + (b.list && b.list.kind || 'bullet') + '" data-il="' + (b.list && b.list.ilvl || 0) + '">' + ((b.runs || []).map(run).join('') || '<br data-ph>') + '</p>';
      if (b.type === 'paragraph') return '<p class="' + cls + '"' + attrs(b, 'p') + '>' + ((b.runs || []).map(run).join('') || '<br data-ph>') + '</p>';
      if (b.type === 'table') return '<div class="b lk tbl" data-t="x" data-src="' + b.idx + '"' + (b.simple ? ' data-simple="1"' : '') + '><table>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (esc(c) || '<br data-ph>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
      if (b.type === 'image') return '<p class="b lk imgp' + Render.picCls(b.wrap) + '" data-t="x" data-src="' + b.idx + '"' + Render.picData(b) + '><img src="' + imgUrl(b.img) + '" width="' + (b.w || 96) + '" height="' + (b.h || 96) + '" alt=""' + Render.picStyle(b.rot, b.crop, b.w || 96, b.h || 96) + '></p>';
      if (b.latex || b.label === 'Equation') return '<div class="b lk eq' + (b.eqal ? ' al-' + b.eqal : '') + '" data-t="x" data-src="' + b.idx + '"' + (b.latex ? ' data-latex="' + esc(b.latex) + '"' : '') + '>' + (b.mathml ? Render.math(b.mathml) : esc(b.latex || b.preview)) + '</div>';
      return '<div class="b lk pt" data-t="x" data-src="' + b.idx + '">' + esc(b.label || b.type) + (b.preview ? ': ' + esc(b.preview) : '') + '</div>';
    },
    all: function (blocks) { return blocks.map(Render.block).join(''); }
  };
})();
