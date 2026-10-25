// Text — changing the words of a box (one line per paragraph, the look of each paragraph stays) and choosing its font; the speaker notes of a slide.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts;
  var T = window.Text = { d: null };

  T.open = async function (focus) {
    var id = Deck.sel; if (!id) return; var r;
    try { r = await Deck.read(id); } catch (e) { return App.fail('err.generic', e); }
    if (!r.paragraphs) return;
    T.d = { id: id, ps: r.paragraphs, slide: Deck.cur };
    Ui.sheet('text', SheetsView.text({ text: r.paragraphs.map(function (p) { return p.text; }).join('\n') }));
    setTimeout(function () { var i = $('txIn'); if (i && focus !== false) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 380);
  };
  A['t-edit'] = function () { T.open(true); };
  A['tx-apply'] = function () {
    var d = T.d, v = $('txIn').value; Ui.closeSheet(); if (!d) return;
    var lines = v.replace(/\r/g, '').split('\n'), ps = (v.trim() === '' ? [] : lines).map(function (l, i) {
      var o = d.ps[Math.min(i, d.ps.length - 1)] || {}, p = { runs: [{ text: l }], align: o.align || 'left', level: o.level || 0 };
      if (o.bullet === 'char' || o.bullet === 'number' || o.bullet === 'none') p.bullet = o.bullet; return p;
    });
    if (ps.map(function (p) { return p.runs[0].text; }).join('\n') === d.ps.map(function (p) { return p.text; }).join('\n')) return;
    Viewer.run([Deck.op('setText', d.id, { paragraphs: ps }, d.slide)], 'busy.edit');
  };

  // ---- fonts: the name goes to the file as the PowerPoint name, the phone draws it with the look-alike ----------------------------------
  A['fo-open'] = function () { var f = (Quick.last && Quick.last.font) || {}; Ui.sheet('fonts', SheetsView.fonts(f.family || Fonts.def)); };
  A['q-font'] = function (b) { Ui.closeSheet(); Viewer.run([Deck.op('setFont', Deck.sel, { font: { fontFamily: b.dataset.n } })]); };

  // ---- speaker notes ---------------------------------------------------------------------------------------------------------------
  var nt = null;
  function meta() { var v = ($('ntIn').value || '').trim(), n = v ? v.split(/\s+/).length : 0; $('ntMeta').textContent = t('nt.words', { n: n, s: Math.max(1, Math.round(n / 2.5)) }); }
  A['m-notes'] = async function () {
    var i = Deck.cur, text = ''; try { text = await PptSvc.notes(i); } catch (e) { /* a slide without notes */ }
    nt = { slide: i, text: text }; Ui.sheet('notes', SheetsView.notes(text)); meta(); setTimeout(function () { var x = $('ntIn'); if (x) x.focus(); }, 380);
  };
  A['nt-done'] = function () { var v = $('ntIn').value, n = nt; Ui.closeSheet(); if (!n || v === n.text) return; Viewer.run([Deck.op('setNotes', null, { text: v }, n.slide)], 'busy.edit'); };
  document.addEventListener('input', function (e) { if (e.target.id === 'ntIn') meta(); });
})();
