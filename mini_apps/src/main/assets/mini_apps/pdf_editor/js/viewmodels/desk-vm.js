// Desk — the computer's look of the document page (html.pc: a mouse and 1000px or more): menu bar, page thumbnails on the left, the pages in the middle, a panel for what is selected on the right, a status bar with the page number and zoom.
// A phone and a touch tablet never see it; they reach the same features through the "All features" sheet (all-vm.js), built from the very menus below.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, MAC = /Mac|iPhone|iPad/.test(navigator.platform), K = MAC ? '⌘' : 'Ctrl+';
  var D = window.Desk = { ver: 0 }, M = window.Menus = { extra: {}, K: K }, THW = 150;
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  function act(a, arg) { return function () { A[a](arg || { dataset: {} }); }; }
  function open() { return !!Doc.sizes.length && !!Viewer.rec; }
  function pref(k) { return Store.prefs()[k] !== false; }
  function at(b) { var r = b.getBoundingClientRect(); return [r.left, r.bottom + 4]; }

  // ---- the menus --------------------------------------------------------------------------------------------------------------
  var ZOOMS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
  function zoomItems() {
    var z = D.pct(); return ZOOMS.map(function (p) { return { t: p + '%', on: z === p, go: function () { D.setPct(p); } }; }).concat(['-', it('dk.fitw', '', function () { D.fit('width'); }), it('dk.fitp', '', function () { D.fit('page'); })]);
  }
  var MENUS = {
    file: function () {
      return [it('a.save', K + 'S', act('v-save'), { off: !Viewer.dirty }), it('mn.copy', '', act('m-copy')), it('mn.rename', '', act('m-rename')), it('mn.share', '', act('m-share')), '-',
        it('dk.remove', '', act('m-remove')), it('a.close', '', act('v-back'))];
    },
    edit: function () {
      return [it('a.undo', K + 'Z', act('d-undo'), { off: !Doc.canUndo() }), it('a.redo', K + 'Y', act('d-redo'), { off: !Doc.canRedo() }), '-',
        it('tl.text', '', act('m-text'), { on: Read.mode === 'text' }), it('tl.add', '', act('m-add'), { on: Read.mode === 'add' }), it('tl.redact', '', act('m-redact'), { on: Read.mode === 'redact' }), '-', it('dk.find', K + 'F', act('fd-open'))];
    },
    view: function () {
      var wrap = !!(window.Reflow && Reflow.on);
      return [it('rf.page', '', function () { A['rf-view']({ dataset: { k: 'page' } }); }, { on: !wrap }), it('rf.wrap', '', function () { A['rf-view']({ dataset: { k: 'wrap' } }); }, { on: wrap }), '-',
        { t: t('dk.zoom'), sub: zoomItems() }, it('dk.zin', K + '+', function () { D.step(1); }), it('dk.zout', K + '−', function () { D.step(-1); }), '-',
        it('dk.thumbs', '', function () { D.toggle('thumbs'); }, { on: pref('dkThumbs') }), it('dk.panel', '', function () { D.toggle('panel'); }, { on: pref('dkPanel') }), '-',
        it('dk.fullscreen', 'F11', function () { var d = document, el = d.documentElement; if (d.fullscreenElement) d.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); })];
    },
    insert: function () {
      function tool(k, key) { return it(key, '', function () { A['m-annot'](); A['a-tool']({ dataset: { k: k } }); }, { on: Read.mode === 'annot' && Mark.tool === k }); }
      return [it('tl.add', '', act('m-add')), it('tl.sign', '', act('m-sign')), '-', tool('highlight', 'an.highlight'), tool('underline', 'an.underline'), tool('strike', 'an.strike'), tool('pen', 'an.pen'), tool('note', 'an.note')];
    },
    page: function () { return [it('tl.pages', '', act('m-pages')), '-', it('dk.first', 'Home', function () { D.go(0); }), it('dk.prev', 'PgUp', function () { D.go(D.cur() - 1); }), it('dk.next', 'PgDn', function () { D.go(D.cur() + 1); }), it('dk.last', 'End', function () { D.go(Doc.sizes.length - 1); })]; }
  };
  M.names = ['file', 'edit', 'view', 'insert', 'page'];
  M.add = function (menu, fn) { (M.extra[menu] = M.extra[menu] || []).push(fn); };
  M.items = function (name) { var out = MENUS[name](); (M.extra[name] || []).forEach(function (f) { out = out.concat(['-'], f()); }); return out; };
  M.open = function (btn) { var r = btn.getBoundingClientRect(); if (PopMenu.isOpen() && PopMenu.from === btn) { PopMenu.close(); return; } PopMenu.show(r.left, r.bottom + 2, M.items(btn.dataset.mn), { from: btn }); };

  // ---- pages: go, current, zoom -------------------------------------------------------------------------------------------------
  D.cur = function () { if (window.Reflow && Reflow.on) { var p = Reflow.pageNow(); return p == null ? 0 : p; } return Read.list ? Read.current() : 0; };
  D.go = function (i, instant) {
    i = Math.max(0, Math.min(Doc.sizes.length - 1, i));
    if (window.Reflow && Reflow.on) { var a = $('rfHost').querySelector('.rf-pg[data-p="' + i + '"]'); if (a) $('rfScroll').scrollTo({ top: a.offsetTop - 8, behavior: instant ? 'auto' : 'smooth' }); return; }
    Read.goto(i);
  };
  D.pct = function () { var s = Doc.sizes[D.cur()] || Doc.sizes[0]; return s ? Math.round(Doc.pageW() / (s[0] * 96 / 72) * 100) : 100; };
  D.setPct = function (p) { var s = Doc.sizes[D.cur()]; if (!s || !Read.list) return; Read.zoomTo((p / 100 * s[0] * 96 / 72) / Doc.baseW()); D.sync(); };
  D.step = function (dir) { if (window.Reflow && Reflow.on) return Reflow.bump(dir); var i = ZOOMS.indexOf(D.pct()), n; if (i < 0) { n = ZOOMS.filter(function (z) { return dir > 0 ? z > D.pct() : z < D.pct(); }); n = dir > 0 ? n[0] : n[n.length - 1]; } else n = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))]; if (n) D.setPct(n); };
  D.fit = function (how) {
    var sc = $('rdScroll'), s = Doc.sizes[D.cur()]; if (!s || !Read.list) return; var aw = sc.clientWidth - 24, z = aw / Doc.baseW() / Doc.zoom * Doc.zoom;
    if (how === 'page') { var ph = sc.clientHeight - 32, w2 = ph * s[0] / s[1]; z = Math.min(aw, w2) / Doc.baseW(); }
    Read.zoomTo(z); D.sync();
  };

  // ---- thumbnails ---------------------------------------------------------------------------------------------------------------------
  var io = null, TH = {};
  D.thumbs = function () {
    var host = $('dkThumbs'); if (!host || !Wide.pc) return; if (io) io.disconnect(); TH = {};
    var head = window.Nav ? Nav.tabs() : '';
    if (window.Nav && Nav.tab === 'toc' && Nav.items.length) { host.innerHTML = head + Nav.list('nv-side'); return; }
    host.innerHTML = head + Doc.sizes.map(function (z, i) {
      var r = (z[2] || 0) % 180 ? z[0] / z[1] : z[1] / z[0];
      return '<button type="button" class="dk-th" data-act="dk-go" data-p="' + i + '" aria-label="' + esc(t('rf.pg', { n: i + 1 })) + '"><span class="dk-tc" style="aspect-ratio:' + (1 / r).toFixed(4) + '"><canvas></canvas></span><b>' + (i + 1) + '</b></button>';
    }).join('');
    var ver = D.ver; io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); paint(e.target, ver); } }); }, { root: host, rootMargin: '400px 0px' });
    Array.prototype.forEach.call(host.querySelectorAll('.dk-th'), function (b) { io.observe(b); });
    D.sync();
  };
  var q = Promise.resolve();
  function paint(b, ver) {
    var i = +b.dataset.p; q = q.then(async function () {
      if (ver !== D.ver || !b.isConnected) return;
      try {
        var cv = b.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(THW * dpr), s = Doc.sizes[i], h = Math.max(1, Math.round(w * s[1] / s[0])), px = await PdfSvc.render(i, w, h);
        if (ver !== D.ver || !b.isConnected) return; cv.width = w; cv.height = h; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0); b.classList.add('rdy');
      } catch (e) { /* the page keeps its plain box */ }
    });
  }
  A['dk-go'] = function (el) { D.go(+el.dataset.p); };

  // ---- status bar, panel -------------------------------------------------------------------------------------------------------------------
  D.status = function () {
    var n = Doc.sizes.length, cur = D.cur(), z = D.pct(), wrap = !!(window.Reflow && Reflow.on);
    return '<label class="dk-pn"><input id="dkPg" type="text" inputmode="numeric" value="' + (cur + 1) + '" aria-label="' + esc(t('dk.goto')) + '" autocomplete="off"><span>/ ' + n + '</span></label><span class="dk-fill"></span>'
      + (wrap ? '' : '<button type="button" class="dk-b sm" data-act="dk-zo" aria-label="−">' + ic('minus', 18, 2) + '</button><div class="sld dk-zr" id="dkZr" aria-label="' + esc(t('dk.zoom')) + '"></div><button type="button" class="dk-b sm" data-act="dk-zi" aria-label="+">' + ic('plus', 18, 2) + '</button><b class="dk-zv" id="dkZv">' + z + '%</b>'
        + '<button type="button" class="dk-b wd" data-act="dk-fitw"><span>' + esc(t('dk.fitw')) + '</span></button><button type="button" class="dk-b wd" data-act="dk-fitp"><span>' + esc(t('dk.fitp')) + '</span></button>');
  };
  A['dk-zo'] = function () { D.step(-1); }; A['dk-zi'] = function () { D.step(1); }; A['dk-fitw'] = function () { D.fit('width'); }; A['dk-fitp'] = function () { D.fit('page'); };
  var zs = null;
  D.slider = function () { var el = $('dkZr'); if (!el) { zs = null; return; } zs = Ui.slider(el, { min: 25, max: 400, step: 5, value: Math.max(25, Math.min(400, D.pct())), onInput: function (v) { D.setPct(v); } }); };
  D.panel = function () {
    var host = $('dkPanel'); if (!host || !Wide.pc) return; var r = Viewer.rec; if (!r) return;
    var wrap = !!(window.Reflow && Reflow.on), m = Read.mode, h = '';
    function sec(title, body) { return '<section class="dk-sec"><h3>' + esc(title) + '</h3>' + body + '</section>'; }
    h += sec(t('dp.doc'), '<div class="dp-doc"><b>' + esc(r.name) + '</b><small>' + esc(t(Doc.sizes.length === 1 ? 'pg.one.n' : 'pg.n', { n: Doc.sizes.length })) + ' · ' + esc(HomeView.size(r.size || 0)) + '</small></div>');
    h += sec(t('dp.view'), '<div class="rf-seg" style="display:inline-flex">' + ['page', 'wrap'].map(function (k) { return '<button type="button" class="' + ((k === 'wrap') === wrap ? 'on' : '') + '" data-act="rf-view" data-k="' + k + '">' + esc(t('rf.' + k)) + '</button>'; }).join('') + '</div>');
    if (wrap) {
      var th = Reflow.theme();
      h += sec(t('rf.aa'), '<div class="rf-ctl"><span>' + esc(t('rf.size')) + '</span><div><button type="button" class="ib" data-act="rf-size" data-v="-">' + ic('minus', 20, 2) + '</button><b>' + Reflow.size() + '</b><button type="button" class="ib" data-act="rf-size" data-v="+">' + ic('plus', 20, 2) + '</button></div></div><div class="sx-chips">'
        + ['light', 'paper', 'dark'].map(function (k) { return '<button type="button" class="sx-chip' + (th === k ? ' on' : '') + '" data-act="rf-theme" data-k="' + k + '">' + esc(t('rf.' + k)) + '</button>'; }).join('') + '</div>');
    } else if ((m === 'text' || m === 'add') && Text.sel) {
      var b = Text.sel.blk;
      h += sec(t('dp.sel'), '<div class="dp-q">' + esc(b.text.length > 120 ? b.text.slice(0, 120) + '…' : b.text) + '</div><small class="dp-m">' + esc(t('dp.size', { n: Math.round(b.fs * 10) / 10 })) + '</small>'
        + '<div class="dp-btns"><button type="button" class="btn ol" data-act="t-edit">' + esc(t('dp.edit')) + '</button><button type="button" class="btn ol" data-act="t-style">' + esc(t('dp.style')) + '</button><button type="button" class="btn ol" data-act="t-move">' + esc(t('dp.move')) + '</button><button type="button" class="btn ol danger" data-act="t-delete">' + esc(t('dp.del')) + '</button></div>');
    } else if (m === 'text' || m === 'add') h += sec(t('dp.sel'), '<p class="dp-hint">' + esc(t(m === 'add' ? 'hint.add' : 'hint.text')) + '</p>');
    else if (m === 'annot') h += sec(t('dp.ann'), '<p class="dp-hint">' + esc(t('hint.' + Mark.tool)) + '</p>');
    else if (m === 'redact') h += sec(t('tl.redact'), '<p class="dp-hint">' + esc(t('hint.redact')) + '</p>');
    else h += sec(t('dp.tools'), '<div class="dp-btns">' + [['m-text', 'tl.text'], ['m-add', 'tl.add'], ['m-annot', 'tl.annot'], ['m-sign', 'tl.sign'], ['m-pages', 'tl.pages']].map(function (x) { return '<button type="button" class="btn ol" data-act="' + x[0] + '">' + esc(t(x[1])) + '</button>'; }).join('') + '</div>');
    if (window.Extras) h += Extras.panel();
    host.innerHTML = h;
  };
  D.sync = function () {
    if (!Wide.pc || !Doc.sizes.length) return; var cur = D.cur(), pg = $('dkPg'), z = D.pct();
    if (pg && document.activeElement !== pg) pg.value = cur + 1; var zr = $('dkZr'), zv = $('dkZv'); if (zs && !zr.classList.contains('drag')) zs.set(Math.max(25, Math.min(400, z))); if (zv) zv.textContent = z + '%';
    Array.prototype.forEach.call($('dkThumbs').querySelectorAll('.dk-th'), function (b) { var on = +b.dataset.p === cur; if (on !== b.classList.contains('on')) { b.classList.toggle('on', on); if (on) { var h = $('dkThumbs'), r = b.getBoundingClientRect(), hr = h.getBoundingClientRect(); if (r.top < hr.top || r.bottom > hr.bottom) h.scrollTo({ top: b.offsetTop - h.clientHeight / 2 + b.clientHeight / 2 }); } } });
  };
  D.chrome = function () {
    if (!Wide.pc) return; $('dkMenu').innerHTML = M.names.map(function (n) { return '<button type="button" class="dk-m" data-mn="' + n + '" aria-haspopup="menu">' + esc(t('mu.' + n)) + '</button>'; }).join('');
    $('dkStatus').innerHTML = D.status(); D.slider(); D.panel(); D.sync();
  };
  D.toggle = function (k) {
    var key = k === 'thumbs' ? 'dkThumbs' : 'dkPanel', p = {}; p[key] = !pref(key); Store.savePrefs(p); D.layout(); setTimeout(function () { Read.refit && Read.refit(); D.thumbs(); D.sync(); }, 40);
  };
  D.layout = function () { var pg = $('pgDoc'); pg.dataset.thumbs = pref('dkThumbs') ? '1' : '0'; pg.dataset.panel = pref('dkPanel') ? '1' : '0'; };
  D.opened = function () { D.ver++; D.layout(); D.chrome(); D.thumbs(); };

  // ---- wiring ----------------------------------------------------------------------------------------------------------------------------
  D.init = function () {
    var bar = $('dkMenu');
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-mn]'); if (b && open()) M.open(b); });
    bar.addEventListener('pointerover', function (e) { var b = e.target.closest('[data-mn]'); if (b && PopMenu.isOpen() && PopMenu.from && PopMenu.from !== b && PopMenu.from.dataset.mn) { PopMenu.close(); M.open(b); } });
    var st = $('dkStatus');
    st.addEventListener('keydown', function (e) { if (e.target.id === 'dkPg' && e.key === 'Enter') { var n = parseInt(e.target.value, 10); if (n) D.go(n - 1); e.target.blur(); } });
    st.addEventListener('focusout', function (e) { if (e.target.id === 'dkPg') D.sync(); });
    // Shift + wheel: sideways while the page is wider than the room (Ctrl + wheel zooms: read-vm.js)
    var sc = $('rdScroll');
    sc.addEventListener('wheel', function (e) { if (!Wide.pc || !e.shiftKey || e.ctrlKey || e.metaKey) return; e.preventDefault(); this.scrollLeft += (e.deltaX || e.deltaY) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
    // Space + drag: the hand, to look round a page that is zoomed in
    var space = false, pan = null, moved = false;
    function handOn(v) { space = v; sc.classList.toggle('hand', v); if (!v) { pan = null; sc.classList.remove('grab'); } }
    function canPan() { return Wide.pc && Router.getCurrent() === 'doc' && !(window.Reflow && Reflow.on) && !Ui.state.sheet && !Ui.state.dlg && !PopMenu.isOpen(); }
    document.addEventListener('keydown', function (e) { if (e.code === 'Space' && canPan() && !typing(e)) { e.preventDefault(); if (!space) handOn(true); } }, true);
    document.addEventListener('keyup', function (e) { if (e.code === 'Space') handOn(false); }, true);
    window.addEventListener('blur', function () { handOn(false); });
    sc.addEventListener('pointerdown', function (e) { if (!space) return; e.preventDefault(); e.stopPropagation(); pan = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; moved = false; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* a synthetic pointer */ } sc.classList.add('grab'); }, true);
    sc.addEventListener('pointermove', function (e) { if (!pan) return; var dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; sc.scrollLeft = pan.l - dx; sc.scrollTop = pan.t - dy; });
    function end() { if (pan) { pan = null; sc.classList.remove('grab'); } }
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    sc.addEventListener('click', function (e) { if (space || moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    $('rdWrap').addEventListener('click', function () { setTimeout(D.panel, 60); });
    // what changes the document makes new thumbnails; a change of mode, of view or of what is open, a new panel
    var dc = Doc.changed; Doc.changed = function () { var r = dc.apply(this, arguments); D.ver++; D.thumbs(); return r; };
    var sm = Read.setMode; Read.setMode = function () { var r = sm.apply(this, arguments); D.chrome(); return r; };
    var rc = Read.chrome; Read.chrome = function () { var r = rc.apply(this, arguments); D.panel(); var s = $('dkStatus'); if (s && Wide.pc) { s.innerHTML = D.status(); D.slider(); } return r; };
    Wide.on(function (changed) { if (!changed) { Read.refit && Read.refit(); return; } D.opened(); setTimeout(function () { Read.refit && Read.refit(); }, 60); });
    document.addEventListener('keydown', onKey);
  };
  function typing(e) { var el = e.target; return !!(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || !!(el && el.isContentEditable); }
  function onKey(e) {
    if (!Wide.pc || Router.getCurrent() !== 'doc' || !open() || PopMenu.isOpen() || Ui.state.sheet || Ui.state.dlg) return;
    var c = e.ctrlKey || e.metaKey, k = e.key;
    if (c && (k === 's' || k === 'S')) { e.preventDefault(); if (Viewer.dirty) Viewer.save(); return; }
    if (c && (k === 'f' || k === 'F')) { e.preventDefault(); A['fd-open'](); return; }
    if (c && (k === '=' || k === '+')) { e.preventDefault(); D.step(1); return; }
    if (c && (k === '-' || k === '_')) { e.preventDefault(); D.step(-1); return; }
    if (c && k === '0') { e.preventDefault(); D.fit('width'); return; }
    if (typing(e)) return;
    if (c && (k === 'z' || k === 'Z')) { e.preventDefault(); A[e.shiftKey ? 'd-redo' : 'd-undo'](); return; }
    if (c && (k === 'y' || k === 'Y')) { e.preventDefault(); A['d-redo'](); return; }
    if (k === 'PageDown') { e.preventDefault(); D.go(D.cur() + 1); } else if (k === 'PageUp') { e.preventDefault(); D.go(D.cur() - 1); }
    else if (k === 'Home' && !c) { e.preventDefault(); D.go(0); } else if (k === 'End' && !c) { e.preventDefault(); D.go(Doc.sizes.length - 1); }
    else if (k === 'F11') { e.preventDefault(); MENUS.view()[ MENUS.view().length - 1 ].go(); }
  }
})();
