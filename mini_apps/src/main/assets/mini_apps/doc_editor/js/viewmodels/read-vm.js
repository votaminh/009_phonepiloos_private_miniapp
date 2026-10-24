// Read — how the document is shown while reading (layout, text size, theme, pinch to zoom), the contents sheet and the jump to a heading.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, PAGE_W = 794;
  var Read = window.Read = { pz: 0 };
  function fitScale() { return Math.max(0.3, Math.min(1, ($('docBody').clientWidth - 24) / PAGE_W)); }
  Read.apply = function () {
    var pg = $('pgDoc'), p = Doc.paper(), pr = Store.prefs(), edit = Doc.mode === 'edit';
    var layout = edit ? 'fit' : pr.layout, theme = edit ? 'light' : pr.theme;
    p.classList.toggle('fit', layout === 'fit'); p.classList.toggle('sheetpg', layout === 'page');
    pg.dataset.th = theme; pg.classList.toggle('dark', theme === 'dark');
    p.style.fontSize = layout === 'page' ? '' : (15 * pr.size / 100) + 'px';
    p.style.zoom = layout === 'page' ? (Read.pz = Read.pz || fitScale()) : '';
    $('docBody').classList.toggle('wide', layout === 'page');
  };
  // ---- pinch to zoom (page layout) --------------------------------------------------------------------------------------------
  var pinch = null;
  function dist(e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  $('docBody').addEventListener('touchstart', function (e) { if (e.touches.length === 2 && Doc.mode === 'read' && Store.prefs().layout === 'page') pinch = { d: dist(e), z: Read.pz || fitScale() }; }, { passive: true });
  $('docBody').addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length !== 2) return; e.preventDefault();
    Read.pz = Math.max(0.3, Math.min(3, pinch.z * dist(e) / pinch.d)); Doc.paper().style.zoom = Read.pz;
  }, { passive: false });
  $('docBody').addEventListener('touchend', function () { pinch = null; }, { passive: true });

  // ---- reading view sheet -----------------------------------------------------------------------------------------------------
  function sheet() { Ui.sheet('reading', SheetsView.reading(Store.prefs())); Ui.slider($('rvSize'), { min: 80, max: 200, step: 10, value: Store.prefs().size, onInput: function (v) { Store.savePrefs({ size: v }); Read.apply(); } }); }
  A['m-read'] = sheet;
  A['r-layout'] = function (el) { Store.savePrefs({ layout: el.dataset.k }); Read.pz = 0; Read.apply(); sheet(); };
  A['r-theme'] = function (el) { Store.savePrefs({ theme: el.dataset.k }); Read.apply(); sheet(); };

  // ---- contents ---------------------------------------------------------------------------------------------------------------
  function heads() { return Array.prototype.map.call(Doc.paper().querySelectorAll('.b[data-t="h"]'), function (el) { return { lv: +el.dataset.lv || 1, text: el.textContent.trim(), el: el }; }); }
  function here(h) { var top = $('docBody').scrollTop + 40, at = -1; h.forEach(function (x, i) { if (x.el.offsetTop - Doc.paper().offsetTop <= top + 60) at = i; }); return at; }
  A['m-contents'] = function () { var h = heads(); Read.heads = h; Ui.sheet('outline', SheetsView.outline(h, here(h))); };
  A['o-go'] = function (el) {
    var h = Read.heads[+el.dataset.i]; Ui.closeSheet(); if (!h || !h.el.isConnected) return;
    var body = $('docBody'), y = h.el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 12;
    setTimeout(function () { body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }, 120);
  };
})();
