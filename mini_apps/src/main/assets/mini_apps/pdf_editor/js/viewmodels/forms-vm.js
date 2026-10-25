// Forms — a PDF that is a form (text boxes, check boxes, choices): its fields are shown over the pages, filled in "Fill form" mode, and written into the file when you are done.
// PDFium does not draw form fields, so the page shows the value the field holds from the overlay below; the file itself carries proper appearances (pdf-lib writes them).
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, F = window.Forms = { fields: [], values: {} }, busy = false;

  function val(f) { return Object.prototype.hasOwnProperty.call(F.values, f.name) ? F.values[f.name] : f.value; }
  F.dirty = function () { return Object.keys(F.values).length > 0; };
  F.load = async function () {
    try { F.fields = await PdfSvc.forms(); } catch (e) { F.fields = []; }
    Read.repaint(); Read.chrome(); if (window.Desk) Desk.panel();
  };

  // ---- the fields over a page -----------------------------------------------------------------------------------------------------------
  Read.layers.push(function (ov, i) {
    var live = Read.mode === 'form', html = '';
    F.fields.forEach(function (f, n) {
      if (f.page !== i) return; var b = Read.box(i, f.rect), v = val(f), fs = Math.max(8, Math.min(15, b.h * 0.62)), pos = 'left:' + b.l + 'px;top:' + b.t + 'px;width:' + b.w + 'px;height:' + b.h + 'px', can = live && !f.ro;
      if (f.kind === 'text') {
        if (can) html += (f.multi ? '<textarea' : '<input type="text"') + ' class="ff" data-n="' + n + '" style="' + pos + ';font-size:' + fs + 'px" autocomplete="off" aria-label="' + esc(f.name) + '"' + (f.multi ? '>' + esc(v) + '</textarea>' : ' value="' + esc(v) + '">');
        else if (v) html += '<span class="ffv" style="' + pos + ';font-size:' + fs + 'px">' + esc(v) + '</span>';
        else if (live) html += '<i class="ff off" style="' + pos + '"></i>';
      } else if (f.kind === 'check' || f.kind === 'radio') {
        var on = f.kind === 'check' ? !!v : v === f.opt;
        if (can) html += '<button type="button" class="ff ffc' + (on ? ' on' : '') + (f.kind === 'radio' ? ' rd' : '') + '" data-act="ff-tog" data-n="' + n + '" style="' + pos + '" role="' + (f.kind === 'radio' ? 'radio' : 'checkbox') + '" aria-checked="' + on + '" aria-label="' + esc(f.name + (f.opt ? ' ' + f.opt : '')) + '">' + (on ? ic(f.kind === 'radio' ? 'dot' : 'check', Math.max(10, b.h * 0.7), 2.6) : '') + '</button>';
        else if (on) html += '<span class="ffv ffm" style="' + pos + '">' + ic(f.kind === 'radio' ? 'dot' : 'check', Math.max(10, b.h * 0.7), 2.6) + '</span>';
        else if (live) html += '<i class="ff off' + (f.kind === 'radio' ? ' rd' : '') + '" style="' + pos + '"></i>';
      } else {   // drop, list
        if (can) html += '<button type="button" class="ff ffd" data-act="ff-pick" data-n="' + n + '" style="' + pos + ';font-size:' + fs + 'px"><span>' + esc(v) + '</span>' + ic('down', 14, 2.2) + '</button>';
        else if (v) html += '<span class="ffv" style="' + pos + ';font-size:' + fs + 'px">' + esc(v) + '</span>';
        else if (live) html += '<i class="ff off" style="' + pos + '"></i>';
      }
    });
    if (html) ov.insertAdjacentHTML('beforeend', html);
  });
  document.addEventListener('input', function (e) { var el = e.target; if (!el.classList || !el.classList.contains('ff') || el.dataset.n == null) return; var f = F.fields[+el.dataset.n]; if (f) { F.values[f.name] = el.value; Read.chrome(); } });
  A['ff-tog'] = function (el) {
    var f = F.fields[+el.dataset.n]; if (!f) return;
    F.values[f.name] = f.kind === 'check' ? !val(f) : f.opt; Read.repaint(); Read.chrome();
  };
  A['ff-pick'] = function (el) {
    var f = F.fields[+el.dataset.n]; if (!f) return; var r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 2, f.options.map(function (o) { return { t: o, on: o === val(f), go: function () { F.values[f.name] = o; Read.repaint(); Read.chrome(); } }; }), { from: el });
  };

  // ---- the mode -------------------------------------------------------------------------------------------------------------------------------
  A['m-form'] = function () { if (!F.fields.length) return Ui.toast(t('fm.none')); Read.setMode('form'); };
  A['fm-done'] = async function () {
    if (busy) return; var vals = Object.keys(F.values).map(function (k) { return { name: k, value: F.values[k] }; });
    if (!vals.length) { Read.setMode('read'); return; }
    busy = true; var skipped = [];
    var r = await Viewer.run(async function () { var res = await PdfSvc.formSet(vals); skipped = res.skipped || []; return res; }, 'busy.edit'); busy = false;
    if (!r) return; F.values = {}; Read.setMode('read'); await F.load(); Ui.toast(skipped.length ? t('fm.skipped', { n: skipped.length }) : t('fm.saved'));
  };
  A['fm-flat'] = function () {
    Ui.dialog(t('fm.flat.t'), t('fm.flat.b'), t('fm.flat.go'), async function () {
      var vals = Object.keys(F.values).map(function (k) { return { name: k, value: F.values[k] }; });
      var r = await Viewer.run(function () { return PdfSvc.formSet(vals, true); }, 'busy.edit'); if (!r) return; F.values = {}; Read.setMode('read'); await F.load(); Ui.toast(t('fm.flatdone'));
    }, true);
  };
  A['fm-discard'] = function () { F.values = {}; Read.repaint(); Read.chrome(); };

  var tools = ReadView.tools; ReadView.tools = function (mode, o) {
    if (mode === 'form') return '<div class="dc-row">' + '<button type="button" class="dc-b" data-act="fm-discard"' + (F.dirty() ? '' : ' disabled') + '>' + ic('restore', 24, 1.8) + '<span>' + esc(t('fm.discard')) + '</span></button>'
      + '<button type="button" class="dc-b" data-act="fm-flat">' + ic('lock', 24, 1.8) + '<span>' + esc(t('fm.flat')) + '</span></button>' + '<button type="button" class="dc-b on" data-act="fm-done">' + ic('check', 24, 1.8) + '<span>' + esc(t('a.done')) + '</span></button></div>';
    var h = tools.apply(this, arguments);
    if (mode === 'read' && F.fields.length) h = h.replace('</div>', '<button type="button" class="dc-b" data-act="m-form">' + ic('doc', 24, 1.8) + '<span>' + esc(t('fm.tool')) + '</span></button></div>');
    return h;
  };
  var hf = Read.hintFn; Read.hintFn = function (m) {
    if (m === 'form') return { text: t('fm.hint') };
    if (m === 'read' && F.fields.length) return { text: t('fm.has'), act: 'm-form', label: t('fm.fill') };
    return hf ? hf(m) : null;
  };
  Menus.add('insert', function () { return [{ t: t('fm.tool'), off: !F.fields.length, on: Read.mode === 'form', go: function () { A['m-form'](); } }]; });
  var o = Desk.opened; Desk.opened = function () { var r = o.apply(this, arguments); F.values = {}; F.load(); return r; };
  var dc = Doc.changed; Doc.changed = function () { var r = dc.apply(this, arguments); setTimeout(F.load, 50); return r; };
  // Esc / leaving keeps nothing half done: a change of mode away from the form drops what was not applied
  var sm = Read.setMode; Read.setMode = function (m) { if (m !== 'form' && Read.mode === 'form' && F.dirty() && !busy) F.values = {}; return sm.apply(this, arguments); };
})();
