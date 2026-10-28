// Ctx — the right-click menu of a computer: it offers what fits the thing under the pointer (a picture, a shape, a link, a table cell, plain text).
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, K = /Mac/i.test(navigator.platform) ? 'Cmd+' : 'Ctrl+';
  function it(key, k, go, o) { return Object.assign({ t: t(key), k: k, go: go }, o || {}); }
  // a menu action that opens a pop-up wants an element to anchor to: here a loose one at the place of the right click
  var at = { x: 0, y: 0 };
  function stub() { var d = document.createElement('div'); d.getBoundingClientRect = function () { return { left: at.x, bottom: at.y }; }; return d; }
  function act(a, arg) { return function () { A[a](arg || stub()); }; }
  function exec(c) { return function () { Surface.focus(); document.execCommand(c); Edit.mark(); Doc.touch(); }; }
  function q(c) { try { return document.queryCommandState(c); } catch (e) { return false; } }
  function turn(d) { return act('pic-rot', { dataset: { d: d } }); }
  function drop(b) { return function () { var nx = b.nextElementSibling; b.remove(); Doc.snap(); Doc.dirty = true; Doc.touch(); Doc.chrome(); if (window.Paginate) Paginate.schedule(0); if (nx && nx.focus) nx.focus(); }; }
  function pictureItems(b) {
    document.querySelectorAll('#paper .b.sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel');
    return [it('pic.rotl', '', turn(-90), { ic: 'rotl' }), it('pic.rotr', '', turn(90), { ic: 'rotr' }), it('pic.crop', '', act('pic-crop'), { ic: 'crop' }), it('pic.wrap', '', act('pic-wrap'), { ic: 'wrap' }), '-', it('cx.delete', '', act('pic-del'), { ic: 'trash', danger: true })];
  }
  // The text menu keeps what Home does not hold or what is quicker under the pointer: clipboard, link, notes, the table's own rows and columns. Bold, italic, alignment, lists
  // and the rest of the paragraph and font tools are in the Home tab and are not repeated here.
  function textItems(e1, td, a) {
    var items = [it('q.cut', K + 'X', exec('cut'), { off: !e1, ic: 'scissors' }), it('q.copy', K + 'C', exec('copy'), { ic: 'copy' }), it('q.paste', K + 'V', act('q-paste'), { off: !e1, ic: 'clip' }), '-',
      it('i.link', K + 'K', act('e-link'), { off: !e1, ic: 'link' })];
    if (a) items.push(it('cx.open', '', function () { NativeTools.call('open_url', { url: a.dataset.href, reason: 'Open a link' }).catch(function () {}); }, { ic: 'openlink' }));
    items.push('-', it('cm.new', K + 'Alt+M', act('rv-new'), { off: !e1, ic: 'comment' }), it('fn.new', K + 'Alt+F', act('rf-fn'), { off: !e1, ic: 'footnote' }));
    if (td && e1) items = items.concat(['-', it('tb.rowa', '', act('t-rowa'), { ic: 'rowabove' }), it('tb.rowb', '', act('t-rowb'), { ic: 'rowbelow' }), it('tb.cola', '', act('t-cola'), { ic: 'colleft' }), it('tb.colb', '', act('t-colb'), { ic: 'colright' }), it('tb.delrow', '', act('t-delrow'), { ic: 'delrow', danger: true }), it('tb.delcol', '', act('t-delcol'), { ic: 'delcol', danger: true }), it('tb.deltable', '', act('t-deltable'), { ic: 'deltable', danger: true }), '-', it('tb.merge', '', act('t-merge'), { ic: 'merge' }), it('tb.split', '', act('t-split'), { ic: 'split' })]);
    return items.concat(['-', it('dk.selall', K + 'A', function () { document.execCommand('selectAll'); }, { ic: 'selectall' }), it('ky.help', 'F1', act('ky-help'), { ic: 'keyboard' })]);
  }
  Doc.paper().addEventListener('contextmenu', function (e) {
    if (!Wide.pc) return; e.preventDefault(); e.stopImmediatePropagation();
    var e1 = Doc.mode === 'edit', tg = e.target.closest ? e.target : null, pic = tg && tg.closest('.b.imgp'), shp = tg && tg.closest('.b.shp'), td = tg && tg.closest('.tbl td'), a = tg && tg.closest('a.lnk');
    var items; at.x = e.clientX; at.y = e.clientY;
    if (!e1) items = [it('q.copy', K + 'C', exec('copy'), { ic: 'copy' }), it('dk.selall', K + 'A', function () { document.execCommand('selectAll'); }, { ic: 'selectall' }), '-', it('a.edit', '', act('d-edit'), { ic: 'edit' }), it('ky.help', 'F1', act('ky-help'), { ic: 'keyboard' })];
    else if (pic && (Doc.pics[pic.dataset.n] || pic.dataset.src !== undefined)) items = pictureItems(pic);
    else if (shp && shp.dataset.shp) items = [it('a.edit', '', function () { Shape.edit(shp); }, { ic: 'edit' }), '-', it('cx.delete', '', drop(shp), { ic: 'trash', danger: true })];
    else items = textItems(e1, td, a);
    PopMenu.show(e.clientX, e.clientY, items);
  }, true);
})();
