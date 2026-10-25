// Clip — what is typed into a cell (numbers, percents, dates, formulas), copy / cut / paste, the automatic sum and the numbers shown under a selected range.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, G = window.Grid, EPOCH = Date.UTC(1899, 11, 30), mem = null;
  var Clip = window.Clip = {};

  function serial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000); }
  // the text typed into the formula bar -> { v, f, nf }
  Clip.parse = function (text, st) {
    if (text === '') return { v: null };
    if (text[0] === '=' && text.length > 1) return { f: text };
    if (text[0] === "'") return { v: text.slice(1) };
    if (st && st.nf === '@') return { v: text };
    var s = text.trim(), m;
    if (/^(true|false)$/i.test(s)) return { v: s.toUpperCase() === 'TRUE' };
    if (/^[-+]?\d+([.,]\d+)?$/.test(s) && s.length < 16) return { v: Number(s.replace(',', '.')) };
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { v: Number(s.replace(/,/g, '')) };
    if ((m = /^([-+]?\d+(?:[.,]\d+)?)%$/.exec(s))) return { v: Number(m[1].replace(',', '.')) / 100, nf: st && st.nf ? undefined : '0.##%' };
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s)) && +m[2] <= 12 && +m[1] <= 31) return { v: serial(+m[3], +m[2], +m[1]), nf: st && st.nf ? undefined : 'dd/mm/yyyy' };
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)) && +m[2] <= 12) return { v: serial(+m[1], +m[2], +m[3]), nf: st && st.nf ? undefined : 'dd/mm/yyyy' };
    return { v: text };
  };
  Clip.shift = function (f, dr, dc) { return shift(f, dr, dc); };
  // formula text moved by (dr, dc): relative references follow, $ ones stay
  function shift(f, dr, dc) {
    return f.replace(/(^|[^A-Za-z0-9_'!.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, function (all, pre, ca, col, ra, row) {
      var c = ca ? col : SheetSvc.col(CalcParse.colNum(col) + dc), r = ra ? +row : +row + dr;
      return pre + ca + (CalcParse.colNum(c) < 0 || r < 1 ? '#REF!' : c) + ra + (r < 1 ? '' : r);
    });
  }

  // text of the system clipboard (tab separated, a field with line breaks in quotes) -> rows of cells
  function tsv(text) {
    var rows = [], row = [], f = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') q = false; else f += ch; }
      else if (ch === '"' && f === '') q = true;
      else if (ch === '\t') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function field(v) { return /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  // copy or cut the selection: the cells (with formulas and looks) stay in memory; the system clipboard gets their text
  function copy(cut, ev) {
    var s = G.sel, sh = G.geo.sh, r2 = s.whole === 'col' ? Math.max(sh.rows - 1, 0) : s.r2, c2 = s.whole === 'row' ? Math.max(sh.cols - 1, 0) : s.c2, rows = [], lines = [], r, c;
    for (r = s.r1; r <= r2; r++) {
      var row = [], line = [];
      for (c = s.c1; c <= c2; c++) { var cell = sh.cells[SheetSvc.ref(r, c)]; row.push({ v: cell ? cell.v : null, f: cell && cell.f || '', st: Object.assign({}, sh.ov[SheetSvc.ref(r, c)] || {}), base: sh.cs[SheetSvc.ref(r, c)] }); line.push(field(Fmt.cell(sh, r, c).t)); }
      rows.push(row); lines.push(line.join('\t'));
    }
    mem = { rows: rows, r: s.r1, c: s.c1, text: lines.join('\n'), cut: !!cut, sh: sh, box: { r1: s.r1, c1: s.c1, r2: r2, c2: c2 } };
    if (ev && ev.clipboardData) { ev.clipboardData.setData('text/plain', mem.text); ev.preventDefault(); }
    else { try { if (navigator.clipboard) navigator.clipboard.writeText(mem.text).catch(function () {}); } catch (e) { /* the page's own clipboard still works */ } }
    Clip.mark(); if (!ev || ev.type === 'copy') Ui.toast(t('q.copied')); else Ui.toast(t('q.cutd'));
  }
  // a cut is done when it is pasted (like Excel): until then the cells stay, dashed
  function wipe() { var b = mem.box, sh = mem.sh; Wb.batch(function () { var r, c; for (r = b.r1; r <= b.r2; r++) for (c = b.c1; c <= b.c2; c++) { Wb.setCell(sh, r, c, null, ''); } }); }
  // what: all | values | formulas | formats | transpose (+ values only variants). text: from the system clipboard when it is not ours
  function place(src, opt) {
    var s = G.sel, sh = G.geo.sh, what = opt.what || 'all', rows = src.rows, tr = what === 'transpose';
    if (tr) rows = rows[0].map(function (_, j) { return rows.map(function (rw) { return rw[j]; }); });
    var h = rows.length, w = rows[0].length, tall = (s.r2 - s.r1 + 1), wide = (s.c2 - s.c1 + 1), reps = [Math.max(1, Math.floor(tall / h)), Math.max(1, Math.floor(wide / w))];
    if (h * w === 1 && (tall > 1 || wide > 1)) reps = [tall, wide];
    Wb.batch(function () {
      var i, j, a, b;
      for (a = 0; a < reps[0]; a++) for (b = 0; b < reps[1]; b++) rows.forEach(function (row, i) { row.forEach(function (x, j) {
        var r = s.r1 + a * h + i, c = s.c1 + b * w + j; if (r >= 1048576 || c >= 16384) return;
        if (what !== 'formats') {
          var f = x.f && what !== 'values' ? shift(x.f, r - src.r - (tr ? j : i), c - src.c - (tr ? i : j)) : '', v = x.f && what === 'values' ? Calc.value(src.sh || sh, src.r + (tr ? j : i), src.c + (tr ? i : j)) : x.v;
          if (what !== 'formats') Wb.setCell(sh, r, c, f ? null : (v && typeof v === 'object' ? null : v), f);
        }
        if ((what === 'all' || what === 'formats' || what === 'transpose') && x.st) Wb.setStyle(sh, { r1: r, c1: c, r2: r, c2: c }, Object.assign({}, x.st));
      }); });
    });
    G.select(s.r1, s.c1, s.r1 + h * reps[0] - 1, s.c1 + w * reps[1] - 1);
  }
  function paste(opt, ev) {
    opt = opt || {}; var src = null, text = ev && ev.clipboardData ? ev.clipboardData.getData('text/plain') : opt.text;
    if (mem && (text === undefined || text === mem.text)) src = mem;
    else if (text) src = { rows: tsv(text).map(function (l) { return l.map(function (x) { var p = Clip.parse(x, null); return { v: p.v === undefined ? null : p.v, f: p.f || '', st: p.nf ? { nf: p.nf } : {} }; }); }), r: 0, c: 0, ext: true };
    if (!src || !src.rows.length || !src.rows[0].length) return Ui.toast(t('q.empty'));
    if (ev) ev.preventDefault();
    place(src, opt);
    if (src === mem && mem.cut && !opt.keep) { wipe(); mem = Object.assign({}, mem, { cut: false }); }
    Clip.mark(); G.changed();
  }
  Clip.copy = function (cut, ev) { copy(cut, ev); if (cut && !ev) { /* the cells go when pasted */ } };
  Clip.paste = function (opt) {
    if (mem) return paste(opt);
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (tx) { paste(Object.assign({}, opt, { text: tx })); }, function () { Ui.toast(t('q.empty')); });
    else Ui.toast(t('q.empty'));
  };
  Clip.pasteMode = function (what) { paste({ what: what }); };
  Clip.marked = function () { return mem; };
  // the dashed frame round what was copied
  Clip.mark = function () { G.place(); };
  Clip.unmark = function () { if (mem) { mem = null; G.place(); } };
  // Ctrl+; today's date, Ctrl+Shift+; the time now
  Clip.stamp = function (time) {
    var s = G.act(), sh = G.geo.sh, n = new Date(), v = time ? (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400 : serial(n.getFullYear(), n.getMonth() + 1, n.getDate());
    Wb.batch(function () { Wb.setCell(sh, s.r, s.c, v, ''); Wb.setStyle(sh, { r1: s.r, c1: s.c, r2: s.r, c2: s.c }, { nf: time ? 'hh:mm' : 'dd/mm/yyyy' }); }); G.changed();
  };
  // the browser's own copy / cut / paste events (so the clipboard of other apps works): only while the grid, not a text box, has the keys
  function ours(e) { return App.state.page === 'book' && G.geo && !Ui.state.sheet && !Ui.state.dlg && !(e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]')); }
  document.addEventListener('copy', function (e) { if (ours(e)) copy(false, e); });
  document.addEventListener('cut', function (e) { if (ours(e) && !Wb.readOnly) copy(true, e); });
  document.addEventListener('paste', function (e) { if (ours(e) && !Wb.readOnly) paste({}, e); });
  A['q-copy'] = function () { Clip.copy(false); G.qk = false; G.place(); };
  A['q-cut'] = function () { Clip.copy(true); G.qk = false; G.place(); };
  A['q-paste'] = function () { G.qk = false; Clip.paste(); };
  A['q-more'] = function () { Ui.sheet('qmore', SheetsView.more()); };

  // ∑: a range of numbers gets its total under it (or beside it); one cell looks for the numbers above, then to the left
  A['q-sum'] = function () {
    var s = G.sel, sh = G.geo.sh, w = s.c2 - s.c1 + 1, h = s.r2 - s.r1 + 1, c, r;
    function ref(a, b, c1, c2) { return SheetSvc.ref(a, c1) + ':' + SheetSvc.ref(b, c2); }
    function numeric(r, c) { return typeof Calc.value(sh, r, c) === 'number'; }
    Wb.batch(function () {
      if (w * h > 1) {
        if (h > 1 || w === 1) for (c = s.c1; c <= s.c2; c++) Wb.setCell(sh, s.r2 + 1, c, null, '=SUM(' + ref(s.r1, s.r2, c, c) + ')');
        else Wb.setCell(sh, s.r1, s.c2 + 1, null, '=SUM(' + ref(s.r1, s.r1, s.c1, s.c2) + ')');
      } else {
        for (r = s.r1 - 1; r >= 0 && numeric(r, s.c1); r--);
        if (r < s.r1 - 1) Wb.setCell(sh, s.r1, s.c1, null, '=SUM(' + ref(r + 1, s.r1 - 1, s.c1, s.c1) + ')');
        else { for (c = s.c1 - 1; c >= 0 && numeric(s.r1, c); c--); Wb.setCell(sh, s.r1, s.c1, null, c < s.c1 - 1 ? '=SUM(' + ref(s.r1, s.r1, c + 1, s.c1 - 1) + ')' : '=SUM()'); }
      }
    });
    G.qk = false; G.changed();
  };

  // Sum / Avg / Min / Max / Count of the numbers in the selection: a floating pill that fades in; a number that changes fades across
  Clip.stats = function () {
    var el = $('bookStats'), s = G.sel, sh = G.geo.sh; if (!el) return;
    if (s.r1 === s.r2 && s.c1 === s.c2) { el.classList.remove('on'); return; }
    var n = [], r, c, r2 = s.whole === 'col' ? Math.min(s.r2, sh.rows) : s.r2, c2 = s.whole === 'row' ? Math.min(s.c2, sh.cols) : s.c2;
    for (r = s.r1; r <= r2 && n.length < 200000; r++) for (c = s.c1; c <= c2; c++) { var cell = sh.cells[SheetSvc.ref(r, c)]; if (!cell) continue; var v = Calc.value(sh, r, c); if (typeof v === 'number') n.push(v); }
    if (!n.length) { el.classList.remove('on'); return; }
    var sum = n.reduce(function (a, b) { return a + b; }, 0), f = function (x) { return String(+x.toFixed(4)); };
    var vals = [f(sum), f(sum / n.length), f(Math.min.apply(null, n)), f(Math.max.apply(null, n)), String(n.length)], spans = el.children;
    if (spans.length !== 5 || el.dataset.l !== I18n.locale()) { el.innerHTML = GridView.stats({ sum: vals[0], avg: vals[1], min: vals[2], max: vals[3], count: vals[4] }); el.dataset.l = I18n.locale(); }
    else Array.prototype.forEach.call(spans, function (sp, i) { var tn = sp.lastChild; if (tn.nodeValue !== ' ' + vals[i]) { tn.nodeValue = ' ' + vals[i]; Motion.anim(sp, [{ opacity: 0.3 }, { opacity: 1 }], { duration: 150 }); } });
    el.classList.add('on');
  };
  Clip.clear = function () { var s = G.sel, sh = G.geo.sh, r, c; Wb.batch(function () { for (r = s.r1; r <= Math.min(s.r2, sh.rows); r++) for (c = s.c1; c <= Math.min(s.c2, sh.cols); c++) Wb.setCell(sh, r, c, null, ''); }); G.changed(); };
  A['q-clear'] = function () { Ui.closeSheet(); Clip.clear(); };
})();
