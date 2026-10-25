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
    return '<span' + at + '>' + h + '</span>';
  }
  function attrs(b, t) {
    var a = (b.pb ? ' data-pb="' + b.pb + '"' : '') + ' data-t="' + t + '"' + (b.idx !== undefined ? ' data-src="' + b.idx + '"' : '') + (b.align ? ' data-al="' + b.align + '"' : '') + (b.indent ? ' data-in="' + b.indent + '" style="margin-left:' + Math.round(b.indent / 15) + 'px"' : '');
    return a;
  }
  var Render = window.Render = {
    // the closest font this phone has for a Word font name (Android has Roboto, Noto Serif and a monospace)
    family: function (name) {
      var n = String(name || '').toLowerCase();
      if (/times|georgia|cambria|garamond|palatino|book|serif(?!.*sans)|minion/.test(n)) return "'Noto Serif',serif";
      if (/courier|consolas|mono|lucida console/.test(n)) return "'Roboto Mono',monospace";
      return "'Roboto',sans-serif";
    },
    imgUrl: imgUrl,
    block: function (b) {
      if (b.hidden) return '';
      if (b.rich) return b.rich;
      // a section break or the page settings of the last section: kept in the file, nothing to read on a phone (the break shows as a thin rule)
      if (b.type === 'passthrough' && /^Section properties/.test(b.label || '')) return '<div class="b lk" hidden data-t="x" data-src="' + b.idx + '"></div>';
      if (b.type === 'passthrough' && /^Section break/.test(b.label || '')) return '<div class="b lk sb" data-t="x" data-src="' + b.idx + '"></div>';
      var cls = b.edit ? 'b ed' : 'b lk';
      if (b.type === 'heading') { var n = Math.min(b.level || 1, 3); return '<h' + n + ' class="' + cls + '"' + attrs(b, 'h') + ' data-lv="' + n + '">' + (b.runs || []).map(run).join('') + '</h' + n + '>'; }
      if (b.type === 'listItem') return '<p class="' + cls + ' li ' + (b.list && b.list.kind === 'ordered' ? 'ord' : 'bul') + '"' + attrs(b, 'l') + ' data-k="' + (b.list && b.list.kind || 'bullet') + '" data-il="' + (b.list && b.list.ilvl || 0) + '">' + ((b.runs || []).map(run).join('') || '<br data-ph>') + '</p>';
      if (b.type === 'paragraph') return '<p class="' + cls + '"' + attrs(b, 'p') + '>' + ((b.runs || []).map(run).join('') || '<br data-ph>') + '</p>';
      if (b.type === 'table') return '<div class="b lk tbl" data-t="x" data-src="' + b.idx + '"' + (b.simple ? ' data-simple="1"' : '') + '><table>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (esc(c) || '<br data-ph>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
      if (b.type === 'image') return '<p class="b lk imgp" data-t="x" data-src="' + b.idx + '"><img src="' + imgUrl(b.img) + '" width="' + (b.w || 96) + '" height="' + (b.h || 96) + '" alt=""></p>';
      if (b.latex || b.label === 'Equation') return '<div class="b lk eq" data-t="x" data-src="' + b.idx + '">' + esc(b.latex || b.preview) + '</div>';
      return '<div class="b lk pt" data-t="x" data-src="' + b.idx + '">' + esc(b.label || b.type) + (b.preview ? ': ' + esc(b.preview) : '') + '</div>';
    },
    all: function (blocks) { return blocks.map(Render.block).join(''); }
  };
})();
