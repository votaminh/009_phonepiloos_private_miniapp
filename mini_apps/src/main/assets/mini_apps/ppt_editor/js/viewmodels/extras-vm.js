// Extras — what a computer's deck editor has beyond the basics: a slide saved as a picture (PNG or JPG, one or all), the comments of a slide, "copy format / paste format" (Format Painter), and a grid with snap.
// Each one is an item in the menus (Menus.add), so the touch layout reaches them from "All features" too.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, X = window.Extras = { fmt: null };

  // ---- a slide as a picture ---------------------------------------------------------------------------------------------------------------
  async function shot(i, kind) {
    var W = 1920, H = Math.round(W * Deck.ratio()), cv = document.createElement('canvas'), ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
    var tree = await PptSvc.render(i, W); SlideDraw.draw(ctx, tree);
    var blob = await new Promise(function (r) { cv.toBlob(r, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.92); }); return App.b64(await blob.arrayBuffer());
  }
  function base() { return ((Viewer.rec && Viewer.rec.name) || 'slides').replace(/\.pptx$/i, ''); }
  async function save(i, kind) { var r = await NativeTools.call('export_file_device', { fileName: base() + '-' + (i + 1) + '.' + kind, base64: await shot(i, kind), reason: 'Save a slide as a picture' }); return r; }
  X.exportOne = async function (kind) { try { var r = await save(Deck.cur, kind); Ui.toast(t('ex.saved', { p: (r && r.data && r.data.displayPath) || '' })); } catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); } };
  X.exportAll = async function (kind) {
    try { var n = Deck.count(), done = 0; for (var i = 0; i < n; i++) { if (Deck.info.slides[i].hidden) continue; Ui.toast(t('ex.progress', { n: i + 1, t: n })); await save(i, kind); done++; } Ui.toast(t('ex.all', { n: done })); }
    catch (e) { if (String(e && e.message) !== 'cancelled') App.fail('err.generic', e); }
  };

  // ---- comments -------------------------------------------------------------------------------------------------------------------------------
  function when(dt) { var d = new Date(dt); return isNaN(d) ? '' : d.toLocaleDateString(I18n.locale()) + ' ' + d.toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' }); }
  X.comments = async function () {
    if (!Deck.info) return; var i = Deck.cur, list = []; try { list = (await PptSvc.comments(i)) || []; } catch (e) { /* none */ }
    var author = (Store.prefs().author || ''), h = '<h2 class="sh-h">' + esc(t('cm.title')) + '</h2><p class="sx-meta">' + esc(t('dk.slide', { n: i + 1, t: Deck.count() })) + '</p><div class="cm-list">';
    h += list.length ? list.map(function (c) { return '<div class="cm-row"><div><b>' + esc(c.author) + '</b><small>' + esc(when(c.dt)) + '</small></div><p>' + esc(c.text) + '</p><button type="button" class="ib" data-act="cm-del" data-a="' + c.authorId + '" data-i="' + c.idx + '" aria-label="' + esc(t('cm.del')) + '">' + ic('trash', 18, 2) + '</button></div>'; }).join('') : '<p class="ip-hint">' + esc(t('cm.none')) + '</p>';
    h += '</div><label class="sx-find"><input id="cmAuthor" type="text" value="' + esc(author) + '" placeholder="' + esc(t('cm.author')) + '" autocomplete="off"></label><label class="sx-find"><textarea id="cmText" rows="3" placeholder="' + esc(t('cm.ph')) + '"></textarea></label>'
      + '<div class="btns"><button type="button" class="btn ol" data-act="sheet-done">' + esc(t('a.close')) + '</button><button type="button" class="btn" data-act="cm-add">' + esc(t('cm.add')) + '</button></div>';
    Ui.sheet('comments', h);
  };
  A['cm-add'] = async function () {
    var a = ($('cmAuthor').value || '').trim() || t('cm.me'), text = ($('cmText').value || '').trim(); if (!text) return Ui.toast(t('cm.empty')); Store.savePrefs({ author: a });
    var r = await Viewer.run([Deck.op('addComment', null, { author: a, text: text })], 'busy.edit'); if (r) X.comments();
  };
  A['cm-del'] = async function (b) { var r = await Viewer.run([Deck.op('deleteComment', null, { authorId: +b.dataset.a, idx: +b.dataset.i })], 'busy.edit'); if (r) X.comments(); };

  // ---- copy format, paste format --------------------------------------------------------------------------------------------------------------
  X.copyFormat = function () {
    var r = Quick.last; if (!Deck.sel || !r) return Ui.toast(t('fp.pick'));
    var p = (r.paragraphs && r.paragraphs[0]) || {}, m = r.more || {};
    X.fmt = { fill: r.fill, stroke: r.stroke, dash: m.dash, font: r.font, align: p.align, hasText: !!r.font }; Ui.toast(t('fp.copied'));
  };
  X.pasteFormat = async function () {
    var f = X.fmt; if (!f) return Ui.toast(t('fp.none')); if (!Deck.sel) return Ui.toast(t('fp.pick'));
    if (f.fill != null) await Sel.fill(f.fill);
    await Sel.stroke(f.stroke ? { color: f.stroke.color, widthEmu: Math.round(f.stroke.widthPt * 12700), dash: f.dash && f.dash !== 'solid' ? f.dash : undefined } : null);
    if (f.hasText && f.font) {
      var q = {}, o = f.font; if (o.family) q.fontFamily = o.family; if (o.size) q.fontSizePt = o.size; q.bold = !!o.bold; q.italic = !!o.italic; q.underline = !!o.underline; if (o.color) q.color = o.color;
      await Sel.font(q); if (f.align) await Sel.para({ align: f.align });
    }
  };

  // ---- the grid ---------------------------------------------------------------------------------------------------------------------------------
  X.step = function () { return Deck.info ? 457200 / Deck.k() : 0; };   // half an inch, in slide pixels
  X.grid = function () { return !!Store.prefs().grid; }; X.snap = function () { return !!Store.prefs().snap; };
  X.paintGrid = function () {
    var el = $('gridLines'); if (!el) { el = document.createElement('div'); el.id = 'gridLines'; $('slideBox').insertBefore(el, $('slideBox').firstChild); }
    var s = X.step(), c = C('line'); el.style.display = X.grid() && s ? 'block' : 'none'; if (s) el.style.cssText += ';background-size:' + s + 'px ' + s + 'px;background-image:linear-gradient(to right,' + c + ' 1px,transparent 1px),linear-gradient(to bottom,' + c + ' 1px,transparent 1px)';
  };
  X.toggle = function (k) { var p = {}; p[k] = !Store.prefs()[k]; Store.savePrefs(p); X.paintGrid(); };
  // a position pulled to the nearest line of the grid
  X.snapTo = function (v) { var s = X.step(); return s ? Math.round(v / s) * s : v; };

  if (window.Menus) {
    Menus.add('file', function () { return [{ t: t('ex.png'), go: function () { X.exportOne('png'); } }, { t: t('ex.jpg'), go: function () { X.exportOne('jpg'); } }, { t: t('ex.allpng'), go: function () { X.exportAll('png'); } }]; });
    Menus.add('insert', function () { return [{ t: t('cm.title') + '…', go: X.comments }]; });
    Menus.add('format', function () { return [{ t: t('fp.copy'), k: Menus.K + '⇧C', go: X.copyFormat, off: !Deck.sel }, { t: t('fp.paste'), k: Menus.K + '⇧V', go: X.pasteFormat, off: !Deck.sel || !X.fmt }]; });
    Menus.add('view', function () { return [{ t: t('gr.grid'), on: X.grid(), go: function () { X.toggle('grid'); } }, { t: t('gr.snap'), on: X.snap(), go: function () { X.toggle('snap'); } }]; });
  }
  document.addEventListener('keydown', function (e) {
    if (!Wide.pc || !(e.ctrlKey || e.metaKey) || !e.shiftKey || !Deck.info || Ui.state.sheet || Ui.state.dlg || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) || (window.Inline && Inline.on) || Deck.view === 'sort') return;
    var k = e.key.toLowerCase(); if (k === 'c') { e.preventDefault(); X.copyFormat(); } else if (k === 'v') { e.preventDefault(); X.pasteFormat(); }
  }, true);
})();
