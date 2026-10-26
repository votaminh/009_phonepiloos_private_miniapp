// Read — how the document is shown while reading (layout, text size, theme, pinch to zoom), the contents sheet and the jump to a heading.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, PAGE_W = 794;
  var Read = window.Read = { pz: 0 };
  function fitScale() { return PageView.fitZoom(); }
  Read.apply = function () {
    var pg = $('pgDoc'), p = Doc.paper(), pr = Store.prefs(), edit = Doc.mode === 'edit', ready = !!Doc.blocks, moved = Read.last !== undefined && Read.last !== Doc.mode;
    if (Read.last !== Doc.mode) Read.pz = 0; Read.last = Doc.mode;
    var pages = !edit && pr.layout === 'page' && ready, sheet = edit && ready, theme = edit ? 'light' : pr.theme;
    p.classList.toggle('fit', !pages && !sheet); p.classList.remove('sheetpg'); p.classList.toggle('pgedit', sheet);
    pg.dataset.th = theme; pg.classList.toggle('dark', theme === 'dark');
    PageView.editStyle(p, sheet);
    if (sheet) { Read.pz = Read.pz || fitScale(); p.style.zoom = Read.pz; } else { p.style.fontSize = pages ? '' : (15 * pr.size / 100) + 'px'; p.style.zoom = ''; }
    p.style.display = pages ? 'none' : ''; $('pages').classList.toggle('on', pages);
    if (pages) PageView.show();
    $('docBody').classList.toggle('wide', pages || sheet);
    // going into or out of editing changes the sheet's shape: it settles in rather than jumping
    if (moved && ready && !pages && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) p.animate([{ opacity: .55, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1.06)' });
  };
  // ---- zoom: two fingers, or Ctrl / Cmd + wheel (a trackpad pinch comes as the same wheel). On the pages it scales the pages; on the flowing text it changes the text size.
  var pinch = null;
  function dist(e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function onPages() { return $('pages').classList.contains('on') || Doc.paper().classList.contains('pgedit'); }
  function zoomEl() { return $('pages').classList.contains('on') ? $('pages') : Doc.paper(); }
  function setSize(v) { v = Math.max(80, Math.min(200, Math.round(v / 5) * 5)); var pr = Store.prefs(); if (v === pr.size) return; Store.savePrefs({ size: v }); Doc.paper().style.fontSize = (15 * v / 100) + 'px'; }
  // the pages grow or shrink about the point under the pointer
  function zoomPages(z, mx, my) {
    var body = $('docBody'), old = Read.pz || fitScale(); z = Math.max(0.2, Math.min(3, z)); if (z === old) return;
    var k = z / old, cx = body.scrollLeft + mx, cy = body.scrollTop + my; Read.pz = z; zoomEl().style.zoom = z; body.scrollLeft = cx * k - mx; body.scrollTop = cy * k - my;
  }
  // Two fingers on the pages: while they move the whole page block is only scaled and shifted by the compositor (transform: no layout, no paint of the text), the way scrolling is smooth;
  // when the fingers leave, the zoom is set for real once and the place in the page is put back so the point between the fingers stays where it was.
  function mid(e) { var a = e.touches[0], c = e.touches[1], r = $('docBody').getBoundingClientRect(); return { x: (a.clientX + c.clientX) / 2 - r.left, y: (a.clientY + c.clientY) / 2 - r.top }; }
  $('docBody').addEventListener('touchstart', function (e) {
    if (e.touches.length !== 2) return; var pg = onPages(); pinch = { d: dist(e), z: pg ? (Read.pz || fitScale()) : Store.prefs().size, pages: pg };
    if (pg) {
      var body = $('docBody'), pw = $('pw'), m = mid(e); pinch.m0 = m; pinch.m1 = m; pinch.sx = body.scrollLeft; pinch.sy = body.scrollTop; pinch.k = 1;
      pw.style.transformOrigin = (pinch.sx + m.x - pw.offsetLeft) + 'px ' + (pinch.sy + m.y - pw.offsetTop) + 'px'; pw.style.willChange = 'transform';
    }
  }, { passive: true });
  $('docBody').addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length !== 2) return; e.preventDefault();
    if (!pinch.pages) { setSize(pinch.z * dist(e) / pinch.d); return; }
    var z = Math.max(0.2, Math.min(3, pinch.z * dist(e) / pinch.d)), m = mid(e); pinch.k = z / pinch.z; pinch.m1 = m;
    $('pw').style.transform = 'translate(' + (m.x - pinch.m0.x) + 'px,' + (m.y - pinch.m0.y) + 'px) scale(' + pinch.k + ')';
  }, { passive: false });
  $('docBody').addEventListener('touchend', function () {
    var p = pinch; pinch = null; if (!p || !p.pages) return;
    var body = $('docBody'), pw = $('pw'), z = p.z * p.k;
    pw.style.transform = ''; pw.style.transformOrigin = ''; pw.style.willChange = '';
    if (Math.abs(p.k - 1) < 0.005) return;
    Read.pz = z; zoomEl().style.zoom = z;
    body.scrollLeft = (p.sx + p.m0.x) * p.k - p.m1.x; body.scrollTop = (p.sy + p.m0.y) * p.k - p.m1.y;
  }, { passive: true });
  $('docBody').addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
    var f = Math.exp(-Math.max(-20, Math.min(20, e.deltaY * (e.deltaMode ? 5 : 1))) * 0.01), r = $('docBody').getBoundingClientRect();
    if (onPages()) zoomPages((Read.pz || fitScale()) * f, e.clientX - r.left, e.clientY - r.top); else setSize(Store.prefs().size * f);
  }, { passive: false });

  // ---- reading view sheet -----------------------------------------------------------------------------------------------------
  function sheet() { Ui.sheet('reading', SheetsView.reading(Store.prefs())); Ui.slider($('rvSize'), { min: 80, max: 200, step: 10, value: Store.prefs().size, onInput: function (v) { Store.savePrefs({ size: v }); Read.apply(); } }); }
  A['m-read'] = sheet;
  A['r-theme'] = function (el) { Store.savePrefs({ theme: el.dataset.k }); Read.apply(); sheet(); };

  // ---- contents ---------------------------------------------------------------------------------------------------------------
  function heads() { return Array.prototype.map.call(Doc.paper().querySelectorAll('.b[data-t="h"]'), function (el) { return { lv: +el.dataset.lv || 1, text: el.textContent.trim(), el: el }; }); }
  function here(h) { var top = $('docBody').scrollTop + 40, at = -1; h.forEach(function (x, i) { if (x.el.offsetTop - Doc.paper().offsetTop <= top + 60) at = i; }); return at; }
  A['m-contents'] = function () { var h = heads(); Read.heads = h; Ui.sheet('outline', SheetsView.outline(h, here(h))); };
  A['o-go'] = function (el) {
    var h = Read.heads[+el.dataset.i]; Ui.closeSheet(); if (!h || !h.el.isConnected) return;
    if ($('pages').classList.contains('on') && h.el.dataset.src !== undefined && PageView.jump(h.el.dataset.src)) return;
    var body = $('docBody'), y = h.el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 12;
    setTimeout(function () { body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }, 120);
  };
})();
