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
    return [it('pic.rotl', '', turn(-90)), it('pic.rotr', '', turn(90)), it('pic.crop', '', act('pic-crop')), it('pic.wrap', '', act('pic-wrap')), '-', it('cx.delete', '', act('pic-del'))];
  }
  function textItems(e1, td, a) {
    var items = [it('q.cut', K + 'X', exec('cut'), { off: !e1 }), it('q.copy', K + 'C', exec('copy')), it('q.paste', K + 'V', act('q-paste'), { off: !e1 }), '-',
      it('f.bold', K + 'B', act('e-bold'), { off: !e1, on: e1 && q('bold') }), it('f.italic', K + 'I', act('e-italic'), { off: !e1, on: e1 && q('italic') }), it('f.underline', K + 'U', act('e-underline'), { off: !e1, on: e1 && q('underline') }),
      it('f.strike', '', act('e-strike'), { off: !e1, on: e1 && q('strikeThrough') }), it('cx.clear', K + 'Space', act('e-clear'), { off: !e1 }), '-',
      it('p.left', K + 'L', act('e-al-left'), { off: !e1 }), it('p.center', K + 'E', act('e-al-center'), { off: !e1 }), it('p.right', K + 'R', act('e-al-right'), { off: !e1 }), it('p.justify', K + 'J', act('e-al-justify'), { off: !e1 }), '-',
      it('p.bullets', K + 'Shift+L', act('e-bul'), { off: !e1 }), it('p.numbers', '', act('e-num'), { off: !e1 }), it('p.indent', K + 'M', act('pa-in', { dataset: { v: 1 } }), { off: !e1 }), it('p.outdent', K + 'Shift+M', act('pa-in', { dataset: { v: -1 } }), { off: !e1 }), '-',
      it('i.link', K + 'K', act('e-link'), { off: !e1 })];
    if (a) items.push(it('cx.open', '', function () { NativeTools.call('open_url', { url: a.dataset.href, reason: 'Open a link' }).catch(function () {}); }));
    items.push('-', it('cm.new', K + 'Alt+M', act('rv-new'), { off: !e1 }), it('fn.new', K + 'Alt+F', act('rf-fn'), { off: !e1 }));
    if (td && e1) items = items.concat(['-', it('tb.rowa', '', act('t-rowa')), it('tb.rowb', '', act('t-rowb')), it('tb.cola', '', act('t-cola')), it('tb.colb', '', act('t-colb')), it('tb.delrow', '', act('t-delrow')), it('tb.delcol', '', act('t-delcol')), it('tb.deltable', '', act('t-deltable'))]);
    return items.concat(['-', it('dk.selall', K + 'A', function () { document.execCommand('selectAll'); }), it('ky.help', 'F1', act('ky-help'))]);
  }
  Doc.paper().addEventListener('contextmenu', function (e) {
    if (!Wide.pc) return; e.preventDefault(); e.stopImmediatePropagation();
    var e1 = Doc.mode === 'edit', tg = e.target.closest ? e.target : null, pic = tg && tg.closest('.b.imgp'), shp = tg && tg.closest('.b.shp'), td = tg && tg.closest('.tbl td'), a = tg && tg.closest('a.lnk');
    var items; at.x = e.clientX; at.y = e.clientY;
    if (!e1) items = [it('q.copy', K + 'C', exec('copy')), it('dk.selall', K + 'A', function () { document.execCommand('selectAll'); }), '-', it('a.edit', '', act('d-edit')), it('ky.help', 'F1', act('ky-help'))];
    else if (pic && (Doc.pics[pic.dataset.n] || pic.dataset.src !== undefined)) items = pictureItems(pic);
    else if (shp && shp.dataset.shp) items = [it('a.edit', '', function () { Shape.edit(shp); }), '-', it('cx.delete', '', drop(shp))];
    else items = textItems(e1, td, a);
    PopMenu.show(e.clientX, e.clientY, items);
  }, true);
})();
