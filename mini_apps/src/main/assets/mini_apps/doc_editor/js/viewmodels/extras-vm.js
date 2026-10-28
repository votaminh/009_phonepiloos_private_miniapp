// Extras — what a desktop word processor has next to the basics: Insert ▸ Symbol and Date & Time, Export as text / Markdown / HTML, the spelling switch, and the small bar that floats over selected text.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, X = window.Extras = {};

  // ---- insert text at the caret ----------------------------------------------------------------------------------------------------------------
  function put(tx) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); Surface.focus(); var r = X.range; if (r) { var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    if (!Edit.block()) return Ui.toast(t('e.tap')); document.execCommand('insertText', false, tx);
  }
  function keepRange() { var s = getSelection(); X.range = s.rangeCount && Doc.paper().contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null; }
  var SYM = '© ® ™ § ¶ † ‡ • ◦ ‣ … – — ‘ ’ “ ” « » ‹ › ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ π Ω µ € £ ¥ ¢ ₫ ← → ↑ ↓ ↔ ⇒ ⇔ \u2605 \u2606 \u2713 \u2717 \u2660 \u2663 \u2665 \u2666 ¼ ½ ¾ ² ³ α β γ δ θ λ σ φ ψ ω'.split(' ');
  A['sy-open'] = function (el) { keepRange(); Ui.sheet('symbols', '<h2 class="sh-h">' + esc(t('sy.title')) + '</h2><div class="sy-grid">' + SYM.map(function (c) { return '<button type="button" class="sy-c" data-act="sy-put" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div><div class="btns"><button type="button" class="btn" data-act="sheet-done">' + esc(t('a.done')) + '</button></div>'); };
  A['sy-put'] = function (el) { put(el.dataset.c); };
  A['dt-open'] = function (el) {
    keepRange(); var d = new Date(), loc = I18n.locale(), r = el.getBoundingClientRect();
    function f(o) { try { return d.toLocaleString(loc, o); } catch (e) { return ''; } }
    var items = [f({ dateStyle: 'short' }), f({ dateStyle: 'medium' }), f({ dateStyle: 'long' }), f({ dateStyle: 'full' }), f({ timeStyle: 'short' }), f({ dateStyle: 'short', timeStyle: 'short' }), d.toISOString().slice(0, 10)].filter(Boolean).map(function (x) { return { t: x, go: function () { put(x); } }; });
    PopMenu.show(r.left, r.bottom + 2, items, { from: el });
  };

  // ---- export as text / Markdown / HTML --------------------------------------------------------------------------------------------------------
  function inline(el, md) {
    var out = '';
    (function walk(n, st) {
      if (n.nodeType === 3) { var tx = n.nodeValue.replace(/ /g, ' '); if (!tx) return; if (md && tx.trim()) { if (st.b) tx = '**' + tx + '**'; if (st.i) tx = '*' + tx + '*'; } out += tx; return; }
      if (n.nodeType !== 1 || (n.classList && n.classList.contains('pgsp'))) return; if (n.tagName === 'BR') { if (!n.hasAttribute('data-ph')) out += '\n'; return; }
      var s = { b: st.b || n.tagName === 'B' || n.tagName === 'STRONG' || /bold|[6-9]00/.test(n.style && n.style.fontWeight || ''), i: st.i || n.tagName === 'I' || n.tagName === 'EM' || (n.style && n.style.fontStyle === 'italic') };
      if (n.tagName === 'A' && n.dataset.href && md) { var save = out; out = ''; Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, s); }); out = save + '[' + out + '](' + n.dataset.href + ')'; return; }
      Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, s); });
    })(el, { b: false, i: false });
    return out;
  }
  X.build = function (fmt) {
    var lines = [], blocks = Array.prototype.filter.call(Doc.paper().children, function (b) { return b.classList.contains('b') && !b.hidden && !b.classList.contains('sb'); });
    blocks.forEach(function (b) {
      if (b.classList.contains('tbl')) { var rows = Array.prototype.map.call(b.querySelectorAll('tr'), function (tr) { return Array.prototype.filter.call(tr.children, function (c) { return !c.hidden; }).map(function (c) { return c.textContent.replace(/\s+/g, ' ').trim(); }); }); if (fmt === 'md' && rows.length) { lines.push('| ' + rows[0].join(' | ') + ' |'); lines.push('|' + rows[0].map(function () { return ' --- |'; }).join('')); rows.slice(1).forEach(function (r) { lines.push('| ' + r.join(' | ') + ' |'); }); } else rows.forEach(function (r) { lines.push(r.join('\t')); }); lines.push(''); return; }
      if (b.classList.contains('lk')) { if (b.classList.contains('toc')) lines.push(b.textContent.trim(), ''); return; }
      var tx = inline(b, fmt === 'md'), tt = b.dataset.t;
      if (tt === 'h' && fmt === 'md') lines.push('#'.repeat(Math.min(6, +b.dataset.lv || 1)) + ' ' + tx);
      else if (tt === 'l') lines.push('    '.repeat(+b.dataset.il || 0) + (fmt === 'md' ? (b.dataset.k === 'ordered' ? '1. ' : '- ') : (b.dataset.no || '•') + ' ') + tx);
      else lines.push(tx);
      if (tt !== 'l') lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };
  function html() {
    var body = Doc.paper().cloneNode(true); Array.prototype.forEach.call(body.querySelectorAll('#pgov, .pgsp'), function (n) { n.remove(); });
    Array.prototype.forEach.call(body.querySelectorAll('[contenteditable]'), function (n) { n.removeAttribute('contenteditable'); });
    return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(Doc.rec.name) + '</title><style>body{font-family:Calibri,Arial,sans-serif;max-width:800px;margin:2em auto;line-height:1.5}table{border-collapse:collapse}td{border:1px solid #bbb;padding:4px 8px}</style></head><body>' + body.innerHTML.replace(/ (?:class|data-[a-z-]+|style|contenteditable)="[^"]*"/g, '').replace(/<div id="pgov"[\s\S]*?<!--pgov-end-->/, '') + '</body></html>\n';
  }
  A['ex-save'] = async function (el) {
    var fmt = el.dataset.f, text = fmt === 'html' ? html() : X.build(fmt), name = Doc.rec.name.replace(/\.docx$/i, '') + '.' + fmt, bytes = new TextEncoder().encode(text);
    try { var r = await NativeTools.call('export_file_device', { fileName: name, base64: App.b64(bytes.buffer), reason: 'Export the document as ' + fmt }); Ui.toast(t('t.copied', { p: (r && r.data && r.data.displayPath) || 'Downloads' })); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('t.copyfail', e); }
  };
  A['ex-menu'] = function (el) {
    var r = el.getBoundingClientRect(); PopMenu.show(r.right + 4, r.top, [['txt', 'ex.txt'], ['md', 'ex.md'], ['html', 'ex.html']].map(function (x) { return { t: t(x[1]), go: function () { A['ex-save']({ dataset: { f: x[0] } }); } }; }), { from: el });
  };

  // ---- spelling -------------------------------------------------------------------------------------------------------------------------------
  function spell() { var on = Store.prefs().spell !== false; Doc.paper().spellcheck = on; Doc.paper().setAttribute('lang', I18n.locale()); }
  A['rv-spell'] = function () { var on = Store.prefs().spell === false; Store.savePrefs({ spell: on }); spell(); Ui.toast(t(on ? 'sp.on' : 'sp.off')); if (window.Ribbon) Ribbon.render(); };
  X.spellOn = function () { return Store.prefs().spell !== false; };
  document.addEventListener('DOMContentLoaded', spell); spell();
  var setMode0 = Doc.setMode; Doc.setMode = function () { var r = setMode0.apply(this, arguments); spell(); return r; };

  // ---- the small bar over selected text ---------------------------------------------------------------------------------------------------------
  var bar = null, mt = 0;
  function ensure() {
    if (bar) return bar; bar = document.createElement('div'); bar.className = 'mbar'; bar.setAttribute('role', 'toolbar'); bar.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    bar.innerHTML = '<button type="button" data-act="e-bold" aria-label="' + esc(t('f.bold')) + '"><b>B</b></button><button type="button" data-act="e-italic" aria-label="' + esc(t('f.italic')) + '"><i>I</i></button><button type="button" data-act="e-underline" aria-label="' + esc(t('f.underline')) + '"><u>U</u></button><button type="button" data-act="e-strike" aria-label="' + esc(t('f.strike')) + '"><s>S</s></button><i></i>'
      + '<button type="button" data-act="e-smaller" aria-label="' + esc(t('f.smaller')) + '">A−</button><button type="button" data-act="e-larger" aria-label="' + esc(t('f.larger')) + '">A+</button><i></i>'
      + '<button type="button" data-act="e-hl" aria-label="' + esc(t('f.highlight')) + '">' + ic('marker', 18, 1.8) + '</button><button type="button" data-act="e-color" aria-label="' + esc(t('f.color')) + '"><span class="tl-a">A<i></i></span></button><button type="button" data-act="e-link" aria-label="' + esc(t('i.link')) + '">' + ic('link', 18, 1.8) + '</button>';
    $('pgDoc').appendChild(bar); return bar;
  }
  function hide() { if (bar) bar.classList.remove('on'); }
  function show() {
    if (!Wide.pc || Doc.mode !== 'edit') return hide(); var s = getSelection(); if (!s.rangeCount || s.isCollapsed || !Doc.paper().contains(s.anchorNode) || Table.cell() && Table.selection()) return hide();
    var r = s.getRangeAt(0).getBoundingClientRect(); if (!r.width && !r.height) return hide(); var b = ensure(), host = $('pgDoc').getBoundingClientRect(); b.classList.add('on');
    var w = b.offsetWidth, h = b.offsetHeight, x = Math.max(8, Math.min(host.width - w - 8, r.left - host.left + r.width / 2 - w / 2)), y = r.top - host.top - h - 8; if (y < 4) y = r.bottom - host.top + 8;
    b.style.left = x + 'px'; b.style.top = y + 'px'; Edit.paintColor();
  }
  document.addEventListener('pointerup', function () { clearTimeout(mt); mt = setTimeout(show, 60); });
  document.addEventListener('keyup', function (e) { if (e.shiftKey || /Arrow|Home|End/.test(e.key)) { clearTimeout(mt); mt = setTimeout(show, 60); } });
  document.addEventListener('selectionchange', function () { var s = getSelection(); if (!s.rangeCount || s.isCollapsed) hide(); });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('input', hide);

  // ---- watermark and page colour (Layout ▸ Page Background) ------------------------------------------------------------------------------------
  // The watermark is a text with a colour, a strength and a direction; the file's own (read from its header) is the starting point.
  var WMC = ['wm_gray', 'wm_red', 'wm_blue', 'wm_green'], WMO = [0.25, 0.5, 0.75];
  X.wmSpec = function () {
    var d = window.DocRich && DocRich.doc, base = Object.assign({ colorHex: 'C0C0C0', opacity: 0.5, diagonal: true }, (d && d.wmSpec) || {}, Doc.wmStyle || {});
    var cur = Doc.wm !== undefined ? (Doc.wm && typeof Doc.wm === 'object' ? Doc.wm.text : Doc.wm) : (window.Sec && Sec.list()[0] && Sec.list()[0].wm) || '';
    return cur ? Object.assign({ text: cur }, base) : null;
  };
  X.wmText = function () { var s = X.wmSpec(); return s ? s.text : ''; };
  function setWm(tx, style) { if (style) Doc.wmStyle = Object.assign(Doc.wmStyle || {}, style); var s = Object.assign({ colorHex: 'C0C0C0', opacity: 0.5, diagonal: true }, (window.DocRich && DocRich.doc && DocRich.doc.wmSpec) || {}, Doc.wmStyle || {}); Doc.wm = tx ? Object.assign({ text: tx }, s) : null; Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); }
  function seg(id, items, cur) { return '<span class="pa-seg" id="' + id + '">' + items.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (String(x[0]) === String(cur) ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</span>'; }
  function wmDialog() {
    var s = X.wmSpec() || Object.assign({ text: '' }, { colorHex: 'C0C0C0', opacity: 0.5, diagonal: true }), cur = WMC.filter(function (k) { return C(k).slice(1).toUpperCase() === String(s.colorHex).toUpperCase(); })[0] || WMC[0];
    var op = WMO.reduce(function (a, v) { return Math.abs(v - s.opacity) < Math.abs(a - s.opacity) ? v : a; }, WMO[1]);
    Ui.sheet('wm', '<h2 class="sh-h">' + esc(t('wm.title')) + '</h2><div class="pa-f hf-f"><input id="wmText" type="text" value="' + esc(s.text) + '" autocomplete="off"></div>'
      + '<div class="pa-f"><span>' + esc(t('wm.color')) + '</span><span class="pa-seg" id="wmCol">' + WMC.map(function (k) { return '<button type="button" data-v="' + k + '" class="pop-sw' + (k === cur ? ' on' : '') + '" style="background:' + C(k) + '" aria-label="' + k + '"></button>'; }).join('') + '</span></div>'
      + '<div class="pa-f"><span>' + esc(t('wm.strength')) + '</span>' + seg('wmOp', [[0.25, t('wm.light')], [0.5, t('wm.mid')], [0.75, t('wm.strong')]], op) + '</div>'
      + '<div class="pa-f"><span>' + esc(t('wm.layout')) + '</span>' + seg('wmDir', [['d', t('wm.diag')], ['h', t('wm.horiz')]], s.diagonal ? 'd' : 'h') + '</div>'
      + '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="wm-go">' + esc(t('a.apply')) + '</button></div>');
    setTimeout(function () { var i = $('wmText'); if (i) i.focus(); }, 300);
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#wmCol button, #wmOp button, #wmDir button'); if (!b) return; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); });
  A['wm-menu'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var r = el.getBoundingClientRect(), cur = X.wmText();
    var items = ['DRAFT', 'CONFIDENTIAL', 'DO NOT COPY', 'SAMPLE', 'URGENT'].map(function (x) { return { t: x, on: cur === x, go: function () { setWm(x); } }; });
    items.push({ t: t('wm.custom'), go: wmDialog });
    items.push('-'); items.push({ t: t('wm.none'), off: !cur, go: function () { setWm(''); } });
    PopMenu.show(r.left, r.bottom + 2, items, { from: el });
  };
  A['wm-go'] = function () {
    var v = ($('wmText').value || '').trim(), on = function (id) { var o = $(id) && $(id).querySelector('.on'); return o ? o.dataset.v : null; };
    var col = on('wmCol'), style = { colorHex: col ? C(col).slice(1).toUpperCase() : 'C0C0C0', opacity: +(on('wmOp') || 0.5), diagonal: on('wmDir') !== 'h' }; Ui.closeSheet(); setWm(v, style);
  };

  // the page colour: one for the whole file (w:background); undefined = the file's own, null = none
  var PCS = ['pc_cream', 'pc_mint', 'pc_sky', 'pc_pink', 'pc_lav', 'pc_gray'];
  X.bgHex = function () { var d = window.DocRich && DocRich.doc, c = Doc.pageColor !== undefined ? Doc.pageColor : (d && d.bg); return c && /^[0-9A-Fa-f]{6}$/.test(c) ? '#' + c : ''; };
  X.bgApply = function () { var c = X.bgHex(), st = document.documentElement.style; if (c) st.setProperty('--pgbg', c); else st.removeProperty('--pgbg'); };
  A['pg-color'] = function (el) {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var cur = X.bgHex().toUpperCase();
    Edit.pop(PCS.map(function (k) { return '<button type="button" class="pop-sw' + (C(k).toUpperCase() === cur ? ' on' : '') + '" style="background:' + C(k) + '" data-act="pg-setcolor" data-k="' + k + '" aria-label="' + k + '"></button>'; }).join('') + '<button type="button" class="pop-sw none" data-act="pg-setcolor" data-k="" aria-label="' + esc(t('pc.none')) + '">&times;</button>', el, 'sw');
  };
  A['pg-setcolor'] = function (el) { Edit.hidePops(); Doc.pageColor = el.dataset.k ? C(el.dataset.k).slice(1).toUpperCase() : null; X.bgApply(); Doc.dirty = true; Doc.touch(); Doc.chrome(); };
  var apply0 = Read.apply; Read.apply = function () { apply0.apply(this, arguments); X.bgApply(); };
})();
