// PageOps — putting things onto a PDF and shaping it: a picture from the phone, stamps (Approved, Draft…), pages from another PDF or from pictures, trimming margins, page numbers, a watermark,
// and the two copies that need the phone's own tools: with a password, and smaller. All are items of the menus (Menus.add), so the touch layout reaches them from "All features".
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, X = window.PageOps = {};
  function fail(e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  function chips(act, list, cur, extra) { return '<div class="sx-chips">' + list.map(function (c) { return '<button type="button" class="sx-chip' + (String(c[0]) === String(cur) ? ' on' : '') + '" data-act="' + act + '" data-k="' + c[0] + '"' + (extra || '') + '>' + esc(c[1]) + '</button>'; }).join('') + '</div>'; }
  function field(id, label, v, ph, kind) { return '<label class="sx-find"><input id="' + id + '" type="' + (kind || 'text') + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || label) + '" aria-label="' + esc(label) + '" autocomplete="off"></label>'; }
  function foot(act, label) { return '<div class="btns"><button type="button" class="btn light" data-act="sheet-done">' + esc(t('a.cancel')) + '</button><button type="button" class="btn" data-act="' + act + '">' + esc(label) + '</button></div>'; }
  async function pick(type, mimes, reason, multi) {
    try { var r = await NativeTools.call('pick_file', { type: type, mimeTypes: mimes, multiple: !!multi, reason: reason }); return (r && r.data && r.data.files) || []; } catch (e) { fail(e); return []; }
  }

  // ---- a picture from the phone; stamps --------------------------------------------------------------------------------------------------
  A['i-pic'] = async function () { var fs = await pick('image', ['image/*'], 'Put a picture on the page'); if (fs[0]) { try { await Files.request(fs[0].url); } catch (e) { /* a plain file */ } Sign.start(fs[0].url, { plain: true, wide: 0.45 }); } };
  var STAMPS = [['approved', C('sw_green')], ['draft', C('sw_blue')], ['confidential', C('sw_red')], ['paid', C('sw_green')], ['rejected', C('sw_red')], ['reviewed', C('sw_blue')], ['urgent', C('sw_orange')], ['date', C('sw_gray')]];
  function stampPng(text, color) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), f = '800 64px "Bricolage Grotesque", Arial, sans-serif'; g.font = f; var w = Math.ceil(g.measureText(text).width) + 72, h = 120; c.width = w; c.height = h; g = c.getContext('2d');
    g.font = f; g.lineWidth = 7; g.strokeStyle = color; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.beginPath(); if (g.roundRect) g.roundRect(5, 5, w - 10, h - 10, 18); else g.rect(5, 5, w - 10, h - 10); g.stroke(); g.fillText(text, w / 2, h / 2 + 3); return c.toDataURL('image/png');
  }
  A['i-stamp'] = function () {
    Ui.sheet('stamps', '<h2 class="sh-h">' + esc(t('st.title')) + '</h2><div class="al-list">' + STAMPS.map(function (s, i) { return '<button type="button" class="opt al-row" data-act="st-go" data-i="' + i + '"><span class="op-t"><b style="color:' + s[1] + '">' + esc(s[0] === 'date' ? new Date().toLocaleDateString(I18n.locale()) : t('st.' + s[0])) + '</b></span></button>'; }).join('') + '</div>' + field('stCustom', t('st.custom'), '', t('st.custom')) + foot('st-custom', t('st.make')));
  };
  A['st-go'] = function (el) { var s = STAMPS[+el.dataset.i]; Ui.closeSheet(); Sign.start(stampPng(s[0] === 'date' ? new Date().toLocaleDateString(I18n.locale()) : t('st.' + s[0]).toUpperCase(), s[1]), { plain: true, wide: 0.3 }); };
  A['st-custom'] = function () { var v = ($('stCustom').value || '').trim(); if (!v) return Ui.toast(t('st.empty')); Ui.closeSheet(); Sign.start(stampPng(v.toUpperCase(), C('sw_red')), { plain: true, wide: 0.35 }); };

  // ---- pages from another PDF, from pictures ---------------------------------------------------------------------------------------
  A['i-pages'] = async function () {
    var fs = await pick('document', ['application/pdf'], 'Add pages from another PDF'); if (!fs[0]) return;
    try { await Files.request(fs[0].url); var buf = await (await fetch(fs[0].url)).arrayBuffer(), at = Desk.cur() + 1; Doc.fresh = true; if (await Viewer.run(function () { return PdfSvc.insertPages({ other: buf, at: at }); }, 'busy.pages')) { Ui.toast(t('po.added')); Desk.go(at); } } catch (e) { fail(e); }
  };
  A['i-imgpages'] = async function () {
    var fs = await pick('image', ['image/*'], 'Make pages from pictures', true); if (!fs.length) return; var at = Desk.cur() + 1;
    try {
      Doc.fresh = true;
      var ok = await Viewer.run(async function () {
        var r = null; for (var k = 0; k < fs.length; k++) {
          try { await Files.request(fs[k].url); } catch (e) { /* a plain file */ }
          var buf = await (await fetch(fs[k].url)).arrayBuffer(), u = new Uint8Array(buf, 0, 4), jpg = u[0] === 0xFF && u[1] === 0xD8, png = u[0] === 0x89 && u[1] === 0x50;
          if (!jpg && !png) { var bm = await createImageBitmap(new Blob([buf])), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); buf = await new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(res); }, 'image/png'); }); }
          r = await PdfSvc.imagePage(jpg ? { jpg: buf, at: at + k, fit: 'a4' } : { png: buf, at: at + k, fit: 'a4' });
        } return r;
      }, 'busy.pages'); if (ok) { Ui.toast(t('po.added')); Desk.go(at); }
    } catch (e) { fail(e); }
  };

  // ---- trim margins ---------------------------------------------------------------------------------------------------------------------------
  var cr = { all: false, mm: 10 };
  function cropSheet() {
    Ui.sheet('crop', '<h2 class="sh-h">' + esc(t('po.crop')) + '</h2><p class="sx-meta">' + esc(t('po.crop.s')) + '</p>' + chips('cr-mm', [[5, '5 mm'], [10, '10 mm'], [15, '15 mm'], [20, '20 mm'], [30, '30 mm']], cr.mm)
      + '<div class="sx-sec">' + esc(t('po.which')) + '</div>' + chips('cr-all', [['0', t('po.this')], ['1', t('po.every')]], cr.all ? 1 : 0) + foot('cr-go', t('po.crop.go')));
  }
  A['cr-mm'] = function (el) { cr.mm = +el.dataset.k; cropSheet(); }; A['cr-all'] = function (el) { cr.all = el.dataset.k === '1'; cropSheet(); };
  A['cr-go'] = function () {
    Ui.closeSheet(); var pts = cr.mm / 25.4 * 72, pages = cr.all ? Doc.sizes.map(function (_, i) { return i; }) : [Desk.cur()];
    Doc.fresh = true; Viewer.run(function () { return PdfSvc.crop({ pages: pages, margins: [pts, pts, pts, pts] }); }, 'busy.pages');
  };

  // ---- page numbers -------------------------------------------------------------------------------------------------------------------------
  var nm = { pos: 'bc', fmt: '{n}', start: 1 };
  function numSheet() {
    Ui.sheet('numbers', '<h2 class="sh-h">' + esc(t('po.num')) + '</h2>' + chips('nm-pos', [['bc', t('po.bc')], ['br', t('po.br')], ['bl', t('po.bl')], ['tc', t('po.tc')], ['tr', t('po.tr')]], nm.pos)
      + '<div class="sx-sec">' + esc(t('po.fmt')) + '</div>' + chips('nm-fmt', [['{n}', '1'], ['{n} / {t}', '1 / 10'], ['Page {n} of {t}', 'Page 1 of 10'], ['- {n} -', '- 1 -']], nm.fmt) + '<div class="sx-sec">' + esc(t('po.start')) + '</div>' + field('nmStart', t('po.start'), nm.start, '1', 'number') + foot('nm-go', t('po.num.go')));
  }
  A['nm-pos'] = function (el) { nm.start = +($('nmStart').value || 1); nm.pos = el.dataset.k; numSheet(); }; A['nm-fmt'] = function (el) { nm.start = +($('nmStart').value || 1); nm.fmt = el.dataset.k; numSheet(); };
  A['nm-go'] = function () { nm.start = +($('nmStart').value || 1); Ui.closeSheet(); Doc.fresh = true; Viewer.run(function () { return PdfSvc.numbers({ format: nm.fmt, h: nm.pos.charAt(1), v: nm.pos.charAt(0), start: nm.start, size: 10 }); }, 'busy.pages'); };

  // ---- watermark --------------------------------------------------------------------------------------------------------------------------------
  var wm = { text: '', op: 0.25, ang: 45, color: C('sw_red') };
  function wmSheet() {
    Ui.sheet('wm', '<h2 class="sh-h">' + esc(t('po.wm')) + '</h2>' + field('wmText', t('po.wm.text'), wm.text, t('po.wm.ph')) + '<div class="sx-sec">' + esc(t('po.angle')) + '</div>' + chips('wm-ang', [[0, '0°'], [45, '45°'], [-45, '−45°']], wm.ang)
      + '<div class="sx-sec">' + esc(t('po.opacity')) + '</div>' + chips('wm-op', [[0.15, '15%'], [0.25, '25%'], [0.4, '40%'], [0.6, '60%']], wm.op) + '<div class="sx-sec">' + esc(t('po.color')) + '</div>' + chips('wm-col', [[C('sw_red'), t('c.sw_red')], [C('sw_blue'), t('c.sw_blue')], [C('sw_gray'), t('c.sw_gray')], [C('sw_black'), t('c.sw_black')]], wm.color) + foot('wm-go', t('po.wm.go')));
  }
  function keep() { var v = $('wmText'); if (v) wm.text = v.value; }
  A['wm-ang'] = function (el) { keep(); wm.ang = +el.dataset.k; wmSheet(); }; A['wm-op'] = function (el) { keep(); wm.op = +el.dataset.k; wmSheet(); }; A['wm-col'] = function (el) { keep(); wm.color = el.dataset.k; wmSheet(); };
  A['wm-go'] = function () {
    keep(); var txt = wm.text.trim(); if (!txt) return Ui.toast(t('po.wm.none')); Ui.closeSheet();
    var c = document.createElement('canvas'), g = c.getContext('2d'), f = '800 160px "Bricolage Grotesque", Arial, sans-serif'; g.font = f; c.width = Math.ceil(g.measureText(txt).width) + 40; c.height = 220; g = c.getContext('2d'); g.font = f; g.fillStyle = wm.color; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(txt, c.width / 2, c.height / 2 + 6);
    c.toBlob(function (b) {
      b.arrayBuffer().then(function (png) {
        var items = Doc.sizes.map(function (z, i) { var rot = z[2] || 0, W = rot % 180 ? z[1] : z[0], H = rot % 180 ? z[0] : z[1], w = Math.min(W * 0.8, H * 0.8), h = w * c.height / c.width, cx = z[0] / 2, cy = z[1] / 2; return { page: i, rect: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], rotate: wm.ang, opacity: wm.op }; });
        Doc.fresh = true; Viewer.run(function () { return PdfSvc.stamp({ png: png, items: items }); }, 'busy.pages');
      });
    }, 'image/png');
  };

  // ---- the phone's own tools: a copy with a password; a smaller copy ------------------------------------------------------------------------------
  async function tempPath() { var r = await NativeTools.call('save_local_file', { fileName: 'work.pdf', base64: App.b64(await PdfSvc.save()), reason: 'Prepare a copy' }); return r.data.path; }
  async function out(path, name) { var r = await NativeTools.call('export_file_device', { sourcePath: path, fileName: name, reason: 'Save the copy to the phone' }); return (r && r.data && r.data.displayPath) || 'Downloads'; }
  function base() { return Viewer.rec.name.replace(/\.pdf$/i, ''); }
  A['i-protect'] = function () { Ui.sheet('protect', '<h2 class="sh-h">' + esc(t('po.prot')) + '</h2><p class="sx-meta">' + esc(t('po.prot.s')) + '</p>' + field('pwNew', t('po.pw'), '', t('po.pw'), 'password') + foot('pr-go', t('po.prot.go'))); setTimeout(function () { var i = $('pwNew'); if (i) i.focus(); }, 380); };
  A['pr-go'] = async function () {
    var pw = $('pwNew').value; if (!pw) return Ui.toast(t('po.pw.none')); Ui.closeSheet(); Read.busy(t('busy.copy'));
    try { var src = await tempPath(), r = await NativeTools.call('protect_pdf', { sourcePath: src, password: pw, baseName: base() }), where = await out(r.data.path, base() + ' - protected.pdf'); Ui.toast(t('t.copied', { p: where })); } catch (e) { fail(e); }
    Read.idle();
  };
  A['i-compress'] = function () { Ui.sheet('compress', '<h2 class="sh-h">' + esc(t('po.cmp')) + '</h2><p class="sx-meta">' + esc(t('po.cmp.s')) + '</p>' + chips('cp-go', [['low', t('po.low')], ['medium', t('po.med')], ['high', t('po.high')]], 'medium')); };
  A['cp-go'] = async function (el) {
    var lv = el.dataset.k; Ui.closeSheet(); Read.busy(t('busy.copy'));
    try { var src = await tempPath(), r = await NativeTools.call('compress_pdf', { sourcePath: src, compressionLevel: lv }), where = await out(r.data.path, base() + ' - small.pdf'); Ui.toast(t('po.cmp.done', { n: Math.round(r.data.savedPercent || 0), p: where })); } catch (e) { fail(e); }
    Read.idle();
  };

  Menus.add('insert', function () { return [{ t: t('po.pic') + '…', go: A['i-pic'] }, { t: t('st.title') + '…', go: A['i-stamp'] }]; });
  Menus.add('page', function () { return [{ t: t('po.fromfile') + '…', go: A['i-pages'] }, { t: t('po.fromimg') + '…', go: A['i-imgpages'] }, '-', { t: t('po.crop') + '…', go: function () { cropSheet(); } }, { t: t('po.num') + '…', go: function () { numSheet(); } }, { t: t('po.wm') + '…', go: function () { wmSheet(); } }]; });
  Menus.add('file', function () { return [{ t: t('po.prot') + '…', go: A['i-protect'] }, { t: t('po.cmp') + '…', go: A['i-compress'] }]; });
})();
