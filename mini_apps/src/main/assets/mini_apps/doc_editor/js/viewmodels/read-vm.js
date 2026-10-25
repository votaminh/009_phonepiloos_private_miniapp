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
  $('docBody').addEventListener('touchstart', function (e) { if (e.touches.length === 2) pinch = { d: dist(e), z: onPages() ? (Read.pz || fitScale()) : Store.prefs().size, pages: onPages() }; }, { passive: true });
  $('docBody').addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length !== 2) return; e.preventDefault();
    if (pinch.pages) { Read.pz = Math.max(0.2, Math.min(3, pinch.z * dist(e) / pinch.d)); zoomEl().style.zoom = Read.pz; } else setSize(pinch.z * dist(e) / pinch.d);
  }, { passive: false });
  $('docBody').addEventListener('touchend', function () { pinch = null; }, { passive: true });
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
