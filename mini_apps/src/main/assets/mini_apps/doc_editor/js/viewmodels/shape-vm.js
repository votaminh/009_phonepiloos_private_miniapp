// Shape — Insert ▸ Shapes: a rectangle, rounded rectangle, ellipse, line, arrow or text box, with text, fill, outline, size, place and wrap. Double-click one to change it.
// The block on the page is drawn as SVG; the file gets a real Word shape (a wps shape in a drawing). A simple shape of the file is read back the same way (Render uses Shape.html).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, Shape = window.Shape = {}, editing = null, draft = null, nextId = 9100;
  var KINDS = [['textbox', 'shp.textbox'], ['rect', 'shp.rect'], ['round', 'shp.round'], ['ellipse', 'shp.ellipse'], ['line', 'shp.line'], ['arrow', 'shp.arrow'], ['triangle', 'shp.triangle'], ['diamond', 'shp.diamond'], ['pentagon', 'shp.pentagon'], ['hexagon', 'shp.hexagon'], ['star', 'shp.star']];
  var PRST = { textbox: 'rect', rect: 'rect', round: 'roundRect', ellipse: 'ellipse', line: 'line', arrow: 'rightArrow', triangle: 'triangle', diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', star: 'star5', larrow: 'leftArrow', uarrow: 'upArrow', darrow: 'downArrow', parallelogram: 'parallelogram', trapezoid: 'trapezoid', octagon: 'octagon', chevron: 'chevron', plus: 'plus', rtri: 'rtTriangle' };
  // the corners of a polygon kind, as fractions of the box (what Word draws for the same preset)
  var POLY = { larrow: [[0, .5], [.4, 0], [.4, .28], [1, .28], [1, .72], [.4, .72], [.4, 1]], uarrow: [[.5, 0], [1, .4], [.72, .4], [.72, 1], [.28, 1], [.28, .4], [0, .4]], darrow: [[.28, 0], [.72, 0], [.72, .6], [1, .6], [.5, 1], [0, .6], [.28, .6]],
    parallelogram: [[.25, 0], [1, 0], [.75, 1], [0, 1]], trapezoid: [[.2, 0], [.8, 0], [1, 1], [0, 1]], octagon: [[.29, 0], [.71, 0], [1, .29], [1, .71], [.71, 1], [.29, 1], [0, .71], [0, .29]], chevron: [[0, 0], [.7, 0], [1, .5], [.7, 1], [0, 1], [.3, .5]],
    plus: [[.33, 0], [.67, 0], [.67, .33], [1, .33], [1, .67], [.67, .67], [.67, 1], [.33, 1], [.33, .67], [0, .67], [0, .33], [.33, .33]], rtri: [[0, 0], [1, 1], [0, 1]], triangle: [[.5, 0], [1, 1], [0, 1]], diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]], pentagon: [[.5, 0], [1, .38], [.81, 1], [.19, 1], [0, .38]], hexagon: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
    star: [[.5, 0], [.62, .38], [1, .38], [.69, .61], [.81, 1], [.5, .76], [.19, 1], [.31, .61], [0, .38], [.38, .38]] };
  var FILLS = ['', 'sh_blue', 'sh_green', 'sh_yellow', 'sh_red', 'sh_gray', 'white'], LINES = ['', 'sw_black', 'sw_blue', 'sw_green', 'sw_red', 'sw_orange', 'sw_purple'], LW = [0.75, 1.5, 3];
  var WRAPS = [['inline', 'pic.w.inline'], ['square-left', 'pic.w.sl'], ['square-right', 'pic.w.sr'], ['topBottom', 'pic.w.tb'], ['behind', 'pic.w.behind'], ['front', 'pic.w.front']];
  function hex(k) { return k ? C(k).slice(1).toUpperCase() : ''; }
  function isLine(k) { return k === 'line' || k === 'arrow'; }
  function make(k) {
    var l = isLine(k);
    return { k: k, w: l ? 240 : k === 'textbox' ? 260 : 200, h: l ? (k === 'arrow' ? 40 : 12) : k === 'textbox' ? 90 : 120, fill: k === 'textbox' ? 'FFFFFF' : k === 'line' ? '' : hex('sh_blue'), ln: k === 'arrow' ? hex('sw_blue') : k === 'textbox' ? hex('sw_black') : k === 'line' ? hex('sw_black') : hex('sw_blue'), lw: k === 'line' ? 2 : 1.5, text: k === 'textbox' ? t('shp.sample') : '', al: 'left', wrap: 'inline' };
  }
  // ---- the look on the page
  Shape.html = function (s) {
    var w = s.w, h = s.h, lw = s.ln ? (s.lw || 1) * 96 / 72 : 0, d = lw / 2, fill = s.fill ? '#' + s.fill : 'none', ln = s.ln ? '#' + s.ln : 'none', g;
    if (s.k === 'ellipse') g = '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + Math.max(1, w / 2 - d) + '" ry="' + Math.max(1, h / 2 - d) + '"/>';
    else if (s.k === 'line') g = '<line x1="0" y1="' + h / 2 + '" x2="' + w + '" y2="' + h / 2 + '"/>';
    else if (s.k === 'arrow') g = '<path d="M' + d + ' ' + h * 0.28 + 'H' + w * 0.62 + 'V' + d + 'L' + (w - d) + ' ' + h / 2 + 'L' + w * 0.62 + ' ' + (h - d) + 'V' + h * 0.72 + 'H' + d + 'Z"/>';
    else if (POLY[s.k]) g = '<polygon stroke-linejoin="round" points="' + POLY[s.k].map(function (q) { return Math.round((d + q[0] * (w - lw)) * 10) / 10 + ',' + Math.round((d + q[1] * (h - lw)) * 10) / 10; }).join(' ') + '"/>';
    else g = '<rect x="' + d + '" y="' + d + '" width="' + Math.max(1, w - lw) + '" height="' + Math.max(1, h - lw) + '"' + (s.k === 'round' ? ' rx="' + Math.round(Math.min(w, h) * 0.17) + '"' : '') + '/>';
    var tx = s.text ? '<span class="shp-t' + (s.k === 'textbox' ? ' tb' : '') + '">' + esc(s.text).replace(/\n/g, '<br>') + '</span>' : '';
    var out = '<span class="shp-b" style="width:' + w + 'px;height:' + h + 'px"><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="' + fill + '" stroke="' + ln + '" stroke-width="' + lw + '" aria-hidden="true">' + g + '</svg>' + tx + '</span>';
    return rotated(s, out);
  };
  function wrapName(w) { var k = { topBottom: 'pic.w.tb', behind: 'pic.w.behind', front: 'pic.w.front', 'square-left': 'pic.w.sl', 'square-right': 'pic.w.sr' }[w]; return k ? t(k) : ''; }
  // a turned shape keeps its box in the flow: the line takes the room of the turned outline
  function rotated(s, html) {
    var r = (+s.rot || 0) % 360; if (!r) return html;
    var a = r * Math.PI / 180, bw = Math.abs(s.w * Math.cos(a)) + Math.abs(s.h * Math.sin(a)), bh = Math.abs(s.w * Math.sin(a)) + Math.abs(s.h * Math.cos(a));
    return '<span class="shp-r" style="width:' + Math.round(bw) + 'px;height:' + Math.round(bh) + 'px"><span style="left:' + Math.round((bw - s.w) / 2) + 'px;top:' + Math.round((bh - s.h) / 2) + 'px;transform:rotate(' + r + 'deg)">' + html + '</span></span>';
  }
  // ---- the shape written as Word writes it
  function anchor(wrap, al) {
    var a = wrap === 'square-right' ? 'right' : wrap === 'square-left' ? 'left' : al || 'center';
    var el = wrap === 'topBottom' ? '<wp:wrapTopAndBottom/>' : wrap === 'behind' || wrap === 'front' ? '<wp:wrapNone/>' : '<wp:wrapSquare wrapText="' + (wrap === 'square-left' ? 'right' : 'left') + '"/>';
    return { open: '<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="' + (wrap === 'behind' ? 1 : 0) + '" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>' + a + '</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>', wrap: el, close: '</wp:anchor>' };
  }
  Shape.xml = function (s, id) {
    var cx = Math.round(s.w * 9525), cy = Math.round(s.h * 9525), w = s.wrap || 'inline', l = isLine(s.k), lnW = Math.round((s.lw || 1) * 12700);
    var fill = s.fill ? '<a:solidFill><a:srgbClr val="' + s.fill + '"/></a:solidFill>' : '<a:noFill/>', ln = s.ln ? '<a:ln w="' + lnW + '"><a:solidFill><a:srgbClr val="' + s.ln + '"/></a:solidFill>' + (s.k === 'line' || s.k === 'arrow' ? '' : '') + '</a:ln>' : '<a:ln><a:noFill/></a:ln>';
    var paras = String(s.text || '').split('\n').map(function (x) { return '<w:p><w:pPr><w:jc w:val="' + (s.k === 'textbox' ? 'left' : 'center') + '"/></w:pPr>' + (x ? '<w:r><w:t xml:space="preserve">' + esc(x) + '</w:t></w:r>' : '') + '</w:p>'; }).join('');
    var body = '<wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:cNvSpPr' + (s.k === 'textbox' ? ' txBox="1"' : '') + '/><wps:spPr><a:xfrm' + (s.rot ? ' rot="' + Math.round(((s.rot % 360) + 360) % 360 * 60000) + '"' : '') + '><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="' + PRST[s.k] + '"><a:avLst/></a:prstGeom>' + fill + ln + '</wps:spPr>'
      + (l ? '' : '<wps:txbx><w:txbxContent>' + paras + '</w:txbxContent></wps:txbx>') + '<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="' + (s.k === 'textbox' ? 't' : 'ctr') + '" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp>';
    var common = '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>', tail = '<wp:docPr id="' + id + '" name="Shape ' + id + '"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' + body + '</a:graphicData></a:graphic>';
    var d = w === 'inline' ? '<wp:inline distT="0" distB="0" distL="0" distR="0">' + common + tail + '</wp:inline>' : (function () { var a = anchor(w, s.al); return a.open + common + a.wrap + tail + a.close; })();
    return '<w:p><w:pPr><w:jc w:val="' + (s.al || 'left') + '"/></w:pPr><w:r><w:drawing>' + d + '</w:drawing></w:r></w:p>';
  };
  function block(s) {
    var el = Insert.block('shp' + Render.picCls(s.wrap) + ' al-' + (s.al || 'left'), Shape.html(s), Shape.xml(s, nextId++)); el.dataset.shp = JSON.stringify(s); if (wrapName(s.wrap)) el.dataset.wl = wrapName(s.wrap); return el;
  }
  Shape.block = block;
  Shape.edit = function (b) { try { open(JSON.parse(b.dataset.shp), b); } catch (x) { /* a shape this editor cannot read stays as it is */ } };
  // ---- Insert ▸ Shapes
  A['i-shape'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 2, KINDS.map(function (k) { return { t: t(k[1]), go: function () { Insert.place(block(make(k[0]))); } }; }), { from: el });
  };
  // ---- the dialog
  function sw(id, keys, cur, none) { return '<span class="pa-seg" id="' + id + '">' + keys.map(function (k) { var h = hex(k); return '<button type="button" data-v="' + h + '" class="pop-sw' + (h === (cur || '') ? ' on' : '') + (k ? '' : ' none') + '"' + (k ? ' style="background:#' + h + '"' : '') + ' aria-label="' + esc(k || none) + '">' + (k ? '' : '&times;') + '</button>'; }).join('') + '</span>'; }
  function seg(id, items, cur) { return '<span class="pa-seg" id="' + id + '">' + items.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (String(x[0]) === String(cur) ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</span>'; }
  function cmv(px) { return Math.round(px / 96 * 2.54 * 100) / 100; }
  function open(s, block) {
    editing = block || null; draft = s;
    Ui.sheet('shape', '<h2 class="sh-h">' + esc(t('shp.title')) + '</h2>'
      + (isLine(s.k) ? '' : '<div class="pa-f hf-f"><textarea id="shTx" rows="2" autocomplete="off" placeholder="' + esc(t('shp.text')) + '">' + esc(s.text) + '</textarea></div>')
      + (isLine(s.k) && s.k === 'line' ? '' : '<div class="pa-f"><span>' + esc(t('shp.fill')) + '</span>' + sw('shFill', FILLS, s.fill, t('pc.none')) + '</div>')
      + '<div class="pa-f"><span>' + esc(t('shp.line_')) + '</span>' + sw('shLn', LINES, s.ln, t('pc.none')) + '</div>'
      + '<div class="pa-f"><span>' + esc(t('shp.lw')) + '</span>' + seg('shLw', LW.map(function (x) { return [x, x + ' pt']; }), s.lw) + '</div>'
      + '<div class="pa-f hf-f"><span>' + esc(t('shp.rot')) + '</span><input id="shRot" type="text" inputmode="decimal" value="' + (s.rot || 0) + '" autocomplete="off"><em>°</em></div>'
      + '<div class="pa-grid"><label class="pa-f"><span>' + esc(t('shp.w')) + '</span><input id="shW" type="text" inputmode="decimal" value="' + cmv(s.w) + '" autocomplete="off"><em>cm</em></label><label class="pa-f"><span>' + esc(t('shp.h')) + '</span><input id="shH" type="text" inputmode="decimal" value="' + cmv(s.h) + '" autocomplete="off"><em>cm</em></label></div>'
      + '<div class="pa-f"><span>' + esc(t('eq.align')) + '</span>' + seg('shAl', [['left', t('p.left')], ['center', t('p.center')], ['right', t('p.right')]].map(function (x) { return [x[0], String(x[1]).replace(/^Align /, '').replace(/^Căn /, '')]; }), s.al || 'left') + '</div>'
      + '<div class="pa-f"><span>' + esc(t('pic.wrap')) + '</span>' + seg('shWr', WRAPS.map(function (x) { return [x[0], t(x[1])]; }), WRAPS.some(function (x) { return x[0] === s.wrap; }) ? s.wrap : 'inline') + '</div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="shp-go">' + esc(t('a.apply')) + '</button></div>');
    setTimeout(function () { var i = $('shTx'); if (i) i.focus(); }, 300);
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#shFill button, #shLn button, #shLw button, #shAl button, #shWr button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
  function on(id) { var o = $(id) && $(id).querySelector('.on'); return o ? o.dataset.v : null; }
  function cm(id, d) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) && v > 0.2 ? Math.min(40, v) : d; }
  A['shp-go'] = function () {
    var s = Object.assign({}, draft); Ui.closeSheet();
    if ($('shTx')) s.text = $('shTx').value; else if ($('shTx') === null && isLine(s.k)) s.text = '';
    var f = on('shFill'); if (f !== null) s.fill = f; s.ln = on('shLn') !== null ? on('shLn') : s.ln; s.lw = +(on('shLw') || s.lw); s.w = Math.round(cm('shW', cmv(s.w)) / 2.54 * 96); s.h = Math.round(cm('shH', cmv(s.h)) / 2.54 * 96); s.al = on('shAl') || 'left'; s.wrap = on('shWr') || 'inline'; var rv = parseFloat(String($('shRot').value).replace(',', '.')); s.rot = isFinite(rv) ? Math.round(((rv % 360) + 360) % 360) : 0;
    if (s.cx && editing && editing.isConnected) {   // a shape the editor cannot rebuild: the block stays and the file's own XML is patched on save
      var chg = {}; try { chg = JSON.parse(editing.dataset.shpc || '{}'); } catch (x) { chg = {}; }
      ['w', 'h', 'fill', 'ln', 'lw', 'text', 'al', 'wrap', 'rot'].forEach(function (k) { if (String(s[k] === undefined ? '' : s[k]) !== String(draft[k] === undefined ? '' : draft[k])) chg[k] = 1; });
      editing.dataset.shp = JSON.stringify(s); editing.dataset.shpc = JSON.stringify(chg); editing.dataset.m = '1'; editing.className = 'b lk shp' + Render.picCls(s.wrap) + ' al-' + (s.al || 'left'); editing.innerHTML = Shape.html(s);
      if (wrapName(s.wrap)) editing.dataset.wl = wrapName(s.wrap); else delete editing.dataset.wl;
      editing = null; Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); return;
    }
    var el = block(s);
    if (editing && editing.isConnected) { editing.replaceWith(el); Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); } else Insert.place(el);
    editing = null;
  };
  document.addEventListener('dblclick', function (e) {
    var b = Doc.mode === 'edit' && e.target.closest && e.target.closest('#paper .b.shp'); if (!b || !b.dataset.shp) return;
    try { open(JSON.parse(b.dataset.shp), b); } catch (x) { /* a shape this editor cannot read stays as it is */ }
  });
})();
