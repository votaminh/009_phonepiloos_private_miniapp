// DocRich — what the engine's flat blocks leave out, read straight from the .docx: cell colours, merged cells and cell text formats of tables, pictures set inside a line of text, and charts.
// A table keeps one <td> per w:tc (cells merged downward stay as hidden <td>), so the editor can still send the edited cells back by position.
(function () {
  'use strict';
  var esc = function (s) { return Ui.esc(s); };
  function kids(el, n) { var o = []; for (var c = el && el.firstElementChild; c; c = c.nextElementSibling) if (!n || c.localName === n) o.push(c); return o; }
  function kid(el, n) { return kids(el, n)[0] || null; }
  function all(el, n) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)) : []; }
  function wv(el, n) { var k = el && kid(el, n); return k ? (k.getAttribute('w:val') || k.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val')) : null; }
  function on(el, n) { var k = el && kid(el, n); return !!k && !/^(0|false|off)$/.test(k.getAttribute('w:val') || ''); }
  var JC = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };

  // one run: its text and a few formats as inline style
  function runHtml(r) {
    var pr = kid(r, 'rPr'), txt = '';
    kids(r).forEach(function (c) { if (c.localName === 't') txt += c.textContent; else if (c.localName === 'tab') txt += '    '; else if (c.localName === 'br' || c.localName === 'cr') txt += '\n'; });
    if (!txt) return '';
    var h = esc(txt).replace(/\n/g, '<br>'), st = '', col = wv(pr, 'color'), sz = wv(pr, 'sz'), u = wv(pr, 'u');
    if (on(pr, 'b')) h = '<b>' + h + '</b>'; if (on(pr, 'i')) h = '<i>' + h + '</i>';
    if (u && u !== 'none') st += 'text-decoration:underline;'; if (on(pr, 'strike')) st += 'text-decoration:line-through;';
    if (col && /^[0-9a-f]{6}$/i.test(col)) st += 'color:#' + col + ';'; if (sz && +sz !== 22 && +sz !== 20) st += 'font-size:' + (+sz / 2) + 'pt;';
    var hl = wv(pr, 'highlight'); if (hl && hl !== 'none') st += 'background-color:' + hl + ';';
    return st ? '<span style="' + st + '">' + h + '</span>' : h;
  }
  function runsOf(p) {
    var out = ''; kids(p).forEach(function (c) { if (c.localName === 'r') out += runHtml(c); else if (c.localName === 'hyperlink') kids(c, 'r').forEach(function (r) { out += runHtml(r); }); });
    return out;
  }

  // ---- tables --------------------------------------------------------------------------------------------------------------------
  function tableHtml(tbl, b) {
    var rows = kids(tbl, 'tr').map(function (tr) {
      var col = 0; return kids(tr, 'tc').map(function (tc) {
        var pr = kid(tc, 'tcPr'), span = +(wv(pr, 'gridSpan') || 1), vm = pr && kid(pr, 'vMerge'), cell = { span: span, at: col, vm: vm ? (wv(pr, 'vMerge') === 'restart' ? 'restart' : 'cont') : null, rows: 1 };
        var shd = pr && kid(pr, 'shd'), fill = shd && (shd.getAttribute('w:fill') || shd.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'fill')); cell.fill = fill && /^[0-9a-f]{6}$/i.test(fill) ? fill : null;
        cell.va = wv(pr, 'vAlign'); cell.ps = kids(tc, 'p').map(function (p) { return { html: runsOf(p), jc: JC[wv(kid(p, 'pPr'), 'jc')] || '' }; }); col += span; return cell;
      });
    });
    rows.forEach(function (r, ri) { r.forEach(function (c) { if (c.vm !== 'restart') return; for (var k = ri + 1; k < rows.length; k++) { var n = rows[k].filter(function (x) { return x.at === c.at && x.vm === 'cont'; })[0]; if (!n) break; c.rows++; } }); });
    var center = wv(kid(tbl, 'tblPr'), 'jc') === 'center';
    return '<div class="b lk tbl" data-t="x" data-src="' + b.idx + '"' + (b.simple ? ' data-simple="1"' : '') + '><table' + (center ? ' style="margin:0 auto"' : '') + '>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c) {
        if (c.vm === 'cont') return '<td class="vm" hidden></td>';
        var st = (c.fill ? 'background-color:#' + c.fill + ';' : '') + (c.va === 'center' ? 'vertical-align:middle;' : c.va === 'bottom' ? 'vertical-align:bottom;' : '');
        var al = c.ps[0] && c.ps[0].jc ? 'text-align:' + c.ps[0].jc + ';' : '', text = c.ps.map(function (p) { return p.html; }).join('\n');
        return '<td' + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rows > 1 ? ' rowspan="' + c.rows + '"' : '') + ' style="' + st + al + '">' + (text || '<br data-ph>') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</table></div>';
  }

  // ---- paragraphs that hold a picture or a chart ---------------------------------------------------------------------
  async function partsHtml(p, ctx, b) {
    var out = '', i;
    var runs = []; kids(p).forEach(function (c) { if (c.localName === 'r') runs.push(c); else if (c.localName === 'hyperlink') kids(c, 'r').forEach(function (r) { runs.push(r); }); });
    for (i = 0; i < runs.length; i++) {
      var r = runs[i], dr = all(r, 'drawing')[0];
      if (!dr) { out += runHtml(r); continue; }
      var ext = all(dr, 'extent')[0], w = ext ? Math.round(+ext.getAttribute('cx') / 9525) : 0, h = ext ? Math.round(+ext.getAttribute('cy') / 9525) : 0;
      var blip = all(dr, 'blip')[0], ch = all(dr, 'chart')[0];
      if (blip) { var url = await ctx.media(blip.getAttribute('r:embed')); if (url) out += '<img src="' + url + '" style="width:' + w + 'px;max-width:100%;height:auto;vertical-align:middle" alt="">'; }
      else if (ch) { var cx = await ctx.chart(ch.getAttribute('r:id')); out += cx ? '<div class="chart" style="max-width:' + (w || 480) + 'px;margin:0 auto">' + cx + '</div>' : '<span class="pt">Chart</span>'; }
    }
    var jc = JC[wv(kid(p, 'pPr'), 'jc')] || '';
    return '<div class="b lk dr" data-t="x" data-src="' + b.idx + '"' + (jc ? ' style="text-align:' + jc + '"' : '') + '>' + out + '</div>';
  }

  // ---- paragraphs with a formula (an OLE object whose picture is a WMF/EMF): the text and, in its place, the picture; the picture is made when it comes into view (Mf)
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function objectHtml(p, ctx, b) {
    var runs = []; kids(p).forEach(function (c) { if (c.localName === 'r') runs.push(c); else if (c.localName === 'hyperlink') kids(c, 'r').forEach(function (r) { runs.push(r); }); });
    var out = '', any = false;
    runs.forEach(function (r) {
      var obj = all(r, 'object')[0]; if (!obj) { out += runHtml(r); return; }
      var shape = all(obj, 'shape')[0], st = (shape && shape.getAttribute('style')) || '', im = all(obj, 'imagedata')[0], id = im && (im.getAttribute('r:id') || im.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')), part = id && ctx.part(id);
      var wm = /(?:^|;)\s*width:\s*([\d.]+)pt/.exec(st), hm = /(?:^|;)\s*height:\s*([\d.]+)pt/.exec(st);
      var w = wm ? +wm[1] * 4 / 3 : (+obj.getAttribute('w:dxaOrig') || 0) / 15, h = hm ? +hm[1] * 4 / 3 : (+obj.getAttribute('w:dyaOrig') || 0) / 15;
      if (!part || !/\.(wmf|emf)$/i.test(part) || !w || !h) { out += '<span class="pt">' + esc(b.label || 'Object') + '</span>'; return; }
      any = true; out += '<img class="mf" data-mf="' + esc(part) + '" src="' + BLANK + '" style="width:' + Math.round(w * 10) / 10 + 'px;height:' + Math.round(h * 10) / 10 + 'px" alt="">';
    });
    if (!any) return '';
    var jc = JC[wv(kid(p, 'pPr'), 'jc')] || '';
    return '<p class="b lk obj" data-t="x" data-src="' + b.idx + '"' + (jc ? ' style="text-align:' + jc + '"' : '') + '>' + (out || '<br>') + '</p>';
  }

  window.DocRich = {
    run: runHtml, doc: null,
    // look into the file once and keep, on each block that needs it, the page HTML (b.rich); anything unexpected leaves the block as the engine described it
    load: async function (buf, blocks) {
      try {
        var z = Zipx.open(buf); DocRich.z = z; var xml = await z.text('word/document.xml'); if (!xml) return;
        var doc = new DOMParser().parseFromString(xml, 'application/xml'), body = all(doc, 'body')[0], items = kids(body);
        var relx = await z.text('word/_rels/document.xml.rels'), rels = {};
        if (relx) all(new DOMParser().parseFromString(relx, 'application/xml'), 'Relationship').forEach(function (r) { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
        var mimes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' }, cache = {};
        var ctx = {
          media: async function (id) { var t = rels[id]; if (!t) return ''; var n = 'word/' + t.replace(/^\//, '').replace(/^word\//, ''); if (cache[n]) return cache[n]; var bytes = await z.bytes(n); if (!bytes) return ''; var ext = (n.split('.').pop() || '').toLowerCase(); return (cache[n] = URL.createObjectURL(new Blob([bytes], { type: mimes[ext] || 'image/png' }))); },
          part: function (id) { var t = rels[id]; return t ? 'word/' + t.replace(/^\//, '').replace(/^word\//, '') : ''; },
          chart: async function (id) { var t = rels[id]; if (!t) return ''; var cx = await z.text('word/' + t.replace(/^\//, '').replace(/^word\//, '')); return cx ? ChartSvg.svg(cx) : ''; }
        };
        DocRich.doc = null; try { DocRich.doc = await DocSect.read(z, items, body, function (id) { var t = rels[id]; return t ? 'word/' + t.replace(/^\//, '').replace(/^word\//, '') : ''; }); } catch (e) { /* page view falls back to A4 */ }
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i], el = items[b.idx]; if (!el) continue;
          if (el.localName === 'p') { var ppr = kid(el, 'pPr'); b.pb = ppr && kid(ppr, 'pageBreakBefore') ? 'b' : all(el, 'br').some(function (x) { return x.getAttribute('w:type') === 'page'; }) ? 'a' : ''; }
          if (b.type === 'table' && el.localName === 'tbl') b.rich = tableHtml(el, b);
          else if (el.localName === 'p' && b.type !== 'image' && all(el, 'drawing').length) b.rich = await partsHtml(el, ctx, b);
          else if (el.localName === 'p' && b.type !== 'image' && all(el, 'object').length) b.rich = objectHtml(el, ctx, b) || undefined;
        }
      } catch (e) { /* the page falls back to what the engine gave */ }
    }
  };
})();
