// Desk — the deck page of a computer (html.pc): the tool bar, the status bar (zoom, views), the notes under the slide, and the way the slide is zoomed. The menus are in desk-menu.js.
// A phone and a touch tablet keep the tabs at the bottom; nothing here runs for them.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, D = window.Desk = { view: 'edit', notes: true, noteText: '', noteSlide: -1, zs: null }, zt = 0;

  // ---- what the page shows ------------------------------------------------------------------------------------------------------------
  D.build = function () {
    if (!Wide.pc) return;
    $('dkMenu').innerHTML = DeskView.menu(); $('dkTools').innerHTML = DeskView.tools();
    $('dkStatus').innerHTML = DeskView.status({ n: 1, t: 1, view: D.view, notes: D.notes, z: 100, fit: true });
    D.zs = Ui.slider($('dkZr'), { min: 10, max: 300, step: 1, value: 100, onInput: function (v) { D.zoom(v, true); } });
    $('dkNotes').innerHTML = DeskView.notes(''); $('dkNotes').classList.toggle('shut', !D.notes); D.sync();
  };
  D.pct = function () { return Deck.info && Stage.pcw ? Math.round(Stage.pcw / (Deck.info.size.cx / 9525) * 100) : 100; };
  // keep every part in step with the deck: slide n of N, the zoom, the buttons that name a state (bold…)
  D.sync = function () {
    if (!Wide.pc || !$('dkSl')) return;
    var n = Deck.count(), z = D.pct(), sel = Sel.count();
    $('dkSl').textContent = t('dk.slide', { n: Deck.cur + 1, t: n }); $('dkSelT').textContent = sel > 1 ? t('dk.sel', { n: sel }) : '';
    $('dkZt').textContent = z + '%'; $('dkFit').classList.toggle('on', !Stage.pcz); if (D.zs) D.zs.set(z);
    $('dkNt').classList.toggle('on', D.notes);
    ['edit', 'sort', 'out'].forEach(function (k) { var b = document.querySelector('[data-dk="v-' + k + '"]'); if (b) b.classList.toggle('on', k === (D.view === 'outline' ? 'out' : D.view)); });
    var q = Quick.last || {}, ist = window.Inline && Inline.on && Inline.state(), f = ist || q.font || {}, has = !!ist || (!!Deck.sel && !!q.font);
    var set = function (name, on) { var b = document.querySelector('#dkTools [data-dk="' + name + '"]'); if (b) { b.classList.toggle('on', !!on); b.classList.toggle('off', !has && /^(bold|italic|under|strike|alignl|alignc|alignr|bullets|textc|font|sizedec|sizeinc)$/.test(name)); } };
    set('bold', f.bold); set('italic', f.italic); set('under', f.underline); set('strike', f.strike); set('bullets', q.paragraphs && q.paragraphs[0] && q.paragraphs[0].bullet !== 'none');
    var al = q.paragraphs && q.paragraphs[0] && q.paragraphs[0].align; set('alignl', al === 'left'); set('alignc', al === 'center'); set('alignr', al === 'right'); set('textc'); set('font'); set('sizedec'); set('sizeinc');
    var fn = $('dkFont'), sz = $('dkSize'); if (fn) fn.textContent = f.family || Fonts.def; if (sz && document.activeElement !== sz) sz.value = f.size ? Math.round(f.size * 10) / 10 : '';
    var tc = $('dkTc'), fc = $('dkFc'); if (tc) tc.style.background = f.color || ''; if (fc) fc.style.background = q.fill && q.fill !== 'none' ? q.fill : '';
  };

  // ---- zoom: 0 = the slide fits the room; a number is a percent of its real size (a 13.33in slide at 96 dpi) -------------------------------
  D.zoom = function (pct, soft) {
    Stage.pcz = pct || 0; Stage.layout(); D.sync(); clearTimeout(zt);
    zt = setTimeout(function () { Stage.show(); }, soft ? 70 : 0);
  };
  D.zoomBy = function (f) { D.zoom(Math.max(10, Math.min(300, Math.round(D.pct() * f)))); };
  // Ctrl / Cmd + wheel (a trackpad pinch too): the slide grows about the pointer
  D.wheel = function (e) {
    var sc = $('stScroll'), box = $('slideBox'), r = box.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    var f = Math.exp(-Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode ? 5 : 1))) * 0.01);
    Stage.pcz = Math.max(10, Math.min(300, Math.round(D.pct() * f))); Stage.layout(); D.sync();
    var r2 = box.getBoundingClientRect(); sc.scrollLeft += (r2.left + fx * r2.width) - e.clientX; sc.scrollTop += (r2.top + fy * r2.height) - e.clientY;
    clearTimeout(zt); zt = setTimeout(function () { Stage.show(); }, 90);
  };

  // ---- notes under the slide: they save when you leave the box ---------------------------------------------------------------------------
  D.loadNotes = async function () {
    if (!Wide.pc || !Deck.info) return; var i = Deck.cur, x = '';
    try { x = await PptSvc.notes(i); } catch (e) { /* a slide without notes */ }
    if (i !== Deck.cur) return; D.noteSlide = i; D.noteText = x || ''; var n = $('dkNote'); if (n && document.activeElement !== n) n.value = D.noteText;
  };
  D.saveNotes = function () {
    var n = $('dkNote'); if (!n || D.noteSlide < 0 || n.value === D.noteText) return; var s = D.noteSlide, v = n.value; D.noteText = v;
    Viewer.run([Deck.op('setNotes', null, { text: v }, s)], 'busy.edit');
  };
  D.showNotes = function (on) { D.notes = on; $('dkNotes').classList.toggle('shut', !on); D.sync(); };

  // ---- the views: normal, the slides side by side, the outline ---------------------------------------------------------------------------
  D.setView = function (v) {
    if (v === D.view) return; if (D.view === 'sort') Slides.close(); if (D.view === 'outline' && window.Outline && Outline.on) A['d-outline']();
    D.view = v; if (v === 'sort') Slides.open(); else if (v === 'outline' && window.Outline && !Outline.on) A['d-outline'](); D.sync();
  };

  // ---- the buttons -----------------------------------------------------------------------------------------------------------------------
  function fnt() { return (window.Inline && Inline.on && Inline.state()) || (Quick.last || {}).font || {}; }
  function fontOp(patch) { if (!Deck.sel && !(window.Inline && Inline.on)) return; Sel.font(patch); }
  function size(d) { var s = fnt().size || 18; fontOp({ fontSizePt: Math.max(4, Math.min(200, Math.round((s + d * (s >= 36 ? 2 : 1)) * 2) / 2)) }); }
  var DO = {
    newslide: function (b) { Menus.layouts(b, 'add'); }, layout: function (b) { Menus.layouts(b, 'set'); },
    text: function () { A['i-text'](); }, shape: function (b) { Menus.shapes(b); }, pic: function () { A['i-pic'](); }, table: function () { A['i-table'](); }, chart: function (b) { Chartx.menu(b); }, link: function () { A['i-link'](); },
    font: function (b) { var r = b.getBoundingClientRect(), cur = fnt().family || Fonts.def; PopMenu.show(r.left, r.bottom + 4, Fonts.list.map(function (f) { return { t: f.n, on: f.n.toLowerCase() === String(cur).toLowerCase(), go: function () { fontOp({ fontFamily: f.n }); } }; }), { from: b }); },
    sizedec: function () { size(-1); }, sizeinc: function () { size(1); },
    bold: function () { fontOp({ bold: !fnt().bold }); }, italic: function () { fontOp({ italic: !fnt().italic }); }, under: function () { fontOp({ underline: !fnt().underline }); }, strike: function () { fontOp({ strike: !fnt().strike }); },
    textc: function (b) { ColorPop.show(b, fnt().color, function (c) { fontOp({ color: c }); }); },
    alignl: function () { Sel.para({ align: 'left' }); }, alignc: function () { Sel.para({ align: 'center' }); }, alignr: function () { Sel.para({ align: 'right' }); },
    bullets: function () { var p = ((Quick.last || {}).paragraphs || [])[0]; Sel.para({ bullet: p && p.bullet === 'char' ? 'none' : 'char' }); },
    fill: function (b) { ColorPop.show(b, (Quick.last || {}).fill, function (c) { Sel.fill(c === 'none' ? 'none' : c); }, { none: true }); },
    line: function (b) { ColorPop.show(b, ((Quick.last || {}).stroke || {}).color, function (c) { Sel.stroke(c === 'none' ? null : { color: c, widthEmu: Math.round((((Quick.last || {}).stroke || {}).widthPt || 1.5) * 12700) }); }, { none: true }); },
    arrange: function (b) { Menus.arrange(b); },
    notes: function () { D.showNotes(!D.notes); }, notesx: function () { D.showNotes(false); },
    'v-edit': function () { D.setView('edit'); }, 'v-sort': function () { D.setView('sort'); }, 'v-out': function () { D.setView('outline'); },
    zin: function () { D.zoomBy(1.25); }, zout: function () { D.zoomBy(0.8); }, fit: function () { D.zoom(0); },
    zoom: function (b) { var r = b.getBoundingClientRect(), z = D.pct(); PopMenu.show(r.left, r.top - 8 - 8 * 34, [25, 50, 75, 100, 150, 200].map(function (p) { return { t: p + '%', on: z === p, go: function () { D.zoom(p); } }; }).concat(['-', { t: t('dk.fit'), on: !Stage.pcz, go: function () { D.zoom(0); } }]), { from: b }); }
  };
  D.items = DO;
  function init() {
    ['dkTools', 'dkStatus', 'dkNotes'].forEach(function (id) {
      $(id).addEventListener('click', function (e) { var b = e.target.closest('[data-dk]'); if (b && DO[b.dataset.dk] && !b.classList.contains('off')) DO[b.dataset.dk](b, e); });
    });
    $('dkNotes').addEventListener('focusout', D.saveNotes);
    // while words are being written, a click on a button must not take the caret away from them
    document.addEventListener('mousedown', function (e) { if (window.Inline && Inline.on && e.target.closest && e.target.closest('#dkTools,#dkMenu,#quick,.ctxm,.cpop,#dkStatus') && !e.target.closest('input,textarea')) e.preventDefault(); }, true);
    $('dkTools').addEventListener('change', function (e) { if (e.target.id !== 'dkSize') return; var v = parseFloat(String(e.target.value).replace(',', '.')); if (v >= 4 && v <= 200) fontOp({ fontSizePt: Math.round(v * 2) / 2 }); else D.sync(); });
    $('dkTools').addEventListener('keydown', function (e) { if (e.target.id === 'dkSize' && e.key === 'Enter') e.target.blur(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (Wide.pc && Deck.info && Router.getCurrent() === 'deck') { Stage.layout(); D.sync(); clearTimeout(zt); zt = setTimeout(function () { Stage.show(); }, 80); } }).observe($('stScroll'));
    // the window moved between a phone's size and a computer's: the whole page is built again for the new look
    Wide.on(function (changed) {
      if (!changed) return; D.build(); if (!Deck.info) return;
      Viewer.chrome(); $('deckTools').innerHTML = EditView.tools(); Film.build(); Stage.layout(); Stage.show();
    });
  }
  D.init = init;
})();
